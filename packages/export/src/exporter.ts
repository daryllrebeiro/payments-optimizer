import type { StrategyExport } from './types';
import type { PaymentStrategy, Currency } from '@payments-optimizer/domain';

const EXTENSION_VERSION = '0.6.0';

/**
 * Export a single strategy to JSON format
 */
export function exportStrategy(strategy: PaymentStrategy, merchantId: string): string {
  const exportData: StrategyExport = {
    header: {
      extensionVersion: EXTENSION_VERSION,
      exportDate: new Date().toISOString(),
      merchantId,
      totalStrategies: 1,
    },
    strategies: [
      {
        id: strategy.id,
        immediateDiscount: {
          amountMinor: strategy.immediateDiscount.amountMinor.toString(),
          currency: strategy.immediateDiscount.currency,
        },
        rewardValue: {
          amountMinor: strategy.rewardValue.amountMinor.toString(),
          currency: strategy.rewardValue.currency,
        },
        totalBenefit: {
          amountMinor: strategy.totalBenefit.amountMinor.toString(),
          currency: strategy.totalBenefit.currency,
        },
        confidence: strategy.confidence,
        complexityScore: strategy.complexityScore,
        steps: strategy.steps.map((s) => ({
          type: s.type,
          amount: {
            amountMinor: s.amount.amountMinor.toString(),
            currency: s.amount.currency,
          },
          paymentMethod: s.paymentMethod,
          description: s.description,
        })),
        recipeSteps: (strategy as any).recipeSteps?.map((s: any) => ({
          stepNumber: s.stepNumber,
          phase: s.phase,
          actionType: s.actionType,
          benefitSourceId: s.benefitSourceId,
          benefitSourceName: s.benefitSourceName,
          description: s.description,
          amountApplied: {
            amountMinor: s.amountApplied.amountMinor.toString(),
            currency: s.amountApplied.currency,
          },
          savingsGenerated: {
            amountMinor: s.savingsGenerated.amountMinor.toString(),
            currency: s.savingsGenerated.currency,
          },
        })),
      },
    ],
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export multiple strategies to CSV format
 */
export function exportToCSV(strategies: PaymentStrategy[], merchantId: string, currency: Currency): string {
  const headers = [
    'Strategy ID',
    'Immediate Discount',
    'Reward Value',
    'Total Benefit',
    'Confidence',
    'Complexity',
    'Net Cost',
  ];

  const rows = [headers.join(',')];

  for (const strategy of strategies) {
    const immediateDiscount = Number(strategy.immediateDiscount.amountMinor) / 100;
    const rewardValue = Number(strategy.rewardValue.amountMinor) / 100;
    const totalBenefit = Number(strategy.totalBenefit.amountMinor) / 100;
    const netCost = Number(strategy.effectiveCost.amountMinor) / 100;

    const row = [
      `"${strategy.id}"`,
      `${immediateDiscount.toFixed(2)}`,
      `${rewardValue.toFixed(2)}`,
      `${totalBenefit.toFixed(2)}`,
      `${strategy.confidence.toFixed(2)}`,
      `${strategy.complexityScore}`,
      `${netCost.toFixed(2)}`,
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Export strategies to Excel (.xlsx) format
 * Note: For production, use 'xlsx' library for .xlsx export
 */
export function exportToExcel(strategies: PaymentStrategy[], merchantId: string, currency: Currency): string {
  // For now, return CSV - actual .xlsx would require xlsx library
  // This is a placeholder for Excel export
  return exportToCSV(strategies, merchantId, currency);
}
