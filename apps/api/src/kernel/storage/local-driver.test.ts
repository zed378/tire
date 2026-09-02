import { describe, expect, it } from 'vitest';
import {
  createStorageToken,
  verifyStorageToken,
  resolveStoragePath,
} from './local-driver.ts';

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
