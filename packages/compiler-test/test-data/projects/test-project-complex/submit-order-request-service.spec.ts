import {
    Address,
    ConfigurableService,
    ConfigurableServiceEntity,
    Contact,
    ContactEntity,
    Customer,
    CustomerEntity,
    EmailAddress,
    Logger,
    Name,
    Order,
    OrderEntity,
    OrderStage,
    PhoneNumber,
    ProviderConfiguration,
    QuoteDocumentValue,
    ServiceConfiguration,
} from "./shared";
import { submitOrderRequest } from "./submit-order-request-service";

const MockedMailer = {} as any;
const mockedCreateOrderConfirmationDocument = {} as any;
const mockedCreateEmailMessage = {} as any;
const mockedGetOrderConfirmationCustomerTemplate = {} as any;
const mockedGetOrderConfirmationSalesContactTemplate = {} as any;

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
        configurations: [],
        stage: OrderStage.Created,
        price: { subTotal: 0 },
        customer: Customer.Id("CUST-1"),
        ...overrides,
    });

const aServiceConfiguration = (overrides: Partial<any> = {}) => ({
    id: ServiceConfiguration.Id("whatever"),
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

describe("submitOrderRequest", () => {
    let mockContact: any;
    let mockCustomer: any;
    let mockOrder: any;
    let mockRequestedOrder: any;
    let mockConfig: any;
    let mockConfigurableService: any;
    let mockMailer: any;
    let originalEnv: NodeJS.ProcessEnv;
    let mockLogger: any;

    beforeEach(() => {
        // Store original environment
        originalEnv = process.env;
        process.env = { ...originalEnv, CDS_CPQ_FRONTEND_URL: "https://example.com" };

        // Setup logger mock first
        mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
        };
        jest.spyOn(Logger, "create").mockReturnValue(mockLogger);

        // Setup mocks
        mockContact = aContactEntity();
        mockCustomer = aCustomerEntity();
        mockOrder = aMockOrder({ stage: OrderStage.Created });
        mockRequestedOrder = aMockOrder({ stage: OrderStage.Ordered });
        mockConfig = aServiceConfiguration();
        mockConfigurableService = aConfigurableService();

        // Setup entity method mocks
        jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(mockCustomer);
        jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([mockConfig]);
        jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(mockContact);
        jest.spyOn(mockConfigurableService, "getProvider").mockReturnValue(mockConfigurableService.provider);

        // Setup static method mocks
        jest.spyOn(OrderEntity, "load").mockResolvedValue(mockOrder);
        jest.spyOn(OrderEntity, "requestOrder").mockResolvedValue(mockRequestedOrder);
        jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(mockConfigurableService);

        // Setup service mocks
        mockMailer = {
            sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any;
        MockedMailer.mockImplementation(() => mockMailer);

        // Mock PDF generation
        const mockPdfBuffer = new Uint8Array(Buffer.from("mock-pdf-content"));
        mockedCreateOrderConfirmationDocument.mockResolvedValue(mockPdfBuffer);

        // Mock email message creation
        const mockEmailMessage = {
            to: "test@example.com",
            subject: "Test Subject",
            body: "Test Body",
        } as any;
        mockedCreateEmailMessage.mockReturnValue(mockEmailMessage);

        // Mock template functions
        mockedGetOrderConfirmationCustomerTemplate.mockReturnValue("customer-template" as any);
        mockedGetOrderConfirmationSalesContactTemplate.mockReturnValue("sales-template" as any);

        // Mock QuoteDocumentValue.create
        jest.spyOn(QuoteDocumentValue, "create").mockReturnValue({
            getStringContent: () => Buffer.from("mock-pdf-content").toString("base64"),
        } as any);

        // Clear all mocks
        jest.clearAllMocks();

        // Re-setup logger after clearAllMocks
        jest.spyOn(Logger, "create").mockReturnValue(mockLogger);
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe("Environment validation", () => {
        it("should throw an error when CDS_CPQ_FRONTEND_URL is not set", async () => {
            delete process.env.CDS_CPQ_FRONTEND_URL;

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set."
            );
        });

        it("should throw an error when CDS_CPQ_FRONTEND_URL is empty string", async () => {
            process.env.CDS_CPQ_FRONTEND_URL = "";

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set."
            );
        });
    });

    describe("Order validation", () => {
        it("should throw an error when order is not found", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("nonexistent") })).rejects.toThrow(
                'Could not request order for orderId:"nonexistent"." '
            );
        });

        it("should throw an error when order is null", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(null as any);

            await expect(submitOrderRequest({ orderId: Order.Id("null-order") })).rejects.toThrow(
                'Could not request order for orderId:"null-order"." '
            );
        });

        it("should throw an error when order is in draft stage", async () => {
            const draftOrder = aMockOrder({ stage: OrderStage.Draft });
            // Need to setup the customer mock for the draft order as well
            jest.spyOn(draftOrder, "getCustomer").mockResolvedValue(mockCustomer);
            jest.spyOn(OrderEntity, "load").mockResolvedValue(draftOrder);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Order with id "123" is in stage draft.'
            );
        });
    });

    describe("Customer validation", () => {
        it("should throw an error when customer is not found", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(null);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No customer found for order with id "123".'
            );
        });

        it("should throw an error when customer is undefined", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No customer found for order with id "123".'
            );
        });
    });

    describe("Contact validation", () => {
        it("should throw an error when primary contact is not found", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(null);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No primary contact found for customer with id "CUST-1".'
            );
        });

        it("should throw an error when primary contact is undefined", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No primary contact found for customer with id "CUST-1".'
            );
        });

        it("should throw an error when contact has no email", async () => {
            const contactWithoutEmail = aContactEntity({ email: null });
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(contactWithoutEmail);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "No email address found for existingCustomer with id CUST-1"
            );
        });

        it("should throw an error when contact email is undefined", async () => {
            const contactWithoutEmail = aContactEntity({ email: undefined });
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(contactWithoutEmail);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "No email address found for existingCustomer with id CUST-1"
            );
        });
    });

    describe("Service configuration validation", () => {
        it("should throw an error when no service configurations exist", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([]);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No service configuration found for order with id "123".'
            );
        });

        it("should throw an error when first configuration is null", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([null] as any);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No service configuration found for order with id "123".'
            );
        });

        it("should throw an error when first configuration is undefined", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([undefined] as any);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No service configuration found for order with id "123".'
            );
        });
    });

    describe("Configurable service validation", () => {
        it("should throw an error when configurable service is not found", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No configurable service found for service id "valid-service".'
            );
        });

        it("should throw an error when configurable service is null", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(null as any);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No configurable service found for service id "valid-service".'
            );
        });
    });

    describe("Provider validation", () => {
        it("should throw an error when provider is not found", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });

        it("should throw an error when provider is null", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });
    });

    describe("Order request processing errors", () => {
        it("should throw an error when OrderEntity.requestOrder fails", async () => {
            jest.spyOn(OrderEntity, "requestOrder").mockRejectedValue(new Error("Order request failed"));

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Order request failed"
            );
        });
    });

    describe("PDF generation errors", () => {
        it("should throw an error when createOrderConfirmationDocument fails", async () => {
            mockedCreateOrderConfirmationDocument.mockRejectedValue(new Error("PDF generation failed"));

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "PDF generation failed"
            );
        });
    });

    describe("Email sending errors", () => {
        it("should throw an error when customer email sending fails", async () => {
            mockMailer.sendMessage.mockRejectedValueOnce(new Error("Customer email failed"));

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Customer email failed"
            );
        });

        it("should throw an error when sales email sending fails", async () => {
            mockMailer.sendMessage
                .mockResolvedValueOnce(undefined) // Customer email succeeds
                .mockRejectedValueOnce(new Error("Sales email failed")); // Sales email fails

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Sales email failed"
            );
        });

        it("should throw an error when createEmailMessage fails for customer", async () => {
            mockedCreateEmailMessage.mockImplementationOnce(() => {
                throw new Error("Email template error");
            });

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Email template error"
            );
        });

        it("should throw an error when createEmailMessage fails for sales", async () => {
            mockedCreateEmailMessage
                .mockReturnValueOnce({ to: "customer@test.com" } as any) // Customer email succeeds
                .mockImplementationOnce(() => {
                    throw new Error("Sales email template error");
                });

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Sales email template error"
            );
        });
    });

    describe("Successful execution", () => {
        it("should successfully submit order request and return requested order", async () => {
            const result = await submitOrderRequest({ orderId: Order.Id("123") });

            // Verify the result is the requested order
            expect(result).toBe(mockRequestedOrder);

            // Verify OrderEntity.requestOrder was called

            expect(OrderEntity.requestOrder).toHaveBeenCalledWith(Order.Id("123"));

            // Verify PDF generation was called with correct parameters
            expect(mockedCreateOrderConfirmationDocument).toHaveBeenCalledWith({
                config: mockConfig,
                customer: mockCustomer,
                contact: mockContact,
                provider: mockConfigurableService.provider,
                order: mockRequestedOrder,
            });

            // Verify both emails were sent

            expect(mockMailer.sendMessage).toHaveBeenCalledTimes(2);
        });

        it("should create customer email with correct template parameters", async () => {
            await submitOrderRequest({ orderId: Order.Id("123") });

            expect(mockedCreateEmailMessage).toHaveBeenNthCalledWith(
                1,
                {
                    templateName: "order-confirmation-customer",
                    serviceConfiguration: mockConfig,
                    customer: mockCustomer,
                    contact: mockContact,
                    recipient: mockContact,
                    provider: mockConfigurableService.provider,
                    order: mockOrder,
                    pdfTemplateName: "quote",
                    pdfBase64: Buffer.from("mock-pdf-content").toString("base64"),
                    serverUrl: "https://example.com/cds/cpq/ui",
                    role: "customer",
                },
                mockedGetOrderConfirmationCustomerTemplate
            );
        });

        it("should create sales email with correct template parameters", async () => {
            await submitOrderRequest({ orderId: Order.Id("123") });

            expect(mockedCreateEmailMessage).toHaveBeenNthCalledWith(
                2,
                {
                    templateName: "order-confirmation-sales",
                    serviceConfiguration: mockConfig,
                    customer: mockCustomer,
                    contact: mockContact,
                    recipient: mockConfigurableService.provider.salesContact,
                    provider: mockConfigurableService.provider,
                    order: mockOrder,
                    pdfTemplateName: "quote",
                    pdfBase64: Buffer.from("mock-pdf-content").toString("base64"),
                    serverUrl: "https://example.com/cds/cpq/ui",
                    role: "sales",
                },
                mockedGetOrderConfirmationSalesContactTemplate
            );
        });

        it("should use correct server URL format", async () => {
            process.env.CDS_CPQ_FRONTEND_URL = "https://test.example.com";

            await submitOrderRequest({ orderId: Order.Id("123") });

            expect(mockedCreateEmailMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverUrl: "https://test.example.com/cds/cpq/ui",
                }),
                expect.any(Function)
            );
        });

        it("should handle different order stages correctly", async () => {
            const quotedOrder = aMockOrder({ stage: OrderStage.Offered });
            // Setup method mocks for the quoted order
            jest.spyOn(quotedOrder, "getCustomer").mockResolvedValue(mockCustomer);
            jest.spyOn(quotedOrder, "getConfigurations").mockResolvedValue([mockConfig]);
            jest.spyOn(OrderEntity, "load").mockResolvedValue(quotedOrder);

            const result = await submitOrderRequest({ orderId: Order.Id("123") });

            expect(result).toBe(mockRequestedOrder);

            expect(OrderEntity.requestOrder).toHaveBeenCalledWith(Order.Id("123"));
        });
    });

    describe("Edge cases", () => {
        it("should handle different customer ID formats", async () => {
            const customerWithSpecialId = aCustomerEntity({
                id: Customer.Id("CUST-special-123"),
            });
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(customerWithSpecialId);
            jest.spyOn(customerWithSpecialId, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No primary contact found for customer with id "CUST-special-123".'
            );
        });

        it("should handle service configuration with different service ID", async () => {
            const configWithDifferentService = aServiceConfiguration({
                serviceId: ConfigurableService.Id("different-service"),
                getServiceId: () => "different-service",
            });
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([configWithDifferentService]);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(undefined);

            await expect(submitOrderRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'No configurable service found for service id "different-service".'
            );
        });

        it("should handle orders with multiple configurations and use the first one", async () => {
            const secondConfig = aServiceConfiguration({
                serviceId: ConfigurableService.Id("second-service"),
            });
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([mockConfig, secondConfig]);

            await submitOrderRequest({ orderId: Order.Id("123") });

            // Should use the first configuration

            expect(ConfigurableServiceEntity.loadOrFind).toHaveBeenCalledWith(
                ConfigurableService.Id("valid-service")
            );
        });

        it("should handle order with different stage values", async () => {
            const quotedOrder = aMockOrder({ stage: OrderStage.Offered });
            // Setup method mocks for the quoted order
            jest.spyOn(quotedOrder, "getCustomer").mockResolvedValue(mockCustomer);
            jest.spyOn(quotedOrder, "getConfigurations").mockResolvedValue([mockConfig]);
            jest.spyOn(OrderEntity, "load").mockResolvedValue(quotedOrder);

            const result = await submitOrderRequest({ orderId: Order.Id("123") });

            expect(result).toBe(mockRequestedOrder);
        });
    });

    describe("Buffer and QuoteDocumentValue integration", () => {
        it("should properly handle PDF buffer conversion", async () => {
            const mockPdfData = new Uint8Array([1, 2, 3, 4]);
            mockedCreateOrderConfirmationDocument.mockResolvedValue(mockPdfData);

            await submitOrderRequest({ orderId: Order.Id("123") });

            expect(QuoteDocumentValue.create).toHaveBeenCalledWith({
                content: Buffer.from(mockPdfData).toString("base64"),
            });
        });

        it("should handle empty PDF buffer", async () => {
            const emptyBuffer = new Uint8Array(0);
            mockedCreateOrderConfirmationDocument.mockResolvedValue(emptyBuffer);

            await submitOrderRequest({ orderId: Order.Id("123") });

            expect(QuoteDocumentValue.create).toHaveBeenCalledWith({
                content: Buffer.from(emptyBuffer).toString("base64"),
            });
        });
    });
});
