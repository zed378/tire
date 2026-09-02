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
  it('throws FORBIDDEN_ROLE when operator lacks submission.read.all', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(() => requirePermission(actor, 'submission.read.all')).toThrow(
      'Anda tidak memiliki akses untuk melakukan tindakan ini.',
    );
  });

  it('throws STEP_UP_REQUIRED when step-up is needed and not elevated', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(() => requirePermission(actor, 'ops.job.retry')).toThrow(
      'Aksi ini memerlukan verifikasi ulang. Masukkan kode autentikasi Anda.',
    );
  });
});

describe('hasPermission', () => {
  it('returns true for admin with qc.review', () => {
    const actor = { ...baseActor, role: 'admin' as const };
    expect(hasPermission(actor, 'qc.review')).toBe(true);
  });

  it('returns false for operator with submission.read.all', () => {
    const actor = { ...baseActor, role: 'operator' as const };
    expect(hasPermission(actor, 'submission.read.all')).toBe(false);
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
    expect(() => inspectionScope(actor)).toThrow(
      'Anda tidak memiliki akses untuk melakukan tindakan ini.',
    );
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
    expect(() => vehicleScope(actor)).toThrow(
      'Anda tidak memiliki akses untuk melakukan tindakan ini.',
    );
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
    expect(() => assertOwnership(actor, record)).toThrow('Data yang Anda cari tidak ditemukan.');
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

  it('throws VALIDATION_ERROR for supplier with city outside scope', () => {
    const actor = { ...baseActor, role: 'supplier' as const, cityIds: [100n] };
    expect(() => assertCityInScope(actor, { id: 200n, provinceId: 60n }))
      .toThrow('Beberapa isian belum lengkap atau tidak valid.');
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
