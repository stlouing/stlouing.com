import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'

import { neighborhoodRecords } from './neighborhood-data'

type PartFeature = Feature<Polygon | MultiPolygon, { NHD_NAME: string; NHD_NUM: number | string }>

export interface OfficialPart {
  slug: string
  name: string
}

const partFiles = import.meta.glob<string>('/public/*-neighborhood-parts.geojson', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const parts = Object.values(partFiles).flatMap(
  (file) => (JSON.parse(file) as { features: PartFeature[] }).features,
)

function isInsideRing([longitude, latitude]: Position, ring: Position[]): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [startLongitude, startLatitude] = ring[index]
    const [endLongitude, endLatitude] = ring[previous]
    const crossesLatitude = startLatitude > latitude !== endLatitude > latitude
    const crossingLongitude =
      ((endLongitude - startLongitude) * (latitude - startLatitude)) /
        (endLatitude - startLatitude) +
      startLongitude
    if (crossesLatitude && longitude < crossingLongitude) {
      inside = !inside
    }
  }

  return inside
}

function isInsideGeometry(point: Position, geometry: Polygon | MultiPolygon): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

  return polygons.some(
    ([outer, ...holes]) =>
      isInsideRing(point, outer) && !holes.some((hole) => isInsideRing(point, hole)),
  )
}

export function officialPartAt(
  groupedSlug: string,
  coords: [number, number] | undefined,
): OfficialPart | undefined {
  const group = neighborhoodRecords.find((row) => row.slug === groupedSlug)
  if (!group?.showsOfficialParts || !coords) {
    return undefined
  }

  const memberNumbers = neighborhoodRecords
    .filter((row) => row.mergedInto === groupedSlug)
    .map((row) => row.number)
  const [latitude, longitude] = coords
  const part = parts.find(
    (feature) =>
      [...memberNumbers, group.number].includes(Number(feature.properties.NHD_NUM)) &&
      isInsideGeometry([longitude, latitude], feature.geometry),
  )
  const record = neighborhoodRecords.find((row) => row.name === part?.properties.NHD_NAME)

  return record ? { slug: record.slug, name: record.name } : undefined
}
