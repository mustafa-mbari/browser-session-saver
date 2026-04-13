/**
 * session.handler.ts — SyncEngine handler for Sessions.
 *
 * Wraps the existing sessionMapper and points at the singleton session
 * repository. The URL-filter pre-transform is applied so excluded URLs
 * (chrome://, extension://) are stripped before the row is pushed.
 */

import type { Session } from '@core/types/session.types';
import type { EntitySyncHandler, HandlerRepository } from './types';
import type { SyncableEntity } from '../types/syncable';

import { sessionMapper } from '@core/services/sync/row-mappers';
import { wrapMapper } from './wrap-mapper';
import { isExcludedUrl } from '@core/services/sync/url-filter';
import { getSessionRepository } from '@core/storage/storage-factory';

const mapped = wrapMapper(sessionMapper as Parameters<typeof wrapMapper>[0]);

export function createSessionHandler(): EntitySyncHandler<Session & SyncableEntity> {
  return {
    key: 'sessions',
    tableName: 'sessions',
    repo: getSessionRepository() as unknown as HandlerRepository<Session & SyncableEntity>,
    toRemote: mapped.toRemote,
    fromRemote: mapped.fromRemote as (row: Record<string, unknown>) => Session & SyncableEntity,
    preTransform(session) {
      return {
        ...session,
        tabs: session.tabs.filter((t) => !isExcludedUrl(t.url)),
      };
    },
  };
}
