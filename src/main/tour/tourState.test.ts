import { describe, test, expect, vi } from 'vitest';
import { FILENAMES } from '@shared/constants';
import { getUserDataFromFile, writeToUserDataFile } from '@shared/utils/files';
import { isTourSeen, markTourSeen } from './tourState';

vi.mock('@shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(),
}));

describe('first-run tour flag', () => {
  test('a fresh install has not seen the tour', () => {
    expect(isTourSeen()).toBe(false);
  });

  test('a damaged or unexpected file counts as not seen', () => {
    vi.mocked(getUserDataFromFile).mockReturnValueOnce({ fileContent: { seen: 'yes' }, filePath: '' });
    expect(isTourSeen()).toBe(false);
  });

  test('marking it seen writes the flag, and reads back as seen', () => {
    markTourSeen();
    expect(writeToUserDataFile).toHaveBeenCalledWith(FILENAMES.TOUR.STATE, { seen: true });

    vi.mocked(getUserDataFromFile).mockReturnValueOnce({ fileContent: { seen: true }, filePath: '' });
    expect(isTourSeen()).toBe(true);
  });
});
