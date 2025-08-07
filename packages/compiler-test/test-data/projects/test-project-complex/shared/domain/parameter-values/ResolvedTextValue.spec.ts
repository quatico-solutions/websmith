import { ServiceParameter } from "../api";
import { ResolvedTextValue } from "./ResolvedTextValue";

describe("ResolvedTextValue", () => {
    describe("constructor", () => {
        it("should create a new text value with defaults", () => {
            const testObj = new ResolvedTextValue({
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getInputType()).toBe("text");
            expect(testObj.getPlaceholder()).toBeUndefined();
            expect(testObj.getHelp()).toBeUndefined();
        });

        it("should create a new text value with input type", () => {
            const testObj = new ResolvedTextValue({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getInputType()).toBe("email");
        });

        it("should create a new text value with input type, placeholder and helperText", () => {
            const testObj = new ResolvedTextValue({
                inputType: "email",
                placeholder: "Enter email",
                help: "Helper text",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getInputType()).toBe("email");
            expect(testObj.getPlaceholder()).toBe("Enter email");
            expect(testObj.getHelp()).toBe("Helper text");
        });
    });

    describe("getType", () => {
        it("should return the type of the value", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getKind()).toBe("text");
        });
    });

    describe("create", () => {
        it("should create a new text value with input type, placeholder and helperText", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                placeholder: "Enter email",
                help: "Helper text",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getInputType()).toBe("email");
            expect(testObj.getPlaceholder()).toBe("Enter email");
            expect(testObj.getHelp()).toBe("Helper text");
        });
        it("should create a new text value with empty input type", () => {
            const testObj = ResolvedTextValue.create({
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getInputType()).toBe("text");
        });

        it("should throw error with invalid input type", () => {
            expect(() =>
                ResolvedTextValue.create({
                    inputType: "invalid" as any,
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow(
                "TextValue: Property 'inputType' must be one of the following: 'date', 'email', 'number', 'tel', 'text', 'textarea'."
            );
        });
    });

    describe("equals", () => {
        it("should return true with same text value", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                placeholder: "Enter email",
                help: "Helper text",
                value: "test@test.com",
            });

            const other = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                placeholder: "Enter email",
                help: "Helper text",
                value: "test@test.com",
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different input type", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
            });

            const other = ResolvedTextValue.create({
                inputType: "tel",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different placeholder", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                placeholder: "other",
            });

            const other = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                placeholder: "different",
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different helperText", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                help: "other",
            });

            const other = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                help: "different",
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different value", () => {
            const testObj = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                value: "other",
            });

            const other = ResolvedTextValue.create({
                inputType: "email",
                parameterId: ServiceParameter.Id("123"),
                value: "different",
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
