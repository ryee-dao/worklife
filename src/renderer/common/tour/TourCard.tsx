import { TourUpdate } from "@shared/tour/session";

interface TourCardProps {
  tour: TourUpdate;
  className?: string; // Where it sits in its window
}

// The tour's card: the beat, the dots, Skip, and the button that moves on. Drawn over the dashboard, or inside the break window
export default function TourCard({ tour, className = "" }: TourCardProps) {
  const { beat, step, total } = tour;
  const isEnd = step >= total;

  return (
    <div
      data-testid="tour-card"
      className={`absolute left-1/2 -translate-x-1/2 z-30 w-[min(30rem,100%_-_2rem)] rounded-2xl bg-white p-4 sm:p-5 shadow-2xl flex flex-col gap-1.5 pointer-events-auto ${className}`}
    >
      <h2 className="text-lg font-bold text-slate-900">{beat.title}</h2>
      <p className="text-sm text-slate-700 leading-snug">{beat.body}</p>
      <div className="flex items-center gap-4 pt-1.5 min-h-9">
        {!isEnd && (
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
            {Array.from({ length: total }, (_, index) => (
              <i key={index} className={`size-1.5 rounded-full ${index === step ? "bg-slate-900" : "bg-slate-300"}`} />
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-4">
          {beat.link && (
            <a href={beat.link.href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-700 underline hover:text-slate-900">
              {beat.link.label}
            </a>
          )}
          {!isEnd && (
            <button data-testid="tour-skip" onClick={() => window.electronAPI.tourSkip()} className="text-sm text-slate-500 cursor-pointer hover:text-slate-900">
              Skip
            </button>
          )}
          {beat.action && (
            <button
              data-testid="tour-next"
              onClick={() => window.electronAPI.tourNext()}
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
