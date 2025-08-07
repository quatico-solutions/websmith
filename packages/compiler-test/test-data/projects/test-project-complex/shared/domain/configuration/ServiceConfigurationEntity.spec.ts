import { ConfigurableService, ServiceConfiguration, ServiceParameter, ServiceParameterGroup } from "../api";
import { ConfigurationParameterGroupEntity } from "./ConfigurationParameterGroupEntity";
import { ConfigurationParameterValueEntity } from "./ConfigurationParameterValueEntity";
import { ServiceConfigurationEntity } from "./ServiceConfigurationEntity";

describe("ServiceConfigurationEntity", () => {
    describe("constructor", () => {
        it("should create a new service configuration", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });

            expect(testObj).toEqual({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });
        });
    });

    describe("create", () => {
        it("should create a new service configuration", () => {
            const testObj = ServiceConfigurationEntity.create({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });

            expect(testObj).toEqual({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });
        });
    });

    describe("Id", () => {
        it("should create a new service configuration id", () => {
            const testObj = ServiceConfiguration.Id("expected-id");

            expect(testObj).toBe("expected-id");
        });

        it("should throw an error if the id is empty", () => {
            expect(() => ServiceConfiguration.Id("")).toThrow(
                "ServiceConfiguration: Property 'id' cannot be empty."
            );
        });
    });

    describe("getParameterValues", () => {
        it("should return parameter values with no parameters", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });

            expect(testObj.getParameterValues()).toEqual({});
        });

        it("should return parameter values with single parameter with text value", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [
                    ConfigurationParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                        name: "expected-parameter-group-name",
                        subTotal: 100,
                        parameters: [
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id"),
                                name: "expected-parameter-name",
                                value: "expected-parameter-value",
                                price: 100,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj.getParameterValues()).toEqual({
                "expected-parameter-id": "expected-parameter-value",
            });
        });

        it("should return parameter values with single parameter with boolean value", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [
                    ConfigurationParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                        name: "expected-parameter-group-name",
                        subTotal: 100,
                        parameters: [
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id"),
                                name: "expected-parameter-name",
                                value: true,
                                price: 100,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj.getParameterValues()).toEqual({
                "expected-parameter-id": "true",
            });
        });

        it("should return parameter values with single parameter with discrete value", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [
                    ConfigurationParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                        name: "expected-parameter-group-name",
                        subTotal: 100,
                        parameters: [
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id"),
                                name: "expected-parameter-name",
                                value: "expected-parameter-value",
                                price: 100,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj.getParameterValues()).toEqual({
                "expected-parameter-id": "expected-parameter-value",
            });
        });

        it("should return parameter values with single parameter with range value", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [
                    ConfigurationParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                        name: "expected-parameter-group-name",
                        subTotal: 100,
                        parameters: [
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id"),
                                name: "expected-parameter-name",
                                value: 5,
                                price: 100,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj.getParameterValues()).toEqual({
                "expected-parameter-id": "5",
            });
        });
    });

    describe("getParameterNamesAndValues", () => {
        it("should return parameter names and values with no parameters", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [],
            });

            expect(testObj.getParameterNamesAndValues()).toEqual({});
        });

        it("should return parameter names and values with parameters", () => {
            const testObj = new ServiceConfigurationEntity({
                id: ServiceConfiguration.Id("expected-id"),
                serviceId: ConfigurableService.Id("expected-service-id"),
                serviceName: "expected-service-name",
                parameterGroups: [
                    ConfigurationParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                        name: "expected-parameter-group-name",
                        subTotal: 100,
                        parameters: [
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id0"),
                                name: "expected-parameter-name0",
                                value: "expected-parameter-value0",
                                price: 100,
                            }),
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id1"),
                                name: "expected-parameter-name1",
                                value: "expected-parameter-value1",
                                price: 100,
                            }),
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id2"),
                                name: "expected-parameter-name2",
                                value: "expected-parameter-value2",
                                price: 100,
                            }),
                            ConfigurationParameterValueEntity.create({
                                id: ServiceParameter.Id("expected-parameter-id3"),
                                name: "expected-parameter-name3",
                                value: "expected-parameter-value3",
                                price: 100,
                            }),
                        ],
                    }),
                ],
            });

            expect(testObj.getParameterNamesAndValues()).toEqual({
                "expected-parameter-name0": "expected-parameter-value0",
                "expected-parameter-name1": "expected-parameter-value1",
                "expected-parameter-name2": "expected-parameter-value2",
                "expected-parameter-name3": "expected-parameter-value3",
            });
        });
    });

    it("should return remarks if present", () => {
        const testObj = new ServiceConfigurationEntity({
            id: ServiceConfiguration.Id("expected-id"),
            serviceId: ConfigurableService.Id("expected-service-id"),
            serviceName: "expected-service-name",
            parameterGroups: [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("expected-parameter-group-id"),
                    name: "expected-parameter-group-name",
                    subTotal: 100,
                    parameters: [
                        ConfigurationParameterValueEntity.create({
                            id: ServiceParameter.Id("expected-parameter-id0"),
                            name: "expected-parameter-name0",
                            value: "expected-parameter-value0",
                            price: 100,
                        }),
                        ConfigurationParameterValueEntity.create({
                            id: ServiceParameter.Id("expected-parameter-id1"),
                            name: "expected-parameter-name1",
                            value: "expected-parameter-value1",
                            price: 100,
                        }),
                        ConfigurationParameterValueEntity.create({
                            id: ServiceParameter.Id("expected-parameter-id2"),
                            name: "expected-parameter-name2",
                            value: "expected-parameter-value2",
                            price: 100,
                        }),
                        ConfigurationParameterValueEntity.create({
                            id: ServiceParameter.Id("expected-parameter-id3"),
                            name: "expected-parameter-name3",
                            value: "expected-parameter-value3",
                            price: 100,
                        }),
                    ],
                }),
            ],
            remarks: "expected-remarks",
        });

        expect(testObj.getParameterNamesAndValues()).toEqual({
            "expected-parameter-name0": "expected-parameter-value0",
            "expected-parameter-name1": "expected-parameter-value1",
            "expected-parameter-name2": "expected-parameter-value2",
            "expected-parameter-name3": "expected-parameter-value3",
            Kommentar: "expected-remarks",
        });
    });
});
