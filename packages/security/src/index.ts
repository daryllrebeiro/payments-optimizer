const subtle = globalThis.crypto.subtle;

/** Fix S-08: validated hex — returns a Result, never throws TypeError on malformed import data. */
export function fromHex(
  hex: string
): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    return { ok: false, error: 'malformed hex: must be even-length [0-9a-f]' };
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return { ok: true, bytes };
}

export async function generateKey(extractable = false): Promise<CryptoKey> {
  return await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    extractable,
    ['encrypt', 'decrypt']
  );
}

export async function deriveKey(
  passphrase: string,
  salt: string,
  extractable = false
): Promise<CryptoKey> {
  // Fix S-08: enforce a ≥16-byte salt contract at the boundary.
  if (new TextEncoder().encode(salt).length < 16) {
    throw new Error('deriveKey: salt must be at least 16 bytes');
  }
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey',
  ]);

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    enc.encode(plaintext)
  );

  const ciphertextHex = Array.from(new Uint8Array(encrypted))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    ciphertext: ciphertextHex,
    iv: ivHex,
  };
}

export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  // Fix S-08: structured malformed-input errors instead of uncaught TypeError.
  const ct = fromHex(ciphertext);
  if (!ct.ok) throw new Error(`decrypt: invalid ciphertext (${ct.error})`);
  const ivr = fromHex(iv);
  if (!ivr.ok) throw new Error(`decrypt: invalid iv (${ivr.error})`);

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivr.bytes,
    },
    key,
    ct.bytes
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
