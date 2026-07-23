const CUISINE_EMOJI: Record<string, string> = {
  'ice cream': '🍦',
  'soul food': '🍗',
  american: '🍔',
  asian: '🥢',
  bakery: '🥐',
  balkan: '🥙',
  bar: '🍺',
  bbq: '🍖',
  beer: '🍺',
  breakfast: '🍳',
  brewery: '🍺',
  brunch: '🍳',
  burgers: '🍔',
  cafe: '☕',
  chicken: '🍗',
  chinese: '🥡',
  cocktails: '🍸',
  coffee: '☕',
  cuban: '🥘',
  dessert: '🍰',
  donuts: '🍩',
  greek: '🥙',
  'hot dogs': '🌭',
  indian: '🍛',
  italian: '🍝',
  japanese: '🍣',
  korean: '🍲',
  mexican: '🌮',
  'middle eastern': '🌯',
  noodles: '🍜',
  pho: '🍜',
  pizza: '🍕',
  ramen: '🍜',
  salad: '🥗',
  sandwich: '🥪',
  sandwiches: '🥪',
  steak: '🥩',
  sushi: '🍣',
  tacos: '🌮',
  thai: '🍲',
  vegan: '🥗',
  vegetarian: '🥗',
  vietnamese: '🍜',
}

// Casings title-case can't derive from the lowercase tag.
const LABEL_OVERRIDES: Record<string, string> = { bbq: 'BBQ', lgbtq: 'LGBTQ' }

// Display label for a cuisine tag (stored lowercase): "ramen" → "Ramen",
// "hot dogs" → "Hot Dogs", "bbq" → "BBQ".
export function cuisineLabel(cuisine: string): string {
  const key = cuisine.trim().toLowerCase()

  return LABEL_OVERRIDES[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function cuisineEmoji(cuisines: string[]): string {
  for (const cuisine of cuisines) {
    const emoji = CUISINE_EMOJI[cuisine.trim().toLowerCase()]

    return emoji || '🍽️'
  }

  return '🍽️'
}
