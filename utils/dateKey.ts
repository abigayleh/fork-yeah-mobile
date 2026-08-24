const pad = (n: number): string => String(n).padStart(2, '0');

// Local calendar components, never toISOString(): the planner builds its cells at
// local midnight, which UTC formats as the previous day anywhere east of UTC.
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const startOfDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

// Parses a key back into a local Date, the inverse of toDateKey.
export const fromDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};
