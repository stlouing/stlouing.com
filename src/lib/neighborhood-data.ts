import { optionalData } from './optional-data'

export interface NeighborhoodRecord {
  number: number
  numberLabel?: string
  name: string
  slug: string
  group: string
  type?: string
  coords?: [number, number]
  ignored?: boolean
}

export const neighborhoodRecords = optionalData<NeighborhoodRecord[]>(
  import.meta.glob('../data/neighborhoods.json', { eager: true, import: 'default' }),
  [],
)

export const NEIGHBORHOODS_ENABLED = neighborhoodRecords.length > 0
