/**
 * Base class for all entities in the domain.
 * Entities are objects that have a distinct identity that runs through time and
 * different states. They are defined by their identity rather than their attributes.
 *
 * @template T The type of the entity
 */
export abstract class Entity<T> {
    readonly id: string;

    /**
     * Creates a new entity with the given ID.
     *
     * @param id The unique identifier for this entity
     */
    constructor(id: string) {
        this.id = id;
    }

    /**
     * Compares this entity with another entity for equality.
     * Entities are considered equal if they have the same ID.
     *
     * @param other The other entity to compare with
     * @returns true if the entities have the same ID, false otherwise
     */
    equals(other: Entity<T>): boolean {
        return this.id === other.id;
    }

    /**
     * Gets the unique identifier of this entity.
     *
     * @returns The entity's ID
     */
    getId(): string {
        return this.id;
    }
}
