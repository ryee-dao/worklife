export const EVENTS = {
  TIMER: {
    BEGIN: "timer_begin",
    RUNNING: "timer_running",
    PAUSED: "timer_paused",
    START_BREAK: "timer_start_break",
    ON_BREAK: "timer_on_break",
    STOP_BREAK: "timer_stop_break",
  },
  IPC_CHANNELS: {
    TIMER_UPDATE: "timer:update",
    TIMER_PAUSE: "timer:pause",
    TIMER_BEGIN: "timer:begin",
    TIMER_SKIPBREAK: "timer:skip_break",
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
  DEFAULT_TIMER_DURATION_MS: 45 * 60 * 1000, // 45 minutes,
  DEFAULT_BREAK_DURATION_MS: 30 * 1000, // 30 seconds
  DEFAULT_ALLOTTED_BREAKS: 3,
} as const;

export const FILENAMES = {
  TIMER: { SETTINGS: "timerSettings.json", STATE: "timerState.json" },
  LIMIT: { SETTINGS: "limitSettings.json", STATE: "limitState.json" },
};
