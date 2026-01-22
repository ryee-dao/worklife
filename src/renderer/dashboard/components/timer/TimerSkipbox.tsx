import { PlayIcon, PauseIcon, ForwardIcon } from "@heroicons/react/24/outline";
import TimerSkipboxSkipIcon from "./TimerSkipboxSkipIcon";
import TimerSkipboxSkipCount from "./TimerSkipboxSkipCount";
import { TimerState } from "../../../../main/timerState";
import SlashedIcon from "../../../common/components/SlashedIcon";


interface TimerSkipboxProps {
  timerState: TimerState
}

export default function TimerSkipbox({ timerState }: TimerSkipboxProps) {
  const { remainingSkips, allotedBreaks } = timerState;
  const usedSkips = allotedBreaks - remainingSkips;
  const showSkipIcons = allotedBreaks <= 5 && allotedBreaks !== 0;

  return (
    <div className="
      absolute top-0 left-1/2 -translate-x-1/2 border-b-4 border-x-4 border-slate-600 justify-center hidden h-5 w-30 xsm:flex xsm:h-10 xsm:w-40 sm:h-12 sm:w-50 md:h-14 md:w-60 lg:w-80
    ">
      <div className="grow flex p-0.5 gap-0.5 md:gap-2 justify-center">
        {
          showSkipIcons
            ? <>
              {
                [...Array(remainingSkips)].map((_, key) =>
                  <TimerSkipboxSkipIcon key={key} slashed={false} />
                )
              }
              {
                [...Array(usedSkips)].map((_, key) =>
                  <TimerSkipboxSkipIcon key={key} slashed={true} />
                )
              }
            </>
            : <div className="grow flex justify-center items-center gap-2 lg:gap-4">
              <TimerSkipboxSkipIcon slashed={false} />
              <span className="font-semibold text-lg sm:text-xl lg:text-3xl">x {remainingSkips}</span>
              {allotedBreaks !== 0 && <>
                <TimerSkipboxSkipIcon slashed={true} />
                <span className="font-semibold text-lg sm:text-xl lg:text-3xl">x {usedSkips}</span>
              </>}
            </div>
        }
      </div>
    </div>
  )
}
