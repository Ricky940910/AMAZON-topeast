export function numberInputValue(value: number | null | undefined): number | "" {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "";
  return value;
}
