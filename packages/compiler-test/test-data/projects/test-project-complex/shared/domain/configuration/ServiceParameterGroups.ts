import { type ServiceParameter, type ServiceParameterGroup } from "../api";
import { type ResolvedParameterValue } from "../parameter-values";
import { type ResolvedParameterPrice } from "../pricing";
import { type ServiceParameterEntity } from "./ServiceParameterEntity";
import { type ServiceParameterGroupEntity } from "./ServiceParameterGroupEntity";

/**
 * A collection of parameter groups. This class is used to manage the parameter
 * groups of a configurable service.
 *
 * @see ServiceParameterGroupEntity
 */
export class ServiceParameterGroups extends Array<ServiceParameterGroupEntity> {
    constructor(parameterGroups?: ServiceParameterGroupEntity[]) {
        super();
        if (parameterGroups) {
            this.addItems(parameterGroups);
        }
    }

    /**
     * Gets a parameter group by its ID.
     *
     * @param id The ID of the parameter group to get
     * @returns The parameter group with the specified ID, or undefined if it doesn't exist
     */
    getGroup(id: ServiceParameterGroup.Id): ServiceParameterGroupEntity | undefined {
        return this.find(it => it.getId() === id);
    }

    /**
     * Adds a parameter group to the list.
     *
     * @param group The parameter group to add
     */
    addGroup(group: ServiceParameterGroupEntity): void {
        this.push(group);
    }

    /**
     * Gets the parameter groups for this configurable service.
     *
     * @returns The parameter groups for this configurable service
     */
    getParameter(
        id: ServiceParameter.Id,
        groupId?: ServiceParameterGroup.Id
    ): ServiceParameterEntity | undefined {
        if (groupId) {
            return this.find(it => it.getId() === groupId)
                ?.getParameters()
                .find(it => it.getId() === id);
        }
        return this.flatMap(it => it.getParameters()).find(it => it.getId() === id);
    }

    /**
     * Gets the parameters for this configurable service.
     *
     * @returns The parameters for this configurable service
     */
    getParameters(): ServiceParameterEntity[] {
        return this.flatMap(it => it.getParameters());
    }

    /**
     * Gets the parameters for this configurable service.
     *
     * @returns The parameters for this configurable service
     */
    getParameterValue<VALUE = string>(
        parameterId: ServiceParameter.Id,
        groupId?: ServiceParameterGroup.Id
    ): ResolvedParameterValue<VALUE> | undefined {
        return this.getParameter(parameterId, groupId)?.getParameterValue<VALUE>();
    }

    /**
     * Gets the parameters for this configurable service.
     *
     * @returns The parameters for this configurable service
     */
    getParameterValues(): ResolvedParameterValue[] {
        return this.getParameters().map(cur => cur.getParameterValue());
    }

    /**
     * Gets the price for a parameter.
     *
     * @param parameterId The ID of the parameter to get the price for
     * @param groupId The ID of the group to get the price for
     * @returns The price for the parameter, or undefined if it doesn't exist
     */
    getParameterPrice(
        parameterId: ServiceParameter.Id,
        groupId?: ServiceParameterGroup.Id
    ): ResolvedParameterPrice | undefined {
        return this.getParameter(parameterId, groupId)?.getParameterValue()?.getPrice();
    }

    /**
     * Gets the prices for all parameters.
     *
     * @returns The prices for all parameters
     */
    getParameterPrices(): ResolvedParameterPrice[] {
        return this.getParameterValues()
            .map(cur => cur.getPrice())
            .filter(price => price !== undefined);
    }

    /**
     * Serializes the parameter groups.
     *
     * @param items The items to serialize
     */
    serialize(items: ServiceParameterGroupEntity[]): void {
        this.splice(0, this.length);
        this.addItems(items);
    }

    private addItems(items: ServiceParameterGroupEntity[]) {
        if (items && Array.isArray(items)) {
            items.forEach(item => this.push(item));
        }
    }
}
