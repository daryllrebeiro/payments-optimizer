/**
 * Base entity with version and integrity checksum
 */
export interface VersionedEntity<T> {
  id: string;
  version: number;
  integrityHash?: string;
  data: T;
}

/**
 * Serializes data for hashing, handling BigInt values
 * @param data - Data to serialize
 * @returns JSON string with BigInt values preserved
 */
function serializeForHash(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }
    return value;
  });
}

/**
 * Computes a simple hash for data integrity verification
 * @param data - Data to hash (will be serialized with BigInt support)
 * @returns Base64-encoded hash string
 */
function computeIntegrityHash(data: unknown): string {
  const serialized = serializeForHash(data);
  // Simple hash - for production, use a stronger algorithm
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return btoa(hash.toString());
}

/**
 * Validates that stored data hasn't been corrupted
 * @param entity - Entity with integrity hash
 * @returns true if valid, false if integrity check failed
 */
export function verifyIntegrity<T>(entity: VersionedEntity<T>): boolean {
  if (!entity.integrityHash) {
    // No integrity hash means data was stored before integrity checks
    return true;
  }
  const computedHash = computeIntegrityHash(entity.data);
  return computedHash === entity.integrityHash;
}

export interface StorageRepository<T> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  put(entity: T & { id: string }): Promise<void>;
  delete(id: string): Promise<void>;
}

// In-Memory Repository (used for testing and CLI fallback)
export class InMemoryRepository<T> implements StorageRepository<T> {
  private store = new Map<string, VersionedEntity<T>>();

  async get(id: string): Promise<T | undefined> {
    const entity = this.store.get(id);
    if (entity && verifyIntegrity(entity)) {
      return entity.data;
    }
    return undefined;
  }

  async list(): Promise<T[]> {
    const results: T[] = [];
    for (const entity of this.store.values()) {
      if (verifyIntegrity(entity)) {
        results.push(entity.data);
      }
    }
    return results;
  }

  async put(entity: T & { id: string }): Promise<void> {
    // Extract only the data portion (exclude versioning fields if present)
    const { id, version, integrityHash, ...data } = entity as unknown as T & {
      id: string;
      version?: number;
      integrityHash?: string;
    };
    
    const versionedEntity: VersionedEntity<T> = {
      id: entity.id,
      version: 1,
      integrityHash: computeIntegrityHash(data as unknown as T),
      data: data as T,
    };
    this.store.set(entity.id, versionedEntity);
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
      if (typeof globalThis === 'undefined' || !globalThis.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }
      const request = globalThis.indexedDB.open(this.dbName, this.dbVersion);

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
      request.onsuccess = () => {
        const entity = request.result as VersionedEntity<T> | undefined;
        if (entity && verifyIntegrity(entity)) {
          resolve(entity.data);
        } else {
          resolve(undefined);
        }
      };
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
      request.onsuccess = () => {
        const entities = (request.result as VersionedEntity<T>[]) ?? [];
        const results: T[] = [];
        for (const entity of entities) {
          if (verifyIntegrity(entity)) {
            results.push(entity.data);
          }
        }
        resolve(results);
      };
      transaction.oncomplete = () => db.close();
    });
  }

  async put(entity: T & { id: string }): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Extract only the data portion (exclude versioning fields if present)
      const { id, version, integrityHash, ...data } = entity as unknown as T & {
        id: string;
        version?: number;
        integrityHash?: string;
      };
      
      const versionedEntity: VersionedEntity<T> = {
        id: entity.id,
        version: 1,
        integrityHash: computeIntegrityHash(data as unknown as T),
        data: data as T,
      };
      
      const request = store.put(versionedEntity);

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
