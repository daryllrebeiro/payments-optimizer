import React, { useState, useMemo } from 'react';
import type { SavingsEntry } from '@payments-optimizer/storage';
import type { Currency } from '@payments-optimizer/domain';

interface SavingsHistoryProps {
  entries: SavingsEntry[];
  currency: Currency;
}

export default function SavingsHistory({ entries, currency }: SavingsHistoryProps) {
  const currencySym = currency === 'INR' ? '₹' : currency + ' ';
  const [filterMerchant, setFilterMerchant] = useState<string>('');

  // Get unique merchants
  const merchants = useMemo(() => {
    const unique = new Set(entries.map((e) => e.merchantId));
    return ['All', ...Array.from(unique).sort()];
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!filterMerchant || filterMerchant === 'All') {
      return entries;
    }
    return entries.filter((e) => e.merchantId === filterMerchant);
  }, [entries, filterMerchant]);

  // Get last 10 entries for quick view
  const recentEntries = useMemo(() => {
    return filteredEntries.slice(0, 10);
  }, [filteredEntries]);

  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title" style={{ fontSize: '14px', marginBottom: '0' }}>
          📊 Savings History ({filteredEntries.length})
        </h2>

        {merchants.length > 2 && (
          <select
            value={filterMerchant}
            onChange={(e) => setFilterMerchant(e.target.value)}
            style={{
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--glass-border)',
              backgroundColor: 'var(--glass-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredEntries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          <p>No savings yet. Optimize payments to see your savings history.</p>
        </div>
      ) : (
        <div
          className="steps-list"
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '8px',
          }}
        >
          {recentEntries.map((entry, idx) => {
            const savings = Number(BigInt(entry.savings.amountMinor)) / 100;
            const date = new Date(entry.timestamp);

            return (
              <div
                key={`${entry.id}-${idx}`}
                className="step-item"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, fontSize: '11px' }}>{entry.merchantId}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    {date.toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Cart: {currencySym}
                    {(Number(BigInt(entry.cartTotal.amountMinor)) / 100).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '11px',
                      color: '#22c55e',
                    }}
                  >
                    +{currencySym}
                    {savings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                {entry.selectedStrategy.id && (
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    Strategy: {entry.selectedStrategy.id.split('-')[1]?.toUpperCase() ?? 'Unknown'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filteredEntries.length > 10 && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Showing last 10 of {filteredEntries.length} entries
          </span>
        </div>
      )}
    </div>
  );
}
