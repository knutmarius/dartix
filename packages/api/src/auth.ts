/**
 * A single shared passcode, exchanged for a signed cookie.
 *
 * Replaces the legacy global Basic-auth filter, which hardcoded a single
 * username and password in `Global.asax.cs:21` and compared them with `==` —
 * non-constant-time, and blind to a non-Basic Authorization header
 * (`auth.Substring(6)` assumed the prefix, and `Split(':')` threw without a
 * colon). It also had no OPTIONS bypass, so any CORS preflight got a 401.
 *
 * There are still no user accounts: one passcode, from the environment.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';

const COOKIE = 'dartix_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

/** Constant-time compare that does not leak length through an exception. */
function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Still do the work, so the timing does not reveal a length mismatch.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function checkPasscode(candidate: unknown): boolean {
  return typeof candidate === 'string' && sameString(candidate, env.passcode);
}

function issue(): string {
  const expires = String(Date.now() + MAX_AGE_MS);
  return `${expires}.${sign(expires)}`;
}

function valid(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!sameString(mac, sign(expires))) return false;
  const at = Number(expires);
  return Number.isFinite(at) && at > Date.now();
}

export function setSession(res: Response): void {
  res.cookie(COOKIE, issue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.production,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { path: '/' });
}

export function isAuthenticated(req: Request): boolean {
  return valid((req.cookies as Record<string, unknown> | undefined)?.[COOKIE]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'not_authenticated', message: 'Sign in first.' });
}
