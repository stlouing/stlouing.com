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
    // A single line, or an array of lines (e.g. street, then city/state/zip).
    // Normalized to string[] so consumers always render line-by-line.
    address: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .optional(),
    url: z.string().url().optional(),
    // Google Maps link for the place (official maps/search URL).
    google: z.string().url().optional(),
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
    // The hike's AllTrails (or similar) page.
    url: z.string().url().optional(),
    ...coords,
    ...taggable,
  }),
})

const notes = defineCollection({
  loader: md('notes'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    ...taggable,
  }),
})

const neighborhoods = defineCollection({
  loader: md('neighborhoods'),
  schema: z.object({ title: z.string(), updated: z.coerce.date().optional(), ...taggable }),
})

// Evergreen, non-chronological pages (a "digital garden" section). Same
// first-class machinery as notes, but ordered by when each was last tended.
const topics = defineCollection({
  loader: md('topics'),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updated: z.coerce.date(),
    created: z.coerce.date().optional(),
    ...taggable,
  }),
})

export const collections = { food, hikes, notes, neighborhoods, topics }
