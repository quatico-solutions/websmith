import path from "path";
import {
    Address,
    ConfigurableService,
    ConfigurableServiceEntity,
    type ConfigurationParameterValue,
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
    ServiceParameter,
    ServiceParameterGroup,
} from "../../shared";
import { submitQuoteRequest } from "./submit-quote-request-service";

const MockedMailer = {} as any;
const mockedCreateQuoteDocument = {} as any;
const mockedCreateEmailMessage = {} as any;

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
        stage: OrderStage.Draft,
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

describe("submitQuoteRequest", () => {
    let mockContact: any;
    let mockCustomer: any;
    let mockOrder: any;
    let mockConfig: any;
    let mockConfigurableService: any;
    let mockMailer: any;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Store original environment
        originalEnv = process.env;
        process.env = { ...originalEnv, CDS_CPQ_FRONTEND_URL: "https://example.com" };

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

        // Setup service mocks with correct return types
        mockMailer = {
            sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any;
        MockedMailer.mockImplementation(() => mockMailer);

        // Fix: createQuoteDocument should return Uint8Array, not string
        const mockPdfBuffer = new Uint8Array(Buffer.from("mock-pdf-content"));
        mockedCreateQuoteDocument.mockResolvedValue(mockPdfBuffer);

        // Fix: createEmailMessage should return a Message object, not string
        const mockEmailMessage = {
            to: "test@example.com",
            subject: "Test Subject",
            body: "Test Body",
            // Add other Message properties as needed
        } as any; // Type as Message when you have the proper type definition
        mockedCreateEmailMessage.mockReturnValue(mockEmailMessage);

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe("Environment validation", () => {
        it("should throw an error when CDS_CPQ_FRONTEND_URL is not set", async () => {
            delete process.env.CDS_CPQ_FRONTEND_URL;

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set."
            );
        });

        it("should throw an error when CDS_CPQ_FRONTEND_URL is empty string", async () => {
            process.env.CDS_CPQ_FRONTEND_URL = "";

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                "Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set."
            );
        });
    });

    describe("Order validation", () => {
        it("should throw an error when order is not found", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);

            await expect(submitQuoteRequest({ orderId: Order.Id("nonexistent") })).rejects.toThrow('No Order found with id "nonexistent".');
        });

        it("should throw an error when order is undefined", async () => {
            jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined as any);

            await expect(submitQuoteRequest({ orderId: Order.Id("undefined-order") })).rejects.toThrow('No Order found with id "undefined-order".');
        });
    });

    describe("Service configuration validation", () => {
        it("should throw an error when no service configurations exist", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([]);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });

        it("should throw an error when configurations array contains only null/undefined", async () => {
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([null, undefined] as any);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });
    });

    describe("Customer validation", () => {
        it("should throw an error when customer is not found", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(null);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No customer found for order with id "123".');
        });

        it("should throw an error when customer is undefined", async () => {
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(undefined);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No customer found for order with id "123".');
        });
    });

    describe("Contact validation", () => {
        it("should throw an error when primary contact is not found", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(null);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No primary contact found for customer with id "CUST-1".');
        });

        it("should throw an error when primary contact is undefined", async () => {
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No primary contact found for customer with id "CUST-1".');
        });

        it("should throw an error when contact has no email", async () => {
            const contactWithoutEmail = aContactEntity({ email: null });
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(contactWithoutEmail);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("No email address found for customer with id CUST-1");
        });

        it("should throw an error when contact email is undefined", async () => {
            const contactWithoutEmail = aContactEntity({ email: undefined });
            jest.spyOn(mockCustomer, "getPrimaryContact").mockResolvedValue(contactWithoutEmail);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("No email address found for customer with id CUST-1");
        });
    });

    describe("Configurable service validation", () => {
        it("should throw an error when configurable service is not found", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(undefined);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No configurable service found for service id "valid-service".'
            );
        });

        it("should throw an error when configurable service is undefined", async () => {
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(undefined as any);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No configurable service found for service id "valid-service".'
            );
        });
    });

    describe("Provider validation", () => {
        it("should throw an error when provider is not found", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });

        it("should throw an error when provider is undefined", async () => {
            const serviceWithoutProvider = aConfigurableService();
            jest.spyOn(serviceWithoutProvider, "getProvider").mockReturnValue(undefined);
            jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithoutProvider);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No provider found for service id "valid-service".'
            );
        });
    });

    describe("PDF generation errors", () => {
        it("should throw an error when createQuoteDocument fails", async () => {
            mockedCreateQuoteDocument.mockRejectedValue(new Error("PDF generation failed"));

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("PDF generation failed");
        });
    });

    describe("Email sending errors", () => {
        it("should throw an error when customer email sending fails", async () => {
            mockMailer.sendMessage.mockRejectedValueOnce(new Error("Customer email failed"));

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("Customer email failed");
        });

        it("should throw an error when sales email sending fails", async () => {
            mockMailer.sendMessage
                .mockResolvedValueOnce(undefined) // Customer email succeeds
                .mockRejectedValueOnce(new Error("Sales email failed")); // Sales email fails

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("Sales email failed");
        });

        it("should throw an error when createEmailMessage fails for customer", async () => {
            mockedCreateEmailMessage.mockImplementationOnce(() => {
                throw new Error("Email template error");
            });

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow("Email template error");
        });
    });

    describe("Successful execution", () => {
        it("should successfully submit quote request and return quote document", async () => {
            const result = (await submitQuoteRequest({ orderId: Order.Id("123") })) as QuoteDocumentValue;

            // Verify the quote document is created correctly
            expect(result).toBeDefined();
            expect(result.getStringContent()).toBe(Buffer.from("mock-pdf-content").toString("base64"));

            // Verify PDF generation was called with correct parameters
            expect(mockedCreateQuoteDocument).toHaveBeenCalledWith({
                config: mockConfig,
                customer: mockCustomer,
                contact: mockContact,
                provider: mockConfigurableService.provider,
                order: mockOrder,
            });

            // Verify both emails were sent

            expect(mockMailer.sendMessage).toHaveBeenCalledTimes(2);

            // Verify customer email
            expect(mockedCreateEmailMessage).toHaveBeenNthCalledWith(
                1,
                {
                    templateName: "quote-document-customer",
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
                expect.any(Function)
            );

            // Verify sales email
            expect(mockedCreateEmailMessage).toHaveBeenNthCalledWith(
                2,
                {
                    templateName: "quote-document-sales",
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
                expect.any(Function)
            );
        });

        it("should handle complex service configuration with parameter groups", async () => {
            const complexConfig = aServiceConfiguration({
                parameterGroups: [
                    {
                        id: ServiceParameterGroup.Id("group-1"),
                        name: "Group 1",
                        parameters: [
                            {
                                id: ServiceParameter.Id("param-1"),
                                name: "Parameter 1",
                                value: { value: "test", price: 100 },
                                price: 100,
                            } as ConfigurationParameterValue,
                        ],
                    },
                ],
            });
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([complexConfig]);

            const result = await submitQuoteRequest({ orderId: Order.Id("123") });

            expect(result).toBeDefined();
            expect(mockedCreateQuoteDocument).toHaveBeenCalledWith({
                config: complexConfig,
                customer: mockCustomer,
                contact: mockContact,
                provider: mockConfigurableService.provider,
                order: mockOrder,
            });
        });

        it("should use correct server URL format", async () => {
            process.env.CDS_CPQ_FRONTEND_URL = "https://test.example.com";

            await submitQuoteRequest({ orderId: Order.Id("123") });

            expect(mockedCreateEmailMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverUrl: "https://test.example.com/cds/cpq/ui",
                }),
                expect.any(Function)
            );
        });
    });

    describe("Edge cases", () => {
        it("should handle when first configuration in array is null but second exists", async () => {
            const validConfig = aServiceConfiguration();
            jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([null, validConfig] as any);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
        });

        it("should handle different customer ID formats", async () => {
            const customerWithSpecialId = aCustomerEntity({
                id: Customer.Id("CUST-special-123"),
            });
            jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(customerWithSpecialId);
            jest.spyOn(customerWithSpecialId, "getPrimaryContact").mockResolvedValue(undefined);

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
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

            await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
                'Quote Request Submission: No configurable service found for service id "different-service".'
            );
        });
    });

    // Existing tests for template errors
    it("should throw an error with no service configurations", async () => {
        jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([]);

        await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow('No service configuration found for order with id "123".');
    });

    it("should throw an error with service configuration, value but no template for service", async () => {
        const configWithInvalidService = aServiceConfiguration({
            serviceId: ConfigurableService.Id("invalid"),
            getServiceId: () => "invalid",
        });
        jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([configWithInvalidService]);

        const serviceWithInvalidId = aConfigurableService({
            id: ConfigurableService.Id("invalid"),
        });
        jest.spyOn(ConfigurableServiceEntity, "loadOrFind").mockResolvedValue(serviceWithInvalidId);

        mockedCreateQuoteDocument.mockRejectedValue(
            new Error(
                `Pdf template configuration files for "invalid" and "quote" incomplete. No "quote.html" found in the "pdf-templates" directory\nat path "${path.join(__dirname, "..", "..", "..", "..")}/shared/src/application/configurations/invalid/pdf-templates".`
            )
        );

        await expect(submitQuoteRequest({ orderId: Order.Id("123") })).rejects.toThrow(
            `Pdf template configuration files for "invalid" and "quote" incomplete. No "quote.html" found in the "pdf-templates" directory\nat path "${path.join(__dirname, "..", "..", "..", "..")}/shared/src/application/configurations/invalid/pdf-templates".`
        );
    });
});
