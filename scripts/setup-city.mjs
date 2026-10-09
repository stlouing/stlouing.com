import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  cityBoundsFrom,
  describeMatch,
  lookUpCity,
  quote,
  replaceConfigValues,
  slugify,
  writeCityBounds,
} from './set-city-bounds.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fromRoot = (...parts) => join(root, ...parts)

if (!existsSync(fromRoot('package.json')) || !existsSync(fromRoot('site.config.mjs'))) {
  console.error(`Expected the site repo at ${root}. Run this from the repo with npm run setup.`)
  process.exit(1)
}

for (const tool of ['pmtiles', 'tile-join']) {
  try {
    execFileSync('sh', ['-c', `command -v ${tool}`], { stdio: 'ignore' })
  } catch {
    console.error(`Missing ${tool}. Install with: brew install pmtiles tippecanoe`)
    process.exit(1)
  }
}

const { values: options } = parseArgs({ options: { city: { type: 'string' } } })
const prompt = createInterface({ input: process.stdin })
const pendingLines = []
const waitingAnswers = []
let inputClosed = false

prompt.on('line', (line) => {
  const waiting = waitingAnswers.shift()
  if (waiting) {
    waiting(line)
  } else {
    pendingLines.push(line)
  }
})

prompt.on('close', () => {
  inputClosed = true
  for (const waiting of waitingAnswers.splice(0)) {
    waiting('')
  }
})

function readLine() {
  if (pendingLines.length > 0) {
    return Promise.resolve(pendingLines.shift())
  }

  if (inputClosed) {
    return Promise.resolve('')
  }

  return new Promise((resolveAnswer) => waitingAnswers.push(resolveAnswer))
}

async function ask(label, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : ''
  process.stdout.write(`${label}${suffix}: `)
  const answer = (await readLine()).trim()
  if (!process.stdin.isTTY) {
    console.log(answer || fallback)
  }

  return answer || fallback
}

async function askRequired(label, preset) {
  let answer = preset ?? ''
  while (!answer) {
    if (inputClosed) {
      console.error(`${label} is required. Pass it with --city or run interactively.`)
      process.exit(1)
    }
    answer = await ask(label)
  }

  return answer
}

console.log(`
This sets the site up for a new city. It clears the St. Louis posts, photos and
data, then asks for your details and builds your city's map. Press Enter to
accept a suggestion shown in [brackets].
`)

let city = await askRequired('City', options.city)
let match = await lookUpCity(city)
console.log(describeMatch(match.place, match.otherMatches))
while (match.otherMatches.length > 0) {
  const correction = await ask('Press Enter to keep it, or type a more specific name')
  if (!correction) {
    break
  }
  city = correction
  match = await lookUpCity(city)
  console.log(describeMatch(match.place, match.otherMatches))
}

const { place } = match
const cityName = city.split(',')[0].trim()
const address = place.address ?? {}
const suggestedRegion = (address.state ?? address.country ?? '').split(' / ').pop()
const region = await ask('Region (state, province or country)', suggestedRegion)
const cityShort = await ask('Short city name, for "Made with ♥ in …"', cityName)
const siteName = await ask('Site name', `${cityName}ing`)
const domain = await ask('Domain', `${slugify(siteName)}.com`)
const githubUser = await ask('GitHub user or organisation', slugify(siteName))
const instagramHandle = await ask('Instagram handle (leave blank for none)')
const foundedYear = await ask('Founded year', String(new Date().getFullYear()))
prompt.close()

const socials = [
  { label: 'GitHub', url: `https://github.com/${githubUser}` },
  ...(instagramHandle
    ? [{ label: 'Instagram', url: `https://instagram.com/${instagramHandle}` }]
    : []),
]
const socialsSource = `[\n${socials
  .map((social) => `  { label: ${quote(social.label)}, url: ${quote(social.url)} },`)
  .join('\n')}\n]`

console.log(`\nSetting up ${siteName} for ${cityName}...`)

const config = await import(fromRoot('site.config.mjs'))
const isPlainFileName = (name) => typeof name === 'string' && /^[\w.-]+\.\w+$/.test(name)

for (const folder of ['food', 'neighborhoods', 'topics', 'notes', 'changelog', 'images']) {
  const folderPath = fromRoot('src/content', folder)
  rmSync(folderPath, { recursive: true, force: true })
  mkdirSync(folderPath, { recursive: true })
  writeFileSync(join(folderPath, '.gitkeep'), '')
}

const dataFolder = fromRoot('src/data')
if (existsSync(dataFolder)) {
  for (const file of readdirSync(dataFolder).filter((name) => name.endsWith('.json'))) {
    rmSync(join(dataFolder, file))
  }
}

for (const name of [config.NEIGHBORHOOD_BOUNDARIES_FILE, config.BASEMAP_FILE]) {
  const filePath = fromRoot('public', name)
  if (isPlainFileName(name) && existsSync(filePath) && lstatSync(filePath).isFile()) {
    rmSync(filePath)
  }
}

const shareImageFolder = fromRoot('public/og')
if (existsSync(shareImageFolder)) {
  for (const file of readdirSync(shareImageFolder).filter((name) => name !== 'food.png')) {
    rmSync(join(shareImageFolder, file))
  }
}

writeFileSync(
  fromRoot('src/pages/about.md'),
  `---
layout: ../layouts/MarkdownPage.astro
title: About
description: 'TODO: describe your site.'
---

TODO: write your About page.
`,
)

const configPath = fromRoot('site.config.mjs')
replaceConfigValues(configPath, {
  SITE_NAME: quote(siteName),
  SITE_DOMAIN: quote(domain),
  REPO: quote(`${githubUser}/${domain}`),
  FOUNDED_YEAR: quote(foundedYear),
  CITY: quote(cityName),
  CITY_SHORT: quote(cityShort),
  REGION: quote(region),
  INSTAGRAM_HANDLE: quote(instagramHandle),
  SOCIALS: socialsSource,
  PINNED_TOPIC_ID: quote(''),
  PROMOTED_TOPIC_ID: quote(''),
  CORRIDORS_TOPIC_ID: quote(''),
  FEATURED_FOOD_IDS: '[]',
  NEIGHBORHOOD_BOUNDARIES_FILE: quote(`${slugify(cityName)}-neighborhoods.geojson`),
})
writeCityBounds(configPath, cityBoundsFrom(place, city))

execFileSync(fromRoot('scripts/build-basemap.sh'), { stdio: 'inherit' })

console.log(`
Done. ${siteName} is set up for ${cityName}. Next:

  - Add food posts to src/content/food/ and run npm run dev.
  - Write src/pages/about.md.
  - Replace public/logo.svg, the favicons, public/og.png and public/og/food.png.
  - Add any other socials to SOCIALS in site.config.mjs.
  - For neighborhood pages, see MAPS.md.
`)
