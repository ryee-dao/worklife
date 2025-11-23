import { app } from 'electron';
import path from "path";
import fs from "fs";
import { EventEmitter } from 'events';
import { EVENTS } from '../shared/constants';

type TimerStatus = "RUNNING" | "PAUSED" | "BREAK";
interface TimerState {
    timeTilBreakMs: number,
    breakTimeRemainingMs: number,
    status: TimerStatus,
}

interface TimerStateData {
    filePath: string,
    fileContent: TimerState
}

const checkIntervalMs = 5 * 1000; // 5 seconds
const timerStateFileName = 'timerState.json';
let timerState: TimerState;
let startTimer: NodeJS.Timeout;
const newTimerData: TimerState = {
    timeTilBreakMs: .5 * 60 * 1000, // 30 minutes
    breakTimeRemainingMs: 0,
    status: "RUNNING"
}
const breakTimeMs = 15 * 1000;
const thresholdTimeMs = 30 * 1000 // Fallback delay time in case timeTilBreakMs is 0 immediately on startup
export const timerEmitter = new EventEmitter();


export const initTimer = () => {
    loadTimerStateFromFile();
    // Fallback time delay if break time is starting immediately on startup
    if (timerState.timeTilBreakMs <= 0) {
        timerState.timeTilBreakMs = thresholdTimeMs;
        timerState.breakTimeRemainingMs = 0;
        timerState.status = "RUNNING";
    }
    timerEmitter.emit(EVENTS.TIMER.BEGIN);
    startTimer = setInterval(checkTimer, checkIntervalMs);
}

const checkTimer = () => {
    switch (timerState.status) {
        case "RUNNING": {
            timerState.timeTilBreakMs -= checkIntervalMs;
            if (timerState.timeTilBreakMs > 0) {
                timerEmitter.emit(EVENTS.TIMER.RUNNING);
            } else {
                timerState.status = "BREAK";
                timerState.breakTimeRemainingMs = breakTimeMs;
                timerEmitter.emit(EVENTS.TIMER.START_BREAK);
            }
            break;
        }
        case "BREAK": {
            timerState.breakTimeRemainingMs -= checkIntervalMs;
            if (timerState.breakTimeRemainingMs > 0) {
                timerEmitter.emit(EVENTS.TIMER.ON_BREAK);
            } else {
                timerState.status = "RUNNING";
                timerState.timeTilBreakMs = newTimerData.timeTilBreakMs;
                timerEmitter.emit(EVENTS.TIMER.RUNNING);
            }
            break;
        }
        case "PAUSED": {
            break;
        }
        default:
            throw new Error(`Unknown status type: ${timerState.status}`);
    }
    // Write new timer state to file
    fs.writeFileSync(path.join(app.getPath('userData'), timerStateFileName), JSON.stringify(timerState));
    console.log(JSON.stringify(timerState));
}


const pauseTimer = () => {
    clearInterval(startTimer);
    timerState.status = "PAUSED";
    // Write new timer state to file
    console.log(JSON.stringify(timerState));
    fs.writeFileSync(path.join(app.getPath('userData'), timerStateFileName), JSON.stringify(timerState));
    timerEmitter.emit(EVENTS.TIMER.PAUSED);
}

const getTimerStateData = (): TimerStateData => {
    const filePath = path.join(app.getPath('userData'), timerStateFileName);
    let fileContent = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : undefined;
    return { filePath, fileContent };
}

const loadTimerStateFromFile = () => {
    let timerData = getTimerStateData();
    // If no timer data is returned, set new state in file
    if (!timerData.fileContent) {
        fs.writeFileSync(path.join(app.getPath('userData'), timerStateFileName), JSON.stringify(newTimerData));
        timerState = newTimerData;
    } else {
        timerState = timerData.fileContent;
    }
}