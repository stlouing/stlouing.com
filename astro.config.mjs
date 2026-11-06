import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remarkWikiLink } from './src/lib/remark-wikilink.mjs'
import { rehypeTableScroll } from './src/lib/rehype-table-scroll.mjs'
import { rehypeArticleToc } from './src/lib/rehype-article-toc.mjs'
import { rehypeStreetFacts } from './src/lib/rehype-street-facts.mjs'
import { rehypeAreaTable } from './src/lib/rehype-area-table.mjs'
import { entryUrl } from './src/lib/entry-url.mjs'
import { NEIGHBORHOOD_PARTS_FILE, SITE_URL } from './site.config.mjs'

const BASE = '/'

const contentRoot = fileURLToPath(new URL('./src/content', import.meta.url))
const dataRoot = fileURLToPath(new URL('./src/data', import.meta.url))

function readData(file, fallback) {
  const filePath = path.join(dataRoot, file)

  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback
}

const streetRows = readData('streets.json', { streets: [] }).streets
const neighborhoodRows = readData('neighborhoods.json', [])

function readPartRows() {
  const filePath = fileURLToPath(new URL(`./public/${NEIGHBORHOOD_PARTS_FILE}`, import.meta.url))

  return fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8')).features.map((feature) => feature.properties)
    : []
}

function buildTocGroups() {
  const groupBySlug = new Map(
    neighborhoodRows.map((neighborhood) => [neighborhood.slug, neighborhood.group]),
  )

  const groupsByAnchor = {}
  for (const street of streetRows) {
    if (!street.anchor || groupsByAnchor[street.anchor]) {
      continue
    }

    const streetGroups = (street.neighborhoods ?? [])
      .map((slug) => groupBySlug.get(slug))
      .filter(Boolean)
    const group = streetGroups.find((label) => label !== 'St. Louis County') ?? streetGroups[0]

    if (group) {
      groupsByAnchor[street.anchor] = group
    }
  }

  return groupsByAnchor
}

function buildWikiMap() {
  const map = new Map()

  const collections = fs.existsSync(path.join(dataRoot, 'neighborhoods.json'))
    ? ['food', 'neighborhoods', 'topics']
    : ['food', 'topics']

  for (const collection of collections) {
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

function newestDate(...dates) {
  return dates.filter(Boolean).sort().at(-1)
}

function buildLastmod() {
  const map = new Map()
  const newestByCollection = {}
  const newestFoodByNeighborhood = new Map()
  const add = (collection, fields, urlFor) => {
    const dir = path.join(contentRoot, collection)
    if (!fs.existsSync(dir)) {
      return
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) {
        continue
      }
      const filePath = path.join(dir, file)
      const value = fields.map((field) => frontmatterField(filePath, field)).find(Boolean)
      if (!value) {
        continue
      }

      if (urlFor) {
        map.set(urlFor(file.slice(0, -3)), value)
      }
      newestByCollection[collection] = newestDate(newestByCollection[collection], value)
      if (collection === 'food') {
        const neighborhood = frontmatterField(filePath, 'neighborhood')
        if (neighborhood) {
          newestFoodByNeighborhood.set(
            neighborhood,
            newestDate(newestFoodByNeighborhood.get(neighborhood), value),
          )
        }
      }
    }
  }

  add('topics', ['updated', 'created'], (id) => `/${id}`)
  add('food', ['updated', 'created'], (id) => `/food/${id}`)
  add('neighborhoods', ['updated', 'created'], (id) => `/neighborhoods/${id}`)
  add('changelog', ['date'])

  for (const [neighborhood, date] of newestFoodByNeighborhood) {
    const neighborhoodPath = `/neighborhoods/${neighborhood}`
    map.set(neighborhoodPath, newestDate(map.get(neighborhoodPath), date))
  }

  const { topics, food, neighborhoods, changelog } = newestByCollection
  map.set('/food', food)
  map.set('/neighborhoods', newestDate(food, neighborhoods))
  map.set('/topics', topics)
  map.set('/updates', changelog)
  map.set('/', newestDate(topics, food, neighborhoods, changelog))

  return map
}

const lastmodByPath = buildLastmod()

const neighborhoodsConfigured = fs.existsSync(path.join(dataRoot, 'neighborhoods.json'))

function injectNeighborhoodRoutes(injectRoute) {
  injectRoute({ pattern: '/neighborhoods', entrypoint: './src/routes/neighborhoods.astro' })

  for (const file of fs.readdirSync(
    fileURLToPath(new URL('./src/routes/neighborhoods', import.meta.url)),
  )) {
    injectRoute({
      pattern: `/neighborhoods/${file.replace(/\.astro$/, '')}`,
      entrypoint: `./src/routes/neighborhoods/${file}`,
    })
  }
}

const optionalRoutes = {
  name: 'optional-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (neighborhoodsConfigured) {
        injectNeighborhoodRoutes(injectRoute)
      }
    },
  },
}

function stubFoodPaths() {
  const dir = path.join(contentRoot, 'food')
  if (!fs.existsSync(dir)) {
    return new Set()
  }

  const paths = new Set()
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) {
      continue
    }
    const body = fs
      .readFileSync(path.join(dir, file), 'utf8')
      .replace(/^---\n[\s\S]*?\n---/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
    if (!body) {
      paths.add(`/food/${file.slice(0, -3)}`)
    }
  }

  return paths
}

const stubPaths = stubFoodPaths()

function shipsNoindex(page) {
  const file = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'dist',
    new URL(page).pathname,
    'index.html',
  )
  if (!fs.existsSync(file)) {
    return false
  }

  return /<meta name="robots" content="[^"]*noindex/.test(fs.readFileSync(file, 'utf8'))
}

function resolve(target) {
  const url = wikiMap.get(target)

  if (!url) {
    return null
  }

  const clean = url.replace(/^\/+/, '')

  return BASE.endsWith('/') ? BASE + clean : `${BASE}/${clean}`
}

const rosterOptions = {
  streets: streetRows,
  neighborhoods: neighborhoodRows,
  parts: readPartRows(),
  hasEntry: (slug) => wikiMap.get(slug) === entryUrl('neighborhoods', slug),
  base: BASE,
}

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  redirects: {
    '/food/want-to-try/': '/food/',
    '/food/backlog/': '/food/',
    '/contact/': '/about/#contact',
  },
  integrations: [
    optionalRoutes,
    sitemap({
      filter: (page) =>
        !new URL(page).pathname.startsWith('/sheets/') &&
        !stubPaths.has(new URL(page).pathname.replace(/\/$/, '')) &&
        !shipsNoindex(page),
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
      [rehypeStreetFacts, rosterOptions],
      [rehypeAreaTable, rosterOptions],
      [rehypeArticleToc, { groups: buildTocGroups() }],
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['heading-anchor'], ariaHidden: true, tabIndex: -1 },
          content: { type: 'text', value: '#' },
        },
      ],
      rehypeTableScroll,
    ],
  },
})
