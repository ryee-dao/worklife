// A bigger, brighter glow for each checkpoint, and an unlit dot at Dim
const orbSizesPx = [10, 14, 22, 30, 38];

export default function CheckpointOrb({ level }: { level: number }) {
  const sizePx = orbSizesPx[level];
  return (
    <div className={`size-14 shrink-0 rounded-2xl grid place-items-center ${level ? "bg-amber-50" : "bg-slate-100"}`}>
      <span
        className="rounded-full"
        style={{
          width: sizePx,
          height: sizePx,
          background: level ? "radial-gradient(circle, #fffbea 0%, #fcd34d 45%, #f59e0b 100%)" : "#cbd5e1",
          boxShadow: level ? `0 0 ${level * 6}px ${level * 2}px rgba(251, 191, 36, ${0.2 * level})` : "none",
        }}
      />
    </div>
  );
}
