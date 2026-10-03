import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import neighborhoods from '../data/neighborhoods.json'
import geo from '../data/neighborhood-geo.json'
import festivals from '../data/festivals.json'
import corridorData from '../data/corridors.json'
import population from '../data/neighborhood-population.json'
import { published } from './content'

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function wikipediaHref(name: string): string {
  return `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')},_St._Louis`
}

const slugByName = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [normalizeName(neighborhood.name), neighborhood.slug]),
)

let pageSlugs: Set<string> | null = null
async function neighborhoodPageSlugs(): Promise<Set<string>> {
  if (!pageSlugs) {
    const entries = published(await getCollection('neighborhoods'))
    pageSlugs = new Set(entries.map((entry) => entry.id))
  }

  return pageSlugs
}

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
  type?: string
  coords?: [number, number]
}

const infoBySlug = new Map<string, NeighborhoodInfo>(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.slug, neighborhood as NeighborhoodInfo]),
)

export function neighborhoodInfo(slug: string): NeighborhoodInfo | undefined {
  return infoBySlug.get(slug)
}

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

export const regionTokenBySlug: Record<string, string> = {
  'north-city': '--color-map-north',
  'central-corridor': '--color-map-central',
  'south-city': '--color-map-south',
  'st-louis-county': '--color-map-county',
  parks: '--color-map-park',
}

export function regionOf(info: NeighborhoodInfo): Region {
  if (info.type === 'park') {
    return { slug: 'parks', label: 'Parks' }
  }

  return { slug: REGION_SLUG_BY_GROUP[info.group] ?? '', label: info.group }
}

export function neighborhoodsInRegion(regionSlug: string): NeighborhoodInfo[] {
  return [...infoBySlug.values()].filter((info) => regionOf(info).slug === regionSlug)
}

export function hasNeighborhoodShape(slug: string): boolean {
  return slug in (geo.shapes as Record<string, string>)
}

const shapeCenterBySlug = new Map<string, { x: number; y: number }>()

function shapeCenter(slug: string): { x: number; y: number } | undefined {
  const cached = shapeCenterBySlug.get(slug)
  if (cached) {
    return cached
  }

  const path = (geo.shapes as Record<string, string>)[slug]
  if (!path) {
    return undefined
  }

  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < numbers.length - 1; index += 2) {
    minX = Math.min(minX, numbers[index])
    maxX = Math.max(maxX, numbers[index])
    minY = Math.min(minY, numbers[index + 1])
    maxY = Math.max(maxY, numbers[index + 1])
  }
  if (!Number.isFinite(minX)) {
    return undefined
  }

  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  shapeCenterBySlug.set(slug, center)

  return center
}

export function neighborBearing(fromSlug: string, toSlug: string): number | undefined {
  const fromShape = shapeCenter(fromSlug)
  const toShape = shapeCenter(toSlug)

  let bearing: number | undefined
  if (fromShape && toShape) {
    bearing = (Math.atan2(toShape.x - fromShape.x, -(toShape.y - fromShape.y)) * 180) / Math.PI
  } else {
    const fromCoords = infoBySlug.get(fromSlug)?.coords
    const toCoords = infoBySlug.get(toSlug)?.coords
    if (fromCoords && toCoords) {
      const eastward = (toCoords[1] - fromCoords[1]) * Math.cos((fromCoords[0] * Math.PI) / 180)
      const northward = toCoords[0] - fromCoords[0]
      bearing = (Math.atan2(eastward, northward) * 180) / Math.PI
    }
  }

  if (bearing === undefined) {
    return undefined
  }

  return (((Math.round(bearing / 45) % 8) + 8) % 8) * 45
}

export function neighborhoodPopulation(slug: string): number | undefined {
  return (population as Record<string, number>)[slug]
}

export function neighborhoodGeneratedSummary(slug: string): string | undefined {
  const info = infoBySlug.get(slug)
  if (!info) {
    return undefined
  }
  if (info.type) {
    return `${info.name}, a ${info.type} in ${info.group}`
  }

  return `Neighborhood #${info.numberLabel ?? info.number}, in St. Louis's ${info.group}`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? ''
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function neighborhoodMetaDescription(
  slug: string,
  neighbors: NeighborhoodInfo[],
  foodCount: number,
  budget: number = Infinity,
): string | undefined {
  const info = infoBySlug.get(slug)
  if (!info) {
    return undefined
  }

  const opening = info.type
    ? `${info.name} is a ${info.type} in ${info.group}`
    : `${info.name} is neighborhood #${info.numberLabel ?? info.number} in St. Louis's ${info.group}`
  const borderNames = neighbors.slice(0, 3).map((neighbor) => neighbor.name)
  const borderClause = borderNames.length > 0 ? `, bordering ${joinNames(borderNames)}` : ''
  const foodClause =
    foodCount > 0 ? `, with ${foodCount} reviewed food spot${foodCount === 1 ? '' : 's'}` : ''

  const candidates = [
    `${opening}${borderClause}${foodClause}.`,
    `${opening}${borderClause}.`,
    `${opening}.`,
  ]

  return candidates.find((candidate) => candidate.length <= budget) ?? candidates[2]
}

export function neighborsOf(slug: string): NeighborhoodInfo[] {
  const adjacency = geo.adjacency as Record<string, string[]>
  const slugs = adjacency[slug] ?? []

  return slugs
    .map((neighbor) => infoBySlug.get(neighbor))
    .filter((neighbor): neighbor is NeighborhoodInfo => Boolean(neighbor))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export interface Corridor {
  id: string
  name: string
  street: string
  from: string
  to: string
  anchor: string
  neighborhoods: string[]
}

export function corridorsIn(slug: string): Corridor[] {
  return (corridorData.corridors as Corridor[]).filter((corridor) =>
    corridor.neighborhoods.includes(slug),
  )
}

export interface Festival {
  name: string
  neighborhood: string | null
  when: string
  blurb: string
}

export function festivalsIn(slug: string): Festival[] {
  return (festivals as Festival[]).filter((festival) => festival.neighborhood === slug)
}

export function allFestivals(): Festival[] {
  return festivals as Festival[]
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const monthAnchors: Record<string, number> = {
  'new year': 0,
  'mardi gras': 1,
  'st. patrick': 2,
  'st patrick': 2,
  'memorial day': 4,
  juneteenth: 5,
  'independence day': 6,
  'fourth of july': 6,
  'labor day': 8,
  halloween: 9,
  thanksgiving: 10,
  christmas: 11,
}

export function festivalMonthIndex(when: string): number {
  const lower = when.toLowerCase()
  const named = MONTHS.findIndex((month) => lower.includes(month.toLowerCase()))
  if (named !== -1) {
    return named
  }

  for (const [anchor, index] of Object.entries(monthAnchors)) {
    if (lower.includes(anchor)) {
      return index
    }
  }

  return 12
}

export function festivalDayRank(when: string): number {
  const lower = when.toLowerCase()
  const day = lower.match(/\b(\d{1,2})\b/)
  if (day) {
    return Number(day[1])
  }
  if (lower.includes('early')) {
    return 5
  }
  if (lower.includes('mid')) {
    return 15
  }
  if (lower.includes('late')) {
    return 25
  }

  return 15
}

const nameBySlug = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.slug, neighborhood.name]),
)

export function neighborhoodName(slug: string | null): string | undefined {
  if (!slug) {
    return undefined
  }

  return nameBySlug.get(slug)
}

export interface ResourceLink {
  label: string
  href: string
}

const cityNeighborhoodSlug: Record<string, string | null> = {
  'the-grove': 'forest-park-southeast',
  'delmar-loop': 'skinker-debaliviere',
  'greater-ville': 'the-greater-ville',
  'jeff-vanderlou': 'jeffvanderlou',
  'fairground-neighborhood': 'fairground',
  ofallon: 'o-fallon',
  dogtown: null,
}

const mytownviewSlug: Record<string, string | null> = {
  'the-grove': 'forest-park-south-east',
  'delmar-loop': 'skinker-debaliviere',
  dogtown: null,
}

export function neighborhoodResources(info: NeighborhoodInfo): ResourceLink[] {
  const links: ResourceLink[] = []
  if (info.number >= 80) {
    return links
  }

  const citySlug = info.slug in cityNeighborhoodSlug ? cityNeighborhoodSlug[info.slug] : info.slug
  if (citySlug) {
    links.push({
      label: 'St. Louis City',
      href: `https://www.stlouis-mo.gov/live-work/community/neighborhoods/${citySlug}/`,
    })
  }

  const mtvSlug = info.slug in mytownviewSlug ? mytownviewSlug[info.slug] : info.slug
  if (mtvSlug) {
    links.push({
      label: 'MyTownView',
      href: `https://mytownview.com/missouri/st-louis-city/st-louis/${mtvSlug}`,
    })
  }

  return links
}

export function neighborhoodResourceLinks(
  slug: string,
  name: string,
  officialUrl?: string,
  wikipediaOverride?: string,
): ResourceLink[] {
  const info = neighborhoodInfo(slug)
  const resources = info ? neighborhoodResources(info) : []

  const official = officialUrl
  const wikipedia = wikipediaOverride ?? wikipediaHref(name)

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
