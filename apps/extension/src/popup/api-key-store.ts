/**
 * Fix S-01: session-scoped Gemini key storage.
 *
 * Default: chrome.storage.session (cleared on browser close, never synced
 * to backups). chrome.storage.local is used ONLY when the user explicitly
 * opts into "remember on this device". Revocation clears both scopes.
 */
import { isValidApiKey } from './ai-explain.js';

const SESSION_KEY = 'geminiApiKey';
const LOCAL_KEY = 'geminiApiKey';
const REMEMBER_FLAG = 'geminiApiKeyRemember';

export { SESSION_KEY };

function local(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return undefined;
  return chrome.storage.local;
}

function session(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return local();
  return chrome.storage.session;
}

export async function getApiKey(): Promise<string> {
  const s = session();
  if (!s) return '';
  const res = await s.get([SESSION_KEY]);
  const val = (res as Record<string, unknown>)[SESSION_KEY];
  if (typeof val === 'string' && val) return val;
  const l = local();
  if (!l) return '';
  const remembered = await l.get([REMEMBER_FLAG]);
  if (!(remembered as Record<string, unknown>)[REMEMBER_FLAG]) return '';
  const lr = await l.get([LOCAL_KEY]);
  const lv = (lr as Record<string, unknown>)[LOCAL_KEY];
  return typeof lv === 'string' ? lv : '';
}

export async function storeApiKey(key: string, rememberDevice: boolean): Promise<void> {
  const trimmed = key.trim();
  if (trimmed && !isValidApiKey(trimmed)) {
    console.warn('API key format may be invalid. Verify at https://aistudio.google.com/');
  }
  const s = session();
  if (trimmed) {
    await s?.set({ [SESSION_KEY]: trimmed });
  } else {
    await s?.remove(SESSION_KEY);
  }
  const l = local();
  if (rememberDevice && trimmed) {
    await l?.set({ [LOCAL_KEY]: trimmed, [REMEMBER_FLAG]: true });
  } else {
    await l?.remove([LOCAL_KEY, REMEMBER_FLAG] as unknown as string);
  }
}

/** Fix S-01: revocation clears both scopes; call from Settings + docs. */
export async function revokeApiKey(): Promise<void> {
  await session()?.remove(SESSION_KEY);
  await local()?.remove([LOCAL_KEY, REMEMBER_FLAG] as unknown as string);
}
