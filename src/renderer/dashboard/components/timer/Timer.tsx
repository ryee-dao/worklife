import { TimerState } from "../../../../main/timer/timerState";
import TimerTimeDisplay from "./TimerTimeDisplay";
import TimerButtons from "./TimerButtons";
import PowerupBar from "./PowerupBar";

interface TimerProps {
  timerState?: TimerState;
}

export default function Timer({ timerState }: TimerProps) {
  return (
    <>
      {timerState && (
        <div data-testid="timer-container" className="flex flex-col grow relative">
          <TimerTimeDisplay timerState={timerState} />
          <TimerButtons timerState={timerState}/>
          <PowerupBar timerState={timerState} />
        </div>
      )}
    </>
  );
}
