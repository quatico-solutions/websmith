import { ServiceParameter } from "../api";
import { ResolvedRangeValue } from "./ResolvedRangeValue";

describe("RangeValueType", () => {
    describe("constructor", () => {
        it("should create a new range value with label", () => {
            const testObj = new ResolvedRangeValue({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getMin()).toBe(0);
            expect(testObj.getMax()).toBe(100);
            expect(testObj.getStep()).toBe(1);
            expect(testObj.getLabel()).toBe("Expected");
        });

        it("should create a new range value with min, max, step, and label", () => {
            const testObj = new ResolvedRangeValue({
                min: 1,
                max: 10,
                step: 5,
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getMin()).toBe(1);
            expect(testObj.getMax()).toBe(10);
            expect(testObj.getStep()).toBe(5);
            expect(testObj.getLabel()).toBe("Expected");
        });

        it("should create a new range value with min is not smaller than max", () => {
            const testObj = new ResolvedRangeValue({
                min: 10,
                max: 1,
                label: "Whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getMin()).toBe(10);
            expect(testObj.getMax()).toBe(1);
        });

        it("should create a new range value with negative step value", () => {
            const testObj = new ResolvedRangeValue({
                step: -1,
                label: "Whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getStep()).toBe(-1);
        });

        it("should create a new range value with empty label", () => {
            const testObj = new ResolvedRangeValue({
                label: "",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getLabel()).toBe("");
        });
    });

    describe("getType", () => {
        it("should return the type of the value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getKind()).toBe("range");
        });
    });

    describe("create", () => {
        it("should create a new range value with min, max, step, and label", () => {
            const testObj = ResolvedRangeValue.create({
                min: 1,
                max: 10,
                step: 5,
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getMin()).toBe(1);
            expect(testObj.getMax()).toBe(10);
            expect(testObj.getStep()).toBe(5);
            expect(testObj.getLabel()).toBe("Expected");
        });

        it("should create a new range value with step, and label", () => {
            const testObj = ResolvedRangeValue.create({
                step: 5,
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getStep()).toBe(5);
            expect(testObj.getLabel()).toBe("Expected");
            expect(testObj.getMin()).toBe(0);
            expect(testObj.getMax()).toBe(100);
        });

        it("should throw error with min is not smaller than max", () => {
            expect(() =>
                ResolvedRangeValue.create({
                    min: 10,
                    max: 1,
                    step: 1,
                    label: "Expected",
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("RangeValue: Property 'min' must be smaller than property 'max'.");
        });

        it("should throw error with negative step value", () => {
            expect(() =>
                ResolvedRangeValue.create({
                    min: 1,
                    max: 10,
                    step: -1,
                    label: "Expected",
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("RangeValue: Property 'step' must be greater than 0.");
        });
    });

    describe("equals", () => {
        it("should return true with same range value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                min: 1,
                max: 10,
                step: 5,
                unit: "cm",
                value: 1,
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                min: 1,
                max: 10,
                step: 5,
                unit: "cm",
                value: 1,
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with min value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                min: 1,
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                min: 2000,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with max value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                max: 10,
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                max: 1000,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with step value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                step: 5,
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                step: 10000,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with unit value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                unit: "other",
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                unit: "different",
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with value", () => {
            const testObj = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                value: 1,
            });

            const other = ResolvedRangeValue.create({
                label: "Expected",
                parameterId: ServiceParameter.Id("123"),
                value: 200,
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
