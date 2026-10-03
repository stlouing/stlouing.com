const LABEL_OVERRIDES: Record<string, string> = { bbq: 'BBQ', lgbtq: 'LGBTQ' }

export function cuisineLabel(cuisine: string): string {
  const key = cuisine.trim().toLowerCase()

  return LABEL_OVERRIDES[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
}
