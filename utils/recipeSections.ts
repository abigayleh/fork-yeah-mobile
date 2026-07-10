import type { CustomRecipeIngredient, IngredientSectionMarker, RecipeStep } from '../types/recipe';

export interface StepSection {
  title: string | null;
  steps: RecipeStep[];
}

// Splits a flat step list into sections at each isHeader entry. A recipe with no
// headers comes back as a single section with title: null (today's plain behavior).
export function groupSteps(steps: RecipeStep[]): StepSection[] {
  const sections: StepSection[] = [{ title: null, steps: [] }];

  steps.forEach((step) => {
    if (step.isHeader) {
      sections.push({ title: step.text, steps: [] });
    } else {
      sections[sections.length - 1].steps.push(step);
    }
  });

  return sections.filter((section) => section.title !== null || section.steps.length > 0);
}

export interface IngredientSectionItem {
  ingredient: CustomRecipeIngredient;
  index: number;
}

export interface IngredientSection {
  title: string | null;
  items: IngredientSectionItem[];
}

// Splits a flat ingredient list into sections using startIndex markers. Ingredients
// before the first marker (or when there are no markers at all) have title: null.
// Each item keeps its original index into the flat array, since callers (unit
// conversion) need to reference ingredients by their position in that array.
export function groupIngredientsBySections(
  ingredients: CustomRecipeIngredient[],
  sections: IngredientSectionMarker[] | undefined
): IngredientSection[] {
  const withIndex = ingredients.map((ingredient, index) => ({ ingredient, index }));
  const markers = [...(sections || [])].sort((a, b) => a.startIndex - b.startIndex);

  if (markers.length === 0) {
    return [{ title: null, items: withIndex }];
  }

  const result: IngredientSection[] = [];
  if (markers[0].startIndex > 0) {
    result.push({ title: null, items: withIndex.slice(0, markers[0].startIndex) });
  }

  markers.forEach((marker, i) => {
    const end = markers[i + 1]?.startIndex ?? ingredients.length;
    result.push({ title: marker.title, items: withIndex.slice(marker.startIndex, end) });
  });

  return result;
}
