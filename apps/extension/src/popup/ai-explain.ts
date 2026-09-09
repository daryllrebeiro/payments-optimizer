import type { SerializedStrategy } from '../types/messages.js';
import { RateLimiter } from '@payments-optimizer/domain';

interface ExplainInput {
  merchantId: string;
  cartTotal: string;
  currency: string;
  bestStrategy: SerializedStrategy;
  alternatives: SerializedStrategy[];
}

// Rate limiting constants
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Validates that the API key is in a valid format for Gemini API
 * @param apiKey - The API key to validate
 * @returns true if the key appears valid, false otherwise
 */
export function isValidApiKey(apiKey: string): boolean {
  // Gemini API keys start with "AIza" and are 35 characters long
  const apiKeyPattern = /^AIza[A-Za-z0-9_-]{35}$/;
  return apiKeyPattern.test(apiKey.trim());
}

/**
 * Fix S-06: canonical fail-CLOSED limiter shared with the service worker.
 * Storage outage must not silently allow unlimited billable calls.
 */
const memoryLimiter = new RateLimiter({
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * Checks if the rate limit has been exceeded for AI API calls
 * @returns true if under the limit, false if rate limited
 */
async function isRateLimited(): Promise<boolean> {
  if (memoryLimiter.isLimited()) return true;
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return true; // Fix S-06: fail closed when storage unavailable.
  }

  const now = Date.now();

  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(['aiRateLimit'], (result) => {
      const rateLimitData = result.aiRateLimit as
        | {
            count: number;
            windowStart: number;
          }
        | undefined;

      if (!rateLimitData || now - rateLimitData.windowStart > RATE_LIMIT_WINDOW_MS) {
        // Window expired, reset
        chrome.storage.local.set({
          aiRateLimit: {
            count: 1,
            windowStart: now,
          },
        });
        resolve(false); // Not limited (new window)
      } else if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
        resolve(true); // Limited
      } else {
        // Increment counter
        chrome.storage.local.set({
          aiRateLimit: {
            count: rateLimitData.count + 1,
            windowStart: rateLimitData.windowStart,
          },
        });
        resolve(false); // Not limited (under limit)
      }
    });
  });
}

/**
 * Generate a natural language explanation of the payment optimization strategy
 * utilizing the Gemini API directly from the client.
 */
export async function generateAIExplanation(input: ExplainInput, apiKey: string): Promise<string> {
  const trimmedKey = apiKey.trim();

  // Validate API key format
  if (!trimmedKey) {
    throw new Error('API Key is missing.');
  }

  if (!isValidApiKey(trimmedKey)) {
    throw new Error(
      'Invalid API Key format. Please check that you entered a valid Gemini API key.'
    );
  }

  // Check rate limit
  if (await isRateLimited()) {
    throw new Error(`Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute.`);
  }

  const { merchantId, cartTotal, currency, bestStrategy, alternatives } = input;

  const promptText = [
    `Merchant: ${merchantId.toUpperCase()}`,
    `Cart Total: ${cartTotal} ${currency}`,
    `Recommended Strategy ID: ${bestStrategy.id}`,
    `Recommended Strategy Steps:`,
    bestStrategy.stepDescriptions.map((desc, i) => `  ${i + 1}. ${desc}`).join('\n'),
    `Recommended Strategy Metrics:`,
    `  - Immediate Discount: ${bestStrategy.immediateDiscount.amountMinor} (minor units)`,
    `  - Reward Value: ${bestStrategy.rewardValue.amountMinor} (minor units)`,
    `  - Fees: ${bestStrategy.fees.amountMinor} (minor units)`,
    `  - Effective Cost: ${bestStrategy.effectiveCost.amountMinor} (minor units)`,
    `Alternative Options:`,
    alternatives
      .slice(0, 3)
      .map((alt) => `  - ${alt.id}: Cost ${alt.effectiveCost.amountMinor} (minor units)`)
      .join('\n'),
  ].join('\n');

  const systemInstruction = [
    'You are a financial advisor explaining a deterministic payment optimization result.',
    'You must ONLY use the numbers, savings, and steps provided in the transaction data.',
    'Do NOT attempt to perform any calculations yourself, and do NOT make up or invent any figures.',
    'Summarize why this strategy is superior compared to the listed alternatives.',
    'Keep the explanation under 3 sentences, professional, and formatted in clean markdown.',
  ].join('\n');

  // Fix S-02: Gemini requires the key as a query param (no header-Key
  // alternative) — documented residual in ADR-006. Minimize: no-referrer,
  // never log the URL, and sanitize every error so key material cannot
  // leak through status/body text.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    referrerPolicy: 'no-referrer',
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.1,
      },
    }),
  });

  interface GeminiErrorResponse {
    error?: {
      message?: string;
    };
  }

  interface GeminiSuccessResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  }

  if (!response.ok) {
    // Fix S-02: sanitized — status code only, never URL/body (may echo key).
    throw new Error(`Gemini API call failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GeminiSuccessResponse;
  const explanation = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!explanation) {
    throw new Error('Received an empty response from Gemini API.');
  }

  return explanation.trim();
}
