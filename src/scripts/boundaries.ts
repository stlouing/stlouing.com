import {
  NEIGHBORHOODS_ENABLED,
  neighborhoodRecords as neighborhoods,
} from '../lib/neighborhood-data'
import { NEIGHBORHOOD_BOUNDARIES_FILE, NEIGHBORHOOD_PARTS_FILE } from '../../site.config.mjs'

export interface BoundaryFeature {
  type: 'Feature'
  properties: Record<string, unknown> | null
  geometry: { type: string; coordinates: unknown }
}

const numbersBySlug = new Map<string, number[]>()
for (const neighborhood of neighborhoods) {
  const slug = neighborhood.mergedInto ?? neighborhood.slug
  if (!neighborhood.mergedInto && 'ignored' in neighborhood) {
    continue
  }
  const numbers = numbersBySlug.get(slug) ?? []
  numbers.push(neighborhood.number)
  numbersBySlug.set(slug, numbers)
}

function polygonsOf(feature: BoundaryFeature): unknown[] {
  if (feature.geometry.type === 'Polygon') {
    return [feature.geometry.coordinates]
  }
  if (feature.geometry.type === 'MultiPolygon') {
    return feature.geometry.coordinates as unknown[]
  }

  return []
}

function combineFeatures(features: BoundaryFeature[]): BoundaryFeature | undefined {
  if (features.length <= 1) {
    return features[0]
  }

  return {
    type: 'Feature',
    properties: features[0].properties,
    geometry: { type: 'MultiPolygon', coordinates: features.flatMap(polygonsOf) },
  }
}

const featurePromises = new Map<string, Promise<BoundaryFeature[]>>()

function loadFeatures(file = NEIGHBORHOOD_BOUNDARIES_FILE): Promise<BoundaryFeature[]> {
  if (!NEIGHBORHOODS_ENABLED) {
    return Promise.resolve([])
  }

  let promise = featurePromises.get(file)
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}${file}`)
      .then((response) => response.json() as Promise<{ features: BoundaryFeature[] }>)
      .then((collection) => collection.features)
      .catch(() => [])
    featurePromises.set(file, promise)
  }

  return promise
}

function numbersFor(slugs: Iterable<string>): Set<number> {
  const numbers = new Set<number>()
  for (const slug of slugs) {
    for (const number of numbersBySlug.get(slug) ?? []) {
      numbers.add(number)
    }
  }

  return numbers
}

export async function boundaryFor(slug: string): Promise<BoundaryFeature | undefined> {
  const numbers = numbersFor([slug])
  if (numbers.size === 0) {
    return undefined
  }

  const features = await loadFeatures()

  return combineFeatures(
    features.filter((feature) => numbers.has(Number(feature.properties?.NHD_NUM))),
  )
}

export function neighborhoodFeatures(): Promise<BoundaryFeature[]> {
  return loadFeatures()
}

export function officialParts(): Promise<BoundaryFeature[]> {
  return loadFeatures(NEIGHBORHOOD_PARTS_FILE)
}

export async function officialPartsFor(slug: string): Promise<BoundaryFeature[]> {
  const numbers = numbersFor([slug])
  if (numbers.size < 2) {
    return []
  }

  const features = await officialParts()

  return features.filter((feature) => numbers.has(Number(feature.properties?.NHD_NUM)))
}
