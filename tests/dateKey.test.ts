import { describe, expect, it } from 'vitest';
import { addDays, fromDateKey, startOfDay, toDateKey } from '../utils/dateKey';

// These assertions must hold in every timezone. Deriving the key from toISOString()
// fails all of them from UTC+1 eastward, which is how stored plans drifted a day.
describe('toDateKey', () => {
  it('names the local calendar day whatever the time of day', () => {
    expect(toDateKey(new Date(2026, 7, 24, 0, 0))).toBe('2026-08-24');
    expect(toDateKey(new Date(2026, 7, 24, 12, 0))).toBe('2026-08-24');
    expect(toDateKey(new Date(2026, 7, 24, 23, 59))).toBe('2026-08-24');
  });

  it('pads single-digit months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('agrees with the planner cell it was built from', () => {
    expect(toDateKey(startOfDay(new Date(2026, 7, 24, 18, 30)))).toBe('2026-08-24');
  });

  it('survives month, year and DST boundaries', () => {
    expect(toDateKey(addDays(startOfDay(new Date(2026, 7, 31)), 1))).toBe('2026-09-01');
    expect(toDateKey(addDays(startOfDay(new Date(2026, 11, 31)), 1))).toBe('2027-01-01');
    expect(toDateKey(addDays(startOfDay(new Date(2026, 2, 8)), 1))).toBe('2026-03-09');
    expect(toDateKey(addDays(startOfDay(new Date(2026, 9, 25)), 1))).toBe('2026-10-26');
  });
});

describe('fromDateKey', () => {
  it('round-trips through toDateKey', () => {
    for (const key of ['2026-08-24', '2026-01-05', '2027-12-31']) {
      expect(toDateKey(fromDateKey(key))).toBe(key);
    }
  });

  it('parses to local midnight, not UTC', () => {
    const d = fromDateKey('2026-08-24');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 24]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});
