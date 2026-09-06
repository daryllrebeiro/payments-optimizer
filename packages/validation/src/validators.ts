import type { Money, Currency } from '@payments-optimizer/domain';
import { ValidationError, ValidationSummary } from './errors';
import { ok, err, type ValidateResult } from './result';

// Extend Currency type to include additional currencies
type ExtendedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD' | 'AED' | 'CAD' | 'AUD';

const CURRENCIES: ExtendedCurrency[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED', 'CAD', 'AUD'];

/**
 * Validate money object
 */
export function validateMoney(amount: unknown): ValidateResult<Money, ValidationError> {
  const summary = new ValidationSummary();

  if (typeof amount !== 'object' || amount === null) {
    return err(new ValidationError('Money must be an object'));
  }

  const money = amount as { amountMinor: unknown; currency: unknown };

  // Validate amountMinor
  if (money.amountMinor === undefined) {
    summary.add(new ValidationError('amountMinor is required', 'amountMinor'));
  } else if (typeof money.amountMinor !== 'bigint' && typeof money.amountMinor !== 'string') {
    summary.add(new ValidationError('amountMinor must be bigint or string', 'amountMinor', money.amountMinor));
  }

  // Validate currency
  if (money.currency === undefined) {
    summary.add(new ValidationError('currency is required', 'currency'));
  } else if (!CURRENCIES.includes(money.currency as Currency)) {
    summary.add(new ValidationError(`Invalid currency: ${money.currency}`, 'currency', money.currency));
  }

  if (summary.hasErrors()) {
    return err(summary.getFirstError()!);
  }

  const validated: Money = {
    amountMinor: typeof money.amountMinor === 'bigint' ? money.amountMinor : BigInt(Number(money.amountMinor)),
    currency: money.currency as Currency,
  };

  return ok(validated);
}

/**
 * Validate currency string
 */
export function validateCurrency(currency: unknown): ValidateResult<ExtendedCurrency, ValidationError> {
  if (typeof currency !== 'string') {
    return err(new ValidationError('Currency must be a string', 'currency', currency));
  }

  if (!CURRENCIES.includes(currency as ExtendedCurrency)) {
    return err(new ValidationError(`Invalid currency: ${currency}`, 'currency', currency));
  }

  return ok(currency as ExtendedCurrency);
}

/**
 * Validate expiry date string
 */
export function validateExpiryDate(dateStr: unknown): ValidateResult<string, ValidationError> {
  if (typeof dateStr !== 'string') {
    return err(new ValidationError('Expiry date must be a string', 'expiryDate', dateStr));
  }

  const trimmed = dateStr.trim();
  if (trimmed.length === 0) {
    return err(new ValidationError('Expiry date cannot be empty', 'expiryDate', dateStr));
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return err(new ValidationError('Expiry date is not a valid date', 'expiryDate', dateStr));
  }

  if (parsed.getTime() < Date.now()) {
    return err(new ValidationError('Expiry date is in the past', 'expiryDate', dateStr));
  }

  // Validate ISO 8601 format
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(trimmed)) {
    return err(new ValidationError('Expiry date must be in ISO 8601 format', 'expiryDate', dateStr));
  }

  return ok(dateStr);
}

/**
 * Validate array of money objects
 */
export function validateMoneyArray(amounts: unknown): ValidateResult<Money[], ValidationError[]> {
  if (!Array.isArray(amounts)) {
    return err([new ValidationError('Expected an array of money objects')]);
  }

  const results: ValidateResult<Money, ValidationError>[] = amounts.map(validateMoney);
  const errors: ValidationError[] = [];

  for (const result of results) {
    if (result.isErr()) {
      errors.push(result.unwrapErr());
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  return ok(results.map((r) => r.unwrap()));
}
