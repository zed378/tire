import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  hashSessionToken,
  issueCsrfToken,
  sessionLifetime,
  renewedExpiry,
  deviceLabelFrom,
  SAME_NETWORK_WINDOW_MINUTES,
} from './session-token.ts';

describe('hashSessionToken', () => {
  it('returns the same value for the same input and salt', () => {
    const token = 'test-token-value';
    const salt = 'test-salt-12345';
    const h1 = hashSessionToken(token, salt);
    const h2 = hashSessionToken(token, salt);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(token);
  });

  it('returns different values for different salts', () => {
    const token = 'test-token-value';
    const h1 = hashSessionToken(token, 'salt-a');
    const h2 = hashSessionToken(token, 'salt-b');
    expect(h1).not.toBe(h2);
  });

  it('returns a hex string of expected length (SHA-256 = 64 hex chars)', () => {
    const hash = hashSessionToken('token', 'salt');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes empty string and empty salt', () => {
    const hash = hashSessionToken('', '');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('issueCsrfToken', () => {
  it('returns a hex string (64 chars for SHA-256)', () => {
    const csrf = issueCsrfToken();
    expect(csrf).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different values on each call', () => {
    const csrf1 = issueCsrfToken();
    const csrf2 = issueCsrfToken();
    expect(csrf1).not.toBe(csrf2);
  });
});

describe('sessionLifetime', () => {
  it('returns absoluteTtl matching SESSION_ABSOLUTE_TTL_DAYS + 1 day', () => {
    const result = sessionLifetime();
    expect(result.absoluteTtl).toBe(8 * 24 * 60 * 60 * 1000);
    expect(result.ttl).toBe(12 * 60 * 60 * 1000);
  });
});

describe('renewedExpiry', () => {
  it('extends the expiry by the given ttl', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = renewedExpiry(now, 3600000);
    expect(result.getTime()).toBe(now.getTime() + 3600000);
  });

  it('returns a Date 24 hours later when given 86400000', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = renewedExpiry(now, 86400000);
    expect(result).toEqual(new Date('2026-01-02T00:00:00Z'));
  });
});

describe('deviceLabelFrom', () => {
  it('returns device label when browser is provided', () => {
    const label = deviceLabelFrom({ browser: 'Chrome', platform: 'Windows' });
    expect(label).toBe('Chrome on Windows');
  });

  it("returns Unknown device when browser is missing", () => {
    const label = deviceLabelFrom({});
    expect(label).toBe('Unknown device');
  });
});

describe('SAME_NETWORK_WINDOW_MINUTES', () => {
  it('is a positive integer', () => {
    expect(SAME_NETWORK_WINDOW_MINUTES).toBeGreaterThan(0);
    expect(Number.isInteger(SAME_NETWORK_WINDOW_MINUTES)).toBe(true);
  });
});
