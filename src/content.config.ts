import { defineCollection, z } from 'astro:content'
import neighborhoodRows from './data/neighborhoods.json'
import countyTowns from './data/county-towns.json'
import { glob } from 'astro/loaders'
import type { NeighborhoodRecord } from './lib/neighborhood-data'

const roster = neighborhoodRows as NeighborhoodRecord[]
const placeSlugs = new Set([
  ...roster.filter((row) => !row.ignored && row.type !== 'district').map((row) => row.slug),
  ...Object.keys(countyTowns),
])
const districtSlugs = new Set(
  roster.filter((row) => row.type === 'district').map((row) => row.slug),
)

const draftable = { draft: z.boolean().default(false) }
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
      rating: z.number().min(1).max(5).multipleOf(0.5).optional(),
      status: z.enum(['written', 'tried', 'want-to-try']).default('written'),
      excludeFromMapFit: z.boolean().default(false),
      cuisine: z.array(z.string()).default([]),
      neighborhood: z
        .string()
        .refine((slug) => placeSlugs.has(slug), {
          message:
            'neighborhood must be a roster slug (not a district) or a county-towns.json slug',
        })
        .optional(),
      district: z
        .string()
        .refine((slug) => districtSlugs.has(slug), {
          message: 'district must be a neighborhoods.json row with type "district"',
        })
        .optional(),
      address: z
        .union([z.string(), z.array(z.string())])
        .transform((value) => (Array.isArray(value) ? value : [value]))
        .optional(),
      url: z.string().url().optional(),
      instagram: z.string().url().optional(),
      pick: z.object({ name: z.string(), note: z.string().optional() }).optional(),
      ogImage: z.string().optional(),
      ...coords,
      ...draftable,
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
      featured: z.number().optional(),
      ...draftable,
    }),
})

const topics = defineCollection({
  loader: md('topics'),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        ogImage: z.string().optional(),
        photo: image().optional(),
        photoCaption: z.string().optional(),
        photoInArticle: z.boolean().default(true),
        updated: z.coerce.date().optional(),
        created: z.coerce.date().optional(),
        pinned: z.boolean().default(false),
        display: z.enum(['article', 'list']).default('article'),
        ...draftable,
      })
      .refine((data) => Boolean(data.updated ?? data.created), {
        message: 'A topic needs an updated or created date',
      }),
})

const changelog = defineCollection({
  loader: md('changelog'),
  schema: z.object({ date: z.coerce.date() }),
})

export const collections = { food, neighborhoods, topics, changelog }
