import { ServiceParameter, ServiceParameterGroup } from "../api";
import { ServiceParameterEntity, ServiceParameterGroupEntity } from "../configuration";
import { ResolvedBooleanValue } from "../parameter-values";
import { PriceModelValue } from "./PriceModelValue";

describe("PriceModelValue", () => {
    describe("constructor", () => {
        it("should create a new price model with empty selected parameter values", () => {
            const testObj = new PriceModelValue({
                parameterGroups: [],
            });

            expect(testObj).toEqual({
                parameterGroups: [],
            });
        });

        it("should create a new price model with selected parameter values", () => {
            const values = [
                ResolvedBooleanValue.create({
                    parameterId: ServiceParameter.Id("123"),
                    value: true,
                    trueLabel: "true",
                    falseLabel: "false",
                }),
            ];
            const testObj = new PriceModelValue({
                parameterGroups: [
                    ServiceParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("group"),
                        name: "test",
                        parameters: [
                            ServiceParameterEntity.create({
                                id: ServiceParameter.Id("123"),
                                name: "test",
                                value: values[0] as ResolvedBooleanValue,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj).toEqual({
                parameterGroups: [
                    {
                        id: "group",
                        name: "test",
                        parameters: [
                            {
                                id: "123",
                                name: "test",
                                required: false,
                                value: {
                                    falseLabel: "false",
                                    kind: "boolean",
                                    parameterId: "123",
                                    trueLabel: "true",
                                    value: true,
                                },
                            },
                        ],
                        required: false,
                    },
                ],
            });
        });
    });

    describe("create", () => {
        it("should create a new price model", () => {
            const testObj = PriceModelValue.create({
                parameterGroups: [
                    ServiceParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("123"),
                        name: "test",
                        parameters: [],
                    }),
                ],
            });

            expect(testObj).toEqual({
                parameterGroups: [
                    {
                        id: "123",
                        name: "test",
                        parameters: [],
                        required: false,
                    },
                ],
            });
        });
    });
});
