import { ValueObject } from "./ValueObject";

type TargetObject = {
    one?: number;
    two?: number;
};

class ValueObjectTestClass extends ValueObject(
    class {
        readonly one?: number;
        readonly two?: number;

        constructor(props: TargetObject) {
            this.one = props.one;
            this.two = props.two;
        }
    }
) {
    constructor(props: TargetObject) {
        super(props);
    }
}

describe("ValueObject", () => {
    describe("constructor", () => {
        it("should yield value with valid value object", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });

            expect(testObj).toEqual({ one: 1, two: 2 });
        });

        it("should yield value with empty value object", () => {
            const testObj = new ValueObjectTestClass({});

            expect(testObj).toEqual({});
        });
    });

    describe("equals", () => {
        it("should return true with itself", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });

            expect(testObj.equals(testObj)).toBe(true);
        });

        it("should return true with same value", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });
            const other = new ValueObjectTestClass({ one: 1, two: 2 });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different value", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });
            const other = new ValueObjectTestClass({ one: 1, two: 666 });

            expect(testObj.equals(other)).toBe(false);
        });
    });

    describe("clone", () => {
        it("should return a new instance with the same value", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });

            const actual = testObj.clone();

            expect(actual).toEqual(testObj);
            expect(actual).not.toBe(testObj);
            expect(actual).toEqual({ one: 1, two: 2 });
        });
    });

    describe("toString", () => {
        it("should return string with object value", () => {
            const testObj = new ValueObjectTestClass({ one: 1, two: 2 });

            expect(testObj.toString()).toBe('{"one":1,"two":2}');
        });

        it("should return string with emptyobject value", () => {
            const testObj = new ValueObjectTestClass({});

            expect(testObj.toString()).toBe("{}");
        });
    });
});
