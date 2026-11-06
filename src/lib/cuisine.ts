import type { LegendItem } from './legend'

const LABEL_OVERRIDES: Record<string, string> = { bbq: 'BBQ', breakfast: 'Breakfast/Brunch' }

export function cuisineLabel(cuisine: string): string {
  const key = cuisine.trim().toLowerCase()

  return LABEL_OVERRIDES[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
}

const PLACE_NOUN_OVERRIDES: Record<string, string> = {
  bakery: 'bakery',
  bar: 'bar',
  breakfast: 'breakfast spot',
  brewery: 'brewery',
  burgers: 'burger joint',
  cafe: 'cafe',
  dessert: 'dessert shop',
  'fried chicken': 'fried chicken spot',
  'hot dogs': 'hot dog spot',
  pizza: 'pizza place',
  ramen: 'ramen shop',
  sandwiches: 'sandwich shop',
  sushi: 'sushi restaurant',
}

export function cuisinePlacePhrase(cuisine: string | undefined): string {
  if (!cuisine) {
    return 'a place to eat'
  }
  const key = cuisine.trim().toLowerCase()
  const noun = PLACE_NOUN_OVERRIDES[key] ?? `${cuisineLabel(key)} restaurant`
  const article = /^[aeiou]/i.test(noun) && !/^eu/i.test(noun) ? 'an' : 'a'

  return `${article} ${noun}`
}

const CUISINE_ICONS: Record<string, string> = {
  african: 'bowl-spoon',
  american: 'utensils',
  asian: 'bowl-chopsticks',
  bakery: 'baguette',
  balkan: 'grill',
  bar: 'cocktail',
  bbq: 'grill',
  breakfast: 'fried-egg',
  brewery: 'beer',
  burgers: 'burger',
  cafe: 'coffee',
  chinese: 'dumpling',
  coffee: 'coffee',
  dessert: 'ice-cream',
  european: 'chef-hat',
  'fried chicken': 'canary',
  greek: 'salad',
  'hot dogs': 'sausage',
  indian: 'flame',
  italian: 'cheese',
  korean: 'bowl-chopsticks',
  'latin american': 'avocado',
  mediterranean: 'salad',
  mexican: 'pepper',
  'middle eastern': 'grill',
  pizza: 'pizza',
  ramen: 'bowl-chopsticks',
  sandwiches: 'bread',
  spanish: 'wine-glass',
  sushi: 'fish',
  thai: 'bowl-chopsticks',
  vietnamese: 'soup',
}

export function cuisineIcon(cuisine: string | undefined): string {
  return CUISINE_ICONS[(cuisine ?? '').trim().toLowerCase()] ?? 'utensils'
}

export function cuisineLegendItems(cuisines: string[]): LegendItem[] {
  return cuisines.map((cuisine) => ({
    key: cuisine,
    label: cuisineLabel(cuisine),
    token: '--color-accent-blue-soft',
    icon: cuisineIcon(cuisine),
  }))
}
