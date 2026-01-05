interface SlashedIconProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  className?: string;
}

export default function SlashedIcon({
  icon: Icon,
  className,
}: SlashedIconProps) {
  return (
    <div className="relative h-full aspect-square w-auto flex justify-center items-center">
      <Icon className={className} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3/4 h-2 bg-current rotate-135" />
      </div>
    </div>
  );
}
