import type { Feature, Polygon } from 'geojson'
import { districtBoundaries, districtBoundary, districtParts, type DistrictPart } from './districts'
import { neighborhoodRecords } from './neighborhood-data'
import {
  neighborhoodInfo,
  officialNames,
  regionOf,
  regionTokenBySlug,
  type NeighborhoodInfo,
} from './neighborhoods'
import { CITY } from './site'

export type AreaMapKind = 'district' | 'grouped' | 'neighborhood' | 'city'

export interface AreaMapRegion {
  number: number
  token: string
  name?: string
  slug?: string
}

export interface AreaMapDistrict {
  name: string
  boundary: Feature<Polygon>
}

export interface AreaMapArea {
  slug: string
  name: string
  kind: AreaMapKind
  token: string
  district?: Feature<Polygon>
  parts?: DistrictPart[]
  regions?: AreaMapRegion[]
  districts?: AreaMapDistrict[]
}

export const CITY_AREA_SLUG = 'city'

const regionToken = (info: NeighborhoodInfo) =>
  regionTokenBySlug[regionOf(info).slug] ?? '--color-map-accent'

const isGroupedPage = (slug: string) => officialNames(slug).length > 1

async function cityArea(): Promise<AreaMapArea> {
  const regions = neighborhoodRecords.flatMap((row) => {
    const info = neighborhoodInfo(row.slug)
    if (!info || info.type === 'district') {
      return []
    }

    const region: AreaMapRegion = { number: info.number, token: regionToken(info) }

    return [isGroupedPage(row.slug) ? { ...region, name: info.name, slug: row.slug } : region]
  })
  const districts = (await districtBoundaries()).flatMap((boundary) => {
    const info = neighborhoodInfo(String(boundary.properties?.slug ?? ''))

    return info ? [{ name: info.name, boundary }] : []
  })

  return {
    slug: CITY_AREA_SLUG,
    name: `${CITY} neighborhood map`,
    kind: 'city',
    token: '--color-map-district',
    regions,
    districts,
  }
}

const AREA_MAP_ATTRIBUTE = /data-area-map="([^"]+)"/g

export function areaMapSlugs(body: string | undefined): string[] {
  const slugs = [...(body ?? '').matchAll(AREA_MAP_ATTRIBUTE)].flatMap((match) =>
    match[1].split(/\s+/).filter(Boolean),
  )

  return [...new Set(slugs)]
}

export async function areaMapAreas(slugs: string[]): Promise<AreaMapArea[]> {
  const areas = await Promise.all(
    slugs.map(async (slug): Promise<AreaMapArea[]> => {
      if (slug === CITY_AREA_SLUG) {
        return [await cityArea()]
      }
      const info = neighborhoodInfo(slug)
      if (!info) {
        return []
      }
      const token = regionToken(info)

      if (info.type === 'district') {
        return [
          {
            slug,
            name: info.name,
            kind: 'district',
            token,
            district: await districtBoundary(slug),
            parts: districtParts(slug),
          },
        ]
      }

      const kind: AreaMapKind = isGroupedPage(slug) ? 'grouped' : 'neighborhood'

      return [{ slug, name: info.name, kind, token }]
    }),
  )

  return areas.flat()
}
