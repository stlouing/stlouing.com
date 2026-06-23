import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { getCollection, render } from 'astro:content'
import { published, excerpt } from '../lib/content'
import { SITE_TITLE, SITE_DESCRIPTION } from '../lib/site'

// Combined feed: chronological notes, the evergreen Topics (dated by when each
// was last tended), and dated Food reviews — newest first. Each item carries a
// short description (authored, else a generated excerpt) plus the full rendered
// body. Food entries without a `date` are left out of the feed.
export async function GET(context: APIContext) {
  const site = context.site ?? new URL('https://stlouing.com')
  const origin = site.href.replace(/\/$/, '')
  const absolute = (html: string) => html.replace(/(href|src)="\//g, `$1="${origin}/`)

  const container = await AstroContainer.create()

  const notes = published(await getCollection('notes'))
  const topics = published(await getCollection('topics'))

  const noteItems = await Promise.all(
    notes.map(async (note) => {
      const { Content } = await render(note)

      return {
        title: note.data.title,
        pubDate: note.data.date,
        description: note.data.description ?? excerpt(note.body),
        content: absolute(await container.renderToString(Content)),
        link: `/notes/${note.id}/`,
      }
    }),
  )

  const topicItems = await Promise.all(
    topics.map(async (topic) => {
      const { Content } = await render(topic)

      return {
        title: topic.data.title,
        pubDate: topic.data.updated,
        description: topic.data.description ?? excerpt(topic.body),
        content: absolute(await container.renderToString(Content)),
        link: `/${topic.id}/`,
      }
    }),
  )

  // Food reviews only join the feed once dated (the feed is chronological).
  const food = published(await getCollection('food')).filter((place) => place.data.date)
  const foodItems = await Promise.all(
    food.map(async (place) => {
      const { Content } = await render(place)

      return {
        title: place.data.title,
        pubDate: place.data.date as Date,
        description: excerpt(place.body),
        content: absolute(await container.renderToString(Content)),
        link: `/food/${place.id}/`,
      }
    }),
  )

  const items = [...noteItems, ...topicItems, ...foodItems].sort(
    (left, right) => right.pubDate.valueOf() - left.pubDate.valueOf(),
  )

  return rss({ title: SITE_TITLE, description: SITE_DESCRIPTION, site, items })
}
