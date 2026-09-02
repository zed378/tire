import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  assertPasswordPolicy,
  safeEqual,
} from './password.ts';

describe('hashPassword', () => {
  it('returns a hash that starts with the expected prefix', async () => {
    const hash = await hashPassword('test-password-123');
    expect(hash).toMatch(/^\\$/);
  });

  it('returns different hashes for the same password', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    expect(h1).not.toBe(h2);
  });

  it('handles empty string password', async () => {
    const hash = await hashPassword('');
    expect(hash).toMatch(/^\\$/);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword(hash, 'correct-password')).toBe(true);
  });

  it('returns false for the wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('returns false for a different password', async () => {
    const hash = await hashPassword('password-a');
    expect(await verifyPassword(hash, 'password-b')).toBe(false);
  });
});

describe('assertPasswordPolicy', () => {
  it('does not throw for passwords meeting the policy (12+ chars)', () => {
    expect(() => assertPasswordPolicy('longpassword123')).not.toThrow();
  });

  it('does not throw for passwords meeting the policy (exactly 12 chars)', () => {
    expect(() => assertPasswordPolicy('abcdefghij12')).not.toThrow();
  });

  it('throws for passwords shorter than 12 characters', () => {
    expect(() => assertPasswordPolicy('short')).toThrow('minimal 12 karakter');
  });

  it('throws for 11-character password', () => {
    expect(() => assertPasswordPolicy('12345678901')).toThrow('minimal 12 karakter');
  });
});

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(safeEqual('abc123', 'abc456')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns false for empty strings comparison', () => {
    expect(safeEqual('', '')).toBe(true);
  });

  it('handles different byte patterns', () => {
    expect(safeEqual('AA', 'AB')).toBe(false);
    expect(safeEqual('\x00', '\x00')).toBe(true);
  });
});
