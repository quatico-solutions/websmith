import { ServiceParameter, ServiceParameterGroup } from "../api";
import { ConfigurationParameterGroupEntity } from "../configuration";
import { ResolvedServiceConfigurationPrice } from "./ResolvedServiceConfigurationPrice";

describe("ResolvedServiceConfigurationPrice", () => {
    describe("constructor", () => {
        it("should yield service configuration price with service configuration id, total and breakdown", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    parameters: [
                        {
                            id: ServiceParameter.Id("123"),
                            name: "parameter 1",
                            value: "123",
                            price: 10,
                        },
                    ],
                    subTotal: 10,
                }),
            ]);

            expect(testObj.getSubTotal()).toEqual(10);
            expect(testObj.getGroups()).toEqual([
                {
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    parameters: [
                        {
                            id: ServiceParameter.Id("123"),
                            name: "parameter 1",
                            value: "123",
                            price: 10,
                        },
                    ],
                    subTotal: 10,
                },
            ]);
        });
    });

    describe("getSubTotal", () => {
        it("should return sub total price with single group", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10,
                    parameters: [],
                }),
            ]);

            expect(testObj.getSubTotal()).toEqual(10);
        });

        it("should return sub total price with multiple groups", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10,
                    parameters: [],
                }),
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("456"),
                    name: "group 2",
                    subTotal: 20,
                    parameters: [],
                }),
            ]);

            expect(testObj.getSubTotal()).toEqual(30);
        });
    });

    describe("getSubTotalRounded", () => {
        it("should return sub total price rounding down correctly", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10.004,
                    parameters: [],
                }),
            ]);

            expect(testObj.getSubTotalRounded()).toEqual(10.0);
        });

        it("should return sub total price rounding up correctly", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10.005,
                    parameters: [],
                }),
            ]);

            expect(testObj.getSubTotalRounded()).toEqual(10.01);
        });
    });

    describe("getTotal", () => {
        it("should return total price with single group including vat", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10,
                    parameters: [],
                }),
            ]);

            expect(testObj.getTotal(10)).toEqual(11);
        });

        it("should return total price with multiple groups including vat", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10,
                    parameters: [],
                }),
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("456"),
                    name: "group 2",
                    subTotal: 20,
                    parameters: [],
                }),
            ]);

            expect(testObj.getTotal(10)).toEqual(33);
        });
    });

    describe("getTotalRounded", () => {
        it("should return total price rounding down correctly", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10.004,
                    parameters: [],
                }),
            ]);

            expect(testObj.getTotalRounded(0)).toEqual(10.0);
        });

        it("should return total price rounding up correctly", () => {
            const testObj = new ResolvedServiceConfigurationPrice({}, [
                ConfigurationParameterGroupEntity.create({
                    id: ServiceParameterGroup.Id("123"),
                    name: "group 1",
                    subTotal: 10.005,
                    parameters: [],
                }),
            ]);

            expect(testObj.getTotalRounded(0)).toEqual(10.01);
        });
    });
});
