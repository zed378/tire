import { describe, expect, it } from 'vitest';
import {
  requirePermission,
  hasPermission,
  inspectionScope,
  vehicleScope,
  assertOwnership,
  assertCityInScope,
  statusBlocksNewInspection,
} from './authorization.ts';

const baseActor = {
  id: 1n,
  username: 'test',
  displayName: 'Test',
  sessionId: 'sess-1',
  elevatedUntil: null,
  provinceIds: [] as bigint[],
  cityIds: [] as bigint[],
};

describe('requirePermission', () => {
  it('throws FORBIDDEN_ROLE when operator lacks inspection.read', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(() => requirePermission(actor, 'inspection.read')).toThrow('FORBIDDEN_ROLE');
  });

  it('throws STEP_UP_REQUIRED when step-up is needed and not elevated', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    expect(() => requirePermission(actor, 'qc.decide')).toThrow('STEP_UP_REQUIRED');
  });
});

describe('hasPermission', () => {
  it('returns true for admin with qc.decide', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    expect(hasPermission(actor, 'qc.decide')).toBe(true);
  });

  it('returns false for operator with inspection.read', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(hasPermission(actor, 'inspection.read')).toBe(false);
  });
});

describe('inspectionScope', () => {
  it('returns submittedById for suppliers', () => {
    const actor = { ...baseActor, role: 'supplier' as const, id: 123n };
    const scope = inspectionScope(actor);
    expect(scope).toEqual({ submittedById: 123n, deletedAt: null });
  });

  it('returns only deletedAt for admins', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    const scope = inspectionScope(actor);
    expect(scope).toEqual({ deletedAt: null });
  });

  it('returns status passed_qc for managers', () => {
    const actor = { ...baseActor, role: 'manager' as const };
    const scope = inspectionScope(actor);
    expect(scope).toEqual({ deletedAt: null, status: 'passed_qc' });
  });

  it('throws FORBIDDEN_ROLE for operators', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(() => inspectionScope(actor)).toThrow('FORBIDDEN_ROLE');
  });
});

describe('vehicleScope', () => {
  it('returns createdById for suppliers', () => {
    const actor = { ...baseActor, role: 'supplier' as const, id: 123n };
    const scope = vehicleScope(actor);
    expect(scope).toEqual({ createdById: 123n, deletedAt: null });
  });

  it('returns only deletedAt for admins and managers', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    const scope = vehicleScope(actor);
    expect(scope).toEqual({ deletedAt: null });
  });

  it('throws FORBIDDEN_ROLE for operators', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(() => vehicleScope(actor)).toThrow('FORBIDDEN_ROLE');
  });
});

describe('assertOwnership', () => {
  it('does not throw when supplier owns the record', () => {
    const actor = { ...baseActor, role: 'supplier' as const, id: 123n };
    const record = { submittedById: 123n };
    expect(() => assertOwnership(actor, record)).not.toThrow();
  });

  it('throws NOT_FOUND when supplier does not own the record', () => {
    const actor = { ...baseActor, role: 'supplier' as const, id: 123n };
    const record = { submittedById: 456n };
    expect(() => assertOwnership(actor, record)).toThrow('NOT_FOUND');
  });

  it('does not throw for non-supplier roles', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    const record = { submittedById: 456n };
    expect(() => assertOwnership(actor, record)).not.toThrow();
  });
});

describe('assertCityInScope', () => {
  it('allows supplier with city in scope', () => {
    const actor = { ...baseActor, role: 'supplier' as const, cityIds: [100n] };
    expect(() => assertCityInScope(actor, { id: 100n, provinceId: 50n })).not.toThrow();
  });

  it('allows supplier with province in scope', () => {
    const actor = { ...baseActor, role: 'supplier' as const, provinceIds: [50n] };
    expect(() => assertCityInScope(actor, { id: 100n, provinceId: 50n })).not.toThrow();
  });

  it('throws for supplier with city outside scope', () => {
    const actor = { ...baseActor, role: 'supplier' as const, cityIds: [100n] };
    expect(() => assertCityInScope(actor, { id: 200n, provinceId: 60n }))
      .toThrow('VALIDATION_ERROR');
  });

  it('skips check for admins', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    expect(() => assertCityInScope(actor, { id: 999n, provinceId: 999n })).not.toThrow();
  });
});

describe('statusBlocksNewInspection', () => {
  it('returns true for pending_qc', () => {
    expect(statusBlocksNewInspection('pending_qc')).toBe(true);
  });

  it('returns true for needs_revision', () => {
    expect(statusBlocksNewInspection('needs_revision')).toBe(true);
  });

  it('returns true for passed_qc', () => {
    expect(statusBlocksNewInspection('passed_qc')).toBe(true);
  });

  it('returns false for draft', () => {
    expect(statusBlocksNewInspection('draft')).toBe(false);
  });
});
