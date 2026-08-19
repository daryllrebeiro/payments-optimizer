import React, { useState } from 'react';
import type { UserProfile, Cart } from '@payments-optimizer/domain';
import { generateCandidates, filterDominated, rankStrategies } from '@payments-optimizer/optimizer';
import { hdfcInstantDiscountOffer, amazonCoupon } from '@payments-optimizer/test-fixtures';
import type { ActiveRecommendation } from './App.js';
import { serializeStrategy, SerializedStrategy } from '../types/messages.js';

interface DashboardProps {
  profile: UserProfile;
  recommendation: ActiveRecommendation | null;
}

export default function Dashboard({ profile, recommendation }: DashboardProps) {
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedTotal, setSimulatedTotal] = useState<string>('');
  const [simulatedStrategies, setSimulatedStrategies] = useState<SerializedStrategy[]>([]);
  const [simulatedBest, setSimulatedBest] = useState<SerializedStrategy | null>(null);
  const [activeMerchant, setActiveMerchant] = useState<string>('');

  // Setup simulator state from the active recommendation
  const openSimulator = () => {
    if (!recommendation) return;
    const initialAmt = (Number(recommendation.cartTotal.amountMinor) / 100).toString();
    setSimulatedTotal(initialAmt);
    setActiveMerchant(recommendation.merchantId);
    
    // Run initial local calculations using popup imports
    runSimulation(initialAmt, recommendation.merchantId);
    setShowSimulator(true);
  };

  const runSimulation = (amountStr: string, merchantId: string) => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    const currency = profile.currency;
    const amountMinor = BigInt(Math.round(amt * 100));

    // Construct mock cart representing the simulation parameters
    const cart: Cart = {
      merchantId,
      items: [
        {
          id: 'simulated-item',
          name: 'Simulated Item',
          price: { amountMinor, currency },
          quantity: 1,
        },
      ],
      subtotal: { amountMinor, currency },
      discounts: [],
      shipping: { amountMinor: 0n, currency },
      taxes: { amountMinor: 0n, currency },
      total: { amountMinor, currency },
      currency,
    };

    // Run core engine optimizer
    const candidates = generateCandidates(
      cart,
      profile,
      [hdfcInstantDiscountOffer],
      [amazonCoupon]
    );
    const pruned = filterDominated(candidates);
    const ranked = rankStrategies(pruned, profile.optimizationPreferences);

    const serialized = ranked.map(serializeStrategy);
    setSimulatedStrategies(serialized);
    setSimulatedBest(serialized[0] ?? null);
  };

  const handleSimulatedTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSimulatedTotal(val);
    runSimulation(val, activeMerchant);
  };

  // If a recommendation exists for the current tab, show the optimization screen
  if (recommendation && !showSimulator) {
    const best = recommendation.bestStrategy;
    const totalCost = Number(recommendation.cartTotal.amountMinor) / 100;
    const currencySym = recommendation.cartTotal.currency === 'INR' ? '₹' : recommendation.cartTotal.currency + ' ';

    return (
      <div className="slide-in">
        <div className="glass-panel active-recommendation-panel" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
          <div className="merchant-badge">{recommendation.merchantId}</div>
          <h2 className="best-option-banner">🏆 Best Way to Pay</h2>
          
          {best ? (
            <>
              <div className="savings-highlight">
                Save {currencySym}{(Number(best.totalBenefit.amountMinor) / 100).toFixed(2)}
              </div>

              <div className="options-section-title" style={{ marginTop: '8px', marginBottom: '4px' }}>Recommended Steps</div>
              <div className="steps-list">
                {best.stepDescriptions.map((desc, i) => (
                  <div key={i} className="step-item">
                    <span className="step-number">{i + 1}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>

              <div className="cost-row">
                <span>Original Total</span>
                <span className="cost-value">{currencySym}{totalCost.toFixed(2)}</span>
              </div>
              <div className="cost-row" style={{ borderTop: 'none', marginTop: '0', paddingTop: '4px' }}>
                <span>Immediate Discount</span>
                <span className="cost-value" style={{ color: 'var(--success)' }}>
                  -{currencySym}{(Number(best.immediateDiscount.amountMinor) / 100).toFixed(2)}
                </span>
              </div>
              <div className="cost-row" style={{ borderTop: 'none', marginTop: '0', paddingTop: '4px' }}>
                <span>Future Rewards Value</span>
                <span className="cost-value" style={{ color: 'var(--text-secondary)' }}>
                  +{currencySym}{(Number(best.rewardValue.amountMinor) / 100).toFixed(2)}
                </span>
              </div>
              {Number(best.fees.amountMinor) > 0 && (
                <div className="cost-row" style={{ borderTop: 'none', marginTop: '0', paddingTop: '4px' }}>
                  <span>Payment Fees</span>
                  <span className="cost-value" style={{ color: 'var(--danger)' }}>
                    +{currencySym}{(Number(best.fees.amountMinor) / 100).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="cost-row" style={{ marginTop: '12px', paddingTop: '10px', fontSize: '14px', borderTop: '1px solid var(--glass-border)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Effective Net Cost</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '16px' }}>
                  {currencySym}{(Number(best.effectiveCost.amountMinor) / 100).toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No optimization options matched this card set.</div>
          )}
        </div>

        {/* Other Options */}
        {recommendation.strategies.length > 1 && (
          <div style={{ marginBottom: '16px' }}>
            <h3 className="options-section-title">Other Payment Options</h3>
            <div className="other-options-list">
              {recommendation.strategies.slice(1, 4).map((opt) => {
                const isBest = opt.id === best?.id;
                return (
                  <div key={opt.id} className="option-row">
                    <span className="option-name">{opt.id.split('-')[1]?.toUpperCase() ?? opt.id}</span>
                    <span className={`option-cost ${isBest ? 'best' : ''}`}>
                      {currencySym}{(Number(opt.effectiveCost.amountMinor) / 100).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={openSimulator}>
          Open What-If Simulator
        </button>
      </div>
    );
  }

  // What-If Simulator overlay
  if (showSimulator) {
    const currencySym = profile.currency === 'INR' ? '₹' : profile.currency + ' ';
    return (
      <div className="simulator-modal">
        <div className="glass-panel simulator-panel">
          <div className="simulator-header">
            <h2 className="simulator-title">What-If Simulation ({activeMerchant.toUpperCase()})</h2>
            <button className="close-btn" onClick={() => setShowSimulator(false)}>×</button>
          </div>

          <div className="form-group">
            <label className="form-label">Purchase Amount ({profile.currency})</label>
            <input
              type="number"
              className="form-input"
              value={simulatedTotal}
              onChange={handleSimulatedTotalChange}
              placeholder="Enter hypothetical total"
            />
          </div>

          {simulatedBest ? (
            <div style={{ marginBottom: '16px' }}>
              <div className="savings-highlight" style={{ fontSize: '14px', marginBottom: '8px' }}>
                Simulated Savings: {currencySym}{(Number(simulatedBest.totalBenefit.amountMinor) / 100).toFixed(2)}
              </div>
              <div className="steps-list" style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '12px' }}>
                {simulatedBest.stepDescriptions.map((desc, i) => (
                  <div key={i} className="step-item">
                    <span className="step-number">{i + 1}</span>
                    <span style={{ fontSize: '11px' }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div className="cost-row" style={{ borderTop: 'none', paddingTop: '2px' }}>
                <span>Simulated Net Cost</span>
                <span className="cost-value" style={{ fontWeight: 700 }}>
                  {currencySym}{(Number(simulatedBest.effectiveCost.amountMinor) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Enter amount to calculate strategies...</div>
          )}

          {simulatedStrategies.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 className="options-section-title">Alternative Options</h3>
              <div className="other-options-list">
                {simulatedStrategies.slice(0, 3).map((opt) => (
                  <div key={opt.id} className="option-row" style={{ padding: '8px 10px', fontSize: '11px' }}>
                    <span className="option-name">{opt.id.split('-')[1]?.toUpperCase() ?? opt.id}</span>
                    <span className="option-cost best">
                      {currencySym}{(Number(opt.effectiveCost.amountMinor) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default view when not on merchant page
  const currencySym = profile.currency === 'INR' ? '₹' : profile.currency + ' ';
  return (
    <div className="slide-in">
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--brand-primary)' }}>
        <h2 className="section-title" style={{ fontSize: '16px', marginBottom: '4px' }}>Active Shopping Vault</h2>
        <p className="section-desc" style={{ marginBottom: '0', fontSize: '12px' }}>
          Open Amazon or Flipkart to automatically run local-first calculations.
        </p>
      </div>

      <h3 className="options-section-title">Wallet Cards ({profile.paymentMethods.length})</h3>
      
      {profile.paymentMethods.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {profile.paymentMethods.map((method, idx) => {
            if (method.type !== 'CREDIT_CARD') return null;
            const card = method.card;
            const spend = Number(card.userState?.annualSpendToDate?.amountMinor || 0n) / 100;
            return (
              <div key={idx} className="glass-panel wallet-card">
                <div className="wallet-card-header">
                  <span className="wallet-card-issuer">{card.issuer} {card.productName}</span>
                  <span className="wallet-card-network">{card.network}</span>
                </div>
                <div className="wallet-card-body">
                  <div className="wallet-card-stat">
                    <span>ANNUAL spend</span>
                    <span className="wallet-card-val">{currencySym}{spend.toLocaleString()}</span>
                  </div>
                  <div className="wallet-card-stat">
                    <span>REWARD RULE SETS</span>
                    <span className="wallet-card-val">{card.rewardRules.length} rules</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 4px' }}>
          No cards configured. Add cards in the "MY CARDS" tab.
        </div>
      )}
    </div>
  );
}
