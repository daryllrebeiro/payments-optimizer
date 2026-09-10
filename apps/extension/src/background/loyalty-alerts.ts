/**
 * Loyalty Program Expiry Alert System
 * Feature 2: Daily background check for expiring loyalty program balances
 */

import { getLoyaltyRepository } from '@payments-optimizer/storage';
import type { LoyaltyProgramBalance } from '@payments-optimizer/domain';

export interface LoyaltyExpiryAlert {
  id: string;
  programName: string;
  balance: number;
  daysLeft: number;
  expiryDate: number;
}

const ALARM_NAME = 'check-loyalty-expiry';
const CHECK_INTERVAL_DAYS = 1; // daily

/**
 * Check for expiring loyalty program balances and return alerts
 */
export async function checkLoyaltyExpiry(): Promise<LoyaltyExpiryAlert[]> {
  const repo = getLoyaltyRepository();
  const all = await repo.getAll();
  const now = Date.now();
  const alerts: LoyaltyExpiryAlert[] = [];

  for (const balance of all) {
    if (!balance.expiryDate) continue;

    const daysLeft = Math.ceil((balance.expiryDate - Date.now()) / (24 * 60 * 60 * 1000));

    // Alert if expiring within 7 days or already expired
    if (daysLeft <= 7 && daysLeft >= -30) {
      alerts.push({
        id: `loyalty-expiry-${balance.id}`,
        programName: balance.programName,
        balance: balance.balance,
        daysLeft,
        expiryDate: balance.expiryDate!,
      });
    }
  }

  return alerts;
}

/**
 * Show notification for loyalty expiry alerts
 */
export async function showLoyaltyExpiryNotifications(alerts: LoyaltyExpiryAlert[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.notifications) return;

  for (const alert of alerts) {
    let title: string;
    let message: string;

    if (alert.daysLeft < 0) {
      title = `⚠️ ${alert.programName} Expired`;
      message = `${Math.abs(alert.daysLeft)} days ago (${alert.balance.toLocaleString()} pts)`;
    } else if (alert.daysLeft === 0) {
      title = `⏰ ${alert.programName} Expires Today`;
      message = `${alert.balance.toLocaleString()} points expire today!`;
    } else if (alert.daysLeft === 1) {
      title = `⏳ ${alert.programName} Expires Tomorrow`;
      message = `${alert.balance.toLocaleString()} points expire tomorrow`;
    } else {
      title = `📅 ${alert.programName} Expiring Soon`;
      message = `${alert.daysLeft} days left (${alert.balance.toLocaleString()} pts)`;
    }

    try {
      await chrome.notifications.create(alert.id, {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title,
        message,
        priority: alert.daysLeft <= 1 ? 2 : 1,
        requireInteraction: alert.daysLeft <= 1,
      });
    } catch (err) {
      console.warn('[PaymentsOptimizer] Failed to create notification:', err);
    }
  }
}

/**
 * Daily loyalty expiry check job
 */
export async function runDailyLoyaltyExpiryCheck(): Promise<void> {
  try {
    const alerts = await checkLoyaltyExpiry();
    if (alerts.length > 0) {
      await showLoyaltyExpiryNotifications(alerts);
      console.info(`[PaymentsOptimizer] Loyalty expiry check: ${alerts.length} alert(s) fired`);
    }
  } catch (err) {
    console.error('[PaymentsOptimizer] Loyalty expiry check failed:', err);
  }
}

/**
 * Initialize the daily loyalty expiry alarm
 */
export function initLoyaltyExpiryAlarm(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;

  chrome.alarms.create('loyalty-expiry-check', { periodInMinutes: 24 * 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'loyalty-expiry-check') {
      void runDailyLoyaltyExpiryCheck();
    }
  });
}

/**
 * Immediate check (for testing or manual trigger)
 */
export async function triggerLoyaltyExpiryCheckNow(): Promise<void> {
  await runDailyLoyaltyExpiryCheck();
}