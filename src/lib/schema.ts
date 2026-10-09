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
  tags?: string[]
  image?: string
}

export function articleSchema(input: ArticleInput, site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: input.url,
    image: input.image,
    datePublished: input.published,
    dateModified: input.updated ?? input.published,
    keywords: input.tags?.length ? input.tags.join(', ') : undefined,
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
    reviewRating: { '@type': 'Rating', ratingValue: input.rating, bestRating: 10, worstRating: 0 },
    author: { '@type': 'Person', name: SITE_NAME },
  }
}
