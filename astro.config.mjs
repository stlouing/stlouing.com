// @ts-check
import { defineConfig } from 'astro/config'
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

    return null
  }

  for (const coll of ['food', 'hikes', 'notes']) {
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
  markdown: { remarkPlugins: [[remarkWikiLink, { resolve }]] },
})
