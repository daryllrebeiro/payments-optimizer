/**
 * Enhanced Savings Repository with Index-based Queries
 * Epic 1.4: Optimized queries using IndexedDB indexes
 */

import { IndexedDbRepository, type Migration } from './index.js';
import { addSavingsIndexesMigration } from './migrations/v2-add-savings-indexes.js';

/**
 * Savings entry as stored in repository
 */
export interface SavingsEntry {
  id: string;
  timestamp: number;
  merchantId: string;
  cartTotal: { amountMinor: string; currency: string };
  originalTotal: { amountMinor: string; currency: string };
  savings: { amountMinor: string; currency: string };
  selectedStrategy: {
    id: string;
    immediateDiscount: { amountMinor: string; currency: string };
    rewardValue: { amountMinor: string; currency: string };
    totalBenefit: { amountMinor: string; currency: string };
    confidence: number;
  };
  benefitsApplied: Array<{
    benefitId: string;
    benefitType: string;
    benefitSourceId: string;
    benefitSourceName: string;
    amountApplied: { amountMinor: string; currency: string };
  }>;
  vouchersBurned?: string[];
}

/**
 * Query filter for savings
 */
export interface SavingsQueryFilter {
  merchantId?: string;
  startDate?: number;
  endDate?: number;
  minSavings?: bigint;
  maxSavings?: bigint;
}

/**
 * Enhanced savings repository with optimized index-based queries
 */
export class SavingsRepository extends IndexedDbRepository<SavingsEntry> {
  constructor() {
    super('payments-optimizer-savings', 'savings', 2, (db, oldVersion, newVersion) => {
      // Initial store creation
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('savings')) {
          db.createObjectStore('savings', { keyPath: 'id' });
        }
      }

      // Apply migrations using MigrationRunner
      if (oldVersion < 2 && newVersion >= 2) {
        addSavingsIndexesMigration.up(db);
      }
    });
  }

  /**
   * Helper to unwrap entities (handles both VersionedEntity and direct entities)
   */
  private unwrapEntities(entities: any[]): SavingsEntry[] {
    const results: SavingsEntry[] = [];
    
    for (const entity of entities) {
      if (entity) {
        // Check if it's wrapped in VersionedEntity structure
        if (entity.data) {
          results.push(entity.data as SavingsEntry);
        } else {
          // Direct entity (not wrapped)
          results.push(entity as SavingsEntry);
        }
      }
    }
    
    return results;
  }

  /**
   * Query savings by merchant and date range using compound index
   * Optimized: O(log n + k) where k is result size
   * 
   * @param merchantId - Merchant ID to filter by
   * @param startDate - Start timestamp (inclusive)
   * @param endDate - End timestamp (inclusive)
   * @returns Array of savings entries
   */
  async queryByMerchantAndDateRange(
    merchantId: string,
    startDate: number,
    endDate: number
  ): Promise<SavingsEntry[]> {
    const db = await (this as any).openDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('savings', 'readonly');
      const store = transaction.objectStore('savings');
      const index = store.index('by_merchant_timestamp');

      // Use compound index with IDBKeyRange
      const range = IDBKeyRange.bound(
        [merchantId, startDate],
        [merchantId, endDate],
        false,
        false
      );

      const request = index.getAll(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entities = (request.result || []) as any[];
        resolve(this.unwrapEntities(entities));
      };

      transaction.oncomplete = () => db.close();
    });
  }

  /**
   * Query savings by date range using timestamp index
   * Optimized: O(log n + k) where k is result size
   * 
   * @param startDate - Start timestamp (inclusive)
   * @param endDate - End timestamp (inclusive)
   * @returns Array of savings entries
   */
  async queryByDateRange(startDate: number, endDate: number): Promise<SavingsEntry[]> {
    const db = await (this as any).openDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('savings', 'readonly');
      const store = transaction.objectStore('savings');
      const index = store.index('by_timestamp');

      const range = IDBKeyRange.bound(startDate, endDate, false, false);
      const request = index.getAll(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entities = (request.result || []) as any[];
        resolve(this.unwrapEntities(entities));
      };

      transaction.oncomplete = () => db.close();
    });
  }

  /**
   * Query savings by merchant using merchant index
   * Optimized: O(log n + k) where k is result size
   * 
   * @param merchantId - Merchant ID to filter by
   * @returns Array of savings entries
   */
  async queryByMerchant(merchantId: string): Promise<SavingsEntry[]> {
    const db = await (this as any).openDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('savings', 'readonly');
      const store = transaction.objectStore('savings');
      const index = store.index('by_merchant');

      const request = index.getAll(IDBKeyRange.only(merchantId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entities = (request.result || []) as any[];
        resolve(this.unwrapEntities(entities));
      };

      transaction.oncomplete = () => db.close();
    });
  }

  /**
   * Query with complex filter (uses indexes where possible, then filters)
   * 
   * @param filter - Query filter
   * @returns Array of savings entries matching filter
   */
  async query(filter: SavingsQueryFilter): Promise<SavingsEntry[]> {
    let results: SavingsEntry[];

    // Optimize query based on available filters
    if (filter.merchantId && filter.startDate !== undefined && filter.endDate !== undefined) {
      // Use compound index for merchant + date range
      results = await this.queryByMerchantAndDateRange(
        filter.merchantId,
        filter.startDate,
        filter.endDate
      );
    } else if (filter.startDate !== undefined && filter.endDate !== undefined) {
      // Use timestamp index for date range
      results = await this.queryByDateRange(filter.startDate, filter.endDate);
    } else if (filter.merchantId) {
      // Use merchant index
      results = await this.queryByMerchant(filter.merchantId);
    } else {
      // Fallback to full scan (no applicable index)
      results = await this.list();
    }

    // Apply additional filters in memory
    if (filter.minSavings !== undefined || filter.maxSavings !== undefined) {
      results = results.filter((entry) => {
        const savingsAmount = BigInt(entry.savings.amountMinor);
        
        if (filter.minSavings !== undefined && savingsAmount < filter.minSavings) {
          return false;
        }
        
        if (filter.maxSavings !== undefined && savingsAmount > filter.maxSavings) {
          return false;
        }
        
        return true;
      });
    }

    return results;
  }

  /**
   * Get aggregate statistics for a merchant
   * Optimized: Uses merchant index
   * 
   * @param merchantId - Merchant ID
   * @returns Aggregate statistics
   */
  async getAggregateStats(merchantId: string): Promise<{
    totalSavings: bigint;
    totalTransactions: number;
    averageSavings: bigint;
    currency: string;
  }> {
    const entries = await this.queryByMerchant(merchantId);

    if (entries.length === 0) {
      return {
        totalSavings: 0n,
        totalTransactions: 0,
        averageSavings: 0n,
        currency: 'INR',
      };
    }

    let totalSavings = 0n;
    const currency = entries[0]?.savings.currency || 'INR';

    for (const entry of entries) {
      totalSavings += BigInt(entry.savings.amountMinor);
    }

    const averageSavings = totalSavings / BigInt(entries.length);

    return {
      totalSavings,
      totalTransactions: entries.length,
      averageSavings,
      currency,
    };
  }
}
