// The neighborhood page's map pane: an interactive basemap filling the right
// half of the split-screen layout, with the neighborhood's boundary drawn in
// its region color and an icon badge for every mapped spot (food places plus
// the authored spots.json categories). Badges are DOM markers colored by
// data-category, their icon cloned from the SSR legend inside the pane (the
// legend is the one icon source); clicking opens the popup instead of
// navigating (middle-click on a linked badge still opens its page). On phones
// the pane stacks on top of the content at a fixed height, so the map is
// always visible at mount.

import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml } from './popup'
import { keepPopupInView } from './map-shared'
import type { MapSpot } from '../lib/spots'

const BOUNDARY_SOURCE_ID = 'neighborhood-boundary'
const BOUNDARY_FILL_LAYER_ID = 'neighborhood-boundary-fill'
const BOUNDARY_OUTLINE_LAYER_ID = 'neighborhood-boundary-outline'

// The city shapefile names a few neighborhoods differently than the site does.
// Same override map as the walkable overview (corridor-map.ts).
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

async function loadBoundary(slug: string): Promise<BoundaryFeature | undefined> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    const boundaries = (await response.json()) as { features: BoundaryFeature[] }

    return boundaries.features.find((feature) => {
      const citySlug = slugify(String(feature.properties?.NHD_NAME ?? ''))

      return (siteSlugByCitySlug[citySlug] ?? citySlug) === slug
    })
  } catch {
    return undefined
  }
}

// Walk a Polygon/MultiPolygon's coordinates and extend the bbox with each point.
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

// Boundary paint from the page's region token (baked as data-boundary-token),
// re-read on theme swaps so the color follows light/dark.
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
    // A linked badge stays an <a> so middle-click / open-in-new-tab navigates;
    // an unlinked one is a <button> so it's still keyboard-activatable.
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

    // The circle visuals live on an inner body span (never the marker element
    // itself — MapLibre positions that with an inline transform, which any CSS
    // hover transform would fight), matching the .marker-pin pattern.
    const body = document.createElement('span')
    body.className = 'map-badge-body'

    // The badge's glyph comes from the matching legend row — the legend is the
    // one icon source, so markers and key can never disagree. Without a match
    // the badge stays a plain colored dot.
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
  // Fallback center [lat, lng] for areas without a boundary polygon.
  const fallbackCoords = (root.dataset.coords ?? '').split(',').map(Number)

  const map = createBasemapMap(root, {
    minZoom: 10,
    maxZoom: 16,
    attributionControl: { compact: true },
  })

  // One reused popup, food-map options verbatim (map.ts) except the offset:
  // the badge is a centered circle, not a 36px bottom-anchored pin.
  const popup = new maplibregl.Popup({
    className: 'map-popup',
    closeButton: true,
    closeOnClick: false,
    anchor: 'bottom',
    maxWidth: '330px',
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

  // The pane is always visible at mount (desktop right half, mobile top strip),
  // so the camera frames once; MapLibre's own trackResize covers window
  // resizes after that.
  const frameView = (bounds: LngLatBoundsLike | undefined): void => {
    if (bounds) {
      // A touch looser than a tight fit, so the boundary sits in its
      // surrounding street grid.
      const camera = map.cameraForBounds(bounds, { padding: 48 })
      if (camera) {
        map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 13) - 0.15 })
      }
    } else if (fallbackCoords.length === 2 && fallbackCoords.every(Number.isFinite)) {
      map.jumpTo({ center: [fallbackCoords[1], fallbackCoords[0]], zoom: 12.5 })
    }
  }

  // Frame as soon as the boundary answers, NOT inside map 'load':
  // cameraForBounds and the DOM markers only need the map transform, while
  // 'load' waits for the full style + tiles — on mobile that gap left the
  // badges sitting at default-camera positions for seconds.
  const boundaryPromise = loadBoundary(slug)
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
