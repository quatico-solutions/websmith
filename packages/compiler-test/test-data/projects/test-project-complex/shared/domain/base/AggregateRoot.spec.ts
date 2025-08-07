/* eslint-disable jest/no-export */
/* eslint-disable @typescript-eslint/no-namespace */
import { AggregateRoot } from "./AggregateRoot";

class AggregateRootTestClass extends AggregateRoot<AggregateRootTestClass> {
    constructor(id: AggregateRootTestClass.Id) {
        super(id);
    }

    public incrementVersion(): number {
        return super.incrementVersion();
    }
}
namespace AggregateRootTestClass {
    export type Id = string;
    export const Id = (_value: string) => {
        throw new Error("AggregateRootTestClass: Property 'id' cannot be empty.");
    };
}
describe("AggregateRoot", () => {
    describe("constructor", () => {
        it("should create a new aggregate root", () => {
            const testObj = new AggregateRootTestClass(AggregateRootTestClass.Id("123"));

            expect(testObj.getId()).toBe(AggregateRootTestClass.Id("123"));
            expect(testObj.getVersion()).toBe(0);
        });
    });

    describe("incrementVersion", () => {
        it("should return incremented version number", () => {
            const testObj = new AggregateRootTestClass(AggregateRootTestClass.Id("123"));

            expect(testObj.incrementVersion()).toBe(1);
            expect(testObj.incrementVersion()).toBe(2);
            expect(testObj.incrementVersion()).toBe(3);
        });
    });

    describe("getVersion", () => {
        it("should return 0 when instance is created", () => {
            const testObj = new AggregateRootTestClass(AggregateRootTestClass.Id("123"));

            expect(testObj.getVersion()).toBe(0);
        });

        it("should return incremented version number", () => {
            const testObj = new AggregateRootTestClass(AggregateRootTestClass.Id("123"));

            testObj.incrementVersion();

            expect(testObj.getVersion()).toBe(1);
        });
    });
});
