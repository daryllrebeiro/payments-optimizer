import React, { useState } from 'react';
import type { UserProfile, PaymentMethod } from '@payments-optimizer/domain';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
} from '@payments-optimizer/test-fixtures';

interface CardCatalogManagerProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

interface CardTemplate {
  id: string;
  name: string;
  issuer: string;
  network: string;
  rewardProgram: string;
  rateDescription: string;
  method: PaymentMethod;
}

const TEMPLATES: CardTemplate[] = [
  {
    id: 'hdfc-millennia',
    name: 'HDFC Millennia Credit Card',
    issuer: 'HDFC',
    network: 'MASTERCARD',
    rewardProgram: 'HDFC Millennia Points',
    rateDescription: '5% on Amazon/Flipkart, 1% elsewhere',
    method: { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
  },
  {
    id: 'sbi-cashback',
    name: 'SBI Cashback Credit Card',
    issuer: 'SBI',
    network: 'VISA',
    rewardProgram: 'SBI Cashback Program',
    rateDescription: '5% on all online spends, 1% elsewhere',
    method: { type: 'CREDIT_CARD', card: sbiCashbackCard },
  },
  {
    id: 'axis-atlas',
    name: 'Axis Atlas Credit Card',
    issuer: 'AXIS',
    network: 'VISA',
    rewardProgram: 'Axis Edge Miles',
    rateDescription: '2% standard reward value (Axis Edge Miles)',
    method: { type: 'CREDIT_CARD', card: axisAtlasCard },
  },
];

export default function CardCatalogManager({ profile, onUpdateProfile }: CardCatalogManagerProps) {
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  const handleRemoveCard = (cardId: string) => {
    const updated = {
      ...profile,
      paymentMethods: profile.paymentMethods.filter(
        (m) => !(m.type === 'CREDIT_CARD' && m.card.id === cardId)
      ),
    };
    onUpdateProfile(updated);
  };

  const handleAddCard = (tmpl: CardTemplate) => {
    // Prevent duplicates
    const exists = profile.paymentMethods.some(
      (m) => m.type === 'CREDIT_CARD' && tmpl.method.type === 'CREDIT_CARD' && m.card.id === tmpl.method.card.id
    );
    if (exists) {
      setShowCatalogModal(false);
      return;
    }

    const updated = {
      ...profile,
      paymentMethods: [...profile.paymentMethods, tmpl.method],
    };

    // Add point valuation if missing
    if (!profile.rewardPreferences.defaultValuations[tmpl.rewardProgram]) {
      updated.rewardPreferences = {
        ...profile.rewardPreferences,
        defaultValuations: {
          ...profile.rewardPreferences.defaultValuations,
          [tmpl.rewardProgram]: { amountMinor: 100n, currency: profile.currency } as unknown as import('@payments-optimizer/domain').Money,
        },
      };
    }

    onUpdateProfile(updated);
    setShowCatalogModal(false);
  };

  const handleUpdateSpend = (cardId: string, amountStr: string) => {
    const numeric = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(numeric) || numeric < 0) return;

    const updated = {
      ...profile,
      paymentMethods: profile.paymentMethods.map((m) => {
        if (m.type === 'CREDIT_CARD' && m.card.id === cardId) {
          return {
            ...m,
            card: {
              ...m.card,
              userState: {
                ...m.card.userState,
                isAvailable: true,
                currentStatementSpend: m.card.userState?.currentStatementSpend ?? { amountMinor: 0n, currency: profile.currency },
                monthlySpendToDate: m.card.userState?.monthlySpendToDate ?? { amountMinor: 0n, currency: profile.currency },
                annualSpendToDate: {
                  amountMinor: BigInt(Math.round(numeric * 100)),
                  currency: profile.currency,
                },
              },
            },
          };
        }
        return m;
      }),
    };
    onUpdateProfile(updated);
  };

  return (
    <div className="slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '0' }}>Active Cards ({profile.paymentMethods.length})</h2>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '11px', flex: 'none' }}
          onClick={() => setShowCatalogModal(true)}
        >
          + Add Card
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {profile.paymentMethods.map((m, idx) => {
          if (m.type !== 'CREDIT_CARD') return null;
          const card = m.card;
          const spend = Number(card.userState?.annualSpendToDate?.amountMinor || 0n) / 100;
          return (
            <div key={idx} className="glass-panel" style={{ padding: '14px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontStyle: 'normal', fontWeight: 700, fontSize: '13px' }}>
                    {card.issuer} {card.productName}
                  </h3>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{card.rewardProgram}</span>
                </div>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                  onClick={() => handleRemoveCard(card.id)}
                >
                  Remove
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label" style={{ fontSize: '10px', marginBottom: '4px' }}>Annual Spend Progress ({profile.currency})</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={spend.toLocaleString()}
                  onChange={(e) => handleUpdateSpend(card.id, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {showCatalogModal && (
        <div className="simulator-modal">
          <div className="glass-panel simulator-panel" style={{ maxHeight: '350px' }}>
            <div className="simulator-header">
              <h2 className="simulator-title">Card Registry Catalog</h2>
              <button className="close-btn" onClick={() => setShowCatalogModal(false)}>×</button>
            </div>
            <div className="catalog-list">
              {TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="catalog-card-item"
                  style={{ padding: '10px' }}
                  onClick={() => handleAddCard(tmpl)}
                >
                  <div className="card-info">
                    <span className="card-title" style={{ fontSize: '12px' }}>{tmpl.name}</span>
                    <span className="card-meta" style={{ fontSize: '10px' }}>{tmpl.rateDescription}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>+ ADD</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
