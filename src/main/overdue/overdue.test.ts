import { describe, test, expect } from 'vitest';
import {
  createOverdueLevelsArray,
  convertOverdueTimeToOverdueLevelObject,
  convertOverdueLevelObjectToScreenSize,
  clampRectToWorkArea,
  OverdueLevelObject,
} from './overdueGeometry';
import { OverdueConfigs } from './overdueConfigs';

describe('createOverdueLevelsArray', () => {
  // 5 levels, 10s apart, 100% cap → ratios: 0.2, 0.4, 0.6, 0.8, 1.0
  const configs: OverdueConfigs = {
    levelThresholdMs: 10 * 1000,
    windowLevelCap: 5,
    windowRatioCap: 1.0,
  };

  test('produces one entry per level', () => {
    const levels = createOverdueLevelsArray(configs);
    expect(levels).toHaveLength(configs.windowLevelCap);
  });

  test('first level starts at 0ms with a non-zero ratio', () => {
    const levels = createOverdueLevelsArray(configs);
    expect(levels[0].levelStartMs).toBe(0);
    expect(levels[0].levelWindowRatio).toBeGreaterThan(0);
  });

  test('each ratio is derived from (level+1)/total * cap, not accumulated', () => {
    // Accumulating would compound toFixed(2) rounding errors across levels.
    // Direct derivation keeps each level independent.
    const levels = createOverdueLevelsArray(configs);
    expect(levels[0].levelWindowRatio).toBe(0.2);  // (1/5) * 1.0
    expect(levels[1].levelWindowRatio).toBe(0.4);  // (2/5) * 1.0
    expect(levels[2].levelWindowRatio).toBe(0.6);  // (3/5) * 1.0
    expect(levels[3].levelWindowRatio).toBe(0.8);  // (4/5) * 1.0
    expect(levels[4].levelWindowRatio).toBe(1.0);  // (5/5) * 1.0
  });

  test('thresholds are evenly spaced by levelThresholdMs', () => {
    const levels = createOverdueLevelsArray(configs);
    for (let i = 0; i < levels.length; i++) {
      expect(levels[i].levelStartMs).toBe(i * configs.levelThresholdMs);
    }
  });

  test('last level ratio equals the cap', () => {
    const levels = createOverdueLevelsArray(configs);
    expect(levels[levels.length - 1].levelWindowRatio).toBe(configs.windowRatioCap);
  });

  test('ratios scale proportionally with a non-1.0 cap', () => {
    const capped: OverdueConfigs = {
      levelThresholdMs: 10 * 1000,
      windowLevelCap: 4,
      windowRatioCap: 0.8,
    };
    const levels = createOverdueLevelsArray(capped);
    expect(levels[0].levelWindowRatio).toBe(capped.windowRatioCap / capped.windowLevelCap);  // (1/4) * 0.8
    expect(levels[3].levelWindowRatio).toBe(capped.windowRatioCap);  // (4/4) * 0.8
  });

  test('rounds ratios to 2 decimal places', () => {
    // 3 levels with 1.0 cap → raw ratios 0.333..., 0.666..., 1.0
    // If someone removes toFixed or switches to accumulation, this breaks
    const thirds: OverdueConfigs = {
      levelThresholdMs: 10 * 1000,
      windowLevelCap: 3,
      windowRatioCap: 1.0,
    };
    const levels = createOverdueLevelsArray(thirds);
    expect(levels[0].levelWindowRatio).toBe(0.33);
    expect(levels[1].levelWindowRatio).toBe(0.67);
    expect(levels[2].levelWindowRatio).toBe(1.0);
  });

  test('single level produces one entry at the full cap', () => {
    const single: OverdueConfigs = {
      levelThresholdMs: 5 * 1000,
      windowLevelCap: 1,
      windowRatioCap: 0.5,
    };
    const levels = createOverdueLevelsArray(single);
    expect(levels).toHaveLength(1);
    expect(levels[0].levelIdx).toEqual(0);
    expect(levels[0].levelStartMs).toEqual(0);
    expect(levels[0].levelWindowRatio).toEqual(single.windowRatioCap);
  });
});

describe('convertOverdueTimeToOverdueLevelObject', () => {
  // Hand-built array so these tests don't depend on createOverdueLevelsArray
  const levels: OverdueLevelObject[] = [
    { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 0.2 },
    { levelIdx: 1, levelStartMs: 10 * 1000, levelWindowRatio: 0.4 },
    { levelIdx: 2, levelStartMs: 20 * 1000, levelWindowRatio: 0.6 },
    { levelIdx: 3, levelStartMs: 30 * 1000, levelWindowRatio: 0.8 },
    { levelIdx: 4, levelStartMs: 40 * 1000, levelWindowRatio: 1.0 },
  ];

  test('returns first level when overdue time is 0', () => {
    const result = convertOverdueTimeToOverdueLevelObject(0, levels);
    expect(result.levelIdx).toBe(0);
  });

  test('stays at current level between thresholds', () => {
    const result = convertOverdueTimeToOverdueLevelObject(9.999 * 1000, levels);
    expect(result.levelIdx).toBe(0);
  });

  test('advances exactly at threshold boundary', () => {
    // Catches >= vs > off-by-one
    const result = convertOverdueTimeToOverdueLevelObject(10 * 1000, levels);
    expect(result.levelIdx).toBe(1);
  });

  test('returns highest level when time exceeds all thresholds', () => {
    const result = convertOverdueTimeToOverdueLevelObject(999999 * 1000, levels);
    expect(result.levelIdx).toBe(4);
    expect(result.levelWindowRatio).toBe(1.0);
  });

  test('returns the complete level object, not just the index', () => {
    const result = convertOverdueTimeToOverdueLevelObject(20 * 1000, levels);
    expect(result).toEqual({
      levelIdx: 2,
      levelStartMs: 20 * 1000,
      levelWindowRatio: 0.6,
    });
  });

  test('works with unevenly spaced levels', () => {
    // The function walks the array — spacing shouldn't matter
    const uneven: OverdueLevelObject[] = [
      { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 0.1 },
      { levelIdx: 1, levelStartMs: 5 * 1000, levelWindowRatio: 0.3 },
      { levelIdx: 2, levelStartMs: 30 * 1000, levelWindowRatio: 0.7 },
    ];
    expect(convertOverdueTimeToOverdueLevelObject(4.999 * 1000, uneven).levelIdx).toBe(0);
    expect(convertOverdueTimeToOverdueLevelObject(5 * 1000, uneven).levelIdx).toBe(1);
    expect(convertOverdueTimeToOverdueLevelObject(29.999 * 1000, uneven).levelIdx).toBe(1);
    expect(convertOverdueTimeToOverdueLevelObject(30 * 1000, uneven).levelIdx).toBe(2);
  });
});

describe('convertOverdueLevelObjectToScreenSize', () => {
  const screen = { width: 1920, height: 1080 };

  test('applies sqrt so the ratio represents screen area, not side length', () => {
    // ratio 0.25 → sqrt = 0.5 → each side is half → area is 0.25 of total
    // Without sqrt, dimensions would be 480×270 — this test catches that
    const level: OverdueLevelObject = { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 0.25 };
    const result = convertOverdueLevelObjectToScreenSize(screen, level);
    expect(result.width).toBe(960);   // 1920 × 0.5
    expect(result.height).toBe(540);  // 1080 × 0.5
  });

  test('ratio of 1.0 returns the full screen size', () => {
    const level: OverdueLevelObject = { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 1.0 };
    const result = convertOverdueLevelObjectToScreenSize(screen, level);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  test('preserves the screen aspect ratio', () => {
    const level: OverdueLevelObject = { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 0.5 };
    const result = convertOverdueLevelObjectToScreenSize(screen, level);
    const inputRatio = screen.width / screen.height;
    const outputRatio = result.width / result.height;
    expect(outputRatio).toBeCloseTo(inputRatio);
  });

  test('scales correctly for a non-standard screen size', () => {
    const ultrawide = { width: 2560, height: 1440 };
    // ratio 0.64 → sqrt = 0.8
    const level: OverdueLevelObject = { levelIdx: 0, levelStartMs: 0, levelWindowRatio: 0.64 };
    const result = convertOverdueLevelObjectToScreenSize(ultrawide, level);
    expect(result.width).toBe(2048);   // 2560 × 0.8
    expect(result.height).toBe(1152);  // 1440 × 0.8
  });
});

describe('clampRectToWorkArea', () => {
  // Typical work area: full width, taskbar eats 40px at the bottom
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };

  test('window fully inside work area passes through unchanged', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(clampRectToWorkArea(rect, workArea)).toEqual(rect);
  });

  test('clamps window extending past right edge', () => {
    const rect = { x: 1800, y: 100, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, workArea);
    expect(result.x).toBe(1520);  // 1920 − 400
    expect(result.y).toBe(100);
  });

  test('clamps window extending past bottom edge', () => {
    const rect = { x: 100, y: 900, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, workArea);
    expect(result.y).toBe(740);  // 1040 − 300
    expect(result.x).toBe(100);
  });

  test('clamps window extending past top-left corner', () => {
    const rect = { x: -50, y: -30, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, workArea);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('respects work area y-offset from menubar', () => {
    // macOS: menubar pushes workArea.y to 25
    const macWorkArea = { x: 0, y: 25, width: 1920, height: 1055 };
    const rect = { x: 100, y: 10, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, macWorkArea);
    expect(result.y).toBe(25);  // clamped to workArea.y, not 0
  });

  test('respects work area x-offset from side taskbar', () => {
    // Windows: taskbar on left pushes workArea.x to 48
    const sidebarWorkArea = { x: 48, y: 0, width: 1872, height: 1080 };
    const rect = { x: 20, y: 100, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, sidebarWorkArea);
    expect(result.x).toBe(48);  // clamped to workArea.x, not 0
  });

  test('window bigger than work area pins to top-left corner', () => {
    const rect = { x: 500, y: 500, width: 3000, height: 2000 };
    const result = clampRectToWorkArea(rect, workArea);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('size passes through even when window exceeds work area', () => {
    // clampRectToWorkArea is position-only — size is never modified
    const rect = { x: 9999, y: 9999, width: 400, height: 300 };
    const result = clampRectToWorkArea(rect, workArea);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  test('window exactly at work area boundary is not moved', () => {
    // Right and bottom edges touch the boundary exactly
    const rect = { x: 1520, y: 740, width: 400, height: 300 };
    expect(clampRectToWorkArea(rect, workArea)).toEqual(rect);
  });
});