/**
 * base.types.ts — Shared foundation types for all persistable entities.
 *
 * These interfaces establish a common contract across modules so that
 * repositories, sync adapters, and services can operate generically.
 */

// ─── Entity bases ────────────────────────────────────────────────────────────

/** Common fields shared by all persistable entities. */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string; // ISO 8601
}

/** Entities that track mutation timestamps. */
export interface MutableEntity extends BaseEntity {
  updatedAt: string; // ISO 8601
}

// ─── Sync contract ───────────────────────────────────────────────────────────

/**
 * Marker interface for entities that can be synced to Supabase.
 * The `toRow` / `fromRow` methods live on the RowMapper, not the entity,
 * to keep domain types free of infrastructure concerns.
 */
export interface Syncable extends BaseEntity {}

/**
 * Bidirectional mapper between a local camelCase entity and a Supabase
 * snake_case row. One mapper instance per entity type.
 */
export interface RowMapper<T extends Syncable> {
  /** Convert a local entity to a Supabase row object. */
  toRow(entity: T, userId: string): Record<string, unknown>;
  /** Convert a Supabase row object back to a local entity. */
  fromRow(row: Record<string, unknown>): T;
}
