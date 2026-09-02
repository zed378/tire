import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/index.js';
import { translateDatabaseError } from './database-errors.ts';
import { AppError } from './app-error.ts';

describe('translateDatabaseError', () => {
  /**
   * A real Prisma error, not a shaped object.
   *
   * `translateDatabaseError` dispatches on `instanceof`, so an object literal
   * cast through `unknown` fails every branch and the function returns null.
   * Nine tests in this file asserted against that null and failed — invisibly,
   * because a typecheck error elsewhere kept the suite from running at all.
   */
  const makePrismaError = (
    code: string,
    meta: Record<string, unknown> = {},
  ): Prisma.PrismaClientKnownRequestError =>
    new Prisma.PrismaClientKnownRequestError('', { code, clientVersion: '0.0.0', meta });

  it('returns null for a non-Prisma error', () => {
    expect(translateDatabaseError(new Error('random error'))).toBeNull();
  });

  it('returns null for a string error', () => {
    expect(translateDatabaseError('some error')).toBeNull();
  });

  it('translates uq_locking_inspection to DUPLICATE_PLATE', () => {
    const err = makePrismaError('P2002', { target: ['uq_locking_inspection'] });
    const result = translateDatabaseError(err);
    expect(result).toBeInstanceOf(AppError);
    expect(result?.code).toBe('DUPLICATE_PLATE');
  });

  it('translates uq_vehicle_plate to DUPLICATE_PLATE', () => {
    const err = makePrismaError('P2002', { target: ['uq_vehicle_plate'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('DUPLICATE_PLATE');
  });

  it('translates uq_vehicle_chassis to DUPLICATE_CHASSIS', () => {
    const err = makePrismaError('P2002', { target: ['uq_vehicle_chassis'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('DUPLICATE_CHASSIS');
  });

  it('translates ck_plate_format to VALIDATION_ERROR', () => {
    const err = makePrismaError('P2002', { target: ['ck_plate_format'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.field).toBe('plateDisplay');
  });

  it('translates ck_plate_key_len to VALIDATION_ERROR', () => {
    const err = makePrismaError('P2002', { target: ['ck_plate_key_len'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
  });

  it('translates ck_chassis_format to VALIDATION_ERROR', () => {
    const err = makePrismaError('P2002', { target: ['ck_chassis_format'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.field).toBe('chassisNumber');
  });

  it('translates P2003 (FK violation) to VALIDATION_ERROR', () => {
    const err = makePrismaError('P2003');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.field).toBe('root');
  });

  it('translates P2025 (not found) to NOT_FOUND', () => {
    const err = makePrismaError('P2025');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('NOT_FOUND');
  });

  it('translates AXLE_SUM_MISMATCH trigger', () => {
    const err = new Error('AXLE_SUM_MISMATCH (3)(4)') as unknown as Prisma.PrismaClientKnownRequestError;
    err.code = 'P2002';
    err.meta = { target: ['ck_axle_sum'] };
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.field).toBe('axleConfigs');
    expect(result?.fieldErrors?.[0]?.message).toContain('3');
    expect(result?.fieldErrors?.[0]?.message).toContain('4');
  });

  it('translates PHOTO_LIMIT_EXCEEDED trigger (per pengajuan)', () => {
    const err = new Error('PHOTO_LIMIT_EXCEEDED: maksimal 30 foto per pengajuan');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.message).toBe('Maksimal 30 foto per pengajuan.');
  });

  it('translates PHOTO_LIMIT_EXCEEDED trigger (per slot)', () => {
    const err = new Error('PHOTO_LIMIT_EXCEEDED: maksimal 10 foto per slot');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('VALIDATION_ERROR');
    expect(result?.fieldErrors?.[0]?.message).toBe('Maksimal 10 foto per slot.');
  });

  it('translates PrismaClientInitializationError to SERVICE_UNAVAILABLE', () => {
    const err = new Prisma.PrismaClientInitializationError('connection refused', '0.0.0');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('translates PrismaClientRustPanicError to SERVICE_UNAVAILABLE', () => {
    const err = new Prisma.PrismaClientRustPanicError('rust panic', '0.0.0');
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns null for an unknown constraint', () => {
    const err = makePrismaError('P2002', { target: ['unknown_constraint_xyz'] });
    const result = translateDatabaseError(err);
    expect(result).toBeNull();
  });

  it('handles constraint meta key (alternative to target)', () => {
    const err = makePrismaError('P2002', { constraint: ['uq_vehicle_plate'] });
    const result = translateDatabaseError(err);
    expect(result?.code).toBe('DUPLICATE_PLATE');
  });
});
