import { formatQuantityAsFraction } from './parseQuantity';

const UNIT_ALIASES: Record<string, string> = {
  cup: 'cups',
  cups: 'cups',
  tablespoon: 'tablespoons',
  tablespoons: 'tablespoons',
  tbsp: 'tablespoons',
  tbsps: 'tablespoons',
  teaspoon: 'teaspoons',
  teaspoons: 'teaspoons',
  tsp: 'teaspoons',
  tsps: 'teaspoons',
  gram: 'grams',
  grams: 'grams',
  g: 'grams',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  liter: 'liters',
  liters: 'liters',
  l: 'liters',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lbs',
  lbs: 'lbs',
  pound: 'lbs',
  pounds: 'lbs',
  whole: 'whole',
};

export interface ParsedIngredientLine {
  quantity: number;
  measurement: string;
  name: string;
}

export interface IngredientLineError {
  field: 'quantity' | 'name';
  message: string;
}

// Pulls a leading quantity (mixed number, fraction, or decimal) off the start of a
// string. Returns null if the string doesn't start with a recognizable quantity.
function extractLeadingQuantity(text: string): { quantity: number; rest: string } | null {
  const mixedMatch = text.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixedMatch) {
    const [, whole, numerator, denominator, rest] = mixedMatch;
    const den = Number(denominator);
    if (!den) return null;
    return { quantity: Number(whole) + Number(numerator) / den, rest };
  }

  const fractionMatch = text.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const [, numerator, denominator, rest] = fractionMatch;
    const den = Number(denominator);
    if (!den) return null;
    return { quantity: Number(numerator) / den, rest };
  }

  const decimalMatch = text.match(/^(\d*\.?\d+)\s*(.*)$/);
  if (decimalMatch) {
    const [, quantityText, rest] = decimalMatch;
    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity)) return null;
    return { quantity, rest };
  }

  return null;
}

// Parses a single free-text ingredient line (e.g. "1/2 cup flour", "2 eggs") into
// structured data. Only called at save time — never validates while the user is typing.
export function parseIngredientLine(
  rawLine: string
): { data: ParsedIngredientLine } | { error: IngredientLineError } {
  const trimmed = rawLine.trim();

  const extracted = extractLeadingQuantity(trimmed);
  if (!extracted) {
    return { error: { field: 'quantity', message: 'Enter a valid quantity' } };
  }

  const { quantity, rest } = extracted;
  const restTrimmed = rest.trim();
  const firstWordMatch = restTrimmed.match(/^(\S+)\s*(.*)$/);

  let measurement = 'whole';
  let name = restTrimmed;

  if (firstWordMatch) {
    const [, firstWord, remainder] = firstWordMatch;
    const canonicalUnit = UNIT_ALIASES[firstWord.toLowerCase()];
    if (canonicalUnit) {
      measurement = canonicalUnit;
      name = remainder.trim();
    }
  }

  if (!name) {
    return { error: { field: 'name', message: 'Enter an ingredient name' } };
  }

  return { data: { quantity, measurement, name } };
}

// Reverses parseIngredientLine — formats structured ingredient data back into one
// display line for editing (e.g. {quantity: 0.5, measurement: 'cups', name: 'flour'} -> "1/2 cups flour").
export function formatIngredientLine(ingredient: { quantity: number; measurement: string; name: string }): string {
  const quantityText = formatQuantityAsFraction(ingredient.quantity, ingredient.measurement);
  if (ingredient.measurement === 'whole') {
    return `${quantityText} ${ingredient.name}`.trim();
  }
  return `${quantityText} ${ingredient.measurement} ${ingredient.name}`.trim();
}
