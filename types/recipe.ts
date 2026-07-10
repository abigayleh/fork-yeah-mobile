export interface CustomRecipeIngredient {
  measurement: string;
  quantity: number;
  name: string;
}

export interface RecipeStep {
  text: string;
  imageUrl?: string;
  isHeader?: boolean;
}

// Marks where an ingredient section header goes, e.g. {title: 'Icing', startIndex: 4}
// means "insert this header before ingredient index 4." Ingredients themselves stay a
// plain flat array so grocery lists/meal planner/unit conversion don't need to know
// sections exist at all.
export interface IngredientSectionMarker {
  title: string;
  startIndex: number;
}

export interface CustomRecipe {
  id?: string;
  recipeId?: string;
  name: string;
  imageUrl?: string;
  servings?: number;
  ingredients: CustomRecipeIngredient[];
  ingredientSections?: IngredientSectionMarker[];
  steps: RecipeStep[];
  userId?: string;
}

// Older recipes stored steps as plain strings — this tolerates both shapes at read time.
export function normalizeStep(step: string | RecipeStep): RecipeStep {
  return typeof step === 'string' ? { text: step } : step;
}

export function normalizeSteps(steps: Array<string | RecipeStep> | undefined): RecipeStep[] {
  return (steps || []).map(normalizeStep);
}
