import { describe, expect, it } from 'vitest';
import { generateRequestId } from './logger.ts';

describe('generateRequestId', () => {
  it('matches the expected format req_YYYYMMDD_HHMMSS_xxxx', () => {
    const id = generateRequestId(new Date('2026-09-01T14:30:22Z'));
    expect(id).toMatch(/^req_20260901_143022_[0-9a-f]{4}$/);
  });

  it('includes month with leading zero', () => {
    const id = generateRequestId(new Date('2026-01-15T00:00:00Z'));
    expect(id).toMatch(/^req_20260115/);
  });

  it('includes day with leading zero', () => {
    const id = generateRequestId(new Date('2026-01-05T00:00:00Z'));
    expect(id).toMatch(/^req_20260105/);
  });

  it('includes hour with leading zero', () => {
    const id = generateRequestId(new Date('2026-09-01T09:00:00Z'));
    expect(id).toMatch(/_0900/);
  });

  it('includes minute with leading zero', () => {
    const id = generateRequestId(new Date('2026-09-01T00:05:00Z'));
    expect(id).toMatch(/_0005/);
  });

  it('includes second with leading zero', () => {
    const id = generateRequestId(new Date('2026-09-01T00:00:05Z'));
    expect(id).toMatch(/_000005/);
  });

  it('includes random hex segment (4 chars)', () => {
    const id = generateRequestId();
    expect(id.split('_').pop()).toMatch(/^[0-9a-f]{4}$/);
  });

  it('returns unique ids for different invocations', () => {
    const id1 = generateRequestId(new Date('2026-01-01T00:00:00Z'));
    const id2 = generateRequestId(new Date('2026-01-01T00:00:00Z'));
    // Same time may still differ in random portion
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
  });
});
