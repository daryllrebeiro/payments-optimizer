/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment -- legacy setup shims; type incrementally */
/**
 * Vitest Setup File
 * Provides polyfills and global test utilities
 */

// Minimal IndexedDB polyfill for tests
if (typeof globalThis.indexedDB === 'undefined') {
  // Create a minimal mock that prevents tests from failing
  // For full IndexedDB functionality, install 'fake-indexeddb' package

  class IDBRequest {
    result: any = null;
    error: Error | null = null;
    onsuccess: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;

    _triggerSuccess(result: any) {
      this.result = result;
      setTimeout(() => {
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
      }, 0);
    }

    _triggerError(error: Error) {
      this.error = error;
      setTimeout(() => {
        if (this.onerror) {
          this.onerror({ target: this });
        }
      }, 0);
    }
  }

  class IDBTransaction {
    objectStoreNames: string[] = [];
    oncomplete: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onabort: ((event: any) => void) | null = null;
    private stores = new Map<string, any>();

    constructor(
      private db: any,
      storeNames: string | string[],
      private mode: string
    ) {
      this.objectStoreNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    }

    objectStore(name: string) {
      if (!this.stores.has(name)) {
        const store = this.db._getStore(name);
        this.stores.set(name, store);
      }
      return this.stores.get(name);
    }

    _complete() {
      setTimeout(() => {
        if (this.oncomplete) {
          this.oncomplete({ target: this });
        }
      }, 10);
    }
  }

  class IDBObjectStore {
    indexNames = { contains: (name: string) => this.indexes.has(name) };
    private indexes = new Map<string, any>();

    constructor(
      private name: string,
      private db: any
    ) {}

    get(key: any) {
      const request = new IDBRequest();
      const data = this.db._data.get(this.name) || new Map();
      request._triggerSuccess(data.get(String(key)));
      return request;
    }

    getAll(range?: any) {
      const request = new IDBRequest();
      const data = this.db._data.get(this.name) || new Map();
      const results = Array.from(data.values());
      request._triggerSuccess(results);
      return request;
    }

    put(value: any) {
      const request = new IDBRequest();
      const data = this.db._data.get(this.name) || new Map();
      const key = value.id || String(Date.now());
      data.set(String(key), value);
      this.db._data.set(this.name, data);
      request._triggerSuccess(key);
      return request;
    }

    delete(key: any) {
      const request = new IDBRequest();
      const data = this.db._data.get(this.name) || new Map();
      data.delete(String(key));
      request._triggerSuccess(undefined);
      return request;
    }

    createIndex(name: string, keyPath: string | string[], options: any = {}) {
      const index = new IDBIndex(name, keyPath, this);
      this.indexes.set(name, index);
      return index;
    }

    deleteIndex(name: string) {
      this.indexes.delete(name);
    }

    index(name: string) {
      return this.indexes.get(name) || new IDBIndex(name, '', this);
    }
  }

  class IDBIndex {
    constructor(
      public name: string,
      private keyPath: string | string[],
      private store: any
    ) {}

    getAll(range?: any) {
      const request = new IDBRequest();
      const data = this.store.db._data.get(this.store.name) || new Map();
      let results = Array.from(data.values());

      // Resolve the keyPath against each record (root-level, matching real
      // IndexedDB semantics — NOT a nested .data envelope)
      const readKeyPath = (item: any, keyPath: string | string[]): any => {
        if (Array.isArray(keyPath)) {
          return keyPath.map((k) => (item ? item[k] : undefined));
        }
        return item ? item[keyPath] : undefined;
      };

      // Simple filtering for IDBKeyRange
      if (range && range.lower && range.upper) {
        results = results.filter((item: any) => {
          if (!item) return false;

          // Handle compound keys
          if (Array.isArray(this.keyPath)) {
            const [merchantKey, timestampKey] = this.keyPath;
            const merchantId = readKeyPath(item, merchantKey);
            const timestamp = readKeyPath(item, timestampKey);

            const lowerMatch = merchantId === range.lower[0] && timestamp >= range.lower[1];
            const upperMatch = merchantId === range.upper[0] && timestamp <= range.upper[1];

            return lowerMatch && upperMatch;
          } else {
            // Single key
            const value = readKeyPath(item, this.keyPath as string);
            return value >= range.lower && value <= range.upper;
          }
        });
      } else if (range && typeof range === 'string') {
        // IDBKeyRange.only(value)
        results = results.filter((item: any) => {
          if (!item) return false;
          return readKeyPath(item, this.keyPath as string) === range;
        });
      }

      request._triggerSuccess(results);
      return request;
    }
  }

  class IDBDatabase {
    objectStoreNames = { contains: (name: string) => this._stores.has(name) };
    _stores = new Map<string, IDBObjectStore>();
    _data = new Map<string, Map<string, any>>();

    constructor(
      public name: string,
      public version: number
    ) {}

    createObjectStore(name: string, options: any = {}) {
      const store = new IDBObjectStore(name, this);
      this._stores.set(name, store);
      this._data.set(name, new Map());
      return store;
    }

    _getStore(name: string) {
      return this._stores.get(name) || new IDBObjectStore(name, this);
    }

    transaction(storeNames: string | string[], mode: string = 'readonly') {
      const tx = new IDBTransaction(this, storeNames, mode);
      tx._complete();
      return tx;
    }

    close() {
      // No-op
    }
  }

  class IDBOpenDBRequest extends IDBRequest {
    onupgradeneeded: ((event: any) => void) | null = null;

    _triggerUpgrade(
      db: IDBDatabase,
      oldVersion: number,
      newVersion: number,
      handlers: { onSuccess: () => void; onFailure: () => void }
    ) {
      this.result = db;
      // Create a temporary transaction object that's available during upgrade
      const upgradeTransaction = {
        objectStore: (name: string) => db._getStore(name),
      };

      setTimeout(() => {
        if (this.onupgradeneeded) {
          // Store transaction on db temporarily for migration access
          (db as any).transaction = upgradeTransaction;
          try {
            this.onupgradeneeded({ target: this, oldVersion, newVersion });
            // Clean up temporary reference
            delete (db as any).transaction;
            // Faithful IndexedDB semantics: a throwing upgrader aborts the
            // version change — the new version is NOT committed.
            handlers.onSuccess();
          } catch {
            delete (db as any).transaction;
            handlers.onFailure();
          }
        } else {
          handlers.onSuccess();
        }
      }, 0);
    }
  }

  const databases = new Map<string, IDBDatabase>();

  const indexedDB = {
    open(name: string, version: number = 1) {
      const request = new IDBOpenDBRequest();

      setTimeout(() => {
        const db = databases.get(name);

        if (!db || db.version < version) {
          const newDb = new IDBDatabase(name, version);
          // Preserve existing stores and data across version bumps
          // (faithful to real IndexedDB, required by migration tests)
          if (db) {
            for (const [storeName, store] of db._stores) {
              newDb._stores.set(storeName, store);
            }
            for (const [storeName, data] of db._data) {
              newDb._data.set(storeName, data);
            }
          }

          request._triggerUpgrade(newDb, db ? db.version : 0, version, {
            onSuccess: () => {
              databases.set(name, newDb);
              request._triggerSuccess(newDb);
            },
            onFailure: () => {
              // Upgrade aborted: keep the previous database (old version,
              // old data) registered, and fail the open request.
              request._triggerError(new Error('Version change aborted'));
            },
          });
        } else {
          request._triggerSuccess(db);
        }
      }, 0);

      return request;
    },

    deleteDatabase(name: string) {
      const db = databases.get(name);
      if (db) {
        // Clear all data
        db._stores.clear();
        db._data.clear();
      }
      databases.delete(name);
      const request = new IDBRequest();
      request._triggerSuccess(undefined);
      return request;
    },
  };

  // Add IDBKeyRange implementation
  const IDBKeyRange = {
    bound(lower: any, upper: any, lowerOpen = false, upperOpen = false) {
      return { lower, upper, lowerOpen, upperOpen };
    },
    only(value: any) {
      return value;
    },
    lowerBound(lower: any, open = false) {
      return { lower, lowerOpen: open };
    },
    upperBound(upper: any, open = false) {
      return { upper, upperOpen: open };
    },
  };

  // @ts-ignore
  globalThis.indexedDB = indexedDB;
  // @ts-ignore
  globalThis.IDBKeyRange = IDBKeyRange;

  console.log('[vitest.setup] IndexedDB polyfill installed');
}
