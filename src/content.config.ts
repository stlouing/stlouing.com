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
    // Shown in place of the number. Set explicitly, or derived from `rating`
    // (9–10 loved, 7–8 liked, the rest neutral) by src/lib/verdict.ts.
    verdict: z.enum(['loved', 'liked', 'neutral', 'not-for-me']).optional(),
    cuisine: z.array(z.string()).default([]),
    neighborhood: z.string().optional(),
    // A single line, or an array of lines (e.g. street, then city/state/zip).
    // Normalized to string[] so consumers always render line-by-line.
    address: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .optional(),
    url: z.string().url().optional(),
    // The place's Instagram profile.
    instagram: z.string().url().optional(),
    // An editorial "my pick" for the sidebar: the dish to order, an optional
    // note, and an optional emoji (falls back to the cuisine emoji).
    pick: z
      .object({ name: z.string(), note: z.string().optional(), emoji: z.string().optional() })
      .optional(),
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
  schema: z.object({
    title: z.string(),
    // An optional summary shown under the title (and used as the meta
    // description for a data-only neighborhood). Without one, the page falls
    // back to the generated "Neighborhood #X" line.
    description: z.string().optional(),
    // The neighborhood's own site and its Wikipedia article.
    url: z.string().url().optional(),
    wikipedia: z.string().url().optional(),
    ...taggable,
  }),
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
    // 'list' renders the body in the compact reference-list look (mono section
    // headings); 'article' is the default prose look.
    display: z.enum(['article', 'list']).default('article'),
    ...taggable,
  }),
})

export const collections = { food, hikes, notes, neighborhoods, topics }
