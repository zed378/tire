import { describe, expect, it } from 'vitest';
import { inspect } from 'util';
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_LABELS,
  VALID_TRANSITIONS,
  isLockingStatus,
  QC_DECISIONS,
  QC_DECISION_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  EVENT_TYPES,
  UNMUTABLE_EVENT_TYPES,
  formatSerialNumber,
  SERIAL_SEQUENCE_DIGITS,
  MFA_RECOVERY_CODE_COUNT,
  PRESIGN_TTL_SECONDS,
  DRAFT_EXPIRY_DAYS,
  RETENTION_MONTHS,
  MIN_QC_NOTES_LENGTH,
} from './constants.ts';

// Test that VALID_TRANSITIONS has the correct structure
describe('VALID_TRANSITIONS', () => {
  it('is a Record of arrays', () => {
    for (const [status, transitions] of Object.entries(VALID_TRANSITIONS)) {
      expect(Array.isArray(transitions)).toBe(true);
      for (const t of transitions) {
        expect(typeof t).toBe('string');
      }
    }
  });

  it('allows draft -> pending_qc', () => {
    expect(VALID_TRANSITIONS['draft']).toContain('pending_qc');
  });

  it('allows pending_qc -> needs_revision', () => {
    expect(VALID_TRANSITIONS['pending_qc']).toContain('needs_revision');
  });

  it('allows pending_qc -> passed_qc', () => {
    expect(VALID_TRANSITIONS['pending_qc']).toContain('passed_qc');
  });
});

describe('PRESIGN_TTL_SECONDS', () => {
  it('is 600 seconds (10 minutes)', () => {
    expect(PRESIGN_TTL_SECONDS).toBe(600);
  });
});

describe('MFA_RECOVERY_CODE_COUNT', () => {
  it('is 10 codes', () => {
    expect(MFA_RECOVERY_CODE_COUNT).toBe(10);
  });
});
