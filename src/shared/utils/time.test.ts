import { describe, test, expect } from 'vitest';
import { isValidWorkdayHours } from './time';

describe('isValidWorkdayHours', () => {
  test('an empty start is invalid', () => {
    expect(isValidWorkdayHours("", "17:00")).toBe(false);
  });

  test('an end before the start is invalid', () => {
    expect(isValidWorkdayHours("17:00", "09:00")).toBe(false);
  });

  test('a normal workday is valid', () => {
    expect(isValidWorkdayHours("09:00", "17:00")).toBe(true);
  });
});
