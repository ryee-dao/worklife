export const EVENTS = {
  TIMER: {
    RUNNING: "timer_running",
    STOPPED: "timer_stopped",
    ON_LUNCH: "timer_on_lunch",
    START_BREAK: "timer_start_break",
    ON_BREAK: "timer_on_break",
    START_OVERDUE: "timer_start_overdue",
    ON_OVERDUE: "timer_on_overdue",
    STOP_BREAK: "timer_stop_break",
    WARNING: "timer_warning",
    TRANSITION: "timer_transition",
  },
  IPC_CHANNELS: {
    TIMER_UPDATE: "timer:update",
    TIMER_STOP: "timer:stop",
    TIMER_BEGIN: "timer:begin",
    TIMER_STARTBREAK: "timer:start_break",
    TIMER_SKIPBREAK: "timer:skip_break",
    TIMER_FORWARD: "timer:forward",
    TIMER_SNOOZE: "timer:snooze",
    TIMER_LUNCH: "timer:lunch",
    TIMER_WARNING: 'timer:warning',
    TIMER_GETSTATE: "timer:get_state",
    STATS_TODAY: "stats:today",
    STATS_GET_DAYS: "stats:get_days",
    STATS_SHOW_DAY: "stats:show_day",
    STATS_TAKE_UNSEEN_SUMMARY: "stats:take_unseen_summary",
    DEV_APPLY_WORKDAY: "dev:apply_workday",
    CONFIGS: {
      SAVE: {
        TIMER: "configs:save:timer",
        DIFFICULTY: "configs:save:difficulty",
        OVERDUE: "configs:save:overdue",
        WORKDAY: "configs:save:workday",
      },
      LOAD: {
        TIMER: "configs:load:timer",
        DIFFICULTY: "configs:load:difficulty",
        OVERDUE: "configs:load:overdue",
        WORKDAY: "configs:load:workday",
      },
    },
  },
} as const;

export const DEFAULTS = {
  DEFAULT_TIMER_DURATION_MS: 45 * 60 * 1000, // 45 minutes
  DEFAULT_BREAK_DURATION_MS: 30 * 1000, // 30 seconds, the starting value for the custom difficulty
  DEFAULT_WARNING_THRESHOLD_MS: 2 * 60 * 1000, // 2 minutes
  DEFAULT_ALLOTTED_POWERUPS: 3, // The starting value for the custom difficulty
  DEFAULT_SNOOZE_DURATION_MS: 5 * 60 * 1000, // 5 minutes, the starting value for the custom difficulty
  DEFAULT_LUNCH_DURATION_MS: 45 * 60 * 1000, // 45 minutes, the starting value for the custom difficulty
  DEFAULT_LEVEL_THRESHOLD_MS: 3 * 60 * 1000,
} as const;

export const FILENAMES = {
  TIMER: { CONFIGS: "timerConfigs.json", STATE: "timerState.json" },
  LIMIT: { STATE: "limitState.json" },
  DIFFICULTY: { CONFIGS: "difficultyConfigs.json" },
  WORKDAY: { CONFIGS: "workdayConfigs.json", STATE: "workdayState.json" },
  OVERDUE: { CONFIGS: "overdueConfigs.json" },
  STATS: { EVENTS: "events.jsonl", STATE: "statsState.json" },
} as const;

// Break and snooze lengths are a share of the timer, so they scale with longer work sessions.
// Power-ups are one daily pool, spent on either a snooze or a break skip
export const DIFFICULTY_PRESETS = {
  EASY: { breakRatio: 0.02, snoozeRatio: 0.20, allottedPowerups: 5, lunchDurationMs: 60 * 60 * 1000 },
  NORMAL: { breakRatio: 0.05, snoozeRatio: 0.15, allottedPowerups: 3, lunchDurationMs: 45 * 60 * 1000 },
  HARD: { breakRatio: 0.10, snoozeRatio: 0.10, allottedPowerups: 1, lunchDurationMs: 30 * 60 * 1000 },
} as const;

export const LUNCHES_PER_DAY = 1;

// Each unbroken share of the workday climbs one checkpoint, so a 9 to 5 day climbs every 2 hours
export const CHECKPOINTS = {
  NAMES: ["Dim", "Glimmer", "Glow", "Shine", "Radiant"],
  DECAY_RATIO: 1 / 32,                 // Of the workday: staying stopped this long loses another checkpoint (15 min on 9 to 5)
  LATE_START_GRACE_MS: 30 * 60 * 1000, // Starting this late still counts as on time
  RESTART_GRACE_MS: 5 * 60 * 1000,     // Closed this long is a restart, not a stop
} as const;

export const CONSTRAINTS = {
  OVERDUE: { MAXIMUM_WINDOW_LEVEL: 5, MAXIMUM_WINDOW_RATIO: .9 },
}