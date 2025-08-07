import { type ConfigurationParameterValue } from "../api";
import { Entity } from "../base";

export class ConfigurationParameterValueEntity<VALUE = unknown>
    extends Entity<ConfigurationParameterValue<VALUE>>
    implements ConfigurationParameterValue<VALUE>
{
    readonly name: string;
    readonly value: VALUE;
    readonly price: number;
    readonly description?: string;

    constructor(props: ConfigurationParameterValue<VALUE>) {
        super(props.id);
        this.value = props.value;
        this.price = props.price;
        this.name = props.name;
        this.description = props.description;
    }

    getName(): string {
        return this.name;
    }

    getPrice(): number {
        return this.price;
    }

    getValue(): VALUE {
        return this.value;
    }

    getDescription(): string | undefined {
        return this.description;
    }

    static create<VALUE = unknown>(value: ConfigurationParameterValue<VALUE>): ConfigurationParameterValueEntity<VALUE> {
        if (value.name === undefined || value.name.trim() === "") {
            throw new Error("ConfigurationParameterValue: Name is required.");
        }

        if (value.value === undefined || value.value === null) {
            throw new Error("ConfigurationParameterValue: Value is required.");
        }

        if (value.price === undefined) {
            throw new Error("ConfigurationParameterValue: Price is required.");
        }

        return new ConfigurationParameterValueEntity(value);
    }
}
