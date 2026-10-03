import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getImage } from 'astro:assets'
import type { ImageMetadata } from 'astro'
import { published, excerpt, PREVIEW_EXCERPT_CHARS } from '../lib/content'

interface Preview {
  title: string
  excerpt: string
  cuisine?: string[]
  neighborhood?: string
  tags?: string[]
  description?: string
  photo?: string
}

function presentTags(tags: string[] | undefined): string[] | undefined {
  return tags && tags.length > 0 ? tags : undefined
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

  function add<
    T extends {
      id: string
      body?: string
      data: { title: string; draft?: boolean; tags?: string[] }
    },
  >(entries: T[]): void {
    for (const entry of published(entries)) {
      previews[entry.id] = {
        title: entry.data.title,
        excerpt: excerpt(entry.body, PREVIEW_EXCERPT_CHARS),
        tags: presentTags(entry.data.tags),
      }
    }
  }

  for (const place of published(await getCollection('food'))) {
    previews[place.id] = {
      title: place.data?.title,
      excerpt: excerpt(place.body, PREVIEW_EXCERPT_CHARS),
      cuisine: place.data?.cuisine,
      neighborhood: place.data?.neighborhood,
      tags: presentTags(place.data?.tags),
      description: place.data?.description,
      photo: await cardPhoto(place.data?.photo),
    }
  }
  for (const topic of published(await getCollection('topics'))) {
    previews[topic.id] = {
      title: topic.data?.title,
      excerpt: excerpt(topic.body, PREVIEW_EXCERPT_CHARS),
      tags: presentTags(topic.data?.tags),
      description: topic.data?.description,
    }
  }
  add(await getCollection('notes'))
  for (const neighborhood of published(await getCollection('neighborhoods'))) {
    previews[neighborhood.id] = {
      title: neighborhood.data.title,
      excerpt: excerpt(neighborhood.body, PREVIEW_EXCERPT_CHARS),
      tags: presentTags(neighborhood.data.tags),
      description: neighborhood.data.description,
      photo: await cardPhoto(neighborhood.data.photo),
    }
  }

  return new Response(JSON.stringify(previews), { headers: { 'content-type': 'application/json' } })
}
