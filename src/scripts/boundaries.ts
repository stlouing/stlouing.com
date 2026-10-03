// The city boundary shapefile (public/stl-neighborhoods.geojson) joined to the
// site's neighborhoods by the official NHD_NUM — the same key area-map.ts uses.
// It's unique, and it survives the shapefile naming a neighborhood differently
// than the site does ("Skinker DeBaliviere" is the site's Delmar Loop) or
// punctuation that two slugifiers disagree about ("O'Fallon", "Bellefontaine/
// Calvary Cemetery"). Every map on a page shares one fetch of the archive.

import neighborhoods from '../data/neighborhoods.json'

export interface BoundaryFeature {
  type: 'Feature'
  properties: Record<string, unknown> | null
  geometry: { type: string; coordinates: unknown }
}

// `ignored` rows are absorbed neighborhoods (the pieces of Dogtown) kept only as
// data; skip them so they don't shadow the merged entry's number.
const numberBySlug = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.slug, neighborhood.number]),
)

let featuresPromise: Promise<BoundaryFeature[]> | null = null

function loadFeatures(): Promise<BoundaryFeature[]> {
  if (!featuresPromise) {
    featuresPromise = fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
      .then((response) => response.json() as Promise<{ features: BoundaryFeature[] }>)
      .then((collection) => collection.features)
      .catch(() => [])
  }

  return featuresPromise
}

function numbersFor(slugs: Iterable<string>): Set<number> {
  const numbers = new Set<number>()
  for (const slug of slugs) {
    const number = numberBySlug.get(slug)
    if (number !== undefined) {
      numbers.add(number)
    }
  }

  return numbers
}

/**
 * The boundary polygon for one site neighborhood slug. Undefined only for a slug
 * the data doesn't map — an unknown one, or an `ignored` absorbed neighborhood.
 */
export async function boundaryFor(slug: string): Promise<BoundaryFeature | undefined> {
  const number = numberBySlug.get(slug)
  if (number === undefined) {
    return undefined
  }

  const features = await loadFeatures()

  return features.find((feature) => Number(feature.properties?.NHD_NUM) === number)
}

/** Every boundary polygon for a set of slugs, in shapefile order. */
export async function boundariesFor(slugs: Iterable<string>): Promise<BoundaryFeature[]> {
  const numbers = numbersFor(slugs)
  if (numbers.size === 0) {
    return []
  }

  const features = await loadFeatures()

  return features.filter((feature) => numbers.has(Number(feature.properties?.NHD_NUM)))
}
