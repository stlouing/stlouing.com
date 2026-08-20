// Extracts the Walkable St. Louis corridor polylines from OpenStreetMap (Overpass
// API) into src/data/corridors.json (committed; rerun only when a strip's
// extent changes). For each corridor: resolve the two endpoint intersections
// (nodes shared by the corridor street and a cross street), fetch every highway
// way with the street's name near the extent, project all points onto the
// start->end axis, keep the ones between the endpoints, and average them into
// ~25 m buckets along the axis (which also collapses divided carriageways into
// a single centerline).
//
//   node scripts/fetch-corridors.mjs             # all corridors
//   node scripts/fetch-corridors.mjs bevo demun  # just these, merged into the file
//
// The output is ODbL-attributed OpenStreetMap data; the site's maps already
// carry the OSM credit.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Override with OVERPASS_URL=… when the main instance rate-bans (mirrors:
// overpass.kumi.systems, overpass.osm.ch).
const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'
const OUTPUT_PATH = fileURLToPath(new URL('../src/data/corridors.json', import.meta.url))

// `center` is an approximate corridor midpoint, only used to scope Overpass
// searches. `anchor` is the article heading id the strip links to (update it if
// the heading in walkable-st-louis.md is renamed); `neighborhoods` are the site
// slugs the strip runs through (drives the neighborhood-page cross-links).
const corridors = [
  {
    id: 'the-grove',
    name: 'The Grove',
    street: 'Manchester Avenue',
    streetNames: ['Manchester Avenue'],
    // The strip runs between the two lighted GROVE arches over Manchester. The
    // east one is mapped in OSM (a gantry by Rehab); the west one isn't, so its
    // coord is estimated at the Taylor corner by Platypus.
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
    // West of Nebraska the strip quiets down well before Gravois.
    to: { label: 'Nebraska', names: ['Nebraska Avenue'] },
    center: [38.594, -90.229],
    anchor: 'cherokee-street',
    neighborhoods: ['gravois-park', 'benton-park-west'],
    website: 'https://cherokeestreet.com/',
  },
  {
    // Drawn on the same map figure as `cherokee` (both ids on one placeholder);
    // `label` is the short text drawn along the line there, and the anchor
    // points at the shared "Cherokee Street" section.
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
    // The second Tower Grove South strip, drawn on the same section map as
    // South Grand (both ids on one placeholder).
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
    to: { label: 'Gravois', names: ['Gravois Avenue', 'Eichelberger Street', 'Eichelberger Avenue'] },
    center: [38.583, -90.2935],
    anchor: 'hampton-avenue',
    neighborhoods: ['st-louis-hills', 'southampton', 'princeton-heights'],
  },
  {
    // Southampton's other walkable node, drawn on the same section map as
    // Hampton (both ids on one placeholder).
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
    // Extends northeast of the mill to Delor — the Bosnian bakery/grill cluster
    // (Zlatno Zito, Ehsani's, Majeed) sits between Morganford and Taft.
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
    // Trinity's OSM ways end just shy of Delmar's carriageways (no shared
    // node), so the junction is pinned by coordinate instead.
    from: { label: 'Leland', names: ['Leland Avenue'] },
    // East end trimmed to the block past the Pageant / Delmar Hall — the strip
    // effectively ends there, well before DeBaliviere.
    // Ends just past the Pageant / Delmar Hall block (mid-block; no cross street).
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
    streetNames: ['De Mun Avenue', 'DeMun Avenue', 'Demun Avenue', 'South De Mun Avenue', 'North De Mun Avenue'],
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
    // North end at Blow St, just past Bar:PM — the strip's action stops there.
    from: { label: 'Blow', names: ['Blow Street'] },
    to: { label: 'Steins', names: ['West Steins Street', 'East Steins Street', 'Steins Street'] },
    center: [38.55, -90.247],
    anchor: 'carondelet',
    neighborhoods: ['carondelet', 'patch'],
  },
  {
    // One word historically: the Southtown Famous-Barr gave the corner its name.
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
    // Extended past Marshall so the 7100-7300 blocks (Michael's, Tiffany's) stay on the line.
    to: { label: 'Bellevue', names: ['Bellevue Avenue', 'South Bellevue Avenue'] },
    center: [38.612, -90.32],
    anchor: 'maplewood',
    neighborhoods: ['maplewood'],
    website: 'https://www.maplewoodmo.gov/',
  },
  {
    // Webster Groves' other district, drawn on the same section map as Old
    // Orchard (both ids on one placeholder). Gore Ave is its cross-spine.
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
    // Downtown Kirkwood around the 1893 train station.
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
    // The Park Avenue storefront row facing Lafayette Park.
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
    // Old Webster's cross-spine up Gore (Rolling Ridge Nursery, Telva). Drawn
    // on the Webster Groves map; no neighborhoods so it doesn't duplicate the
    // section's cross-link cards.
    id: 'gore',
    name: 'Gore Avenue',
    label: 'Gore',
    street: 'North Gore Avenue',
    streetNames: ['North Gore Avenue', 'Gore Avenue'],
    from: { label: 'Lockwood', names: ['West Lockwood Avenue', 'East Lockwood Avenue', 'Lockwood Avenue'] },
    to: { label: 'Kirkham', names: ['West Kirkham Avenue', 'East Kirkham Avenue', 'Kirkham Avenue'] },
    center: [38.5945, -90.3596],
    anchor: 'webster-groves',
    neighborhoods: [],
  },
  {
    // Like the Hill, Soulard is a grid; 12th is the representative spine
    // (McGurk's and Pizzeoli sit on it), pins scatter to true positions.
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
    // The Clayton & Tamm junction in Dogtown: Pat Connolly at the Oakland
    // corner, Seamus McDaniel's mid-strip.
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
    // The east-west bar of the Dogtown cross, meeting Tamm at the Clayton &
    // Tamm junction. No neighborhoods so it doesn't duplicate the cross-link.
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
    // Shaw's 39th Street node (TeeRak, Ices Plain & Fancy), running down to
    // the park edge at Magnolia.
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
    // The downtown loft/nightlife strip; Tucker (12th) is the Downtown /
    // Downtown West line, so the extent spans both.
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
    // The Old Orchard business district of Webster Groves.
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
        // overpass-api.de rejects UA-less requests (406); identify ourselves.
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
      // A 200 with a remark and no elements is a soft failure (server-side
      // kill timer under load) — retry it like an error status.
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

// Nodes shared by the corridor street and one cross street = the intersection.
// Divided junctions share several nodes; average them into one point. An
// endpoint with a `coord` falls back to it when no shared node exists — or is
// taken directly when it has no cross-street names at all (e.g. the Grove's
// arches, which sit mid-block).
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

// Equirectangular meters around the corridor midpoint — plenty for <5 km spans.
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

  // Pin the drawn line exactly to the resolved intersections.
  line[0] = [start.lng, start.lat]
  line[line.length - 1] = [end.lng, end.lat]

  return {
    line: line.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
    lengthMeters: Math.round(axisLength),
  }
}

// With ids as arguments, only those corridors are re-fetched; everything else
// is carried over from the existing corridors.json.
const onlyIds = process.argv.slice(2)
const targets = onlyIds.length > 0 ? corridors.filter((corridor) => onlyIds.includes(corridor.id)) : corridors

const existing = new Map()
if (onlyIds.length > 0) {
  try {
    for (const entry of JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')).corridors) {
      existing.set(entry.id, entry)
    }
  } catch {
    // No prior file — full fetch semantics.
  }
}

const problems = []

for (const corridor of targets) {
  console.log(`\n${corridor.name} (${corridor.street}, ${corridor.from.label} -> ${corridor.to.label})`)

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
  console.log(`  ${points.length} raw points -> ${built.line.length} line points, ~${miles} mi end to end`)

  existing.set(corridor.id, {
    id: corridor.id,
    name: corridor.name,
    // Optional fields; JSON.stringify drops the undefined ones.
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

// Emit in canonical corridor order regardless of fetch order.
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
