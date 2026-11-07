import { describe, test, expect } from 'vitest';
import type { TimerState } from '@main/timer/timerState';
import { TOUR } from '@shared/tour/session';
import { createDemoElectronAPI, DEMO_CONFIGS, seedHistory } from './demoElectronAPI';

// A weekday afternoon, so today is a workday in progress
const now = () => new Date(2026, 10, 5, 15, 0).getTime(); // Thu Nov 5 2026, 3 PM local

const latest = (api: ReturnType<typeof createDemoElectronAPI>['api']) => {
  let state: TimerState | undefined;
  api.onTimerUpdate((next) => { state = next; });
  return () => state!;
};

// A page past its tour, with the timer started from the tour's last card
const afterTour = (options: Parameters<typeof createDemoElectronAPI>[0] = { now, autoTick: false }) => {
  const demo = createDemoElectronAPI(options);
  demo.api.tourSkip();
  demo.api.start();
  return demo;
};

describe('demo timer', () => {
  test('runs the same cycle as the app: work, overdue, break, work', () => {
    const { api, fastForward } = afterTour();
    const state = latest(api);
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs });

    fastForward(DEMO_CONFIGS.timer.timerDurationMs / 1000);
    expect(state()).toMatchObject({ status: 'OVERDUE', overdueTimeMs: 0, availableActions: ['breaktime', 'skip', 'lunch', 'stop'] });

    fastForward(3);
    expect(state().overdueTimeMs).toBe(3000);
    api.startBreak();
    expect(state()).toMatchObject({ status: 'BREAK', currentCountdownMs: DEMO_CONFIGS.difficulty.custom.breakDurationMs });

    fastForward(DEMO_CONFIGS.difficulty.custom.breakDurationMs / 1000);
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs });
  });

  test('stop holds the countdown, and start resumes it', () => {
    const { api, fastForward } = afterTour();
    const state = latest(api);
    fastForward(5);
    api.stop();
    fastForward(5);
    expect(state()).toMatchObject({ status: 'STOPPED', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs - 5000, availableActions: ['start'] });
    api.start();
    fastForward(1);
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs - 6000 });
  });

  test('snooze and skip spend the power-ups, and run out', () => {
    const { api } = afterTour();
    const state = latest(api);
    api.snooze();
    expect(state()).toMatchObject({ remainingPowerups: 2, currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs + DEMO_CONFIGS.difficulty.custom.snoozeDurationMs });

    api.forwardToBreak();
    api.skipBreak();
    expect(state()).toMatchObject({ status: 'RUNNING', remainingPowerups: 1 });
    api.snooze();
    expect(state().remainingPowerups).toBe(0);
    api.forwardToBreak();
    expect(state().availableActions).not.toContain('skip');
    api.skipBreak();
    expect(state().status).toBe('OVERDUE');
  });

  test('saved settings only take effect after a break', async () => {
    const { api, fastForward } = afterTour();
    const state = latest(api);
    await api.saveTimerConfigs({ timerDurationMs: 60 * 1000, warningThresholdMs: 10 * 1000 });
    expect(await api.loadTimerConfigs()).toMatchObject({ timerDurationMs: 60 * 1000 });

    api.forwardToBreak();
    api.startBreak();
    fastForward(DEMO_CONFIGS.difficulty.custom.breakDurationMs / 1000);
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: 60 * 1000 });
  });

  test('saved overdue settings apply after a break, and lunch from overdue applies them too', async () => {
    const { api, fastForward, getOverdueLevels } = afterTour();
    const state = latest(api);
    await api.saveOverdueConfigs({ levelThresholdMs: 5000, windowLevelCap: 2, windowRatioCap: 0.5 });
    expect(getOverdueLevels()).toHaveLength(DEMO_CONFIGS.overdue.windowLevelCap);

    api.forwardToBreak();
    api.startLunch();
    expect(state().status).toBe('LUNCH');
    expect(getOverdueLevels()).toHaveLength(2);
    fastForward(DEMO_CONFIGS.difficulty.custom.lunchDurationMs / 1000);
    expect(state().status).toBe('RUNNING');
  });
});

describe('demo tour', () => {
  test('a fresh page opens on the tour, showing its clock, and the start prompt starts the real timer', async () => {
    const { api, fastForward } = createDemoElectronAPI({ now, autoTick: false });
    const state = latest(api);
    expect((await api.getTour())?.beat.title).toBe('The timer.');
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: TOUR.COUNTDOWN_MS });
    fastForward(2);
    expect(state().currentCountdownMs).toBe(TOUR.COUNTDOWN_MS - 2000);

    api.stop(); // Not what the card names, so nothing happens
    expect((await api.getTour())?.beat.title).toBe('The timer.');

    api.tourSkip();
    expect((await api.getTour())?.beat.title).toBe('Press start.');
    expect(state()).toMatchObject({ status: 'STOPPED', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs });
    api.start();
    expect(await api.getTour()).toBeNull();
    expect(state().status).toBe('RUNNING');
  });

  test('the overdue beat opens the window on the tour clock, and the break beat says what a browser cannot do', async () => {
    const { api, fastForward, getOverdueLevels } = createDemoElectronAPI({ now, autoTick: false });
    const state = latest(api);
    api.tourNext();
    api.tourNext();
    expect((await api.getTour())?.beat.title).toBe("Time's up.");
    fastForward(TOUR.RUN_MS / 1000);
    expect(state().status).toBe('OVERDUE');
    expect(getOverdueLevels()[1].levelStartMs).toBe(TOUR.LEVEL_MS);

    api.startBreak();
    const onBreak = await api.getTour();
    expect(state()).toMatchObject({ status: 'BREAK', currentCountdownMs: TOUR.BREAK_MS });
    expect(onBreak?.beat.link?.label).toBe('Download the app');
    fastForward(TOUR.BREAK_MS / 1000);
    expect((await api.getTour())?.beat.title).toBe('Checkpoints.');
  });

  test('a replay holds the timer and times out when nothing is clicked', async () => {
    const { api, fastForward } = afterTour();
    const state = latest(api);
    fastForward(5);
    api.startTour();
    expect(state().currentCountdownMs).toBe(TOUR.COUNTDOWN_MS);
    fastForward(TOUR.IDLE_MS / 1000);
    expect(await api.getTour()).toBeNull();
    expect(state()).toMatchObject({ status: 'RUNNING', currentCountdownMs: DEMO_CONFIGS.timer.timerDurationMs - 5000 });
  });
});

describe('demo stats', () => {
  test('today is scored live, and the past weeks have a mix of results', async () => {
    // A moving clock: a run that started this very instant has no length yet, so it's scored a second later
    const clock = { time: now() };
    const { api, fastForward } = afterTour({ now: () => clock.time, autoTick: false });
    let today: Awaited<ReturnType<typeof api.getDayScores>>[string] | null = null;
    api.onTodayScore((score) => { today = score; });
    clock.time += 1000;
    fastForward(1);
    expect(today).toMatchObject({ localDate: '2026-11-05', inProgress: true, climbing: true });

    const scores = await api.getDayScores();
    const pastLevels = new Set(Object.values(scores).filter((score) => !score.inProgress).map((score) => score.level));
    expect(pastLevels.size).toBeGreaterThan(1);
    expect(Object.keys(scores).some((localDate) => localDate.startsWith('2026-10'))).toBe(true);
  });

  test('history covers every day of the week, since the demo workday is every day', () => {
    const events = seedHistory(now());
    const weekdays = new Set(events.map((event) => new Date(event.at).getDay()));
    expect([...weekdays].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
