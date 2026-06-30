import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { published, excerpt } from '../lib/content'
import { cuisineEmoji } from '../lib/emoji'

// Small map of `id -> { title, excerpt, ... }` for every linkable (published)
// entry, fetched once by the wikilink hovercard script
// (src/scripts/wikilink-preview.ts) and cached. Keep the excerpt short — it's a
// hover preview, not the page. Food entries also carry cuisine + neighborhood so
// the card can show them, which is especially useful for places with no writeup.
const EXCERPT_CHARS = 200

interface Preview {
  title: string
  excerpt: string
  // Food only.
  cuisine?: string[]
  emoji?: string
  neighborhood?: string
  // Food, topics + neighborhoods: the curated tagline.
  description?: string
}

export const GET: APIRoute = async () => {
  const previews: Record<string, Preview> = {}

  function add<T extends { id: string; body?: string; data: { title: string; draft?: boolean } }>(
    entries: T[],
  ): void {
    for (const entry of published(entries)) {
      previews[entry.id] = { title: entry.data.title, excerpt: excerpt(entry.body, EXCERPT_CHARS) }
    }
  }

  for (const place of published(await getCollection('food'))) {
    previews[place.id] = {
      title: place.data?.title,
      excerpt: excerpt(place.body, EXCERPT_CHARS),
      cuisine: place.data?.cuisine,
      emoji: cuisineEmoji(place.data?.cuisine),
      neighborhood: place.data?.neighborhood,
      description: place.data?.description,
    }
  }
  for (const topic of published(await getCollection('topics'))) {
    previews[topic.id] = {
      title: topic.data?.title,
      excerpt: excerpt(topic.body, EXCERPT_CHARS),
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
      excerpt: excerpt(neighborhood.body, EXCERPT_CHARS),
      description: neighborhood.data.description,
    }
  }

  return new Response(JSON.stringify(previews), { headers: { 'content-type': 'application/json' } })
}
