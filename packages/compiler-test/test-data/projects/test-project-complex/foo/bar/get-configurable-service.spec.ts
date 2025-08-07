import { ConfigurableService } from "../../shared";
import { getConfigurableServiceFn } from "./get-configurable-service";

describe("getConfigurableServiceFn", () => {
    it("should return configuration with matching key", async () => {
        const actual = await getConfigurableServiceFn({
            serviceId: ConfigurableService.Id("target"),
            configurations: {
                target: {
                    name: "expected",
                    provider: {
                        id: "provider-id",
                        name: "providerName",
                        greeting: "providerGreeting",
                        logoDataUrl: "logoDataUrl",
                        address: {
                            street: "street",
                            houseNumber: "houseNumber",
                            city: "city",
                            zip: "zip",
                            state: "state",
                            country: "country",
                        },
                        email: "email@provider.com",
                        phone: "+41 44 000 00 00",
                        website: "website",
                        salesContact: {
                            firstName: "firstName",
                            lastName: "lastName",
                            email: "sales@provider.com",
                        },
                        mailSettings: {
                            sender: {
                                email: "sender@mail.com",
                            },
                        },
                    },
                },
            },
        });

        expect(actual).toEqual({
            id: "target",
            name: "expected",
            parameterGroups: [],
            provider: {
                id: "provider-id",
                name: "providerName",
                greeting: "providerGreeting",
                logoDataUrl: "logoDataUrl",
                address: {
                    street: "street",
                    houseNumber: "houseNumber",
                    city: "city",
                    zip: "zip",
                    state: "state",
                    country: "country",
                },
                email: "email@provider.com",
                phone: "+41 44 000 00 00",
                website: "website",
                salesContact: {
                    firstName: "firstName",
                    lastName: "lastName",
                    email: "sales@provider.com",
                },
                mailSettings: {
                    sender: {
                        email: "sender@mail.com",
                    },
                },
            },
        });
    });

    it("should throw an error with matching key but empty object", async () => {
        await expect(() =>
            getConfigurableServiceFn({
                serviceId: ConfigurableService.Id("target"),
                configurations: {
                    target: {},
                },
            })
        ).rejects.toThrow('ConfigurableService: Cannot load entity. No configuration found for id "target".');
    });

    it("should throw an error with non-existing key", async () => {
        await expect(() =>
            getConfigurableServiceFn({
                serviceId: ConfigurableService.Id("non-existing"),
                configurations: {
                    target: { name: "test" },
                },
            })
        ).rejects.toThrow('ConfigurableService: Cannot load entity. No configuration found for id "non-existing".');
    });
});
