import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PACKAGED_EMAIL_HASH = Buffer.from('d2960b0a7793c2cdddb3d9e66f91d6aa11bfcfd23f788b3dafbfbf53829f42ad', 'hex');
const PACKAGED_PASSWORD_SALT = Buffer.from('n0fFgFSx1vMLRWHXfAzm5w', 'base64url');
const PACKAGED_PASSWORD_HASH = Buffer.from('yYeZ6wVJEwtmCNJj_HFEukqSHMaFL07St2PA86QK6PB_W6mrU9EXDCc6O6kvpipMHsVjkXqAvj4OjNibkGU2iw', 'base64url');
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function sameBytes(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function derivePasswordHash(password: string, salt: Buffer) {
  return scryptSync(password, salt, 64, {
    N: 32_768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

function verifyPackagedCredential(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const emailHash = createHash('sha256').update(normalizedEmail, 'utf8').digest();
  const passwordHash = derivePasswordHash(password, PACKAGED_PASSWORD_SALT);
  const emailMatches = sameBytes(emailHash, PACKAGED_EMAIL_HASH);
  const passwordMatches = sameBytes(passwordHash, PACKAGED_PASSWORD_HASH);
  return emailMatches && passwordMatches;
}

interface AttemptState {
  failures: number;
  lockedUntil: number;
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; retryAfterMs?: number };

export class LoginGuard {
  private readonly sessions = new Map<string, number>();
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly verifyCredential: (email: string, password: string) => boolean,
    private readonly now: () => number = Date.now,
  ) {}

  login(email: string, password: string, identity = 'local'): LoginResult {
    const now = this.now();
    const attempt = this.attempts.get(identity);
    if (attempt && attempt.lockedUntil > now) {
      return { ok: false, retryAfterMs: attempt.lockedUntil - now };
    }

    if (!this.verifyCredential(email, password)) {
      const failures = (attempt?.failures ?? 0) + 1;
      const lockedUntil = failures >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0;
      this.attempts.set(identity, { failures: lockedUntil ? 0 : failures, lockedUntil });
      return lockedUntil ? { ok: false, retryAfterMs: LOCKOUT_MS } : { ok: false };
    }

    this.attempts.delete(identity);
    this.removeExpiredSessions(now);
    this.sessions.clear();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + SESSION_LIFETIME_MS;
    this.sessions.set(token, expiresAt);
    return { ok: true, token, expiresAt: new Date(expiresAt).toISOString() };
  }

  isAuthorized(token: string | null | undefined) {
    if (!token) return false;
    const expiresAt = this.sessions.get(token);
    if (!expiresAt) return false;
    if (expiresAt <= this.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  logout(token: string | null | undefined) {
    if (token) this.sessions.delete(token);
  }

  private removeExpiredSessions(now: number) {
    for (const [token, expiresAt] of this.sessions) {
      if (expiresAt <= now) this.sessions.delete(token);
    }
  }
}

export function readBearerToken(header: string | undefined) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,128})$/.exec(header ?? '');
  return match?.[1] ?? null;
}

export const loginGuard = new LoginGuard(verifyPackagedCredential);
