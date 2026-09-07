// The neighborhood page's masthead map: one big basemap under the title with
// the neighborhood's boundary drawn in its region color and a pin for every
// food spot mapped to it. A figure, not an explorer (no pan/zoom), following
// the corridor-map pattern; pins are DOM <a> markers so they stay clickable
// with hover-tooltip names (the shared .corridor-spot pin-with-tooltip CSS).
// One map per page mounted at the top — no lazy mount/teardown needed.

import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'

const BOUNDARY_SOURCE_ID = 'neighborhood-boundary'
const BOUNDARY_FILL_LAYER_ID = 'neighborhood-boundary-fill'
const BOUNDARY_OUTLINE_LAYER_ID = 'neighborhood-boundary-outline'

// A food spot baked into the page by NeighborhoodHero.astro. Coords are
// [lng, lat] (flipped from the food frontmatter's [lat, lng] at build).
interface HeroSpot {
  title: string
  url: string
  coords: [number, number]
}

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
  spots: HeroSpot[],
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

function addSpotMarkers(map: MapLibreMap, spots: HeroSpot[]): void {
  // The same teardrop pin as the corridor/food maps; currentColor fill, colored
  // by the shared .corridor-spot CSS (--color-pin).
  const pinSvg = `<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="currentColor" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>`

  for (const spot of spots) {
    const element = document.createElement('a')
    element.className = 'corridor-spot'
    element.setAttribute('aria-label', spot.title)
    element.href = import.meta.env.BASE_URL.replace(/\/$/, '') + spot.url

    element.innerHTML = pinSvg
    const name = document.createElement('span')
    name.className = 'corridor-spot-name'
    name.textContent = spot.title
    element.append(name)

    new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(spot.coords).addTo(map)
  }
}

function readSpots(root: HTMLElement): HeroSpot[] {
  const holder = root.parentElement?.querySelector('script[data-neighborhood-hero-spots]')
  if (!holder?.textContent) {
    return []
  }

  try {
    const parsed = JSON.parse(holder.textContent) as HeroSpot[]

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function initNeighborhoodHero(): void {
  const root = document.querySelector<HTMLElement>('[data-neighborhood-hero]')
  if (!root) {
    return
  }

  const slug = root.dataset.slug ?? ''
  const boundaryToken = root.dataset.boundaryToken ?? '--color-map-accent'
  const spots = readSpots(root)
  // Fallback center [lat, lng] for areas without a boundary polygon.
  const fallbackCoords = (root.dataset.coords ?? '').split(',').map(Number)

  const map = createBasemapMap(root, {
    // A figure, not an explorer: no pan/zoom, so scrolling the page never
    // fights the map.
    interactive: false,
    attributionControl: { compact: true },
  })

  map.on('load', async () => {
    const boundary = await loadBoundary(slug)
    if (boundary) {
      applyBoundaryLayers(map, boundary, boundaryToken)
    }

    const bounds = heroBounds(boundary, spots)
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

    watchThemeChanges(map, () => {
      if (boundary) {
        applyBoundaryLayers(map, boundary, boundaryToken)
      }
    })
  })

  addSpotMarkers(map, spots)
}
