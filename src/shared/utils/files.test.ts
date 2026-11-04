import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getUserDataFromFile, writeToUserDataFile } from './files';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/x' },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserDataFromFile', () => {
  test('a half-written JSON file gives undefined so defaults apply', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"timerDurationMs": 12');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getUserDataFromFile('configs.json').fileContent).toBeUndefined();
  });

  test('a valid JSON file is parsed', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"a": 1}');

    expect(getUserDataFromFile('configs.json').fileContent).toEqual({ a: 1 });
  });
});

describe('writeToUserDataFile', () => {
  test('writes to a temp file then renames it over the real one', () => {
    const filePath = path.join('/tmp/x', 'state.json');

    writeToUserDataFile('state.json', { a: 1 });

    expect(fs.writeFileSync).toHaveBeenCalledWith(`${filePath}.tmp`, '{"a":1}');
    expect(fs.renameSync).toHaveBeenCalledWith(`${filePath}.tmp`, filePath);
  });
});
