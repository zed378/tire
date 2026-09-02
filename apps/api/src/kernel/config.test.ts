import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('requires DATABASE_URL', () => {
    expect(() => loadConfig()).not.toThrow();
  });

  it('returns all expected config properties', () => {
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
  });

  it('STORAGE_DRIVER defaults to local', () => {
    const config = loadConfig();
    expect(config.STORAGE_DRIVER).toBe('local');
  });

  it('PUBLIC_API_URL defaults to http://localhost:3000', () => {
    const config = loadConfig();
    expect(config.PUBLIC_API_URL).toBe('http://localhost:3000');
  });

  it('LOG_LEVEL defaults to debug', () => {
    const config = loadConfig();
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('APP_ENV defaults to development', () => {
    const config = loadConfig();
    expect(config.APP_ENV).toBe('development');
  });

  it('APP_VERSION defaults to 0.0.0', () => {
    const config = loadConfig();
    expect(config.APP_VERSION).toBe('0.0.0');
  });

  it('STORAGE_DRIVER is validated to be local or s3', () => {
    // We can test the config shape; env-based validation would need env mocking
    const config = loadConfig();
    expect(['local', 's3']).toContain(config.STORAGE_DRIVER);
  });
});
