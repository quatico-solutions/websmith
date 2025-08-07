import { ConfigurableService, Order, OrderEntity, OrderStage, ServiceParameter } from "../../shared";
import { generateNewOrder } from "./generate-new-order-service";

describe("generateNewOrder", () => {
    it("should call OrderEntity.getOrCreateOrder", async () => {
        jest.spyOn(OrderEntity, "getOrCreateOrder").mockResolvedValue(
            OrderEntity.create({
                id: Order.Id("1"),
                number: Order.Number("100001"),
                stage: OrderStage.Draft,
                configurations: [],
                price: {
                    subTotal: 100,
                },
            })
        );

        await generateNewOrder({
            serviceId: ConfigurableService.Id("1"),
            selectedParameterValues: [
                {
                    parameterId: ServiceParameter.Id("1"),
                    value: "1",
                    kind: "discrete",
                },
            ],
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(OrderEntity.getOrCreateOrder).toHaveBeenCalledWith(
            ConfigurableService.Id("1"),
            [
                {
                    parameterId: ServiceParameter.Id("1"),
                    value: "1",
                    kind: "discrete",
                },
            ],
            undefined,
            undefined
        );
    });
});
