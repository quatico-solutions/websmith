import { getQuoteDocument } from "./get-quote-document-service";
import {
    Address,
    ConfigurableService,
    ConfigurableServiceEntity,
    Contact,
    ContactEntity,
    Customer,
    CustomerEntity,
    EmailAddress,
    Name,
    Order,
    OrderEntity,
    OrderStage,
    PhoneNumber,
    ProviderConfiguration,
    type QuoteDocumentValue,
    ServiceConfiguration,
} from "../../shared";

// --- Mock Factories ---
const aContactEntity = (overrides: Partial<any> = {}) =>
    ContactEntity.create({
        id: Contact.Id("CONT-1"),
        email: EmailAddress.create("john.doe@example.com"),
        firstName: Name.create("John"),
        lastName: Name.create("Doe"),
        ...overrides,
    });

const aCustomerEntity = (overrides: Partial<any> = {}) =>
    CustomerEntity.create({
        id: Customer.Id("CUST-1"),
        name: Name.create("ACME Inc."),
        address: Address.create({
            street: "Main St",
            houseNumber: "123",
            city: "Anytown",
            zip: "12345",
            state: "CA",
            country: "USA",
        }),
        ...overrides,
    });

const aMockOrder = (overrides: Partial<any> = {}) =>
    OrderEntity.create({
        id: Order.Id("123"),
        number: Order.Number("10000"),
        configurations: [ServiceConfiguration.Id("config-1")], // Add configurations array
        stage: OrderStage.Created,
        price: { subTotal: 0 },
        customer: Customer.Id("CUST-1"),
        ...overrides,
    });

const aServiceConfiguration = (overrides: Partial<any> = {}) => ({
    id: ServiceConfiguration.Id("config-1"),
    serviceId: ConfigurableService.Id("valid-service"),
    serviceName: "PV Anlagenreinigung",
    parameterGroups: [],
    price: { subTotal: 0 },
    getParameterValues: jest.fn().mockReturnValue({}),
    getServiceId: () => "valid-service",
    getServicePrice: () => 0,
    ...overrides,
});

const aConfigurableService = (overrides: Partial<any> = {}) =>
    ConfigurableServiceEntity.create({
        id: ConfigurableService.Id("valid-service"),
        name: "Test Service",
        parameterGroups: [],
        provider: {
            id: ProviderConfiguration.Id("123"),
            name: "providerName",
            greeting: "providerGreeting",
            logoDataUrl: "logoDataUrl",
            logoAltText: "logoAltText",
            bankingInfo: "bankingInfo",
            vatNumber: "vatNumber",
            address: Address.create({
                street: "street",
                houseNumber: "123",
                city: "city",
                zip: "12345",
                state: "state",
                country: "country",
            }),
            email: EmailAddress.create("provider@mail.com"),
            phone: PhoneNumber.create("0123456789"),
            website: "https://www.provider.com",
            salesContact: ContactEntity.create({
                id: Contact.Id("123"),
                firstName: Name.create("firstName"),
                lastName: Name.create("lastName"),
                email: EmailAddress.create("sales@provider.com"),
            }),
            mailSettings: {
                sender: ContactEntity.create({
                    id: Contact.Id("456"),
                    email: EmailAddress.create("sender@mail.com"),
                }),
            },
            termsOfServiceUrl: "#",
            privacyPolicyUrl: "#",
        },
        ...overrides,
    });

describe("getQuoteDocument", () => {
    let mockContact: any;
    let mockCustomer: any;
    let mockOrder: any;
    let mockConfig: any;
    let mockConfigurableService: any;

    beforeEach(() => {
        // Setup mocks
        mockContact = aContactEntity();
        mockCustomer = aCustomerEntity();
        mockOrder = aMockOrder({ stage: OrderStage.Created });
        mockConfig = aServiceConfiguration();
        mockConfigurableService = aConfigurableService();

        // Setup entity method mocks
        jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(mockCustomer);
        jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([mockConfig]);
        jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(mockContact);
        jest.spyOn(mockConfigurableService, "getProvider").mockReturnValue(mockConfigurableService.provider);

        // Setup static method mocks
        jest.spyOn(OrderEntity, "load").mockResolvedValue(mockOrder);
        jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(mockConfigurableService);

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe("Order validation", () => {
        it("should throw an error when order is not found", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);

            await expect(getQuoteDocument({ orderId: Order.Id("nonexistent") })).rejects.toThrow('Order with id "nonexistent" not found.');
        });

        it("should throw an error when order is null", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(null as any);

            await expect(getQuoteDocument({ orderId: Order.Id("null-order") })).rejects.toThrow('Order with id "null-order" not found.');
        });

        it("should throw an error when order is in draft stage", async () => {
            const draftOrder = aMockOrder({ stage: OrderStage.Draft });
            jest.spyOn(OrderEntity, "load").mockResolvedValue(draftOrder);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'We cannot provide a Quote Document. Order with id "123" is in draft stage.'
            );
        });
    });

    describe("Service configuration validation", () => {
        it("should throw an error when no service configurations exist", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([]);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });

        it("should throw an error when configurations array contains only null/undefined", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([null, undefined] as any);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });

        it("should throw an error when first configuration is undefined but array is not empty", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([undefined] as any);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });
    });

    describe("Customer validation", () => {
        it("should throw an error when customer is not found", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(null);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No customer found for order with id "123".');
        });

        it("should throw an error when customer is undefined", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(undefined);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No customer found for order with id "123".');
        });
    });

    describe("Contact validation", () => {
        it("should throw an error when primary contact is not found", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(null);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No primary contact found for customer with id "CUST-1".');
        });

        it("should throw an error when primary contact is undefined", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow('No primary contact found for customer with id "CUST-1".');
        });
    });

    describe("Configurable service validation", () => {
        it("should throw an error when configurable service is not found", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(undefined);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'No configurable service found for service id "valid-service".'
            );
        });

        it("should throw an error when configurable service is null", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(null as any);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'No configurable service found for service id "valid-service".'
            );
        });
    });

    describe("Provider validation", () => {
        it("should throw an error when provider is not found", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });

        it("should throw an error when provider is null", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });
    });

    describe("Edge cases", () => {
        it("should handle when service configuration array has multiple items but uses first", async () => {
            const firstConfig = aServiceConfiguration({ id: ServiceConfiguration.Id("first") });
            const secondConfig = aServiceConfiguration({ id: ServiceConfiguration.Id("second") });
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([firstConfig, secondConfig]);

            const result = await getQuoteDocument({ orderId: Order.Id("123") });

            expect(result).toBeDefined();
        });

        it("should handle different service IDs correctly", async () => {
            const configWithDifferentService = aServiceConfiguration({
                serviceId: ConfigurableService.Id("different-service"),
                getServiceId: () => "different-service",
            });
            const differentService = aConfigurableService({
                id: ConfigurableService.Id("different-service"),
            });

            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([configWithDifferentService]);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(differentService);

            const result = await getQuoteDocument({ orderId: Order.Id("123") });

            expect(result).toBeDefined();

            expect(ConfigurableServiceEntity.loadOrFind).toHaveBeenCalledWith(ConfigurableService.Id("different-service"));
        });

        it("should handle customer with different ID format", async () => {
            const customerWithSpecialId = aCustomerEntity({
                id: Customer.Id("CUST-special-123"),
            });
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(customerWithSpecialId);
            jest.spyOn(customerWithSpecialId, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(getQuoteDocument({ orderId: Order.Id("123") })).rejects.toThrow(
                'No primary contact found for customer with id "CUST-special-123".'
            );
        });

        it("should preserve the exact error message format for each validation step", async () => {
            // Test exact error message for order not found
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);
            await expect(getQuoteDocument({ orderId: Order.Id("test-123") })).rejects.toThrow('Order with id "test-123" not found.');

            // Reset mocks for next test
            jest.spyOn(OrderEntity, "load").mockResolvedValue(mockOrder);

            // Test exact error message for draft stage
            const draftOrder = aMockOrder({ stage: OrderStage.Draft });
            jest.spyOn(OrderEntity, "load").mockResolvedValue(draftOrder);
            await expect(getQuoteDocument({ orderId: Order.Id("draft-order") })).rejects.toThrow(
                'We cannot provide a Quote Document. Order with id "draft-order" is in draft stage.'
            );
        });
    });

    describe("Context and serialization parameters", () => {
        it("should work correctly when context and serialization parameters are provided", async () => {
            const mockContext = { userId: "user-123" } as any;
            const mockSerialization = { format: "json" } as any;

            const result = (await getQuoteDocument({ orderId: Order.Id("123") }, mockContext, mockSerialization)) as QuoteDocumentValue;

            expect(result).toBeDefined();
            expect(result.getStringContent()).toBe(Buffer.from("mock-pdf-content").toString("base64"));
        });

        it("should work correctly when context and serialization parameters are undefined", async () => {
            const result = (await getQuoteDocument({ orderId: Order.Id("123") }, undefined, undefined)) as QuoteDocumentValue;

            expect(result).toBeDefined();
            expect(result.getStringContent()).toBe(Buffer.from("mock-pdf-content").toString("base64"));
        });
    });
});
