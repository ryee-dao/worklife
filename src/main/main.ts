import { app, BrowserWindow } from 'electron';
import path from 'path';
import { getHostsFileContent, setHostsFileContent } from './hostsFile';
import { initTimer, timerEmitter } from "./timerState";
import { EVENTS } from '../shared/constants';


function initApp() {
  initTimer()
  createWindow();
}


function createWindow() {
  // const win = new BrowserWindow({
  //   width: 800,
  //   height: 600,
  // });
  const win = new BrowserWindow();
  // win.setKiosk(true);
  timerEmitter.on(EVENTS.TIMER.START_BREAK, () => {
    console.log('break started')
  })

  // In dev: load from Vite server (http://localhost:5173)
  // In prod: load from built files
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  // setHostsFileContent();
}

app.whenReady().then(initApp);