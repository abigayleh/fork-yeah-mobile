// Ported from the web app so the mobile "Auto sort" groups a grocery list the same
// way. Categorises a free-text grocery line into a store section, then ranks it for
// a perimeter-first walk through a typical US supermarket.

export const GROCERY_CATEGORIES = [
  'Produce',
  'Bakery & Bread',
  'Deli',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Canned & Jarred',
  'Pasta, Rice & Cereal',
  'Baking & Spices',
  'Condiments & Sauces',
  'Snacks',
  'Beverages',
  'Frozen',
  'Household',
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

const RANK_BY_CATEGORY = new Map<string, number>(GROCERY_CATEGORIES.map((category, index) => [category, index]));

export function categoryRank(category?: string | null): number {
  return RANK_BY_CATEGORY.get(String(category || '')) ?? GROCERY_CATEGORIES.length;
}

function singularizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(?:ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export const normalizeIngredientName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ').split(' ').map(singularizeWord).join(' ');

const RAW_DICTIONARY: Record<string, GroceryCategory> = {
  // Produce
  apple: 'Produce', apricot: 'Produce', arugula: 'Produce', asparagus: 'Produce', avocado: 'Produce',
  banana: 'Produce', basil: 'Produce', 'bell pepper': 'Produce', beet: 'Produce', blackberry: 'Produce',
  blueberry: 'Produce', broccoli: 'Produce', 'brussels sprout': 'Produce', cabbage: 'Produce',
  cantaloupe: 'Produce', carrot: 'Produce', cauliflower: 'Produce', celery: 'Produce', cherry: 'Produce',
  cilantro: 'Produce', corn: 'Produce', cranberry: 'Produce', cucumber: 'Produce', eggplant: 'Produce',
  garlic: 'Produce', ginger: 'Produce', grape: 'Produce', grapefruit: 'Produce', 'green bean': 'Produce',
  'green onion': 'Produce', kale: 'Produce', kiwi: 'Produce', leek: 'Produce', lemon: 'Produce',
  lettuce: 'Produce', lime: 'Produce', mango: 'Produce', mint: 'Produce', mushroom: 'Produce',
  onion: 'Produce', orange: 'Produce', parsley: 'Produce', pea: 'Produce', peach: 'Produce',
  pear: 'Produce', pineapple: 'Produce', plum: 'Produce', pomegranate: 'Produce', potato: 'Produce',
  radish: 'Produce', raspberry: 'Produce', romaine: 'Produce', rosemary: 'Produce', scallion: 'Produce',
  shallot: 'Produce', spinach: 'Produce', squash: 'Produce', strawberry: 'Produce', 'sweet potato': 'Produce',
  thyme: 'Produce', tomato: 'Produce', watermelon: 'Produce', zucchini: 'Produce',

  // Bakery & Bread
  bagel: 'Bakery & Bread', baguette: 'Bakery & Bread', bread: 'Bakery & Bread', brioche: 'Bakery & Bread',
  bun: 'Bakery & Bread', cake: 'Bakery & Bread', ciabatta: 'Bakery & Bread', croissant: 'Bakery & Bread',
  donut: 'Bakery & Bread', 'english muffin': 'Bakery & Bread', 'garlic bread': 'Bakery & Bread',
  'hamburger bun': 'Bakery & Bread',
  'hot dog bun': 'Bakery & Bread', muffin: 'Bakery & Bread', naan: 'Bakery & Bread', pita: 'Bakery & Bread',
  roll: 'Bakery & Bread', sourdough: 'Bakery & Bread', tortilla: 'Bakery & Bread',

  // Deli
  bologna: 'Deli', 'deli meat': 'Deli', ham: 'Deli', hummus: 'Deli', pastrami: 'Deli',
  pepperoni: 'Deli', prosciutto: 'Deli', 'rotisserie chicken': 'Deli', salami: 'Deli',
  'sliced turkey': 'Deli',

  // Meat & Seafood
  bacon: 'Meat & Seafood', beef: 'Meat & Seafood', chicken: 'Meat & Seafood',
  'chicken breast': 'Meat & Seafood', 'chicken thigh': 'Meat & Seafood', 'chicken wing': 'Meat & Seafood',
  clam: 'Meat & Seafood', cod: 'Meat & Seafood', crab: 'Meat & Seafood', fish: 'Meat & Seafood',
  'ground beef': 'Meat & Seafood', 'ground turkey': 'Meat & Seafood', halibut: 'Meat & Seafood',
  lamb: 'Meat & Seafood', lobster: 'Meat & Seafood', mussel: 'Meat & Seafood', pork: 'Meat & Seafood',
  'pork chop': 'Meat & Seafood', ribeye: 'Meat & Seafood', salmon: 'Meat & Seafood',
  sausage: 'Meat & Seafood', scallop: 'Meat & Seafood', shrimp: 'Meat & Seafood',
  sirloin: 'Meat & Seafood', steak: 'Meat & Seafood', tilapia: 'Meat & Seafood', tuna: 'Meat & Seafood',
  turkey: 'Meat & Seafood', veal: 'Meat & Seafood',

  // Dairy & Eggs
  butter: 'Dairy & Eggs', buttermilk: 'Dairy & Eggs', cheddar: 'Dairy & Eggs', cheese: 'Dairy & Eggs',
  'cottage cheese': 'Dairy & Eggs', cream: 'Dairy & Eggs', 'cream cheese': 'Dairy & Eggs',
  creamer: 'Dairy & Eggs', egg: 'Dairy & Eggs', feta: 'Dairy & Eggs', gouda: 'Dairy & Eggs',
  'greek yogurt': 'Dairy & Eggs', 'half and half': 'Dairy & Eggs', 'heavy cream': 'Dairy & Eggs',
  margarine: 'Dairy & Eggs', milk: 'Dairy & Eggs', mozzarella: 'Dairy & Eggs', parmesan: 'Dairy & Eggs',
  ricotta: 'Dairy & Eggs', 'sour cream': 'Dairy & Eggs', 'swiss cheese': 'Dairy & Eggs',
  'whipping cream': 'Dairy & Eggs', yogurt: 'Dairy & Eggs',
  'almond milk': 'Dairy & Eggs', 'cashew milk': 'Dairy & Eggs', 'oat milk': 'Dairy & Eggs',
  'skim milk': 'Dairy & Eggs', 'soy milk': 'Dairy & Eggs', 'whole milk': 'Dairy & Eggs',

  // Canned & Jarred
  applesauce: 'Canned & Jarred', 'beef broth': 'Canned & Jarred', 'black bean': 'Canned & Jarred',
  broth: 'Canned & Jarred', chickpea: 'Canned & Jarred', 'chicken broth': 'Canned & Jarred',
  'coconut milk': 'Canned & Jarred', garbanzo: 'Canned & Jarred', 'kidney bean': 'Canned & Jarred',
  olive: 'Canned & Jarred', pickle: 'Canned & Jarred', salsa: 'Canned & Jarred', soup: 'Canned & Jarred',
  stock: 'Canned & Jarred', 'tomato paste': 'Canned & Jarred', 'tomato sauce': 'Canned & Jarred',
  'beef stock': 'Canned & Jarred', 'chicken stock': 'Canned & Jarred',
  'mushroom soup': 'Canned & Jarred', 'vegetable broth': 'Canned & Jarred',
  'vegetable stock': 'Canned & Jarred',

  // Pasta, Rice & Cereal
  barley: 'Pasta, Rice & Cereal', 'brown rice': 'Pasta, Rice & Cereal', cereal: 'Pasta, Rice & Cereal',
  couscous: 'Pasta, Rice & Cereal', granola: 'Pasta, Rice & Cereal', lentil: 'Pasta, Rice & Cereal',
  macaroni: 'Pasta, Rice & Cereal', noodle: 'Pasta, Rice & Cereal', oat: 'Pasta, Rice & Cereal',
  oatmeal: 'Pasta, Rice & Cereal', orzo: 'Pasta, Rice & Cereal', pasta: 'Pasta, Rice & Cereal',
  penne: 'Pasta, Rice & Cereal', quinoa: 'Pasta, Rice & Cereal', ramen: 'Pasta, Rice & Cereal',
  rice: 'Pasta, Rice & Cereal', spaghetti: 'Pasta, Rice & Cereal',

  // Baking & Spices
  'baking powder': 'Baking & Spices', 'baking soda': 'Baking & Spices', 'bay leaf': 'Baking & Spices',
  'black pepper': 'Baking & Spices', 'brown sugar': 'Baking & Spices', cayenne: 'Baking & Spices',
  'chili powder': 'Baking & Spices', 'chocolate chip': 'Baking & Spices', cinnamon: 'Baking & Spices',
  cocoa: 'Baking & Spices', 'condensed milk': 'Baking & Spices', 'corn syrup': 'Baking & Spices',
  cornstarch: 'Baking & Spices', cumin: 'Baking & Spices', 'curry powder': 'Baking & Spices',
  'evaporated milk': 'Baking & Spices', flour: 'Baking & Spices', 'food coloring': 'Baking & Spices',
  'garlic powder': 'Baking & Spices', molasses: 'Baking & Spices', nutmeg: 'Baking & Spices',
  'onion powder': 'Baking & Spices', oregano: 'Baking & Spices', paprika: 'Baking & Spices',
  'powdered sugar': 'Baking & Spices', salt: 'Baking & Spices', shortening: 'Baking & Spices',
  sprinkles: 'Baking & Spices', sugar: 'Baking & Spices', turmeric: 'Baking & Spices',
  vanilla: 'Baking & Spices', 'vanilla extract': 'Baking & Spices', yeast: 'Baking & Spices',

  // Condiments & Sauces
  'balsamic vinegar': 'Condiments & Sauces', 'barbecue sauce': 'Condiments & Sauces',
  'bbq sauce': 'Condiments & Sauces', 'canola oil': 'Condiments & Sauces', 'fish sauce': 'Condiments & Sauces',
  honey: 'Condiments & Sauces', 'hot sauce': 'Condiments & Sauces', 'italian dressing': 'Condiments & Sauces',
  jam: 'Condiments & Sauces', jelly: 'Condiments & Sauces', ketchup: 'Condiments & Sauces',
  'maple syrup': 'Condiments & Sauces', marinara: 'Condiments & Sauces', mayo: 'Condiments & Sauces',
  mayonnaise: 'Condiments & Sauces', mustard: 'Condiments & Sauces', 'olive oil': 'Condiments & Sauces',
  'peanut butter': 'Condiments & Sauces', pesto: 'Condiments & Sauces', ranch: 'Condiments & Sauces',
  relish: 'Condiments & Sauces', 'salad dressing': 'Condiments & Sauces', 'sesame oil': 'Condiments & Sauces',
  'soy sauce': 'Condiments & Sauces', sriracha: 'Condiments & Sauces', syrup: 'Condiments & Sauces',
  tahini: 'Condiments & Sauces', teriyaki: 'Condiments & Sauces', 'vegetable oil': 'Condiments & Sauces',
  vinegar: 'Condiments & Sauces', worcestershire: 'Condiments & Sauces',

  // Snacks
  almond: 'Snacks', candy: 'Snacks', cashew: 'Snacks', chip: 'Snacks', chocolate: 'Snacks',
  cookie: 'Snacks', cracker: 'Snacks', 'granola bar': 'Snacks', jerky: 'Snacks', nut: 'Snacks',
  peanut: 'Snacks', pecan: 'Snacks', pistachio: 'Snacks', popcorn: 'Snacks', 'potato chip': 'Snacks',
  pretzel: 'Snacks', raisin: 'Snacks', 'tortilla chip': 'Snacks', 'trail mix': 'Snacks', walnut: 'Snacks',

  // Beverages
  'apple juice': 'Beverages', beer: 'Beverages', coffee: 'Beverages', cola: 'Beverages',
  'energy drink': 'Beverages', juice: 'Beverages', kombucha: 'Beverages', lemonade: 'Beverages',
  'orange juice': 'Beverages', seltzer: 'Beverages', soda: 'Beverages', 'sparkling water': 'Beverages',
  'sports drink': 'Beverages', tea: 'Beverages', water: 'Beverages', wine: 'Beverages',

  // Frozen
  'ice cream': 'Frozen', popsicle: 'Frozen',

  // Household
  'aluminum foil': 'Household', batteries: 'Household', bleach: 'Household', cleaner: 'Household',
  conditioner: 'Household', deodorant: 'Household', 'dish soap': 'Household', 'laundry detergent': 'Household',
  'light bulb': 'Household', lotion: 'Household', napkin: 'Household', 'paper towel': 'Household',
  'parchment paper': 'Household', 'plastic wrap': 'Household', razor: 'Household', shampoo: 'Household',
  soap: 'Household', sponge: 'Household', 'storage bag': 'Household', tissue: 'Household',
  'toilet paper': 'Household', toothpaste: 'Household', 'trash bag': 'Household', ziploc: 'Household',
};

// A Map (not an object) so a term like "__proto__" can't return Object.prototype.
const DICTIONARY = new Map<string, GroceryCategory>(
  Object.entries(RAW_DICTIONARY).map(([term, category]) => [normalizeIngredientName(term), category])
);

// Longest first so "chicken broth" wins over "chicken".
const DICTIONARY_TERMS = Array.from(DICTIONARY.keys()).sort((a, b) => b.length - a.length);

const PREFIX_RULES: [string, GroceryCategory][] = [
  ['frozen', 'Frozen'],
  ['canned', 'Canned & Jarred'],
];

export function categorizeLocally(name: string): GroceryCategory | null {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return null;

  const prefixRule = PREFIX_RULES.find(([prefix]) => normalized.startsWith(`${prefix} `));
  if (prefixRule) return prefixRule[1];

  const exact = DICTIONARY.get(normalized);
  if (exact) return exact;

  const padded = ` ${normalized} `;
  const term = DICTIONARY_TERMS.find((candidate) => padded.includes(` ${candidate} `));
  return term ? DICTIONARY.get(term) ?? null : null;
}

// Stable sort of grocery item names into store-section order; unknown items sink
// to the bottom, and items in the same section keep their existing order.
export function sortGroceryByCategory<T>(items: T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => categoryRank(categorizeLocally(getName(a))) - categoryRank(categorizeLocally(getName(b))));
}
