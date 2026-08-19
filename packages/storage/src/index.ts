export interface StorageRepository<T> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  put(entity: T & { id: string }): Promise<void>;
  delete(id: string): Promise<void>;
}

// In-Memory Repository (used for testing and CLI fallback)
export class InMemoryRepository<T> implements StorageRepository<T> {
  private store = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id);
  }

  async list(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async put(entity: T & { id: string }): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// IndexedDB Repository (used for Chrome extension / browser execution)
export class IndexedDbRepository<T> implements StorageRepository<T> {
  constructor(
    private dbName: string,
    private storeName: string,
    private dbVersion: number = 1,
    private onUpgrade?: (db: IDBDatabase, oldVersion: number, newVersion: number) => void
  ) {}

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }
      const request = window.indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (this.onUpgrade) {
          this.onUpgrade(db, event.oldVersion, this.dbVersion);
        } else {
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        }
      };
    });
  }

  async get(id: string): Promise<T | undefined> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      transaction.oncomplete = () => db.close();
    });
  }

  async list(): Promise<T[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      transaction.oncomplete = () => db.close();
    });
  }

  async put(entity: T & { id: string }): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entity);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      transaction.oncomplete = () => db.close();
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      transaction.oncomplete = () => db.close();
    });
  }
}

// Database Schema Migrator
export type MigrationStep = (db: IDBDatabase) => void;

export class DatabaseMigrator {
  private steps = new Map<number, MigrationStep>();

  registerMigration(version: number, step: MigrationStep): void {
    this.steps.set(version, step);
  }

  migrate(db: IDBDatabase, oldVersion: number, newVersion: number): void {
    for (let v = oldVersion + 1; v <= newVersion; v++) {
      const step = this.steps.get(v);
      if (step) {
        try {
          step(db);
        } catch (err) {
          throw new Error(`Database migration failed at version ${v}: ${(err as Error).message}`);
        }
      }
    }
  }
}
