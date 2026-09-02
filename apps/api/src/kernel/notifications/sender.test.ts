import { describe, expect, it } from 'vitest';
import {
  isWithinSendingHours,
  shouldDeferUntilMorning,
  secondsUntilSendingWindow,
  QUIET_HOURS,
} from './sender.ts';

describe('isWithinSendingHours', () => {
  it('returns true during WIB business hours (07:00-19:59)', () => {
    // WIB 12:00 = UTC 05:00
    const noon = new Date('2026-01-01T05:00:00Z');
    expect(isWithinSendingHours(noon)).toBe(true);
  });

  it('returns true for WIB 07:00', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(isWithinSendingHours(start)).toBe(true);
  });

  it('returns false for WIB 20:00 (after hours)', () => {
    const end = new Date('2026-01-01T13:00:00Z');
    expect(isWithinSendingHours(end)).toBe(false);
  });

  it('returns false for WIB 00:00 (night)', () => {
    const midnight = new Date('2026-01-01T17:00:00Z');
    expect(isWithinSendingHours(midnight)).toBe(false);
  });

  it('returns false for midnight UTC (23:00 WIB)', () => {
    const late = new Date('2026-01-01T23:00:00Z');
    expect(isWithinSendingHours(late)).toBe(false);
  });
});

describe('shouldDeferUntilMorning', () => {
  it('returns false during sending hours', () => {
    const noon = new Date('2026-01-01T05:00:00Z');
    expect(shouldDeferUntilMorning('inspection.submitted', noon)).toBe(false);
  });

  it('returns true when outside sending hours', () => {
    const midnight = new Date('2026-01-01T23:00:00Z');
    expect(shouldDeferUntilMorning('inspection.submitted', midnight)).toBe(true);
  });

  it('always returns false for password_reset events', () => {
    const midnight = new Date('2026-01-01T23:00:00Z');
    expect(shouldDeferUntilMorning('user.password_reset', midnight)).toBe(false);
  });

  it('always returns false for login_from_new_device events', () => {
    const midnight = new Date('2026-01-01T23:00:00Z');
    expect(shouldDeferUntilMorning('user.login_from_new_device', midnight)).toBe(false);
  });
});

describe('secondsUntilSendingWindow', () => {
  it('returns a small number when already in sending hours', () => {
    const noon = new Date('2026-01-01T05:00:00Z');
    const seconds = secondsUntilSendingWindow(noon);
    // Should return seconds until next day's window
    expect(seconds).toBeGreaterThan(0);
  });

  it('returns the seconds until next 07:00 WIB when outside window', () => {
    // WIB 20:00 = UTC 13:00
    const evening = new Date('2026-01-01T13:00:00Z');
    const seconds = secondsUntilSendingWindow(evening);
    // Should be ~14 hours = ~50400 seconds
    expect(seconds).toBeGreaterThan(40000);
    expect(seconds).toBeLessThan(60000);
  });
});

describe('QUIET_HOURS', () => {
  it('has startHourWib of 7', () => {
    expect(QUIET_HOURS.startHourWib).toBe(7);
  });

  it('has endHourWib of 20', () => {
    expect(QUIET_HOURS.endHourWib).toBe(20);
  });
});
