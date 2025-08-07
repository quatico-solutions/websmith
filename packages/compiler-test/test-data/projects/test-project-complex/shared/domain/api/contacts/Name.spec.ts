import { Name } from "./Name";

describe("Name", () => {
    describe("create", () => {
        it("should create a name with valid name", () => {
            const actual = Name.create("John Doe");

            expect(actual).toEqual("John Doe");
        });

        it("should create a name with valid name and whitespace", () => {
            const actual = Name.create(" John Doe ");

            expect(actual).toEqual("John Doe");
        });

        it("should throw an error with invalid name", () => {
            expect(() => Name.create("")).toThrow("Name: Invalid name.");
        });
    });
});
