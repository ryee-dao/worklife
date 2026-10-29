import { ReactNode } from "react";

interface CircularButtonProps {
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  title?: string; // Shown on hover and read by screen readers, since the buttons are icons only
  children: ReactNode;
  className?: string; // size, colors — the stuff that varies
}

export default function CircularButton({ onClick, disabled = false, testId, title, children, className = "" }: CircularButtonProps) {
  return (
    <button
      data-testid={testId}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={
        `relative aspect-square rounded-full flex items-center justify-center
        transition-all duration-250 ease-out border shadow-md lg:shadow-2xl
        ${disabled ? 
          "cursor-not-allowed opacity-60" : 
          "cursor-pointer hover:-translate-y-0.5 lg:hover:-translate-y-1.5 hover:shadow-xl hover:border-transparent"
        }
        ${className}`
      }
    >
      {children}
    </button>
  );
}