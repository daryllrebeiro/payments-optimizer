/**
 * Fix F10 regression tests — one canonical savings-record shape.
 *
 * Exploit scenario from the audit: base-repository `put` wraps entities as
 * {id, version, integrityHash, data:{...}} while the V2 indexes are declared
 * on top-level merchantId/timestamp — wrapped records are invisible to every
 * index query, and raw records fail `get()`. After the fix, the savings
 * store has exactly one shape (raw), and both writers and readers agree.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SavingsRepository, type SavingsEntry } from './savings-repository.js';

const DB_NAME = 'payments-optimizer-savings';

function makeEntry(overrides: Partial<Record<string, unknown>> = {}): SavingsEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    merchantId: 'amazon',
    cartTotal: { amountMinor: '10000', currency: 'INR' },
    selectedStrategy: {
      id: 's1',
      immediateDiscount: { amountMinor: '0', currency: 'INR' },
      rewardValue: { amountMinor: '0', currency: 'INR' },
      totalBenefit: { amountMinor: '500', currency: 'INR' },
      confidence: 0.9,
    },
    originalTotal: { amountMinor: '10000', currency: 'INR' },
    savings: { amountMinor: '9500', currency: 'INR' },
    benefitsApplied: [],
    ...overrides,
  };
}

// Each test gets a fresh database by versioning the store name via
// deleteDatabase in beforeEach.
async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('SavingsRepository — single canonical record shape', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('a record written via put() is returned unchanged by get()', async () => {
    const repo = new SavingsRepository();
    const entry = makeEntry();
    await repo.put(entry);

    const read = await repo.get(entry.id);
    expect(read).toBeDefined();
    expect(read!.id).toBe(entry.id);
    expect(read!.merchantId).toBe(entry.merchantId);
    expect(read!.savings.amountMinor).toBe(entry.savings.amountMinor);
  });

  it('index queries find records written via put()', async () => {
    const repo = new SavingsRepository();
    const entry = makeEntry({
      merchantId: 'flipkart',
      timestamp: 1750000000000,
    });
    await repo.put(entry);

    const byMerchant = await repo.queryByMerchant('flipkart');
    expect(byMerchant.length).toBe(1);
    expect(byMerchant[0]!.id).toBe(entry.id);

    const byMerchantAndDate = await repo.queryByMerchantAndDateRange(
      'flipkart',
      1749999999999,
      1750000000001
    );
    expect(byMerchantAndDate.length).toBe(1);
    expect(byMerchantAndDate[0]!.id).toBe(entry.id);

    const byDate = await repo.queryByDateRange(1749999999999, 1750000000001);
    expect(byDate.map((e) => e.id)).toContain(entry.id);
  });

  it('the raw shape is stored (no VersionedEntity wrapper)', async () => {
    const repo = new SavingsRepository();
    const entry = makeEntry();
    await repo.put(entry);

    // Inspect the raw stored record — it must NOT be wrapped in
    // {id, version, integrityHash, data}
    const raw = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('savings', 'readonly');
        const getReq = tx.objectStore('savings').get(entry.id);
        getReq.onsuccess = () => {
          resolve(getReq.result as Record<string, unknown>);
          db.close();
        };
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Raw: merchantId at top level, no envelope fields
    expect(raw.merchantId).toBe('amazon');
    expect(raw).not.toHaveProperty('integrityHash');
    expect(raw).not.toHaveProperty('data');
    expect(raw).not.toHaveProperty('version');
  });

  it('list() returns raw records written via put()', async () => {
    const repo = new SavingsRepository();
    const entryA = makeEntry();
    const entryB = makeEntry();
    await repo.put(entryA);
    await repo.put(entryB);

    const all = await repo.list();
    const ids = all.map((e) => e.id);
    expect(ids).toContain(entryA.id);
    expect(ids).toContain(entryB.id);
  });
});
