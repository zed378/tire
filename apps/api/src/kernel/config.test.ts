import { describe, expect, it, afterEach } from 'vitest';
import { loadConfig, resetConfigCache } from './config.ts';

afterEach(() => {
  resetConfigCache();
});

describe('loadConfig', () => {
  const orig = { ...process.env };

  it('returns all expected config properties', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    const config = loadConfig();
    expect(config).toHaveProperty('APP_ENV');
    expect(config).toHaveProperty('APP_VERSION');
    expect(config).toHaveProperty('DATABASE_URL');
    expect(config).toHaveProperty('STORAGE_DRIVER');
    expect(config).toHaveProperty('PUBLIC_API_URL');
    expect(config).toHaveProperty('UPLOAD_DIR');
    expect(config).toHaveProperty('LOG_LEVEL');
    expect(config).toHaveProperty('MFA_ENCRYPTION_KEY');
    expect(config).toHaveProperty('STORAGE_SIGNING_KEY');
    process.env = orig;
  });

  it('STORAGE_DRIVER defaults to local', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    const config = loadConfig();
    expect(config.STORAGE_DRIVER).toBe('local');
    process.env = orig;
  });

  it('PUBLIC_API_URL defaults to http://localhost:3000', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    const config = loadConfig();
    expect(config.PUBLIC_API_URL).toBe('http://localhost:3000');
    process.env = orig;
  });

  it('APP_ENV defaults to local', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    const config = loadConfig();
    expect(config.APP_ENV).toBe('local');
    process.env = orig;
  });

  it('APP_VERSION defaults to 0.0.0', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
    const config = loadConfig();
    expect(config.APP_VERSION).toBe('0.0.0');
    process.env = orig;
  });
});
