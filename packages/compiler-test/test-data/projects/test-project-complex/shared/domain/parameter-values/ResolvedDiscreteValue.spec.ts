import { ServiceParameter } from "../api";
import { resolveOptionsValue } from "./resolve-options-value";
import { ResolvedDiscreteValue } from "./ResolvedDiscreteValue";

describe("ResolvedDiscreteValue", () => {
    describe("constructor", () => {
        it("should create a new discrete value with single option", () => {
            const testObj = new ResolvedDiscreteValue({
                options: [
                    {
                        value: "option1",
                        label: "Option 1",
                    },
                ],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([{ value: "option1", label: "Option 1" }]);
        });

        it("should create a new discrete value with multiple options", () => {
            const testObj = new ResolvedDiscreteValue({
                options: [
                    { value: "option1", label: "Option 1" },
                    { value: "option2", label: "Option 2" },
                ],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([
                { value: "option1", label: "Option 1" },
                { value: "option2", label: "Option 2" },
            ]);
        });

        it("should create a new discrete value with single option and empty value and label", () => {
            const testObj = new ResolvedDiscreteValue({
                options: [{ value: "option-1", label: "Option 1" }],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([{ value: "option-1", label: "Option 1" }]);
        });

        it("should create a new discrete value with multiple options and same value", () => {
            const testObj = new ResolvedDiscreteValue({
                options: [
                    { value: "option1", label: "Option 1" },
                    { value: "option1", label: "Option 2" },
                ],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([
                { value: "option1", label: "Option 1" },
                { value: "option1", label: "Option 2" },
            ]);
        });

        it("should create a new discrete value with multiple options and same label", () => {
            const testObj = new ResolvedDiscreteValue({
                options: [
                    { value: "option1", label: "Option 1" },
                    { value: "option2", label: "Option 1" },
                ],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([
                { value: "option1", label: "Option 1" },
                { value: "option2", label: "Option 1" },
            ]);
        });
    });

    describe("getType", () => {
        it("should return the type of the value", () => {
            const testObj = ResolvedDiscreteValue.create({
                options: [{ value: "option1", label: "Option 1" }],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getKind()).toBe("discrete");
        });
    });

    describe("create", () => {
        it("should create a new discrete option", () => {
            const testObj = ResolvedDiscreteValue.create({
                options: [{ value: "option1", label: "Option 1" }],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getOptions()).toEqual([{ value: "option1", label: "Option 1" }]);
        });

        it("should throw error with empty value", () => {
            expect(() =>
                ResolvedDiscreteValue.create({
                    options: [{ value: "", label: "Option 1" }],
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("DiscreteOption: Property 'value' of value cannot be empty.");
        });

        it("should throw error with duplicate value", () => {
            expect(() =>
                ResolvedDiscreteValue.create({
                    options: [
                        { value: "option1", label: "Option 1" },
                        { value: "option1", label: "Option 2" },
                    ],
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("DiscreteOption has values with duplicate a 'value'. Property 'value' must be unique.");
        });

        it("should throw error with duplicate label", () => {
            expect(() =>
                ResolvedDiscreteValue.create({
                    options: [
                        { value: "option1", label: "Option 1" },
                        { value: "option2", label: "Option 1" },
                    ],
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("DiscreteOption has values with duplicate a 'label'. Property 'label' must be unique.");
        });

        it("should throw error with price as number", () => {
            expect(() =>
                ResolvedDiscreteValue.create({
                    options: [
                        { value: "option1", label: "Option 1" },
                        { value: "option2", label: "Option 1" },
                    ],
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("DiscreteOption has values with duplicate a 'label'. Property 'label' must be unique.");
        });
    });

    describe("equals", () => {
        it("should return true with same options", () => {
            const testObj = new ResolvedDiscreteValue({
                parameterId: ServiceParameter.Id("123"),
                options: [{ value: "same", label: "Same", price: 100 }],
            });

            const other = new ResolvedDiscreteValue({
                parameterId: ServiceParameter.Id("123"),
                options: [{ value: "same", label: "Same", price: 100 }],
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different options", () => {
            const testObj = ResolvedDiscreteValue.create({
                options: [{ value: "other", label: "Other" }],
                parameterId: ServiceParameter.Id("123"),
            });

            const other = ResolvedDiscreteValue.create({
                options: [{ value: "different", label: "Different" }],
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});

describe("resolveOptionsValue", () => {
    it("should return value with value and label", () => {
        const testObj = resolveOptionsValue(
            { value: "option1", label: "Option 1" },
            ServiceParameter.Id("123")
        );

        expect(testObj).toEqual({ value: "option1", label: "Option 1" });
    });

    it("should throw error with empty value and label", () => {
        expect(() =>
            resolveOptionsValue({ value: "", label: "Option 1" }, ServiceParameter.Id("123"))
        ).toThrow("DiscreteOption: Property 'value' must be provided.");
    });

    it("should throw error with empty label and value", () => {
        expect(() =>
            resolveOptionsValue({ value: "option1", label: "" }, ServiceParameter.Id("123"))
        ).toThrow("DiscreteOption: Property 'label' must be provided.");
    });
});
