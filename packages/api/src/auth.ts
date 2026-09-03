/**
 * A single shared passcode, exchanged for a signed cookie.
 *
 * Replaces the legacy global Basic-auth filter, which hardcoded a single
 * username and password in `Global.asax.cs:21` and compared them with `==` —
 * non-constant-time, and blind to a non-Basic Authorization header
 * (`auth.Substring(6)` assumed the prefix, and `Split(':')` threw without a
 * colon). It also had no OPTIONS bypass, so any CORS preflight got a 401.
 *
 * There are still no user accounts, but there are now two passcodes: one for
 * full access and an optional one that grants everything except writes. The
 * role rides in the signed cookie, so it cannot be edited by the client.
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

/** What a passcode buys. `readonly` may do everything but write. */
export type Role = 'full' | 'readonly';

/**
 * Which role this passcode grants, or null for neither.
 *
 * Both comparisons run before either is acted on, so the time taken cannot
 * separate "wrong full passcode" from "correct read-only passcode".
 */
export function checkPasscode(candidate: unknown): Role | null {
  if (typeof candidate !== 'string') return null;
  const readonly = env.passcodeReadonly;
  const isFull = sameString(candidate, env.passcode);
  const isReadonly = readonly !== undefined && sameString(candidate, readonly);
  if (isFull) return 'full';
  if (isReadonly) return 'readonly';
  return null;
}

function issue(role: Role): string {
  const expires = String(Date.now() + MAX_AGE_MS);
  const payload = `${expires}.${role}`;
  return `${payload}.${sign(payload)}`;
}

function fresh(expires: string): boolean {
  const at = Number(expires);
  return Number.isFinite(at) && at > Date.now();
}

/**
 * The role a cookie proves, or null if it proves nothing.
 *
 * The role is inside the signed payload rather than beside it, so promoting
 * yourself means forging an HMAC.
 */
function roleOf(token: unknown): Role | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');

  // Cookies issued before roles existed carry two segments and mean full
  // access. Honoured so a deploy does not sign everybody out.
  if (parts.length === 2) {
    const [expires, mac] = parts as [string, string];
    if (!sameString(mac, sign(expires)) || !fresh(expires)) return null;
    return 'full';
  }

  if (parts.length !== 3) return null;
  const [expires, role, mac] = parts as [string, string, string];
  if (role !== 'full' && role !== 'readonly') return null;
  if (!sameString(mac, sign(`${expires}.${role}`))) return null;
  if (!fresh(expires)) return null;
  return role;
}

export function setSession(res: Response, role: Role): void {
  res.cookie(COOKIE, issue(role), {
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

/** The role this request carries, or null when it carries none. */
export function sessionRole(req: Request): Role | null {
  return roleOf((req.cookies as Record<string, unknown> | undefined)?.[COOKIE]);
}

export function isAuthenticated(req: Request): boolean {
  return sessionRole(req) !== null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'not_authenticated', message: 'Sign in first.' });
}

/**
 * Anything that changes the database.
 *
 * This is the actual boundary. The web app also hides the buttons, but that
 * is courtesy — a read-only session with devtools open still has to come
 * through here.
 */
export function requireWrite(req: Request, res: Response, next: NextFunction): void {
  const role = sessionRole(req);
  if (role === null) {
    res.status(401).json({ error: 'not_authenticated', message: 'Sign in first.' });
    return;
  }
  if (role === 'readonly') {
    res.status(403).json({
      error: 'read_only',
      message: 'This passcode can look but not change anything.',
    });
    return;
  }
  next();
}
