import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { boundaryFor, type BoundaryFeature } from './boundaries'

export interface ColoredArea {
  name: string
  token: string
  boundary: BoundaryFeature
}

export interface NamedArea {
  slug: string
  name: string
  token: string
}

const AREA_FILL_OPACITY = 0.08
const AREA_LINE_WIDTH = 2.5
const AREA_LINE_OPACITY = 0.85
const LABEL_HALO_WIDTH = 1.5
const LABEL_CONTRAST_MIX = 0.4

export function readMapColor(token: string, fallback = '#c70f2e'): string {
  const styles = getComputedStyle(document.documentElement)

  return styles.getPropertyValue(token).trim() || fallback
}

let colorContext: CanvasRenderingContext2D | null | undefined

function rgbChannels(color: string): number[] | undefined {
  colorContext ??= document.createElement('canvas').getContext('2d')
  if (!colorContext) {
    return undefined
  }
  colorContext.fillStyle = '#000000'
  colorContext.fillStyle = color
  const normalized = String(colorContext.fillStyle)
  const hex = normalized.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    return [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16))
  }
  const rgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)

  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : undefined
}

export function labelColor(color: string): string {
  const base = rgbChannels(color)
  const heading = rgbChannels(readMapColor('--color-text-heading', '#111111'))
  if (!base || !heading) {
    return color
  }
  const mixed = base.map((channel, index) =>
    Math.round(channel + (heading[index] - channel) * LABEL_CONTRAST_MIX),
  )

  return `rgb(${mixed.join(', ')})`
}

export const partLabelLayout = (nameProperty: string) => ({
  'text-field': ['get', nameProperty] as ['get', string],
  'text-font': ['Noto Sans Medium'],
  'text-size': 11,
  'text-transform': 'uppercase' as const,
  'text-letter-spacing': 0.08,
  'text-max-width': 8,
})

const boundaryLabelLayout = (nameProperty: string) => ({
  ...partLabelLayout(nameProperty),
  'symbol-placement': 'line' as const,
  'symbol-spacing': 250,
})

function extendWithGeometry(coordinates: unknown, extend: (point: [number, number]) => void): void {
  if (!Array.isArray(coordinates)) {
    return
  }
  if (coordinates.length === 2 && typeof coordinates[0] === 'number') {
    extend(coordinates as [number, number])

    return
  }
  for (const nested of coordinates) {
    extendWithGeometry(nested, extend)
  }
}

export function featureBounds(
  features: BoundaryFeature[],
  points: [number, number][] = [],
): Bounds | undefined {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  const extend = ([lng, lat]: [number, number]) => {
    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  }

  for (const feature of features) {
    extendWithGeometry(feature.geometry.coordinates, extend)
  }
  for (const point of points) {
    extend(point)
  }

  if (!Number.isFinite(west)) {
    return undefined
  }

  return [
    [west, south],
    [east, north],
  ]
}

export async function coloredAreasFor(areas: NamedArea[]): Promise<ColoredArea[]> {
  const boundaries = await Promise.all(areas.map((area) => boundaryFor(area.slug)))

  return areas.flatMap((area, index) => {
    const boundary = boundaries[index]

    return boundary ? [{ name: area.name, token: area.token, boundary }] : []
  })
}

export function applyOutlinedArea(
  map: MapLibreMap,
  prefix: string,
  boundary: BoundaryFeature,
  color: string,
  label?: string,
): void {
  const fillId = `${prefix}-fill`
  const outlineId = `${prefix}-outline`
  const labelId = `${prefix}-label`
  const halo = readMapColor('--color-background')

  if (map.getLayer(fillId)) {
    map.setPaintProperty(fillId, 'fill-color', color)
    map.setPaintProperty(outlineId, 'line-color', color)
    if (map.getLayer(labelId)) {
      map.setPaintProperty(labelId, 'text-color', labelColor(color))
      map.setPaintProperty(labelId, 'text-halo-color', halo)
    }

    return
  }

  const data = label
    ? { ...boundary, properties: { ...boundary.properties, name: label } }
    : boundary

  map.addSource(prefix, { type: 'geojson', data: data as never })

  map.addLayer({
    id: fillId,
    type: 'fill',
    source: prefix,
    paint: { 'fill-color': color, 'fill-opacity': AREA_FILL_OPACITY },
  })

  map.addLayer({
    id: outlineId,
    type: 'line',
    source: prefix,
    paint: {
      'line-color': color,
      'line-width': AREA_LINE_WIDTH,
      'line-opacity': AREA_LINE_OPACITY,
    },
  })

  if (label) {
    map.addLayer({
      id: labelId,
      type: 'symbol',
      source: prefix,
      layout: partLabelLayout('name'),
      paint: {
        'text-color': labelColor(color),
        'text-halo-color': halo,
        'text-halo-width': LABEL_HALO_WIDTH,
      },
    })
  }
}

export interface DashedPieceOptions {
  labeled?: boolean
}

export function applyDashedPieces(
  map: MapLibreMap,
  prefix: string,
  pieces: BoundaryFeature[],
  color: string,
  { labeled = true }: DashedPieceOptions = {},
): void {
  const lineId = `${prefix}-line`
  const labelId = `${prefix}-label`
  const halo = readMapColor('--color-background')

  if (map.getLayer(lineId)) {
    map.setPaintProperty(lineId, 'line-color', color)
    if (map.getLayer(labelId)) {
      map.setPaintProperty(labelId, 'text-color', labelColor(color))
      map.setPaintProperty(labelId, 'text-halo-color', halo)
    }

    return
  }

  map.addSource(prefix, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: pieces } as never,
  })

  map.addLayer({
    id: lineId,
    type: 'line',
    source: prefix,
    paint: {
      'line-color': color,
      'line-width': 1.25,
      'line-opacity': 0.7,
      'line-dasharray': [2, 2],
    },
  })

  if (!labeled) {
    return
  }

  map.addLayer({
    id: labelId,
    type: 'symbol',
    source: prefix,
    layout: partLabelLayout('NHD_NAME'),
    paint: {
      'text-color': labelColor(color),
      'text-halo-color': halo,
      'text-halo-width': LABEL_HALO_WIDTH,
    },
  })
}

type Position = [number, number]

function outerRings(feature: BoundaryFeature): Position[][] {
  const { type, coordinates } = feature.geometry
  if (type === 'Polygon') {
    return [(coordinates as Position[][])[0]]
  }
  if (type === 'MultiPolygon') {
    return (coordinates as Position[][][]).map((polygon) => polygon[0])
  }

  return []
}

function ringArea(ring: Position[]): number {
  return ring.reduce((area, [lng, lat], index) => {
    const [nextLng, nextLat] = ring[(index + 1) % ring.length]

    return area + (lng * nextLat - nextLng * lat) / 2
  }, 0)
}

function centroidLatitude(ring: Position[]): number {
  const weighted = ring.reduce((sum, [lng, lat], index) => {
    const [nextLng, nextLat] = ring[(index + 1) % ring.length]

    return sum + (lat + nextLat) * (lng * nextLat - nextLng * lat)
  }, 0)

  return weighted / (6 * ringArea(ring))
}

export type Bounds = [Position, Position]

export interface LabelPlacement {
  within?: Bounds
  avoid?: BoundaryFeature[]
}

type Span = [number, number]

const LABEL_SCANLINES = 15
const LABEL_EDGE_MARGIN = 0.12
const LABEL_AVOID_MARGIN = 0.08
const LABEL_AVOID_HEIGHT = 0.05
const LABEL_CENTER_PREFERENCE = 0.6

function largestRing(feature: BoundaryFeature): Position[] | undefined {
  const [ring] = outerRings(feature).sort(
    (first, second) => Math.abs(ringArea(second)) - Math.abs(ringArea(first)),
  )

  return ring
}

function insideSpans(ring: Position[], latitude: number): Span[] {
  const crossings = ring
    .flatMap(([lng, lat], index) => {
      const [nextLng, nextLat] = ring[(index + 1) % ring.length]
      if (lat > latitude === nextLat > latitude) {
        return []
      }

      return [lng + ((latitude - lat) * (nextLng - lng)) / (nextLat - lat)]
    })
    .sort((first, second) => first - second)
  const spans: Span[] = []
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    spans.push([crossings[index], crossings[index + 1]])
  }

  return spans
}

function clipSpan([start, end]: Span, [low, high]: Span): Span[] {
  const clippedStart = Math.max(start, low)
  const clippedEnd = Math.min(end, high)

  return clippedEnd > clippedStart ? [[clippedStart, clippedEnd]] : []
}

interface AvoidMargins {
  lng: number
  lat: number
}

function spanPiecesOutside(
  span: Span,
  latitude: number,
  avoidRings: Position[][],
  margins: AvoidMargins,
): Span[] {
  const blocked = avoidRings.flatMap((ring) =>
    [latitude - margins.lat, latitude, latitude + margins.lat].flatMap((scanLatitude) =>
      insideSpans(ring, scanLatitude),
    ),
  )

  return blocked.reduce<Span[]>(
    (pieces, [blockStart, blockEnd]) =>
      pieces.flatMap(([start, end]) => [
        ...clipSpan([start, end], [start, blockStart - margins.lng]),
        ...clipSpan([start, end], [blockEnd + margins.lng, end]),
      ]),
    [span],
  )
}

function widestSpanPoint(ring: Position[]): Position | undefined {
  const latitude = centroidLatitude(ring)
  const [widest] = insideSpans(ring, latitude).sort(
    (first, second) => second[1] - second[0] - (first[1] - first[0]),
  )

  return widest ? [(widest[0] + widest[1]) / 2, latitude] : undefined
}

export function labelPoint(
  feature: BoundaryFeature,
  { within, avoid = [] }: LabelPlacement = {},
): Position | undefined {
  const ring = largestRing(feature)
  if (!ring) {
    return undefined
  }
  if (!within && avoid.length === 0) {
    return widestSpanPoint(ring)
  }

  const latitudes = ring.map(([, lat]) => lat)
  let south = Math.min(...latitudes)
  let north = Math.max(...latitudes)
  let lngRange: Span = [-Infinity, Infinity]
  const margins: AvoidMargins = { lng: 0, lat: 0 }
  if (within) {
    const [[west, withinSouth], [east, withinNorth]] = within
    const latMargin = (withinNorth - withinSouth) * LABEL_EDGE_MARGIN
    const lngMargin = (east - west) * LABEL_EDGE_MARGIN
    south = Math.max(south, withinSouth + latMargin)
    north = Math.min(north, withinNorth - latMargin)
    lngRange = [west + lngMargin, east - lngMargin]
    margins.lng = (east - west) * LABEL_AVOID_MARGIN
    margins.lat = (withinNorth - withinSouth) * LABEL_AVOID_HEIGHT
  }
  const avoidRings = avoid.flatMap((avoidFeature) => {
    const avoidRing = largestRing(avoidFeature)

    return avoidRing ? [avoidRing] : []
  })
  const middle = (south + north) / 2
  let best: { score: number; point: Position } | undefined
  for (let step = 1; step <= LABEL_SCANLINES; step++) {
    const latitude = south + ((north - south) * step) / (LABEL_SCANLINES + 1)
    const centering = 1 - (LABEL_CENTER_PREFERENCE * Math.abs(latitude - middle)) / (north - south)
    const pieces = insideSpans(ring, latitude)
      .flatMap((span) => clipSpan(span, lngRange))
      .flatMap((span) => spanPiecesOutside(span, latitude, avoidRings, margins))
    for (const [start, end] of pieces) {
      const score = (end - start) * centering
      if (!best || score > best.score) {
        best = { score, point: [(start + end) / 2, latitude] }
      }
    }
  }

  return best?.point ?? widestSpanPoint(ring)
}

function areaLabelPoints(areas: ColoredArea[], placement: LabelPlacement) {
  return {
    type: 'FeatureCollection',
    features: areas.flatMap(({ name, token, boundary }) => {
      const point = name ? labelPoint(boundary, placement) : undefined
      if (!point) {
        return []
      }

      return [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: point },
          properties: { name, labelColor: labelColor(readMapColor(token)) },
        },
      ]
    }),
  }
}

function coloredAreasData(areas: ColoredArea[]) {
  return {
    type: 'FeatureCollection',
    features: areas.map(({ name, token, boundary }) => {
      const color = readMapColor(token)

      return { ...boundary, properties: { name, color, labelColor: labelColor(color) } }
    }),
  }
}

export interface ColoredAreaOptions {
  beneathLayerId?: string
  labelPlacement?: 'line' | 'point'
  labelWithin?: Bounds
  labelAvoid?: BoundaryFeature[]
}

export function applyColoredAreas(
  map: MapLibreMap,
  prefix: string,
  areas: ColoredArea[],
  { beneathLayerId, labelPlacement = 'line', labelWithin, labelAvoid }: ColoredAreaOptions = {},
): void {
  const data = coloredAreasData(areas)
  const labelId = `${prefix}-label`
  const labelSourceId = labelPlacement === 'point' ? `${prefix}-label-points` : prefix
  const labelPlacementOptions: LabelPlacement = { within: labelWithin, avoid: labelAvoid }
  const halo = readMapColor('--color-background')
  const source = map.getSource(prefix) as GeoJSONSource | undefined

  if (source) {
    source.setData(data as never)
    const labelSource = map.getSource(labelSourceId) as GeoJSONSource | undefined
    if (labelSource && labelSource !== source) {
      labelSource.setData(areaLabelPoints(areas, labelPlacementOptions) as never)
    }
    map.setPaintProperty(labelId, 'text-halo-color', halo)

    return
  }

  const beneath = beneathLayerId && map.getLayer(beneathLayerId) ? beneathLayerId : undefined

  map.addSource(prefix, { type: 'geojson', data: data as never })

  map.addLayer(
    {
      id: `${prefix}-fill`,
      type: 'fill',
      source: prefix,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': AREA_FILL_OPACITY },
    },
    beneath,
  )

  map.addLayer(
    {
      id: `${prefix}-outline`,
      type: 'line',
      source: prefix,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': AREA_LINE_WIDTH,
        'line-opacity': AREA_LINE_OPACITY,
      },
    },
    beneath,
  )

  if (labelSourceId !== prefix) {
    map.addSource(labelSourceId, {
      type: 'geojson',
      data: areaLabelPoints(areas, labelPlacementOptions) as never,
    })
  }

  map.addLayer({
    id: labelId,
    type: 'symbol',
    source: labelSourceId,
    layout: labelPlacement === 'line' ? boundaryLabelLayout('name') : partLabelLayout('name'),
    paint: {
      'text-color': ['get', 'labelColor'],
      'text-halo-color': halo,
      'text-halo-width': LABEL_HALO_WIDTH,
    },
  })
}
