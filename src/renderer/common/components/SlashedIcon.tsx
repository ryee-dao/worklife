interface SlashedIconProps {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  slashSize?: number
}

export default function SlashedIcon({
  icon: Icon,
  className,
  slashSize = 2,
}: SlashedIconProps) {
  return (
    <div className="relative h-full aspect-square w-auto flex justify-center items-center">
      <Icon className={className} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-3/4 h-${slashSize} bg-current rotate-135`}
          style={{ height: `${slashSize * 0.25}rem` }}
        >
        </div>
      </div>
    </div>
  );
}
