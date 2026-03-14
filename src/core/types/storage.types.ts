import type { Session } from './session.types';
import type { Settings } from './settings.types';

export interface StorageMetadata {
  version: string;
  lastAutoSave: string | null;
  storageUsedBytes: number;
}

export interface StorageSchema {
  sessions: Record<string, Session>;
  settings: Settings;
  metadata: StorageMetadata;
}

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  METADATA: 'metadata',
} as const;

export const CURRENT_SCHEMA_VERSION = '1.0.0';
