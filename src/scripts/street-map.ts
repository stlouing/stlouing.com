import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { boundariesFor, type BoundaryFeature } from './boundaries'
import { optionalData } from '../lib/optional-data'
import { projectOntoLine, type LngLat } from '../lib/geo'
import { badgeIconNode, categorySwatchNode } from './popup'
import { stackBadges } from './map-badges'
import { observeMapElements, readPayload, type MountedMap } from './map-shared'

const streetData = optionalData<{ streets: unknown[] }>(
  import.meta.glob('../data/streets.json', { eager: true, import: 'default' }),
  { streets: [] },
)

const SOURCE_ID = 'street'
const LINE_LAYER_ID = 'street-line'
const ENDPOINTS_SOURCE_ID = 'street-endpoints'
const ENDPOINTS_LAYER_ID = 'street-endpoint-dots'
const LABELS_SOURCE_ID = 'street-labels'
const LABELS_LAYER_ID = 'street-label-text'
const DISTRICT_SOURCE_ID = 'street-district'
const DISTRICT_FILL_LAYER_ID = 'street-district-fill'
const DISTRICT_OUTLINE_LAYER_ID = 'street-district-outline'

interface Street {
  id: string
  name: string
  label?: string
  road: string
  from: string
  to: string
  anchor: string
  neighborhoods: string[]
  line: number[][]
}

const streets = new Map<string, Street>(
  (streetData.streets as Street[]).map((street) => [street.id, street]),
)

interface Spot {
  name: string
  category: string
  coords: LngLat
  link?: string
}

const spotsByStreet = readPayload<Record<string, Spot[]>>('script[data-street-spots]', {})
const districtShapes = readPayload<Feature<Polygon>[]>('script[data-street-districts]', [])

function districtShapesFor(group: Street[]): Feature<Polygon>[] {
  const streetIds = new Set(group.map((street) => street.id))

  return districtShapes.filter((shape) =>
    ((shape.properties?.streets as string[] | undefined) ?? []).some((streetId) =>
      streetIds.has(streetId),
    ),
  )
}

const SNAP_METERS = 75

function spotHref(link: string): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + link
}

function snapToLines(point: [number, number], group: Street[]): [number, number] {
  let best = point
  let bestDistance = Infinity
  for (const street of group) {
    const projection = projectOntoLine(point, street.line)
    if (projection.distance < bestDistance) {
      bestDistance = projection.distance
      best = projection.point
    }
  }

  return bestDistance <= SNAP_METERS ? best : point
}

function addSpotMarkers(map: MapLibreMap, group: Street[]): void {
  const placed = group.flatMap((street) =>
    (spotsByStreet[street.id] ?? []).map((spot) => ({ street, spot })),
  )
  const offsets = stackBadges(placed.map((entry) => entry.spot))

  for (const { street, spot } of placed) {
    const element = document.createElement(spot.link ? 'a' : 'span')
    element.className = 'street-spot map-badge'
    element.dataset.category = spot.category
    element.setAttribute('aria-label', spot.name)
    if (spot.link && element instanceof HTMLAnchorElement) {
      element.href = spotHref(spot.link)
    }

    const body = document.createElement('span')
    body.className = 'map-badge-body'
    const icon = badgeIconNode(spot.category)
    if (icon) {
      body.append(icon)
    }
    element.append(body)

    const name = document.createElement('span')
    name.className = 'street-spot-name'
    name.textContent = spot.name
    element.append(name)

    new maplibregl.Marker({ element, anchor: 'center', offset: offsets.get(spot) ?? [0, 0] })
      .setLngLat(snapToLines(spot.coords, [street]))
      .addTo(map)
  }
}

function streetsFor(element: HTMLElement): Street[] {
  const ids = (element.dataset.streetMap ?? '').split(/\s+/).filter(Boolean)

  return ids.flatMap((id) => {
    const street = streets.get(id)

    return street ? [street] : []
  })
}

function boundsOf(group: Street[]): LngLatBoundsLike {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const street of group) {
    for (const [lng, lat] of street.line) {
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

function readStreetColors(): { line: string; halo: string; label: string; district: string } {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback

  return {
    line: readColor('--color-map-street', '#c0392b'),
    halo: readColor('--color-background', '#f3efe7'),
    label: readColor('--color-text', '#1b1a17'),
    district: readColor('--color-map-district', '#1b1a17'),
  }
}

function applyStreetLayers(map: MapLibreMap, group: Street[]): void {
  const colors = readStreetColors()
  const labeled = group.length > 1
  const districts = districtShapesFor(group)

  if (!map.getSource(SOURCE_ID)) {
    if (districts.length > 0) {
      map.addSource(DISTRICT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: districts },
      })
    }

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.map((street) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: street.line },
        })),
      },
    })

    map.addSource(ENDPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.flatMap((street) =>
          [street.line[0], street.line[street.line.length - 1]].map((point) => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: point },
          })),
        ),
      },
    })

    if (labeled) {
      map.addSource(LABELS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: group.map((street) => ({
            type: 'Feature',
            properties: { label: street.label ?? street.name },
            geometry: {
              type: 'Point',
              coordinates: street.line[Math.floor(street.line.length / 2)],
            },
          })),
        },
      })
    }
  }

  if (map.getLayer(LINE_LAYER_ID)) {
    if (map.getLayer(DISTRICT_OUTLINE_LAYER_ID)) {
      map.setPaintProperty(DISTRICT_FILL_LAYER_ID, 'fill-color', colors.district)
      map.setPaintProperty(DISTRICT_OUTLINE_LAYER_ID, 'line-color', colors.district)
    }
    map.setPaintProperty(LINE_LAYER_ID, 'line-color', colors.line)
    map.setPaintProperty(ENDPOINTS_LAYER_ID, 'circle-color', colors.line)
    map.setPaintProperty(ENDPOINTS_LAYER_ID, 'circle-stroke-color', colors.halo)
    if (map.getLayer(LABELS_LAYER_ID)) {
      map.setPaintProperty(LABELS_LAYER_ID, 'text-color', colors.label)
      map.setPaintProperty(LABELS_LAYER_ID, 'text-halo-color', colors.halo)
    }

    return
  }

  if (districts.length > 0) {
    map.addLayer({
      id: DISTRICT_FILL_LAYER_ID,
      type: 'fill',
      source: DISTRICT_SOURCE_ID,
      paint: { 'fill-color': colors.district, 'fill-opacity': 0.08 },
    })
    map.addLayer({
      id: DISTRICT_OUTLINE_LAYER_ID,
      type: 'line',
      source: DISTRICT_SOURCE_ID,
      paint: { 'line-color': colors.district, 'line-width': 2, 'line-opacity': 0.8 },
    })
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
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -0.6],
      },
      paint: { 'text-color': colors.label, 'text-halo-color': colors.halo, 'text-halo-width': 1.5 },
    })
  }
}

function spotChip(spot: Spot): HTMLElement {
  const chip = document.createElement(spot.link ? 'a' : 'span')
  chip.className = 'chip category-chip'
  if (spot.link && chip instanceof HTMLAnchorElement) {
    chip.href = spotHref(spot.link)
  }
  chip.append(categorySwatchNode(spot.category))
  const name = document.createElement('span')
  name.textContent = spot.name
  chip.append(name)

  return chip
}

function appendSpotCaption(element: HTMLElement, group: Street[]): void {
  const spots = group.flatMap((street) => spotsByStreet[street.id] ?? [])
  const figure = element.closest('figure')
  if (spots.length === 0 || !figure || figure.querySelector('.street-map-caption')) {
    return
  }

  const caption = document.createElement('figcaption')
  caption.className = 'street-map-caption'
  caption.append(...spots.map(spotChip))
  figure.append(caption)
}

function figureBounds(group: Street[]): LngLatBoundsLike {
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

  for (const street of group) {
    street.line.forEach(extend)
    for (const spot of spotsByStreet[street.id] ?? []) {
      extend(spot.coords)
    }
  }
  for (const shape of districtShapesFor(group)) {
    shape.geometry.coordinates[0].forEach(extend)
  }

  return [
    [west, south],
    [east, north],
  ]
}

function mountStreetMap(element: HTMLElement, group: Street[]): MountedMap {
  const map = createBasemapMap(element, {
    interactive: false,
    attributionControl: { compact: true },
  })

  map.on('load', () => {
    applyStreetLayers(map, group)
    const camera = map.cameraForBounds(figureBounds(group), { padding: 36 })
    if (camera) {
      map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 14) - 0.25 })
    }
  })

  addSpotMarkers(map, group)
  appendSpotCaption(element, group)

  const disposeTheme = watchThemeChanges(map, () => {
    applyStreetLayers(map, group)
  })

  return { map, disposeTheme }
}

const OVERVIEW_BOUNDARIES_SOURCE_ID = 'street-overview-boundaries'
const OVERVIEW_FILL_LAYER_ID = 'street-overview-fill'
const OVERVIEW_OUTLINE_LAYER_ID = 'street-overview-outline'
const OVERVIEW_HIT_LAYER_ID = 'street-overview-hit'

function applyOverviewLayers(
  map: MapLibreMap,
  group: Street[],
  boundaries: BoundaryFeature[],
): void {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback
  const lineColor = readColor('--color-map-street', '#c0392b')
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
        features: group.map((street) => ({
          type: 'Feature',
          properties: { anchor: street.anchor },
          geometry: { type: 'LineString', coordinates: street.line },
        })),
      },
    })

    const labeledAnchors = new Set<string>()
    map.addSource(LABELS_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: group.flatMap((street) => {
          if (labeledAnchors.has(street.anchor)) {
            return []
          }
          labeledAnchors.add(street.anchor)

          return [
            {
              type: 'Feature' as const,
              properties: { label: street.name },
              geometry: {
                type: 'Point' as const,
                coordinates: street.line[Math.floor(street.line.length / 2)],
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
  const group = [...streets.values()]
  const map = createBasemapMap(element, {
    cooperativeGestures: true,
    attributionControl: { compact: true },
  })

  map.on('load', async () => {
    const boundaries = await boundariesFor(group.flatMap((street) => street.neighborhoods ?? []))
    applyOverviewLayers(map, group, boundaries)
    map.fitBounds(boundsOf(group), { padding: 28, duration: 0 })
  })

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

export function initStreetMaps(selector = '[data-street-map], [data-street-overview]'): void {
  const elements = document.querySelectorAll<HTMLElement>(selector)
  if (elements.length === 0) {
    return
  }

  observeMapElements(elements, (element) => {
    if (element.hasAttribute('data-street-overview')) {
      return mountOverviewMap(element)
    }
    const group = streetsFor(element)

    return group.length > 0 ? mountStreetMap(element, group) : undefined
  })
}
