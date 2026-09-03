import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url) });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy packages/api/.env.example to .env and fill it in.`,
    );
  }
  return value;
}

/**
 * Configuration, read lazily.
 *
 * Getters rather than eager fields so that a tool needing only the database —
 * `verify:history`, say — does not have to invent a passcode and a session
 * secret it will never use.
 */
export const env = {
  get mongoUri(): string { return required('MONGODB_URI'); },
  get mongoDb(): string { return process.env['MONGODB_DB'] ?? 'DartiX'; },
  get passcode(): string { return required('APP_PASSCODE'); },
  /**
   * A second passcode granting everything except writes.
   *
   * Optional on purpose: unset means the feature is simply off, so a missing
   * app setting can never lock anyone out of the real passcode.
   */
  get passcodeReadonly(): string | undefined { return process.env['APP_PASSCODE_READONLY'] || undefined; },
  get sessionSecret(): string { return required('SESSION_SECRET'); },
  get port(): number { return Number(process.env['PORT'] ?? 3000); },
  get production(): boolean { return process.env['NODE_ENV'] === 'production'; },
};

/**
 * Fail at startup rather than on the first request that happens to need a
 * missing variable.
 */
export function assertServerEnv(): void {
  const missing = (['MONGODB_URI', 'APP_PASSCODE', 'SESSION_SECRET'] as const)
    .filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment: ${missing.join(', ')}. ` +
      'Copy packages/api/.env.example to .env and fill it in.',
    );
  }
  if (process.env['APP_PASSCODE'] === 'change-me' || process.env['SESSION_SECRET'] === 'change-me') {
    throw new Error('APP_PASSCODE and SESSION_SECRET still hold their example values.');
  }
  // Equal passcodes would silently hand every viewer full access, since the
  // full check is the one that wins.
  if (
    process.env['APP_PASSCODE_READONLY'] &&
    process.env['APP_PASSCODE_READONLY'] === process.env['APP_PASSCODE']
  ) {
    throw new Error('APP_PASSCODE_READONLY is the same as APP_PASSCODE — the read-only role would never apply.');
  }
}

/** Redact any connection string before a message reaches a log or a client. */
export function scrub(message: string): string {
  return message.replace(/mongodb(\+srv)?:\/\/[^\s'"]+/g, '<uri>');
}
