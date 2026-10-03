import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'
const OUTPUT_PATH = fileURLToPath(new URL('../src/data/corridors.json', import.meta.url))

const corridors = [
  {
    id: 'the-grove',
    name: 'The Grove',
    street: 'Manchester Avenue',
    streetNames: ['Manchester Avenue'],
    from: { label: 'west arch', coord: [38.62625, -90.2621] },
    to: { label: 'east arch', coord: [38.627942, -90.24989] },
    center: [38.627, -90.2565],
    anchor: 'the-grove',
    neighborhoods: ['the-grove'],
    website: 'https://www.thegrovestl.com/',
  },
  {
    id: 'cherokee',
    name: 'Cherokee Street',
    street: 'Cherokee Street',
    streetNames: ['Cherokee Street'],
    from: { label: 'Jefferson', names: ['South Jefferson Avenue', 'Jefferson Avenue'] },
    to: { label: 'Nebraska', names: ['Nebraska Avenue'] },
    center: [38.594, -90.229],
    anchor: 'cherokee-street',
    neighborhoods: ['gravois-park', 'benton-park-west'],
    website: 'https://cherokeestreet.com/',
  },
  {
    id: 'cherokee-antique-row',
    name: 'Cherokee Antique Row',
    label: 'Antique Row',
    street: 'Cherokee Street',
    streetNames: ['Cherokee Street'],
    from: { label: 'Lemp', names: ['Lemp Avenue', 'South Lemp Avenue'] },
    to: { label: 'Jefferson', names: ['South Jefferson Avenue', 'Jefferson Avenue'] },
    center: [38.594, -90.221],
    anchor: 'cherokee-street',
    neighborhoods: ['benton-park', 'marine-villa'],
  },
  {
    id: 'euclid',
    name: 'Euclid Avenue',
    street: 'Euclid Avenue',
    streetNames: ['North Euclid Avenue', 'South Euclid Avenue', 'Euclid Avenue'],
    from: { label: 'Laclede', names: ['Laclede Avenue'] },
    to: { label: 'Delmar', names: ['Delmar Boulevard'] },
    center: [38.64, -90.261],
    anchor: 'central-west-end',
    neighborhoods: ['central-west-end'],
    website: 'https://cwescene.com/',
  },
  {
    id: 'south-grand',
    name: 'South Grand',
    street: 'Grand Boulevard',
    streetNames: ['South Grand Boulevard', 'South Grand Avenue'],
    from: { label: 'Arsenal', names: ['Arsenal Street'] },
    to: { label: 'Utah', names: ['Utah Street', 'Utah Place'] },
    center: [38.5965, -90.2438],
    anchor: 'tower-grove-south',
    neighborhoods: ['tower-grove-south', 'tower-grove-east'],
  },
  {
    id: 'morganford',
    name: 'Morganford',
    street: 'Morganford Road',
    streetNames: ['Morganford Road', 'Morgan Ford Road'],
    from: { label: 'Arsenal', names: ['Arsenal Street'] },
    to: { label: 'Utah', names: ['Utah Street', 'Utah Place'] },
    center: [38.5965, -90.2565],
    anchor: 'tower-grove-south',
    neighborhoods: ['tower-grove-south'],
  },
  {
    id: 'hampton',
    name: 'Hampton Avenue',
    street: 'Hampton Avenue',
    streetNames: ['Hampton Avenue', 'South Hampton Avenue'],
    from: { label: 'Chippewa', names: ['Chippewa Street', 'Chippewa Avenue'] },
    to: {
      label: 'Gravois',
      names: ['Gravois Avenue', 'Eichelberger Street', 'Eichelberger Avenue'],
    },
    center: [38.583, -90.2935],
    anchor: 'hampton-avenue',
    neighborhoods: ['st-louis-hills', 'southampton', 'princeton-heights'],
  },
  {
    id: 'macklind',
    name: 'Macklind',
    street: 'Macklind Avenue',
    streetNames: ['Macklind Avenue', 'South Macklind Avenue'],
    from: { label: 'Lansdowne', names: ['Lansdowne Avenue'] },
    to: { label: 'Nottingham', names: ['Nottingham Avenue'] },
    center: [38.589, -90.2846],
    anchor: 'hampton-avenue',
    neighborhoods: ['southampton'],
  },
  {
    id: 'the-hill',
    name: 'The Hill',
    street: 'Marconi Avenue',
    streetNames: ['Marconi Avenue'],
    from: { label: 'Shaw', names: ['Shaw Avenue'] },
    to: { label: 'Elizabeth', names: ['Elizabeth Avenue'] },
    center: [38.614, -90.276],
    anchor: 'the-hill',
    neighborhoods: ['the-hill'],
    website: 'https://www.hillstl.org/',
  },
  {
    id: 'bevo',
    name: 'Bevo',
    street: 'Gravois Avenue',
    streetNames: ['Gravois Avenue', 'Gravois Road'],
    from: { label: 'Taft', names: ['Taft Avenue'] },
    to: { label: 'Christy', names: ['Christy Boulevard', 'Christy Avenue'] },
    center: [38.581, -90.269],
    anchor: 'bevo',
    neighborhoods: ['bevo-mill'],
  },
  {
    id: 'delmar-loop',
    name: 'The Delmar Loop',
    street: 'Delmar Boulevard',
    streetNames: ['Delmar Boulevard'],
    from: { label: 'Leland', names: ['Leland Avenue'] },
    to: { label: 'the Pageant', coord: [38.65513, -90.2965] },
    center: [38.656, -90.304],
    anchor: 'the-delmar-loop',
    neighborhoods: ['university-city', 'delmar-loop'],
    website: 'https://visittheloop.com/',
  },
  {
    id: 'demun',
    name: 'DeMun',
    street: 'DeMun Avenue',
    streetNames: [
      'De Mun Avenue',
      'DeMun Avenue',
      'Demun Avenue',
      'South De Mun Avenue',
      'North De Mun Avenue',
    ],
    from: { label: 'Northwood', names: ['Northwood Avenue'] },
    to: { label: 'Southwood', names: ['Southwood Avenue'] },
    center: [38.642, -90.3167],
    anchor: 'demun',
    neighborhoods: ['clayton'],
  },
  {
    id: 'carondelet',
    name: 'Carondelet',
    street: 'South Broadway',
    streetNames: ['South Broadway'],
    from: { label: 'Blow', names: ['Blow Street'] },
    to: { label: 'Steins', names: ['West Steins Street', 'East Steins Street', 'Steins Street'] },
    center: [38.55, -90.247],
    anchor: 'carondelet',
    neighborhoods: ['carondelet', 'patch'],
  },
  {
    id: 'south-town',
    name: 'Southtown',
    street: 'South Kingshighway',
    streetNames: ['South Kingshighway Boulevard', 'Kingshighway Boulevard'],
    from: { label: 'Fyler', names: ['Fyler Avenue', 'Arsenal Street'] },
    to: { label: 'Devonshire', names: ['Devonshire Avenue'] },
    center: [38.594, -90.2646],
    anchor: 'southtown',
    neighborhoods: ['north-hampton', 'southampton', 'tower-grove-south'],
  },
  {
    id: 'maplewood',
    name: 'Maplewood',
    street: 'Manchester Road',
    streetNames: ['Manchester Road', 'Manchester Avenue'],
    from: { label: 'Big Bend', names: ['South Big Bend Boulevard', 'Big Bend Boulevard'] },
    to: { label: 'Bellevue', names: ['Bellevue Avenue', 'South Bellevue Avenue'] },
    center: [38.612, -90.32],
    anchor: 'maplewood',
    neighborhoods: ['maplewood'],
    website: 'https://www.maplewoodmo.gov/',
  },
  {
    id: 'old-webster',
    name: 'Old Webster',
    street: 'Lockwood Avenue',
    streetNames: ['West Lockwood Avenue', 'East Lockwood Avenue', 'Lockwood Avenue'],
    from: { label: 'Jefferson', names: ['Jefferson Road'] },
    to: { label: 'Maple', names: ['North Maple Avenue', 'South Maple Avenue'] },
    center: [38.592, -90.357],
    anchor: 'webster-groves',
    neighborhoods: ['webster-groves'],
    website: 'https://www.webstergrovesmo.gov/',
  },
  {
    id: 'kirkwood',
    name: 'Kirkwood',
    street: 'Kirkwood Road',
    streetNames: ['North Kirkwood Road', 'South Kirkwood Road', 'Kirkwood Road'],
    from: { label: 'Bodley', names: ['East Bodley Avenue', 'West Bodley Avenue'] },
    to: { label: 'Monroe', names: ['West Monroe Avenue', 'East Monroe Avenue'] },
    center: [38.583, -90.4068],
    anchor: 'kirkwood',
    neighborhoods: ['kirkwood'],
    website: 'https://www.downtownkirkwood.com/',
  },
  {
    id: 'lafayette-square',
    name: 'Lafayette Square',
    street: 'Park Avenue',
    streetNames: ['Park Avenue'],
    from: { label: 'Mississippi', names: ['Mississippi Avenue'] },
    to: { label: '18th', names: ['South 18th Street', '18th Street'] },
    center: [38.6155, -90.2125],
    anchor: 'lafayette-square',
    neighborhoods: ['lafayette-square'],
    website: 'https://lafayettesquare.org/',
  },
  {
    id: 'gore',
    name: 'Gore Avenue',
    label: 'Gore',
    street: 'North Gore Avenue',
    streetNames: ['North Gore Avenue', 'Gore Avenue'],
    from: {
      label: 'Lockwood',
      names: ['West Lockwood Avenue', 'East Lockwood Avenue', 'Lockwood Avenue'],
    },
    to: {
      label: 'Kirkham',
      names: ['West Kirkham Avenue', 'East Kirkham Avenue', 'Kirkham Avenue'],
    },
    center: [38.5945, -90.3596],
    anchor: 'webster-groves',
    neighborhoods: [],
  },
  {
    id: 'soulard',
    name: 'Soulard',
    street: 'South 12th Street',
    streetNames: ['South 12th Street'],
    from: { label: 'Shenandoah', names: ['Shenandoah Avenue'] },
    to: { label: 'Gravois', coord: [38.61013, -90.20861] },
    center: [38.6075, -90.2103],
    anchor: 'soulard',
    neighborhoods: ['soulard'],
    website: 'https://www.soulard.org/',
  },
  {
    id: 'dogtown',
    name: 'Dogtown',
    street: 'Tamm Avenue',
    streetNames: ['Tamm Avenue'],
    from: { label: 'Oakland', names: ['Oakland Avenue'] },
    to: { label: 'Mitchell', names: ['Mitchell Place', 'Mitchell Avenue'] },
    center: [38.629, -90.2927],
    anchor: 'dogtown',
    neighborhoods: ['dogtown'],
  },
  {
    id: 'dogtown-clayton',
    name: 'Dogtown',
    label: 'Clayton Ave',
    street: 'Clayton Avenue',
    streetNames: ['Clayton Avenue'],
    from: { label: 'Childress', names: ['Childress Avenue'] },
    to: { label: 'Graham', names: ['Graham Street', 'Graham Avenue'] },
    center: [38.6286, -90.2922],
    anchor: 'dogtown',
    neighborhoods: [],
  },
  {
    id: 'shaw',
    name: 'Shaw',
    street: 'South 39th Street',
    streetNames: ['South 39th Street', '39th Street'],
    from: { label: 'Shaw', names: ['Shaw Boulevard'] },
    to: { label: 'Magnolia', names: ['Magnolia Avenue'] },
    center: [38.61, -90.2459],
    anchor: 'shaw',
    neighborhoods: ['shaw'],
  },
  {
    id: 'washington-avenue',
    name: 'Washington Avenue',
    street: 'Washington Avenue',
    streetNames: ['Washington Avenue'],
    from: { label: '6th', names: ['North 6th Street', '6th Street'] },
    to: { label: '18th', names: ['North 18th Street', '18th Street'] },
    center: [38.631, -90.197],
    anchor: 'washington-avenue',
    neighborhoods: ['downtown', 'downtown-west'],
    website: 'https://www.washaveretail.com/',
  },
  {
    id: 'ballpark-village',
    name: 'Ballpark Village',
    street: 'Clark Avenue',
    streetNames: ['Clark Avenue', 'Clark Street'],
    from: { label: '8th', names: ['South 8th Street', '8th Street'] },
    to: { label: 'Broadway', names: ['South Broadway', 'Broadway'] },
    center: [38.6237, -90.1905],
    anchor: 'ballpark-village',
    neighborhoods: ['downtown'],
    website: 'https://www.stlballparkvillage.com/',
  },
  {
    id: 'big-bend',
    name: 'Old Orchard',
    street: 'Big Bend Boulevard',
    streetNames: ['Big Bend Boulevard', 'South Big Bend Boulevard'],
    from: { label: 'Lockwood', names: ['East Lockwood Avenue', 'Lockwood Avenue'] },
    to: { label: 'Oakwood', names: ['Oakwood Avenue', 'Laclede Station Road'] },
    center: [38.603, -90.348],
    anchor: 'webster-groves',
    neighborhoods: ['webster-groves'],
    website: 'https://www.oldorchardwebstergroves.com/',
  },
]

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function overpass(query) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response
    try {
      response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'stlouing-corridors/1.0 (street extract for stlouing.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
    } catch (error) {
      console.warn(`  network error (${error.message}), attempt ${attempt}/3`)
      await sleep(10000 * attempt)
      continue
    }

    if (response.ok) {
      const result = await response.json()
      if (result.elements.length === 0 && result.remark) {
        console.warn(`  overpass remark (${result.remark.slice(0, 60)}…), attempt ${attempt}/3`)
        await sleep(8000 * attempt)
        continue
      }

      return result
    }

    console.warn(`  overpass ${response.status}, attempt ${attempt}/3 — backing off`)
    await sleep(8000 * attempt)
  }

  throw new Error('Overpass kept failing')
}

const nameRegex = (names) => `^(${names.join('|')})$`
const bboxAround = ([lat, lng], margin) =>
  `${lat - margin},${lng - margin * 1.25},${lat + margin},${lng + margin * 1.25}`

async function resolveEndpoint(corridor, endpoint) {
  if (!endpoint.names && endpoint.coord) {
    const [lat, lng] = endpoint.coord

    return { lat, lng, nodeCount: 0 }
  }

  const bbox = bboxAround(corridor.center, 0.04)
  const query = `[out:json][timeout:30];
way["highway"]["highway"!~"_link"]["name"~"${nameRegex(corridor.streetNames)}"](${bbox});
node(w)->.street_nodes;
way["highway"]["highway"!~"_link"]["name"~"${nameRegex(endpoint.names)}"](${bbox});
node(w)->.cross_nodes;
node.street_nodes.cross_nodes;
out;`

  const result = await overpass(query)
  const nodes = result.elements.filter((element) => element.type === 'node')

  if (nodes.length === 0) {
    if (endpoint.coord) {
      const [lat, lng] = endpoint.coord

      return { lat, lng, nodeCount: 0 }
    }

    return null
  }

  const lat = nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length
  const lng = nodes.reduce((sum, node) => sum + node.lon, 0) / nodes.length

  return { lat, lng, nodeCount: nodes.length }
}

async function fetchStreetPoints(corridor, start, end) {
  const south = Math.min(start.lat, end.lat) - 0.004
  const north = Math.max(start.lat, end.lat) + 0.004
  const west = Math.min(start.lng, end.lng) - 0.005
  const east = Math.max(start.lng, end.lng) + 0.005
  const query = `[out:json][timeout:30];
way["highway"]["highway"!~"_link"]["name"~"${nameRegex(corridor.streetNames)}"](${south},${west},${north},${east});
out geom;`

  const result = await overpass(query)
  const points = []
  for (const element of result.elements) {
    if (element.type === 'way' && element.geometry) {
      points.push(...element.geometry)
    }
  }

  return points
}

function metricProjector(latitudeOrigin) {
  const metersPerLat = 110970
  const metersPerLng = Math.cos((latitudeOrigin * Math.PI) / 180) * 111320

  return (point) => ({ x: point.lon * metersPerLng, y: point.lat * metersPerLat })
}

function buildLine(points, start, end) {
  const project = metricProjector((start.lat + end.lat) / 2)
  const startXY = project({ lon: start.lng, lat: start.lat })
  const endXY = project({ lon: end.lng, lat: end.lat })
  const axis = { x: endXY.x - startXY.x, y: endXY.y - startXY.y }
  const axisLength = Math.hypot(axis.x, axis.y)
  const tolerance = 10 / axisLength

  const buckets = new Map()
  for (const point of points) {
    const projected = project(point)
    const relative = { x: projected.x - startXY.x, y: projected.y - startXY.y }
    const along = (relative.x * axis.x + relative.y * axis.y) / (axisLength * axisLength)
    const perpendicular = Math.abs(relative.x * axis.y - relative.y * axis.x) / axisLength

    if (along < -tolerance || along > 1 + tolerance || perpendicular > 300) {
      continue
    }

    const bucketIndex = Math.round((along * axisLength) / 25)
    const bucket = buckets.get(bucketIndex) ?? { lat: 0, lng: 0, count: 0 }
    bucket.lat += point.lat
    bucket.lng += point.lon
    bucket.count += 1
    buckets.set(bucketIndex, bucket)
  }

  const line = [...buckets.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, bucket]) => [bucket.lng / bucket.count, bucket.lat / bucket.count])

  if (line.length < 3) {
    return null
  }

  line[0] = [start.lng, start.lat]
  line[line.length - 1] = [end.lng, end.lat]

  return {
    line: line.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
    lengthMeters: Math.round(axisLength),
  }
}

const onlyIds = process.argv.slice(2)
const targets =
  onlyIds.length > 0 ? corridors.filter((corridor) => onlyIds.includes(corridor.id)) : corridors

const existing = new Map()
if (onlyIds.length > 0) {
  try {
    for (const entry of JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')).corridors) {
      existing.set(entry.id, entry)
    }
  } catch {}
}

const problems = []

for (const corridor of targets) {
  console.log(
    `\n${corridor.name} (${corridor.street}, ${corridor.from.label} -> ${corridor.to.label})`,
  )

  const start = await resolveEndpoint(corridor, corridor.from)
  await sleep(2500)
  const end = await resolveEndpoint(corridor, corridor.to)
  await sleep(2500)

  if (!start || !end) {
    problems.push(`${corridor.id}: unresolved endpoint (start=${!!start}, end=${!!end})`)
    console.log('  FAILED to resolve endpoints')
    continue
  }

  console.log(
    `  start ${start.lat.toFixed(5)},${start.lng.toFixed(5)} (${start.nodeCount} nodes)` +
      ` | end ${end.lat.toFixed(5)},${end.lng.toFixed(5)} (${end.nodeCount} nodes)`,
  )

  const points = await fetchStreetPoints(corridor, start, end)
  await sleep(2500)
  const built = buildLine(points, start, end)

  if (!built) {
    problems.push(`${corridor.id}: too few points (${points.length} raw)`)
    console.log(`  FAILED to build line from ${points.length} raw points`)
    continue
  }

  const miles = (built.lengthMeters / 1609.34).toFixed(2)
  console.log(
    `  ${points.length} raw points -> ${built.line.length} line points, ~${miles} mi end to end`,
  )

  existing.set(corridor.id, {
    id: corridor.id,
    name: corridor.name,
    label: corridor.label,
    street: corridor.street,
    from: corridor.from.label,
    to: corridor.to.label,
    anchor: corridor.anchor,
    neighborhoods: corridor.neighborhoods,
    website: corridor.website,
    line: built.line,
  })
}

const output = corridors.map((corridor) => existing.get(corridor.id)).filter(Boolean)

writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      source: 'Street geometry extracted from OpenStreetMap via the Overpass API (ODbL)',
      corridors: output,
    },
    null,
    2,
  )}\n`,
)

console.log(`\nWrote ${output.length}/${corridors.length} corridors to ${OUTPUT_PATH}`)
if (problems.length > 0) {
  console.log('Problems:')
  for (const problem of problems) {
    console.log(`  - ${problem}`)
  }
  process.exitCode = 1
}
