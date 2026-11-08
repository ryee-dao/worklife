import { InputHTMLAttributes } from "react";

export interface Range {
  min: number;
  max: number;
  step?: 1; // Whole numbers only
}

export const inRange = (value: number, { min, max, step }: Range) => value >= min && value <= max && (!step || Number.isInteger(value));

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number; // NaN while the field is empty, which no range check accepts, so Save waits
  onValueChange: (value: number) => void;
}

export default function NumberInput({ value, onValueChange, ...props }: NumberInputProps) {
  return (
    <input
      className="w-16 text-center border rounded"
      type="number"
      value={Number.isNaN(value) ? "" : value}
      onChange={(e) => onValueChange(e.target.valueAsNumber)}
      {...props}
    />
  );
}
