import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { wrapRoute, zodErrorToAppError } from './wrap-route.ts';

describe('zodErrorToAppError', () => {
  it('converts a ZodError with one issue', () => {
    const zodErr = new ZodError([
      { code: 'too_small', minimum: 10, type: 'string', inclusive: true, message: 'terlalu pendek', path: ['username'] },
    ]);
    const result = zodErrorToAppError(zodErr);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('Username');
    expect(result.fieldErrors).toHaveLength(1);
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
  });

  it('maps not_an_integer to INVALID_FORMAT', () => {
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
});

describe('wrapRoute', () => {
  function makeRoute(handler) {
    return wrapRoute({ body: z.object({ name: z.string().min(1) }) }, handler);
  }

  it('calls the handler and returns its result on success', async () => {
    const route = makeRoute(async (req) => ({ success: true, payload: req.body }));
    const result = await route({ body: { name: 'test' } });
    expect(result).toEqual({ success: true, payload: { name: 'test' } });
  });

  it('returns 422 for a ZodError (body validation failure)', async () => {
    const route = makeRoute(async () => ({ success: true }));
    const result = await route({ body: { name: '' } });
    expect(result.code).toBe(422);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.fieldErrors).toHaveLength(1);
  });

  it('returns 500 for unexpected errors', async () => {
    const route = makeRoute(async () => { throw new Error('database down'); });
    const result = await route({ body: { name: 'test' } });
    expect(result.code).toBe(500);
    expect(result.error.message).toBe('database down');
  });

  it('returns 422 when no body is provided', async () => {
    const route = makeRoute(async () => ({ success: true }));
    const result = await route({});
    expect(result.code).toBe(422);
  });

  it('handles a route without schema successfully', async () => {
    const route = wrapRoute({}, async (req) => ({ data: req.query }));
    const result = await route({ query: { id: '123' } });
    expect(result).toEqual({ data: { id: '123' } });
  });

  it('handles a route with query validation', async () => {
    const route = wrapRoute(
      { query: z.object({ page: z.coerce.number().int().nonnegative() }) },
      async (req) => ({ page: req.query.page })
    );
    const result = await route({ query: { page: '5' } });
    expect(result).toEqual({ page: 5 });
  });

  it('returns 422 when query validation fails', async () => {
    const route = wrapRoute(
      { query: z.object({ page: z.coerce.number().int().nonnegative() }) },
      async (req) => ({ page: req.query.page })
    );
    const result = await route({ query: { page: 'abc' } });
    expect(result.code).toBe(422);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows custom transform function', async () => {
    const route = wrapRoute(
      {},
      async () => ({ data: 'hidden' }),
      () => ({ code: 503, error: { message: 'custom down' } })
    );
    const result = await route({});
    expect(result.code).toBe(503);
    expect(result.error.message).toBe('custom down');
  });
});
