export const EVENTS = {
  TIMER: {
    RUNNING: "timer_running",
    PAUSED: "timer_paused",
    START_BREAK: "timer_start_break",
    ON_BREAK: "timer_on_break",
    START_OVERDUE: "timer_start_overdue",
    ON_OVERDUE: "timer_on_overdue",
    STOP_BREAK: "timer_stop_break",
    WARNING: "timer_warning",
  },
  IPC_CHANNELS: {
    TIMER_UPDATE: "timer:update",
    TIMER_PAUSE: "timer:pause",
    TIMER_BEGIN: "timer:begin",
    TIMER_STARTBREAK: "timer:start_break",
    TIMER_SKIPBREAK: "timer:skip_break",
    TIMER_SKIPTIMER: "timer:skip_timer",
    CONFIG: {
      SAVE: {
        TIMER: "config:save:timer",
        LIMIT: "config:save:limit",
      },
      LOAD: {
        TIMER: "config:load:timer",
        LIMIT: "config:load:limit",
      },
    },
  },
} as const;

export const DEFAULTS = {
  DEFAULT_TIMER_DURATION_MS: 45 * 60 * 1000, // 45 minutes
  DEFAULT_BREAK_DURATION_MS: 30 * 1000, // 30 seconds
  DEFAULT_WARNING_THRESHOLD_MS: 2 * 60 * 1000, // 2 minutes
  DEFAULT_ALLOTTED_BREAKS: 3,
  DEFAULT_LEVEL_THRESHOLD_MS: 3 * 60 * 1000,
} as const;

export const FILENAMES = {
  TIMER: { SETTINGS: "timerSettings.json", STATE: "timerState.json" },
  LIMIT: { SETTINGS: "limitSettings.json", STATE: "limitState.json" },
  OVERDUE: { CONFIGS: "overdueConfigs.json" },
} as const;

export const CONSTRAINTS = {
  OVERDUE: { MAXIMUM_WINDOW_LEVEL: 5, MAXIMUM_WINDOW_RATIO: .9 },
}