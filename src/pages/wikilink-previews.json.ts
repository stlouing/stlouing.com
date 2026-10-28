import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getImage } from 'astro:assets'
import type { ImageMetadata } from 'astro'
import { published, excerpt, PREVIEW_EXCERPT_CHARS } from '../lib/content'
import { NEIGHBORHOODS_ENABLED } from '../lib/neighborhood-data'

interface Preview {
  title: string
  excerpt: string
  kind?: 'neighborhood'
  cuisine?: string[]
  description?: string
  photo?: string
}

async function cardPhoto(photo: ImageMetadata | undefined): Promise<string | undefined> {
  if (!photo) {
    return undefined
  }
  const rendered = await getImage({ src: photo, width: 640, format: 'webp' })

  return rendered.src
}

export const GET: APIRoute = async () => {
  const previews: Record<string, Preview> = {}

  for (const place of published(await getCollection('food'))) {
    previews[place.id] = {
      title: place.data?.title,
      excerpt: excerpt(place.body, PREVIEW_EXCERPT_CHARS),
      cuisine: place.data?.cuisine,
      description: place.data?.description,
      photo: await cardPhoto(place.data?.photo),
    }
  }
  for (const topic of published(await getCollection('topics'))) {
    previews[topic.id] = {
      title: topic.data?.title,
      excerpt: excerpt(topic.body, PREVIEW_EXCERPT_CHARS),
      description: topic.data?.description,
      photo: await cardPhoto(topic.data?.photo),
    }
  }
  const neighborhoods = NEIGHBORHOODS_ENABLED ? published(await getCollection('neighborhoods')) : []
  for (const neighborhood of neighborhoods) {
    previews[neighborhood.id] = {
      title: neighborhood.data.title,
      excerpt: excerpt(neighborhood.body, PREVIEW_EXCERPT_CHARS),
      kind: 'neighborhood',
      description: neighborhood.data.description,
      photo: await cardPhoto(neighborhood.data.photo),
    }
  }

  return new Response(JSON.stringify(previews), { headers: { 'content-type': 'application/json' } })
}
