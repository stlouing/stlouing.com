import { CITY, REGION } from './site'
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'
import { getImage } from 'astro:assets'
import { neighborhoodRecords as neighborhoods } from './neighborhood-data'
import { optionalData } from './optional-data'
import countyTownsData from '../data/county-towns.json'
import { excerpt, hasBody, published, PREVIEW_EXCERPT_CHARS } from './content'
import { spotsIn } from './spots'
import { LAST_CITY_NEIGHBORHOOD_NUMBER, officialNamesBySlug } from './official-names.mjs'

const geo = optionalData<{
  viewBox?: string
  shapes: Record<string, string>
  adjacency: Record<string, string[]>
}>(import.meta.glob('../data/neighborhood-geo.json', { eager: true, import: 'default' }), {
  shapes: {},
  adjacency: {},
})

const festivals = optionalData<unknown[]>(
  import.meta.glob('../data/festivals.json', { eager: true, import: 'default' }),
  [],
)
const streetData = optionalData<{ streets: unknown[] }>(
  import.meta.glob('../data/streets.json', { eager: true, import: 'default' }),
  { streets: [] },
)
const population = optionalData<Record<string, number>>(
  import.meta.glob('../data/neighborhood-population.json', { eager: true, import: 'default' }),
  {},
)

const countyTowns = countyTownsData as Record<string, string>

const NOT_EXPLORED_EXCERPT = "I haven't written about this neighborhood yet."

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function wikipediaHref(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURI(title.replace(/ /g, '_'))}`
}

export async function neighborhoodHref(slug: string | undefined): Promise<string | null> {
  if (!slug || !infoBySlug.has(slug)) {
    return null
  }

  return `/neighborhoods/${slug}/`
}

export interface NeighborhoodInfo {
  number: number
  numberLabel?: string
  name: string
  slug: string
  group: string
  type?: string
  coords?: [number, number]
  streets?: string[]
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

export const regionTokenBySlug: Record<string, string> = {
  'north-city': '--color-map-north',
  'central-corridor': '--color-map-central',
  'south-city': '--color-map-south',
  'st-louis-county': '--color-map-county',
  parks: '--color-map-park',
  districts: '--color-map-district',
}

export function regionOf(info: NeighborhoodInfo): Region {
  if (info.type === 'park') {
    return { slug: 'parks', label: 'Parks' }
  }
  if (info.type === 'district') {
    return { slug: 'districts', label: 'District' }
  }

  return { slug: REGION_SLUG_BY_GROUP[info.group] ?? '', label: info.group }
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
  return population[slug]
}

export function neighborhoodGeneratedSummary(slug: string): string | undefined {
  const info = infoBySlug.get(slug)
  if (!info) {
    return undefined
  }
  if (info.type) {
    return `${info.name}, a ${info.type} in ${info.group}`
  }

  return `Neighborhood #${info.numberLabel ?? info.number}, in ${CITY}'s ${info.group}`
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

function neighborhoodIntroduction(
  slug: string,
  neighbors: NeighborhoodInfo[],
): { opening: string; borderClause: string } | undefined {
  const info = infoBySlug.get(slug)
  if (!info) {
    return undefined
  }

  const districtAreas = districtNeighborhoods(slug)
  if (districtAreas.length > 0) {
    return {
      opening: `${info.name} is a district in ${joinNames(districtAreas.map(neighborhoodName))}`,
      borderClause: '',
    }
  }

  const official = officialNames(slug)
  const namedAs =
    official.length > 0 ? `${info.name} (officially ${joinNames(official)})` : info.name
  const opening = info.type
    ? `${info.name} is a ${info.type} in ${info.group}`
    : `${namedAs} is neighborhood #${info.numberLabel ?? info.number} in ${CITY}'s ${info.group}`
  const borderNames = neighbors.slice(0, 3).map((neighbor) => neighbor.name)
  const borderClause = borderNames.length > 0 ? `, bordering ${joinNames(borderNames)}` : ''

  return { opening, borderClause }
}

export function neighborhoodSummary(
  slug: string,
  neighbors: NeighborhoodInfo[],
): string | undefined {
  const introduction = neighborhoodIntroduction(slug, neighbors)
  if (!introduction) {
    return undefined
  }

  return `${introduction.opening}${introduction.borderClause}.`
}

export function neighborhoodMetaDescription(
  slug: string,
  neighbors: NeighborhoodInfo[],
  foodCount: number,
  budget: number = Infinity,
): string | undefined {
  const introduction = neighborhoodIntroduction(slug, neighbors)
  if (!introduction) {
    return undefined
  }

  const { opening, borderClause } = introduction
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

export interface Street {
  id: string
  name: string
  road: string
  from: string
  to: string
  anchor: string
  neighborhoods: string[]
  line: number[][]
}

export function allStreets(): Street[] {
  return streetData.streets as Street[]
}

export function streetsIn(slug: string): Street[] {
  return (streetData.streets as Street[]).filter((street) => street.neighborhoods.includes(slug))
}

export function districtStreets(slug: string): Street[] {
  const streetIds = infoBySlug.get(slug)?.streets ?? []

  return streetIds.flatMap((streetId) => allStreets().filter((street) => street.id === streetId))
}

export function districtNeighborhoods(slug: string): string[] {
  return [...new Set(districtStreets(slug).flatMap((street) => street.neighborhoods))]
}

export function districtForStreet(streetId: string): NeighborhoodInfo | undefined {
  return [...infoBySlug.values()].find((info) => info.streets?.includes(streetId))
}

export function districtsWithin(slug: string): NeighborhoodInfo[] {
  return [...infoBySlug.values()].filter(
    (info) => info.type === 'district' && districtNeighborhoods(info.slug).includes(slug),
  )
}

const officialNamesOf = officialNamesBySlug(neighborhoods)

export function officialNames(slug: string): string[] {
  const info = infoBySlug.get(slug)
  const names: string[] = officialNamesOf.get(slug) ?? []
  if (!info || (names.length === 1 && names[0] === info.name)) {
    return []
  }

  return names
}

export interface OfficialNamesLine {
  label: string
  names: string[]
}

export function officialNamesLine(slug: string): OfficialNamesLine | undefined {
  const info = infoBySlug.get(slug)
  const names = officialNames(slug)
  if (!info || names.length === 0) {
    return undefined
  }
  const noun = names.length > 1 ? 'City neighborhoods' : 'City neighborhood'
  const numbers = String(info.numberLabel ?? info.number).replace('-', '–')

  return { label: `${noun} ${numbers}`, names }
}

export interface Festival {
  name: string
  neighborhood: string | null
  when: string
  blurb: string
  url?: string
}

export function festivalsIn(slug: string): Festival[] {
  return (festivals as Festival[]).filter((festival) => festival.neighborhood === slug)
}

const nameBySlug = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.slug, neighborhood.name]),
)

export function neighborhoodName(slug: string | null | undefined): string {
  if (!slug) {
    return ''
  }

  return nameBySlug.get(slug) ?? countyTowns[slug] ?? slug
}

export interface ResourceLink {
  label: string
  href: string
}

const cityNeighborhoodSlug: Record<string, string> = {
  'greater-ville': 'the-greater-ville',
  'jeff-vanderlou': 'jeffvanderlou',
  'fairground-neighborhood': 'fairground',
  ofallon: 'o-fallon',
}

const mytownviewSlug: Record<string, string> = { 'forest-park-southeast': 'forest-park-south-east' }

const wikipediaTitleBySlug: Record<string, string | null> = {
  'bellefontainecalvary-cemetery': null,
  'carondelet-park': 'Carondelet Park',
  'fairground-park': 'Fairground Park (St. Louis)',
  'jeff-vanderlou': 'JeffVanderLou, St. Louis',
  'mark-twain-i-70-industrial': 'Mark Twain/I-70 Industrial, St. Louis',
  'missouri-botanical-garden': 'Missouri Botanical Garden',
  'north-pointe': 'North Point, St. Louis',
  'ofallon-park': "O'Fallon Park",
  'old-north-st-louis': 'Old North St. Louis',
  'peabody-darst-webbe': 'Peabody–Darst–Webbe, St. Louis',
  'penrose-park': null,
  'st-louis-place': 'St. Louis Place',
  'the-gate-district': 'Gate District, St. Louis',
  'tower-grove-park': 'Tower Grove Park',
  'wells-goodfellow': 'Wells/Goodfellow, St. Louis',
  'willmore-park': null,
  'wydown-skinker': 'Wydown/Skinker, St. Louis',
}

function wikipediaTitle(slug: string, name: string, info?: NeighborhoodInfo): string | null {
  if (Object.hasOwn(wikipediaTitleBySlug, slug)) {
    return wikipediaTitleBySlug[slug]
  }
  if (info?.type === 'district') {
    return null
  }
  if (info?.type === 'city' || info?.type === 'community') {
    return `${name}, ${REGION}`
  }

  return `${name}, ${CITY}`
}

export function neighborhoodResources(info: NeighborhoodInfo): ResourceLink[] {
  if (info.number > LAST_CITY_NEIGHBORHOOD_NUMBER) {
    return []
  }

  const citySlug = cityNeighborhoodSlug[info.slug] ?? info.slug
  const mytownview = mytownviewSlug[info.slug] ?? info.slug

  return [
    {
      label: 'St. Louis City',
      href: `https://www.stlouis-mo.gov/live-work/community/neighborhoods/${citySlug}/`,
    },
    {
      label: 'MyTownView',
      href: `https://mytownview.com/missouri/st-louis-city/st-louis/${mytownview}`,
    },
  ]
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
  const title = wikipediaTitle(slug, name, info)
  const wikipedia = wikipediaOverride ?? (title ? wikipediaHref(title) : undefined)

  const trimSlash = (url: string) => url.replace(/\/+$/, '')
  const officialIsDuplicate = Boolean(
    official && resources.some((resource) => trimSlash(resource.href) === trimSlash(official)),
  )

  const mytownview = resources.find((resource) => resource.label === 'MyTownView')
  const city = resources.find((resource) => resource.label === 'St. Louis City')
  const website = official && !officialIsDuplicate ? { label: 'Website', href: official } : null

  return [
    ...(website ? [website] : []),
    ...(wikipedia ? [{ label: 'Wikipedia', href: wikipedia }] : []),
    ...(mytownview ? [mytownview] : []),
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
    const key = place.data.neighborhood
    const existing = grouped.get(key) ?? []
    existing.push(place)
    grouped.set(key, existing)
  }

  return grouped
}

export function neighborhoodHasContent(slug: string, written: boolean, foodCount: number): boolean {
  return (
    written ||
    foodCount > 0 ||
    spotsIn(slug).length > 0 ||
    festivalsIn(slug).length > 0 ||
    streetsIn(slug).length > 0
  )
}

export function placeLocality(slug: string | undefined, address: string[] = []): string {
  if (!slug) {
    return CITY
  }
  const name = neighborhoodName(slug)
  const info = neighborhoodInfo(slug)
  const inCity =
    info !== undefined &&
    info.group !== 'St. Louis County' &&
    info.type !== 'city' &&
    info.type !== 'community'
  if (inCity) {
    return `${name}, ${CITY}`
  }
  const state = address
    .map((line) => line.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1])
    .find((match): match is string => Boolean(match))

  return state ? `${name}, ${state}` : name
}

export interface AreaPopup {
  name: string
  area: string
  park: boolean
  tagline: string
  excerpt: string
  photo: string
  written: boolean
}

export async function neighborhoodPopups(): Promise<Record<string, AreaPopup>> {
  const entries = new Map(
    published(await getCollection('neighborhoods')).map((entry) => [entry.id, entry]),
  )
  const popups: Record<string, AreaPopup> = {}
  for (const info of infoBySlug.values()) {
    const entry = entries.get(info.slug)
    const thumb = entry?.data.photo
      ? await getImage({ src: entry.data.photo, width: 480, format: 'webp' })
      : undefined
    popups[info.slug] = {
      name: info.name,
      area: info.type === 'district' ? regionOf(info).label : info.group,
      park: info.type === 'park',
      tagline: entry?.data.description ?? '',
      excerpt:
        entry && hasBody(entry) ? excerpt(entry.body, PREVIEW_EXCERPT_CHARS) : NOT_EXPLORED_EXCERPT,
      photo: thumb?.src ?? '',
      written: Boolean(entry && hasBody(entry)),
    }
  }

  return popups
}
