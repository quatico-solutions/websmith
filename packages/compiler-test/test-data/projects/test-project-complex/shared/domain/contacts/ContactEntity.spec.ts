import { Contact, EmailAddress, Name, PhoneNumber } from "../api";
import { ContactEntity } from "./ContactEntity";

describe("ContactEntity", () => {
    describe("constructor", () => {
        it("should create a contact entity with all properties", () => {
            const actual = new ContactEntity({
                id: Contact.Id("1"),
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("123456789"),
            });

            expect(actual).toEqual({
                id: "1",
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
                phone: "123456789",
            });
        });

        it("should create a contact entity with required properties", () => {
            const actual = new ContactEntity({
                id: Contact.Id("1"),
                email: EmailAddress.create("john.doe@example.com"),
            });

            expect(actual).toEqual({
                id: "1",
                email: "john.doe@example.com",
            });
        });
    });

    describe("create", () => {
        it("should create a contact value with valid contact", () => {
            const actual = ContactEntity.create({
                id: Contact.Id("1"),
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("123456789"),
            });

            expect(actual).toEqual({
                id: "1",
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
                phone: "123456789",
            });
        });

        it("should return undefined with undefined contact", () => {
            const actual = ContactEntity.create(undefined);

            expect(actual).toBeUndefined();
        });
    });

    describe("toExternalData", () => {
        it("should return external data with all properties when present", () => {
            const testObj = new ContactEntity({
                id: Contact.Id("1"),
                firstName: Name.create("John"),
                lastName: Name.create("Doe"),
                email: EmailAddress.create("john.doe@example.com"),
                phone: PhoneNumber.create("123456789"),
            });

            const actual = testObj.toExternalData();

            const expected = {
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
                phone: "123456789",
            };

            expect(actual).toEqual(expected);
        });

        it("should return external data with only required email when optional fields are missing", () => {
            const testObj = new ContactEntity({
                id: Contact.Id("1"),
                email: EmailAddress.create("minimal@example.com"),
                // firstName, lastName, phone are undefined
            });

            const actual = testObj.toExternalData();

            const expected = {
                email: "minimal@example.com",
            };

            expect(actual).toEqual(expected);
            expect(actual).not.toHaveProperty("firstName");
            expect(actual).not.toHaveProperty("lastName");
            expect(actual).not.toHaveProperty("phone");
        });

        it("should include firstName when present but exclude other optional fields", () => {
            const testObj = new ContactEntity({
                id: Contact.Id("1"),
                firstName: Name.create("John"),
                email: EmailAddress.create("john@example.com"),
                // lastName and phone are undefined
            });

            const actual = testObj.toExternalData();

            const expected = {
                firstName: "John",
                email: "john@example.com",
            };

            expect(actual).toEqual(expected);
            expect(actual).toHaveProperty("firstName");
            expect(actual).not.toHaveProperty("lastName");
            expect(actual).not.toHaveProperty("phone");
        });
    });
});
