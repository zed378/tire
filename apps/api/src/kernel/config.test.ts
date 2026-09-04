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

/**
 * The configuration that booted perfectly and then failed on the first upload.
 *
 * Production ran with PUBLIC_API_URL on tire-store.zedth.my.id and no
 * STORAGE_HOST. Every screen worked; only uploads failed, and nothing reached
 * the server log — STORAGE_HOST is what puts that origin into the CSP, so the
 * browser refused the PUT before it left the device. It was also a silent
 * security downgrade: the storage host stopped being restricted to
 * /api/uploads/ and served the whole API.
 */
describe('loadConfig: STORAGE_HOST when uploads go elsewhere', () => {
  const orig = { ...process.env };

  function baseEnv(): void {
    process.env = { ...orig };
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.STORAGE_SIGNING_KEY = 'test-key-at-least-16';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
  }

  afterEach(() => {
    process.env = orig;
  });

  it('refuses to boot when PUBLIC_API_URL names a host WEB_ORIGIN does not', () => {
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire-store.zedth.my.id';
    delete process.env.STORAGE_HOST;

    expect(() => loadConfig()).toThrow(/STORAGE_HOST/);
  });

  it('names the value to set, so the message is the fix', () => {
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire-store.zedth.my.id';
    delete process.env.STORAGE_HOST;

    expect(() => loadConfig()).toThrow(/STORAGE_HOST=tire-store\.zedth\.my\.id/);
  });

  it('boots once STORAGE_HOST names that host', () => {
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire-store.zedth.my.id';
    process.env.STORAGE_HOST = 'tire-store.zedth.my.id';

    expect(loadConfig().STORAGE_HOST).toBe('tire-store.zedth.my.id');
  });

  it('says nothing when uploads are served from the application host', () => {
    // The single-hostname deployment is legitimate and must not be obstructed.
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire.zedth.my.id';
    delete process.env.STORAGE_HOST;

    expect(() => loadConfig()).not.toThrow();
  });

  it('says nothing about local development', () => {
    // Vite on :5173, the API on :3000, both localhost. A different PORT is not
    // a different host, and the browser treats the CSP host without the port.
    baseEnv();
    delete process.env.WEB_ORIGIN;
    delete process.env.PUBLIC_API_URL;
    delete process.env.STORAGE_HOST;

    expect(() => loadConfig()).not.toThrow();
  });

  it('refuses a URL where a hostname belongs', () => {
    /*
     * The obvious mistake, and the one actually made. `app.ts` composes the CSP
     * source as `https://${STORAGE_HOST}`, so a URL here becomes
     * `https://https://tire-store...`; the browser discards a source it cannot
     * parse and blocks every upload. `normalizeHost` meanwhile splits on `:` to
     * drop a port and reduces the same value to `https`, matching no request,
     * which switches the storage-host restriction off. Two silent failures from
     * one extra `https://`.
     */
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire-store.zedth.my.id';
    process.env.STORAGE_HOST = 'https://tire-store.zedth.my.id';

    expect(() => loadConfig()).toThrow(/bare hostname/);
  });

  it('refuses a hostname carrying a port or a path', () => {
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://tire-store.zedth.my.id';

    process.env.STORAGE_HOST = 'tire-store.zedth.my.id:3000';
    expect(() => loadConfig()).toThrow(/bare hostname/);

    resetConfigCache();
    process.env.STORAGE_HOST = 'tire-store.zedth.my.id/api';
    expect(() => loadConfig()).toThrow(/bare hostname/);
  });

  it('accepts a host listed among several in WEB_ORIGIN', () => {
    baseEnv();
    process.env.WEB_ORIGIN = 'https://tire.zedth.my.id,https://admin.zedth.my.id';
    process.env.PUBLIC_API_URL = 'https://admin.zedth.my.id';
    delete process.env.STORAGE_HOST;

    expect(() => loadConfig()).not.toThrow();
  });
});
