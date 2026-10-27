import { TimerState } from "../../../../main/timer/timerState";
import TimerTimeDisplay from "./TimerTimeDisplay";
import TimerButtons from "./TimerButtons";
import TimerSkipbox from "./TimerSkipbox";
import { DayScore } from "../../../../main/stats/cleanDays";

interface TimerProps {
  timerState?: TimerState;
  todayScore: DayScore | null;
}

export default function Timer({ timerState, todayScore }: TimerProps) {
  return (
    <>
      {timerState && (
        <div data-testid="timer-container" className="flex flex-col grow relative">
          <TimerTimeDisplay timerState={timerState} todayScore={todayScore} />
          <TimerButtons timerState={timerState}/>
          <TimerSkipbox timerState={timerState} />
        </div>
      )}
    </>
  );
}
