import { registerOrderAndAssociateCustomer } from "./register-order-and-associate-customer-service";
import {
    ContactEntity,
    CustomerEntity,
    OrderEntity,
    OrderStage,
    PhoneNumber,
    Name,
    EmailAddress,
    Address,
} from "./shared";

// Mock the entities
jest.mock("./shared", () => ({
    ContactEntity: {
        findOrCreateByEmail: jest.fn(),
    },
    CustomerEntity: {
        findOrCreateByPostalAddress: jest.fn(),
    },
    OrderEntity: {
        load: jest.fn(),
    },
    OrderStage: {
        Created: "CREATED",
        Draft: "DRAFT",
    },
    PhoneNumber: {
        create: jest.fn(),
    },
    Name: {
        create: jest.fn(),
    },
    EmailAddress: {
        create: jest.fn(),
    },
    Address: {
        create: jest.fn(),
    },
    Logger: {
        create: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
        })),
    },
}));

describe("registerOrderAndAssociateCustomer", () => {
    let mockContact: jest.Mocked<ContactEntity>;
    let mockCustomer: jest.Mocked<CustomerEntity>;
    let mockOrder: jest.Mocked<OrderEntity>;
    let mockUpdatedContact: jest.Mocked<ContactEntity>;
    let mockUpdatedCustomer: jest.Mocked<CustomerEntity>;
    let mockUpdatedOrder: jest.Mocked<OrderEntity>;

    const mockOrderId = "test-order-id";
    const mockContactId = "test-contact-id";
    const mockCustomerId = "test-customer-id";

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock contact
        mockContact = {
            id: mockContactId,
            customer: mockCustomerId,
            update: jest.fn(),
        } as unknown as jest.Mocked<ContactEntity>;

        // Create mock updated contact
        mockUpdatedContact = {
            id: mockContactId,
            customer: mockCustomerId,
            phone: PhoneNumber.create("123456789"),
            update: jest.fn(),
        } as unknown as jest.Mocked<ContactEntity>;

        // Create mock customer
        mockCustomer = {
            id: mockCustomerId,
            primaryContact: "different-contact-id", // Different from mockContactId to trigger customer update
            update: jest.fn(),
        } as unknown as jest.Mocked<CustomerEntity>;

        // Create mock updated customer
        mockUpdatedCustomer = {
            id: mockCustomerId,
            primaryContact: mockContactId,
            update: jest.fn(),
        } as unknown as jest.Mocked<CustomerEntity>;

        // Create mock order
        mockOrder = {
            id: mockOrderId,
            stage: OrderStage.Draft,
            update: jest.fn(),
        } as unknown as jest.Mocked<OrderEntity>;

        // Create mock updated order
        mockUpdatedOrder = {
            id: mockOrderId,
            stage: OrderStage.Created,
            customer: mockCustomerId,
            update: jest.fn(),
        } as unknown as jest.Mocked<OrderEntity>;

        // Setup mocks
        (ContactEntity.findOrCreateByEmail as jest.Mock).mockResolvedValue(mockContact);
        (CustomerEntity.findOrCreateByPostalAddress as jest.Mock).mockResolvedValue(mockCustomer);
        (OrderEntity.load as jest.Mock).mockResolvedValue(mockOrder);

        mockContact.update.mockResolvedValue(mockUpdatedContact);
        mockCustomer.update.mockResolvedValue(mockUpdatedCustomer);
        mockOrder.update.mockResolvedValue(mockUpdatedOrder);
    });

    describe("phone number persistence", () => {
        it("should update contact with new phone number when provided", async () => {
            const testObj = {
                orderId: mockOrderId as any,
                primaryContactData: {
                    firstName: Name.create("John"),
                    lastName: Name.create("Doe"),
                    email: EmailAddress.create("john.doe@example.com"),
                    phone: PhoneNumber.create("123456789"),
                },
                customerData: {
                    name: Name.create("Test Company"),
                    address: Address.create({
                        street: "Test Street",
                        houseNumber: "123",
                        zip: "12345",
                        city: "Test City",
                        state: "ZH",
                        country: "Schweiz",
                    }),
                },
            };

            const actual = await registerOrderAndAssociateCustomer(testObj);

            const expected = mockUpdatedOrder;
            expect(actual).toEqual(expected);

            // Verify contact was updated with the new phone number
            expect(mockContact.update).toHaveBeenCalledWith({
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("123456789"),
                customer: mockCustomerId,
            });
        });

        it("should update contact even when customer relationship doesn't change", async () => {
            // Setup contact with same customer relationship by recreating the mock
            mockContact = {
                ...mockContact,
                customer: mockCustomerId,
            } as unknown as jest.Mocked<ContactEntity>;

            const testObj = {
                orderId: mockOrderId as any,
                primaryContactData: {
                    firstName: Name.create("John"),
                    lastName: Name.create("Doe"),
                    email: EmailAddress.create("john.doe@example.com"),
                    phone: PhoneNumber.create("987654321"), // Different phone number
                },
                customerData: {
                    name: Name.create("Test Company"),
                    address: Address.create({
                        street: "Test Street",
                        houseNumber: "123",
                        zip: "12345",
                        city: "Test City",
                        state: "ZH",
                        country: "Schweiz",
                    }),
                },
            };

            const actual = await registerOrderAndAssociateCustomer(testObj);

            const expected = mockUpdatedOrder;
            expect(actual).toEqual(expected);

            // Verify contact was still updated with the new phone number
            expect(mockContact.update).toHaveBeenCalledWith({
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("987654321"),
                customer: mockCustomerId,
            });
        });

        it("should update contact when phone number is added for the first time", async () => {
            const testObj = {
                orderId: mockOrderId as any,
                primaryContactData: {
                    firstName: Name.create("John"),
                    lastName: Name.create("Doe"),
                    email: EmailAddress.create("john.doe@example.com"),
                    phone: PhoneNumber.create("123456789"), // New phone number
                },
                customerData: {
                    name: Name.create("Test Company"),
                    address: Address.create({
                        street: "Test Street",
                        houseNumber: "123",
                        zip: "12345",
                        city: "Test City",
                        state: "ZH",
                        country: "Schweiz",
                    }),
                },
            };

            const actual = await registerOrderAndAssociateCustomer(testObj);

            const expected = mockUpdatedOrder;
            expect(actual).toEqual(expected);

            // Verify contact was updated with the new phone number
            expect(mockContact.update).toHaveBeenCalledWith({
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("123456789"),
                customer: mockCustomerId,
            });
        });
    });

    describe("error handling", () => {
        it("should throw error when order is not found", async () => {
            (OrderEntity.load as jest.Mock).mockResolvedValue(undefined);

            const testObj = {
                orderId: "non-existent-order" as any,
                primaryContactData: {
                    firstName: Name.create("John"),
                    lastName: Name.create("Doe"),
                    email: EmailAddress.create("john.doe@example.com"),
                    phone: PhoneNumber.create("123456789"),
                },
                customerData: {
                    name: Name.create("Test Company"),
                    address: Address.create({
                        street: "Test Street",
                        houseNumber: "123",
                        zip: "12345",
                        city: "Test City",
                        state: "ZH",
                        country: "Schweiz",
                    }),
                },
            };

            await expect(registerOrderAndAssociateCustomer(testObj)).rejects.toThrow(
                'Order with id "non-existent-order" not found.'
            );
        });

        it("should throw error when order is not in draft stage", async () => {
            // Create new mock order with Created stage
            mockOrder = {
                ...mockOrder,
                stage: OrderStage.Created,
            } as unknown as jest.Mocked<OrderEntity>;
            (OrderEntity.load as jest.Mock).mockResolvedValue(mockOrder);

            const testObj = {
                orderId: mockOrderId as any,
                primaryContactData: {
                    firstName: Name.create("John"),
                    lastName: Name.create("Doe"),
                    email: EmailAddress.create("john.doe@example.com"),
                    phone: PhoneNumber.create("123456789"),
                },
                customerData: {
                    name: Name.create("Test Company"),
                    address: Address.create({
                        street: "Test Street",
                        houseNumber: "123",
                        zip: "12345",
                        city: "Test City",
                        state: "ZH",
                        country: "Schweiz",
                    }),
                },
            };

            await expect(registerOrderAndAssociateCustomer(testObj)).rejects.toThrow(
                `Order with id "${mockOrderId}" is not draft stage.`
            );
        });
    });
});
