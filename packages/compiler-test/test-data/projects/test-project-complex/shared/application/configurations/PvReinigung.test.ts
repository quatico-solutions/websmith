import { ConfigurableServiceEntity } from "../../domain";
import { type ConfigurableService, ServiceParameter } from "../../domain/api";
import pvReinigung from "./pv-anlagenreinigung/config.json";

describe("PvReinigung", () => {
    it("should not throw when parsing configuration", () => {
        expect(() =>
            ConfigurableServiceEntity.create(pvReinigung as unknown as ConfigurableService)
        ).not.toThrow();
    });

    it("should calculate price for a quote", () => {
        const testObj = ConfigurableServiceEntity.create(pvReinigung as unknown as ConfigurableService);

        const groesse = testObj
            .getParameterValue<number>(ServiceParameter.Id("anlagen-groesse"))!
            .setValue(100);

        const dachtyp = testObj.getParameterValue(ServiceParameter.Id("dachtyp"))!.setValue("steildach");

        const absturzsicherung = testObj
            .getParameterValue(ServiceParameter.Id("absturzsicherung"))!
            .setValue("seil");

        const actual = testObj.calculatePrice([groesse, dachtyp, absturzsicherung]);

        expect(actual.getSubTotal()).toBe(1765);
    });
});
