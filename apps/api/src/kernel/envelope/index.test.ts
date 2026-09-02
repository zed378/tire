import { describe, expect, it } from 'vitest';
import { successEnvelope, errorEnvelope, wrapRoute, zodErrorToAppError } from './index.ts';

describe('successEnvelope', () => {
  it('wraps data with ok:true and requestId', () => {
    const result = successEnvelope({ items: [1, 2, 3] }, 'req_123');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ items: [1, 2, 3] });
    expect(result.requestId).toBe('req_123');
  });

  it('works with string data', () => {
    const result = successEnvelope('hello', 'req_456');
    expect(result.data).toBe('hello');
    expect(result.ok).toBe(true);
  });

  it('works with null data', () => {
    const result = successEnvelope(null, 'req_789');
    expect(result.data).toBeNull();
  });
});

describe('errorEnvelope', () => {
  it('builds error envelope without field errors', async () => {
    const { AppError } = await import('./app-error.ts');
    const err = new AppError('NOT_FOUND');
    const result = errorEnvelope(err, 'req_abc');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe(err.message);
    expect(result.requestId).toBe('req_abc');
    expect(result.errors).toBeUndefined();
  });

  it('includes field errors when present', async () => {
    const { AppError, validationError } = await import('./app-error.ts');
    const err = validationError([
      { field: 'email', code: 'REQUIRED', message: 'Wajib diisi' },
    ]);
    const result = errorEnvelope(err, 'req_def');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { field: 'email', code: 'REQUIRED', message: 'Wajib diisi' },
    ]);
  });
});
