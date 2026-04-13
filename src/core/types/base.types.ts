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
 * Canonical base for entities that participate in the cloud sync engine.
 *
 * All fields except `updatedAt` (inherited from MutableEntity) are optional
 * so existing entity constructors keep compiling. The sync engine and
 * repository layer stamp defaults on write:
 *   - `deletedAt`    → null (alive)
 *   - `dirty`        → false (clean; set true when mutated)
 *   - `lastSyncedAt` → null (never synced)
 *
 * Reads should treat missing fields as their defaults via `?? null` / `?? false`.
 */
export interface SyncableEntity extends MutableEntity {
  /** ISO 8601 timestamp when soft-deleted, or null if alive. */
  deletedAt?: string | null;
  /** Local flag: true when this record has unpushed changes. */
  dirty?: boolean;
  /** ISO 8601 timestamp of the last successful sync round-trip. */
  lastSyncedAt?: string | null;
}

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
