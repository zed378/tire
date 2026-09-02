import { beforeAll, describe, expect, it } from 'vitest';
import { resetConfigCache } from '../config.ts';
import {
  createStorageToken,
  verifyStorageToken,
  resolveStoragePath,
} from './local-driver.ts';

/**
 * Both the signing key and the upload root come from configuration, so the
 * config has to be valid before any of this runs. Without this block the whole
 * file threw "Invalid environment configuration" — which nobody noticed,
 * because a typecheck error elsewhere in the package stopped the suite from
 * ever reaching it.
 */
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'; // not-a-secret: unreachable localhost fixture, config validation only
  process.env.STORAGE_SIGNING_KEY ??= 'test-signing-key-at-least-16-chars';
  process.env.MFA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
  process.env.UPLOAD_DIR ??= './uploads';
  resetConfigCache();
});

describe('createStorageToken', () => {
  it('creates a valid token with body and signature', () => {
    const token = createStorageToken({
      key: 'inspections/2026/test.jpg',
      size: 1024,
      mime: 'image/jpeg',
      checksum: 'abc123',
      expiresAt: Date.now() + 600000,
      operation: 'put',
    });
    expect(token).toContain('.');
    const parts = token.split('.');
    expect(parts.length).toBe(2);
  });

  it('includes operation as put for upload tokens', () => {
    const token = createStorageToken({
      key: 'test.jpg',
      size: 100,
      mime: 'image/jpeg',
      checksum: 'abc',
      expiresAt: Date.now() + 600000,
      operation: 'put',
    });
    const verified = verifyStorageToken(token);
    expect(verified?.operation).toBe('put');
  });

  it('includes operation as get for download tokens', () => {
    const token = createStorageToken({
      key: 'test.jpg',
      size: 0,
      mime: 'image/jpeg',
      checksum: '',
      expiresAt: Date.now() + 600000,
      operation: 'get',
      filename: 'photo.jpg',
    });
    const verified = verifyStorageToken(token);
    expect(verified?.operation).toBe('get');
    expect(verified?.filename).toBe('photo.jpg');
  });
});

describe('verifyStorageToken', () => {
  it('verifies a valid token', () => {
    const token = createStorageToken({
      key: 'inspections/2026/test.jpg',
      size: 1024,
      mime: 'image/jpeg',
      checksum: 'abc123',
      expiresAt: Date.now() + 600000,
      operation: 'get',
    });
    const payload = verifyStorageToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.key).toBe('inspections/2026/test.jpg');
    expect(payload?.size).toBe(1024);
    expect(payload?.mime).toBe('image/jpeg');
    expect(payload?.checksum).toBe('abc123');
    expect(payload?.operation).toBe('get');
  });

  it('returns null for a tampered token', () => {
    const token = createStorageToken({
      key: 'test.jpg',
      size: 100,
      mime: 'image/jpeg',
      checksum: 'abc',
      expiresAt: Date.now() + 600000,
      operation: 'put',
    });
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
    expect(verifyStorageToken(tampered)).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = createStorageToken({
      key: 'test.jpg',
      size: 100,
      mime: 'image/jpeg',
      checksum: 'abc',
      expiresAt: Date.now() - 1000,
      operation: 'put',
    });
    expect(verifyStorageToken(token)).toBeNull();
  });

  it('returns null for a malformed token without separator', () => {
    expect(verifyStorageToken('no-dot-here')).toBeNull();
  });

  it('returns null for completely invalid token', () => {
    expect(verifyStorageToken('')).toBeNull();
  });
});

describe('resolveStoragePath', () => {
  /**
   * The traversal guard. It was imported into this file but never exercised,
   * which is the worst state for a check like this: it looks covered.
   *
   * Every legitimate key is built by `buildStorageKey` from values the database
   * already constrains, so none of these inputs can arise from ordinary use.
   * That is the point — the guard exists for the case where something else has
   * already gone wrong, and its failure mode is reading or writing anywhere on
   * the disk.
   */
  it('resolves a well-formed key inside the upload directory', () => {
    const resolved = resolveStoragePath('inspections/2026/SN2026-00001/steer-1-right/a.webp');
    expect(resolved).toContain('SN2026-00001');
  });

  it('refuses a POSIX absolute path', () => {
    expect(() => resolveStoragePath('/etc/passwd')).toThrow('escapes the upload directory');
  });

  it('refuses a Windows absolute path', () => {
    expect(() => resolveStoragePath('C:/Windows/System32/config')).toThrow(
      'escapes the upload directory',
    );
  });

  it('refuses a UNC-style leading backslash', () => {
    expect(() => resolveStoragePath('\\server\share')).toThrow('escapes the upload directory');
  });

  it('refuses traversal with forward slashes', () => {
    expect(() => resolveStoragePath('inspections/../../secrets.env')).toThrow(
      'escapes the upload directory',
    );
  });

  it('refuses traversal with backslashes', () => {
    expect(() => resolveStoragePath('inspections\..\..\secrets.env')).toThrow(
      'escapes the upload directory',
    );
  });

  it('allows a filename that merely contains dots', () => {
    // `..` is only traversal when it is a whole path segment. A key with dots
    // in the filename is ordinary and must not be refused.
    expect(() => resolveStoragePath('inspections/2026/photo..thumb.webp')).not.toThrow();
  });
});
