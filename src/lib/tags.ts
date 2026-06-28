import { getCollection } from 'astro:content'
import { published } from './content'
import { entryUrl } from './entry-url.mjs'

export interface TaggedItem {
  title: string
  url: string // root-relative; pass through href() before use
  collection: string
  tags: string[]
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
    })
  }

  for (const entry of published(await getCollection('hikes'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Hikes',
      url: entryUrl('hikes', entry.id),
    })
  }

  for (const entry of published(await getCollection('notes'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Notes',
      url: entryUrl('notes', entry.id),
    })
  }

  for (const entry of published(await getCollection('neighborhoods'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Neighborhoods',
      url: entryUrl('neighborhoods', entry.id),
    })
  }

  for (const entry of published(await getCollection('topics'))) {
    items.push({
      title: entry.data.title,
      tags: entry.data.tags,
      collection: 'Topics',
      url: entryUrl('topics', entry.id),
    })
  }

  return items
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
