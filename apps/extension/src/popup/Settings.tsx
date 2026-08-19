import React from 'react';
import type { UserProfile } from '@payments-optimizer/domain';

interface SettingsProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

export default function Settings({ profile, onUpdateProfile }: SettingsProps) {
  const valuations = profile.rewardPreferences.defaultValuations || {};

  const handleUpdateValuation = (programName: string, valueStr: string) => {
    const numeric = parseFloat(valueStr);
    if (isNaN(numeric) || numeric < 0) return;

    const updated = {
      ...profile,
      rewardPreferences: {
        ...profile.rewardPreferences,
        defaultValuations: {
          ...valuations,
          [programName]: {
            amountMinor: BigInt(Math.round(numeric * 100)),
            currency: profile.currency,
          } as unknown as import('@payments-optimizer/domain').Money,
        },
      },
    };
    onUpdateProfile(updated);
  };

  const handleUpdatePreference = (key: keyof UserProfile['optimizationPreferences'], value: number) => {
    const updated = {
      ...profile,
      optimizationPreferences: {
        ...profile.optimizationPreferences,
        [key]: value,
      },
    };
    onUpdateProfile(updated);
  };

  const [apiKey, setApiKey] = React.useState('');

  React.useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
          setApiKey(String(result.geminiApiKey));
        }
      });
    }
  }, []);

  const handleUpdateApiKey = (key: string) => {
    setApiKey(key);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ geminiApiKey: key });
    }
  };

  return (
    <div className="slide-in">
      <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '10px' }}>Custom Point Valuations</h2>
      <p className="section-desc" style={{ fontSize: '11px', marginBottom: '12px' }}>
        Configure the monetary value of one unit/point in each program. For example, 1 point = ₹0.25 (enter 0.25).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {Object.keys(valuations).map((programName) => {
          const valObj = valuations[programName];
          const value = valObj ? Number(valObj.amountMinor) / 100 : 1.0;
          return (
            <div key={programName} className="glass-panel" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{programName}</span>
              <div style={{ width: '80px' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'right' }}
                  step="0.05"
                  value={value}
                  onChange={(e) => handleUpdateValuation(programName, e.target.value)}
                />
              </div>
            </div>
          );
        })}
        {Object.keys(valuations).length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No reward programs configured. Add cards first.</div>
        )}
      </div>

      <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '10px' }}>Algorithm Weights</h2>
      <div className="slider-group">
        <div className="slider-header">
          <span>Immediate Discount</span>
          <span>{(profile.optimizationPreferences.immediateSavingsWeight * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="slider-input"
          min="0"
          max="1"
          step="0.1"
          value={profile.optimizationPreferences.immediateSavingsWeight}
          onChange={(e) => handleUpdatePreference('immediateSavingsWeight', parseFloat(e.target.value))}
        />
      </div>
      <div className="slider-group">
        <div className="slider-header">
          <span>Reward Value (Future Points)</span>
          <span>{(profile.optimizationPreferences.rewardValueWeight * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="slider-input"
          min="0"
          max="1"
          step="0.1"
          value={profile.optimizationPreferences.rewardValueWeight}
          onChange={(e) => handleUpdatePreference('rewardValueWeight', parseFloat(e.target.value))}
        />
      </div>
      <div className="slider-group">
        <div className="slider-header">
          <span>Milestone Contribution</span>
          <span>{(profile.optimizationPreferences.milestoneWeight * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="slider-input"
          min="0"
          max="1"
          step="0.1"
          value={profile.optimizationPreferences.milestoneWeight}
          onChange={(e) => handleUpdatePreference('milestoneWeight', parseFloat(e.target.value))}
        />
      </div>
      <div className="slider-group" style={{ marginBottom: '20px' }}>
        <div className="slider-header">
          <span>Workflow Simplicity</span>
          <span>{(profile.optimizationPreferences.simplicityWeight * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="slider-input"
          min="0"
          max="1"
          step="0.1"
          value={profile.optimizationPreferences.simplicityWeight}
          onChange={(e) => handleUpdatePreference('simplicityWeight', parseFloat(e.target.value))}
        />
      </div>

      <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '10px' }}>AI Explanation</h2>
      <p className="section-desc" style={{ fontSize: '11px', marginBottom: '12px' }}>
        Add your Google Gemini API Key to enable natural language explanations of recommendations.
      </p>
      <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Gemini API Key</span>
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '10px', color: 'var(--accent)', textDecoration: 'none' }}
          >
            Get Free Key
          </a>
        </div>
        <input
          type="password"
          className="form-input"
          style={{ width: '100%', fontSize: '12px', boxSizing: 'border-box' }}
          placeholder="AIzaSy..."
          value={apiKey}
          onChange={(e) => handleUpdateApiKey(e.target.value)}
        />
      </div>
    </div>
  );
}
