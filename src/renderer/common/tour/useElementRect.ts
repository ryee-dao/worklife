import { RefObject, useEffect, useState } from "react";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string; // The element's own corner radius, so a spotlight can follow its shape
}

const isSame = (a: Rect, b: Rect) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.radius === b.radius;

// Where an element sits inside the overlay, kept up to date by polling: the target can appear late (a settings page loading),
// move (a window resize), or grow (the demo window), and none of those are events the overlay gets
export function useElementRect(testId: string | undefined, root: RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!testId) {
      setRect(null);
      return;
    }
    const measure = () => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      const base = root.current?.getBoundingClientRect();
      if (!element || !base) {
        setRect(null);
        return;
      }
      const box = element.getBoundingClientRect();
      const next = { left: box.left - base.left, top: box.top - base.top, width: box.width, height: box.height, radius: getComputedStyle(element).borderRadius };
      setRect((previous) => (previous && isSame(previous, next) ? previous : next));
    };
    measure();
    const interval = setInterval(measure, 100);
    return () => clearInterval(interval);
  }, [testId, root]);

  return rect;
}
