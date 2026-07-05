import maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { initLocator } from './locator'
import neighborhoods from '../data/neighborhoods.json'

// NHD_NUM → neighborhood, skipping absorbed `ignored` rows — the same join the
// full neighborhood map uses, so a slug resolves to the same boundary feature(s).
const byNumber = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.number, neighborhood]),
)

// Walk every [lng, lat] of a Polygon/MultiPolygon so its bounds can be framed.
function forEachPosition(geometry: Geometry, fn: (position: Position) => void): void {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const position of ring) {
        fn(position)
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const position of ring) {
          fn(position)
        }
      }
    }
  }
}

// The city-boundary feature(s) for a slug, or [] on any miss — e.g. a St. Louis
// County municipality, which has no polygon in the city geojson.
async function featuresForSlug(slug: string): Promise<Feature[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    if (!response.ok) {
      return []
    }
    const geojson: FeatureCollection = await response.json()

    return geojson.features.filter(
      (feature) => byNumber.get(Number(feature.properties?.NHD_NUM))?.slug === slug,
    )
  } catch {
    return []
  }
}

// Draw the one neighborhood's boundary in accent, framed to its bounds (backed off
// a level so it sits in a bit of its surroundings). Cooperative gestures so an
// inline locator never traps the page's scroll.
function drawPolygon(el: HTMLElement, features: Feature[]): void {
  const bounds = new maplibregl.LngLatBounds()
  for (const feature of features) {
    forEachPosition(feature.geometry, (position) => bounds.extend([position[0], position[1]]))
  }

  const map = createBasemapMap(el, {
    minZoom: 10,
    maxZoom: 16,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  })

  const SOURCE_ID = 'locator-neighborhood'
  const FILL_LAYER = 'locator-neighborhood-fill'
  const LINE_LAYER = 'locator-neighborhood-line'
  const CITY_SOURCE = 'locator-city'
  const CITY_LINE = 'locator-city-line'
  const readColor = (token: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
  const accentColor = () => readColor('--color-accent', '#9c3b2e')
  // A faint gray St. Louis City context outline under the neighborhood, matching
  // the Food map's boundaries (all neighborhood outlines from the same geojson).
  const cityColor = () => readColor('--color-muted-2', '#58554d')

  function addLayers(): void {
    const collection: FeatureCollection = { type: 'FeatureCollection', features }
    // The faint city context goes on first, so the accent neighborhood draws over it.
    if (!map.getSource(CITY_SOURCE)) {
      map.addSource(CITY_SOURCE, {
        type: 'geojson',
        data: `${import.meta.env.BASE_URL}stl-neighborhoods.geojson`,
      })
    }
    if (!map.getLayer(CITY_LINE)) {
      map.addLayer({
        id: CITY_LINE,
        type: 'line',
        source: CITY_SOURCE,
        paint: { 'line-color': cityColor(), 'line-width': 1, 'line-opacity': 0.6 },
      })
    }
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: collection })
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': accentColor(), 'fill-opacity': 0.18 },
      })
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': accentColor(), 'line-width': 2.5 },
      })
    }
    map.fitBounds(bounds, { padding: 22, maxZoom: 14, animate: false })
    // Back off a couple zoom levels so the neighborhood sits in more of its context.
    map.setZoom(map.getZoom() - 2)
  }

  if (map.isStyleLoaded()) {
    addLayers()
  } else {
    map.on('load', addLayers)
  }

  // The boundary color reads from a CSS token that differs light/dark; recolor it
  // after a theme swap (transformStyle carries the source + layers over).
  watchThemeChanges(map, () => {
    if (map.getLayer(CITY_LINE)) {
      map.setPaintProperty(CITY_LINE, 'line-color', cityColor())
    }
    if (map.getLayer(FILL_LAYER)) {
      map.setPaintProperty(FILL_LAYER, 'fill-color', accentColor())
    }
    if (map.getLayer(LINE_LAYER)) {
      map.setPaintProperty(LINE_LAYER, 'line-color', accentColor())
    }
  })
}

// Upgrade a placeholder box into a small "where is it" map: city neighborhoods get
// their boundary polygon; county municipalities (a center coord, no city polygon)
// fall back to the same center-pinned map the food pages use.
export async function initNeighborhoodLocator(el: HTMLElement): Promise<void> {
  const slug = el.dataset.slug ?? ''
  const features = slug ? await featuresForSlug(slug) : []
  if (features.length > 0) {
    drawPolygon(el, features)

    return
  }

  initLocator(el)
}
