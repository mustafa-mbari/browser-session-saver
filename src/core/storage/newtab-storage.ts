const NEWTAB_DB_NAME = 'newtab-db';
const NEWTAB_DB_VERSION = 1;

const Stores = {
  quickLinks: 'quickLinks',
  boards: 'boards',
  bookmarkCategories: 'bookmarkCategories',
  bookmarkEntries: 'bookmarkEntries',
  todoLists: 'todoLists',
  todoItems: 'todoItems',
  wallpaperImages: 'wallpaperImages',
} as const;

export class NewTabDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(NEWTAB_DB_NAME, NEWTAB_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(Stores.quickLinks)) {
          db.createObjectStore(Stores.quickLinks, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(Stores.boards)) {
          db.createObjectStore(Stores.boards, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(Stores.bookmarkCategories)) {
          const catStore = db.createObjectStore(Stores.bookmarkCategories, { keyPath: 'id' });
          catStore.createIndex('boardId', 'boardId', { unique: false });
        }
        if (!db.objectStoreNames.contains(Stores.bookmarkEntries)) {
          const entryStore = db.createObjectStore(Stores.bookmarkEntries, { keyPath: 'id' });
          entryStore.createIndex('categoryId', 'categoryId', { unique: false });
        }
        if (!db.objectStoreNames.contains(Stores.todoLists)) {
          db.createObjectStore(Stores.todoLists, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(Stores.todoItems)) {
          const itemStore = db.createObjectStore(Stores.todoItems, { keyPath: 'id' });
          itemStore.createIndex('listId', 'listId', { unique: false });
        }
        if (!db.objectStoreNames.contains(Stores.wallpaperImages)) {
          db.createObjectStore(Stores.wallpaperImages, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async getAll<T>(store: string): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(store: string, id: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).get(id);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends { id: string }>(store: string, record: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const request = tx.objectStore(store).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(store: string, id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const request = tx.objectStore(store).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllByIndex<T>(store: string, indexName: string, value: string): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const index = tx.objectStore(store).index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async putBlob(id: string, blob: Blob): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(Stores.wallpaperImages, 'readwrite');
      const request = tx.objectStore(Stores.wallpaperImages).put({ id, blob });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBlob(id: string): Promise<Blob | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(Stores.wallpaperImages, 'readonly');
      const request = tx.objectStore(Stores.wallpaperImages).get(id);
      request.onsuccess = () => {
        const result = request.result as { id: string; blob: Blob } | undefined;
        resolve(result?.blob ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBlob(id: string): Promise<void> {
    return this.delete(Stores.wallpaperImages, id);
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    const storeNames = Object.values(Stores) as string[];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      let pending = storeNames.length;
      for (const store of storeNames) {
        const req = tx.objectStore(store).clear();
        req.onsuccess = () => { if (--pending === 0) resolve(); };
        req.onerror = () => reject(req.error);
      }
    });
  }
}

export const newtabDB = new NewTabDB();
