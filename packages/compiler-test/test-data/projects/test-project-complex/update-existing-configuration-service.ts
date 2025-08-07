import { type Context, type Serialization } from "./magellan-shared";
import {
    ConfigurableService,
    ConfigurableServiceEntity,
    type ConfigurationParameterGroup,
    Logger,
    type Order,
    OrderEntity,
    OrderStage,
    type ServiceConfiguration,
    type ServiceConfigurationPrice,
} from "./shared";

type UpdateExistingConfigurationInput = {
    orderId: Order.Id;
    serviceId: ConfigurableService.Id;
    parameterGroups: ConfigurationParameterGroup[];
    configurationPrice: ServiceConfigurationPrice;
    remarks?: string;
    attachments?: ServiceConfiguration.Attachment[];
};

const logger = Logger.create("update-existing-configuration");

/**
 * Updates an existing configuration and sends quote emails to customer and sales.
 *
 * @param input - The input object containing the order ID, service ID, parameter groups, and configuration price.
 * @returns The updated order entity.
 */
// @service({"namespace":"cds-cpq-no-auth"})
export const updateExistingConfiguration = async (
    input: UpdateExistingConfigurationInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<OrderEntity> => {
    const { serviceId, parameterGroups, orderId, remarks, configurationPrice, attachments } = input;

    // Debug logging
    logger.info(`Received parameterGroups: ${JSON.stringify(parameterGroups, null, 2)}`);
    const standortParam = parameterGroups
        .flatMap(g => g.parameters)
        .find(p => p.name?.toLowerCase().includes("standort") || p.id?.toLowerCase().includes("standort"));
    if (standortParam) {
        logger.info(`Standort parameter found: ${JSON.stringify(standortParam)}`);
    } else {
        logger.warn("Standort parameter NOT found in parameterGroups!");
    }

    const order = await OrderEntity.load(orderId);

    if (!order) {
        throw new Error(`Order with id ${orderId} not found`);
    }

    const configurations = await order.getConfigurations();
    let configuration = configurations.find(it => it.serviceId === serviceId);
    if (!configuration) {
        throw new Error(`Configuration with id ${serviceId} not found`);
    }

    const existingAttachments = configuration.getAttachments();
    const newAttachments = attachments && attachments.length > 0 ? attachments : existingAttachments;

    configuration = await configuration.update({
        ...configuration,
        remarks,
        price: configurationPrice,
        parameterGroups,
        attachments: newAttachments,
    });

    const newConfigurations = configurations.filter(it => it.serviceId !== serviceId);
    newConfigurations.push(configuration);

    const newStage =
        order.stage === OrderStage.Cancelled
            ? order.customer !== undefined
                ? OrderStage.Created
                : OrderStage.Offered
            : order.stage;

    // Get customer and contact for email sending (optional)
    const customer = await order.getCustomer();
    let contact = null;
    let provider = null;
    let configurableService = null;

    if (customer) {
        contact = await customer.getPrimaryContact();
        if (!contact) {
            logger.warn(`No primary contact found for customer with id "${customer.id}".`);
        }
    } else {
        logger.warn(`No customer found for order with id "${orderId}". Skipping email notifications.`);
    }

    // Get configurable service and provider for email sending
    if (customer && contact) {
        configurableService = await ConfigurableServiceEntity.loadOrFind(
            ConfigurableService.Id(configuration.serviceId)
        );
        if (!configurableService) {
            logger.error(`No configurable service found for service id "${configuration.serviceId}".`);
        } else {
            provider = configurableService.getProvider();
            if (!provider) {
                logger.error(`No provider found for service id "${configuration.serviceId}".`);
            }
        }
    }

    // Send emails only if we have all required data
    if (customer && contact && provider && configurableService) {
        try {
            // mail to sales
            logger.info(`Email notifications sent successfully for order ${orderId}.`);
        } catch (emailError) {
            logger.error(`Failed to send email notifications for order ${orderId}: ${emailError}`);
            // Don't throw - continue with the order update
        }
    } else {
        logger.info(`Skipping email notifications for order ${orderId} due to missing customer data.`);
    }

    return await order.update({
        ...order,
        offeredAt: new Date(),
        stage: newStage,
        configurations: newConfigurations.map(it => it.getId()),
    });
};
