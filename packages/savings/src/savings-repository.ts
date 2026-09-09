import {
  StorageRepository,
  InMemoryRepository,
  IndexedDbRepository,
  VersionedEntity,
  verifyIntegrity,
} from '@payments-optimizer/storage';
import type { SavingsEntry } from './types';

/**
 * Repository for storing and retrieving savings entries
 */
export class SavingsRepository implements StorageRepository<SavingsEntry> {
  private storageRepo: StorageRepository<SavingsEntry>;

  constructor(
    private dbOptions?: {
      dbName?: string;
      storeName?: string;
      dbVersion?: number;
    }
  ) {
    // Use IndexedDB for browser, InMemory for Node.js/testing
    if (typeof globalThis !== 'undefined' && globalThis.indexedDB) {
      this.storageRepo = new IndexedDbRepository<SavingsEntry>(
        dbOptions?.dbName || 'payments-optimizer-savings',
        dbOptions?.storeName || 'savings',
        dbOptions?.dbVersion || 1
      );
    } else {
      this.storageRepo = new InMemoryRepository<SavingsEntry>();
    }
  }

  async get(id: string): Promise<SavingsEntry | undefined> {
    return await this.storageRepo.get(id);
  }

  async list(): Promise<SavingsEntry[]> {
    return await this.storageRepo.list();
  }

  async put(entry: SavingsEntry & { id: string }): Promise<void> {
    await this.storageRepo.put(entry);
  }

  async delete(id: string): Promise<void> {
    await this.storageRepo.delete(id);
  }

  /**
   * Get savings summary statistics
   */
  async getSummary(): Promise<{
    totalEntries: number;
    totalSaved: number;
    avgSavingsPerOrder: number;
    merchantBreakdown: Record<string, { count: number; totalSaved: number }>;
  }> {
    const entries = await this.list();
    const summary = {
      totalEntries: entries.length,
      totalSaved: 0,
      avgSavingsPerOrder: 0,
      merchantBreakdown: {} as Record<string, { count: number; totalSaved: number }>,
    };

    if (entries.length === 0) {
      return summary;
    }

    let totalSavedMinor = 0n;
    const merchantCounts: Record<string, number> = {};
    const merchantSavings: Record<string, bigint> = {};

    for (const entry of entries) {
      const savingsMinor = BigInt(entry.savings.amountMinor);
      totalSavedMinor += savingsMinor;

      const merchantId = entry.merchantId;
      merchantCounts[merchantId] = (merchantCounts[merchantId] || 0) + 1;
      merchantSavings[merchantId] = (merchantSavings[merchantId] || 0n) + savingsMinor;
    }

    summary.totalSaved = Number(totalSavedMinor) / 100;
    summary.avgSavingsPerOrder = summary.totalSaved / entries.length;

    for (const merchantId of Object.keys(merchantCounts)) {
      summary.merchantBreakdown[merchantId] = {
        count: merchantCounts[merchantId],
        totalSaved: Number(merchantSavings[merchantId]) / 100,
      };
    }

    return summary;
  }

  /**
   * Get savings over time (for chart visualization)
   */
  async getHistory(options?: {
    startDate?: number;
    endDate?: number;
    limit?: number;
  }): Promise<SavingsEntry[]> {
    const entries = await this.list();
    const { startDate, endDate, limit = 100 } = options || {};

    let filtered = entries;

    if (startDate) {
      filtered = filtered.filter((e) => e.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter((e) => e.timestamp <= endDate);
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * Get recent savings (last N entries)
   */
  async getRecent(limit: number = 10): Promise<SavingsEntry[]> {
    return this.getHistory({ limit });
  }
}
