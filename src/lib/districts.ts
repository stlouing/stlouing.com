import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import type { Feature, Polygon } from 'geojson'
import { published } from './content'
import { hullAroundPoints, type LngLat } from './geo'
import { neighborhoodRecords } from './neighborhood-data'
import {
  districtNeighborhoods,
  districtStreets,
  neighborhoodInfo,
  regionOf,
  regionTokenBySlug,
} from './neighborhoods'
import { allSpots, type Spot } from './spots'
import { STREET_SPOT_RANGE_METERS } from './street-spots'

export interface DistrictPlaces {
  places: CollectionEntry<'food'>[]
  spots: Spot[]
}

export interface DistrictPart {
  slug: string
  name: string
  token: string
}

export function districtParts(slug: string): DistrictPart[] {
  return districtNeighborhoods(slug).flatMap((areaSlug) => {
    const info = neighborhoodInfo(areaSlug)
    if (!info) {
      return []
    }

    return [
      {
        slug: areaSlug,
        name: info.name,
        token: regionTokenBySlug[regionOf(info).slug] ?? '--color-map-accent',
      },
    ]
  })
}

export async function districtPlaces(slug: string): Promise<DistrictPlaces> {
  return {
    places: published(await getCollection('food')).filter((place) => place.data.district === slug),
    spots: allSpots().filter((spot) => spot.district === slug),
  }
}

export async function districtBoundary(slug: string): Promise<Feature<Polygon> | undefined> {
  const streets = districtStreets(slug)
  if (streets.length === 0) {
    return undefined
  }

  const { places, spots } = await districtPlaces(slug)
  const memberCoords: LngLat[] = [
    ...places.flatMap((place) =>
      place.data.coords ? [[place.data.coords[1], place.data.coords[0]] as LngLat] : [],
    ),
    ...spots.flatMap((spot) => (spot.coords ? [spot.coords] : [])),
  ]

  return {
    type: 'Feature',
    properties: { slug, streets: streets.map((street) => street.id) },
    geometry: {
      type: 'Polygon',
      coordinates: [
        hullAroundPoints(
          [...streets.flatMap((street) => street.line), ...memberCoords],
          STREET_SPOT_RANGE_METERS,
        ),
      ],
    },
  }
}

export async function districtBoundaries(): Promise<Feature<Polygon>[]> {
  const boundaries = await Promise.all(neighborhoodRecords.map((row) => districtBoundary(row.slug)))

  return boundaries.filter((boundary): boundary is Feature<Polygon> => Boolean(boundary))
}
