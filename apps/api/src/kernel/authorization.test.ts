import { describe, expect, it } from 'vitest';
import {
  requirePermission,
  hasPermission,
  can,
  inspectionScope,
  vehicleScope,
  assertOwnership,
} from './authorization.ts';

describe('requirePermission', () => {
  it('returns true when the actor has the permission', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: ['inspection.read'] };
    expect(requirePermission(actor, 'inspection.read')).toBe(true);
  });

  it('returns false when the actor lacks the permission', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: ['inspection.write'] };
    expect(requirePermission(actor, 'inspection.read')).toBe(false);
  });

  it('returns false for an empty permission list', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: [] };
    expect(requirePermission(actor, 'inspection.read')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('returns true when any of the required permissions are present', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: ['inspection.read', 'qc.approve'] };
    expect(hasPermission(actor, ['qc.approve', 'user.manage'])).toBe(true);
  });

  it('returns false when none of the required permissions are present', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: ['inspection.read'] };
    expect(hasPermission(actor, ['qc.approve', 'user.manage'])).toBe(false);
  });
});

describe('can', () => {
  it('returns true when the actor can perform the action', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: ['inspection.delete'] };
    expect(can(actor, 'inspection.delete')).toBe(true);
  });

  it('returns false when the actor cannot perform the action', () => {
    const actor = { id: 1n, role: 'admin' as const, permissions: [] };
    expect(can(actor, 'inspection.delete')).toBe(false);
  });
});

describe('inspectionScope', () => {
  it('filters by submittedById for suppliers', () => {
    const actor = { id: 123n, role: 'supplier' as const };
    const scope = inspectionScope(actor);
    expect(scope).toEqual({ submittedById: 123n });
  });

  it('returns empty scope for non-suppliers', () => {
    const actor = { id: 123n, role: 'admin' as const };
    const scope = inspectionScope(actor);
    expect(scope).toEqual({});
  });
});

describe('vehicleScope', () => {
  it('returns empty object for all roles', () => {
    expect(vehicleScope({ id: 1n, role: 'admin' as const })).toEqual({});
    expect(vehicleScope({ id: 1n, role: 'supplier' as const })).toEqual({});
  });
});

describe('assertOwnership', () => {
  it('does not throw when supplier owns the record', () => {
    const actor = { id: 123n, role: 'supplier' as const };
    const record = { submittedById: 123n };
    expect(() => assertOwnership(actor, record)).not.toThrow();
  });

  it('throws Error when supplier does not own the record', () => {
    const actor = { id: 123n, role: 'supplier' as const };
    const record = { submittedById: 456n };
    expect(() => assertOwnership(actor, record)).toThrow('NOT_FOUND');
  });

  it('does not throw for non-supplier roles', () => {
    const actor = { id: 123n, role: 'admin' as const };
    const record = { submittedById: 456n };
    expect(() => assertOwnership(actor, record)).not.toThrow();
  });
});
