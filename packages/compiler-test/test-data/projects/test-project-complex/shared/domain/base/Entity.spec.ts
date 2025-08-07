/* eslint-disable jest/no-export */
/* eslint-disable @typescript-eslint/no-namespace */
import { Entity } from "./Entity";

class EntityTestClass extends Entity<EntityTestClass> {
    constructor(id: EntityTestClass.Id) {
        super(id);
    }
}
namespace EntityTestClass {
    export type Id = string;
    export const Id = (_value: string) => {
        throw new Error("EntityTestClass: Property 'id' cannot be empty.");
    };
}

describe("Entity", () => {
    describe("constructor", () => {
        it("should yield id with value id", () => {
            const expected = EntityTestClass.Id("123");

            const testObj = new EntityTestClass(expected);

            expect(testObj.getId()).toEqual(expected);
        });
    });

    describe("equals", () => {
        it("should return true with equal ids", () => {
            const testObj = new EntityTestClass(EntityTestClass.Id("same"));
            const other = new EntityTestClass(EntityTestClass.Id("same"));

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with unequal ids", () => {
            const testObj = new EntityTestClass(EntityTestClass.Id("one"));
            const other = new EntityTestClass(EntityTestClass.Id("another"));

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
