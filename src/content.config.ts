import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const taggable = { tags: z.array(z.string()).default([]), draft: z.boolean().default(false) }
const coords = { coords: z.tuple([z.number(), z.number()]).optional() }

const md = (folder: string) => glob({ pattern: '**/*.md', base: `./src/content/${folder}` })

/* Collections ------------------------------------------------------------- */

const food = defineCollection({
  loader: md('food'),
  schema: ({ image }) =>
    z.object({
    title: z.string(),
    // A one-line tagline shown under the title (detail page) and on the food
    // list row, in accent. Mirrors the neighborhood `description`.
    description: z.string().optional(),
    // A photo of the place, resolved + optimized from a path relative to the
    // markdown file (e.g. ../images/food/sultan.jpeg). Shown atop the writeup.
    photo: image().optional(),
    // Created / publish date. When set, the entry joins the RSS feed (newest first).
    created: z.coerce.date().optional(),
    // Last meaningful revision — shown as an "Updated <date>" line when set.
    updated: z.coerce.date().optional(),
    rating: z.number().min(0).max(10).optional(),
    // Shown in place of the number. Set explicitly, or derived from `rating`
    // (9–10 loved, 7–8 liked, the rest neutral) by src/lib/verdict.ts.
    verdict: z.enum(['loved', 'liked', 'neutral', 'not-for-me']).optional(),
    // Where the place sits in the pipeline, independent of whether it has a
    // writeup yet. Drives the "My Review" line and the map marker treatment:
    //   written     — a full entry (rating + writeup). The default, so every
    //                 existing file stays a `written` place with no change.
    //   tried       — I've been, no rating/writeup yet ("Haven't reviewed yet",
    //                 full-color pin).
    //   want-to-try — on my list, not visited ("Haven't visited yet", grayed pin).
    //   suggested   — a reader/community spot I haven't visited; votable, grayed
    //                 pin. Same treatment as want-to-try, different provenance.
    // A place is "explored by me" when written or tried; grayed on the map otherwise.
    status: z.enum(['written', 'tried', 'want-to-try', 'suggested']).default('written'),
    // Keep this spot off the map's default framing (it still shows as a pin). For
    // far-flung outliers — e.g. the Illinois spots across the river — that would
    // otherwise force the initial fit to zoom way out to include them.
    excludeFromMapFit: z.boolean().default(false),
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
    // Root-relative path to a 1200x630 social-share image in public/ (the
    // link-preview card). Falls back to the site flag when unset.
    ogImage: z.string().optional(),
    ...coords,
    ...taggable,
  }),
})

const hikes = defineCollection({
  loader: md('hikes'),
  schema: z.object({
    title: z.string(),
    // Optional created / last-revised dates, consistent with the other
    // collections (hikes don't join the feed, but carry them for uniformity).
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
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
    // Post date (required — notes are chronological). Feeds the RSS + list order.
    created: z.coerce.date(),
    // Last meaningful revision — shown as an "Updated <date>" line when set.
    updated: z.coerce.date().optional(),
    description: z.string().optional(),
    ...taggable,
  }),
})

const neighborhoods = defineCollection({
  loader: md('neighborhoods'),
  schema: z.object({
    title: z.string(),
    // Created / publish date. When set, the neighborhood joins the RSS feed
    // (newest first), the same way a dated Food review does.
    created: z.coerce.date().optional(),
    // Last meaningful revision — shown as an "Updated <date>" line when set.
    updated: z.coerce.date().optional(),
    // An optional summary shown under the title (and used as the meta
    // description for a data-only neighborhood). Without one, the page falls
    // back to the generated "Neighborhood #X" line.
    description: z.string().optional(),
    // The neighborhood's own site and its Wikipedia article.
    url: z.string().url().optional(),
    wikipedia: z.string().url().optional(),
    // Nearby neighborhood slugs — a manual list for entries the geo adjacency
    // graph doesn't cover (e.g. St. Louis County municipalities). Overrides the
    // computed geographic neighbors when set.
    neighbors: z.array(z.string()).default([]),
    // Signature attractions/landmarks (factual + optional, so a data-only
    // neighborhood can still carry them without a writeup). Each is a name with
    // an optional link + one-line description; a bare string is shorthand for
    // name-only. Normalized to objects so consumers always get the same shape.
    // Vibe descriptors (historic, walkable, …) live in `tags`.
    attractions: z
      .array(
        z.union([
          z.string(),
          z.object({
            name: z.string(),
            url: z.string().url().optional(),
            description: z.string().optional(),
          }),
        ]),
      )
      .transform((list) => list.map((item) => (typeof item === 'string' ? { name: item } : item)))
      .optional(),
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
    // Leading-icon keyword for the topic lists (homepage + /topics). Resolved
    // by src/components/Icon.astro; falls back to a book when unset or unknown.
    icon: z.string().optional(),
    // Root-relative path to a 1200x630 social-share image in public/ (the
    // link-preview card). Falls back to the site flag when unset.
    ogImage: z.string().optional(),
    updated: z.coerce.date(),
    created: z.coerce.date().optional(),
    // 'list' renders the body in the compact reference-list look (mono section
    // headings); 'article' is the default prose look.
    display: z.enum(['article', 'list']).default('article'),
    ...taggable,
  }),
})

// The site changelog: one Markdown file per update, named by date. Frontmatter
// carries the date; the body is a plain Markdown list of what changed (so a new
// update is just a small file with a date and a few bullets — no JSON to escape).
const changelog = defineCollection({
  loader: md('changelog'),
  schema: z.object({
    date: z.coerce.date(),
  }),
})

export const collections = { food, hikes, notes, neighborhoods, topics, changelog }
