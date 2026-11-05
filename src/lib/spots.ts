import { optionalData } from './optional-data'
import type { LegendItem } from './legend'

const spotsData = optionalData<unknown[]>(
  import.meta.glob('../data/spots.json', { eager: true, import: 'default' }),
  [],
)

export const spotCategories = {
  landmark: {
    label: 'Landmarks',
    meta: 'Landmark',
    icon: 'landmark',
    token: '--color-spot-landmark',
  },
  museum: { label: 'Museums', meta: 'Museum', icon: 'museum', token: '--color-spot-museum' },
  park: { label: 'Parks & Green Space', meta: 'Park', icon: 'tree', token: '--color-spot-park' },
  market: {
    label: 'Specialty Markets',
    meta: 'Specialty Market',
    icon: 'shopping-bag',
    token: '--color-spot-market',
  },
  mural: { label: 'Murals', meta: 'Mural', icon: 'palette', token: '--color-spot-mural' },
  thrift: {
    label: 'Thrift & Vintage',
    meta: 'Thrift & Vintage',
    icon: 'hanger',
    token: '--color-spot-thrift',
  },
  records: {
    label: 'Record Stores',
    meta: 'Record Store',
    icon: 'music',
    token: '--color-spot-records',
  },
  games: { label: 'Game Stores', meta: 'Game Store', icon: 'chess', token: '--color-spot-games' },
  books: { label: 'Books', meta: 'Bookstore', icon: 'book', token: '--color-spot-books' },
  food: {
    label: 'Food & Drink',
    meta: 'Food & Drink',
    icon: 'utensils',
    token: '--color-spot-food',
  },
} as const

export type SpotCategoryKey = keyof typeof spotCategories

export type SpotSectionKey = Exclude<SpotCategoryKey, 'food'>

export const SPOT_SECTION_ORDER: SpotSectionKey[] = [
  'landmark',
  'museum',
  'park',
  'market',
  'mural',
  'thrift',
  'records',
  'games',
  'books',
]

export interface Spot {
  name: string
  category: SpotSectionKey
  neighborhoods: string[]
  district?: string
  url?: string
  description?: string
  address?: string
  coords?: [number, number]
}

export interface SpotFilter {
  facet: string
  value: string
  label: string
}

export interface MapSpot {
  id: string
  title: string
  category: SpotCategoryKey
  coords: [number, number]
  url?: string
  meta?: string
  rating?: number
  tagline?: string
  addressLines?: string[]
  directionsHref?: string
  websiteHref?: string
  photo?: string
  voteSlug?: string
  excludeFit?: boolean
  filters?: SpotFilter[]
  icon?: string
  written?: boolean
}

export function allSpots(): Spot[] {
  return spotsData as Spot[]
}

export function spotsIn(slug: string): Spot[] {
  return allSpots().filter((spot) => spot.neighborhoods.includes(slug))
}

export function groupSpots(spots: Spot[]): { category: SpotSectionKey; spots: Spot[] }[] {
  return SPOT_SECTION_ORDER.map((category) => ({
    category,
    spots: spots.filter((spot) => spot.category === category),
  })).filter((group) => group.spots.length > 0)
}

export interface CategoryCount {
  key: SpotCategoryKey
  count: number
}

export function categoryCountLabel({ key, count }: CategoryCount): string {
  return count === 1 ? spotCategories[key].meta : spotCategories[key].label
}

export function categoryCounts(spots: Spot[], foodCount: number): CategoryCount[] {
  return (Object.keys(spotCategories) as SpotCategoryKey[])
    .map((key) => ({
      key,
      count: key === 'food' ? foodCount : spots.filter((spot) => spot.category === key).length,
    }))
    .filter((category) => category.count > 0)
}

export function categoryLegendItems(keys: SpotCategoryKey[]): LegendItem[] {
  return keys.map((key) => ({
    key,
    label: spotCategories[key].label,
    token: spotCategories[key].token,
    icon: spotCategories[key].icon,
  }))
}
