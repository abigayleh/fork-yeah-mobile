export type UnitType = 'volume' | 'weight' | 'count';
export type UnitSystem = 'us' | 'metric';

const VOLUME_TO_ML: Record<string, number> = {
  teaspoons: 4.92892,
  tablespoons: 14.7868,
  cups: 236.588,
  ml: 1,
  liters: 1000,
};

const WEIGHT_TO_GRAMS: Record<string, number> = {
  grams: 1,
  oz: 28.3495,
  lbs: 453.592,
};

const ROUNDING_STEP: Record<string, number> = {
  teaspoons: 0.25,
  tablespoons: 0.25,
  cups: 0.25,
  liters: 0.1,
  ml: 1,
  grams: 1,
  oz: 0.1,
  lbs: 0.01,
};

const US_UNITS = new Set(['teaspoons', 'tablespoons', 'cups', 'oz', 'lbs']);
const METRIC_UNITS = new Set(['ml', 'liters', 'grams']);

// Grams-per-ml, matched against ingredient name keywords. Covers common baking/cooking
// ingredients only — anything unrecognized simply has no cross-type (volume<->weight) option.
const DENSITY_TABLE: Array<{ keywords: string[]; gramsPerMl: number }> = [
  { keywords: ['flour'], gramsPerMl: 0.53 },
  { keywords: ['sugar'], gramsPerMl: 0.85 },
  { keywords: ['butter'], gramsPerMl: 0.96 },
  { keywords: ['milk'], gramsPerMl: 1.03 },
  { keywords: ['water'], gramsPerMl: 1 },
  { keywords: ['oil'], gramsPerMl: 0.92 },
  { keywords: ['honey'], gramsPerMl: 1.42 },
  { keywords: ['rice'], gramsPerMl: 0.85 },
  { keywords: ['oats'], gramsPerMl: 0.41 },
  { keywords: ['salt'], gramsPerMl: 1.2 },
];

function normalizeUnit(unit: string): string {
  return (unit || '').toLowerCase().trim();
}

export function getUnitType(unit: string): UnitType {
  const normalized = normalizeUnit(unit);
  if (normalized in VOLUME_TO_ML) return 'volume';
  if (normalized in WEIGHT_TO_GRAMS) return 'weight';
  return 'count';
}

export function findDensity(ingredientName: string): number | null {
  const normalized = (ingredientName || '').toLowerCase();
  const match = DENSITY_TABLE.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword)));
  return match ? match.gramsPerMl : null;
}

function roundForUnit(value: number, unit: string): number {
  const step = ROUNDING_STEP[normalizeUnit(unit)] || 0.01;
  return Math.round(value / step) * step;
}

// Converts to a specific target unit, chosen by the user (per-ingredient modal).
// Same-type conversions are always exact; cross-type ones require a known density.
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientName: string
): number | null {
  const fromType = getUnitType(fromUnit);
  const toType = getUnitType(toUnit);
  if (fromType === 'count' || toType === 'count') return null;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (fromType === toType) {
    const table = fromType === 'volume' ? VOLUME_TO_ML : WEIGHT_TO_GRAMS;
    const base = quantity * table[from];
    return roundForUnit(base / table[to], toUnit);
  }

  const density = findDensity(ingredientName);
  if (density === null) return null;

  if (fromType === 'volume' && toType === 'weight') {
    const grams = quantity * VOLUME_TO_ML[from] * density;
    return roundForUnit(grams / WEIGHT_TO_GRAMS[to], toUnit);
  }

  const ml = (quantity * WEIGHT_TO_GRAMS[from]) / density;
  return roundForUnit(ml / VOLUME_TO_ML[to], toUnit);
}

// All valid target units for one ingredient's tap-to-convert modal: same-type units
// are always offered; cross-type (volume<->weight) units only appear when a density match exists.
export function getAvailableTargetUnits(unit: string, ingredientName: string): string[] {
  const type = getUnitType(unit);
  if (type === 'count') return [];

  const normalized = normalizeUnit(unit);
  const sameType = Object.keys(type === 'volume' ? VOLUME_TO_ML : WEIGHT_TO_GRAMS).filter(
    (candidate) => candidate !== normalized
  );

  const crossType =
    findDensity(ingredientName) !== null
      ? Object.keys(type === 'volume' ? WEIGHT_TO_GRAMS : VOLUME_TO_ML)
      : [];

  return [...sameType, ...crossType];
}

export function isCrossTypeConversion(fromUnit: string, toUnit: string): boolean {
  return getUnitType(fromUnit) !== getUnitType(toUnit);
}

function pickBestVolumeUnit(ml: number, system: UnitSystem): string {
  if (system === 'metric') return ml >= 1000 ? 'liters' : 'ml';

  const teaspoons = ml / VOLUME_TO_ML.teaspoons;
  if (teaspoons < 3) return 'teaspoons';
  const tablespoons = ml / VOLUME_TO_ML.tablespoons;
  if (tablespoons < 4) return 'tablespoons';
  return 'cups';
}

function pickBestWeightUnit(grams: number, system: UnitSystem): string {
  if (system === 'metric') return 'grams';
  const oz = grams / WEIGHT_TO_GRAMS.oz;
  return oz < 16 ? 'oz' : 'lbs';
}

// Bulk/global conversion: always same-type (exact), auto-picks the most readable unit
// for the resulting magnitude (e.g. small ml amounts stay ml, large ones become liters).
export function convertToSystem(
  quantity: number,
  fromUnit: string,
  targetSystem: UnitSystem
): { quantity: number; unit: string } | null {
  const type = getUnitType(fromUnit);
  if (type === 'count') return null;

  const from = normalizeUnit(fromUnit);

  if (type === 'volume') {
    const ml = quantity * VOLUME_TO_ML[from];
    const targetUnit = pickBestVolumeUnit(ml, targetSystem);
    return { quantity: roundForUnit(ml / VOLUME_TO_ML[targetUnit], targetUnit), unit: targetUnit };
  }

  const grams = quantity * WEIGHT_TO_GRAMS[from];
  const targetUnit = pickBestWeightUnit(grams, targetSystem);
  return { quantity: roundForUnit(grams / WEIGHT_TO_GRAMS[targetUnit], targetUnit), unit: targetUnit };
}

// Which system a button offering the *other* system should show, based on what's
// currently in the ingredient list. Returns null when there's nothing convertible at all.
export function detectDominantSystem(units: string[]): UnitSystem | null {
  const normalized = units.map(normalizeUnit);
  if (normalized.some((unit) => US_UNITS.has(unit))) return 'us';
  if (normalized.some((unit) => METRIC_UNITS.has(unit))) return 'metric';
  return null;
}
