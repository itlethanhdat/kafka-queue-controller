/**
 * Client-side AES-256-GCM encryption for sensitive connection fields.
 *
 * Key lifecycle:
 *   - First run: generate a random AES-256-GCM key, export as JWK, persist in
 *     localStorage["kqc_crypto_key"].
 *   - Subsequent runs: import the persisted JWK.
 *
 * Ciphertext format: base64( 12-byte-IV || encrypted-bytes )
 *
 * NOTE: The key is device/browser-specific. If localStorage is cleared the
 * stored credentials become unreadable; the app will surface a toast for each
 * field that fails decryption and fall back to an empty string.
 */

const KEY_STORAGE = "kqc_crypto_key";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // bytes – recommended for AES-GCM

let _key: CryptoKey | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Must be called once before any encrypt/decrypt operations (e.g. in a
 * client-side useEffect in layout.tsx).
 */
export async function initCrypto(): Promise<void> {
  if (_key) return;

  const crypto = window.crypto;

  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    try {
      const jwk: JsonWebKey = JSON.parse(stored);
      _key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
      );
      return;
    } catch {
      // Corrupted key — regenerate
    }
  }

  // Generate fresh key
  _key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable so we can persist it
    ["encrypt", "decrypt"]
  );

  const jwk = await crypto.subtle.exportKey("jwk", _key);
  localStorage.setItem(KEY_STORAGE, JSON.stringify(jwk));
}

/**
 * Encrypt a plaintext string. Returns base64( IV || ciphertext ).
 * Returns an empty string if the input is empty.
 */
export async function encryptField(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  if (!_key) await initCrypto();

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    _key!,
    encoded
  );

  // Concatenate IV + ciphertext
  const combined = new Uint8Array(IV_LENGTH + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), IV_LENGTH);

  return toBase64(combined.buffer);
}

/**
 * Decrypt a value produced by `encryptField`.
 * Returns the original plaintext, or "" if the value is empty or decryption
 * fails (key mismatch / corrupted data).
 */
export async function decryptField(ciphertext: string): Promise<string> {
  if (!ciphertext) return "";
  if (!_key) await initCrypto();

  try {
    const combined = fromBase64(ciphertext);
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const plainBuf = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      _key!,
      data
    );

    return new TextDecoder().decode(plainBuf);
  } catch {
    // Key mismatch or data corruption — return empty rather than crashing
    return "";
  }
}

/**
 * Returns true if the value looks like an encrypted blob (base64, non-empty).
 * Used for migration: existing plaintext values are re-encrypted on first save.
 */
export function isEncrypted(value: string | undefined): boolean {
  if (!value) return false;
  // IV(12) + GCM tag(16) = 28 raw bytes minimum → base64 ≥ 40 chars and
  // a multiple of 4. Tighter than just "looks base64-ish" so plaintext
  // credentials don't get mistakenly treated as ciphertext.
  return value.length >= 40 && value.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(value);
}
