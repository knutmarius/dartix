import type { Request, Response } from 'express';
import { scrub } from './env.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
export const notFound = (message: string) => new HttpError(404, 'not_found', message);

/**
 * A JSON error envelope, always.
 *
 * The old app registered `HandleErrorAttribute` but shipped `debug="true"`
 * with `customErrors` off, so a failure returned the ASP.NET yellow error page
 * — HTML, with a stack trace, on a 500, to a client expecting JSON.
 */
export function sendError(res: Response, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error('[api]', scrub(message));
  res.status(500).json({ error: 'internal_error', message: 'Something went wrong.' });
}

/** A required, trimmed, non-empty string from the body. */
export function stringField(req: Request, field: string, maxLength = 60): string {
  const raw = (req.body as Record<string, unknown> | undefined)?.[field];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw badRequest('invalid_field', `${field} is required.`);
  }
  const value = raw.trim();
  if (value.length > maxLength) {
    throw badRequest('invalid_field', `${field} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

/** An ISO date from the query string, or undefined. */
export function dateParam(req: Request, name: string): Date | undefined {
  const raw = req.query[name];
  if (typeof raw !== 'string' || raw === '' || raw === 'null' || raw === 'undefined') {
    // The old client literally sent `?from=null&to=null` and it bound to null
    // by accident. Tolerate it rather than 400.
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('invalid_date', `${name} must be an ISO date (YYYY-MM-DD).`);
  }
  return parsed;
}

export function intParam(req: Request, name: string, fallback: number): number {
  const raw = req.query[name];
  if (typeof raw !== 'string' || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest('invalid_number', `${name} must be a whole number.`);
  }
  return parsed;
}
