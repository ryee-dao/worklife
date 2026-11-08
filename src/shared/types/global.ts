declare global {
  var __test_fastForwardTimerOneSecond: (() => void) | undefined;
  var __test_getTrayMenu: (() => Electron.Menu | null) | undefined;
  var __test_checkWorkday: ((nowMs: number) => void) | undefined;
}

export { };