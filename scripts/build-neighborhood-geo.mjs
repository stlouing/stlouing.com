import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NEIGHBORHOOD_BOUNDARIES_FILE } from '../site.config.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const { values: options } = parseArgs({
  options: {
    boundaries: { type: 'string', default: `public/${NEIGHBORHOOD_BOUNDARIES_FILE}` },
    'number-property': { type: 'string', default: 'NHD_NUM' },
    width: { type: 'string', default: '1000' },
  },
})

const geojson = JSON.parse(readFileSync(resolve(root, options.boundaries), 'utf8'))
const neighborhoods = JSON.parse(readFileSync(resolve(root, 'src/data/neighborhoods.json'), 'utf8'))

const drawnNeighborhoods = neighborhoods.filter(
  (neighborhood) => !neighborhood.ignored && !neighborhood.coords,
)
const pointNumbers = new Set(
  neighborhoods
    .filter((neighborhood) => neighborhood.coords)
    .map((neighborhood) => Number(neighborhood.number)),
)
const slugByNumber = new Map(
  drawnNeighborhoods.map((neighborhood) => [Number(neighborhood.number), neighborhood.slug]),
)

const ringsOf = (geometry) => {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat()
  }

  return []
}

const features = []
const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }

for (const feature of geojson.features) {
  const number = Number(feature.properties?.[options['number-property']])
  if (pointNumbers.has(number)) {
    continue
  }

  const slug = slugByNumber.get(number)
  if (!slug) {
    console.warn(`No neighborhood numbered ${number} in neighborhoods.json, skipped.`)
    continue
  }

  const rings = ringsOf(feature.geometry)
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      bounds.west = Math.min(bounds.west, longitude)
      bounds.south = Math.min(bounds.south, latitude)
      bounds.east = Math.max(bounds.east, longitude)
      bounds.north = Math.max(bounds.north, latitude)
    }
  }

  features.push({ slug, rings })
}

const longitudeScale = Math.cos(((bounds.south + bounds.north) / 2) * (Math.PI / 180))
const width = Number(options.width)
const scale = width / ((bounds.east - bounds.west) * longitudeScale)
const height = Math.round((bounds.north - bounds.south) * scale)

const projectX = (longitude) => {
  return Number(((longitude - bounds.west) * longitudeScale * scale).toFixed(1))
}

const projectY = (latitude) => {
  return Number(((bounds.north - latitude) * scale).toFixed(1))
}

const shapes = {}
for (const feature of features) {
  const subpaths = feature.rings.map((ring) => {
    const points = ring.map(
      ([longitude, latitude]) => `${projectX(longitude)},${projectY(latitude)}`,
    )

    return `M${points.join('L')}Z`
  })

  shapes[feature.slug] = subpaths.join('')
}

const vertexKey = (longitude, latitude) => {
  return `${longitude.toFixed(5)},${latitude.toFixed(5)}`
}

const vertexSets = features.map((feature) => {
  const vertices = new Set()
  for (const ring of feature.rings) {
    for (const [longitude, latitude] of ring) {
      vertices.add(vertexKey(longitude, latitude))
    }
  }

  return { slug: feature.slug, vertices }
})

const adjacency = Object.fromEntries(features.map((feature) => [feature.slug, []]))

for (let leftIndex = 0; leftIndex < vertexSets.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < vertexSets.length; rightIndex += 1) {
    const left = vertexSets[leftIndex]
    const right = vertexSets[rightIndex]
    const touches = [...left.vertices].some((vertex) => right.vertices.has(vertex))
    if (touches) {
      adjacency[left.slug].push(right.slug)
      adjacency[right.slug].push(left.slug)
    }
  }
}

for (const slug of Object.keys(adjacency)) {
  adjacency[slug].sort()
}

const output = {
  generatedBy: 'scripts/build-neighborhood-geo.mjs',
  viewBox: `0 0 ${width} ${height}`,
  shapes,
  adjacency,
}

writeFileSync(
  resolve(root, 'src/data/neighborhood-geo.json'),
  `${JSON.stringify(output, null, 2)}\n`,
)

const withNeighbors = Object.values(adjacency).filter((list) => list.length > 0).length
console.log(
  `Wrote ${Object.keys(shapes).length} shapes, ${withNeighbors} with neighbors. viewBox ${width}x${height}.`,
)
