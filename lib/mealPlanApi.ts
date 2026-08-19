import { authedFetch } from './authedFetch';

export type MealPlanDoc = Record<string, unknown> & { id: string };

const parse = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Could not ${action} (${response.status})`);
  return response.json();
};

export const fetchMealPlans = async (): Promise<MealPlanDoc[]> => {
  const data = await parse(await authedFetch('/api/mealPlans'), 'load your meal plans');
  return Array.isArray(data?.plans) ? (data.plans as MealPlanDoc[]) : [];
};

// title and image are not stored server-side; the planner re-derives them on load.
export const createMealPlan = async (plan: {
  recipeId: string; isMyRecipe: boolean; servings: number; date: string; type: string;
}): Promise<MealPlanDoc> => {
  const data = await parse(
    await authedFetch('/api/mealPlans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    }),
    'save the meal plan',
  );
  return data as MealPlanDoc;
};

export const deleteMealPlan = async (id: string): Promise<void> => {
  await parse(
    await authedFetch(`/api/mealPlans?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    'remove the meal',
  );
};
