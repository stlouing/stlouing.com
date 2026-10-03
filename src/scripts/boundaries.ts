import neighborhoods from '../data/neighborhoods.json'

export interface BoundaryFeature {
  type: 'Feature'
  properties: Record<string, unknown> | null
  geometry: { type: string; coordinates: unknown }
}

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

export async function boundaryFor(slug: string): Promise<BoundaryFeature | undefined> {
  const number = numberBySlug.get(slug)
  if (number === undefined) {
    return undefined
  }

  const features = await loadFeatures()

  return features.find((feature) => Number(feature.properties?.NHD_NUM) === number)
}

export async function boundariesFor(slugs: Iterable<string>): Promise<BoundaryFeature[]> {
  const numbers = numbersFor(slugs)
  if (numbers.size === 0) {
    return []
  }

  const features = await loadFeatures()

  return features.filter((feature) => numbers.has(Number(feature.properties?.NHD_NUM)))
}
