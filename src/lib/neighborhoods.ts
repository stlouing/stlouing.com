import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import neighborhoods from '../data/neighborhoods.json'
import { published } from './content'

// Match neighborhood names loosely (lowercase, alphanumerics only) so e.g.
// "North Hampton" and "Northampton" still join. Mirrors neighborhoods.astro.
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Normalized canonical name -> slug, from the neighborhood data (skipping the
// `ignored` rows that are absorbed into a merged neighborhood like Dogtown).
const slugByName = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [normalizeName(neighborhood.name), neighborhood.slug]),
)

// Slugs that actually have a written neighborhood page (a collection file).
// Cached after the first read of the collection.
let pageSlugs: Set<string> | null = null
async function neighborhoodPageSlugs(): Promise<Set<string>> {
  if (!pageSlugs) {
    const entries = published(await getCollection('neighborhoods'))
    pageSlugs = new Set(entries.map((entry) => entry.id))
  }

  return pageSlugs
}

// Root-relative link to a neighborhood's page, or null when none exists (e.g.
// suburbs, or city neighborhoods without a writeup). Pass through href() before use.
export async function neighborhoodHref(name: string | undefined): Promise<string | null> {
  if (!name) {
    return null
  }

  const slug = slugByName.get(normalizeName(name))
  if (!slug) {
    return null
  }

  const slugs = await neighborhoodPageSlugs()

  return slugs.has(slug) ? `/neighborhoods/${slug}` : `/neighborhoods#${slug}`
}

// Published food places grouped by normalized neighborhood name, for the
// "Food in this neighborhood" cross-links on neighborhood pages.
export async function foodByNeighborhood(): Promise<Map<string, CollectionEntry<'food'>[]>> {
  const places = published(await getCollection('food'))
  const grouped = new Map<string, CollectionEntry<'food'>[]>()

  for (const place of places) {
    if (!place.data.neighborhood) {
      continue
    }
    const key = normalizeName(place.data.neighborhood)
    const existing = grouped.get(key) ?? []
    existing.push(place)
    grouped.set(key, existing)
  }

  return grouped
}
