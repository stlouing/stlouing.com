import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import neighborhoods from '../data/neighborhoods.json'
import geo from '../data/neighborhood-geo.json'
import festivals from '../data/festivals.json'
import { published } from './content'

// Match neighborhood names loosely (lowercase, alphanumerics only) so e.g.
// "North Hampton" and "Northampton" still join. Mirrors neighborhoods.astro.
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// English Wikipedia article for a St. Louis neighborhood. Article titles follow
// "<Name>, St. Louis" (spaces → underscores), so the link is generated from the
// name; a frontmatter `wikipedia` value overrides it for the rare exception.
export function wikipediaHref(name: string): string {
  return `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')},_St._Louis`
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

export interface NeighborhoodInfo {
  number: number
  numberLabel?: string
  name: string
  slug: string
  group: string
}

// The real (non-`ignored`) neighborhoods, keyed by slug. Drops the rows that are
// folded into a merged neighborhood like Dogtown.
const infoBySlug = new Map<string, NeighborhoodInfo>(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.slug, neighborhood as NeighborhoodInfo]),
)

export function neighborhoodInfo(slug: string): NeighborhoodInfo | undefined {
  return infoBySlug.get(slug)
}

// Neighborhoods that share a boundary with the given one, resolved from the
// precomputed adjacency graph (src/data/neighborhood-geo.json) to full records
// and sorted by name. Unknown slugs (e.g. a park) are dropped.
export function neighborsOf(slug: string): NeighborhoodInfo[] {
  const adjacency = geo.adjacency as Record<string, string[]>
  const slugs = adjacency[slug] ?? []

  return slugs
    .map((neighbor) => infoBySlug.get(neighbor))
    .filter((neighbor): neighbor is NeighborhoodInfo => Boolean(neighbor))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export interface Festival {
  name: string
  neighborhood: string | null
  when: string
  blurb: string
}

// Recurring annual festivals/events anchored to a given neighborhood.
export function festivalsIn(slug: string): Festival[] {
  return (festivals as Festival[]).filter((festival) => festival.neighborhood === slug)
}

export interface ResourceLink {
  label: string
  href: string
}

// The City of St. Louis runs an official overview page per neighborhood, whose
// URL slug matches ours EXCEPT for these. Most are minor punctuation differences;
// 'the-grove' is officially "Forest Park Southeast"; 'dogtown' is an unofficial
// merge of four neighborhoods, so it has no single city page (mapped to null).
const cityNeighborhoodSlug: Record<string, string | null> = {
  'the-grove': 'forest-park-southeast',
  'greater-ville': 'the-greater-ville',
  'jeff-vanderlou': 'jeffvanderlou',
  'fairground-neighborhood': 'fairground',
  ofallon: 'o-fallon',
  dogtown: null,
}

// External reference links for a neighborhood (beyond its Wikipedia article,
// which the page adds itself). Parks/cemeteries — the rows numbered 80+ — aren't
// residential neighborhoods, so they get none.
export function neighborhoodResources(info: NeighborhoodInfo): ResourceLink[] {
  const links: ResourceLink[] = []
  if (info.number >= 80) {
    return links
  }

  // The neighborhood landing page (not the `-overview.cfm` sub-page, which only
  // some neighborhoods have) — it always exists and carries history, census data,
  // parks, and aldermanic contacts.
  const citySlug = info.slug in cityNeighborhoodSlug ? cityNeighborhoodSlug[info.slug] : info.slug
  if (citySlug) {
    links.push({
      label: 'City of St. Louis',
      href: `https://www.stlouis-mo.gov/live-work/community/neighborhoods/${citySlug}/`,
    })
  }

  // Niche keys off each neighborhood's common name, so our slug works directly
  // (including Dogtown and The Grove). Coverage is best-effort — a few small
  // neighborhoods may not have a profile.
  links.push({
    label: 'Niche',
    href: `https://www.niche.com/places-to-live/n/${info.slug}-st-louis-mo/`,
  })

  return links
}

// The full ordered list of a neighborhood's external resources — its own site
// (if any), Wikipedia, then the City of St. Louis + Niche profiles. Shared by the
// detail page's action bar and the neighborhoods list's expanded rows so both
// render the same set of buttons.
export function neighborhoodResourceLinks(
  slug: string,
  name: string,
  officialUrl?: string,
  wikipediaOverride?: string,
): ResourceLink[] {
  const info = neighborhoodInfo(slug)
  const resources = info ? neighborhoodResources(info) : []

  // Drop the frontmatter "Website" link when it points to the same place as a
  // generated resource (e.g. Carondelet's official site IS its City of St. Louis
  // page) — ignoring a trailing slash — so the same destination isn't listed twice.
  const trimSlash = (url: string) => url.replace(/\/+$/, '')
  const officialIsDuplicate = Boolean(
    officialUrl &&
    resources.some((resource) => trimSlash(resource.href) === trimSlash(officialUrl)),
  )

  return [
    ...(officialUrl && !officialIsDuplicate ? [{ label: 'Website', href: officialUrl }] : []),
    { label: 'Wikipedia', href: wikipediaOverride ?? wikipediaHref(name) },
    ...resources,
  ]
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
