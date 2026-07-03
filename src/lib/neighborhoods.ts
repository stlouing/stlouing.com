import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import neighborhoods from '../data/neighborhoods.json'
import geo from '../data/neighborhood-geo.json'
import festivals from '../data/festivals.json'
import population from '../data/neighborhood-population.json'
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

  return slugs.has(slug) ? `/neighborhoods/${slug}/` : `/neighborhoods/${slug}/`
}

export interface NeighborhoodInfo {
  number: number
  numberLabel?: string
  name: string
  slug: string
  group: string
  // Non-neighborhood areas: 'park' (city green spaces) or 'city' (St. Louis County
  // municipalities). Standard numbered city neighborhoods have no type.
  type?: string
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

// Regions group the neighborhoods for their landing pages (/neighborhoods/<slug>).
// Parks are their own region; every other neighborhood falls under its map group.
export interface Region {
  slug: string
  label: string
}

const REGION_SLUG_BY_GROUP: Record<string, string> = {
  'Central Corridor': 'central-corridor',
  'South City': 'south-city',
  'North City': 'north-city',
  'St. Louis County': 'st-louis-county',
}

export const regions: Region[] = [
  { slug: 'central-corridor', label: 'Central Corridor' },
  { slug: 'south-city', label: 'South City' },
  { slug: 'north-city', label: 'North City' },
  { slug: 'st-louis-county', label: 'St. Louis County' },
  { slug: 'parks', label: 'Parks' },
]

// The region a neighborhood belongs to: parks first (they span groups), then by group.
export function regionOf(info: NeighborhoodInfo): Region {
  if (info.type === 'park') {
    return { slug: 'parks', label: 'Parks' }
  }

  return { slug: REGION_SLUG_BY_GROUP[info.group] ?? '', label: info.group }
}

// Every neighborhood in a region, in numbered order (the JSON's natural order).
export function neighborhoodsInRegion(regionSlug: string): NeighborhoodInfo[] {
  return [...infoBySlug.values()].filter((info) => regionOf(info).slug === regionSlug)
}

// True when this neighborhood has a locator silhouette shape. City neighborhoods
// do; St. Louis County municipalities (90+) aren't in the city outline, so their
// page hides the locator rather than showing an empty figure.
export function hasNeighborhoodShape(slug: string): boolean {
  return slug in (geo.shapes as Record<string, string>)
}

// 2020 U.S. Census population for a neighborhood, or undefined where there's none
// (parks/cemeteries). See scripts/build-neighborhood-population.mjs.
export function neighborhoodPopulation(slug: string): number | undefined {
  return (population as Record<string, number>)[slug]
}

// The generated default lede / map-popup preview when an area has no writeup.
// Numbered city neighborhoods read "Neighborhood #X, in St. Louis's <region>";
// parks and county municipalities (which aren't numbered city neighborhoods) read
// "<Name>, a <type> in <region>" — e.g. "Clayton, a city in St. Louis County".
export function neighborhoodGeneratedSummary(slug: string): string | undefined {
  const info = infoBySlug.get(slug)
  if (!info) {
    return undefined
  }
  if (info.type) {
    return `A ${info.type} in ${info.group}`
  }

  return `Neighborhood #${info.numberLabel ?? info.number}, in St. Louis's ${info.group}`
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
  'delmar-loop': 'skinker-debaliviere',
  'greater-ville': 'the-greater-ville',
  'jeff-vanderlou': 'jeffvanderlou',
  'fairground-neighborhood': 'fairground',
  ofallon: 'o-fallon',
  dogtown: null,
}

// MyTownView's URL slug matches ours except for these. 'the-grove' lives at
// 'forest-park-south-east'; 'dogtown' is a four-neighborhood merge with no single
// MyTownView page (null → no link).
const mytownviewSlug: Record<string, string | null> = {
  'the-grove': 'forest-park-south-east',
  'delmar-loop': 'skinker-debaliviere',
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
      label: 'St. Louis City',
      href: `https://www.stlouis-mo.gov/live-work/community/neighborhoods/${citySlug}/`,
    })
  }

  // MyTownView keys its neighborhood pages off the slug directly (with the
  // overrides above). Coverage is best-effort — a few neighborhoods (e.g. the
  // Dogtown merge) have no profile, so they get no link.
  const mtvSlug = info.slug in mytownviewSlug ? mytownviewSlug[info.slug] : info.slug
  if (mtvSlug) {
    links.push({
      label: 'MyTownView',
      href: `https://mytownview.com/missouri/st-louis-city/st-louis/${mtvSlug}`,
    })
  }

  return links
}

// The full ordered list of a neighborhood's external resources: the always-present
// Wikipedia + MyTownView links first, then the optional Website (from frontmatter)
// and City of St. Louis page. Shared by the detail page's action bar, the list's
// expanded rows, and the map popup so all render the same buttons in the same order.
export function neighborhoodResourceLinks(
  slug: string,
  name: string,
  officialUrl?: string,
  wikipediaOverride?: string,
): ResourceLink[] {
  const info = neighborhoodInfo(slug)
  const resources = info ? neighborhoodResources(info) : []

  // A frontmatter `wikipedia` overrides the name-derived article; `url` (the
  // neighborhood's own site) becomes the Website link.
  const official = officialUrl
  const wikipedia = wikipediaOverride ?? wikipediaHref(name)

  // Drop the "Website" link when it points to the same place as a generated
  // resource (e.g. Carondelet's official site IS its City of St. Louis page) —
  // ignoring a trailing slash — so the same destination isn't listed twice.
  const trimSlash = (url: string) => url.replace(/\/+$/, '')
  const officialIsDuplicate = Boolean(
    official && resources.some((resource) => trimSlash(resource.href) === trimSlash(official)),
  )

  const mytownview = resources.find((resource) => resource.label === 'MyTownView')
  const city = resources.find((resource) => resource.label === 'St. Louis City')
  const website = official && !officialIsDuplicate ? { label: 'Website', href: official } : null

  return [
    { label: 'Wikipedia', href: wikipedia },
    ...(mytownview ? [mytownview] : []),
    ...(website ? [website] : []),
    ...(city ? [city] : []),
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
