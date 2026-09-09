/**
 * Task 0.9 — a migration that throws must abort the version bump.
 *
 * Locks in the audit's "Checked and Found Sound" item #9: a failed
 * `addSavingsIndexesMigration.up` (or any throwing upgrader) must leave the
 * database at its pre-migration version with the original data intact —
 * never a half-migrated "version bumped, indexes missing" state.
 *
 * Runs against the fake-indexeddb polyfill installed in vitest.setup.ts.
 */
import { describe, it, expect } from 'vitest';

function openDb(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('savings')) {
        req.result.createObjectStore('savings', { keyPath: 'id' });
      }
    };
  });
}

function put(db: IDBDatabase, value: { id: string; payload: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('savings', 'readwrite');
    tx.objectStore('savings').put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function count(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('savings', 'readonly');
    const req = tx.objectStore('savings').getAll();
    req.onsuccess = () => resolve(req.result.length);
    req.onerror = () => reject(req.error);
  });
}

describe('Task 0.9 — failed migration aborts the version bump', () => {
  it('leaves the DB at the pre-migration version with data intact', async () => {
    const dbName = `migration-abort-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Arrange: a v1 database with one record
    const v1 = await openDb(dbName, 1);
    await put(v1, { id: 'entry-1', payload: 'original' });
    expect(await count(v1)).toBe(1);
    v1.close();

    // Act: attempt a v2 upgrade whose up() throws (simulating a failed
    // migration like addSavingsIndexesMigration.up blowing up mid-flight)
    const upgradeAttempt = new Promise<{ error: unknown }>((resolve) => {
      const req = indexedDB.open(dbName, 2);
      req.onerror = () => resolve({ error: req.error });
      req.onsuccess = () => {
        req.result.close();
        resolve({ error: null });
      };
      req.onupgradeneeded = () => {
        // Mimic the migration throwing — the versionchange transaction must
        // abort and the open must fail, leaving version at 1
        throw new Error('Migration v2 failed: simulated migration failure');
      };
    });

    const outcome = await upgradeAttempt;
    expect(outcome.error).not.toBeNull();

    // Assert: reopening at v1 succeeds, version unchanged, data intact
    const reopened = await openDb(dbName, 1);
    expect(reopened.version).toBe(1);
    expect(await count(reopened)).toBe(1);
    reopened.close();
  });
});
