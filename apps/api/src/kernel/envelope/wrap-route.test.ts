import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { zodErrorToAppError, errorEnvelope } from './wrap-route.ts';
import { AppError } from './app-error.ts';

describe('zodErrorToAppError', () => {
  it('converts a ZodError with one issue into an AppError', () => {
    const zodErr = new ZodError([
      { code: 'too_small', minimum: 10, type: 'string', inclusive: true, message: 'terlalu pendek', path: ['username'] },
    ]);
    const result = zodErrorToAppError(zodErr);
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('Username');
    expect(result.fieldErrors).toHaveLength(1);
    expect(result.fieldErrors?.[0].field).toBe('username');
    expect(result.fieldErrors?.[0].code).toBe('TOO_SHORT');
  });

  it('converts a ZodError with multiple issues across different paths', () => {
    const zodErr = new ZodError([
      { code: 'too_small', minimum: 10, type: 'string', inclusive: true, message: 'terlalu pendek', path: ['password'] },
      { code: 'invalid_string', validation: 'email', message: 'format tidak valid', path: ['email'] },
    ]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors).toHaveLength(2);
    const fields = result.fieldErrors!.map((f) => f.field);
    expect(fields).toContain('password');
    expect(fields).toContain('email');
  });

  it('does not crash on empty issues array', () => {
    const result = zodErrorToAppError(new ZodError([]));
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.fieldErrors).toHaveLength(0);
  });

  it('maps not_an_integer to INVALID_FORMAT via fieldCodeFor', () => {
    const zodErr = new ZodError([{ code: 'not_an_integer', path: ['quantity'], message: 'bukan integer' }]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors?.[0]?.code).toBe('INVALID_FORMAT');
  });

  it('maps unrecognized_keys to root NOT_ALLOWED', () => {
    const zodErr = new ZodError([{ code: 'unrecognized_keys', path: [], message: 'field tidak dikenal', unrecognized: ['extra_field'] }]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors?.[0]?.field).toBe('root');
    expect(result.fieldErrors?.[0]?.code).toBe('NOT_ALLOWED');
  });

  it('joins nested paths with dots', () => {
    const zodErr = new ZodError([{ code: 'invalid_type', expected: 'string', received: 'undefined', path: ['address', 'city'], message: 'Required' }]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors?.[0]?.field).toBe('address.city');
  });

  it('maps too_big to TOO_LONG', () => {
    const zodErr = new ZodError([{ code: 'too_big', type: 'string', inclusive: false, maximum: 100, path: ['name'], message: 'terlalu panjang' }]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors?.[0]?.code).toBe('TOO_LONG');
  });

  it('maps invalid_enum_value to INVALID_FORMAT', () => {
    const zodErr = new ZodError([{ code: 'invalid_enum_value', path: ['segment'], message: 'invalid', options: ['bus', 'truck'] }]);
    const result = zodErrorToAppError(zodErr);
    expect(result.fieldErrors?.[0]?.code).toBe('INVALID_FORMAT');
  });
});

describe('errorEnvelope integration', () => {
  it('includes field errors from zodErrorToAppError', () => {
    const zodErr = new ZodError([
      { code: 'too_small', minimum: 10, type: 'string', inclusive: true, message: 'Wajib diisi', path: ['username'] },
    ]);
    const appErr = zodErrorToAppError(zodErr);
    const envelope = errorEnvelope(appErr, 'req_test');
    expect(envelope.ok).toBe(false);
    expect(envelope.errors).toHaveLength(1);
    expect(envelope.errors?.[0].field).toBe('username');
  });

  it('omits errors array for non-validation AppErrors', () => {
    const appErr = new AppError('NOT_FOUND');
    const envelope = errorEnvelope(appErr, 'req_test');
    expect(envelope.ok).toBe(false);
    expect('errors' in envelope).toBe(false);
  });
});
