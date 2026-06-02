// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remarkWikiLink } from './src/lib/remark-wikilink.mjs'

// Base path: "/" for a custom domain; set to "/stlouing.com" for a GitHub Pages
// project site. Internal links use import.meta.env.BASE_URL via src/lib/url.ts.
const BASE = '/'

const contentRoot = fileURLToPath(new URL('./src/content', import.meta.url))

function hasRealBody(file) {
  const body = fs
    .readFileSync(file, 'utf8')
    .replace(/^---[\s\S]*?\n---/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  return body.length > 0
}

// Map every content entry id -> its canonical URL, matching the routing/anchor
// rules used by the pages. Rebuilt when the config reloads (restart dev to pick
// up brand-new link targets).
function buildWikiMap() {
  const map = new Map()
  const urlFor = (coll, id, file) => {
    if (coll === 'food' || coll === 'hikes') {
      return hasRealBody(file) ? `/${coll}/${id}` : `/${coll}#${id}`
    }

    if (coll === 'notes') {
      return `/notes/${id}`
    }

    if (coll === 'topics') {
      return `/${id}`
    }

    return null
  }

  for (const coll of ['food', 'hikes', 'notes', 'topics']) {
    const dir = path.join(contentRoot, coll)
    if (!fs.existsSync(dir)) {
      continue
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) {
        continue
      }
      const url = urlFor(coll, file.slice(0, -3), path.join(dir, file))

      if (url) {
        map.set(file.slice(0, -3), url)
      }
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

  add('notes', 'date', (id) => `/notes/${id}`)
  add('topics', 'updated', (id) => `/${id}`)

  return map
}

const lastmodByPath = buildLastmod()

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
  integrations: [
    sitemap({
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
