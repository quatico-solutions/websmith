import { Address, ConfigurableService, Contact, EmailAddress, Name, PhoneNumber } from "../api";
import { ProviderConfiguration } from "../api/configuration/ProviderConfiguration";
import { ContactEntity } from "../contacts";
import { ConfigurableServiceEntity } from "./ConfigurableServiceEntity";

describe("ConfigurableServiceEntity", () => {
    describe("constructor", () => {
        it("should create a new configurable service", () => {
            const testObj = new ConfigurableServiceEntity({
                id: ConfigurableService.Id("123"),
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
                        email: EmailAddress.create("verkauf@immosoerf.ch"),
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
            });

            expect(testObj.getId()).toBe(ConfigurableService.Id("123"));
            expect(testObj.getName()).toBe("Test Service");
            expect(testObj.getDescription()).toBeUndefined();
            expect(testObj.getParameterGroups()).toEqual([]);
            expect(testObj.getProvider()).toEqual({
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
                    email: EmailAddress.create("verkauf@immosoerf.ch"),
                }),
                mailSettings: {
                    sender: ContactEntity.create({
                        id: Contact.Id("456"),
                        email: EmailAddress.create("sender@mail.com"),
                    }),
                },
                termsOfServiceUrl: "#",
                privacyPolicyUrl: "#",
            });
        });

        it("should create new configurable service with empty name", () => {
            const testObj = new ConfigurableServiceEntity({
                id: ConfigurableService.Id("123"),
                name: "",
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
                        email: EmailAddress.create("verkauf@immosoerf.ch"),
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
            });

            expect(testObj.getName()).toBe("");
        });
    });

    describe("create", () => {
        it("should create a new configurable service", () => {
            const testObj = ConfigurableServiceEntity.create({
                id: ConfigurableService.Id("123"),
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
                        email: EmailAddress.create("verkauf@immosoerf.ch"),
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
            });

            expect(testObj.getId()).toBe(ConfigurableService.Id("123"));
            expect(testObj.getName()).toBe("Test Service");
            expect(testObj.getDescription()).toBeUndefined();
            expect(testObj.getParameterGroups()).toEqual([]);
            expect(testObj.getProvider()).toEqual({
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
                    email: EmailAddress.create("verkauf@immosoerf.ch"),
                }),
                mailSettings: {
                    sender: ContactEntity.create({
                        id: Contact.Id("456"),
                        email: EmailAddress.create("sender@mail.com"),
                    }),
                },
                termsOfServiceUrl: "#",
                privacyPolicyUrl: "#",
            });
        });

        it("should throw error with empty id", () => {
            expect(() =>
                ConfigurableServiceEntity.create({
                    id: ConfigurableService.Id(""),
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
                            email: EmailAddress.create("verkauf@immosoerf.ch"),
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
                })
            ).toThrow("ConfigurableService: Property 'id' cannot be empty.");
        });

        it("should throw error with empty name", () => {
            expect(() =>
                ConfigurableServiceEntity.create({
                    id: ConfigurableService.Id("123"),
                    name: "",
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
                            email: EmailAddress.create("verkauf@immosoerf.ch"),
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
                })
            ).toThrow("ConfigurableService: Property 'name' cannot be empty.");
        });
    });

    describe("loadOrFind", () => {
        it("should throw an error with no repository injected", async () => {
            await expect(
                ConfigurableServiceEntity.loadOrFind(ConfigurableService.Id("target"))
            ).rejects.toThrow('ConfigurableServiceEntity: Cannot call "loadOrFind" without a repository.');
        });

        it("should throw an error without configurations in repository", async () => {
            await expect(
                ConfigurableServiceEntity.loadOrFind(ConfigurableService.Id("target"), {})
            ).rejects.toThrow(
                'ConfigurableService: Cannot load entity. No configuration found for id "target".'
            );
        });

        it("should throw an error with no matching configuration in repository", async () => {
            await expect(
                ConfigurableServiceEntity.loadOrFind(ConfigurableService.Id("target"), { target: {} })
            ).rejects.toThrow(
                'ConfigurableService: Cannot load entity. No configuration found for id "target".'
            );
        });
    });

    describe("Id", () => {
        it("should create a new configurable service id", () => {
            const testObj = ConfigurableService.Id("123");

            expect(testObj).toBe("123");
        });

        it("should throw an error if the id is empty", () => {
            expect(() => ConfigurableService.Id("")).toThrow(
                "ConfigurableService: Property 'id' cannot be empty."
            );
        });
    });
});
