const CUISINE_EMOJI: Record<string, string> = {
  'ice cream': '🍦',
  'soul food': '🍗',
  bakery: '🥐',
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
  dessert: '🍰',
  donuts: '🍩',
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
  sandwiches: '🥪',
  steak: '🥩',
  sushi: '🍣',
  tacos: '🌮',
  thai: '🍲',
  vegan: '🥗',
  vegetarian: '🥗',
  vietnamese: '🍜',
}

export function cuisineEmoji(cuisines: string[]): string {
  for (const cuisine of cuisines) {
    const emoji = CUISINE_EMOJI[cuisine.trim().toLowerCase()]

    return emoji || '🍽️'
  }

  return '🍽️'
}
