import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'
import { published } from '../lib/content'
import { SITE_TITLE, SITE_DESCRIPTION } from '../lib/site'

// RSS feed of the notes (the blog), newest first.
export async function GET(context: APIContext) {
  const notes = published(await getCollection('notes')).sort(
    (left, right) => right.data.date.valueOf() - left.data.date.valueOf(),
  )

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://stlouing.com',
    items: notes.map((note) => ({
      title: note.data.title,
      pubDate: note.data.date,
      description: note.data.description,
      link: `/notes/${note.id}/`,
    })),
  })
}
