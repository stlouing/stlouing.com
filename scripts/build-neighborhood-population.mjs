import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CITY } from '../site.config.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = (file) => resolve(root, 'src/data', file)

const { values: options } = parseArgs({
  options: {
    wikipedia: { type: 'string', default: `List of neighborhoods of ${CITY}` },
    csv: { type: 'string' },
  },
})

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const parseCount = (value) => parseInt(String(value).replace(/[^\d]/g, ''), 10)

async function populationFromWikipedia(pageTitle) {
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'parse',
    page: pageTitle.replace(/ /g, '_'),
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
  }).toString()

  const response = await fetch(url, {
    headers: { 'User-Agent': 'neighborhood-population-script/1.0' },
  })
  const payload = await response.json()
  if (!payload.parse) {
    throw new Error(`Wikipedia page "${pageTitle}" not found. Pass --wikipedia "<page title>".`)
  }

  const populationByName = new Map()
  for (const line of payload.parse.wikitext.split('\n')) {
    const match = line.match(/^\|\s*\[\[([^\]]+)\]\]\s*\|\|\s*([\d,]+)/)
    if (!match) {
      continue
    }

    const [target, display] = match[1].includes('|') ? match[1].split('|') : [match[1], match[1]]
    const population = parseCount(match[2])
    if (!Number.isFinite(population)) {
      continue
    }

    populationByName.set(normalize(display), population)
    populationByName.set(normalize(target.replace(/,.*$/, '')), population)
  }

  return populationByName
}

function populationFromCsv(path) {
  const [, ...rows] = readFileSync(resolve(root, path), 'utf8').trim().split(/\r?\n/)
  const populationByName = new Map()

  for (const row of rows) {
    const match = row.match(/^(?:"([^"]*)"|([^,]*)),\s*"?([\d,]+)"?\s*$/)
    if (!match) {
      continue
    }

    const name = (match[1] ?? match[2]).trim()
    const population = parseCount(match[3])
    if (name && Number.isFinite(population)) {
      populationByName.set(normalize(name), population)
    }
  }

  return populationByName
}

const neighborhoods = JSON.parse(readFileSync(dataPath('neighborhoods.json'), 'utf8'))
const aliasesPath = dataPath('neighborhood-population-aliases.json')
const aliases = existsSync(aliasesPath) ? JSON.parse(readFileSync(aliasesPath, 'utf8')) : {}

const populationByName = options.csv
  ? populationFromCsv(options.csv)
  : await populationFromWikipedia(options.wikipedia)

const outputPath = dataPath('neighborhood-population.json')
const existing = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : {}
const output = {}
const unmatched = []
const kept = []

const keepExisting = (neighborhood) => {
  if (existing[neighborhood.slug] != null) {
    output[neighborhood.slug] = existing[neighborhood.slug]
    kept.push(neighborhood.slug)
  }
}

for (const neighborhood of neighborhoods) {
  if (neighborhood.ignored) {
    continue
  }

  if (neighborhood.type) {
    keepExisting(neighborhood)
    continue
  }

  const alias = aliases[neighborhood.slug]
  const names = Array.isArray(alias) ? alias : [alias ?? neighborhood.name]
  const parts = names.map((name) => populationByName.get(normalize(name)))

  if (parts.every((part) => part != null)) {
    output[neighborhood.slug] = parts.reduce((total, part) => total + part, 0)
  } else {
    keepExisting(neighborhood)
    unmatched.push(`#${neighborhood.number} ${neighborhood.name} (${neighborhood.slug})`)
  }
}

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)

console.log(`Wrote ${Object.keys(output).length} neighborhood populations.`)
if (kept.length) {
  console.log(`Kept existing values for: ${kept.join(', ')}`)
}
if (unmatched.length) {
  console.log(`\nUnmatched (${unmatched.length}):\n${unmatched.join('\n')}`)
}
