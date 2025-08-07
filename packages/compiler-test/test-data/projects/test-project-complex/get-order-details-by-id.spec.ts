import { Customer, Order, OrderEntity, OrderStage, ServiceConfiguration } from "./shared";
import { getOrderDetailsById } from "./get-order-details-by-id";

describe("getOrderDetailsById", () => {
    it("should return a order details by id", async () => {
        const mockOrder = OrderEntity.create({
            id: Order.Id("123"),
            number: Order.Number("100001"),
            stage: OrderStage.Draft,
            configurations: [ServiceConfiguration.Id("123")],
            price: {
                subTotal: 100,
            },
            customer: Customer.Id("CUST-1"),
        });

        jest.spyOn(OrderEntity, "load").mockResolvedValue(mockOrder);

        // Mock the getConfigurations method
        jest.spyOn(mockOrder, "getConfigurations").mockResolvedValue([]);

        // Mock the getCustomer method
        jest.spyOn(mockOrder, "getCustomer").mockResolvedValue(undefined);

        const actual = await getOrderDetailsById({ orderId: Order.Id("123") });

        expect(actual).toEqual({
            order: expect.objectContaining({
                id: "123",
                number: "100001",
                stage: "offen",
                configurations: ["123"],
                price: { subTotal: 100 },
                customer: "CUST-1",
            }),
            configurations: [],
        });
    });

    it("should throw an error with non-existing OrderId", async () => {
        jest.spyOn(OrderEntity, "load").mockResolvedValue(undefined);

        await expect(getOrderDetailsById({ orderId: Order.Id("invalid") })).rejects.toThrow(
            'getOrderDetailsById failed: Order with id "invalid" not found.'
        );
    });
});
