import { ConfigurableServiceEntity } from "../../domain";
import { type ConfigurableService, ServiceParameter } from "../../domain/api";
import fensterreinigung from "./fensterreinigung/config.json";

describe("Fensterreinigung", () => {
    it("should not throw when parsing configuration", () => {
        expect(() =>
            ConfigurableServiceEntity.create(fensterreinigung as unknown as ConfigurableService)
        ).not.toThrow();
    });

    it("should calculate price for a quote with fensterflaeche, lamellenstoren, zugang", () => {
        const testObj = ConfigurableServiceEntity.create(fensterreinigung as unknown as ConfigurableService);

        const fensterflaeche = testObj
            .getParameterValue<number>(ServiceParameter.Id("fenster-flaeche"))!
            .setValue(20);

        const lamellenstoren = testObj
            .getParameterValue<boolean>(ServiceParameter.Id("option-lamellenstoren"))!
            .setValue(true);

        const zugang = testObj.getParameterValue(ServiceParameter.Id("zugang"))!.setValue("leiter");

        const actual = testObj.calculatePrice([fensterflaeche, lamellenstoren, zugang]);

        expect(actual.getSubTotal()).toBe(439);
    });

    it("should calculate price for a quote without cleaning lamellenstoren", () => {
        const testObj = ConfigurableServiceEntity.create(fensterreinigung as unknown as ConfigurableService);

        const fensterflaeche = testObj
            .getParameterValue<number>(ServiceParameter.Id("fenster-flaeche"))!
            .setValue(20);

        const lamellenstoren = testObj
            .getParameterValue<boolean>(ServiceParameter.Id("option-lamellenstoren"))!
            .setValue(false);

        const zugang = testObj.getParameterValue(ServiceParameter.Id("zugang"))!.setValue("leiter");

        const actual = testObj.calculatePrice([fensterflaeche, lamellenstoren, zugang]);

        expect(actual.getSubTotal()).toBe(340);
    });
});
