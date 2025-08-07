/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A constructor for a value object.
 */
export type ValueObjectConstructor<T = any> = new (...args: any[]) => T;

/**
 * A mixin for a value object.
 */
export function ValueObjectMixin<T extends ValueObjectConstructor>(Base: T) {
    /**
     * A class that extends the base class and implements the value object pattern.
     */
    abstract class ValueObjectClass extends Base {
        /**
         * Checks if this value object is equal to another value object.
         *
         * @param other The other value object to compare with.
         * @returns True if the value objects are equal, false otherwise.
         */
        equals(other: unknown): boolean {
            if (!other) {
                return false;
            }

            if (!(other instanceof this.constructor)) {
                return false;
            }

            // Compare all properties for equality
            const keys = Object.keys(this);
            for (const key of keys) {
                const thisValue = this[key as keyof typeof this];
                const otherValue = other[key as keyof typeof other];
                if (isObject(thisValue)) {
                    return false;
                } else if (typeof thisValue === "function" || typeof otherValue === "function") {
                    if (thisValue !== undefined ? otherValue === undefined : thisValue !== otherValue) {
                        return false;
                    }
                } else if (thisValue !== otherValue) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Clones the value object.
         *
         * @returns A new value object with the same properties.
         */
        clone(): this {
            return new (this.constructor as new (...args: any[]) => this)(this);
        }

        /**
         * Converts the value object to a string.
         *
         * @returns A string representation of the value object.
         */
        toString(): string {
            return JSON.stringify(this);
        }
    }
    return ValueObjectClass;
}

export const ValueObject = ValueObjectMixin;

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};
