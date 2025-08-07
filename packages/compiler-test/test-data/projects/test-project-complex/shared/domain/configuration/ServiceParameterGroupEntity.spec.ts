import { ServiceParameter, ServiceParameterGroup } from "../api";
import { ResolvedTextValue } from "../parameter-values";
import { FactorLookupValue } from "../pricing/parameter-price";
import { ServiceParameterEntity } from "./ServiceParameterEntity";
import { ServiceParameterGroupEntity } from "./ServiceParameterGroupEntity";

describe("ServiceParameterGroupEntity", () => {
    describe("constructor", () => {
        it("should create a new service configuration parameter group", () => {
            const testObj = new ServiceParameterGroupEntity({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [],
                description: "Test Description",
            });

            expect(testObj).toEqual({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [],
                description: "Test Description",
            });
        });

        it("should create a new service configuration parameter group with empty name", () => {
            const testObj = new ServiceParameterGroupEntity({
                id: ServiceParameterGroup.Id("123"),
                name: "",
                required: true,
                parameters: [],
                description: "Test Description",
            });

            expect(testObj).toEqual({
                id: ServiceParameterGroup.Id("123"),
                name: "",
                required: true,
                parameters: [],
                description: "Test Description",
            });
        });
    });

    describe("calculatePrice", () => {
        it("should calculate return zero with no parameters", () => {
            const testObj = new ServiceParameterGroupEntity({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [],
                description: "Test Description",
            });

            expect(testObj.calculatePrice([], new FactorLookupValue({}))).toEqual(0);
        });

        it("should calculate the price of the parameter group with a price value", () => {
            const testObj = new ServiceParameterGroupEntity({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [
                    ServiceParameterEntity.create({
                        id: ServiceParameter.Id("123"),
                        name: "Test Parameter",
                        value: ResolvedTextValue.create({
                            parameterId: ServiceParameter.Id("123"),
                            value: "Test Value",
                            price: 10,
                        }),
                    }),
                ],
            });

            expect(
                testObj.calculatePrice(
                    [
                        ResolvedTextValue.create({
                            parameterId: ServiceParameter.Id("123"),
                            value: "Test Value",
                            price: 10,
                        }),
                    ],
                    new FactorLookupValue({})
                )
            ).toEqual(10);
        });

        it("should calculate the price of the parameter group with a price function", () => {
            const testObj = new ServiceParameterGroupEntity({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                priceFn: (_parameterValues, originalTotal) => {
                    return 0.9 * originalTotal;
                },
                parameters: [
                    ServiceParameterEntity.create({
                        id: ServiceParameter.Id("123"),
                        name: "Test Parameter",
                        value: ResolvedTextValue.create({
                            parameterId: ServiceParameter.Id("123"),
                            value: "Test Value",
                            price: 10,
                        }),
                    }),
                ],
            });

            expect(
                testObj.calculatePrice(
                    [
                        ResolvedTextValue.create({
                            parameterId: ServiceParameter.Id("123"),
                            value: "Test Value",
                            price: 10,
                        }),
                    ],
                    new FactorLookupValue({})
                )
            ).toEqual(9);
        });
    });

    describe("create", () => {
        it("should create a new service configuration parameter group", () => {
            const testObj = ServiceParameterGroupEntity.create({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [],
                description: "Test Description",
            });

            expect(testObj).toEqual({
                id: ServiceParameterGroup.Id("123"),
                name: "Test Group",
                required: true,
                parameters: [],
                description: "Test Description",
            });
        });

        it("should throw an error with empty id", () => {
            expect(() =>
                ServiceParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id(""),
                    name: "Test Group",
                    required: true,
                    parameters: [],
                    description: "Test Description",
                })
            ).toThrow("ServiceParameterGroup: Property 'id' cannot be empty.");
        });

        it("should throw an error with empty name", () => {
            expect(() =>
                ServiceParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "",
                    required: true,
                    parameters: [],
                    description: "Test Description",
                })
            ).toThrow("ServiceParameterGroup: Property 'name' cannot be empty.");
        });
    });

    describe("Id", () => {
        it("should create a new service configuration parameter group id", () => {
            const testObj = ServiceParameterGroup.Id("123");

            expect(testObj).toBe("123");
        });

        it("should throw an error if the id is empty", () => {
            expect(() => ServiceParameterGroup.Id("")).toThrow(
                "ServiceParameterGroup: Property 'id' cannot be empty."
            );
        });
    });
});
