export const CARD_MARGIN_PX = 16;

// The card sits at the bottom, unless the spotlight reaches into that band and the top band is clear
export const placeCard = (target: { top: number; height: number } | null, screenHeight: number, cardHeight: number): "top" | "bottom" => {
  if (!target) return "bottom";
  const bottomBandTop = screenHeight - CARD_MARGIN_PX - cardHeight;
  const topBandBottom = CARD_MARGIN_PX + cardHeight;
  const touchesBottom = target.top + target.height > bottomBandTop;
  const touchesTop = target.top < topBandBottom;
  return touchesBottom && !touchesTop ? "top" : "bottom";
};
