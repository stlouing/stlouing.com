import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import corridorData from '../data/corridors.json'
import corridorSpots from '../data/corridor-spots.json'

const SOURCE_ID = 'corridor'
const LINE_LAYER_ID = 'corridor-line'
const ENDPOINTS_SOURCE_ID = 'corridor-endpoints'
const ENDPOINTS_LAYER_ID = 'corridor-endpoint-dots'
const LABELS_SOURCE_ID = 'corridor-labels'
const LABELS_LAYER_ID = 'corridor-label-text'

// Walkable St. Louis article figures: one small basemap per placeholder with
// the street segment drawn as a bold line, dots marking its start and end. A
// placeholder may list several corridor ids (space-separated) to draw them on
// one shared map — e.g. Cherokee's main strip + Antique Row — in which case
// each segment also gets a text label (`label`, falling back to `name`).
// Geometry is extracted from OpenStreetMap (ODbL) — see src/data/corridors.json.
interface Corridor {
  id: string
  name: string
  label?: string
  street: string
  from: string
  to: string
  anchor: string
  neighborhoods: string[]
  line: number[][]
}

const corridors = new Map<string, Corridor>(
  (corridorData.corridors as Corridor[]).map((corridor) => [corridor.id, corridor]),
)

// Hand-picked spots along a strip (src/data/corridor-spots.json, keyed by
// corridor id): a dot + name marker on the strip's map, linking to the spot's
// page when it has one. Coords are [lng, lat] like the corridor lines (note:
// food frontmatter stores [lat, lng] — flip when copying from there).
interface Spot {
  name: string
  coords: number[]
  link?: string
}

const spotsByCorridor = corridorSpots as Record<string, Spot[]>

// The same teardrop pin the neighborhood map uses (padded viewBox so the ring
// stroke isn't clipped); `currentColor` fill — the pin color (and its theme
// swap) comes from the `.corridor-spot` CSS.
const pinSvg = `<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="currentColor" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>`

// Spot coords are building positions (review frontmatter / OSM POIs), often a
// storefront-depth off the street centerline — visible as a zigzag on short,
// tightly-zoomed strips like DeMun. Snap each pin onto the nearest point of
// the strip's line when it's within a storefront's distance; anything farther
// is genuinely off-strip and keeps its true position.
const SNAP_METERS = 75

function snapToLines(point: [number, number], group: Corridor[]): [number, number] {
  const metersPerLng = Math.cos((point[1] * Math.PI) / 180) * 111320
  const metersPerLat = 110970
  let best: [number, number] = point
  let bestDistance = Infinity

  for (const corridor of group) {
    const line = corridor.line
    for (let index = 0; index < line.length - 1; index += 1) {
      const [startLng, startLat] = line[index]
      const [endLng, endLat] = line[index + 1]
      const segmentX = (endLng - startLng) * metersPerLng
      const segmentY = (endLat - startLat) * metersPerLat
      const pointX = (point[0] - startLng) * metersPerLng
      const pointY = (point[1] - startLat) * metersPerLat
      const lengthSquared = segmentX * segmentX + segmentY * segmentY
      const along =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / lengthSquared))
      const distance = Math.hypot(pointX - along * segmentX, pointY - along * segmentY)

      if (distance < bestDistance) {
        bestDistance = distance
        best = [startLng + (endLng - startLng) * along, startLat + (endLat - startLat) * along]
      }
    }
  }

  return bestDistance <= SNAP_METERS ? best : point
}

function addSpotMarkers(map: MapLibreMap, group: Corridor[]): void {
  for (const corridor of group) {
    const spots = spotsByCorridor[corridor.id] ?? []
    if (spots.length === 0) {
      continue
    }
    // Orientation per corridor, not per map: two parallel north-south strips
    // (Tower Grove South) make a WIDE combined bbox, but each line is still
    // vertical and needs sideways pins.
    const horizontal = isMostlyNorthSouth([corridor])

    for (const spot of spots) {
      const element = document.createElement(spot.link ? 'a' : 'span')
      element.className = horizontal ? 'corridor-spot is-horizontal' : 'corridor-spot'
      element.setAttribute('aria-label', spot.name)
      if (spot.link && element instanceof HTMLAnchorElement) {
        element.href = import.meta.env.BASE_URL.replace(/\/$/, '') + spot.link
      }

      element.innerHTML = pinSvg
      // The name renders as a hover/focus tooltip above the pin (always-visible
      // labels overlapped when spots cluster).
      const name = document.createElement('span')
      name.className = 'corridor-spot-name'
      name.textContent = spot.name
      element.append(name)

      new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat(snapToLines(spot.coords as [number, number], [corridor]))
        .addTo(map)
    }
  }
}

function corridorsFor(element: HTMLElement): Corridor[] {
  const ids = (element.dataset.corridorMap ?? '').split(/\s+/).filter(Boolean)

  return ids.flatMap((id) => {
    const corridor = corridors.get(id)

    return corridor ? [corridor] : []
  })
}

function boundsOf(group: Corridor[]): LngLatBoundsLike {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const corridor of group) {
    for (const [lng, lat] of corridor.line) {
      west = Math.min(west, lng)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      north = Math.max(north, lat)
    }
  }

  return [
    [west, south],
    [east, north],
  ]
}

// On a mostly north-south strip (Grand, Hampton, Euclid…) an upright pin's
// body stands right on top of the vertical line; those maps lay their pins
// sideways instead, so only the tip touches the line.
function isMostlyNorthSouth(group: Corridor[]): boolean {
  const [[west, south], [east, north]] = boundsOf(group) as [[number, number], [number, number]]
  const metersPerDegree = Math.cos((((south + north) / 2) * Math.PI) / 180)

  return north - south > (east - west) * metersPerDegree
}

// Line color from the map tokens so the figures follow the light/dark theme;
// the halo separates the endpoint dots and label text from what's beneath them.
function readCorridorColors(): { line: string; halo: string } {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback

  return {
    line: readColor('--color-map-corridor', '#c0392b'),
    halo: readColor('--color-background', '#f3efe7'),
    label: readColor('--color-text', '#1b1a17'),
  }
}

function applyCorridorLayers(map: MapLibreMap, group: Corridor[]): void {
  const colors = readCorridorColors()
  const labeled = group.length > 1

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.map((corridor) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: corridor.line },
        })),
      },
    })

    map.addSource(ENDPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.flatMap((corridor) =>
          [corridor.line[0], corridor.line[corridor.line.length - 1]].map((point) => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: point },
          })),
        ),
      },
    })

    if (labeled) {
      // One label per segment, floated above its midpoint.
      map.addSource(LABELS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: group.map((corridor) => ({
            type: 'Feature',
            properties: { label: corridor.label ?? corridor.name },
            geometry: {
              type: 'Point',
              coordinates: corridor.line[Math.floor(corridor.line.length / 2)],
            },
          })),
        },
      })
    }
  }

  if (map.getLayer(LINE_LAYER_ID)) {
    map.setPaintProperty(LINE_LAYER_ID, 'line-color', colors.line)
    map.setPaintProperty(ENDPOINTS_LAYER_ID, 'circle-color', colors.line)
    map.setPaintProperty(ENDPOINTS_LAYER_ID, 'circle-stroke-color', colors.halo)
    if (map.getLayer(LABELS_LAYER_ID)) {
      map.setPaintProperty(LABELS_LAYER_ID, 'text-color', colors.label)
      map.setPaintProperty(LABELS_LAYER_ID, 'text-halo-color', colors.halo)
    }

    return
  }

  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colors.line, 'line-width': 4, 'line-opacity': 0.75 },
  })

  map.addLayer({
    id: ENDPOINTS_LAYER_ID,
    type: 'circle',
    source: ENDPOINTS_SOURCE_ID,
    paint: {
      'circle-radius': 4.5,
      'circle-color': colors.line,
      'circle-stroke-color': colors.halo,
      'circle-stroke-width': 1.5,
    },
  })

  if (labeled) {
    map.addLayer({
      id: LABELS_LAYER_ID,
      type: 'symbol',
      source: LABELS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        // A font stack the Protomaps basemap glyphs actually ship.
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -0.6],
      },
      paint: { 'text-color': colors.label, 'text-halo-color': colors.halo, 'text-halo-width': 1.5 },
    })
  }
}

// A generated figcaption naming the pinned spots — the visible, touch-friendly
// twin of the hover tooltips, linked where a spot has a page.
function appendSpotCaption(element: HTMLElement, group: Corridor[]): void {
  const spots = group.flatMap((corridor) => spotsByCorridor[corridor.id] ?? [])
  const figure = element.closest('figure')
  if (spots.length === 0 || !figure || figure.querySelector('.corridor-map-caption')) {
    return
  }

  const caption = document.createElement('figcaption')
  caption.className = 'corridor-map-caption'
  spots.forEach((spot, index) => {
    if (index > 0) {
      caption.append(' | ')
    }
    if (spot.link) {
      const anchor = document.createElement('a')
      anchor.href = import.meta.env.BASE_URL.replace(/\/$/, '') + spot.link
      anchor.textContent = spot.name
      caption.append(anchor)
    } else {
      caption.append(spot.name)
    }
  })
  figure.append(caption)
}

// A mounted figure and what teardown must release.
interface MountedMap {
  map: MapLibreMap
  disposeTheme: () => void
}

// The camera frame for a section map: the corridor lines PLUS the section's
// pins, so a spot set back from the strip (Soulard's grid bars) can't fall
// outside the visible frame.
function figureBounds(group: Corridor[]): LngLatBoundsLike {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  const extend = ([lng, lat]: number[]) => {
    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  }

  for (const corridor of group) {
    corridor.line.forEach(extend)
    for (const spot of spotsByCorridor[corridor.id] ?? []) {
      extend(spot.coords)
    }
  }

  return [
    [west, south],
    [east, north],
  ]
}

function mountCorridorMap(element: HTMLElement, group: Corridor[]): MountedMap {
  const map = createBasemapMap(element, {
    // A figure, not an explorer: no pan/zoom, so scrolling the article never
    // fights the map.
    interactive: false,
    attributionControl: { compact: true },
  })

  map.on('load', () => {
    applyCorridorLayers(map, group)
    // Half a zoom level looser than a tight fit — the frame already includes
    // the section's pins, so it only needs a little extra street-grid context.
    const camera = map.cameraForBounds(figureBounds(group), { padding: 36 })
    if (camera) {
      map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 14) - 0.25 })
    }
  })

  // DOM markers, so they stay clickable on this non-interactive map.
  addSpotMarkers(map, group)
  appendSpotCaption(element, group)

  // Re-apply after a theme toggle swaps the basemap style (the pins recolor
  // themselves — their fill is a CSS token).
  const disposeTheme = watchThemeChanges(map, () => {
    applyCorridorLayers(map, group)
  })

  return { map, disposeTheme }
}

const OVERVIEW_BOUNDARIES_SOURCE_ID = 'corridor-overview-boundaries'
const OVERVIEW_FILL_LAYER_ID = 'corridor-overview-fill'
const OVERVIEW_OUTLINE_LAYER_ID = 'corridor-overview-outline'
const OVERVIEW_HIT_LAYER_ID = 'corridor-overview-hit'

const siteSlugByCitySlug: Record<string, string> = {
  'forest-park-southeast': 'the-grove',
  'skinker-debaliviere': 'delmar-loop',
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface BoundaryFeature {
  type: 'Feature'
  properties: Record<string, unknown> | null
  geometry: { type: string; coordinates: unknown }
}

async function loadInvolvedBoundaries(group: Corridor[]): Promise<BoundaryFeature[]> {
  const wanted = new Set(group.flatMap((corridor) => corridor.neighborhoods ?? []))

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    const boundaries = (await response.json()) as { features: BoundaryFeature[] }

    return boundaries.features.filter((feature) => {
      const citySlug = slugify(String(feature.properties?.NHD_NAME ?? ''))

      return wanted.has(siteSlugByCitySlug[citySlug] ?? citySlug)
    })
  } catch {
    return []
  }
}

function applyOverviewLayers(
  map: MapLibreMap,
  group: Corridor[],
  boundaries: BoundaryFeature[],
): void {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback
  const lineColor = readColor('--color-map-corridor', '#c0392b')
  const polygonColor = readColor('--color-map-accent', '#6a47a6')
  const haloColor = readColor('--color-background', '#f3efe7')
  const labelColor = readColor('--color-text', '#1b1a17')

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(OVERVIEW_BOUNDARIES_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: boundaries as never },
    })
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.map((corridor) => ({
          type: 'Feature',
          properties: { anchor: corridor.anchor },
          geometry: { type: 'LineString', coordinates: corridor.line },
        })),
      },
    })

    // One name label per section (corridors sharing an anchor — Cherokee's two
    // segments — get a single label), floated above the line's midpoint.
    const labeledAnchors = new Set<string>()
    map.addSource(LABELS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.flatMap((corridor) => {
          if (labeledAnchors.has(corridor.anchor)) {
            return []
          }
          labeledAnchors.add(corridor.anchor)

          return [
            {
              type: 'Feature' as const,
              properties: { label: corridor.name },
              geometry: {
                type: 'Point' as const,
                coordinates: corridor.line[Math.floor(corridor.line.length / 2)],
              },
            },
          ]
        }),
      },
    })
  }

  if (map.getLayer(LINE_LAYER_ID)) {
    map.setPaintProperty(LINE_LAYER_ID, 'line-color', lineColor)
    map.setPaintProperty(OVERVIEW_FILL_LAYER_ID, 'fill-color', polygonColor)
    map.setPaintProperty(OVERVIEW_OUTLINE_LAYER_ID, 'line-color', polygonColor)
    map.setPaintProperty(LABELS_LAYER_ID, 'text-color', labelColor)
    map.setPaintProperty(LABELS_LAYER_ID, 'text-halo-color', haloColor)

    return
  }

  map.addLayer({
    id: OVERVIEW_FILL_LAYER_ID,
    type: 'fill',
    source: OVERVIEW_BOUNDARIES_SOURCE_ID,
    paint: { 'fill-color': polygonColor, 'fill-opacity': 0.08 },
  })

  map.addLayer({
    id: OVERVIEW_OUTLINE_LAYER_ID,
    type: 'line',
    source: OVERVIEW_BOUNDARIES_SOURCE_ID,
    paint: { 'line-color': polygonColor, 'line-width': 1, 'line-opacity': 0.5 },
  })

  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': lineColor, 'line-width': 3.5, 'line-opacity': 0.85 },
  })

  // A fat invisible twin of the line layer, so the strips are clickable
  // without pixel-hunting a 3px line.
  map.addLayer({
    id: OVERVIEW_HIT_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: { 'line-width': 16, 'line-opacity': 0 },
  })

  map.addLayer({
    id: LABELS_LAYER_ID,
    type: 'symbol',
    source: LABELS_SOURCE_ID,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 11,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.4],
    },
    paint: { 'text-color': labelColor, 'text-halo-color': haloColor, 'text-halo-width': 1.5 },
  })
}

function mountOverviewMap(element: HTMLElement): MountedMap {
  const group = [...corridors.values()]
  const map = createBasemapMap(element, {
    // Inline in a scrolling article: plain scroll moves the page, not the map.
    cooperativeGestures: true,
    attributionControl: { compact: true },
  })

  map.on('load', async () => {
    const boundaries = await loadInvolvedBoundaries(group)
    applyOverviewLayers(map, group, boundaries)
    map.fitBounds(boundsOf(group), { padding: 28, duration: 0 })
  })

  // Clicking a strip jumps to its section.
  map.on('click', OVERVIEW_HIT_LAYER_ID, (event) => {
    const anchor = event.features?.[0]?.properties?.anchor
    if (typeof anchor === 'string' && anchor.length > 0) {
      window.location.hash = anchor
    }
  })
  map.on('mouseenter', OVERVIEW_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', OVERVIEW_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = ''
  })

  const disposeTheme = watchThemeChanges(map, () => applyOverviewLayers(map, group, []))

  return { map, disposeTheme }
}

export function initCorridorMaps(selector = '[data-corridor-map], [data-corridor-overview]'): void {
  const elements = document.querySelectorAll<HTMLElement>(selector)
  if (elements.length === 0) {
    return
  }

  const mounted = new Map<Element, MountedMap>()

  const mount = (element: HTMLElement) => {
    if (element.hasAttribute('data-corridor-overview')) {
      mounted.set(element, mountOverviewMap(element))

      return
    }
    const group = corridorsFor(element)
    if (group.length > 0) {
      mounted.set(element, mountCorridorMap(element, group))
    }
  }

  const mountObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !mounted.has(entry.target)) {
          mount(entry.target as HTMLElement)
        }
      }
    },
    { rootMargin: '600px 0px' },
  )

  const teardownObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const state = mounted.get(entry.target)
        if (!entry.isIntersecting && state) {
          state.disposeTheme()
          state.map.remove()
          mounted.delete(entry.target)
        }
      }
    },
    { rootMargin: '1800px 0px' },
  )

  for (const element of elements) {
    mountObserver.observe(element)
    teardownObserver.observe(element)
  }
}
