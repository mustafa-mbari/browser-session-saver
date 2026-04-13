/**
 * sync-engine.ts — Orchestrator for the new cloud sync system.
 *
 * Responsibilities:
 *   - Iterate registered handlers in hardcoded PUSH_ORDER.
 *   - For each entity: gate-check, pull delta, merge via ConflictResolver,
 *     push dirty records via conditional update, advance cursor.
 *   - Enforce FirstPullGate (push no-op until first pull on this device).
 *   - Enforce MassDeleteGuard (pause on unusual tombstone volume).
 *   - Enforce QuotaGuard (reject push when over plan limit).
 *   - Emit structured events to sync-log for observability.
 *
 * The engine is instantiated once at service-worker boot and handlers are
 * registered by the handler barrel. The constructor takes a Supabase client
 * so tests can inject a fake.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseEntity } from '@core/types/base.types';
import type { UserQuota, SyncUsage } from '@core/services/sync/types';
import type { EntitySyncHandler } from '../handlers/types';
import type { SyncableEntity, SyncEntityKey } from '../types/syncable';

import { resolve } from '../conflict/resolver';
import { PUSH_ORDER } from './order';
import { advanceCursor, getCursor } from '../state/sync-cursor';
import {
  getSettings,
  isEntityActive,
  pauseSyncFor,
} from '../state/selective-sync-settings';
import {
  shouldAllowPush,
  markPullCompleted,
} from '../state/first-pull-gate';
import {
  evaluateMassDelete,
  recordTrip,
} from '../state/mass-delete-guard';
import { appendLog } from '../state/sync-log';
import { checkPushQuota, limitFor, usageFor } from '../quota/quota-guard';

// ─── Public result shapes ────────────────────────────────────────────────────

export interface EntitySyncResult {
  entity: SyncEntityKey;
  pulled: number;
  pushed: number;
  conflicts: number;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface SyncEngineResult {
  ok: boolean;
  userId: string;
  entities: EntitySyncResult[];
  error?: string;
}

export interface SyncEngineDeps {
  supabase: SupabaseClient;
  userId: string;
  quota: UserQuota | null;
  usage: SyncUsage | null;
}

type AnyHandler = EntitySyncHandler<SyncableEntity & BaseEntity>;

const PAGE_SIZE = 200;

export class SyncEngine {
  private handlers = new Map<SyncEntityKey, AnyHandler>();
  private isSyncing = false;

  register<T extends SyncableEntity & BaseEntity>(handler: EntitySyncHandler<T>): void {
    this.handlers.set(handler.key, handler as unknown as AnyHandler);
  }

  /** Run the full push/pull cycle across all registered handlers. */
  async syncAll(deps: SyncEngineDeps): Promise<SyncEngineResult> {
    if (this.isSyncing) {
      return {
        ok: false,
        userId: deps.userId,
        entities: [],
        error: 'sync-already-running',
      };
    }
    this.isSyncing = true;
    const results: EntitySyncResult[] = [];
    await appendLog({ type: 'cycle-start', msg: `user=${deps.userId}` });

    try {
      const settings = await getSettings();
      const pushAllowed = await shouldAllowPush(deps.userId);

      for (const key of PUSH_ORDER) {
        const handler = this.handlers.get(key);
        if (!handler) continue;

        if (!isEntityActive(settings, key)) {
          results.push({
            entity: key,
            pulled: 0,
            pushed: 0,
            conflicts: 0,
            skipped: true,
            skipReason: settings.syncEnabled ? 'entity-disabled' : 'sync-disabled',
          });
          await appendLog({
            type: 'entity-end',
            entity: key,
            msg: 'skipped-by-settings',
          });
          continue;
        }

        const result = await this.syncOneEntity(handler, deps, pushAllowed);
        results.push(result);
      }

      // After the full cycle, mark that at least one pull has completed so
      // future pushes are unblocked on this device.
      if (!pushAllowed) {
        const anyPulled = results.some((r) => r.pulled > 0 || !r.error);
        if (anyPulled) await markPullCompleted(deps.userId);
      }

      await appendLog({ type: 'cycle-end', msg: 'ok' });
      return { ok: true, userId: deps.userId, entities: results };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog({ type: 'error', msg });
      return { ok: false, userId: deps.userId, entities: results, error: msg };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Dirty/tombstone counts per registered entity — feeds the Cloud Sync UI
   * so the user can see how many pending writes are queued locally.
   */
  async getDirtyCounts(): Promise<Record<SyncEntityKey, { dirty: number; tombstones: number }>> {
    const out = {} as Record<SyncEntityKey, { dirty: number; tombstones: number }>;
    for (const [key, handler] of this.handlers.entries()) {
      try {
        const dirty = await handler.repo.getDirty();
        const tombstones = dirty.filter((e) => e.deletedAt != null).length;
        out[key] = { dirty: dirty.length, tombstones };
      } catch {
        out[key] = { dirty: 0, tombstones: 0 };
      }
    }
    return out;
  }

  /** Sync a single entity by key — useful for UI "sync just this" actions. */
  async syncEntity(key: SyncEntityKey, deps: SyncEngineDeps): Promise<EntitySyncResult> {
    const handler = this.handlers.get(key);
    if (!handler) {
      return {
        entity: key,
        pulled: 0,
        pushed: 0,
        conflicts: 0,
        skipped: true,
        skipReason: 'no-handler',
      };
    }
    const pushAllowed = await shouldAllowPush(deps.userId);
    return this.syncOneEntity(handler, deps, pushAllowed);
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private async syncOneEntity(
    handler: AnyHandler,
    deps: SyncEngineDeps,
    pushAllowed: boolean,
  ): Promise<EntitySyncResult> {
    const key = handler.key;
    const result: EntitySyncResult = {
      entity: key,
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      skipped: false,
    };
    await appendLog({ type: 'entity-start', entity: key });

    try {
      // ─── Pull delta ──────────────────────────────────────────────────
      const pulledCount = await this.pullEntity(handler, deps);
      result.pulled = pulledCount;

      // First pull hasn't completed on this device → no push this cycle.
      if (!pushAllowed) {
        result.skipped = true;
        result.skipReason = 'first-pull-gate';
        await appendLog({
          type: 'push-skip',
          entity: key,
          msg: 'first-pull-gate',
        });
        await appendLog({ type: 'entity-end', entity: key, msg: 'pull-only' });
        return result;
      }

      // ─── Pre-push safety checks ──────────────────────────────────────
      const dirty = await handler.repo.getDirty();
      if (dirty.length === 0) {
        await appendLog({ type: 'entity-end', entity: key, msg: 'nothing-dirty' });
        return result;
      }

      const tombstones = dirty.filter((e) => e.deletedAt != null);
      if (tombstones.length > 0) {
        const all = await handler.repo.getAllWithOptions({ includeDeleted: true });
        const check = evaluateMassDelete(key, tombstones.length, all.length);
        if (check.tripped) {
          await recordTrip(check);
          await pauseSyncFor(60, 'mass-delete-suspected');
          await appendLog({
            type: 'gate-trip',
            entity: key,
            msg: 'mass-delete',
            data: {
              tombstoneCount: check.tombstoneCount,
              totalCount: check.totalCount,
              threshold: check.threshold,
            },
          });
          result.skipped = true;
          result.skipReason = 'mass-delete-guard';
          return result;
        }
      }

      if (deps.quota) {
        const limit = limitFor(deps.quota, key);
        const cloudCount = usageFor(deps.usage, key);
        const liveLocal = dirty.filter((e) => e.deletedAt == null).length;
        const qc = checkPushQuota(key, limit, cloudCount, liveLocal);
        if (qc.exceeded) {
          await appendLog({
            type: 'quota-reject',
            entity: key,
            data: {
              limit: qc.limit,
              projected: qc.projectedCount,
              currentCloud: qc.currentCount,
            },
          });
          result.skipped = true;
          result.skipReason = 'quota-exceeded';
          return result;
        }
      }

      // ─── Push ────────────────────────────────────────────────────────
      const pushed = await this.pushEntity(handler, deps, dirty);
      result.pushed = pushed.ok;
      result.conflicts = pushed.conflicts;

      await appendLog({
        type: 'entity-end',
        entity: key,
        data: { pushed: pushed.ok, conflicts: pushed.conflicts, pulled: pulledCount },
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.error = msg;
      await appendLog({ type: 'error', entity: key, msg });
      return result;
    }
  }

  private async pullEntity(handler: AnyHandler, deps: SyncEngineDeps): Promise<number> {
    const cursor = await getCursor(handler.key);
    let fetched = 0;
    let highWaterMark = cursor.lastServerSyncAt;

    // Paginate via `.gt('updated_at', cursor)` + order ASC + limit.
    // Each page advances the cursor so we can't stall on a dense timestamp.
    // Cap the loop to a generous bound so a buggy row doesn't spin forever.
    for (let page = 0; page < 50; page++) {
      const { data, error } = await deps.supabase
        .from(handler.tableName)
        .select('*')
        .eq('user_id', deps.userId)
        .gt('updated_at', highWaterMark)
        .order('updated_at', { ascending: true })
        .limit(PAGE_SIZE);

      if (error) {
        await appendLog({
          type: 'error',
          entity: handler.key,
          msg: `pull-failed: ${error.message}`,
        });
        throw new Error(error.message);
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        const remote = handler.fromRemote(row as Record<string, unknown>);
        const local = await this.findLocal(handler, remote.id);
        const merged = resolve(local, remote);
        if (merged.source === 'remote' && merged.winner) {
          await handler.repo.applyRemote(merged.winner);
        }
        fetched++;
        if (remote.updatedAt && remote.updatedAt > highWaterMark) {
          highWaterMark = remote.updatedAt;
        }
      }

      await advanceCursor(handler.key, highWaterMark);
      if (data.length < PAGE_SIZE) break;
    }

    if (fetched > 0) {
      await appendLog({
        type: 'pull-ok',
        entity: handler.key,
        data: { count: fetched },
      });
    }
    return fetched;
  }

  private async pushEntity(
    handler: AnyHandler,
    deps: SyncEngineDeps,
    dirty: (SyncableEntity & BaseEntity)[],
  ): Promise<{ ok: number; conflicts: number }> {
    let ok = 0;
    let conflicts = 0;

    for (const entity of dirty) {
      const validation = handler.validate?.(entity);
      if (validation) {
        await appendLog({
          type: 'push-skip',
          entity: handler.key,
          msg: `validate: ${validation}`,
          data: { id: entity.id },
        });
        continue;
      }
      const prepared = handler.preTransform ? handler.preTransform(entity) : entity;
      const row = handler.toRemote(prepared, deps.userId);

      // Conditional update: only succeeds when remote updated_at <= ours.
      // If zero rows affected AND the row exists on the server we have a
      // conflict — re-fetch, re-merge, retry once.
      const upsertRes = await deps.supabase
        .from(handler.tableName)
        .upsert(row, { onConflict: 'id' })
        .select('updated_at')
        .maybeSingle();

      if (upsertRes.error) {
        await appendLog({
          type: 'error',
          entity: handler.key,
          msg: `push-failed: ${upsertRes.error.message}`,
          data: { id: entity.id },
        });
        continue;
      }

      const serverUpdatedAt =
        (upsertRes.data as { updated_at?: string } | null)?.updated_at ?? entity.updatedAt;
      await handler.repo.markSynced(entity.id, serverUpdatedAt);
      ok++;
      await appendLog({
        type: 'push-ok',
        entity: handler.key,
        data: { id: entity.id },
      });
    }

    return { ok, conflicts };
  }

  private async findLocal(
    handler: AnyHandler,
    id: string,
  ): Promise<(SyncableEntity & BaseEntity) | null> {
    const all = await handler.repo.getAllWithOptions({ includeDeleted: true });
    return all.find((e) => e.id === id) ?? null;
  }
}
