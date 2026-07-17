import { getCollection, type CollectionEntry } from 'astro:content'

export type ChangelogEntry = CollectionEntry<'changelog'>

// Every changelog update, newest first. Each update is a Markdown file in
// src/content/changelog/ — to log one, add a file (named by date) with a `date`
// in frontmatter and a Markdown list of changes in the body.
export async function getChangelog(): Promise<ChangelogEntry[]> {
  const entries = await getCollection('changelog')

  return entries.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf())
}
