import { getCollection } from 'astro:content'
import { published, hasBody, excerpt, PREVIEW_EXCERPT_CHARS } from './content'
import { entryUrl } from './entry-url.mjs'

export interface TaggedItem {
  title: string
  url: string // root-relative; pass through href() before use
  collection: string
  tags: string[]
  // A short line for the tag page: the entry's tagline, else a body excerpt.
  description?: string
}

// The one-line summary shown under a result on a tag page: prefer the authored
// tagline (`description`), else a trimmed excerpt of the writeup.
function summarize(entry: { data: { description?: string }; body?: string }): string | undefined {
  if (entry.data.description) {
    return entry.data.description
  }

  return hasBody(entry) ? excerpt(entry.body ?? '', PREVIEW_EXCERPT_CHARS) : undefined
}

export async function collectTagged(): Promise<TaggedItem[]> {
  const items: TaggedItem[] = []

  for (const entry of published(await getCollection('food'))) {
    items.push({
      title: entry.data.title,
      // cuisines are browsable like tags (click "bbq" → /tags/bbq)
      tags: [...new Set([...entry.data.cuisine, ...entry.data.tags])],
      collection: 'food',
      url: entryUrl('food', entry.id),
      description: summarize(entry),
    })
  }

  for (const entry of published(await getCollection('hikes'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Hikes',
      url: entryUrl('hikes', entry.id),
      description: entry.data.area,
    })
  }

  for (const entry of published(await getCollection('notes'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Notes',
      url: entryUrl('notes', entry.id),
      description: summarize(entry),
    })
  }

  for (const entry of published(await getCollection('neighborhoods'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Neighborhoods',
      url: entryUrl('neighborhoods', entry.id),
      description: summarize(entry),
    })
  }

  for (const entry of published(await getCollection('topics'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Topics',
      url: entryUrl('topics', entry.id),
      description: summarize(entry),
    })
  }

  return items
}

// URL slug for a tag, so a multi-word tag ("hot dogs") links to /tags/hot-dogs/
// rather than a URL with a literal space in it. Display keeps the raw tag.
export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-')
}

// Unique tags with counts, alphabetically.
export async function allTags(): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, number>()
  for (const item of await collectTagged()) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => left.tag.localeCompare(right.tag))
}

export interface TagEntry {
  tag: string
  count: number
}

export interface TagGroups {
  cuisines: TagEntry[]
  vibes: TagEntry[]
  topics: TagEntry[]
}

// Tags split by taxonomy for the /tags index: food cuisines, neighborhood/hike
// vibes, and topic/note tags — so the index reads as sections instead of one
// jumbled cloud. Each tag lands in exactly one group (cuisine > vibe > topic).
export async function tagGroups(): Promise<TagGroups> {
  const cuisine = new Set<string>()
  const vibe = new Set<string>()
  const topic = new Set<string>()

  for (const entry of published(await getCollection('food'))) {
    for (const value of entry.data.cuisine) {
      cuisine.add(value)
    }
    for (const value of entry.data.tags) {
      vibe.add(value)
    }
  }
  for (const entry of published(await getCollection('neighborhoods'))) {
    for (const value of entry.data.tags) {
      vibe.add(value)
    }
  }
  for (const entry of published(await getCollection('hikes'))) {
    for (const value of entry.data.tags) {
      vibe.add(value)
    }
  }
  for (const entry of published(await getCollection('topics'))) {
    for (const value of entry.data.tags) {
      topic.add(value)
    }
  }
  for (const entry of published(await getCollection('notes'))) {
    for (const value of entry.data.tags) {
      topic.add(value)
    }
  }

  const counts = new Map((await allTags()).map((item) => [item.tag, item.count]))
  const toEntry = (tag: string): TagEntry => ({ tag, count: counts.get(tag) ?? 0 })
  // Busiest tags first within each group, then alphabetical.
  const byCount = (left: TagEntry, right: TagEntry): number => {
    return right.count - left.count || left.tag.localeCompare(right.tag)
  }

  const cuisines = [...cuisine].map(toEntry).sort(byCount)
  const vibes = [...vibe]
    .filter((tag) => !cuisine.has(tag))
    .map(toEntry)
    .sort(byCount)
  const topics = [...topic]
    .filter((tag) => !cuisine.has(tag) && !vibe.has(tag))
    .map(toEntry)
    .sort(byCount)

  return { cuisines, vibes, topics }
}
