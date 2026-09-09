import { z } from 'zod';
import type { StrategyImport } from './types.js';

/**
 * F18: validated imports.
 *
 * Root cause being fixed: `importStrategy` blindly `JSON.parse` + cast, and
 * `importFromCSV` used bare `parseFloat`/`Math.round(NaN)`/hardcoded INR —
 * a malformed file either threw an uncaught TypeError deep in the stack or
 * was accepted as wrong-but-plausible data.
 *
 * All import functions return structured results and never throw.
 */

export type ImportResult =
  | { ok: true; data: StrategyImport }
  | { ok: false; errors: string[] };

// F6-aligned money bounds for imported data (non-negative only — imported
// strategy benefits are savings data, negative values are corruption)
const AMOUNT_MINOR_PATTERN = /^\d{1,17}$/;

const SerializedMoneySchema = z
  .object({
    amountMinor: z.string(),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']),
  })
  .superRefine((money, ctx) => {
    if (!AMOUNT_MINOR_PATTERN.test(money.amountMinor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `amountMinor must be a plain integer string, got "${money.amountMinor}"`,
        path: ['amountMinor'],
      });
    }
  });

const ImportedStrategySchema = z.object({
  id: z.string().min(1).max(200),
  steps: z.array(z.unknown()).max(100),
  immediateDiscount: SerializedMoneySchema,
  rewardValue: SerializedMoneySchema,
  totalBenefit: SerializedMoneySchema,
  confidence: z.number().min(0).max(1),
});

const StrategyImportSchema = z.object({
  version: z.string().min(1).max(20),
  strategies: z.array(ImportedStrategySchema).max(10_000),
});

/**
 * Import strategy from JSON format — validated, structured errors.
 */
export function importStrategy(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }

  const outcome = StrategyImportSchema.safeParse(parsed);
  if (!outcome.success) {
    return {
      ok: false,
      errors: outcome.error.issues.map(
        (issue) =>
          `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`
      ),
    };
  }

  // Referential integrity: the import must be internally consistent
  const data: StrategyImport = outcome.data;
  const errors: string[] = [];
  const seenIds = new Set<string>();
  data.strategies.forEach((strategy, index) => {
    if (seenIds.has(strategy.id)) {
      errors.push(`strategies[${index}]: duplicate strategy id "${strategy.id}"`);
    }
    seenIds.add(strategy.id);
    const currencies = new Set(
      [strategy.immediateDiscount, strategy.rewardValue, strategy.totalBenefit].map(
        (m) => m.currency
      )
    );
    if (currencies.size > 1) {
      errors.push(
        `strategies[${index}] ("${strategy.id}"): mixed currencies ${[...currencies].join(', ')}`
      );
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data };
}

/**
 * Parse a decimal-string money amount with full validation. Returns a
 * structured error instead of NaN poisoning the pipeline.
 */
function parseAmountMinor(raw: string, field: string, row: number): { amountMinor?: bigint; error?: string } {
  const trimmed = raw.trim();
  // Accept plain decimal major units (e.g. "150.50"); reject anything else
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(trimmed)) {
    return {
      error: `row ${row}: ${field} must be a plain decimal number (e.g. "150.50"), got "${raw.trim()}"`,
    };
  }
  // Convert major units to minor units without float error: shift the
  // decimal point in the string domain, then BigInt.
  const [whole, frac = ''] = trimmed.split('.');
  const paddedFrac = (frac + '00').slice(0, 2);
  return { amountMinor: BigInt(whole + paddedFrac) };
}

/**
 * Import strategies from CSV format.
 * Columns: id,immediateDiscount,rewardValue,totalBenefit,confidence[,currency]
 */
export function importFromCSV(csv: string): ImportResult {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    return { ok: false, errors: ['CSV must have a header and at least one data row'] };
  }

  // Parse the header, honoring the optional currency column (F18: no more
  // hardcoded INR).
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const expected = ['id', immediatediscount_label(), rewardvalue_label(), totalbenefit_label(), 'confidence'];
  if (header.slice(0, 5).join(',') !== expected.join(',')) {
    return {
      ok: false,
      errors: [
        `CSV header must start with ${expected.join(',')}${header.length > 5 ? '' : ' (optionally followed by currency)'}`,
      ],
    };
  }
  const hasCurrencyColumn = header.length > 5 && header[5] === 'currency';

  const strategies: StrategyImport['strategies'] = [];
  const errors: string[] = [];

  const dataLines = lines.slice(1);
  dataLines.forEach((line, rowIdx) => {
    const row = rowIdx + 2; // human-friendly row number (1-based + header)
    const fields = line.split(',').map((f) => f.trim().replace(/^"|"$/g, ''));
    const currency = hasCurrencyColumn ? fields[5] : 'INR';
    if (
      !['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED'].includes(currency ?? '')
    ) {
      errors.push(`row ${row}: unsupported currency "${currency ?? '(missing)'}"`);
      return;
    }

    const parsedMoney = [
      { label: 'immediateDiscount', raw: fields[1] },
      { label: 'rewardValue', raw: fields[2] },
      { label: 'totalBenefit', raw: fields[3] },
    ].map(({ label, raw }) => ({ label, raw, parsed: parseAmountMinor(raw ?? '', label, row) }));

    for (const { parsed } of parsedMoney) {
      if (parsed.error) {
        errors.push(parsed.error);
        return;
      }
    }

    const confidence = Number((fields[4] ?? '').trim());
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      errors.push(
        `row ${row}: confidence must be a number between 0 and 1, got "${(fields[4] ?? '').trim()}"`
      );
      return;
    }

    const [immediate, reward, total] = parsedMoney.map((m) => m.parsed.amountMinor!);

    strategies.push({
      id: fields[0] ?? '',
      steps: [],
      immediateDiscount: { amountMinor: immediate!.toString(), currency: currency! },
      rewardValue: { amountMinor: reward!.toString(), currency: currency! },
      totalBenefit: { amountMinor: total!.toString(), currency: currency! },
      confidence,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: { version: '0.6.0', strategies } };
}

// Header label helpers kept trivial to mirror the historical column names
function immediatediscount_label(): string {
  return 'immediatediscount';
}
function rewardvalue_label(): string {
  return 'rewardvalue';
}
function totalbenefit_label(): string {
  return 'totalbenefit';
}

/**
 * Import strategy from Excel format.
 * Note: For production, use 'xlsx' library for .xlsx import
 */
export function importFromExcel(xlsxData: string): ImportResult {
  // For now, treat as CSV - actual .xlsx would require xlsx library
  return importFromCSV(xlsxData);
}
