import type { FeatureCollection, Position } from 'geojson'
import type { LngLatBoundsLike } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import boundaries from '../data/city-county-boundaries.json'

const SOURCE_ID = 'divorce-boundaries'
const FILL_LAYER_ID = 'divorce-boundaries-fill'
const LINE_LAYER_ID = 'divorce-boundaries-line'

// Census TIGERweb county boundaries (GEOID 29510 city, 29189 county),
// simplified to ~30m so the river edge stays crisp at article-figure sizes.
const collection = boundaries as FeatureCollection

function boundsOf(features: FeatureCollection): LngLatBoundsLike {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const feature of features.features) {
    const geometry = feature.geometry
    if (geometry.type !== 'Polygon') {
      continue
    }
    for (const ring of geometry.coordinates) {
      for (const [lng, lat] of ring as Position[]) {
        west = Math.min(west, lng)
        south = Math.min(south, lat)
        east = Math.max(east, lng)
        north = Math.max(north, lat)
      }
    }
  }

  return [
    [west, south],
    [east, north],
  ]
}

// City red and county blue, read live from the map-color tokens so the figure
// follows the light/dark theme like the neighborhood map does.
function readBoundaryColors(): { city: string; county: string } {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback

  return {
    city: readColor('--color-map-central', '#c0392b'),
    county: readColor('--color-map-county', '#2766ad'),
  }
}

/**
 * The Great Divorce boundary figure: St. Louis City's frozen border drawn inside
 * the county that surrounds it. The article markdown supplies the placeholder
 * element; this mounts the themed basemap into it and overlays both boundaries.
 */
export function initBoundaryMap(selector = '[data-boundary-map]'): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    return
  }

  const map = createBasemapMap(element, {
    // Inline in a scrolling article: plain scroll moves the page, not the map.
    cooperativeGestures: true,
    attributionControl: { compact: true },
    minZoom: 8,
    maxZoom: 13,
  })

  function applyBoundaryLayers(): void {
    const colors = readBoundaryColors()
    const colorByFips = [
      'match',
      ['get', 'fips'],
      '29510',
      colors.city,
      colors.county,
    ]

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: collection })
    }

    if (map.getLayer(FILL_LAYER_ID)) {
      map.setPaintProperty(FILL_LAYER_ID, 'fill-color', colorByFips)
      map.setPaintProperty(LINE_LAYER_ID, 'line-color', colorByFips)

      return
    }

    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': colorByFips as never,
        // The city reads as the highlighted subject; the county as its quieter
        // surrounding context.
        'fill-opacity': ['match', ['get', 'fips'], '29510', 0.25, 0.08] as never,
      },
    })

    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': colorByFips as never,
        'line-width': ['match', ['get', 'fips'], '29510', 2.5, 1.5] as never,
      },
    })
  }

  map.on('load', () => {
    applyBoundaryLayers()
    map.fitBounds(boundsOf(collection), { padding: 20, duration: 0 })
  })

  // Re-apply after a theme toggle swaps the basemap style (colors differ per theme).
  watchThemeChanges(map, () => applyBoundaryLayers())
}
