/**
 * Sezení (D-004).
 *
 * Token je neprůhledný náhodný řetězec. V databázi leží jen jeho hash,
 * takže únik databáze nedá útočníkovi použitelné sezení.
 */

import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { config } from '../config.js';
import type { Store, UserRecord } from '../db/store.js';

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const createSessionToken = (): string => randomBytes(32).toString('base64url');

export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookieHeader(token: string): string {
  const maxAge = config.sessionTtlDays * 86_400;
  // Prefix __Host- vyžaduje Secure, Path=/ a žádnou Domain.
  return [
    `${config.sessionCookie}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export async function userFromRequest(
  store: Store,
  cookieHeader: string | undefined,
): Promise<UserRecord | null> {
  const token = parseCookie(cookieHeader, config.sessionCookie);
  if (!token) return null;
  return store.getUserBySession(hashToken(token));
}

// --- Podpisy pro tickety a běhy --------------------------------------------

export function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Porovnání v konstantním čase — délka podpisu je veřejná, obsah ne. */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export interface RealtimeTicket {
  userId: string | null;
  nickname: string;
  issuedAt: number;
}

/**
 * Jednorázový ticket pro připojení k realtime serveru (zadání 3.1).
 * Platí 60 s a realtime si ho navíc vyškrtne z Redisu, aby nešel použít dvakrát.
 */
export function issueRealtimeTicket(ticket: RealtimeTicket): string {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${payload}.${sign(payload, config.rtTicketSecret)}`;
}

export function verifyRealtimeTicket(token: string): RealtimeTicket | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!verifySignature(payload, signature, config.rtTicketSecret)) return null;

  try {
    const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString()) as RealtimeTicket;
    const ageSeconds = (Date.now() - ticket.issuedAt) / 1000;
    if (ageSeconds < 0 || ageSeconds > config.rtTicketTtlSeconds) return null;
    return ticket;
  } catch {
    return null;
  }
}
