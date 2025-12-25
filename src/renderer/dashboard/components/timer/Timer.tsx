import { TimerState } from "../../../../main/timerState";
import TimerTimeDisplay from "./TimerTimeDisplay";
import TimerButtons from "./TimerButtons";

interface TimerProps {
  timerState?: TimerState;
}

export default function Timer({ timerState }: TimerProps) {
  return (
    <>
      {timerState && (
        <div className="flex flex-col grow">
          <TimerTimeDisplay timerState={timerState} />
          <TimerButtons timerState={timerState}/>
        </div>
      )}
    </>
  );
}
