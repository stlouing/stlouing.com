import spotsData from '../data/spots.json'

// The map/list category roster: key order is display order (legend, card metas).
// `label` is the plural legend voice, `meta` the singular card/popup chip,
// `icon` an Icon.astro keyword, `token` the category's color custom property.
export const spotCategories = {
  landmark: {
    label: 'Landmarks',
    meta: 'Landmark',
    icon: 'landmark',
    token: '--color-spot-landmark',
  },
  park: { label: 'Parks & Green Space', meta: 'Park', icon: 'tree', token: '--color-spot-park' },
  shop: { label: 'Shops', meta: 'Shop', icon: 'shopping-bag', token: '--color-spot-shop' },
  food: {
    label: 'Food & Drink',
    meta: 'Food & Drink',
    icon: 'utensils',
    token: '--color-spot-food',
  },
} as const

export type SpotCategoryKey = keyof typeof spotCategories

// One authored spot from src/data/spots.json (keyed by neighborhood slug).
// `coords` is [lng, lat] like every other src/data JSON, and optional: an entry
// without coords renders in the Notable spots list but stays off the map.
export interface Spot {
  name: string
  category: Exclude<SpotCategoryKey, 'food'>
  url?: string
  description?: string
  coords?: [number, number]
}

// One marker on the neighborhood detail map — authored spots and food places
// merged into a single payload by the page. `url` arrives fully baked (href()
// already applied to internal paths).
export interface MapSpot {
  title: string
  category: SpotCategoryKey
  coords: [number, number]
  url?: string
  external?: boolean
  meta?: string
  verdict?: { key: string; label: string }
  tagline?: string
  directionsHref?: string
}

export function spotsIn(slug: string): Spot[] {
  return (spotsData as Record<string, Spot[]>)[slug] ?? []
}
