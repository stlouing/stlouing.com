import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import type { Feature, Polygon } from 'geojson'
import { published } from './content'
import { hullAroundPoints, metersBetween, type LngLat } from './geo'
import { neighborhoodRecords } from './neighborhood-data'
import {
  allStreets,
  districtNeighborhoods,
  districtStreets,
  neighborhoodInfo,
  regionToken,
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

    return [{ slug: areaSlug, name: info.name, token: regionToken(info) }]
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

type StreetEntry = ReturnType<typeof allStreets>[number]

function streetsTouch(street: StreetEntry, other: StreetEntry): boolean {
  return (
    street.anchor === other.anchor &&
    street.line.some((point) =>
      other.line.some(
        (otherPoint) =>
          metersBetween(point as LngLat, otherPoint as LngLat) <= 2 * STREET_SPOT_RANGE_METERS,
      ),
    )
  )
}

function touchingGroups(streets: StreetEntry[]): StreetEntry[][] {
  const groups: StreetEntry[][] = []
  for (const street of streets) {
    const touching = groups.filter((group) => group.some((member) => streetsTouch(member, street)))
    const merged = [...touching.flat(), street]
    groups.splice(0, groups.length, ...groups.filter((group) => !touching.includes(group)), merged)
  }

  return groups
}

export async function streetAreas(
  spotsByStreet: Record<string, { coords: LngLat }[]>,
): Promise<Feature<Polygon>[]> {
  const districts = await districtBoundaries()
  const covered = new Set(
    districts.flatMap((district) => (district.properties?.streets as string[] | undefined) ?? []),
  )
  const streetHulls: Feature<Polygon>[] = touchingGroups(
    allStreets().filter((street) => !covered.has(street.id)),
  ).map((group) => ({
    type: 'Feature',
    properties: { streets: group.map((street) => street.id) },
    geometry: {
      type: 'Polygon',
      coordinates: [
        hullAroundPoints(
          group.flatMap((street) => [
            ...street.line,
            ...(spotsByStreet[street.id] ?? []).map((spot) => spot.coords),
          ]),
          STREET_SPOT_RANGE_METERS,
        ),
      ],
    },
  }))

  return [...districts, ...streetHulls]
}
