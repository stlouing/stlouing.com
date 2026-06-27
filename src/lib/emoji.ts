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

// Casings title-case can't derive from the lowercase tag.
const CUISINE_LABEL_OVERRIDE: Record<string, string> = { bbq: 'BBQ' }

// Display label for a cuisine tag (stored lowercase): "ramen" → "Ramen",
// "hot dogs" → "Hot Dogs", "bbq" → "BBQ".
export function cuisineLabel(cuisine: string): string {
  const key = cuisine.trim().toLowerCase()

  return CUISINE_LABEL_OVERRIDE[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function cuisineEmoji(cuisines: string[]): string {
  for (const cuisine of cuisines) {
    const emoji = CUISINE_EMOJI[cuisine.trim().toLowerCase()]

    return emoji || '🍽️'
  }

  return '🍽️'
}

// Shared icon per vibe/tag, used by the neighborhood "Vibe" chips. Keyed by the
// lowercase tag; tags without an entry simply render without a leading icon.
const TAG_EMOJI: Record<string, string> = {
  walkable: '🚶',
  historic: '🏛️',
  dining: '🍽️',
  nightlife: '🌃',
  green: '🌳',
  music: '🎵',
  sports: '🏟️',
  shopping: '🛍️',
  arts: '🎨',
  brewery: '🍺',
  italian: '🍝',
  lgbtq: '🏳️‍🌈',
}

// The icon for a tag, or undefined when none is mapped.
export function tagEmoji(tag: string): string | undefined {
  return TAG_EMOJI[tag.trim().toLowerCase()]
}
