import { ConfigurableServiceEntity } from "../../domain";
import { type ConfigurableService, ServiceParameter } from "../../domain/api";
import carCleaning from "./car-cleaning/config.json";

describe("CarCleaning", () => {
    it("should not throw when parsing configuration", () => {
        expect(() =>
            ConfigurableServiceEntity.create(carCleaning as unknown as ConfigurableService)
        ).not.toThrow();
    });

    it("should calculate price for a quote", () => {
        const testObj = ConfigurableServiceEntity.create(carCleaning as unknown as ConfigurableService);

        const carType = testObj.getParameterValue(ServiceParameter.Id("car-type"))!.setValue("sedan");

        const brand = testObj.getParameterValue(ServiceParameter.Id("brand"))!.setValue("bmw");

        const actual = testObj.calculatePrice([carType, brand]);

        expect(actual.getSubTotal()).toBe(480);
    });
});
