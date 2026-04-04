import type { IStorage } from './storage.interface';
import type { Session } from '@core/types/session.types';
import type { IIndexedRepository, IBulkRepository } from './repository';
import { ChromeStorageAdapter } from './chrome-storage';
import { IndexedDBRepository } from './indexeddb-repository';

let _settingsStorage: IStorage | null = null;
let _sessionRepository: (IIndexedRepository<Session> & IBulkRepository<Session>) | null = null;

export function getSettingsStorage(): IStorage {
  if (!_settingsStorage) {
    _settingsStorage = new ChromeStorageAdapter();
  }
  return _settingsStorage;
}

export function getSessionRepository(): IIndexedRepository<Session> & IBulkRepository<Session> {
  if (!_sessionRepository) {
    _sessionRepository = new IndexedDBRepository<Session>({
      dbName: 'browser-hub',
      dbVersion: 2,
      storeName: 'sessions',
      outOfLineKeys: true,
      onUpgrade: (db, oldVersion, tx) => {
        if (oldVersion < 1) {
          const store = db.createObjectStore('sessions');
          store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        } else if (oldVersion < 2) {
          const store = tx.objectStore('sessions');
          if (!store.indexNames.contains('isAutoSave')) {
            store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
          }
          if (!store.indexNames.contains('createdAt')) {
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        }
      },
    });
  }
  return _sessionRepository;
}
