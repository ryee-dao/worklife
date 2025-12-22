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
    TIMER_SKIPBREAK: "timer:skip_break"
  },
} as const;
