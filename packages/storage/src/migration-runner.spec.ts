/**
 * Tests for MigrationRunner (Epic 1.7)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationRunner, type Migration } from './index.js';

// Mock IDBDatabase for testing
class MockIDBDatabase {
  public objectStoreNames: string[] = [];
  public version: number = 1;
  private stores = new Map<string, MockObjectStore>();

  createObjectStore(name: string, options?: { keyPath?: string; autoIncrement?: boolean }) {
    const store = new MockObjectStore(name, options);
    this.stores.set(name, store);
    this.objectStoreNames.push(name);
    return store;
  }

  deleteObjectStore(name: string) {
    this.stores.delete(name);
    this.objectStoreNames = this.objectStoreNames.filter(n => n !== name);
  }

  transaction(storeNames: string | string[], mode: 'readonly' | 'readwrite') {
    return new MockTransaction(this.stores, storeNames, mode);
  }

  objectStore(name: string) {
    return this.stores.get(name);
  }
}

class MockObjectStore {
  public name: string;
  public keyPath?: string | undefined;
  public autoIncrement?: boolean | undefined;
  public indexNames: string[] = [];
  private indexes = new Map<string, MockIndex>();

  constructor(name: string, options?: { keyPath?: string; autoIncrement?: boolean }) {
    this.name = name;
    this.keyPath = options?.keyPath;
    this.autoIncrement = options?.autoIncrement;
  }

  createIndex(name: string, keyPath: string | string[], options?: { unique?: boolean; multiEntry?: boolean }) {
    const index = new MockIndex(name, keyPath, options);
    this.indexes.set(name, index);
    this.indexNames.push(name);
    return index;
  }

  deleteIndex(name: string) {
    this.indexes.delete(name);
    this.indexNames = this.indexNames.filter(n => n !== name);
  }

  index(name: string) {
    return this.indexes.get(name);
  }
}

class MockIndex {
  constructor(
    public name: string,
    public keyPath: string | string[],
    public options?: { unique?: boolean; multiEntry?: boolean }
  ) {}
}

class MockTransaction {
  constructor(
    private stores: Map<string, MockObjectStore>,
    private storeNames: string | string[],
    public mode: 'readonly' | 'readwrite'
  ) {}

  objectStore(name: string) {
    return this.stores.get(name);
  }
}

describe('MigrationRunner', () => {
  let runner: MigrationRunner;
  let mockDb: MockIDBDatabase;

  beforeEach(() => {
    runner = new MigrationRunner();
    mockDb = new MockIDBDatabase();
  });

  describe('Registration', () => {
    it('should register a migration', () => {
      const migration: Migration = {
        version: 2,
        description: 'Add user index',
        up: (db) => {},
      };

      runner.register(migration);

      expect(runner.hasMigration(2)).toBe(true);
      expect(runner.getMigration(2)).toBe(migration);
    });

    it('should throw when registering duplicate version', () => {
      const migration1: Migration = {
        version: 2,
        description: 'First migration',
        up: (db) => {},
      };

      const migration2: Migration = {
        version: 2,
        description: 'Duplicate migration',
        up: (db) => {},
      };

      runner.register(migration1);

      expect(() => runner.register(migration2)).toThrow('already registered');
    });

    it('should register multiple migrations', () => {
      const migrations: Migration[] = [
        {
          version: 2,
          description: 'Migration 2',
          up: (db) => {},
        },
        {
          version: 3,
          description: 'Migration 3',
          up: (db) => {},
        },
        {
          version: 4,
          description: 'Migration 4',
          up: (db) => {},
        },
      ];

      runner.registerAll(migrations);

      expect(runner.hasMigration(2)).toBe(true);
      expect(runner.hasMigration(3)).toBe(true);
      expect(runner.hasMigration(4)).toBe(true);
    });

    it('should return migrations in sorted order', () => {
      const migrations: Migration[] = [
        { version: 4, description: 'Fourth', up: (db) => {} },
        { version: 2, description: 'Second', up: (db) => {} },
        { version: 3, description: 'Third', up: (db) => {} },
      ];

      runner.registerAll(migrations);

      const sorted = runner.getAllMigrations();
      expect(sorted[0]?.version).toBe(2);
      expect(sorted[1]?.version).toBe(3);
      expect(sorted[2]?.version).toBe(4);
    });
  });

  describe('Forward migration', () => {
    it('should apply single migration', () => {
      const upSpy = vi.fn();
      const migration: Migration = {
        version: 2,
        description: 'Add users store',
        up: upSpy,
      };

      runner.register(migration);

      const result = runner.migrate(mockDb as unknown as IDBDatabase, 1, 2);

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.migrationsApplied).toEqual([2]);
      expect(upSpy).toHaveBeenCalledWith(mockDb);
    });

    it('should apply multiple migrations in order', () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 2,
          description: 'Migration 2',
          up: (db) => executionOrder.push(2),
        },
        {
          version: 3,
          description: 'Migration 3',
          up: (db) => executionOrder.push(3),
        },
        {
          version: 4,
          description: 'Migration 4',
          up: (db) => executionOrder.push(4),
        },
      ];

      runner.registerAll(migrations);

      const result = runner.migrate(mockDb as unknown as IDBDatabase, 1, 4);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toEqual([2, 3, 4]);
      expect(executionOrder).toEqual([2, 3, 4]);
    });

    it('should skip migrations already applied', () => {
      const migrations: Migration[] = [
        {
          version: 2,
          description: 'Migration 2',
          up: vi.fn(),
        },
        {
          version: 3,
          description: 'Migration 3',
          up: vi.fn(),
        },
        {
          version: 4,
          description: 'Migration 4',
          up: vi.fn(),
        },
      ];

      runner.registerAll(migrations);

      // Migrate from version 2 to 4 (skip version 2)
      const result = runner.migrate(mockDb as unknown as IDBDatabase, 2, 4);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toEqual([3, 4]);
      expect(migrations[0]?.up).not.toHaveBeenCalled();
      expect(migrations[1]?.up).toHaveBeenCalled();
      expect(migrations[2]?.up).toHaveBeenCalled();
    });

    it('should handle no migrations to apply', () => {
      const result = runner.migrate(mockDb as unknown as IDBDatabase, 5, 5);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toEqual([]);
    });

    it('should handle migration failure', () => {
      const migration: Migration = {
        version: 2,
        description: 'Failing migration',
        up: (db) => {
          throw new Error('Migration failed');
        },
      };

      runner.register(migration);

      const result = runner.migrate(mockDb as unknown as IDBDatabase, 1, 2);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Migration failed');
    });

    it('should stop at first failure', () => {
      const migrations: Migration[] = [
        {
          version: 2,
          description: 'Migration 2',
          up: vi.fn(),
        },
        {
          version: 3,
          description: 'Failing migration',
          up: (db) => {
            throw new Error('Failed');
          },
        },
        {
          version: 4,
          description: 'Migration 4',
          up: vi.fn(),
        },
      ];

      runner.registerAll(migrations);

      const result = runner.migrate(mockDb as unknown as IDBDatabase, 1, 4);

      expect(result.success).toBe(false);
      expect(result.migrationsApplied).toEqual([2]); // Only first one applied
      expect(migrations[0]?.up).toHaveBeenCalled();
      expect(migrations[2]?.up).not.toHaveBeenCalled();
    });
  });

  describe('Rollback', () => {
    it('should rollback single migration', () => {
      const downSpy = vi.fn();
      const migration: Migration = {
        version: 2,
        description: 'Migration 2',
        up: vi.fn(),
        down: downSpy,
      };

      runner.register(migration);

      const result = runner.rollback(mockDb as unknown as IDBDatabase, 2, 1);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toEqual([2]);
      expect(downSpy).toHaveBeenCalledWith(mockDb);
    });

    it('should rollback multiple migrations in reverse order', () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 2,
          description: 'Migration 2',
          up: vi.fn(),
          down: (db) => executionOrder.push(2),
        },
        {
          version: 3,
          description: 'Migration 3',
          up: vi.fn(),
          down: (db) => executionOrder.push(3),
        },
        {
          version: 4,
          description: 'Migration 4',
          up: vi.fn(),
          down: (db) => executionOrder.push(4),
        },
      ];

      runner.registerAll(migrations);

      const result = runner.rollback(mockDb as unknown as IDBDatabase, 4, 1);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toEqual([4, 3, 2]);
      expect(executionOrder).toEqual([4, 3, 2]); // Reverse order
    });

    it('should fail if migration has no down function', () => {
      const migration: Migration = {
        version: 2,
        description: 'Migration without rollback',
        up: vi.fn(),
        // No down function
      };

      runner.register(migration);

      const result = runner.rollback(mockDb as unknown as IDBDatabase, 2, 1);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('does not have a rollback function');
    });

    it('should fail if target version is not lower', () => {
      const result = runner.rollback(mockDb as unknown as IDBDatabase, 2, 3);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('must be lower');
    });
  });

  describe('Real-world scenario', () => {
    it('should create object store and add index', () => {
      const migration: Migration = {
        version: 2,
        description: 'Create savings store with indexes',
        up: (db: IDBDatabase) => {
          const store = db.createObjectStore('savings', { keyPath: 'id' });
          store.createIndex('by_merchant', 'merchantId', { unique: false });
          store.createIndex('by_timestamp', 'timestamp', { unique: false });
        },
        down: (db: IDBDatabase) => {
          db.deleteObjectStore('savings');
        },
      };

      runner.register(migration);

      // Forward migration
      const upResult = runner.migrate(mockDb as unknown as IDBDatabase, 1, 2);
      expect(upResult.success).toBe(true);
      expect(mockDb.objectStoreNames).toContain('savings');
      
      const store = mockDb.objectStore('savings');
      expect(store?.indexNames).toContain('by_merchant');
      expect(store?.indexNames).toContain('by_timestamp');

      // Rollback
      const downResult = runner.rollback(mockDb as unknown as IDBDatabase, 2, 1);
      expect(downResult.success).toBe(true);
      expect(mockDb.objectStoreNames).not.toContain('savings');
    });

    it('should add compound index to existing store', () => {
      // Setup: create initial store
      mockDb.createObjectStore('savings', { keyPath: 'id' });

      const migration: Migration = {
        version: 3,
        description: 'Add compound index',
        up: (db: IDBDatabase) => {
          const transaction = db.transaction('savings', 'readwrite');
          const store = transaction.objectStore('savings');
          store?.createIndex('by_merchant_timestamp', ['merchantId', 'timestamp'], { unique: false });
        },
        down: (db: IDBDatabase) => {
          const transaction = db.transaction('savings', 'readwrite');
          const store = transaction.objectStore('savings');
          store?.deleteIndex('by_merchant_timestamp');
        },
      };

      runner.register(migration);

      const upResult = runner.migrate(mockDb as unknown as IDBDatabase, 2, 3);
      expect(upResult.success).toBe(true);

      const store = mockDb.objectStore('savings');
      expect(store?.indexNames).toContain('by_merchant_timestamp');
    });
  });
});
