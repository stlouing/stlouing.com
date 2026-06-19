// Precomputes two derived datasets from the city neighborhood boundaries
// (public/stl-neighborhoods.geojson) into src/data/neighborhood-geo.json:
//
//   1. `shapes`  — an SVG path string per neighborhood, projected into a shared
//                  viewBox, so a locator map can be drawn as inline (themeable)
//                  SVG without shipping Leaflet or tiles.
//   2. `adjacency` — which neighborhoods border which, derived from shared
//                  boundary vertices in the topologically-noded shapefile.
//
// Run with `npm run build:geo` after the boundaries or names change. The output
// is committed so the site build stays a pure static transform.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const geojson = JSON.parse(readFileSync(resolve(root, 'public/stl-neighborhoods.geojson'), 'utf8'))
const neighborhoods = JSON.parse(readFileSync(resolve(root, 'src/data/neighborhoods.json'), 'utf8'))

// Match the loose name-join used across the site (lowercase, alphanumerics only)
// so the geojson's NHD_NAME resolves to our canonical slug.
const normalizeName = (value) => {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const slugByName = new Map(
  neighborhoods
    .filter((neighborhood) => !neighborhood.ignored)
    .map((neighborhood) => [normalizeName(neighborhood.name), neighborhood.slug]),
)

// Pull every ring out of a feature, whether Polygon or MultiPolygon.
const ringsOf = (geometry) => {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat()
  }

  return []
}

// First pass: resolve each feature to a slug and collect its rings + the bounds
// of the whole city (for a single shared projection).
const features = []
let minLon = Infinity
let minLat = Infinity
let maxLon = -Infinity
let maxLat = -Infinity

for (const feature of geojson.features) {
  const name = feature.properties.NHD_NAME
  const slug = slugByName.get(normalizeName(name))
  if (!slug) {
    console.warn(`No slug for geojson neighborhood "${name}" — skipped.`)
    continue
  }

  const rings = ringsOf(feature.geometry)
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon)
      minLat = Math.min(minLat, lat)
      maxLon = Math.max(maxLon, lon)
      maxLat = Math.max(maxLat, lat)
    }
  }

  features.push({ slug, name, rings })
}

// Equirectangular projection: scale longitude by cos(latitude) so the city
// isn't stretched horizontally, then flip Y (latitude grows north/up, SVG grows
// down). One scale keeps the aspect ratio honest across the whole viewBox.
const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180)
const lonScale = Math.cos(meanLat)
const spanX = (maxLon - minLon) * lonScale
const spanY = maxLat - minLat
const width = 1000
const scale = width / spanX
const height = Math.round(spanY * scale)

const projectX = (lon) => {
  return Number(((lon - minLon) * lonScale * scale).toFixed(1))
}

const projectY = (lat) => {
  return Number(((maxLat - lat) * scale).toFixed(1))
}

// Build one SVG path `d` per neighborhood (every ring as a closed subpath).
const shapes = {}
for (const feature of features) {
  const subpaths = feature.rings.map((ring) => {
    const points = ring.map(([lon, lat]) => `${projectX(lon)},${projectY(lat)}`)

    return `M${points.join('L')}Z`
  })

  shapes[feature.slug] = subpaths.join('')
}

// Adjacency: two neighborhoods touch when they share at least one boundary
// vertex. Rounding to ~1m absorbs floating-point noise while keeping genuinely
// separate borders apart.
const vertexKey = (lon, lat) => {
  return `${lon.toFixed(5)},${lat.toFixed(5)}`
}

const vertexSets = features.map((feature) => {
  const set = new Set()
  for (const ring of feature.rings) {
    for (const [lon, lat] of ring) {
      set.add(vertexKey(lon, lat))
    }
  }

  return { slug: feature.slug, set }
})

const adjacency = {}
for (const feature of features) {
  adjacency[feature.slug] = []
}

for (let left = 0; left < vertexSets.length; left += 1) {
  for (let right = left + 1; right < vertexSets.length; right += 1) {
    const a = vertexSets[left]
    const b = vertexSets[right]
    const touches = [...a.set].some((vertex) => b.set.has(vertex))
    if (touches) {
      adjacency[a.slug].push(b.slug)
      adjacency[b.slug].push(a.slug)
    }
  }
}

for (const slug of Object.keys(adjacency)) {
  adjacency[slug].sort()
}

const output = {
  // A note for anyone opening the file: this is generated, don't hand-edit.
  generatedBy: 'scripts/build-neighborhood-geo.mjs',
  viewBox: `0 0 ${width} ${height}`,
  shapes,
  adjacency,
}

writeFileSync(
  resolve(root, 'src/data/neighborhood-geo.json'),
  `${JSON.stringify(output, null, 2)}\n`,
)

const neighborsCount = Object.values(adjacency).filter((list) => list.length > 0).length
console.log(
  `Wrote ${Object.keys(shapes).length} shapes, ` +
    `${neighborsCount} with neighbors. viewBox ${width}x${height}.`,
)
