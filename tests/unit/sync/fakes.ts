import { vi } from 'vitest';

/** In-memory chrome.storage.local supporting callback and promise styles. */
export function installMemoryStorage(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));
  const done = <T>(cb: unknown, value: T) => {
    if (typeof cb === 'function') {
      (cb as (v: T) => void)(value);
      return undefined;
    }
    return Promise.resolve(value);
  };

  vi.mocked(chrome.storage.local.get).mockImplementation(((keys: unknown, cb?: unknown) => {
    const result: Record<string, unknown> = {};
    if (keys == null) Object.assign(result, clone(data));
    else if (typeof keys === 'string') { if (keys in data) result[keys] = clone(data[keys]); }
    else if (Array.isArray(keys)) { for (const k of keys) if (k in data) result[k] = clone(data[k]); }
    else for (const [k, d] of Object.entries(keys as object)) result[k] = k in data ? clone(data[k]) : d;
    return done(cb, result);
  }) as never);
  vi.mocked(chrome.storage.local.set).mockImplementation(((items: Record<string, unknown>, cb?: unknown) => {
    Object.assign(data, clone(items));
    return done(cb, undefined);
  }) as never);
  vi.mocked(chrome.storage.local.remove).mockImplementation(((keys: string | string[], cb?: unknown) => {
    for (const k of ([] as string[]).concat(keys)) delete data[k];
    return done(cb, undefined);
  }) as never);
  return data;
}

interface FakeFile {
  text: string;
  lastModified: number;
}

/** In-memory stand-in for a FileSystemDirectoryHandle chosen with showDirectoryPicker. */
export class FakeDirectory {
  readonly kind = 'directory' as const;
  readonly name = 'Browser Hub';
  readonly files = new Map<string, FakeFile>();
  permission: PermissionState = 'granted';
  private clock = 1_000;

  async queryPermission(): Promise<PermissionState> {
    return this.permission;
  }

  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }

  async *values() {
    for (const name of [...this.files.keys()]) yield this.fileHandle(name);
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new DOMException('Not found', 'NotFoundError');
    return this.fileHandle(name);
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
  }

  /** Place another browser's file in the folder. */
  put(name: string, content: unknown): void {
    this.files.set(name, { text: JSON.stringify(content), lastModified: ++this.clock });
  }

  json(name: string): Record<string, unknown> {
    return JSON.parse(this.files.get(name)!.text) as Record<string, unknown>;
  }

  ownFileName(): string | undefined {
    return [...this.files.keys()].find((n) => n.includes('-local000'));
  }

  private fileHandle(name: string) {
    const files = this.files;
    const tick = () => ++this.clock;
    return {
      kind: 'file' as const,
      name,
      async getFile() {
        const file = files.get(name)!;
        return { lastModified: file.lastModified, text: async () => file.text };
      },
      async createWritable() {
        let buffer = '';
        return {
          write: async (text: string) => { buffer += text; },
          close: async () => { files.set(name, { text: buffer, lastModified: tick() }); },
        };
      },
    };
  }
}

/** Another browser's shared file. */
export function peerFile(data: Record<string, unknown>, options: { id?: string; label?: string; writtenAt?: string } = {}) {
  return {
    format: 'browser-hub-shared',
    schema: 1,
    instance: { id: options.id ?? 'edge-instance', label: options.label ?? 'Edge' },
    writtenAt: options.writtenAt ?? new Date().toISOString(),
    data,
  };
}
