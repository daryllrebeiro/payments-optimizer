import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@payments-optimizer/domain';
import Onboarding from './Onboarding.js';
import Dashboard from './Dashboard.js';
import CardCatalogManager from './CardCatalogManager.js';
import Settings from './Settings.js';
import Diagnostics from './Diagnostics.js';

export type ViewType = 'DASHBOARD' | 'CARDS' | 'SETTINGS' | 'DIAGNOSTICS';

export interface ActiveRecommendation {
  merchantId: string;
  cartTotal: { amountMinor: string; currency: string };
  strategies: import('../types/messages.js').SerializedStrategy[];
  bestStrategy: import('../types/messages.js').SerializedStrategy | null;
  timestamp: number;
}

const DEFAULT_PROFILE: UserProfile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [],
  rewardPreferences: {
    defaultValuations: {},
  },
  optimizationPreferences: {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 0.8,
    simplicityWeight: 0.2,
    riskWeight: 0.1,
  },
};

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('DASHBOARD');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activeRecommendation, setActiveRecommendation] = useState<ActiveRecommendation | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  // Load initial settings and active tab recommendations
  useEffect(() => {
    async function loadState() {
      try {
        // 1. Check onboarding status from chrome.storage.local
        const localData = await chrome.storage.local.get(['onboarding-completed', 'user-profile']);
        
        if (localData['onboarding-completed']) {
          setOnboardingCompleted(true);
        }
        
        if (localData['user-profile']) {
          setProfile(localData['user-profile'] as UserProfile);
        } else {
          // Store default profile if not present
          await chrome.storage.local.set({ 'user-profile': DEFAULT_PROFILE });
          setProfile(DEFAULT_PROFILE);
        }

        // 2. Fetch recommendations for the active browser tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setActiveTabId(tab.id);
          const sessionData = await chrome.storage.session.get(`recommendation-${tab.id}`);
          const rec = sessionData[`recommendation-${tab.id}`] as ActiveRecommendation | undefined;
          if (rec) {
            // Only use recommendation if it's less than 5 minutes old
            if (Date.now() - rec.timestamp < 5 * 60 * 1000) {
              setActiveRecommendation(rec);
            }
          }
        }
      } catch (err) {
        console.error('[PaymentsOptimizer] Failed to load popup state:', err);
      } finally {
        setInitialized(true);
      }
    }
    void loadState();
  }, []);

  const handleOnboardingComplete = async (completedProfile: UserProfile) => {
    try {
      await chrome.storage.local.set({
        'onboarding-completed': true,
        'user-profile': completedProfile,
      });
      setProfile(completedProfile);
      setOnboardingCompleted(true);
      setCurrentView('DASHBOARD');
    } catch (err) {
      console.error('[PaymentsOptimizer] Failed to save onboarding profile:', err);
    }
  };

  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    try {
      await chrome.storage.local.set({ 'user-profile': updatedProfile });
      setProfile(updatedProfile);
    } catch (err) {
      console.error('[PaymentsOptimizer] Failed to update profile:', err);
    }
  };

  if (!initialized) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="brand-title" style={{ fontSize: '24px', marginBottom: '8px' }}>PaymentsOptimizer</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading secure local vault...</div>
      </div>
    );
  }

  if (!onboardingCompleted) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="brand-title">PaymentsOptimizer</div>
          <div className="header-meta">SETUP</div>
        </header>
        <div className="main-content">
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="brand-title">PaymentsOptimizer</div>
        <div className="header-meta">v0.5.0</div>
      </header>

      <nav className="nav-bar">
        <button
          className={`nav-btn ${currentView === 'DASHBOARD' ? 'active' : ''}`}
          onClick={() => setCurrentView('DASHBOARD')}
        >
          DASHBOARD
        </button>
        <button
          className={`nav-btn ${currentView === 'CARDS' ? 'active' : ''}`}
          onClick={() => setCurrentView('CARDS')}
        >
          MY CARDS
        </button>
        <button
          className={`nav-btn ${currentView === 'SETTINGS' ? 'active' : ''}`}
          onClick={() => setCurrentView('SETTINGS')}
        >
          VALUATIONS
        </button>
        <button
          className={`nav-btn ${currentView === 'DIAGNOSTICS' ? 'active' : ''}`}
          onClick={() => setCurrentView('DIAGNOSTICS')}
        >
          DIAGNOSTICS
        </button>
      </nav>

      <div className="main-content">
        {currentView === 'DASHBOARD' && (
          <Dashboard
            profile={profile}
            recommendation={activeRecommendation}
          />
        )}
        {currentView === 'CARDS' && (
          <CardCatalogManager
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
        {currentView === 'SETTINGS' && (
          <Settings
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
        {currentView === 'DIAGNOSTICS' && (
          <Diagnostics
            profile={profile}
            activeTabId={activeTabId}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </div>
    </div>
  );
}
