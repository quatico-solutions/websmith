import { ServiceParameter } from "../api";
import { ResolvedDiscreteValue } from "../parameter-values";
import { ServiceParameterEntity } from "./ServiceParameterEntity";

describe("ServiceParameterEntity", () => {
    describe("constructor", () => {
        it("should create a new service configuration parameter", () => {
            const parameterId = ServiceParameter.Id("123");
            const testObj = new ServiceParameterEntity({
                id: parameterId,
                name: "expected",
                required: true,
                value: ResolvedDiscreteValue.create({ options: [], parameterId }),
            });

            expect(testObj).toEqual({
                id: ServiceParameter.Id("123"),
                name: "expected",
                required: true,
                value: ResolvedDiscreteValue.create({ options: [], parameterId }),
            });
        });

        it("should create a new service configuration parameter with empty name", () => {
            const parameterId = ServiceParameter.Id("123");
            const testObj = new ServiceParameterEntity({
                id: parameterId,
                name: "",
                required: true,
                value: ResolvedDiscreteValue.create({ options: [], parameterId }),
            });

            expect(testObj).toEqual({
                id: ServiceParameter.Id("123"),
                name: "",
                required: true,
                value: ResolvedDiscreteValue.create({ options: [], parameterId }),
            });
        });

        it("should throw an error with null value type", () => {
            expect(
                () =>
                    new ServiceParameterEntity({
                        id: ServiceParameter.Id("123"),
                        name: "expected",
                        required: true,
                        value: null as any,
                    })
            ).toThrow("ParameterValue: Cannot resolve parameter value with unknown kind 'null'.");
        });
    });
    describe("create", () => {
        it("should create a new service configuration parameter", () => {
            const parameterId = ServiceParameter.Id("123");
            const testObj = ServiceParameterEntity.create({
                id: parameterId,
                name: "expected",
                required: true,
                value: ResolvedDiscreteValue.create({
                    options: [],
                    parameterId,
                }),
            });

            expect(testObj).toEqual({
                id: ServiceParameter.Id("123"),
                name: "expected",
                required: true,
                value: ResolvedDiscreteValue.create({ options: [], parameterId }),
            });
        });

        it("should throw error with empty id", () => {
            expect(() =>
                ServiceParameterEntity.create({
                    id: ServiceParameter.Id(""),
                    name: "expected",
                    required: true,
                    value: ResolvedDiscreteValue.create({
                        options: [],
                        parameterId: ServiceParameter.Id("123"),
                    }),
                })
            ).toThrow("ServiceParameter: Property 'id' cannot be empty.");
        });

        it("should throw error with empty name", () => {
            const parameterId = ServiceParameter.Id("123");

            expect(() =>
                ServiceParameterEntity.create({
                    id: parameterId,
                    name: "",
                    required: true,
                    value: ResolvedDiscreteValue.create({
                        options: [],
                        parameterId,
                    }),
                })
            ).toThrow("ServiceParameter: Property 'name' cannot be empty.");
        });

        it("should throw error with null value type", () => {
            expect(() =>
                ServiceParameterEntity.create({
                    id: ServiceParameter.Id("123"),
                    name: "expected",
                    required: true,
                    value: null as any,
                })
            ).toThrow("ServiceParameter: Property 'value' cannot be null.");
        });
    });

    describe("Id", () => {
        it("should create a new service configuration parameter id", () => {
            const testObj = ServiceParameter.Id("123");

            expect(testObj).toBe("123");
        });

        it("should throw an error if the id is empty", () => {
            expect(() => ServiceParameter.Id("")).toThrow("ServiceParameter: Property 'id' cannot be empty.");
        });
    });
});
