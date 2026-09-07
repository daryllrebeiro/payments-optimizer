import React, { useState, useEffect } from 'react';
import type { Currency, Money } from '@payments-optimizer/domain';

/**
 * Local-first, deterministic currency conversion using a fixed snapshot of
 * indicative rates (per unit of currency in INR minor-value terms).
 * No network call: this preserves the product's zero-egress default.
 */
const FIXED_RATES: Record<Currency, number> = {
  INR: 1,
  USD: 83.2,
  EUR: 90.5,
  GBP: 105.6,
  JPY: 0.56,
  SGD: 61.8,
  AED: 22.65,
};

export interface ConvertedMoney {
  amountMinor: bigint;
  currency: Currency;
  rate: number;
  timestamp: number;
}

export function convertMoney(
  money: Money,
  targetCurrency: Currency
): Promise<ConvertedMoney> {
  const sourceRate = FIXED_RATES[money.currency];
  const targetRate = FIXED_RATES[targetCurrency];
  const rate = sourceRate / targetRate;
  const convertedMinor = BigInt(Math.round(Number(money.amountMinor) * rate));
  return Promise.resolve({
    amountMinor: convertedMinor,
    currency: targetCurrency,
    rate,
    timestamp: Date.now(),
  });
}

interface CurrencySelectorProps {
  value: Currency;
  onChange: (currency: Currency) => void;
}

function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  const currencies: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED'];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
      style={{
        padding: '8px',
        fontSize: '13px',
        borderRadius: '6px',
        border: '1px solid var(--glass-border)',
        backgroundColor: 'var(--glass-bg)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      {currencies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

interface CurrencyConverterProps {
  amountMinor: bigint;
  currency: Currency;
  onConverted: (converted: ConvertedMoney) => void;
}

function CurrencyConverter({ amountMinor, currency, onConverted }: CurrencyConverterProps) {
  const [targetCurrency, setTargetCurrency] = useState<Currency>('USD');
  const [converted, setConverted] = useState<ConvertedMoney | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const doConvert = async () => {
      setLoading(true);
      try {
        const result = await convertMoney({ amountMinor, currency }, targetCurrency);
        setConverted(result);
        onConverted(result);
      } catch (err) {
        console.error('Failed to convert:', err);
      } finally {
        setLoading(false);
      }
    };
    doConvert();
  }, [amountMinor, currency, targetCurrency, onConverted]);

  const amountMajor = Number(amountMinor) / 100;
  const convertedMajor = converted ? Number(converted.amountMinor) / 100 : 0;

  return (
    <div
      className="glass-panel"
      style={{ padding: '16px', borderRadius: '8px', marginBottom: '16px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>urrency Conversion</h3>
        <CurrencySelector value={targetCurrency} onChange={setTargetCurrency} />
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80px',
          }}
        >
          <div className="diagnostics-spinner"></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Original Amount ({currency})
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>
              {currency === 'INR' ? '₹' : currency + ' '}{amountMajor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Converted Amount ({targetCurrency})
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e' }}>
              {targetCurrency === 'INR' ? '₹' : targetCurrency + ' '}{convertedMajor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {converted && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Rate: 1 {currency} = {converted.rate.toFixed(4)} {targetCurrency}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MultiCurrencyDashboard({
  cartTotal,
  originalCurrency,
}: {
  cartTotal: Money;
  originalCurrency: Currency;
}) {
  const [convertedTotal, setConvertedTotal] = useState<ConvertedMoney | null>(null);

  return (
    <div className="slide-in">
      <div
        className="glass-panel"
        style={{ padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--brand-primary)' }}
      >
        <h2 className="section-title" style={{ fontSize: '16px', marginBottom: '4px' }}>
          🌍 Multi-Currency Dashboard
        </h2>
        <p className="section-desc" style={{ marginBottom: '0', fontSize: '12px' }}>
          View your cart total in multiple currencies.
        </p>
      </div>

      <CurrencyConverter
        amountMinor={cartTotal.amountMinor}
        currency={originalCurrency}
        onConverted={setConvertedTotal}
      />

      {convertedTotal && (
        <div
          className="glass-panel"
          style={{ padding: '16px', borderRadius: '8px' }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Currency Conversion Rate
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Rate source: Fixed rates (cached)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{originalCurrency} to {convertedTotal.currency}</span>
            <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
              1 {originalCurrency} = {convertedTotal.rate.toFixed(4)} {convertedTotal.currency}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Timestamp</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {new Date(convertedTotal.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
