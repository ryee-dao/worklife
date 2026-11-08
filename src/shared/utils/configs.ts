// A saved config is trusted field by field: anything a hand edit broke falls back to its default, so a bad file can't stall the app
export const fromSaved = <T extends object>(defaults: T, saved: Partial<T> | undefined, valid: { [K in keyof T]: (value: unknown) => boolean }): T => {
  const configs = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = saved?.[key];
    if (value !== undefined && valid[key](value)) configs[key] = value as T[typeof key];
  }
  return configs;
};

export const isPositiveMs = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
export const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
export const isBetween = (min: number, max: number) => (value: unknown) => typeof value === "number" && value >= min && value <= max;
