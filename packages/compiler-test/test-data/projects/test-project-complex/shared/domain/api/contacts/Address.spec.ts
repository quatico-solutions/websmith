import { Address } from "./Address";

describe("Address", () => {
    describe("create", () => {
        it("should return address with all fields", () => {
            const actual = Address.create({
                street: "Musterstrasse",
                houseNumber: "123",
                city: "Zürich",
                zip: "8005",
                state: "ZH",
                country: "Schweiz",
            });

            expect(actual).toEqual({
                street: "Musterstrasse",
                houseNumber: "123",
                city: "Zürich",
                zip: "8005",
                state: "ZH",
                country: "Schweiz",
            });
        });

        it("should return address with minimum required fields", () => {
            const actual = Address.create({
                street: "Musterstrasse",
                houseNumber: "123",
                city: "Zürich",
                zip: "8005",
            });

            expect(actual).toEqual({
                street: "Musterstrasse",
                houseNumber: "123",
                city: "Zürich",
                zip: "8005",
                state: "ZH",
                country: "Schweiz",
            });
        });
    });
});
