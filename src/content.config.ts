import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const taggable = { tags: z.array(z.string()).default([]), draft: z.boolean().default(false) }
const coords = { coords: z.tuple([z.number(), z.number()]).optional() }

const md = (folder: string) => glob({ pattern: '**/*.md', base: `./src/content/${folder}` })

/* Collections ------------------------------------------------------------- */

const food = defineCollection({
  loader: md('food'),
  schema: z.object({
    title: z.string(),
    rating: z.number().min(0).max(10).optional(),
    cuisine: z.array(z.string()).default([]),
    neighborhood: z.string().optional(),
    address: z.string().optional(),
    instagram: z.string().url().optional(),
    ...coords,
    ...taggable,
  }),
})

const hikes = defineCollection({
  loader: md('hikes'),
  schema: z.object({
    title: z.string(),
    area: z.string().optional(),
    distanceMiles: z.number().optional(),
    difficulty: z.enum(['easy', 'moderate', 'hard']).optional(),
    ...coords,
    ...taggable,
  }),
})

const notes = defineCollection({
  loader: md('notes'),
  schema: z.object({ title: z.string(), date: z.coerce.date(), ...taggable }),
})

const neighborhoods = defineCollection({
  loader: md('neighborhoods'),
  schema: z.object({ title: z.string(), ...taggable }),
})

export const collections = { food, hikes, notes, neighborhoods }
