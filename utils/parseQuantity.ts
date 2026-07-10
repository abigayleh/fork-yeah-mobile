const FRACTION_DISPLAY_UNITS = new Set(['cups', 'tablespoons', 'teaspoons']);

const COMMON_FRACTIONS: Array<{ value: number; label: string }> = [
  { value: 1 / 8, label: '1/8' },
  { value: 1 / 4, label: '1/4' },
  { value: 1 / 3, label: '1/3' },
  { value: 3 / 8, label: '3/8' },
  { value: 1 / 2, label: '1/2' },
  { value: 5 / 8, label: '5/8' },
  { value: 2 / 3, label: '2/3' },
  { value: 3 / 4, label: '3/4' },
  { value: 7 / 8, label: '7/8' },
];

// Displays volume quantities the way people read recipes ("1/4 cup", "1 1/2 cups")
// instead of raw decimals. Only applies to cups/tablespoons/teaspoons — grams/ml/oz/lbs
// stay decimal since that's how they're conventionally read.
export function formatQuantityAsFraction(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '0';

  const rounded = Math.round(value * 100) / 100;
  if (!FRACTION_DISPLAY_UNITS.has((unit || '').toLowerCase().trim())) {
    return String(rounded);
  }

  const whole = Math.floor(rounded);
  const fractionalPart = rounded - whole;

  if (fractionalPart < 0.05) return String(whole || 0);
  if (fractionalPart > 0.95) return String(whole + 1);

  const closest = COMMON_FRACTIONS.reduce((best, candidate) =>
    Math.abs(candidate.value - fractionalPart) < Math.abs(best.value - fractionalPart) ? candidate : best
  );

  return whole > 0 ? `${whole} ${closest.label}` : closest.label;
}
