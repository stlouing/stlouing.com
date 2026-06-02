import { getCollection } from 'astro:content'

/**
 * Backlinks ("mentioned in"): scans every collection entry's body for
 * `[[wikilinks]]` and builds a reverse map of target id -> the entries that
 * link to it. Powers the "Mentioned in" list on detail pages.
 */
export interface Backlink {
  title: string
  url: string
  collection: string
}

const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g

function hasContent(body?: string): boolean {
  return (body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim().length > 0
}

// Canonical URL for a source entry (mirrors astro.config wiki map + lib/tags).
function entryUrl(collection: string, id: string, withBody: boolean): string {
  if (collection === 'food' || collection === 'hikes' || collection === 'neighborhoods') {
    return withBody ? `/${collection}/${id}` : `/${collection}#${id}`
  }

  if (collection === 'notes') {
    return `/notes/${id}`
  }

  if (collection === 'topics') {
    return `/${id}`
  }

  return `/${collection}/${id}`
}

let cache: Map<string, Backlink[]> | null = null

async function buildMap(): Promise<Map<string, Backlink[]>> {
  if (cache) {
    return cache
  }

  interface Source {
    id: string
    collection: string
    title: string
    body: string
    withBody: boolean
  }
  const sources: Source[] = []
  const add = (
    collection: string,
    entries: { id: string; body?: string; data: { title?: string } }[],
  ) => {
    for (const entry of entries) {
      sources.push({
        id: entry.id,
        collection,
        title: entry.data.title ?? entry.id,
        body: entry.body ?? '',
        withBody: hasContent(entry.body),
      })
    }
  }

  add('food', await getCollection('food'))
  add('hikes', await getCollection('hikes'))
  add('notes', await getCollection('notes'))
  add('neighborhoods', await getCollection('neighborhoods'))
  add('topics', await getCollection('topics'))

  const map = new Map<string, Backlink[]>()
  for (const source of sources) {
    const targets = new Set<string>()
    let match: RegExpExecArray | null
    WIKILINK.lastIndex = 0

    while ((match = WIKILINK.exec(source.body)) !== null) {
      targets.add(match[1].trim())
    }

    for (const target of targets) {
      if (target === source.id) {
        continue
      }
      const list = map.get(target) ?? []
      list.push({
        title: source.title,
        url: entryUrl(source.collection, source.id, source.withBody),
        collection: source.collection,
      })
      map.set(target, list)
    }
  }

  cache = map
  return map
}

export async function getBacklinks(id: string): Promise<Backlink[]> {
  return (await buildMap()).get(id) ?? []
}
