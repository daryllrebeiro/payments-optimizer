import React from 'react';
import type { Currency } from '@payments-optimizer/domain';

interface SavingsSummaryProps {
  totalEntries: number;
  totalSaved: number;
  avgSavingsPerOrder: number;
  merchantBreakdown: Record<string, { count: number; totalSaved: number }>;
  currency: Currency;
}

export default function SavingsSummary({
  totalEntries,
  totalSaved,
  avgSavingsPerOrder,
  merchantBreakdown,
  currency,
}: SavingsSummaryProps) {
  const currencySym = currency === 'INR' ? '₹' : currency + ' ';

  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
      <h2 className="section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>
        💰 Savings Summary
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div
          className="glass-panel"
          style={{
            padding: '12px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>
            {currencySym}
            {totalSaved.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px' }}>Total Saved</div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
            {currencySym}
            {avgSavingsPerOrder.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>Avg Per Order</div>
        </div>
      </div>

      {totalEntries > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Optimizations: {totalEntries}
          </div>

          {Object.keys(merchantBreakdown).length > 0 && (
            <div
              style={{
                maxHeight: '120px',
                overflowY: 'auto',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
              }}
            >
              {Object.entries(merchantBreakdown)
                .slice(0, 5)
                .map(([merchantId, data]) => (
                  <div
                    key={merchantId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      fontSize: '11px',
                      borderBottom: '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{merchantId}</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{data.count} ops</span>
                      <span style={{ fontWeight: 600, color: '#22c55e' }}>
                        {currencySym}
                        {data.totalSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
