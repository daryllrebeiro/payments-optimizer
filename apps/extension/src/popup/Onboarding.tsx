import React, { useState } from 'react';
import type { UserProfile, PaymentMethod, Currency } from '@payments-optimizer/domain';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
} from '@payments-optimizer/test-fixtures';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

interface CardTemplate {
  id: string;
  name: string;
  issuer: string;
  rewardProgram: string;
  rateDescription: string;
  method: PaymentMethod;
}

const CARD_CATALOG_TEMPLATES: CardTemplate[] = [
  {
    id: 'hdfc-millennia',
    name: 'HDFC Millennia Credit Card',
    issuer: 'HDFC',
    rewardProgram: 'HDFC Millennia Points',
    rateDescription: '5% on Amazon/Flipkart, 1% elsewhere',
    method: { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
  },
  {
    id: 'sbi-cashback',
    name: 'SBI Cashback Credit Card',
    issuer: 'SBI',
    rewardProgram: 'SBI Cashback Program',
    rateDescription: '5% on all online spends, 1% elsewhere',
    method: { type: 'CREDIT_CARD', card: sbiCashbackCard },
  },
  {
    id: 'axis-atlas',
    name: 'Axis Atlas Credit Card',
    issuer: 'AXIS',
    rewardProgram: 'Axis Edge Miles',
    rateDescription: '2% standard reward value (Axis Edge Miles)',
    method: { type: 'CREDIT_CARD', card: axisAtlasCard },
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<Currency>('INR');
  const [selectedCards, setSelectedCards] = useState<string[]>(['hdfc-millennia', 'sbi-cashback']);
  
  // Optimization preferences
  const [immediateSavingsWeight, setImmediateSavingsWeight] = useState(1.0);
  const [rewardValueWeight, setRewardValueWeight] = useState(1.0);
  const [milestoneWeight, setMilestoneWeight] = useState(0.8);
  const [simplicityWeight, setSimplicityWeight] = useState(0.2);

  const toggleCard = (cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Step 3 completed, build final profile
      const paymentMethods: PaymentMethod[] = CARD_CATALOG_TEMPLATES.filter((tmpl) =>
        selectedCards.includes(tmpl.id)
      ).map((tmpl) => tmpl.method);

      // Extract default valuations based on selected cards
      const defaultValuations: Record<string, { amountMinor: bigint; currency: Currency }> = {};
      paymentMethods.forEach((method) => {
        if (method.type === 'CREDIT_CARD') {
          defaultValuations[method.card.rewardProgram] = { amountMinor: 100n, currency }; // default 1 pt = ₹1
        }
      });

      const profile: UserProfile = {
        version: 1,
        currency,
        paymentMethods,
        rewardPreferences: {
          defaultValuations: defaultValuations as unknown as Record<string, import('@payments-optimizer/domain').Money>,
        },
        optimizationPreferences: {
          immediateSavingsWeight,
          rewardValueWeight,
          milestoneWeight,
          simplicityWeight,
          riskWeight: 0.1,
        },
      };

      onComplete(profile);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="onboarding-container slide-in">
      <div>
        {step === 1 && (
          <div className="slide-in">
            <h2 className="section-title">Welcome to PaymentsOptimizer</h2>
            <p className="section-desc">
              Let's set up your local wallet preferences. Your data stays 100% on your device.
            </p>
            <div className="form-group">
              <label className="form-label">Primary Currency</label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="INR">INR (₹) — India</option>
                <option value="USD">USD ($) — United States</option>
                <option value="EUR">EUR (€) — Eurozone</option>
                <option value="GBP">GBP (£) — United Kingdom</option>
                <option value="AED">AED (د.إ) — UAE</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Country Vault</label>
              <select className="form-select" defaultValue="IN">
                <option value="IN">India</option>
                <option value="US">United States</option>
                <option value="EU">Europe</option>
                <option value="UK">United Kingdom</option>
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="slide-in">
            <h2 className="section-title">Configure Your Wallet</h2>
            <p className="section-desc">
              Select the credit cards you currently own. We will check rewards rules for these cards.
            </p>
            <div className="catalog-list">
              {CARD_CATALOG_TEMPLATES.map((tmpl) => {
                const isSelected = selectedCards.includes(tmpl.id);
                return (
                  <div
                    key={tmpl.id}
                    className={`catalog-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleCard(tmpl.id)}
                  >
                    <div className="card-info">
                      <span className="card-title">{tmpl.name}</span>
                      <span className="card-meta">{tmpl.rateDescription}</span>
                    </div>
                    <div className="checkbox-indicator" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="slide-in">
            <h2 className="section-title">How do you want to optimize?</h2>
            <p className="section-desc">
              Tune our weighted algorithm to prioritize immediate discount vs points value vs workflow simplicity.
            </p>
            <div className="slider-group">
              <div className="slider-header">
                <span>Immediate Savings Weight</span>
                <span>{(immediateSavingsWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.1"
                value={immediateSavingsWeight}
                onChange={(e) => setImmediateSavingsWeight(parseFloat(e.target.value))}
              />
            </div>
            <div className="slider-group">
              <div className="slider-header">
                <span>Reward Value Weight (Future Value)</span>
                <span>{(rewardValueWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.1"
                value={rewardValueWeight}
                onChange={(e) => setRewardValueWeight(parseFloat(e.target.value))}
              />
            </div>
            <div className="slider-group">
              <div className="slider-header">
                <span>Milestone Goals (Annual targets)</span>
                <span>{(milestoneWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.1"
                value={milestoneWeight}
                onChange={(e) => setMilestoneWeight(parseFloat(e.target.value))}
              />
            </div>
            <div className="slider-group">
              <div className="slider-header">
                <span>Avoid Complexity (Fewer steps)</span>
                <span>{(simplicityWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.1"
                value={simplicityWeight}
                onChange={(e) => setSimplicityWeight(parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="footer-actions">
        {step > 1 ? (
          <button className="btn btn-secondary" onClick={handleBack}>
            Back
          </button>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <button className="btn btn-primary" onClick={handleNext}>
          {step === 3 ? 'Finish Setup' : 'Next'}
        </button>
      </div>
    </div>
  );
}
