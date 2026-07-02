// MapLibre's stylesheet ships from here (the shared module every map goes
// through) so it's present on any page that creates a map — including the food
// detail pages, which load only the locator. Without it, markers lose their
// `position:absolute` and get flung off-screen by their positioning transform.
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import type { MapOptions, StyleSpecification } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'

// Shared MapLibre GL basemap for both interactive maps. WebGL renders the vector
// tiles on the GPU (uploaded once, re-projected per frame), so zooming is smooth
// and doesn't accumulate the Canvas-2D re-rasterization that crashed the old
// protomaps-leaflet map. The basemap is the self-hosted St. Louis pmtiles slice,
// read straight out of the archive via the pmtiles:// protocol — no tile server.

// Register the pmtiles:// protocol once per page so MapLibre can fetch tiles out
// of the .pmtiles archive over HTTP range requests.
let protocolRegistered = false
function registerPmtilesProtocol(): void {
  if (protocolRegistered) {
    return
  }
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolRegistered = true
}

// OSM's ODbL mandates a visible OpenStreetMap credit; Protomaps built the basemap.
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const protomapsAttribution = `<a href="https://protomaps.com">Protomaps</a> ${osmAttribution}`

// The ~22 MB St. Louis .pmtiles cut. Local dev reads it from public/; production
// reads it from object storage via PUBLIC_PMTILES_URL (set in CI, kept out of the
// repo). `||` (not `??`) so an unset CI var — passed as an empty string — also
// falls back to the local path.
const localPmtilesUrl = `${import.meta.env.BASE_URL}stl.pmtiles`
const protomapsTilesUrl = import.meta.env.PUBLIC_PMTILES_URL || localPmtilesUrl

// Protomaps basemap assets (label fonts + POI sprites). Public and tokenless,
// served from Protomaps' GitHub Pages. Could be self-hosted later to drop the
// third-party dependency (see plan follow-ups).
const glyphsUrl = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'
const spriteUrl = (dark: boolean) =>
  `https://protomaps.github.io/basemaps-assets/sprites/v4/${dark ? 'dark' : 'light'}`

function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

// The full MapLibre style: our pmtiles source plus the Protomaps cartographic
// layers in the matching light/dark flavor.
export function buildBasemapStyle(dark = isDarkTheme()): StyleSpecification {
  return {
    version: 8,
    glyphs: glyphsUrl,
    sprite: spriteUrl(dark),
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${protomapsTilesUrl}`,
        attribution: protomapsAttribution,
      },
    },
    layers: layers('protomaps', namedFlavor(dark ? 'dark' : 'light'), { lang: 'en' }),
  }
}

// Create the map with the shared basemap and site-appropriate defaults (north-up,
// no rotation/pitch — a flat map like the old Leaflet one). Callers pass zoom
// bounds and any container-specific options.
export function createBasemapMap(
  container: HTMLElement,
  options: Partial<MapOptions> = {},
): maplibregl.Map {
  registerPmtilesProtocol()

  const map = new maplibregl.Map({
    container,
    style: buildBasemapStyle(),
    // A sensible St. Louis default so the first paint isn't [0,0]; callers
    // fitBounds over their features right after.
    center: [-90.2, 38.627],
    zoom: 11,
    dragRotate: false,
    pitchWithRotate: false,
    // Attribution is required (OSM/Protomaps); keep it always-expanded like the
    // old map rather than the collapsed "ⓘ" toggle.
    attributionControl: { compact: false },
    ...options,
  })

  // Keep it a flat, north-up map: no touch two-finger rotate.
  map.touchZoomRotate.disableRotation()

  // Zoom in/out buttons, top-right — no compass (the map is always north-up). The
  // mobile map-split toggle lives at the bottom, so top-right stays clear.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

  return map
}

// Re-apply the Protomaps flavor when the site theme toggles. setStyle swaps the
// whole basemap style, which would otherwise drop any sources/layers a caller
// added at runtime (e.g. the neighborhood boundaries). `transformStyle` carries
// those custom sources/layers over onto the new base style in one atomic swap —
// no manual re-add, and the style diff preserves their feature-state. DOM overlays
// (Markers/Popups) survive regardless.
export function watchThemeChanges(
  map: maplibregl.Map,
  onThemeSwapped?: (dark: boolean) => void,
): void {
  let dark = isDarkTheme()

  const observer = new MutationObserver(() => {
    const next = isDarkTheme()
    if (next === dark) {
      return
    }

    dark = next
    // After the new style (with any carried custom layers) is in place, let the
    // caller re-apply theme-dependent paint that lives outside the base style —
    // e.g. boundary colors read from CSS tokens that differ light/dark.
    if (onThemeSwapped) {
      map.once('styledata', () => onThemeSwapped(dark))
    }
    map.setStyle(buildBasemapStyle(next), {
      transformStyle: (previous, nextStyle) => {
        if (!previous) {
          return nextStyle
        }
        // Sources/layers in the live style but NOT in the base Protomaps style are
        // our runtime additions; carry them over (layers stay on top).
        const baseSourceIds = new Set(Object.keys(nextStyle.sources))
        const carriedSources = Object.fromEntries(
          Object.entries(previous.sources).filter(([id]) => !baseSourceIds.has(id)),
        )
        const baseLayerIds = new Set(nextStyle.layers.map((layer) => layer.id))
        const carriedLayers = previous.layers.filter((layer) => !baseLayerIds.has(layer.id))

        return {
          ...nextStyle,
          sources: { ...nextStyle.sources, ...carriedSources },
          layers: [...nextStyle.layers, ...carriedLayers],
        }
      },
    })
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}
