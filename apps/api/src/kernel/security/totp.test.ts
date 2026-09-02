import { describe, expect, it } from 'vitest';
import { generateTotpSecret, buildOtpauthUri, verifyTotp, generateRecoveryCodes, normalizeRecoveryCode } from './totp.ts';

describe('generateTotpSecret', () => {
  it('returns a valid base32 string', () => {
    const secret = generateTotpSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('returns different secrets on each call', () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
  });
});

describe('buildOtpauthUri', () => {
  it('returns a valid otpauth URI with required params', () => {
    const uri = buildOtpauthUri('testuser', 'JBSWY3DPEHPK3PXP');
    expect(uri).toContain('otpauth://totp/Commercial%202026:testuser');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=Commercial%202026');
  });

  it('encodes username with special characters', () => {
    const uri = buildOtpauthUri('user@example.com', 'ABC123');
    expect(uri).toContain('user%40example.com');
    expect(uri).toContain('issuer=Commercial%202026');
  });
});

describe('verifyTotp', () => {
  it('returns true for a valid code generated from the same secret', async () => {
    const secret = generateTotpSecret();
    const { authenticator } = await import('otplib');
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('returns false for an invalid code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('returns false for random garbage', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'xyz123')).toBe(false);
  });

  it('handles malformed token gracefully', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, 'abc')).toBe(false);
  });
});

describe('generateRecoveryCodes', () => {
  it('generates 10 codes by default', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
  });

  it('generates N codes when count is provided', () => {
    const codes = generateRecoveryCodes(5);
    expect(codes).toHaveLength(5);
  });

  it('formats codes as XXXXX-XXXXX (5-5 with hyphen)', () => {
    const codes = generateRecoveryCodes(1);
    expect(codes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  });

  it('uses only uppercase alphanumeric (no I, O, Q, 0, 1)', () => {
    const codes = generateRecoveryCodes(20);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (const code of codes) {
      const alphanumeric = code.replace('-', '');
      for (const char of alphanumeric) {
        expect(alphabet).toContain(char);
      }
    }
  });

  it('generates unique codes', () => {
    const codes = generateRecoveryCodes(50);
    const unique = new Set(codes);
    expect(unique.size).toBe(50);
  });
});

describe('normalizeRecoveryCode', () => {
  it('trims whitespace', () => {
    expect(normalizeRecoveryCode('  ABC12-XYZ34  ')).toBe('ABC12-XYZ34');
  });

  it('converts to uppercase', () => {
    expect(normalizeRecoveryCode('abc12-xyz34')).toBe('ABC12-XYZ34');
  });

  it('removes internal spaces', () => {
    expect(normalizeRecoveryCode('ABC 12  XYZ 34')).toBe('ABC12XYZ34');
  });
});