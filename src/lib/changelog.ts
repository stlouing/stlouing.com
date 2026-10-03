import { getCollection, type CollectionEntry } from 'astro:content'

export type ChangelogEntry = CollectionEntry<'changelog'>

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const entries = await getCollection('changelog')

  return entries.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf())
}
