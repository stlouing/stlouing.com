// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remarkWikiLink } from './src/lib/remark-wikilink.mjs'
import { entryUrl } from './src/lib/entry-url.mjs'

// Base path: "/" for a custom domain; set to "/stlouing.com" for a GitHub Pages
// project site. Internal links use import.meta.env.BASE_URL via src/lib/url.ts.
const BASE = '/'

const contentRoot = fileURLToPath(new URL('./src/content', import.meta.url))

// Map every content entry id -> its canonical URL (the same one used by the
// backlinks and tag indexes, via the shared entryUrl helper). Rebuilt when the
// config reloads (restart dev to pick up brand-new link targets).
function buildWikiMap() {
  const map = new Map()

  for (const collection of ['food', 'hikes', 'neighborhoods', 'notes', 'topics']) {
    const dir = path.join(contentRoot, collection)
    if (!fs.existsSync(dir)) {
      continue
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) {
        continue
      }
      const id = file.slice(0, -3)
      map.set(id, entryUrl(collection, id))
    }
  }

  return map
}

const wikiMap = buildWikiMap()

// Read a single frontmatter field's raw value from a Markdown file.
function frontmatterField(file, field) {
  const frontmatter = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatter) {
    return null
  }

  const line = frontmatter[1].split('\n').find((row) => row.trim().startsWith(`${field}:`))
  if (!line) {
    return null
  }

  return line
    .slice(line.indexOf(':') + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

// Map each dated page's URL path -> its W3C date, for sitemap <lastmod>. Notes
// use their post date; topics use their "last tended" date.
function buildLastmod() {
  const map = new Map()
  const add = (collection, field, urlFor) => {
    const dir = path.join(contentRoot, collection)
    if (!fs.existsSync(dir)) {
      return
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) {
        continue
      }
      const value = frontmatterField(path.join(dir, file), field)

      if (value) {
        map.set(urlFor(file.slice(0, -3)), value)
      }
    }
  }

  add('notes', 'created', (id) => `/notes/${id}`)
  add('topics', 'updated', (id) => `/${id}`)

  return map
}

const lastmodByPath = buildLastmod()

// True when a collection has at least one non-draft entry. An all-draft (or
// empty) collection is an unpublished section, and its index page is kept out
// of the sitemap below (the page itself also renders noindex).
/** @param {string} collection */
function hasPublishedEntries(collection) {
  const dir = path.join(contentRoot, collection)
  if (!fs.existsSync(dir)) {
    return false
  }

  return fs
    .readdirSync(dir)
    .some(
      (file) => file.endsWith('.md') && frontmatterField(path.join(dir, file), 'draft') !== 'true',
    )
}

const unpublishedSections = ['hikes', 'notes'].filter(
  (collection) => !hasPublishedEntries(collection),
)

// Resolve a wikilink target id to a base-prefixed URL, or null if unknown.
function resolve(target) {
  const url = wikiMap.get(target)

  if (!url) {
    return null
  }

  const clean = url.replace(/^\/+/, '')

  return BASE.endsWith('/') ? BASE + clean : `${BASE}/${clean}`
}

// https://astro.build/config
export default defineConfig({
  site: 'https://stlouing.com',
  // Directory builds on GitHub Pages are served at a trailing-slash URL and 301
  // the slashless form, so keep every route + internal link on the slash form.
  trailingSlash: 'always',
  // The "Backlog" page used to live at /food/want-to-try; keep old links alive.
  redirects: {
    '/food/want-to-try/': '/food/backlog/',
  },
  integrations: [
    sitemap({
      // Tag/aggregation pages are noindex (see BaseLayout `noindex`), so keep them
      // out of the sitemap too — a sitemap entry says "index this", which would
      // contradict the page's own noindex signal. Same for the index page of a
      // section whose collection is all drafts (an unpublished section).
      filter: (page) =>
        !page.includes('/tags/') &&
        !unpublishedSections.some((section) => page.includes(`/${section}/`)),
      serialize(item) {
        const pathname = new URL(item.url).pathname.replace(/\/$/, '') || '/'
        const lastmod = lastmodByPath.get(pathname)
        if (lastmod) {
          item.lastmod = lastmod
        }

        return item
      },
    }),
  ],
  markdown: {
    remarkPlugins: [[remarkWikiLink, { resolve }]],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['heading-anchor'], ariaHidden: true, tabIndex: -1 },
          content: { type: 'text', value: '#' },
        },
      ],
    ],
  },
})
