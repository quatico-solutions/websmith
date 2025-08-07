import { Entity } from "./Entity";

/**
 * Base class for all aggregate roots in the domain.
 * An aggregate root is a cluster of domain objects that can be treated as a single unit
 * with regard to data changes. It maintains consistency boundaries and version control.
 *
 * @template T The type of the aggregate root
 */
export abstract class AggregateRoot<T> extends Entity<T> {
    // TODO: Provide API for version updates iff aggregate state is changed
    private version: number = 0;

    /**
     * Creates a new aggregate root with the given ID.
     *
     * @param id The unique identifier for this aggregate root
     */
    constructor(id: string) {
        super(id);
    }

    /**
     * Increments the version number of this aggregate root.
     * This method should be called whenever the aggregate root's state changes.
     *
     * @returns The incremented version number
     */
    protected incrementVersion(): number {
        return ++this.version;
    }

    /**
     * Gets the current version number of this aggregate root.
     * The version number is used for optimistic concurrency control.
     *
     * @returns The current version number
     */
    getVersion(): number {
        return this.version;
    }
}
