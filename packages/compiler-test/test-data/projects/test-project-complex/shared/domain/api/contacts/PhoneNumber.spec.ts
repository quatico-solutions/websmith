import { PhoneNumber } from "./PhoneNumber";

describe("PhoneNumber", () => {
    describe("create", () => {
        it("should create a phone number with valid phone number", () => {
            const actual = PhoneNumber.create("123456789");

            expect(actual).toEqual("123456789");
        });

        it("should create a phone number with valid phone number and country code", () => {
            const actual = PhoneNumber.create("+41 12 345 6789");

            expect(actual).toEqual("+41 12 345 6789");
        });

        it("should create a phone number with valid phone number separated by a space and country code", () => {
            const actual = PhoneNumber.create("+41 12 345 67 89");

            expect(actual).toEqual("+41 12 345 67 89");
        });

        it("should create a phone number with valid mobile number", () => {
            const actual = PhoneNumber.create("079 123 4567");
            expect(actual).toEqual("079 123 4567");
        });

        it("should create a phone number with valid phone number and whitespace", () => {
            const actual = PhoneNumber.create(" 123456789 ");
            expect(actual).toEqual("123456789");
        });

        it("should return undefined with empty string", () => {
            const actual = PhoneNumber.create("");

            expect(actual).toBeUndefined();
        });

        it("should throw an error with invalid phone number", () => {
            expect(() => PhoneNumber.create("foobar")).toThrow("PhoneNumber: Invalid phone number.");
        });
    });
});
