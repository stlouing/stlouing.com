import { SITE_NAME, SITE_DESCRIPTION } from './site'

const CONTEXT = 'https://schema.org'

export function websiteSchema(site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: site.href,
    description: SITE_DESCRIPTION,
  }
}

interface ArticleInput {
  title: string
  url: string
  description?: string
  published?: string
  updated?: string
  image?: string
  about?: { name: string; url: string }[]
}

export function articleSchema(input: ArticleInput, site: URL) {
  return {
    '@context': CONTEXT,
    '@type': input.about?.length ? 'Article' : 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: input.url,
    image: input.image,
    datePublished: input.published,
    dateModified: input.updated ?? input.published,
    about: input.about?.length
      ? input.about.map((place) => ({ '@type': 'Place', name: place.name, url: place.url }))
      : undefined,
    author: { '@type': 'Person', name: SITE_NAME, url: site.href },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: site.href },
  }
}

function postalAddress(lines: string[]) {
  const match = lines[1]?.match(/^(.+?),\s*([A-Za-z]{2})\s+(\d{5})/)
  if (match) {
    return {
      '@type': 'PostalAddress',
      streetAddress: lines[0],
      addressLocality: match[1],
      addressRegion: match[2],
      postalCode: match[3],
      addressCountry: 'US',
    }
  }

  return { '@type': 'PostalAddress', streetAddress: lines.join(', ') }
}

interface RestaurantInput {
  name: string
  url: string
  address?: string[]
  coords?: [number, number]
  cuisine?: string[]
  rating?: number
  image?: string
  published?: string
  updated?: string
}

export function restaurantSchema(input: RestaurantInput) {
  const restaurant = {
    '@type': 'Restaurant',
    name: input.name,
    url: input.url,
    image: input.image,
    address: input.address?.length ? postalAddress(input.address) : undefined,
    geo: input.coords
      ? { '@type': 'GeoCoordinates', latitude: input.coords[0], longitude: input.coords[1] }
      : undefined,
    servesCuisine: input.cuisine?.length ? input.cuisine : undefined,
  }

  if (typeof input.rating !== 'number') {
    return { '@context': CONTEXT, ...restaurant }
  }

  return {
    '@context': CONTEXT,
    '@type': 'Review',
    itemReviewed: restaurant,
    reviewRating: { '@type': 'Rating', ratingValue: input.rating, bestRating: 5, worstRating: 1 },
    datePublished: input.published,
    dateModified: input.updated ?? input.published,
    author: { '@type': 'Person', name: SITE_NAME },
  }
}

const PLACE_TYPES: Record<string, string> = {
  landmark: 'LandmarksOrHistoricalBuildings',
  museum: 'Museum',
  park: 'Park',
  market: 'GroceryStore',
  mural: 'TouristAttraction',
  thrift: 'Store',
  records: 'Store',
  books: 'BookStore',
  food: 'Restaurant',
}

interface PlaceInput {
  name: string
  alternateNames?: string[]
  url: string
  description?: string
  image?: string
  center?: [number, number]
  contains: { name: string; category: string; url?: string; address?: string[] }[]
}

export function placeSchema(input: PlaceInput, site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'Place',
    name: input.name,
    alternateName: input.alternateNames?.length ? input.alternateNames : undefined,
    url: input.url,
    description: input.description,
    image: input.image,
    geo: input.center
      ? { '@type': 'GeoCoordinates', latitude: input.center[1], longitude: input.center[0] }
      : undefined,
    containedInPlace: { '@type': 'City', name: 'St. Louis', url: site.href },
    containsPlace: input.contains.map((place) => ({
      '@type': PLACE_TYPES[place.category] ?? 'Place',
      name: place.name,
      url: place.url,
      address: place.address?.length ? postalAddress(place.address) : undefined,
    })),
  }
}

interface ListedItem {
  name: string
  url?: string
}

export function itemListSchema(name: string, items: ListedItem[]) {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }
}
