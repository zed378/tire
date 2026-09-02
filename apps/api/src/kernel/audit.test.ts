import { describe, expect, it } from 'vitest';
import {
  changedFields,
} from './audit.ts';

describe('changedFields', () => {
  it('returns unchanged keys as empty objects', () => {
    const result = changedFields({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(result.before).toEqual({ a: 1 });
    expect(result.after).toEqual({ a: 1 });
  });

  it('returns the changed field in before and after', () => {
    const result = changedFields({ name: 'Alice', age: 30 }, { age: 31 });
    expect(result.before).toEqual({ age: 30 });
    expect(result.after).toEqual({ age: 31 });
  });

  it('ignores undefined values in after', () => {
    const result = changedFields({ name: 'Alice' }, { name: undefined as unknown as string });
    expect(result.before).toEqual({});
    expect(result.after).toEqual({});
  });

  it('handles Date comparisons by time', () => {
    const d1 = new Date('2026-01-01T00:00:00Z');
    const d2 = new Date('2026-01-01T00:00:00Z');
    const result = changedFields({ updated: d1 }, { updated: d2 });
    expect(result.before).toEqual({});
    expect(result.after).toEqual({});
  });

  it('handles Date comparison when different', () => {
    const d1 = new Date('2026-01-01T00:00:00Z');
    const d2 = new Date('2026-01-02T00:00:00Z');
    const result = changedFields({ updated: d1 }, { updated: d2 });
    expect(result.before.updated).toBe(d1);
    expect(result.after.updated).toBe(d2);
  });
});
