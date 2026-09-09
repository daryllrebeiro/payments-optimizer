import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getApiKey, storeApiKey, revokeApiKey } from './api-key-store.js';

describe('Fix S-01 — session-scoped key storage', () => {
  let sessionData: Record<string, unknown>;
  let localData: Record<string, unknown>;

  beforeEach(() => {
    sessionData = {};
    localData = {};
    (globalThis as any).chrome = {
      storage: {
        session: {
          get: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, sessionData[k]])),
          set: async (d: Record<string, unknown>) => Object.assign(sessionData, d),
          remove: async (k: string) => delete sessionData[k],
        },
        local: {
          get: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, localData[k]])),
          set: async (d: Record<string, unknown>) => Object.assign(localData, d),
          remove: async (k: unknown) =>
            (Array.isArray(k) ? k : [k]).forEach((key) => delete localData[key as string]),
        },
      },
    };
    vi.clearAllMocks();
  });

  it('defaults to session scope — local stays empty without opt-in', async () => {
    await storeApiKey('AIza' + 'a'.repeat(35), false);
    expect(sessionData['geminiApiKey']).toContain('AIza');
    expect(localData['geminiApiKey']).toBeUndefined();
    expect(await getApiKey()).toContain('AIza');
  });

  it('revocation clears both scopes', async () => {
    await storeApiKey('AIza' + 'a'.repeat(35), true);
    await revokeApiKey();
    expect(await getApiKey()).toBe('');
    expect(localData['geminiApiKey']).toBeUndefined();
  });
});
