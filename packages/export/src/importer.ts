import type { StrategyImport } from './types';

/**
 * Import strategy from JSON format
 */
export function importStrategy(json: string): StrategyImport {
  try {
    const data = JSON.parse(json) as StrategyImport;
    return data;
  } catch (err) {
    throw new Error(`Failed to parse strategy: ${(err as Error).message}`);
  }
}

/**
 * Import strategy from CSV format
 */
export function importFromCSV(csv: string): StrategyImport {
  const lines = csv.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  // Skip header line
  const dataLines = lines.slice(1);
  
  const strategies = dataLines.map((line, idx) => {
    // Simple CSV parsing (assumes no commas in quoted values)
    const fields = line.split(',').map((f) => f.trim().replace(/^"|"$/g, ''));
    
    return {
      id: fields[0],
      steps: [],
      immediateDiscount: { amountMinor: BigInt(Math.round(parseFloat(fields[1]) * 100)).toString(), currency: 'INR' },
      rewardValue: { amountMinor: BigInt(Math.round(parseFloat(fields[2]) * 100)).toString(), currency: 'INR' },
      totalBenefit: { amountMinor: BigInt(Math.round(parseFloat(fields[3]) * 100)).toString(), currency: 'INR' },
      confidence: parseFloat(fields[4]),
    };
  });

  return {
    version: '0.6.0',
    strategies,
  };
}

/**
 * Import strategy from Excel format
 * Note: For production, use 'xlsx' library for .xlsx import
 */
export function importFromExcel(xlsxData: string): StrategyImport {
  // For now, treat as CSV - actual .xlsx would require xlsx library
  return importFromCSV(xlsxData);
}
