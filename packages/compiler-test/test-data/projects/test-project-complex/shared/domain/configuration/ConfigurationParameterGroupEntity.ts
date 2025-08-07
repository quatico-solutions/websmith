import { type ConfigurationParameterGroup, type ServiceParameter } from "../api";
import { Entity } from "../base";
import { ConfigurationParameterValueEntity } from "./ConfigurationParameterValueEntity";

export class ConfigurationParameterGroupEntity extends Entity<ConfigurationParameterGroup> implements ConfigurationParameterGroup {
    readonly name: string;
    readonly description?: string;
    readonly subTotal: number;
    readonly parameters: ConfigurationParameterValueEntity[];

    constructor(props: ConfigurationParameterGroup) {
        super(props.id);
        this.name = props.name;
        this.description = props.description;
        this.subTotal = props.subTotal;
        this.parameters = props.parameters.map(it => ConfigurationParameterValueEntity.create(it));
    }

    getName(): string {
        return this.name;
    }

    getSubTotal(): number {
        return this.subTotal;
    }

    getParameter(parameterId: ServiceParameter.Id): ConfigurationParameterValueEntity | undefined {
        return this.parameters.find(it => it.id === parameterId);
    }

    getParameters(): ConfigurationParameterValueEntity[] {
        return this.parameters;
    }

    static create(props: ConfigurationParameterGroup): ConfigurationParameterGroupEntity {
        if (props.name === undefined || props.name.trim() === "") {
            throw new Error("ConfigurationParameterGroup: Name is required.");
        }

        return new ConfigurationParameterGroupEntity(props);
    }
}
