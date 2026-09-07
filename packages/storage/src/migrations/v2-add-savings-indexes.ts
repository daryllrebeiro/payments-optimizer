/**
 * Migration V2: Add Indexes to Savings Store
 * Epic 1.4: Improves query performance from >500ms to <50ms for 10k entries
 */

import type { Migration } from '../index.js';

/**
 * Migration to add compound and single indexes to savings store
 */
export const addSavingsIndexesMigration: Migration = {
  version: 2,
  description: 'Add by_merchant_timestamp, by_timestamp, and by_merchant indexes to savings store',

  up: (db: IDBDatabase) => {
    // The store name is just 'savings', not 'payments-optimizer-savings'
    const storeName = 'savings';
    
    // Check if savings store exists
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error('Savings store does not exist. Cannot add indexes.');
    }

    // Get the savings store from the transaction
    // Note: In onupgradeneeded, the transaction is already active
    const transaction = (db as any).transaction;
    if (!transaction) {
      throw new Error('No active transaction during upgrade');
    }

    const store = transaction.objectStore(storeName);

    // Add compound index: by_merchant_timestamp
    // Used for queries like "get savings for merchant X in date range Y-Z"
    if (!store.indexNames.contains('by_merchant_timestamp')) {
      store.createIndex('by_merchant_timestamp', ['merchantId', 'timestamp'], {
        unique: false,
      });
      console.log('[Migration V2] Created compound index: by_merchant_timestamp');
    }

    // Add single index: by_timestamp
    // Used for queries like "get all savings in date range"
    if (!store.indexNames.contains('by_timestamp')) {
      store.createIndex('by_timestamp', 'timestamp', { unique: false });
      console.log('[Migration V2] Created index: by_timestamp');
    }

    // Add single index: by_merchant
    // Used for queries like "get all savings for merchant X"
    if (!store.indexNames.contains('by_merchant')) {
      store.createIndex('by_merchant', 'merchantId', { unique: false });
      console.log('[Migration V2] Created index: by_merchant');
    }

    console.log('[Migration V2] Successfully added all savings indexes');
  },

  down: (db: IDBDatabase) => {
    // Rollback: remove the indexes
    const storeName = 'savings';
    
    if (!db.objectStoreNames.contains(storeName)) {
      console.warn('[Migration V2 Rollback] Savings store does not exist');
      return;
    }

    const transaction = (db as any).transaction;
    if (!transaction) {
      throw new Error('No active transaction during upgrade');
    }

    const store = transaction.objectStore(storeName);

    // Remove indexes in reverse order
    if (store.indexNames.contains('by_merchant')) {
      store.deleteIndex('by_merchant');
      console.log('[Migration V2 Rollback] Deleted index: by_merchant');
    }

    if (store.indexNames.contains('by_timestamp')) {
      store.deleteIndex('by_timestamp');
      console.log('[Migration V2 Rollback] Deleted index: by_timestamp');
    }

    if (store.indexNames.contains('by_merchant_timestamp')) {
      store.deleteIndex('by_merchant_timestamp');
      console.log('[Migration V2 Rollback] Deleted compound index: by_merchant_timestamp');
    }

    console.log('[Migration V2 Rollback] Successfully removed all savings indexes');
  },
};
