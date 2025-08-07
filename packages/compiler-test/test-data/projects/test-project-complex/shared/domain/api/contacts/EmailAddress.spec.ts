import { EmailAddress } from "./EmailAddress";

describe("EmailAddress", () => {
    describe("create", () => {
        it("should create an email address with valid email address", () => {
            const actual = EmailAddress.create("test@test.com");

            expect(actual).toEqual("test@test.com");
        });

        it("should create an email address with valid email address and whitespace", () => {
            const actual = EmailAddress.create(" test@test.com ");

            expect(actual).toEqual("test@test.com");
        });

        it("should create an email address with valid email address and uppercase", () => {
            const actual = EmailAddress.create("TEST@test.com");

            expect(actual).toEqual("test@test.com");
        });

        it("should throw an error with invalid email address", () => {
            expect(() => EmailAddress.create("test.invalid")).toThrow("EmailAddress: Invalid email address.");
        });
    });
});
