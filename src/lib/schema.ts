// Builders for schema.org JSON-LD. Each returns a plain object that BaseLayout
// serializes into a <script type="application/ld+json">. BreadcrumbList is built
// in BaseLayout from the breadcrumb trail; the rest are passed in per page.
import { SITE_TITLE, SITE_DESCRIPTION } from './site'

const CONTEXT = 'https://schema.org'

export function websiteSchema(site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE_TITLE,
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
  // Absolute URL of the social-share image (per-page, else the site flag).
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
    author: { '@type': 'Person', name: SITE_TITLE, url: site.href },
    publisher: { '@type': 'Organization', name: SITE_TITLE, url: site.href },
  }
}

// "Valley Park, MO 63088" -> structured locality/region/postal; otherwise the
// whole address as a single streetAddress.
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
  // Absolute URL of the social-share image (per-page, else the site flag).
  image?: string
}

export function restaurantSchema(input: RestaurantInput) {
  return {
    '@context': CONTEXT,
    '@type': 'Restaurant',
    name: input.name,
    url: input.url,
    image: input.image,
    address: input.address?.length ? postalAddress(input.address) : undefined,
    geo: input.coords
      ? { '@type': 'GeoCoordinates', latitude: input.coords[0], longitude: input.coords[1] }
      : undefined,
    servesCuisine: input.cuisine?.length ? input.cuisine : undefined,
    // The owner's personal score, surfaced as a 0–10 aggregate so search engines
    // can show stars. ratingCount is 1 (a single author rating).
    aggregateRating:
      typeof input.rating === 'number'
        ? {
            '@type': 'AggregateRating',
            ratingValue: input.rating,
            bestRating: 10,
            worstRating: 0,
            ratingCount: 1,
          }
        : undefined,
  }
}
