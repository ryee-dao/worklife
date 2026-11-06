import { MouseEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { TimerState } from "@main/timer/timerState";
import { OverdueLevelObject } from "@main/overdue/overdueGeometry";
import BreakWindowFrame from "@renderer/common/components/BreakWindowFrame";
import { CARD_MARGIN_PX, demoOverdueLevels, placeCard, startDemo, tickDemo, TOUR_BEATS } from "./tour";
import { useElementRect } from "./useElementRect";

interface TourProps {
  timerState: TimerState;
  onDone: () => void;
}

const PULSE_GAP_PX = 6;
const CARD_GAP_PX = 8;
const CARD_BAND_PX = 140; // Room kept for the card until it's measured

// The first-run tour: a card and a spotlight over the real tabs, and the break window drawn inside the dashboard for
// the beats that need it. Everything behind the overlay is blocked, so the only live control is the one each beat names
export default function Tour({ timerState, onDone }: TourProps) {
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState<TimerState>();
  const [levels, setLevels] = useState<OverdueLevelObject[]>([]);
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const beat = TOUR_BEATS[step];
  const isLast = step === TOUR_BEATS.length - 1;
  const target = useElementRect(beat.target, root);
  const pulse = useElementRect(beat.advanceOn, root);
  const card = useElementRect("tour-card", root);

  useEffect(() => {
    window.electronAPI.loadOverdueConfigs().then((configs) => setLevels(demoOverdueLevels(configs)));
  }, []);

  useEffect(() => {
    const measure = () => {
      if (root.current) setScreen({ width: root.current.clientWidth, height: root.current.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Only when the beat changes: navigate itself changes on every route change, and that must not pull the user back
  useEffect(() => {
    navigate(beat.route);
  }, [beat.route]);

  // The demo window runs on its own clock while its beat is showing
  useEffect(() => {
    if (!beat.demo) {
      setDemo(undefined);
      return;
    }
    setDemo(startDemo(timerState, beat.demo));
    const interval = setInterval(() => setDemo((state) => state && tickDemo(state)), 1000);
    return () => clearInterval(interval);
    // Only the beat is a dependency: the demo starts from the state as the beat opens, and isn't restarted by every tick after
  }, [beat.demo]);

  const advance = () => {
    if (isLast) {
      window.electronAPI.markTourSeen();
      onDone();
    } else {
      setStep(step + 1);
    }
  };

  // The demo window's buttons are the real ones, so their clicks are stopped here before they reach the app.
  // Only the button the beat names does anything, and what it does is move the tour on
  const onDemoClick = (event: MouseEvent) => {
    event.stopPropagation();
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-testid]");
    if (button && button.dataset.testid === beat.advanceOn) advance();
  };

  const cardHeight = card?.height ?? CARD_BAND_PX;
  const cardPlacement = placeCard(target, screen.height, cardHeight);
  // The demo window gets the whole band above the card, so the card never covers its countdown
  const demoScreen = { width: screen.width, height: Math.max(0, screen.height - CARD_MARGIN_PX - cardHeight - CARD_GAP_PX) };

  return (
    <div ref={root} data-testid="tour" className="fixed inset-0 z-50 select-none">
      {beat.demo && <div className="absolute inset-0 bg-slate-900/60" />}
      {beat.target && (
        <div
          data-testid="tour-spotlight"
          className={`absolute ring-4 ring-amber-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.58)] transition-all duration-300 pointer-events-none ${target ? "" : "hidden"}`}
          style={target ? { left: target.left, top: target.top, width: target.width, height: target.height, borderRadius: target.radius } : undefined}
        />
      )}

      {demo && levels.length > 0 && (
        <div className="absolute inset-x-0 top-0 z-10" style={{ height: demoScreen.height }} onClickCapture={onDemoClick}>
          <BreakWindowFrame timerState={demo} screen={demoScreen} levels={levels} />
        </div>
      )}

      {pulse && (
        <span
          data-testid="tour-pulse"
          className="absolute z-20 rounded-full border-[3px] border-amber-400 animate-tour-pulse pointer-events-none"
          style={{ left: pulse.left - PULSE_GAP_PX, top: pulse.top - PULSE_GAP_PX, width: pulse.width + 2 * PULSE_GAP_PX, height: pulse.height + 2 * PULSE_GAP_PX }}
        />
      )}

      <div
        data-testid="tour-card"
        className={`absolute left-1/2 -translate-x-1/2 z-30 w-[min(30rem,100%_-_2rem)] rounded-2xl bg-white p-4 sm:p-5 shadow-2xl flex flex-col gap-1.5
          ${cardPlacement === "top" ? "top-4" : "bottom-4"}`}
      >
        <h2 className="text-lg font-bold text-slate-900">{beat.title}</h2>
        <p className="text-sm text-slate-700 leading-snug">{beat.body}</p>
        <div className="flex items-center justify-between pt-1.5 min-h-9">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${TOUR_BEATS.length}`}>
            {TOUR_BEATS.map((_, index) => (
              <i key={index} className={`size-1.5 rounded-full ${index === step ? "bg-slate-900" : "bg-slate-300"}`} />
            ))}
          </div>
          {beat.action && (
            <button
              data-testid="tour-next"
              onClick={advance}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-700"
            >
              {beat.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
