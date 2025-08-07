import { Address, Contact, Customer, Name } from "../api";
import { CustomerEntity } from "./CustomerEntity";

const TEST_CUSTOMER: Customer = {
    id: Customer.Id("1"),
    name: Name.create("Foobar Inc."),
    address: Address.create({
        street: "Main St.",
        houseNumber: "123",
        city: "Anytown",
        zip: "12345",
        state: "ZH",
        country: "Schweiz",
    }),
};

describe("CustomerEntity", () => {
    describe("constructor", () => {
        it("should create a customer entity with id, name and address", () => {
            const actual = new CustomerEntity({ ...TEST_CUSTOMER });

            expect(actual).toEqual({
                id: "1",
                name: "Foobar Inc.",
                address: {
                    street: "Main St.",
                    houseNumber: "123",
                    city: "Anytown",
                    state: "ZH",
                    zip: "12345",
                    country: "Schweiz",
                },
            });
        });

        it("should create a customer entity with id, name, address and salesContact", () => {
            const actual = new CustomerEntity({
                ...TEST_CUSTOMER,
                salesContact: Contact.Id("CONT-2"),
            });

            expect(actual).toEqual({
                id: "1",
                name: "Foobar Inc.",
                address: {
                    street: "Main St.",
                    houseNumber: "123",
                    city: "Anytown",
                    state: "ZH",
                    zip: "12345",
                    country: "Schweiz",
                },
                salesContact: "CONT-2",
            });
        });

        it("should create a customer entity with all properties", () => {
            const actual = new CustomerEntity({
                id: Customer.Id("1"),
                name: Name.create("Foobar Inc."),
                address: Address.create({
                    street: "Main St.",
                    houseNumber: "123",
                    city: "Anytown",
                    zip: "12345",
                }),
                domain: "foobar.com",
                industry: "Technology",
                website: "https://foobar.com",
                salesContact: Contact.Id("CONT-2"),
                primaryContact: Contact.Id("CONT-3"),
            });

            expect(actual).toEqual({
                id: "1",
                name: "Foobar Inc.",
                address: {
                    street: "Main St.",
                    houseNumber: "123",
                    city: "Anytown",
                    state: "ZH",
                    zip: "12345",
                    country: "Schweiz",
                },
                domain: "foobar.com",
                industry: "Technology",
                website: "https://foobar.com",
                salesContact: "CONT-2",
                primaryContact: "CONT-3",
            });
        });
    });

    describe("toExternalData", () => {
        it("should return external data with name and address properties", () => {
            const testObj = new CustomerEntity({
                ...TEST_CUSTOMER,
            });

            const actual = testObj.toExternalData();

            const expected = {
                name: "Foobar Inc.",
                street: "Main St.",
                houseNumber: "123",
                city: "Anytown",
                zip: "12345",
                state: "ZH",
                country: "Schweiz",
            };

            expect(actual).toEqual(expected);
        });

        it("should include optional fields when they are present", () => {
            const testObj = new CustomerEntity({
                id: Customer.Id("1"),
                name: Name.create("Complex Customer"),
                address: Address.create({
                    street: "Complex St.",
                    houseNumber: "456",
                    city: "Complextown",
                    zip: "54321",
                    state: "ZH",
                    country: "Schweiz",
                }),
                domain: "complexcustomer.ch",
                industry: "Technology",
                website: "https://complexcustomer.ch",
            });

            const actual = testObj.toExternalData();

            const expected = {
                name: "Complex Customer",
                street: "Complex St.",
                houseNumber: "456",
                city: "Complextown",
                zip: "54321",
                state: "ZH",
                country: "Schweiz",
                domain: "complexcustomer.ch",
                industry: "Technology",
                website: "https://complexcustomer.ch",
            };

            expect(actual).toEqual(expected);
        });

        it("should exclude optional fields when they are undefined", () => {
            const testObj = new CustomerEntity({
                id: Customer.Id("1"),
                name: Name.create("Minimal Customer"),
                address: Address.create({
                    street: "Minimal St.",
                    houseNumber: "789",
                    city: "Minimaltown",
                    zip: "98765",
                    state: "ZH",
                    country: "Schweiz",
                }),
                // domain, industry, website are undefined
            });

            const actual = testObj.toExternalData();

            const expected = {
                name: "Minimal Customer",
                street: "Minimal St.",
                houseNumber: "789",
                city: "Minimaltown",
                zip: "98765",
                state: "ZH",
                country: "Schweiz",
            };

            expect(actual).toEqual(expected);
            expect(actual).not.toHaveProperty("domain");
            expect(actual).not.toHaveProperty("industry");
            expect(actual).not.toHaveProperty("website");
        });
    });
});
