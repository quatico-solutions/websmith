import { type Context, type Serialization } from "../../magellan-shared";
import { type BoundParameterValue, type ConfigurableService, OrderEntity, type ServiceConfiguration } from "../../shared";

type GenerateNewOrderInput = {
    serviceId: ConfigurableService.Id;
    selectedParameterValues: BoundParameterValue[];
    remarks?: string;
    attachments?: ServiceConfiguration.Attachment[];
};

/**
 * Generates a new order from a configuration key and selected parameter values.
 *
 * @param input - The input object containing the configuration key and selected parameter values.
 * @returns The generated order entity.
 */
// @service({"namespace":"cds-cpq-no-auth"})
export const generateNewOrder = async (input: GenerateNewOrderInput, _context?: Context, _serialization?: Serialization): Promise<OrderEntity> => {
    const { serviceId, selectedParameterValues, remarks, attachments } = input;
    return await OrderEntity.getOrCreateOrder(serviceId, selectedParameterValues, remarks, attachments);
};
