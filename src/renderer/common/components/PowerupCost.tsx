import { Zap } from "lucide-react";

// Corner badge on buttons that spend a power-up, matching the zap in the power-up bar
export default function PowerupCost() {
  return (
    <span data-testid="powerup-cost" className="absolute -top-[4%] -right-[4%] size-[30%] rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
      <Zap className="size-3/5 text-white fill-white" />
    </span>
  );
}
