/* eslint-disable @typescript-eslint/unbound-method */
import {
    Address,
    type BoundBooleanValue,
    type BoundParameterValue,
    ConfigurableService,
    Contact,
    type ContactData,
    Customer,
    type CustomerData,
    EmailAddress,
    Name,
    Order,
    OrderStage,
    PhoneNumber,
    ServiceConfiguration,
    ServiceParameter,
} from "../api";
import { ConfigurableServiceEntity } from "../configuration/ConfigurableServiceEntity";
import { ServiceConfigurationEntity } from "../configuration/ServiceConfigurationEntity";
import { ContactEntity } from "../contacts/ContactEntity";
import { ResolvedOrderPrice } from "../pricing/ResolvedOrderPrice";
import { CustomerEntity } from "./CustomerEntity";
import { OrderEntity } from "./OrderEntity";

// Mock dependencies
jest.mock("../configuration/ServiceConfigurationEntity");
jest.mock("../configuration/ConfigurableServiceEntity");
jest.mock("../pricing/ResolvedOrderPrice");
jest.mock("../contacts/ContactEntity");
jest.mock("./CustomerEntity");

// --- Reusable Mock Data ---
const MOCK_CUSTOMER_DATA: CustomerData = {
    name: Name.create("Test Company"),
    address: Address.create({
        street: "Test Street",
        houseNumber: "123",
        city: "Test City",
        zip: "12345",
        state: "ZH",
        country: "Schweiz",
    }),
};

const MOCK_CONTACT_DATA: ContactData = {
    firstName: Name.create("John"),
    lastName: Name.create("Doe"),
    email: EmailAddress.create("john.doe@example.com"),
    phone: PhoneNumber.create("+41 12 345 67 89"),
};

const MOCK_ORDER_ID = Order.Id("ORDER-1");
const MOCK_CUSTOMER_ID = Customer.Id("CUSTOMER-1");
const MOCK_CONTACT_ID = Contact.Id("CONTACT-1");
const MOCK_REMARKS = "Test remarks";
const MOCK_CONFIG_ID = ServiceConfiguration.Id("CONF-1");

const aContactEntity = (overrides = {}) => {
    return {
        id: MOCK_CONTACT_ID,
        customer: MOCK_CUSTOMER_ID,
        update: jest.fn().mockResolvedValue({
            id: MOCK_CONTACT_ID,
            customer: MOCK_CUSTOMER_ID,
            email: MOCK_CONTACT_DATA.email,
        }),
        ...overrides,
    } as any;
};

const aCustomerEntity = (overrides = {}) => {
    return {
        id: MOCK_CUSTOMER_ID,
        primaryContact: MOCK_CONTACT_ID,
        update: jest.fn().mockResolvedValue({
            id: MOCK_CUSTOMER_ID,
            primaryContact: MOCK_CONTACT_ID,
            name: MOCK_CUSTOMER_DATA.name,
            address: MOCK_CUSTOMER_DATA.address,
        }),
        ...overrides,
    } as any;
};

const anOrderEntity = (overrides = {}) => {
    return {
        id: MOCK_ORDER_ID,
        stage: OrderStage.Draft,
        configurations: [MOCK_CONFIG_ID],
        price: { subTotal: 100 },
        update: jest.fn().mockResolvedValue({
            id: MOCK_ORDER_ID,
            stage: OrderStage.Offered,
            configurations: [MOCK_CONFIG_ID],
            price: { subTotal: 100 },
            customer: MOCK_CUSTOMER_ID,
            remarks: MOCK_REMARKS,
        }),
        ...overrides,
    } as any;
};

describe("OrderEntity", () => {
    let mockOrderRepository: any;
    let mockConfigurationRepository: any;
    let mockConfigurableServiceEntity: jest.Mocked<ConfigurableServiceEntity>;
    let mockResolvedOrderPrice: jest.Mocked<ResolvedOrderPrice>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock repository
        mockOrderRepository = {
            load: jest.fn(),
            loadByNumber: jest.fn(),
            store: jest.fn(),
            getOrCreate: jest.fn(),
            loadConfigurations: jest.fn(),
            storeConfigurations: jest.fn(),
        };
        mockConfigurationRepository = {
            load: jest.fn(),
            store: jest.fn(),
        };

        // Mock ConfigurableServiceEntity
        mockConfigurableServiceEntity = {
            applyConfiguration: jest.fn(),
            calculatePrice: jest.fn(),
        } as any;

        // Mock ResolvedOrderPrice
        mockResolvedOrderPrice = {
            getSubTotal: jest.fn().mockReturnValue(100),
        } as any;

        // Setup static method mocks
        (ConfigurableServiceEntity.loadOrFind as jest.Mock).mockResolvedValue(mockConfigurableServiceEntity);
        (ResolvedOrderPrice as unknown as jest.Mock).mockImplementation(() => mockResolvedOrderPrice);

        // Mock ServiceConfigurationEntity.create to return a mock with getSummary method
        (ServiceConfigurationEntity.create as jest.Mock).mockImplementation(config => ({
            ...config,
            getSummary: jest.fn().mockReturnValue("Service Summary"),
            store: jest.fn().mockResolvedValue(config),
        }));

        // Mock ServiceConfigurationEntity.load to return a mock configuration
        (ServiceConfigurationEntity.load as jest.Mock).mockImplementation(async id => {
            // Call the repository mock so the test can assert on it
            const config = await mockConfigurationRepository.load(id);
            if (!config) {
                return undefined;
            }
            return ServiceConfigurationEntity.create(config);
        });
    });

    describe("constructor", () => {
        it("should create an Order entity with all properties", () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                configurations: [ServiceConfiguration.Id("CONF-1")],
                stage: OrderStage.Draft,
                summary: "Summary 1",
                price: { subTotal: 100 },
                customer: Customer.Id("CUST-1"),
            });

            expect(testObj).toEqual({
                id: "1",
                number: "100001",
                configurations: ["CONF-1"],
                stage: "offen",
                summary: "Summary 1",
                price: { subTotal: 100 },
                customer: "CUST-1",
            });
        });
    });

    describe("create", () => {
        it("should create an Order entity with all properties", () => {
            const actual = OrderEntity.create({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
                customer: Customer.Id("CUST-1"),
            });

            expect(actual).toEqual({
                id: "1",
                number: "100001",
                stage: "offen",
                configurations: ["CONF-1"],
                price: { subTotal: 100 },
                customer: "CUST-1",
            });
        });

        it("should return undefined for null input", () => {
            const actual = OrderEntity.create(null);
            expect(actual).toBeUndefined();
        });

        it("should return undefined for undefined input", () => {
            const actual = OrderEntity.create(undefined);
            expect(actual).toBeUndefined();
        });

        it("should throw error with empty id", () => {
            expect(() =>
                OrderEntity.create({
                    id: Order.Id(""),
                    stage: OrderStage.Draft,
                    number: Order.Number("100001"),
                    configurations: [ServiceConfiguration.Id("CONF-1")],
                    price: { subTotal: 100 },
                })
            ).toThrow("Order: Property 'id' cannot be empty.");
        });

        it("should throw error with missing price", () => {
            expect(() =>
                OrderEntity.create({
                    id: Order.Id("1"),
                    stage: OrderStage.Draft,
                    configurations: [ServiceConfiguration.Id("CONF-1")],
                } as any)
            ).toThrow("OrderEntity: Property 'price' cannot be empty.");
        });
    });

    describe("load", () => {
        it("should load an Order entity with all properties", async () => {
            mockOrderRepository.load.mockResolvedValue({
                id: Order.Id("1"),
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
                customer: Customer.Id("CUST-1"),
            });

            const actual = await OrderEntity.load(Order.Id("1"));

            expect(actual).toEqual({
                id: "1",
                configurations: ["CONF-1"],
                price: { subTotal: 100 },
                customer: "CUST-1",
            });
        });

        it("should return undefined with no order found", async () => {
            mockOrderRepository.load.mockResolvedValue(undefined);

            const actual = await OrderEntity.load(Order.Id("1"));

            expect(actual).toBeUndefined();
        });

        it("should throw an error without OrderRepository registered", async () => {
            await expect(OrderEntity.load(Order.Id("1"))).rejects.toThrow(
                'OrderEntity: Cannot call "load" without a repository.'
            );
        });
    });

    describe("loadByNumber", () => {
        it("should load an Order entity with all properties", async () => {
            mockOrderRepository.loadByNumber.mockResolvedValue({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
                customer: Customer.Id("CUST-1"),
            });

            const actual = await OrderEntity.loadByNumber(Order.Number("100001"));

            expect(actual).toEqual({
                id: "1",
                number: "100001",
                configurations: ["CONF-1"],
                price: { subTotal: 100 },
                customer: "CUST-1",
            });
        });

        it("should return undefined with no order found", async () => {
            mockOrderRepository.loadByNumber.mockResolvedValue(undefined);

            const actual = await OrderEntity.loadByNumber(Order.Number("100001"));

            expect(actual).toBeUndefined();
        });

        it("should throw an error without OrderRepository registered", async () => {
            await expect(OrderEntity.loadByNumber(Order.Number("100001"))).rejects.toThrow(
                'OrderEntity: Cannot call "loadByNumber" without a repository.'
            );
        });
    });

    describe("getConfigurations", () => {
        it("should load and return configurations from repository", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const mockConfiguration = {
                id: ServiceConfiguration.Id("CONF-1"),
                serviceId: ConfigurableService.Id("SERVICE-1"),
                serviceName: "Test Service",
                parameterGroups: [],
            };

            mockConfigurationRepository.load.mockResolvedValue(mockConfiguration);

            const actual = await testObj.getConfigurations();

            expect(mockConfigurationRepository.load).toHaveBeenCalledWith(ServiceConfiguration.Id("CONF-1"));
            expect(ServiceConfigurationEntity.create).toHaveBeenCalledWith(mockConfiguration);
            expect(actual).toHaveLength(1);
        });

        it("should throw error with no repository registered", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            await expect(testObj.getConfigurations()).rejects.toThrow(
                'ServiceConfigurationEntity: Cannot call "load" without a repository.'
            );
        });
    });

    describe("getSummary", () => {
        it("should return existing summary with summary", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
                summary: "Existing summary",
            });

            const actual = await testObj.getSummary();

            expect(actual).toBe("Existing summary");
        });

        it("should generate summary from configurations without existing summary", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const mockConfiguration = {
                id: ServiceConfiguration.Id("CONF-1"),
                serviceId: ConfigurableService.Id("SERVICE-1"),
                serviceName: "Test Service",
                parameterGroups: [],
            };

            mockConfigurationRepository.load.mockResolvedValue(mockConfiguration);

            const actual = await testObj.getSummary();

            expect(actual).toBe("Service Summary");
            expect(mockConfigurationRepository.load).toHaveBeenCalledWith(ServiceConfiguration.Id("CONF-1"));
        });
    });

    describe("getPrice", () => {
        it("should return resolved order price with configurations", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const mockConfiguration = {
                id: ServiceConfiguration.Id("CONF-1"),
                serviceId: ConfigurableService.Id("SERVICE-1"),
                serviceName: "Test Service",
                parameterGroups: [],
            };

            mockConfigurationRepository.load.mockResolvedValue(mockConfiguration);

            const actual = await testObj.getPrice();

            expect(actual).toBe(mockResolvedOrderPrice);
            expect(ResolvedOrderPrice).toHaveBeenCalledWith({ subTotal: 100 }, [expect.any(Object)]);
        });

        it("should return resolved order price with empty price without price available", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
            });

            const mockConfiguration = {
                id: ServiceConfiguration.Id("CONF-1"),
                serviceId: ConfigurableService.Id("SERVICE-1"),
                serviceName: "Test Service",
                parameterGroups: [],
            };

            mockConfigurationRepository.load.mockResolvedValue(mockConfiguration);

            const actual = await testObj.getPrice();

            expect(actual).toBe(mockResolvedOrderPrice);
        });
    });

    describe("update", () => {
        it("should update order and return new entity", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const updatedOrder = {
                id: Order.Id("1"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-2")],
                price: { subTotal: 200 },
            };

            mockOrderRepository.store.mockResolvedValue(updatedOrder);

            const actual = await testObj.update({
                configurations: [ServiceConfiguration.Id("CONF-2")],
                price: { subTotal: 200 },
            });

            expect(actual).toEqual({
                id: "1",
                stage: "offen",
                configurations: ["CONF-2"],
                price: { subTotal: 200 },
            });
            expect(mockOrderRepository.store).toHaveBeenCalledWith({
                ...testObj,
                configurations: [ServiceConfiguration.Id("CONF-2")],
                price: { subTotal: 200 },
            });
        });

        it("should throw error with no repository registered", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            await expect(testObj.update({ stage: OrderStage.Created })).rejects.toThrow(
                'OrderEntity: Cannot call "update" without a repository.'
            );
        });
    });

    describe("store", () => {
        it("should store order and return self", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            mockOrderRepository.store.mockResolvedValue(testObj);

            const actual = await testObj.store();

            expect(actual).toEqual(testObj);
            expect(mockOrderRepository.store).toHaveBeenCalledWith(testObj);
        });

        it("should throw error with no repository registered", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            await expect(testObj.store()).rejects.toThrow(
                'OrderEntity: Cannot call "store" without a repository.'
            );
        });
    });

    describe("updateConfigurations", () => {
        it("should update configurations and return new entity", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const mockConfigurationEntity = {
                store: jest.fn().mockResolvedValue({
                    id: ServiceConfiguration.Id("CONF-1"),
                    serviceId: ConfigurableService.Id("SERVICE-1"),
                    serviceName: "Test Service",
                    parameterGroups: [],
                }),
                getId: jest.fn().mockReturnValue(ServiceConfiguration.Id("CONF-1")),
            } as any;

            const newConfigurations = [mockConfigurationEntity];

            const actual = await testObj.updateConfigurations(newConfigurations);

            expect(actual).toEqual({
                id: "1",
                number: "100001",
                stage: "offen",
                configurations: ["CONF-1"],
                price: { subTotal: 100 },
            });
            expect(mockConfigurationEntity.store).toHaveBeenCalled();
        });

        it("should throw error with no repository registered", async () => {
            const testObj = new OrderEntity({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            });

            const mockConfigurationEntity = {
                store: jest
                    .fn()
                    .mockRejectedValue(
                        new Error('ServiceConfigurationEntity: Cannot call "store" without a repository.')
                    ),
                getId: jest.fn().mockReturnValue(ServiceConfiguration.Id("CONF-1")),
            } as any;

            const newConfigurations = [mockConfigurationEntity];

            await expect(testObj.updateConfigurations(newConfigurations)).rejects.toThrow(
                'ServiceConfigurationEntity: Cannot call "store" without a repository.'
            );
        });
    });

    describe("getOrCreateOrder", () => {
        it("should create new order with configuration", async () => {
            const mockServiceId = ConfigurableService.Id("SERVICE-1");
            const mockParameterValues: BoundParameterValue[] = [
                {
                    parameterId: ServiceParameter.Id("PARAM-1"),
                    value: true,
                    kind: "boolean",
                    trueLabel: "True",
                    falseLabel: "False",
                } as BoundBooleanValue,
            ];
            const mockRemarks = "Test remarks";
            const mockAttachments: ServiceConfiguration.Attachment[] = [];

            const mockNewConfiguration = {
                getId: jest.fn().mockReturnValue(ServiceConfiguration.Id("NEW-CONF-1")),
                store: jest.fn().mockResolvedValue({
                    id: ServiceConfiguration.Id("NEW-CONF-1"),
                    serviceId: ConfigurableService.Id("SERVICE-1"),
                    serviceName: "Test Service",
                    parameterGroups: [],
                }),
                addAttachments: jest.fn().mockReturnThis(),
                addRemarks: jest.fn().mockReturnThis(),
            } as any;

            const mockConfigurationPrice = {
                getSubTotal: jest.fn().mockReturnValue(150),
            } as any;

            mockConfigurableServiceEntity.applyConfiguration.mockReturnValue(mockNewConfiguration);
            mockConfigurableServiceEntity.calculatePrice.mockReturnValue(mockConfigurationPrice);
            mockOrderRepository.getOrCreate.mockResolvedValue({
                id: Order.Id("NEW-ORDER-1"),
                stage: OrderStage.Draft,
                configurations: [],
                price: { subTotal: 150 },
            });

            const actual = await OrderEntity.getOrCreateOrder(
                mockServiceId,
                mockParameterValues,
                mockRemarks,
                mockAttachments
            );

            expect(actual).toEqual({
                id: "NEW-ORDER-1",
                stage: "offen",
                configurations: ["NEW-CONF-1"],
                price: { subTotal: 150 },
            });

            expect(ConfigurableServiceEntity.loadOrFind).toHaveBeenCalledWith(mockServiceId);
            expect(mockConfigurableServiceEntity.applyConfiguration).toHaveBeenCalled();
            expect(mockConfigurableServiceEntity.calculatePrice).toHaveBeenCalled();
            expect(mockOrderRepository.getOrCreate).toHaveBeenCalled();
        });

        it("should throw error with no repository registered", async () => {
            await expect(
                OrderEntity.getOrCreateOrder(ConfigurableService.Id("SERVICE-1"), [], "Test remarks")
            ).rejects.toThrow('OrderEntity: Cannot call "getOrCreateOrder" without a repository.');
        });
    });

    describe("offerOrder", () => {
        let mockContactEntity: jest.Mocked<ContactEntity>;
        let mockCustomerEntity: jest.Mocked<CustomerEntity>;
        let mockOrderEntity: jest.Mocked<OrderEntity>;

        beforeEach(() => {
            mockContactEntity = aContactEntity();
            mockCustomerEntity = aCustomerEntity();
            mockOrderEntity = anOrderEntity({ stage: OrderStage.Created });

            jest.spyOn(ContactEntity, "findOrCreateByEmail").mockResolvedValue(mockContactEntity);
            jest.spyOn(CustomerEntity, "findOrCreateByPostalAddress").mockResolvedValue(mockCustomerEntity);
            jest.spyOn(OrderEntity, "load").mockResolvedValue(mockOrderEntity);
        });

        it("should offer order", async () => {
            const actual = await OrderEntity.offerOrder(MOCK_ORDER_ID);

            expect(actual).toEqual({
                id: "ORDER-1",
                stage: "offeriert",
                configurations: ["CONF-1"],
                price: { subTotal: 100 },
                customer: "CUSTOMER-1",
                remarks: "Test remarks",
            });

            expect(OrderEntity.load).toHaveBeenCalledWith(MOCK_ORDER_ID);
            expect(mockOrderEntity.update).toHaveBeenCalledWith({
                stage: OrderStage.Offered,
            });
        });

        it("should throw error when order not found", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);

            await expect(OrderEntity.offerOrder(MOCK_ORDER_ID)).rejects.toThrow(
                'Order with id "ORDER-1" not found.'
            );
        });
    });

    describe("isOrderValid", () => {
        it("should return true for valid order", () => {
            const validOrder = {
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            };

            const actual = OrderEntity.isOrderValid(validOrder);

            expect(actual).toBe(true);
        });

        it("should return false for order without id", () => {
            const invalidOrder = {
                id: "",
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            } as any;

            const actual = OrderEntity.isOrderValid(invalidOrder);

            expect(actual).toBe(false);
        });

        it("should return false for order with whitespace id", () => {
            const invalidOrder = {
                id: "   ",
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
                price: { subTotal: 100 },
            } as any;

            const actual = OrderEntity.isOrderValid(invalidOrder);

            expect(actual).toBe(false);
        });

        it("should return false for order without price", () => {
            const invalidOrder = {
                id: Order.Id("1"),
                stage: OrderStage.Draft,
                configurations: [ServiceConfiguration.Id("CONF-1")],
            } as any;

            const actual = OrderEntity.isOrderValid(invalidOrder);

            expect(actual).toBe(false);
        });

        it("should return false for null order", () => {
            const actual = OrderEntity.isOrderValid(null as any);

            expect(actual).toBe(false);
        });

        it("should return false for undefined order", () => {
            const actual = OrderEntity.isOrderValid(undefined as any);

            expect(actual).toBe(false);
        });
    });
});
