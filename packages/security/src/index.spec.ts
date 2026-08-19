import { describe, it, expect } from 'vitest';
import { generateKey, deriveKey, encrypt, decrypt } from './index.js';

describe('Web Crypto Security Helpers', () => {
  it('should generate an AES key and encrypt/decrypt successfully', async () => {
    const key = await generateKey();
    const plaintext = 'Secret user credentials';

    const { ciphertext, iv } = await encrypt(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(iv.length).toBe(24);

    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should derive key from passphrase and salt consistently', async () => {
    const passphrase = 'my-safe-passphrase';
    const salt = 'unique-salt-string';
    const plaintext = 'Sensitive profile contents';

    const key1 = await deriveKey(passphrase, salt);
    const key2 = await deriveKey(passphrase, salt);

    const encrypted = await encrypt(plaintext, key1);

    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key2);
    expect(decrypted).toBe(plaintext);
  });
});
