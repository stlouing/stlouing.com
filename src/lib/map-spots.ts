import type { CollectionEntry } from 'astro:content'
import { getImage } from 'astro:assets'
import { hasBody } from './content'
import { cuisineIcon, cuisineLabel } from './cuisine'
import { googleMapsHref, googleSearchHref } from './maps'
import { spotCategories, type MapSpot, type Spot, type SpotFilter } from './spots'
import { href } from './url'

const isExternalUrl = (url: string) => /^https?:\/\//.test(url)

function spotId(spot: Spot): string {
  const name = spot.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${spot.category}-${name}`
}

export function spotPageHref(spot: Spot): string | undefined {
  return spot.url && !isExternalUrl(spot.url) ? href(spot.url) : undefined
}

export function spotWebsiteHref(spot: Spot): string | undefined {
  return spot.url && isExternalUrl(spot.url) ? spot.url : undefined
}

export function spotDirectionsHref(spot: Spot): string | undefined {
  if (!spot.coords) {
    return undefined
  }

  if (!spot.address) {
    return googleSearchHref(`${spot.name}, St. Louis, MO`)
  }

  const location = `${spot.address}, St. Louis, MO`
  const query = spot.category === 'mural' ? location : `${spot.name}, ${location}`

  return googleSearchHref(query)
}

export function spotToMapSpot(spot: Spot): MapSpot | undefined {
  if (!spot.coords) {
    return undefined
  }

  return {
    id: spotId(spot),
    title: spot.name,
    category: spot.category,
    coords: spot.coords,
    url: spotPageHref(spot),
    websiteHref: spotWebsiteHref(spot),
    meta: spotCategories[spot.category].meta,
    tagline: spot.description ?? '',
    addressLines: spot.address ? [spot.address] : [],
    directionsHref: spotDirectionsHref(spot),
  }
}

export interface FoodSpotOptions {
  filterChips?: boolean
  cuisineIcons?: boolean
}

function foodFilters(place: CollectionEntry<'food'>): SpotFilter[] {
  return place.data.cuisine.map((cuisine) => ({
    facet: 'cuisine',
    value: cuisine,
    label: cuisineLabel(cuisine),
  }))
}

export async function foodToMapSpot(
  place: CollectionEntry<'food'>,
  options: FoodSpotOptions = {},
): Promise<MapSpot | undefined> {
  const [lat, lng] = place.data.coords ?? []
  if (lat === undefined || lng === undefined) {
    return undefined
  }
  const thumb = place.data.photo
    ? await getImage({ src: place.data.photo, width: 480, format: 'webp' })
    : undefined

  return {
    id: place.id,
    title: place.data.title,
    category: 'food',
    url: href(`/food/${place.id}/`),
    coords: [lng, lat],
    meta: cuisineLabel(place.data.cuisine[0]),
    rating: place.data.rating,
    tagline: place.data.description ?? '',
    addressLines: place.data.address ?? [],
    directionsHref: googleMapsHref(place.data),
    websiteHref: place.data.url,
    photo: thumb?.src,
    voteSlug: place.id,
    excludeFit: place.data.excludeFromMapFit || undefined,
    filters: options.filterChips ? foodFilters(place) : undefined,
    icon: options.cuisineIcons ? cuisineIcon(place.data.cuisine[0]) : undefined,
    written: hasBody(place),
  }
}

export async function toMapSpots(
  spots: Spot[],
  places: CollectionEntry<'food'>[],
  options: FoodSpotOptions = {},
): Promise<MapSpot[]> {
  const spotMapSpots = spots.flatMap((spot) => {
    const mapSpot = spotToMapSpot(spot)

    return mapSpot ? [mapSpot] : []
  })
  const foodMapSpots = (
    await Promise.all(places.map((place) => foodToMapSpot(place, options)))
  ).flatMap((mapSpot) => (mapSpot ? [mapSpot] : []))

  return [...spotMapSpots, ...foodMapSpots]
}
