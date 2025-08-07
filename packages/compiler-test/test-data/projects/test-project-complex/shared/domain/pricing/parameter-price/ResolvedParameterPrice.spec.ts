/* eslint-disable @typescript-eslint/unbound-method */
import { type ParameterPriceObject } from "../../api";
import { FactorLookupValue } from "./FactorLookupValue";
import { ResolvedParameterPrice } from "./ResolvedParameterPrice";

class ResolvedParameterPriceTestClass extends ResolvedParameterPrice {
    constructor(price: ParameterPriceObject) {
        super(price);
    }

    defaultPriceFn(parameterValue: unknown): number {
        return parameterValue as number;
    }
}

describe("ResolvedParameterPrice", () => {
    describe("constructor", () => {
        it("should create a new resolved parameter price", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 123,
                priceFn: jest.fn(),
            });

            expect(testObj).toEqual({
                type: "constant",
                amount: 123,
                priceFn: expect.any(Function),
            });
        });
    });

    describe("calculatePrice", () => {
        it("should call the priceFn with priceFn", () => {
            const target = jest.fn();
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                priceFn: target,
            });
            jest.spyOn(testObj, "defaultPriceFn").mockReturnValue(666);

            testObj.calculatePrice(123, new FactorLookupValue({}));

            expect(testObj.defaultPriceFn).toHaveBeenCalledWith(123, new FactorLookupValue({}));
            expect(target).toHaveBeenCalledWith(123, 666, new FactorLookupValue({}));
        });

        it("should call the priceFn with priceFn and value", () => {
            const target = jest.fn();

            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                priceFn: target,
            });
            jest.spyOn(testObj, "defaultPriceFn").mockReturnValue(666);
            testObj.calculatePrice(123, new FactorLookupValue({}));

            expect(testObj.defaultPriceFn).toHaveBeenCalledWith(123, new FactorLookupValue({}));
            expect(target).toHaveBeenCalledWith(123, 666, new FactorLookupValue({}));
        });

        it("should call the defaultPriceFn with value and no priceFn", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 123,
            });
            jest.spyOn(testObj, "defaultPriceFn");

            testObj.calculatePrice(123, new FactorLookupValue({}));

            expect(testObj.defaultPriceFn).toHaveBeenCalledWith(123, new FactorLookupValue({}));
        });
    });

    describe("equals", () => {
        it("should return true with same parameter price", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 123,
                priceFn: jest.fn(),
            });
            const other = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 123,
                priceFn: jest.fn(),
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different type", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "factor-lookup",
            });

            const other = new ResolvedParameterPriceTestClass({
                type: "multi-constant",
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different value", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 123,
            });

            const other = new ResolvedParameterPriceTestClass({
                type: "constant",
                amount: 456,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different priceFn", () => {
            const testObj = new ResolvedParameterPriceTestClass({
                type: "constant",
                priceFn: jest.fn(),
            });

            const other = new ResolvedParameterPriceTestClass({
                type: "constant",
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
