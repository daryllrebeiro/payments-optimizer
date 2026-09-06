/**
 * Base entity with version and integrity checksum
 */
export interface VersionedEntity<T> {
  id: string;
  version: number;
  integrityHash?: string;
  data: T;
}

// Export transaction coordinator and operations
export * from './transaction-coordinator.js';
export * from './operations.js';

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

/**
 * Represents a single database migration
 */
export interface Migration {
  version: number;
  description: string;
  up: (db: IDBDatabase) => void;
  down?: (db: IDBDatabase) => void;
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  migrationsApplied: number[];
  success: boolean;
  error?: Error;
}

/**
 * Migration Runner with test support and rollback capability
 */
export class MigrationRunner {
  private migrations = new Map<number, Migration>();

  /**
   * Register a migration
   * @param migration - Migration to register
   */
  register(migration: Migration): void {
    if (this.migrations.has(migration.version)) {
      throw new Error(`Migration for version ${migration.version} already registered`);
    }
    this.migrations.set(migration.version, migration);
  }

  /**
   * Register multiple migrations at once
   * @param migrations - Array of migrations to register
   */
  registerAll(migrations: Migration[]): void {
    for (const migration of migrations) {
      this.register(migration);
    }
  }

  /**
   * Get all registered migrations in order
   */
  getAllMigrations(): Migration[] {
    return Array.from(this.migrations.values()).sort((a, b) => a.version - b.version);
  }

  /**
   * Migrate database from current version to target version
   * @param db - IDBDatabase instance
   * @param fromVersion - Current database version
   * @param toVersion - Target database version
   * @returns Migration result
   */
  migrate(db: IDBDatabase, fromVersion: number, toVersion: number): MigrationResult {
    const result: MigrationResult = {
      fromVersion,
      toVersion,
      migrationsApplied: [],
      success: false,
    };

    try {
      // Get migrations to apply (in order)
      const migrationsToApply = this.getAllMigrations().filter(
        (m) => m.version > fromVersion && m.version <= toVersion
      );

      // Apply each migration
      for (const migration of migrationsToApply) {
        console.log(`[MigrationRunner] Applying migration v${migration.version}: ${migration.description}`);
        
        try {
          migration.up(db);
          result.migrationsApplied.push(migration.version);
        } catch (err) {
          throw new Error(
            `Migration v${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      result.success = true;
      console.log(`[MigrationRunner] Successfully migrated from v${fromVersion} to v${toVersion}`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error : new Error(String(error));
      console.error('[MigrationRunner] Migration failed:', result.error);
    }

    return result;
  }

  /**
   * Rollback migrations from current version to target version
   * Used primarily for testing
   * @param db - IDBDatabase instance
   * @param fromVersion - Current database version
   * @param toVersion - Target database version (must be lower)
   * @returns Migration result
   */
  rollback(db: IDBDatabase, fromVersion: number, toVersion: number): MigrationResult {
    const result: MigrationResult = {
      fromVersion,
      toVersion,
      migrationsApplied: [],
      success: false,
    };

    if (toVersion >= fromVersion) {
      result.error = new Error('Rollback target version must be lower than current version');
      return result;
    }

    try {
      // Get migrations to rollback (in reverse order)
      const migrationsToRollback = this.getAllMigrations()
        .filter((m) => m.version > toVersion && m.version <= fromVersion)
        .reverse();

      // Rollback each migration
      for (const migration of migrationsToRollback) {
        if (!migration.down) {
          throw new Error(`Migration v${migration.version} does not have a rollback function`);
        }

        console.log(`[MigrationRunner] Rolling back migration v${migration.version}: ${migration.description}`);
        
        try {
          migration.down(db);
          result.migrationsApplied.push(migration.version);
        } catch (err) {
          throw new Error(
            `Rollback of v${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      result.success = true;
      console.log(`[MigrationRunner] Successfully rolled back from v${fromVersion} to v${toVersion}`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error : new Error(String(error));
      console.error('[MigrationRunner] Rollback failed:', result.error);
    }

    return result;
  }

  /**
   * Check if a migration exists for a specific version
   */
  hasMigration(version: number): boolean {
    return this.migrations.has(version);
  }

  /**
   * Get a specific migration by version
   */
  getMigration(version: number): Migration | undefined {
    return this.migrations.get(version);
  }
}

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
