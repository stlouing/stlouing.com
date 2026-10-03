import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const taggable = { tags: z.array(z.string()).default([]), draft: z.boolean().default(false) }
const coords = { coords: z.tuple([z.number(), z.number()]).optional() }

const md = (folder: string) => glob({ pattern: '**/*.md', base: `./src/content/${folder}` })

const food = defineCollection({
  loader: md('food'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      photo: image().optional(),
      created: z.coerce.date().optional(),
      updated: z.coerce.date().optional(),
      rating: z.number().min(0).max(10).optional(),
      verdict: z.enum(['loved', 'liked', 'neutral', 'not-for-me']).optional(),
      status: z.enum(['written', 'tried', 'want-to-try', 'suggested']).default('written'),
      excludeFromMapFit: z.boolean().default(false),
      cuisine: z.array(z.string()).default([]),
      neighborhood: z.string().optional(),
      address: z
        .union([z.string(), z.array(z.string())])
        .transform((value) => (Array.isArray(value) ? value : [value]))
        .optional(),
      url: z.string().url().optional(),
      instagram: z.string().url().optional(),
      pick: z.object({ name: z.string(), note: z.string().optional() }).optional(),
      ogImage: z.string().optional(),
      ...coords,
      ...taggable,
    }),
})

const notes = defineCollection({
  loader: md('notes'),
  schema: z.object({
    title: z.string(),
    created: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string().optional(),
    ...taggable,
  }),
})

const neighborhoods = defineCollection({
  loader: md('neighborhoods'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      photo: image().optional(),
      created: z.coerce.date().optional(),
      updated: z.coerce.date().optional(),
      description: z.string().optional(),
      url: z.string().url().optional(),
      wikipedia: z.string().url().optional(),
      neighbors: z.array(z.string()).default([]),
      ...taggable,
    }),
})

const topics = defineCollection({
  loader: md('topics'),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    ogImage: z.string().optional(),
    leadImage: z.string().optional(),
    updated: z.coerce.date(),
    created: z.coerce.date().optional(),
    display: z.enum(['article', 'list']).default('article'),
    ...taggable,
  }),
})

const changelog = defineCollection({
  loader: md('changelog'),
  schema: z.object({ date: z.coerce.date() }),
})

export const collections = { food, notes, neighborhoods, topics, changelog }
