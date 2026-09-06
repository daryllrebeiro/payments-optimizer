import type { SavingsEntry } from './types';

/**
 * Calculates aggregated savings metrics from savings entries
 */
export class SavingsCalculator {
  /**
   * Calculate total savings across all entries
   */
  static calculateTotalSaved(entries: SavingsEntry[]): number {
    let total = 0n;
    for (const entry of entries) {
      total += BigInt(entry.savings.amountMinor);
    }
    return Number(total) / 100;
  }

  /**
   * Calculate average savings per order
   */
  static calculateAverageSavings(entries: SavingsEntry[]): number {
    if (entries.length === 0) {
      return 0;
    }
    return this.calculateTotalSaved(entries) / entries.length;
  }

  /**
   * Calculate maximum single-order savings
   */
  static calculateMaxSavings(entries: SavingsEntry[]): number {
    if (entries.length === 0) {
      return 0;
    }
    let max = 0;
    for (const entry of entries) {
      const savings = Number(BigInt(entry.savings.amountMinor)) / 100;
      if (savings > max) {
        max = savings;
      }
    }
    return max;
  }

  /**
   * Calculate minimum single-order savings
   */
  static calculateMinSavings(entries: SavingsEntry[]): number {
    if (entries.length === 0) {
      return 0;
    }
    let min = Number.MAX_SAFE_INTEGER;
    for (const entry of entries) {
      const savings = Number(BigInt(entry.savings.amountMinor)) / 100;
      if (savings < min) {
        min = savings;
      }
    }
    return min;
  }

  /**
   * Calculate savings by merchant
   */
  static calculateByMerchant(entries: SavingsEntry[]): Record<string, number> {
    const byMerchant: Record<string, bigint> = {};
    for (const entry of entries) {
      byMerchant[entry.merchantId] = (byMerchant[entry.merchantId] || 0n) + BigInt(entry.savings.amountMinor);
    }
    const result: Record<string, number> = {};
    for (const [merchantId, totalMinor] of Object.entries(byMerchant)) {
      result[merchantId] = Number(totalMinor) / 100;
    }
    return result;
  }

  /**
   * Calculate savings by day of week
   */
  static calculateByDayOfWeek(entries: SavingsEntry[]): Record<string, number> {
    const byDay: Record<string, bigint> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const dayName = dayNames[date.getDay()];
      byDay[dayName] = (byDay[dayName] || 0n) + BigInt(entry.savings.amountMinor);
    }

    const result: Record<string, number> = {};
    for (const [dayName, totalMinor] of Object.entries(byDay)) {
      result[dayName] = Number(totalMinor) / 100;
    }
    return result;
  }

  /**
   * Calculate savings by hour of day
   */
  static calculateByHour(entries: SavingsEntry[]): Record<string, number> {
    const byHour: Record<string, bigint> = {};

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const hour = String(date.getHours()).padStart(2, '0');
      const hourKey = `${hour}:00-${hour}:59`;
      byHour[hourKey] = (byHour[hourKey] || 0n) + BigInt(entry.savings.amountMinor);
    }

    const result: Record<string, number> = {};
    for (const [hourKey, totalMinor] of Object.entries(byHour)) {
      result[hourKey] = Number(totalMinor) / 100;
    }
    return result;
  }

  /**
   * Calculate success rate (optimizations with savings > 0)
   */
  static calculateSuccessRate(entries: SavingsEntry[]): number {
    if (entries.length === 0) {
      return 100;
    }
    const successful = entries.filter((e) => Number(BigInt(e.savings.amountMinor)) > 0).length;
    return (successful / entries.length) * 100;
  }

  /**
   * Calculate average confidence score for successful optimizations
   */
  static calculateAverageConfidence(entries: SavingsEntry[]): number {
    const successful = entries.filter((e) => Number(BigInt(e.savings.amountMinor)) > 0);
    if (successful.length === 0) {
      return 0;
    }
    const totalConfidence = successful.reduce((sum, e) => sum + e.selectedStrategy.confidence, 0);
    return totalConfidence / successful.length;
  }

  /**
   * Calculate trend (savings comparison between first half and second half of entries)
   */
  static calculateTrend(entries: SavingsEntry[]): {
    firstHalf: number;
    secondHalf: number;
    growthPercentage: number;
  } {
    if (entries.length === 0) {
      return { firstHalf: 0, secondHalf: 0, growthPercentage: 0 };
    }

    const midpoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, midpoint);
    const secondHalf = entries.slice(midpoint);

    const firstHalfTotal = this.calculateTotalSaved(firstHalf);
    const secondHalfTotal = this.calculateTotalSaved(secondHalf);

    const growthPercentage =
      firstHalfTotal > 0 ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100 : 0;

    return {
      firstHalf: firstHalfTotal,
      secondHalf: secondHalfTotal,
      growthPercentage,
    };
  }

  /**
   * Calculate top benefiting strategies by total savings
   */
  static calculateTopStrategies(entries: SavingsEntry[], limit: number = 5): Array<{
    strategyId: string;
    totalSavings: number;
    occurrenceCount: number;
  }> {
    const byStrategy: Record<string, { total: bigint; count: number }> = {};

    for (const entry of entries) {
      const id = entry.selectedStrategy.id;
      if (!byStrategy[id]) {
        byStrategy[id] = { total: 0n, count: 0 };
      }
      byStrategy[id].total += BigInt(entry.savings.amountMinor);
      byStrategy[id].count++;
    }

    const result = Object.entries(byStrategy)
      .map(([strategyId, { total, count }]) => ({
        strategyId,
        totalSavings: Number(total) / 100,
        occurrenceCount: count,
      }))
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .slice(0, limit);

    return result;
  }

  /**
   * Generate comprehensive savings report
   */
  static generateReport(entries: SavingsEntry[]): {
    summary: {
      totalEntries: number;
      totalSaved: number;
      avgSavingsPerOrder: number;
      maxSavings: number;
      minSavings: number;
      successRate: number;
      avgConfidence: number;
      firstHalfTotal: number;
      secondHalfTotal: number;
      growthPercentage: number;
    };
    breakdown: {
      byMerchant: Record<string, number>;
      byDayOfWeek: Record<string, number>;
      byHour: Record<string, number>;
    };
    topStrategies: Array<{
      strategyId: string;
      totalSavings: number;
      occurrenceCount: number;
    }>;
  } {
    const summary = {
      totalEntries: entries.length,
      totalSaved: this.calculateTotalSaved(entries),
      avgSavingsPerOrder: this.calculateAverageSavings(entries),
      maxSavings: this.calculateMaxSavings(entries),
      minSavings: this.calculateMinSavings(entries),
      successRate: this.calculateSuccessRate(entries),
      avgConfidence: this.calculateAverageConfidence(entries),
      firstHalfTotal: this.calculateTrend(entries).firstHalf,
      secondHalfTotal: this.calculateTrend(entries).secondHalf,
      growthPercentage: this.calculateTrend(entries).growthPercentage,
    };

    const breakdown = {
      byMerchant: this.calculateByMerchant(entries),
      byDayOfWeek: this.calculateByDayOfWeek(entries),
      byHour: this.calculateByHour(entries),
    };

    const topStrategies = this.calculateTopStrategies(entries);

    return {
      summary,
      breakdown,
      topStrategies,
    };
  }
}
