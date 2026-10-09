import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BASEMAP_PADDING = 0.25

const round = (value) => Number(Number(value).toFixed(4))

export const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function search(query, featureType) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    ...(featureType ? { featureType } : {}),
  }).toString()

  const response = await fetch(url, { headers: { 'User-Agent': 'site-basemap-city-lookup/1.0' } })
  if (!response.ok) {
    throw new Error(`Nominatim responded ${response.status}`)
  }

  return response.json()
}

export async function lookUpCity(city) {
  const cityMatches = await search(city, 'city')
  const [place, ...otherMatches] = cityMatches.length > 0 ? cityMatches : await search(city)

  if (!place) {
    throw new Error(
      `No place found for "${city}". Try adding the country, e.g. "Edinburgh, Scotland".`,
    )
  }

  return { place, otherMatches }
}

export function describeMatch(place, otherMatches) {
  const lines = [`Found ${place.display_name}`]
  if (otherMatches.length > 0) {
    lines.push('Other places with that name:')
    lines.push(...otherMatches.map((match) => `  ${match.display_name}`))
  }

  return lines.join('\n')
}

export function cityBoundsFrom(place, city) {
  const [south, north, west, east] = place.boundingbox.map(Number)
  const padLongitude = (east - west) * BASEMAP_PADDING
  const padLatitude = (north - south) * BASEMAP_PADDING

  return {
    center: [round(place.lon), round(place.lat)],
    cityBounds: [
      [round(west), round(south)],
      [round(east), round(north)],
    ],
    basemapBounds: [
      round(west - padLongitude),
      round(south - padLatitude),
      round(east + padLongitude),
      round(north + padLatitude),
    ],
    basemapFile: `${slugify(city.split(',')[0])}.pmtiles`,
  }
}

export function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

export function replaceConfigValues(configPath, values) {
  let config = readFileSync(configPath, 'utf8')

  for (const [name, source] of Object.entries(values)) {
    const pattern = new RegExp(`export const ${name} = (?:\\[\\n[\\s\\S]*?\\n\\]|[^\\n]*)`)
    if (!pattern.test(config)) {
      throw new Error(`Could not find ${name} in site.config.mjs.`)
    }
    config = config.replace(pattern, () => `export const ${name} = ${source}`)
  }

  writeFileSync(configPath, config)
}

export function writeCityBounds(configPath, bounds) {
  replaceConfigValues(configPath, {
    MAP_CENTER: `[${bounds.center.join(', ')}]`,
    CITY_BOUNDS: `[\n  [${bounds.cityBounds[0].join(', ')}],\n  [${bounds.cityBounds[1].join(', ')}],\n]`,
    BASEMAP_BOUNDS: `[${bounds.basemapBounds.join(', ')}]`,
    BASEMAP_FILE: quote(bounds.basemapFile),
  })
}

const runAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (runAsScript) {
  const city = process.argv.slice(2).join(' ').trim()
  if (!city) {
    console.error('Usage: node scripts/set-city-bounds.mjs "Edinburgh"')
    process.exit(1)
  }

  const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site.config.mjs')
  const { place, otherMatches } = await lookUpCity(city)
  const bounds = cityBoundsFrom(place, city)
  writeCityBounds(configPath, bounds)

  console.log(describeMatch(place, otherMatches))
  console.log(`MAP_CENTER      ${JSON.stringify(bounds.center)}`)
  console.log(`CITY_BOUNDS     ${JSON.stringify(bounds.cityBounds)}`)
  console.log(`BASEMAP_BOUNDS  ${JSON.stringify(bounds.basemapBounds)}`)
  console.log(`BASEMAP_FILE    ${bounds.basemapFile}`)
}
