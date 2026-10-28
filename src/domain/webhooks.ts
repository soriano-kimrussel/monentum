// Signed webhook envelope modelled on common payment-provider schemes:
//   header = "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}`>"
// The secret used in this project is a MOCK value; see .env.example.

import { hmacSha256Hex, timingSafeEqual } from '../lib/crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookEvent<T = unknown> {
  id: string;
  type: string;
  createdAt: string;
  data: T;
}

export function signPayload(body: string, secret: string, unixSeconds: number): string {
  return `t=${unixSeconds},v1=${hmacSha256Hex(secret, `${unixSeconds}.${body}`)}`;
}

export type VerifyResult = { ok: true; event: WebhookEvent } | { ok: false; reason: 'malformed_header' | 'bad_signature' | 'stale' | 'bad_body' };

export function verifyWebhook(body: string, header: string, secret: string, nowSeconds: number): VerifyResult {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t)) return { ok: false, reason: 'malformed_header' };
  const expected = hmacSha256Hex(secret, `${t}.${body}`);
  if (!timingSafeEqual(expected, parts.v1)) return { ok: false, reason: 'bad_signature' };
  if (Math.abs(nowSeconds - t) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  try {
    const event = JSON.parse(body) as WebhookEvent;
    if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return { ok: false, reason: 'bad_body' };
    return { ok: true, event };
  } catch {
    return { ok: false, reason: 'bad_body' };
  }
}
