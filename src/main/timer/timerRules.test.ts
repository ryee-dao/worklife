import { describe, test, expect } from 'vitest';
import { act, availableActions, isInWarning, tick, TimerCore, TimerRules, TimerStatus, AvailableActions } from './timerRules';

const RULES: TimerRules = { workMs: 45000, nextWorkMs: 10000, breakMs: 3000, snoozeMs: 5000, lunchMs: 20000, warningMs: 2000, powerups: 3, powerupsLeft: 3, lunchesLeft: 1 };
const at = (status: TimerStatus, currentCountdownMs = 7000, overdueTimeMs = 0): TimerCore => ({ status, currentCountdownMs, overdueTimeMs });

describe('every button in every state', () => {
  // null is a button the state doesn't allow: a stale menu or window can press any of them
  test.each<[TimerStatus, AvailableActions, string | null, string[]]>([
    ['RUNNING', 'stop', 'STOPPED', []],
    ['RUNNING', 'start', null, []],
    ['RUNNING', 'forward', 'OVERDUE_STARTED', ['OPEN_OVERDUE']],
    ['RUNNING', 'skip', null, []],
    ['RUNNING', 'breaktime', null, []],
    ['RUNNING', 'snooze', 'SNOOZED', ['SPEND_POWERUP']],
    ['RUNNING', 'lunch', 'LUNCH_STARTED', ['SPEND_LUNCH']],
    ['OVERDUE', 'stop', 'STOPPED', ['CLOSE_BREAK']],
    ['OVERDUE', 'start', null, []],
    ['OVERDUE', 'forward', null, []],
    ['OVERDUE', 'skip', 'BREAK_SKIPPED', ['SPEND_POWERUP', 'CLOSE_BREAK']],
    ['OVERDUE', 'breaktime', 'BREAK_STARTED', ['OPEN_BREAK']],
    ['OVERDUE', 'snooze', null, []],
    ['OVERDUE', 'lunch', 'LUNCH_STARTED', ['SPEND_LUNCH', 'CLOSE_BREAK']],
    ['BREAK', 'stop', 'STOPPED', ['CLOSE_BREAK']],
    ['BREAK', 'start', null, []],
    ['BREAK', 'forward', null, []],
    ['BREAK', 'skip', 'BREAK_SKIPPED', ['SPEND_POWERUP', 'CLOSE_BREAK']],
    ['BREAK', 'breaktime', null, []],
    ['BREAK', 'snooze', null, []],
    ['BREAK', 'lunch', null, []],
    ['STOPPED', 'stop', null, []],
    ['STOPPED', 'start', 'RESUMED', []],
    ['STOPPED', 'forward', null, []],
    ['STOPPED', 'skip', null, []],
    ['STOPPED', 'breaktime', null, []],
    ['STOPPED', 'snooze', null, []],
    ['STOPPED', 'lunch', null, []],
    ['LUNCH', 'stop', null, []],
    ['LUNCH', 'start', 'LUNCH_ENDED', []],
    ['LUNCH', 'forward', null, []],
    ['LUNCH', 'skip', null, []],
    ['LUNCH', 'breaktime', null, []],
    ['LUNCH', 'snooze', null, []],
    ['LUNCH', 'lunch', null, []],
  ])('%s + %s from a window → %s', (status, action, transition, effects) => {
    const step = act(action, at(status), 'WINDOW', RULES);
    if (transition === null) expect(step).toBeNull();
    else expect({ ...step, effects: [...step!.effects].sort() }).toMatchObject({ transition: { type: transition }, effects: [...effects].sort() });
  });

  test('only the workday schedule can stop lunch, and it never cuts lunch short by starting it', () => {
    expect(act('stop', at('LUNCH'), 'SCHEDULE', RULES)).toMatchObject({ core: { status: 'STOPPED' }, effects: expect.arrayContaining(['CLOSE_BREAK']) });
    expect(act('start', at('LUNCH'), 'SCHEDULE', RULES)).toBeNull();
  });

  test('a snooze or skip needs a power-up, and lunch needs the day\'s lunch', () => {
    const spent = { ...RULES, powerupsLeft: 0, lunchesLeft: 0 };
    expect(act('snooze', at('RUNNING'), 'WINDOW', spent)).toBeNull();
    expect(act('skip', at('BREAK'), 'WINDOW', spent)).toBeNull();
    expect(act('skip', at('OVERDUE'), 'WINDOW', spent)).toBeNull();
    expect(act('lunch', at('RUNNING'), 'WINDOW', spent)).toBeNull();
  });
});

describe('what each step leaves behind', () => {
  test('the countdown runs out into overdue, which counts up from zero', () => {
    expect(tick(at('RUNNING', 1000), RULES)).toMatchObject({ core: at('OVERDUE', 0), transition: { type: 'OVERDUE_STARTED', cause: 'COUNTDOWN_ENDED' }, effects: ['OPEN_OVERDUE'] });
    expect(tick(at('OVERDUE', 0, 4000), RULES).core).toEqual(at('OVERDUE', 0, 5000));
    expect(tick(at('STOPPED'), RULES).core).toEqual(at('STOPPED'));
  });

  test('a break that ends, is skipped or is stopped from starts the next block on the saved settings; lunch ending keeps the current ones', () => {
    expect(tick(at('BREAK', 1000), RULES).core).toEqual(at('RUNNING', RULES.nextWorkMs));
    expect(act('skip', at('OVERDUE'), 'WINDOW', RULES)!.core).toEqual(at('RUNNING', RULES.nextWorkMs));
    expect(act('stop', at('BREAK'), 'WINDOW', RULES)!.core).toEqual(at('STOPPED', RULES.nextWorkMs));
    expect(tick(at('LUNCH', 1000), RULES).core).toEqual(at('RUNNING', RULES.workMs));
    expect(act('start', at('LUNCH'), 'WINDOW', RULES)!.core).toEqual(at('RUNNING', RULES.workMs));
  });

  test('a stop from work keeps the countdown where it was, and resuming picks it up', () => {
    expect(act('stop', at('RUNNING', 7000), 'TRAY', RULES)!.core).toEqual(at('STOPPED', 7000));
    expect(act('start', at('STOPPED', 7000), 'TRAY', RULES)!.core).toEqual(at('RUNNING', 7000));
  });

  test('the log hears how much was left, taken or spent', () => {
    expect(act('snooze', at('RUNNING', 7000), 'WINDOW', RULES)).toMatchObject({ core: at('RUNNING', 12000), transition: { snoozeMs: 5000, countdownMs: 7000, powerupsLeft: 2 } });
    expect(act('skip', at('BREAK', 1000), 'WINDOW', RULES)!.transition).toMatchObject({ from: 'BREAK', breakElapsedMs: 2000, overdueMs: 0, powerupsLeft: 2 });
    expect(act('skip', at('OVERDUE', 0, 9000), 'WINDOW', RULES)!.transition).toMatchObject({ from: 'OVERDUE', breakElapsedMs: 0, overdueMs: 9000 });
    expect(act('breaktime', at('OVERDUE', 0, 9000), 'WINDOW', RULES)).toMatchObject({ core: at('BREAK', RULES.breakMs), transition: { overdueMs: 9000 } });
    expect(act('lunch', at('OVERDUE', 0, 9000), 'WINDOW', RULES)).toMatchObject({ core: at('LUNCH', RULES.lunchMs), transition: { from: 'OVERDUE', lunchMs: RULES.lunchMs } });
    expect(act('start', at('LUNCH', 4000), 'WINDOW', RULES)!.transition).toMatchObject({ cause: 'ENDED_EARLY', lunchLeftMs: 4000 });
  });

  test('the warning fires on the tick that reaches the threshold, and only then', () => {
    expect(tick(at('RUNNING', 3000), RULES).effects).toEqual(['WARNING']);
    expect(tick(at('RUNNING', 2000), RULES).effects).toEqual([]);
    expect(tick(at('RUNNING', 4000), RULES).effects).toEqual([]);
  });
});

describe('what the windows are told', () => {
  test.each<[TimerStatus, number, number, AvailableActions[]]>([
    ['RUNNING', 1, 1, ['stop', 'forward', 'snooze', 'lunch']],
    ['RUNNING', 0, 0, ['stop', 'forward']],
    ['OVERDUE', 1, 1, ['breaktime', 'lunch', 'skip', 'stop']],
    ['OVERDUE', 0, 0, ['breaktime', 'stop']],
    ['BREAK', 1, 0, ['skip', 'stop']],
    ['BREAK', 0, 0, ['stop']],
    ['STOPPED', 1, 1, ['start']],
    ['LUNCH', 1, 1, ['start']],
  ])('%s with %i power-ups and %i lunch offers %j', (status, powerupsLeft, lunchesLeft, expected) => {
    expect(availableActions(status, { ...RULES, powerupsLeft, lunchesLeft })).toEqual(expected);
  });

  test('the warning shows from the threshold down to zero, only while running, and not with the warning off', () => {
    expect(isInWarning(at('RUNNING', 2001), 2000)).toBe(false);
    expect(isInWarning(at('RUNNING', 2000), 2000)).toBe(true);
    expect(isInWarning(at('RUNNING', 1), 2000)).toBe(true);
    expect(isInWarning(at('OVERDUE', 0), 2000)).toBe(false);
    expect(isInWarning(at('STOPPED', 1000), 2000)).toBe(false);
    expect(isInWarning(at('RUNNING', 1000), 0)).toBe(false);
  });
});
