import { ServiceParameter, ServiceParameterGroup, type TextValue } from "../api";
import { ServiceParameterEntity } from "./ServiceParameterEntity";
import { ServiceParameterGroupEntity } from "./ServiceParameterGroupEntity";
import { ServiceParameterGroups } from "./ServiceParameterGroups";

describe("ServiceParameterGroups", () => {
    describe("constructor", () => {
        it("should create a new ServiceParameterGroups with empty list", () => {
            const actual = new ServiceParameterGroups([]);

            expect(actual).toHaveLength(0);
        });

        it("should create a new ServiceParameterGroups with parameter groups", () => {
            const actual = new ServiceParameterGroups([
                new ServiceParameterGroupEntity({
                    id: ServiceParameterGroup.Id("1"),
                    name: "Group 1",
                    parameters: [],
                }),
                new ServiceParameterGroupEntity({
                    id: ServiceParameterGroup.Id("2"),
                    name: "Group 2",
                    parameters: [],
                }),
            ]);

            expect(actual).toHaveLength(2);
        });

        it("should create a new ServiceParameterGroups with undefined", () => {
            const actual = new ServiceParameterGroups();

            expect(actual).toHaveLength(0);
        });
    });

    describe("flatMap", () => {
        it("should return flat list with single parameter", () => {
            const actual = new ServiceParameterGroups([
                new ServiceParameterGroupEntity({
                    id: ServiceParameterGroup.Id("1"),
                    name: "Group 1",
                    parameters: [
                        new ServiceParameterEntity({
                            id: ServiceParameter.Id("1"),
                            name: "Parameter 1",
                            value: {
                                kind: "text",
                                inputType: "text",
                            } as TextValue,
                        }),
                    ],
                }),
            ]);

            expect(actual.flatMap(it => it.getParameters())).toEqual([
                {
                    id: "1",
                    name: "Parameter 1",
                    required: false,
                    value: {
                        inputType: "text",
                        kind: "text",
                        parameterId: "1",
                    },
                },
            ]);
        });

        it("should return flat list with multiple parameters", () => {
            const actual = new ServiceParameterGroups([
                new ServiceParameterGroupEntity({
                    id: ServiceParameterGroup.Id("1"),
                    name: "Group 1",
                    parameters: [
                        new ServiceParameterEntity({
                            id: ServiceParameter.Id("1"),
                            name: "Parameter 1",
                            value: {
                                kind: "text",
                                inputType: "text",
                            } as TextValue,
                        }),
                        new ServiceParameterEntity({
                            id: ServiceParameter.Id("2"),
                            name: "Parameter 2",
                            value: {
                                kind: "text",
                                inputType: "text",
                            } as TextValue,
                        }),
                    ],
                }),
            ]);

            expect(actual.flatMap(it => it.getParameters())).toEqual([
                {
                    id: "1",
                    name: "Parameter 1",
                    required: false,
                    value: {
                        inputType: "text",
                        kind: "text",
                        parameterId: "1",
                    },
                },
                {
                    id: "2",
                    name: "Parameter 2",
                    required: false,
                    value: {
                        inputType: "text",
                        kind: "text",
                        parameterId: "2",
                    },
                },
            ]);
        });
    });
});
