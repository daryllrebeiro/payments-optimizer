import { test, expect } from '@playwright/test';

test.describe('Optimization Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('should display best payment strategy', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Verify dashboard displays recommendations
    await expect(page.getByText('Best Way to Pay')).toBeVisible();

    // Check savings highlight is visible
    await expect(page.locator('.savings-highlight')).toBeVisible();
  });

  test('should show alternative options when available', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding
    await page.click('button:has-text("Continue")');

    // Open simulator to test alternatives
    await page.click('button:has-text("Open What-If Simulator")');

    // Check simulator panel is visible
    await expect(page.locator('.simulator-panel')).toBeVisible();
  });
});
