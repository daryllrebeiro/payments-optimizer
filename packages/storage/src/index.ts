/**
 * PaymentsOptimizer storage layer
 *
 * Base repository abstractions (StorageRepository, InMemoryRepository,
 * IndexedDbRepository, VersionedEntity, integrity helpers) live in
 * ./base-repository.js to avoid a circular dependency with
 * savings-repository.ts (which extends IndexedDbRepository).
 */

export * from './base-repository.js';

// Export transaction coordinator and operations
export * from './transaction-coordinator.js';
export * from './operations.js';

// Export savings repository and migrations
export * from './savings-repository.js';
export * from './migrations/v2-add-savings-indexes.js';

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
