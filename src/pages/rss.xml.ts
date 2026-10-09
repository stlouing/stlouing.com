import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { getCollection, render } from 'astro:content'
import { published, excerpt } from '../lib/content'
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '../lib/site'

export async function GET(context: APIContext) {
  const site = context.site ?? new URL(SITE_URL)
  const origin = site.href.replace(/\/$/, '')
  const absolutize = (html: string, path: string) =>
    html
      .replace(/(href|src)="\//g, `$1="${origin}/`)
      .replace(/(href|src)="#/g, `$1="${origin}${path}#`)

  const container = await AstroContainer.create()

  const notes = published(await getCollection('notes'))
  const topics = published(await getCollection('topics'))

  const noteItems = await Promise.all(
    notes.map(async (note) => {
      const { Content } = await render(note)
      const link = `/notes/${note.id}/`

      return {
        title: note.data.title,
        pubDate: note.data.created,
        description: note.data.description ?? excerpt(note.body),
        content: absolutize(await container.renderToString(Content), link),
        link,
      }
    }),
  )

  const topicItems = await Promise.all(
    topics.map(async (topic) => {
      const { Content } = await render(topic)
      const link = `/${topic.id}/`

      return {
        title: topic.data.title,
        pubDate: topic.data.updated,
        description: topic.data.description ?? excerpt(topic.body),
        content: absolutize(await container.renderToString(Content), link),
        link,
      }
    }),
  )

  const food = published(await getCollection('food')).filter((place) => place.data.created)
  const foodItems = await Promise.all(
    food.map(async (place) => {
      const { Content } = await render(place)
      const link = `/food/${place.id}/`

      return {
        title: place.data.title,
        pubDate: place.data.created as Date,
        description: excerpt(place.body),
        content: absolutize(await container.renderToString(Content), link),
        link,
      }
    }),
  )

  const neighborhoods = published(await getCollection('neighborhoods')).filter(
    (neighborhood) => neighborhood.data.created,
  )
  const neighborhoodItems = await Promise.all(
    neighborhoods.map(async (neighborhood) => {
      const { Content } = await render(neighborhood)
      const link = `/neighborhoods/${neighborhood.id}/`

      return {
        title: neighborhood.data.title,
        pubDate: neighborhood.data.created as Date,
        description: neighborhood.data.description ?? excerpt(neighborhood.body),
        content: absolutize(await container.renderToString(Content), link),
        link,
      }
    }),
  )

  const items = [...noteItems, ...topicItems, ...foodItems, ...neighborhoodItems].sort(
    (left, right) => right.pubDate.valueOf() - left.pubDate.valueOf(),
  )

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site,
    items,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />`,
  })
}
