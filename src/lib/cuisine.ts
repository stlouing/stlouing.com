// Casings title-case can't derive from the lowercase tag.
const LABEL_OVERRIDES: Record<string, string> = { bbq: 'BBQ', lgbtq: 'LGBTQ' }

// Display label for a cuisine tag (stored lowercase): "ramen" → "Ramen",
// "hot dogs" → "Hot Dogs", "bbq" → "BBQ".
export function cuisineLabel(cuisine: string): string {
  const key = cuisine.trim().toLowerCase()

  return LABEL_OVERRIDES[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
}
