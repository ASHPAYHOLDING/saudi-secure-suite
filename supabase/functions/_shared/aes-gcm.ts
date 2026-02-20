/**
 * AES-GCM encrypt/decrypt helpers for Edge Functions.
 * Uses INTEGRATION_SECRET_KEY as master key (platform-level, never stored in DB).
 */

async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("numaxio-byo-gateway-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plaintext: string, masterKey: string): Promise<string> {
  if (!masterKey) throw new Error("INTEGRATION_SECRET_KEY is not set");
  const key = await deriveKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Encode as base64: iv(12 bytes) + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(encrypted: string, masterKey: string): Promise<string> {
  if (!masterKey) throw new Error("INTEGRATION_SECRET_KEY is not set");
  const key = await deriveKey(masterKey);
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
