import { ServiceParameter } from "../api";
import { ResolvedBooleanValue } from "./ResolvedBooleanValue";

describe("ResolvedBooleanValue", () => {
    describe("constructor", () => {
        it("should create value with valid label strings", () => {
            const testObj = new ResolvedBooleanValue({
                trueLabel: "whatever",
                falseLabel: "whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj).toBeDefined();
        });

        it("should yield trueLabel with invalid label string", () => {
            const testObj = new ResolvedBooleanValue({
                trueLabel: "",
                falseLabel: "whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getTrueLabel()).toBe("");
        });

        it("should yield falseLabel with invalid label string", () => {
            const testObj = new ResolvedBooleanValue({
                trueLabel: "whatever",
                falseLabel: "",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getFalseLabel()).toBe("");
        });
    });

    describe("getType", () => {
        it("should return the type of the value", () => {
            const testObj = ResolvedBooleanValue.create({
                trueLabel: "whatever",
                falseLabel: "whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getKind()).toBe("boolean");
        });
    });

    describe("create", () => {
        it("should create a new boolean value with valid label strings", () => {
            const testObj = ResolvedBooleanValue.create({
                trueLabel: "whatever",
                falseLabel: "whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj).toBeDefined();
        });

        it("should throw error with invalid true label strings", () => {
            expect(() =>
                ResolvedBooleanValue.create({
                    trueLabel: "",
                    falseLabel: "whatever",
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("BooleanValue: 'trueLabel' cannot be empty.");
        });

        it("should throw error with invalid false label strings", () => {
            expect(() =>
                ResolvedBooleanValue.create({
                    trueLabel: "whatever",
                    falseLabel: "",
                    parameterId: ServiceParameter.Id("123"),
                })
            ).toThrow("BooleanValue: 'falseLabel' cannot be empty.");
        });
    });

    describe("getTrueLabel", () => {
        it("should return the true label", () => {
            const testObj = ResolvedBooleanValue.create({
                trueLabel: "expected",
                falseLabel: "whatever",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getTrueLabel()).toBe("expected");
        });
    });

    describe("getFalseLabel", () => {
        it("should return the false label", () => {
            const testObj = ResolvedBooleanValue.create({
                trueLabel: "whatever",
                falseLabel: "expected",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.getFalseLabel()).toBe("expected");
        });
    });

    describe("equals", () => {
        it("should return true with equal values", () => {
            const testObj1 = ResolvedBooleanValue.create({
                trueLabel: "same",
                falseLabel: "same",
                parameterId: ServiceParameter.Id("123"),
            });
            const other = ResolvedBooleanValue.create({
                trueLabel: "same",
                falseLabel: "same",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj1.equals(other)).toBe(true);
        });

        it("should return false with unequal values", () => {
            const testObj = ResolvedBooleanValue.create({
                trueLabel: "one",
                falseLabel: "one",
                parameterId: ServiceParameter.Id("123"),
            });
            const other = ResolvedBooleanValue.create({
                trueLabel: "another",
                falseLabel: "one",
                parameterId: ServiceParameter.Id("123"),
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
