/**
 * UI Constants for the PaymentsOptimizer Extension
 */

// Fix S-01: key scope lives in api-key-store.ts (session-first, local only
// on explicit opt-in). No direct geminiApiKey literal here by design.
export { SESSION_KEY as AI_API_KEY_STORAGE_KEY } from './api-key-store.js';
export const RATE_LIMIT_STORAGE_KEY = 'aiRateLimit';
export const OPTIMIZATION_RATE_LIMIT_KEY = 'optimizationRateLimit';

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 10;

// Strategy ranking constraints
export const MIN_CONFIDENCE = 0.5;
export const MAX_COMPLEXITY = 8;

// Candidate generation limits
export const MAX_COUPONS = 2;
export const MAX_OFFERS = 2;

// Cache TTL
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Recommendation cache TTL
export const RECOMMENDATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// UI Animation
export const ANIMATION_DURATION_MS = 300;

// Loading states
export const LOADING_TIMEOUT_MS = 10000;
