import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelative,
  formatBytes,
  formatNumber,
  toDateInputValue,
  startOfDayIso,
  endOfDayIso,
} from './format.ts';

describe('formatDate', () => {
  it('returns date in dd/mm/yyyy WIB format', () => {
    const result = formatDate(new Date('2026-01-15T10:30:00Z'));
    expect(result).toBe('15/01/2026');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('\u2014');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('\u2014');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('\u2014');
  });

  it('handles date string input', () => {
    const result = formatDate('2026-03-08T12:00:00Z');
    expect(result).toBe('08/03/2026');
  });

  it('handles epoch number input', () => {
    const result = formatDate(1705334400000); // 2024-01-15 00:00 UTC
    expect(result).toBe('15/01/2024');
  });
});

describe('formatDateTime', () => {
  it('returns datetime in dd/mm/yyyy HH:MM WIB format', () => {
    const result = formatDateTime(new Date('2026-01-15T10:30:00Z'));
    // WIB is UTC+7, so 10:30 UTC = 17:30 WIB
    expect(result).toBe('15/01/2026 17:30');
  });

  it('returns dash for null', () => {
    expect(formatDateTime(null)).toBe('\u2014');
  });

  it('returns dash for empty string', () => {
    expect(formatDateTime('')).toBe('\u2014');
  });
});

describe('formatRelative', () => {
  it('returns baru saja for less than 1 minute ago', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 30_000); // 30 seconds ago
    expect(formatRelative(recent)).toBe('baru saja');
  });

  it('returns X menit lalu for 1-59 minutes ago', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 5 * 60_000); // 5 minutes ago
    expect(formatRelative(past)).toBe('5 menit lalu');
  });

  it('returns X jam lalu for 1-23 hours ago', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3 * 60 * 60_000); // 3 hours ago
    expect(formatRelative(past)).toBe('3 jam lalu');
  });

  it('returns X hari lalu for 1-29 days ago', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 15 * 24 * 60 * 60_000); // 15 days ago
    expect(formatRelative(past)).toBe('15 hari lalu');
  });

  it('returns formatted date for 30+ days ago', () => {
    const now = new Date('2026-02-15T00:00:00Z');
    const past = new Date('2025-12-01T00:00:00Z'); // ~45 days
    const result = formatRelative(past);
    expect(result).toBe('01/12/2025');
  });

  it('returns dash for null', () => {
    expect(formatRelative(null)).toBe('\u2014');
  });

  it('returns dash for undefined', () => {
    expect(formatRelative(undefined)).toBe('\u2014');
  });
});

describe('formatBytes', () => {
  it('returns bytes for less than 1024', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('returns KB for 1024 to 1MB', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('returns MB for 1MB to 1GB', () => {
    const result = formatBytes(1024 * 1024 * 1.5);
    expect(result).toBe('1.5 MB');
  });

  it('returns GB for 1GB and above', () => {
    const result = formatBytes(1024 * 1024 * 1024 * 2.5);
    expect(result).toBe('2.50 GB');
  });
});

describe('formatNumber', () => {
  it('formats number with Indonesian locale', () => {
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(1234567)).toBe('1.234.567');
  });
});

describe('toDateInputValue', () => {
  it('returns ISO date string without time', () => {
    const result = toDateInputValue(new Date('2026-01-15T14:30:00Z'));
    expect(result).toBe('2026-01-15');
  });
});

describe('startOfDayIso / endOfDayIso', () => {
  it('startOfDayIso returns midnight WIB', () => {
    const result = startOfDayIso('2026-01-15');
    expect(result).toBe('2026-01-14T17:00:00.000Z');
  });

  it('endOfDayIso returns 23:59:59 WIB', () => {
    const result = endOfDayIso('2026-01-15');
    expect(result).toBe('2026-01-15T16:59:59.000Z');
  });
});
