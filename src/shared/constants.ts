export const EVENTS = {
  TIMER: {
    BEGIN: "timer_begin",
    RUNNING: "timer_running",
    PAUSED: "timer_paused",
    START_BREAK: "timer_start_break",
    ON_BREAK: "timer_on_break",
  },
  IPC_CHANNELS: {
    TIMER_UPDATE: "timer:update",
    TIMER_PAUSE: "timer:pause",
    TIMER_BEGIN: "timer:begin"
  },
} as const;
