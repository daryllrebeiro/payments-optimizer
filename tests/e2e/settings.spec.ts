import { test, expect } from '@playwright/test';

test.describe('Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
    });
  });

  test('should save and load API key', async ({ page }) => {
    await page.goto('http://localhost:5173/popup.html');

    // Complete onboarding first
    await page.click('button:has-text("Continue")');

    // Navigate to settings
    await page.click('button:has-text("VALUATIONS")');

    // Save API key
    const testApiKey = 'AIzaSyTestKey12345678901234567890';
    await page.fill('input[placeholder="AIzaSy..."]', testApiKey);

    // Verify key was saved
    const savedKey = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('geminiApiKey', (result) => {
          resolve(result['geminiApiKey']);
        });
      });
    });

    expect(savedKey).toBe(testApiKey);
  });
});
