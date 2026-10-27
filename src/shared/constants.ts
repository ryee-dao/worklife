export const EVENTS = {
  TIMER: {
    RUNNING: "timer_running",
    STOPPED: "timer_stopped",
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
    TIMER_SKIPTIMER: "timer:skip_timer",
    TIMER_SNOOZE: "timer:snooze",
    TIMER_WARNING: 'timer:warning',
    TIMER_GETSTATE: "timer:get_state",
    STATS_TODAY: "stats:today",
    STATS_GET_DAYS: "stats:get_days",
    STATS_SHOW_DAY: "stats:show_day",
    STATS_TAKE_UNSEEN_SUMMARY: "stats:take_unseen_summary",
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
  DEFAULT_ALLOTTED_BREAKS: 3, // The starting value for the custom difficulty
  DEFAULT_SNOOZE_DURATION_MS: 5 * 60 * 1000, // 5 minutes, the starting value for the custom difficulty
  DEFAULT_ALLOTTED_SNOOZES: 3, // The starting value for the custom difficulty
  DEFAULT_PARTIAL_THRESHOLD: 0.5, // The starting value for the custom difficulty
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
// partialThreshold is the share of the workday you need to be compliant for after a violation to still get a partial clean
export const DIFFICULTY_PRESETS = {
  EASY: { breakRatio: 0.02, allottedBreaks: 5, snoozeRatio: 0.20, allottedSnoozes: 5, partialThreshold: 0.40 },
  NORMAL: { breakRatio: 0.05, allottedBreaks: 3, snoozeRatio: 0.15, allottedSnoozes: 3, partialThreshold: 0.50 },
  HARD: { breakRatio: 0.10, allottedBreaks: 1, snoozeRatio: 0.10, allottedSnoozes: 1, partialThreshold: 0.70 },
} as const;

// Shares instead of fixed times, so the rules work the same for a 15 minute timer as a 45 minute one
export const COMPLIANCE = {
  GRACE_RATIO: 0.10,             // Of the timer: the app can be closed this long (a restart) without a violation
  OVERDUE_ALLOWANCE_RATIO: 0.20, // Of the timer: overdue this long still counts as compliant
  FLOOR_RATIO: 0.25,             // Of the workday: compliant this long with no violations is a partial clean
} as const;

export const CONSTRAINTS = {
  OVERDUE: { MAXIMUM_WINDOW_LEVEL: 5, MAXIMUM_WINDOW_RATIO: .9 },
}