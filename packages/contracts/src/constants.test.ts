import { describe, expect, it } from 'vitest';
import {
  formatSerialNumber,
  SERIAL_SEQUENCE_DIGITS,
  isLockingStatus,
  INSPECTION_STATUSES,
  INSPECTION_STATUS_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_SEGMENTS,
  VEHICLE_SEGMENT_LABELS,
  SEGMENTS_BY_CATEGORY,
  SUB_SEGMENTS_BY_SEGMENT,
  ALL_SUB_SEGMENTS,
  AXLE_TYPES,
  QC_DECISIONS,
  QC_DECISION_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  EVENT_TYPES,
  UNMUTABLE_EVENT_TYPES,
  RETENTION_MONTHS,
  DRAFT_EXPIRY_DAYS,
  MIN_QC_NOTES_LENGTH,
} from './constants.ts';

describe('formatSerialNumber', () => {
  it('formats serial number with 5 digit sequence', () => {
    const result = formatSerialNumber(2026, 1);
    expect(result).toBe('SN2026-00001');
  });

  it('formats serial number with larger sequence', () => {
    const result = formatSerialNumber(2026, 12345);
    expect(result).toBe('SN2026-12345');
  });

  it('formats serial number with max sequence for this year', () => {
    const result = formatSerialNumber(2026, 99999);
    expect(result).toBe('SN2026-99999');
  });
});

describe('SERIAL_SEQUENCE_DIGITS', () => {
  it('is 5 digits', () => {
    expect(SERIAL_SEQUENCE_DIGITS).toBe(5);
  });
});

describe('isLockingStatus', () => {
  it('returns true for pending_qc', () => {
    expect(isLockingStatus('pending_qc')).toBe(true);
  });

  it('returns true for needs_revision', () => {
    expect(isLockingStatus('needs_revision')).toBe(true);
  });

  it('returns true for passed_qc', () => {
    expect(isLockingStatus('passed_qc')).toBe(true);
  });

  it('returns false for dropped_qc', () => {
    expect(isLockingStatus('dropped_qc')).toBe(false);
  });

  it('returns false for draft', () => {
    expect(isLockingStatus('draft')).toBe(false);
  });
});

describe('INSPECTION_STATUSES', () => {
  it('contains all expected statuses', () => {
    expect(INSPECTION_STATUSES).toContain('draft');
    expect(INSPECTION_STATUSES).toContain('pending_qc');
    expect(INSPECTION_STATUSES).toContain('needs_revision');
    expect(INSPECTION_STATUSES).toContain('passed_qc');
    expect(INSPECTION_STATUSES).toContain('dropped_qc');
    expect(INSPECTION_STATUSES).toHaveLength(5);
  });
});

describe('INSPECTION_STATUS_LABELS', () => {
  it('maps draft to Indonesian label', () => {
    expect(INSPECTION_STATUS_LABELS['draft']).toBe('Draf');
  });

  it('maps passed_qc to Indonesian label', () => {
    expect(INSPECTION_STATUS_LABELS['passed_qc']).toBe('Pass QC');
  });
});

describe('USER_ROLES and USER_ROLE_LABELS', () => {
  it('contains all expected roles', () => {
    expect(USER_ROLES).toContain('supplier');
    expect(USER_ROLES).toContain('admin');
    expect(USER_ROLES).toContain('manager');
    expect(USER_ROLES).toContain('operator');
  });

  it('maps admin to correct label', () => {
    expect(USER_ROLE_LABELS['admin']).toBe('Admin');
  });

  it('maps supplier to correct label', () => {
    expect(USER_ROLE_LABELS['supplier']).toBe('Data Supplier');
  });
});

describe('VEHICLE_CATEGORIES and VEHICLE_SEGMENTS', () => {
  it('contains TB and LT categories', () => {
    expect(VEHICLE_CATEGORIES).toContain('TB');
    expect(VEHICLE_CATEGORIES).toContain('LT');
  });

  it('maps TB to both bus and truck segments', () => {
    expect(VEHICLE_CATEGORY_LABELS['TB']).toBe('TB (Truck & Bus)');
  });

  it('maps LT to correct label', () => {
    expect(VEHICLE_CATEGORY_LABELS['LT']).toBe('LT (Light Truck)');
  });

  it('SEGMENTS_BY_CATEGORY restricts LT to truck only', () => {
    expect(SEGMENTS_BY_CATEGORY['LT']).toEqual(['truck']);
  });

  it('SEGMENTS_BY_CATEGORY allows both for TB', () => {
    expect(SEGMENTS_BY_CATEGORY['TB']).toEqual(['bus', 'truck']);
  });

  it('SUB_SEGMENTS_BY_SEGMENT has correct sub-segments for bus', () => {
    expect(SUB_SEGMENTS_BY_SEGMENT['bus']).toContain('Intercity Bus (Bus AKAP)');
    expect(SUB_SEGMENTS_BY_SEGMENT['bus']).toContain('City Bus (Bus Kota)');
  });

  it('ALL_SUB_SEGMENTS combines all sub-segments', () => {
    expect(ALL_SUB_SEGMENTS).toHaveLength(
      SUB_SEGMENTS_BY_SEGMENT.bus.length + SUB_SEGMENTS_BY_SEGMENT.truck.length
    );
  });
});

describe('AXLE_TYPES', () => {
  it('contains all axle types', () => {
    expect(AXLE_TYPES).toContain('steer');
    expect(AXLE_TYPES).toContain('drive');
    expect(AXLE_TYPES).toContain('free_rolling');
  });
});

describe('QC_DECISIONS', () => {
  it('contains all QC decisions', () => {
    expect(QC_DECISIONS).toContain('pass');
    expect(QC_DECISIONS).toContain('drop');
    expect(QC_DECISIONS).toContain('revision');
  });

  it('maps pass to correct label', () => {
    expect(QC_DECISION_LABELS['pass']).toBe('Pass QC (Lanjut ke Spesifikasi Ban)');
  });

  it('maps drop to correct label', () => {
    expect(QC_DECISION_LABELS['drop']).toBe('Drop QC (Tolak)');
  });

  it('MIN_QC_NOTES_LENGTH is 10', () => {
    expect(MIN_QC_NOTES_LENGTH).toBe(10);
  });
});

describe('NOTIFICATION_CHANNELS', () => {
  it('contains all channels', () => {
    expect(NOTIFICATION_CHANNELS).toContain('in_app');
    expect(NOTIFICATION_CHANNELS).toContain('email');
    expect(NOTIFICATION_CHANNELS).toContain('whatsapp');
  });
});

describe('NOTIFICATION_STATUSES', () => {
  it('contains all statuses', () => {
    expect(NOTIFICATION_STATUSES).toContain('pending');
    expect(NOTIFICATION_STATUSES).toContain('sent');
    expect(NOTIFICATION_STATUSES).toContain('failed');
    expect(NOTIFICATION_STATUSES).toContain('suppressed');
  });
});

describe('EVENT_TYPES and UNMUTABLE_EVENT_TYPES', () => {
  it('contains inspection.submitted', () => {
    expect(EVENT_TYPES).toContain('inspection.submitted');
  });

  it('contains user.password_reset as immutable', () => {
    expect(UNMUTABLE_EVENT_TYPES).toContain('user.password_reset');
  });

  it('contains user.login_from_new_device as immutable', () => {
    expect(UNMUTABLE_EVENT_TYPES).toContain('user.login_from_new_device');
  });

  it('contains inspection.needs_revision as immutable', () => {
    expect(UNMUTABLE_EVENT_TYPES).toContain('inspection.needs_revision');
  });
});

describe('Retention and expiry constants', () => {
  it('RETENTION_MONTHS is 24', () => {
    expect(RETENTION_MONTHS).toBe(24);
  });

  it('DRAFT_EXPIRY_DAYS is 30', () => {
    expect(DRAFT_EXPIRY_DAYS).toBe(30);
  });
});
