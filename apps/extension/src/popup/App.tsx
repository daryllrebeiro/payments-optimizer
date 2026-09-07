import React, { useState, useEffect, useMemo } from 'react';
import type { UserProfile } from '@payments-optimizer/domain';
import Onboarding from './Onboarding.js';
import Dashboard from './Dashboard.js';
import CardCatalogManager from './CardCatalogManager.js';
import BenefitsManager from './BenefitsManager.js';
import Settings from './Settings.js';
import Diagnostics from './Diagnostics.js';
import SavingsSummary from './SavingsSummary.js';
import SavingsHistory from './SavingsHistory.js';
import { announce } from './accessibility.js';

export type ViewType = 'DASHBOARD' | 'BENEFITS' | 'CARDS' | 'SETTINGS' | 'DIAGNOSTICS' | 'SAVINGS';

// Savings view component (local to App.tsx)
function SavingsView({ profile }: { profile: UserProfile }) {
  const [savingsEntries, setSavingsEntries] = React.useState<import('@payments-optimizer/domain').SavingsEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadSavings() {
      try {
        // Try to load from indexedDB first
        if (typeof indexedDB !== 'undefined') {
          const db = indexedDB.open('payments-optimizer-savings', 1);
          db.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains('savings')) {
              database.createObjectStore('savings', { keyPath: 'id' });
            }
          };
          db.onsuccess = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            const transaction = database.transaction('savings', 'readonly');
            const store = transaction.objectStore('savings');
            const request = store.getAll();
            
            request.onsuccess = () => {
              setSavingsEntries(request.result || []);
              setLoading(false);
            };
            request.onerror = () => {
              setLoading(false);
            };
          };
          db.onerror = () => {
            setLoading(false);
          };
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[PaymentsOptimizer] Failed to load savings:', err);
        setLoading(false);
      }
    }
    void loadSavings();
  }, []);

  if (loading) {
    return (
      <div className="slide-in">
        <div
          className="glass-panel"
          style={{ padding: '16px', marginBottom: '16px', textAlign: 'center' }}
        >
          <div className="diagnostics-spinner"></div>
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Loading savings history...
          </p>
        </div>
      </div>
    );
  }

  const currency = profile.currency;
  const currencySym = currency === 'INR' ? '₹' : currency + ' ';

  return (
    <div className="slide-in">
      <div
        className="glass-panel"
        style={{
          padding: '16px',
          marginBottom: '16px',
          borderLeft: '4px solid var(--brand-primary)',
        }}
      >
        <h2 className="section-title" style={{ fontSize: '16px', marginBottom: '4px' }}>
          📈 Savings Dashboard
        </h2>
        <p className="section-desc" style={{ marginBottom: '0', fontSize: '12px' }}>
          Track your savings from optimization recommendations over time.
        </p>
      </div>

      {savingsEntries.length > 0 ? (
        <>
          <SavingsSummary
            totalEntries={savingsEntries.length}
            totalSaved={savingsEntries.reduce((sum, e) => sum + (Number(BigInt(e.savings.amountMinor)) / 100), 0)}
            avgSavingsPerOrder={savingsEntries.length > 0 
              ? savingsEntries.reduce((sum, e) => sum + (Number(BigInt(e.savings.amountMinor)) / 100), 0) / savingsEntries.length 
              : 0}
            merchantBreakdown={{}}
            currency={currency}
          />
          <SavingsHistory entries={savingsEntries} currency={currency} />
        </>
      ) : (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            textAlign: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>
            📊
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
            No Savings Yet
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Your savings history will appear here after you optimize payments on merchant sites.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => window.close()}
          >
            Close & Optimize
          </button>
        </div>
      )}
    </div>
  );
}

export interface ActiveRecommendation {
  merchantId: string;
  cartTotal: { amountMinor: string; currency: string };
  strategies: import('../types/messages.js').SerializedStrategy[];
  bestStrategy: import('../types/messages.js').SerializedStrategy | null;
  timestamp: number;
}

// Recommendation cache TTL - 10 minutes for offline fallback
const RECOMMENDATION_CACHE_TTL_MS = 10 * 60 * 1000;

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
  const [activeRecommendation, setActiveRecommendation] = useState<ActiveRecommendation | null>(
    null
  );
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  // Load initial settings and active tab recommendations
  useEffect(() => {
    async function loadState() {
      try {
        // 1. Check onboarding status from chrome.storage.local
        const localData = await chrome.storage.local.get([
          'onboarding-completed',
          'user-profile',
          'last-recommendation',
        ]);

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

        // 3. Load cached recommendation for offline fallback
        const cachedRecommendation = localData['last-recommendation'] as ActiveRecommendation | undefined;
        if (cachedRecommendation && Date.now() - cachedRecommendation.timestamp < RECOMMENDATION_CACHE_TTL_MS) {
          setActiveRecommendation(cachedRecommendation);
          console.info('[PaymentsOptimizer] Loaded cached recommendation for offline use');
        }

        // 2. Fetch recommendations for the active browser tab

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

  // Check if recommendation is stale (offline fallback)
  const isRecommendationStale = activeRecommendation
    ? Date.now() - activeRecommendation.timestamp > RECOMMENDATION_CACHE_TTL_MS
    : false;

  if (!initialized) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="brand-title" style={{ fontSize: '24px', marginBottom: '8px' }}>
          PaymentsOptimizer
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Loading secure local vault...
        </div>
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

  // Memoize navigation buttons to prevent re-creation on each render
  const navButtons = useMemo(() => {
    const views: ViewType[] = ['DASHBOARD', 'BENEFITS', 'CARDS', 'SAVINGS', 'SETTINGS', 'DIAGNOSTICS'];
    return views.map((view) => (
      <button
        key={view}
        className={`nav-btn ${currentView === view ? 'active' : ''}`}
        onClick={() => {
          setCurrentView(view);
          announce(`Navigated to ${view.toLowerCase()} view`);
        }}
        aria-label={`Navigate to ${view.toLowerCase()}`}
        aria-current={currentView === view ? 'page' : undefined}
      >
        {view}
      </button>
    ));
  }, [currentView]);

  // Memoize view components
  const currentViewComponent = useMemo(() => {
    switch (currentView) {
      case 'DASHBOARD':
        return <Dashboard profile={profile} recommendation={activeRecommendation} />;
      case 'BENEFITS':
        return <BenefitsManager profile={profile} onUpdateProfile={handleUpdateProfile} />;
      case 'CARDS':
        return <CardCatalogManager profile={profile} onUpdateProfile={handleUpdateProfile} />;
      case 'SETTINGS':
        return <Settings profile={profile} onUpdateProfile={handleUpdateProfile} />;
      case 'DIAGNOSTICS':
        return (
          <Diagnostics
            profile={profile}
            activeTabId={activeTabId}
            onUpdateProfile={handleUpdateProfile}
          />
        );
      case 'SAVINGS':
        return <SavingsView profile={profile} />;
      default:
        return null;
    }
  }, [currentView, profile, activeRecommendation, activeTabId]);

  return (
    <div className="app-container" role="application" aria-label="PaymentsOptimizer">
      {/* Screen reader announcements */}
      <div
        id="sr-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      />
      
      <header className="header" role="banner">
        <div className="brand-title" role="heading" aria-level={1}>
          PaymentsOptimizer
        </div>
        <div className="header-meta" aria-label="Version 0.5.0">v0.5.0</div>
      </header>

      <nav className="nav-bar" role="navigation" aria-label="Main navigation">
        {navButtons}
      </nav>

      <div className="main-content" role="main">
        {currentViewComponent}
      </div>
    </div>
  );
}
