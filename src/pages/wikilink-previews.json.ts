import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { published, excerpt } from '../lib/content'

// Small map of `id -> { title, excerpt }` for every linkable (published) entry,
// fetched once by the wikilink hovercard script (src/scripts/wikilink-preview.ts)
// and cached. Keep the excerpt short — it's a hover preview, not the page.
const EXCERPT_CHARS = 200

interface Preview {
  title: string
  excerpt: string
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

  add(await getCollection('food'))
  add(await getCollection('hikes'))
  add(await getCollection('notes'))
  add(await getCollection('neighborhoods'))
  add(await getCollection('topics'))

  return new Response(JSON.stringify(previews), { headers: { 'content-type': 'application/json' } })
}
