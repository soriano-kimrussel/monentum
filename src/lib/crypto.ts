// Small crypto toolkit built on @noble/hashes (pure JS, audited, works in Hermes and Jest).
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

// No Expo import here: the backend stays platform-neutral (and portable to Cloud Functions).
// The app registers expo-crypto as the source at startup; tests and web use Web Crypto.
let source: ((n: number) => Uint8Array) | null = null;

export function setRandomSource(fn: (n: number) => Uint8Array) {
  source = fn;
}

export function randomBytes(n: number): Uint8Array {
  if (source) return source(n);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (webCrypto?.getRandomValues) return webCrypto.getRandomValues(new Uint8Array(n));
  throw new Error('No secure random source registered');
}

export function randomId(prefix = ''): string {
  return prefix + bytesToHex(randomBytes(12));
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

export function hmacSha256Hex(secret: string, message: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message)));
}

/**
 * Demo-grade password hashing. PBKDF2-SHA256 with a per-user salt.
 * Iterations are deliberately modest so it stays fast in a JS engine on a phone;
 * a production backend would use a server-side argon2/scrypt with higher cost.
 */
export const PBKDF2_ITERATIONS = 10_000;

export function hashPassword(password: string, saltHex: string, iterations = PBKDF2_ITERATIONS): string {
  return bytesToHex(pbkdf2(sha256, utf8ToBytes(password), utf8ToBytes(saltHex), { c: iterations, dkLen: 32 }));
}

/** Constant-time string comparison to avoid timing side channels on signature checks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
