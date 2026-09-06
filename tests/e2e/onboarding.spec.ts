import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('should complete onboarding with default profile', async ({ page }) => {
    // Navigate to popup
    await page.goto('http://localhost:5173/popup.html');

    // Check onboarding screen is displayed
    await expect(page.getByText('Welcome to PaymentsOptimizer')).toBeVisible();

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Should see dashboard after onboarding
    await expect(page.getByText('Active Shopping Vault')).toBeVisible();
  });

  test('should save user profile to storage', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Verify profile is saved
    const savedProfile = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('user-profile', (result) => {
          resolve(result['user-profile']);
        });
      });
    });

    expect(savedProfile).toBeDefined();
    expect(savedProfile.version).toBe(1);
    expect(savedProfile.currency).toBe('INR');
  });
});
