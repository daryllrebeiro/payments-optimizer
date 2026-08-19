import type { SerializedStrategy } from '../types/messages.js';

interface ExplainInput {
  merchantId: string;
  cartTotal: string;
  currency: string;
  bestStrategy: SerializedStrategy;
  alternatives: SerializedStrategy[];
}

/**
 * Generate a natural language explanation of the payment optimization strategy
 * utilizing the Gemini API directly from the client.
 */
export async function generateAIExplanation(input: ExplainInput, apiKey: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error('API Key is missing.');
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    const errorData = (await response.json().catch(() => ({}))) as GeminiErrorResponse;
    const msg = errorData?.error?.message || `HTTP error ${response.status}`;
    throw new Error(`Gemini API call failed: ${msg}`);
  }

  const data = (await response.json()) as GeminiSuccessResponse;
  const explanation = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!explanation) {
    throw new Error('Received an empty response from Gemini API.');
  }

  return explanation.trim();
}
