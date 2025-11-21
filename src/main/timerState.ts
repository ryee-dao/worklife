import { app } from 'electron';
import path from "path";
import fs from "fs";

const checkIntervalMs = 5 * 1000; // 5 seconds

const timerStateFileName = 'timerState.json';
let timerState: TimerState;

let startTimer: NodeJS.Timeout;
const stopTimer = () => {
    clearInterval(startTimer)
}

interface TimerStateData {
    filePath: string,
    fileContent: TimerState
}

interface TimerState {
    timeTilBreakMs: number,
    breakReached: boolean,
}

const newTimerData: TimerState = {
    timeTilBreakMs: 60 * 30 * 1000, // 30 minutes
    breakReached: false,
}


export const initTimer = () => {
    loadTimerStateFromFile();
    startTimer = setInterval(startTimerFunction, checkIntervalMs)
}

const startTimerFunction = () => {
    timerState.timeTilBreakMs -= checkIntervalMs
    if (timerState.timeTilBreakMs <= 0) {
        timerState.breakReached = true;
    }
    // Write new timer state to file
    fs.writeFileSync(path.join(app.getPath('userData'), timerStateFileName), JSON.stringify(timerState));
    console.log(JSON.stringify(timerState));
}


const getTimerStateData = (): TimerStateData => {
    const filePath = path.join(app.getPath('userData'), timerStateFileName);
    let fileContent = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : undefined;
    return { filePath, fileContent }
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