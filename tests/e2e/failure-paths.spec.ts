import { test, expect } from '@playwright/test';

/**
 * D7: Failure-path Playwright specs
 * These tests verify the extension's behavior under error conditions
 */

test.describe('Failure Path: Save Failure Banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('shows error banner when savings persistence fails', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Wait for dashboard to load
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // Inject a failure into the savings repository by mocking IndexedDB
    await page.evaluate(() => {
      // Monkey-patch IndexedDB.open to fail on 'payments-optimizer-savings' DB
      const originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name: string, version?: number) => {
        if (name === 'payments-optimizer-savings') {
          const req = originalOpen(name, version);
          // Simulate failure on success
          setTimeout(() => {
            if (req.onsuccess) {
              const event = { target: { result: null } } as any;
              req.onerror?.(event);
            }
          }, 0);
          return req;
        }
        return originalOpen(name, version);
      };
    });

    // Trigger a savings confirmation (this should fail)
    await page.evaluate(() => {
      const msg = {
        type: 'CONFIRM_SAVINGS',
        payload: {
          merchantId: 'amazon',
          idempotencyKey: 'test-save-fail-' + Date.now(),
          cartTotal: { amountMinor: '10000', currency: 'INR' },
          strategy: {
            id: 'test-strategy',
            immediateDiscount: { amountMinor: '500', currency: 'INR' },
            rewardValue: { amountMinor: '0', currency: 'INR' },
            futureBenefit: { amountMinor: '0', currency: 'INR' },
            fees: { amountMinor: '0', currency: 'INR' },
            effectiveCost: { amountMinor: '9500', currency: 'INR' },
            totalBenefit: { amountMinor: '500', currency: 'INR' },
            confidence: 0.9,
            complexityScore: 1,
            stepDescriptions: [],
          },
          benefitsApplied: [],
        },
      };
      chrome.runtime.sendMessage(msg);
    });

    // Wait for error banner to appear
    await expect(page.getByText(/Failed to save/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/try again/i)).toBeVisible();
  });
});

test.describe('Failure Path: Offline Fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('shows offline indicator when network is unavailable', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Check offline indicator appears
    await expect(page.getByText(/offline/i)).toBeVisible({ timeout: 5000 });

    // Go back online
    await page.context().setOffline(false);

    // Offline indicator should disappear or change
    await expect(page.getByText(/offline/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('uses cached data when offline and offers stale-data warning', async ({ page }) => {
    // First load with network to populate cache
    await page.goto('http://localhost:5173/popup.html');
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // Go offline
    await page.context().setOffline(true);

    // Reload
    await page.reload();

    // Should still show cached data with stale warning
    await expect(page.getByText('Best Way to Pay')).toBeVisible();
    await expect(page.getByText(/cached|stale/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Failure Path: Invalid Message Rejection', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('rejects malformed messages from content script without crashing', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // Send various malformed messages from content script context
    await page.evaluate(() => {
      // Message with invalid type
      chrome.runtime.sendMessage({ type: 'INVALID_TYPE', payload: {} });

      // Message with missing required fields
      chrome.runtime.sendMessage({ type: 'OPTIMIZE_PAYMENT', payload: {} });

      // Message with wrong payload structure
      chrome.runtime.sendMessage({
        type: 'OPTIMIZE_PAYMENT',
        payload: { cartJson: 'not valid json' },
      });

      // Message with invalid currency
      chrome.runtime.sendMessage({
        type: 'CONFIRM_SAVINGS',
        payload: {
          merchantId: 'amazon',
          idempotencyKey: 'test-invalid-currency',
          cartTotal: { amountMinor: '10000', currency: 'XYZ' },
          strategy: {
            id: 's1',
            totalBenefit: { amountMinor: '500', currency: 'ABC' },
          },
        },
      });
    });

    // Extension should not crash - dashboard should remain responsive
    await expect(page.getByText('Best Way to Pay')).toBeVisible({ timeout: 3000 });

    // No error banner should appear for rejected messages (they're silently logged)
    // But we can verify no crash by checking UI is still interactive
    await page.click('button:has-text("VALUATIONS")');
    await expect(page.getByText('CARD VALUATIONS')).toBeVisible();
  });
});

test.describe('Failure Path: Voucher Burn Rollback', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('rolls back voucher state when savings persistence fails after burn', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // First, add a voucher to the profile
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get('user-profile', (result) => {
          const profile = result['user-profile'];
          if (profile) {
            profile.vouchers = [{
              id: 'voucher-test-1',
              cardId: 'test-card',
              code: 'SAVE100',
              remainingValue: 10000,
              usedAmount: 0,
              expiryDate: Date.now() + 86400000 * 30,
            }];
            chrome.storage.local.set({ 'user-profile': profile }, () => resolve());
          } else {
            resolve();
          }
        });
      });
    });

    // Reload to pick up the voucher
    await page.reload();
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // Mock IndexedDB to fail on savings write but succeed on voucher update
    await page.evaluate(() => {
      const originalOpen = indexedDB.open.bind(indexedDB);
      let savingsDbFailed = false;

      indexedDB.open = (name: string, version?: number) => {
        if (name === 'payments-optimizer-savings') {
          const req = originalOpen(name, version);
          setTimeout(() => {
            if (req.onsuccess) {
              // After successful open, make the transaction fail
              const db = req.result;
              const originalTransaction = db.transaction.bind(db);
              db.transaction = (storeNames: string | string[], mode?: IDBTransactionMode) => {
                const tx = originalTransaction(storeNames, mode);
                const originalObjectStore = tx.objectStore.bind(tx);
                tx.objectStore = (storeName: string) => {
                  const store = originalObjectStore(storeName);
                  if (storeName === 'savings') {
                    const originalPut = store.put.bind(store);
                    store.put = (value: any, key?: IDBValidKey) => {
                      const req = originalPut(value, key);
                      setTimeout(() => {
                        if (req.onerror) {
                          const event = { target: { error: new Error('Simulated failure') } } as any;
                          req.onerror(event);
                        }
                      }, 0);
                      return req;
                    };
                  }
                  return store;
                };
                return tx;
              };
            }
          }, 0);
          return req;
        }
        return originalOpen(name, version);
      };
    });

    // Trigger confirmation that would burn the voucher
    await page.evaluate(() => {
      const msg = {
        type: 'CONFIRM_SAVINGS',
        payload: {
          merchantId: 'amazon',
          idempotencyKey: 'test-voucher-rollback-' + Date.now(),
          cartTotal: { amountMinor: '10000', currency: 'INR' },
          strategy: {
            id: 'test-strategy',
            immediateDiscount: { amountMinor: '10000', currency: 'INR' },
            rewardValue: { amountMinor: '0', currency: 'INR' },
            futureBenefit: { amountMinor: '0', currency: 'INR' },
            fees: { amountMinor: '0', currency: 'INR' },
            effectiveCost: { amountMinor: '0', currency: 'INR' },
            totalBenefit: { amountMinor: '10000', currency: 'INR' },
            confidence: 0.9,
            complexityScore: 1,
            stepDescriptions: [],
          },
          benefitsApplied: [{
            benefitId: 'voucher-test-1',
            benefitType: 'VOUCHER_REDEMPTION',
            benefitSourceId: 'voucher-test-1',
            benefitSourceName: 'Test Voucher',
            amountApplied: { amountMinor: '10000', currency: 'INR' },
          }],
        },
      };
      chrome.runtime.sendMessage(msg);
    });

    // Should show error banner
    await expect(page.getByText(/Failed to save/i)).toBeVisible({ timeout: 5000 });

    // Verify voucher state was rolled back (not consumed)
    const voucherState = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        chrome.storage.local.get('user-profile', (result) => {
          resolve(result['user-profile']?.vouchers?.[0]);
        });
      });
    });

    // Voucher should still have full remaining value (rollback worked)
    expect(voucherState?.remainingValue).toBe(10000);
    expect(voucherState?.usedAmount).toBe(0);
  });
});