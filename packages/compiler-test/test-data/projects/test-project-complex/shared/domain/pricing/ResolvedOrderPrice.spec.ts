import { ConfigurableService, ServiceConfiguration, ServiceParameterGroup } from "../api";
import { ConfigurationParameterGroupEntity, ServiceConfigurationEntity } from "../configuration";
import { ResolvedOrderPrice } from "./ResolvedOrderPrice";

describe("s", () => {
    describe("constructor", () => {
        it("should yield quote price with quote id, total and empty service configuration prices", () => {
            const testObj = new ResolvedOrderPrice(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("666"),
                                name: "whatever",
                                subTotal: 10,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getSubTotal()).toEqual(10);
        });
    });

    describe("create", () => {
        it("should create a new quote price", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("666"),
                                name: "whatever",
                                subTotal: 10,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getSubTotal()).toEqual(10);
        });
    });

    describe("getSubTotal", () => {
        it("should return sum of all service configuration prices", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("11"),
                                name: "one",
                                subTotal: 10,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("2"),
                                name: "two",
                                subTotal: 11.2,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("3"),
                                name: "three",
                                subTotal: 13.3,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getSubTotal()).toEqual(34.5);
        });
    });

    describe("getPercentageOfSubtotal", () => {
        it("should return expected percentage of subtotal for positive value", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("1"),
                                name: "one",
                                subTotal: 50,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("2"),
                                name: "two",
                                subTotal: 22.5,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("3"),
                                name: "three",
                                subTotal: 27.5,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getPercentageOfSubtotal(89.7)).toEqual(89.7);
        });
        it("should return expected percentage of subtotal for negative value", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("1"),
                                name: "one",
                                subTotal: 50,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("2"),
                                name: "two",
                                subTotal: 22.5,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("3"),
                                name: "three",
                                subTotal: 27.5,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getPercentageOfSubtotal(-13.3)).toEqual(-13.3);
        });
    });

    describe("getTotal", () => {
        it("should return expected total for positive vat value", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("1"),
                                name: "one",
                                subTotal: 50,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("2"),
                                name: "two",
                                subTotal: 22.5,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("3"),
                                name: "three",
                                subTotal: 27.5,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getTotal(13.3)).toEqual(113.3);
        });
        it("should return expected total for negative vat value", () => {
            const testObj = ResolvedOrderPrice.create(
                {
                    subTotal: 10,
                },
                [
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("1"),
                                name: "one",
                                subTotal: 50,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("2"),
                                name: "two",
                                subTotal: 22.5,
                                parameters: [],
                            }),
                        ],
                    }),
                    ServiceConfigurationEntity.create({
                        id: ServiceConfiguration.Id("666"),
                        serviceId: ConfigurableService.Id("666"),
                        serviceName: "whatever",
                        parameterGroups: [
                            ConfigurationParameterGroupEntity.create({
                                id: ServiceParameterGroup.Id("3"),
                                name: "three",
                                subTotal: 27.5,
                                parameters: [],
                            }),
                        ],
                    }),
                ]
            );

            expect(testObj.getTotal(-11.1)).toEqual(88.9);
        });
    });
});
