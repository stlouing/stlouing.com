import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getImage } from 'astro:assets'
import type { ImageMetadata } from 'astro'
import { published, excerpt, PREVIEW_EXCERPT_CHARS } from '../lib/content'

// Small map of `id -> { title, excerpt, ... }` for every linkable (published)
// entry, fetched once by the wikilink hovercard script
// (src/scripts/wikilink-preview.ts) and cached. The hover preview reuses the
// shared on-screen preview length. Food entries also carry cuisine + neighborhood
// so the card can show them, which is especially useful for places with no writeup.

interface Preview {
  title: string
  excerpt: string
  // Food only.
  cuisine?: string[]
  neighborhood?: string
  // Food, topics + neighborhoods: the curated tagline.
  description?: string
  // Entries with a photo: a card-sized rendition shown atop the hovercard.
  photo?: string
}

// Card-sized rendition of an entry photo (640px wide covers the 320px card on
// 2x displays); webp is fine since the hovercard is display-only.
async function cardPhoto(photo: ImageMetadata | undefined): Promise<string | undefined> {
  if (!photo) {
    return undefined
  }
  const rendered = await getImage({ src: photo, width: 640, format: 'webp' })

  return rendered.src
}

export const GET: APIRoute = async () => {
  const previews: Record<string, Preview> = {}

  function add<T extends { id: string; body?: string; data: { title: string; draft?: boolean } }>(
    entries: T[],
  ): void {
    for (const entry of published(entries)) {
      previews[entry.id] = { title: entry.data.title, excerpt: excerpt(entry.body, PREVIEW_EXCERPT_CHARS) }
    }
  }

  for (const place of published(await getCollection('food'))) {
    previews[place.id] = {
      title: place.data?.title,
      excerpt: excerpt(place.body, PREVIEW_EXCERPT_CHARS),
      cuisine: place.data?.cuisine,
      neighborhood: place.data?.neighborhood,
      description: place.data?.description,
      photo: await cardPhoto(place.data?.photo),
    }
  }
  for (const topic of published(await getCollection('topics'))) {
    previews[topic.id] = {
      title: topic.data?.title,
      excerpt: excerpt(topic.body, PREVIEW_EXCERPT_CHARS),
      description: topic.data?.description,
    }
  }
  add(await getCollection('hikes'))
  add(await getCollection('notes'))
  // Neighborhoods carry their tagline (e.g. The Grove → "St. Louis's LGBTQ
  // nightlife strip") so the card leads with it, like topics do.
  for (const neighborhood of published(await getCollection('neighborhoods'))) {
    previews[neighborhood.id] = {
      title: neighborhood.data.title,
      excerpt: excerpt(neighborhood.body, PREVIEW_EXCERPT_CHARS),
      description: neighborhood.data.description,
      photo: await cardPhoto(neighborhood.data.photo),
    }
  }

  return new Response(JSON.stringify(previews), { headers: { 'content-type': 'application/json' } })
}
