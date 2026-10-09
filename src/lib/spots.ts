import { optionalData } from './optional-data'

const spotsData = optionalData<Record<string, unknown[]>>(
  import.meta.glob('../data/spots.json', { eager: true, import: 'default' }),
  {},
)

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

export interface Spot {
  name: string
  category: Exclude<SpotCategoryKey, 'food'>
  url?: string
  description?: string
  coords?: [number, number]
}

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
  photo?: string
}

export function spotsIn(slug: string): Spot[] {
  return (spotsData as Record<string, Spot[]>)[slug] ?? []
}
