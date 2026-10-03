import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { boundaryFor, type BoundaryFeature } from './boundaries'
import { buildPopupHtml } from './popup'
import { keepPopupInView } from './map-shared'
import type { MapSpot } from '../lib/spots'

const BOUNDARY_SOURCE_ID = 'neighborhood-boundary'
const BOUNDARY_FILL_LAYER_ID = 'neighborhood-boundary-fill'
const BOUNDARY_OUTLINE_LAYER_ID = 'neighborhood-boundary-outline'

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

function heroBounds(
  boundary: BoundaryFeature | undefined,
  spots: MapSpot[],
): LngLatBoundsLike | undefined {
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

  if (boundary) {
    extendWithGeometry(boundary.geometry.coordinates, extend)
  }
  for (const spot of spots) {
    extend(spot.coords)
  }

  if (!Number.isFinite(west)) {
    return undefined
  }

  return [
    [west, south],
    [east, north],
  ]
}

function readBoundaryColor(token: string): string {
  const styles = getComputedStyle(document.documentElement)

  return styles.getPropertyValue(token).trim() || '#c70f2e'
}

function applyBoundaryLayers(map: MapLibreMap, boundary: BoundaryFeature, token: string): void {
  const color = readBoundaryColor(token)

  if (map.getLayer(BOUNDARY_FILL_LAYER_ID)) {
    map.setPaintProperty(BOUNDARY_FILL_LAYER_ID, 'fill-color', color)
    map.setPaintProperty(BOUNDARY_OUTLINE_LAYER_ID, 'line-color', color)

    return
  }

  map.addSource(BOUNDARY_SOURCE_ID, { type: 'geojson', data: boundary as never })

  map.addLayer({
    id: BOUNDARY_FILL_LAYER_ID,
    type: 'fill',
    source: BOUNDARY_SOURCE_ID,
    paint: { 'fill-color': color, 'fill-opacity': 0.08 },
  })

  map.addLayer({
    id: BOUNDARY_OUTLINE_LAYER_ID,
    type: 'line',
    source: BOUNDARY_SOURCE_ID,
    paint: { 'line-color': color, 'line-width': 2.5, 'line-opacity': 0.85 },
  })
}

function addSpotMarkers(
  map: MapLibreMap,
  root: HTMLElement,
  spots: MapSpot[],
  openPopup: (spot: MapSpot, badge: HTMLElement) => void,
): void {
  const legend = root.querySelector<HTMLElement>('[data-map-legend]')

  for (const spot of spots) {
    const element = spot.url ? document.createElement('a') : document.createElement('button')
    element.className = 'map-badge'
    element.dataset.category = spot.category
    element.setAttribute('aria-label', spot.title)
    if (element instanceof HTMLAnchorElement && spot.url) {
      element.href = spot.url
      if (spot.external) {
        element.target = '_blank'
        element.rel = 'noopener'
      }
    }
    if (element instanceof HTMLButtonElement) {
      element.type = 'button'
    }

    const body = document.createElement('span')
    body.className = 'map-badge-body'

    const legendIcon = legend?.querySelector(`[data-legend-category="${spot.category}"] .icon`)
    if (legendIcon) {
      body.append(legendIcon.cloneNode(true))
    }
    element.append(body)

    element.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      openPopup(spot, element)
    })

    new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(spot.coords).addTo(map)
  }
}

function readSpots(root: HTMLElement): MapSpot[] {
  const holder = root.parentElement?.querySelector('script[data-map-pane-spots]')
  if (!holder?.textContent) {
    return []
  }

  try {
    const parsed = JSON.parse(holder.textContent) as MapSpot[]

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function initMapPane(): void {
  const root = document.querySelector<HTMLElement>('[data-map-pane]')
  if (!root) {
    return
  }

  const slug = root.dataset.slug ?? ''
  const boundaryToken = root.dataset.boundaryToken ?? '--color-map-accent'
  const spots = readSpots(root)
  const fallbackCoords = (root.dataset.coords ?? '').split(',').map(Number)

  const map = createBasemapMap(root, {
    minZoom: 10,
    maxZoom: 16,
    attributionControl: { compact: true },
  })

  const popup = new maplibregl.Popup({
    className: 'map-popup',
    closeButton: true,
    closeOnClick: false,
    anchor: 'bottom',
    maxWidth: '320px',
    offset: 18,
    focusAfterOpen: false,
  })

  let selectedBadge: HTMLElement | null = null
  popup.on('close', () => {
    selectedBadge?.classList.remove('is-selected')
    selectedBadge = null
  })

  const openSpotPopup = (spot: MapSpot, badge: HTMLElement): void => {
    const popupHtml = buildPopupHtml({
      title: spot.title,
      link: spot.url,
      external: spot.external,
      chips: spot.meta ? [{ label: spot.meta }] : [],
      verdict: spot.verdict,
      showRating: spot.category === 'food',
      excerpt: spot.tagline ?? '',
      directionsHref: spot.directionsHref,
    })
    selectedBadge?.classList.remove('is-selected')
    selectedBadge = badge
    badge.classList.add('is-selected')
    popup.setLngLat(spot.coords).setHTML(popupHtml).addTo(map)
    keepPopupInView(map, () => popup.getElement() ?? undefined)
  }

  map.on('click', () => popup.remove())

  const frameView = (bounds: LngLatBoundsLike | undefined): void => {
    if (bounds) {
      const camera = map.cameraForBounds(bounds, { padding: 48 })
      if (camera) {
        map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 13) - 0.15 })
      }
    } else if (fallbackCoords.length === 2 && fallbackCoords.every(Number.isFinite)) {
      map.jumpTo({ center: [fallbackCoords[1], fallbackCoords[0]], zoom: 12.5 })
    }
  }

  const boundaryPromise = boundaryFor(slug)
  void boundaryPromise.then((boundary) => {
    frameView(heroBounds(boundary, spots))
  })

  map.on('load', async () => {
    const boundary = await boundaryPromise
    if (boundary) {
      applyBoundaryLayers(map, boundary, boundaryToken)
    }

    watchThemeChanges(map, () => {
      if (boundary) {
        applyBoundaryLayers(map, boundary, boundaryToken)
      }
    })
  })

  addSpotMarkers(map, root, spots, openSpotPopup)
}
