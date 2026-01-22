import { TimerState } from "../../../../main/timerState";
import TimerTimeDisplay from "./TimerTimeDisplay";
import TimerButtons from "./TimerButtons";
import TimerSkipbox from "./TimerSkipbox";

interface TimerProps {
  timerState?: TimerState;
}

export default function Timer({ timerState }: TimerProps) {
  return (
    <>
      {timerState && (
        <div className="flex flex-col grow relative">
          <TimerTimeDisplay timerState={timerState} />
          <TimerButtons timerState={timerState}/>
          <TimerSkipbox timerState={timerState} />
        </div>
      )}
    </>
  );
}
