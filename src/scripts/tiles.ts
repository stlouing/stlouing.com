import * as L from 'leaflet'
import { leafletLayer } from 'protomaps-leaflet'

// Required tile attribution. The basemap is derived from OpenStreetMap and
// rendered by Protomaps; OSM's ODbL mandates a visible OpenStreetMap credit.
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const protomapsAttribution = `<a href="https://protomaps.com">Protomaps</a> ${osmAttribution}`

// Vector basemap slice (a St. Louis-area cut of the global Protomaps build). The
// ~29 MB .pmtiles is kept out of the repo: local dev reads it from public/, while
// production reads it from object storage via PUBLIC_PMTILES_URL (set in CI, so the
// host URL never lands in the repo). protomaps-leaflet reads either over range requests.
const localPmtilesUrl = `${import.meta.env.BASE_URL}stl.pmtiles`
// `||` (not `??`) so an unset CI variable — which GitHub Actions passes as an
// empty string, not undefined — also falls back to the local path.
const protomapsTilesUrl = import.meta.env.PUBLIC_PMTILES_URL || localPmtilesUrl

// The extract was built to z14; protomaps-leaflet overzooms past that instead
// of going blank, so the map stays usable when zoomed in tight.
const protomapsMaxDataZoom = 14

// protomaps-leaflet renders the basemap to a canvas sized `256 * devicePixelRatio`
// per tile. On Windows, Chrome's GPU process crashes the whole tab when these
// GPU-accelerated canvases get large, and Windows display scaling (125–200%)
// pushes devicePixelRatio to 1.25–2 — multiplying the per-tile memory until it
// blows up on zoom/pan/filter. Render at 1× on Windows to keep the canvas small
// (a slightly softer basemap, but no crash); other platforms keep retina up to 2×.
// Tunable: raise the Windows value toward 1.5 if the basemap looks too soft and
// the crash doesn't return. See Chromium GPU-canvas memory issues for background.
const renderDevicePixelRatio = ((): number => {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const isWindows = typeof navigator !== 'undefined' && /\bWindows NT\b/.test(navigator.userAgent)

  return isWindows ? 1 : Math.min(dpr, 2)
})()

function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

/**
 * Adds the vector basemap (protomaps-leaflet against the self-hosted St. Louis
 * pmtiles slice). Renders crisp at any DPI and swaps between the built-in
 * light/dark flavors live when the site theme toggles, watched via the <html>
 * data-theme attribute.
 */
export function addThemedTiles(map: L.Map): void {
  function build(dark: boolean): L.GridLayer {
    return leafletLayer({
      url: protomapsTilesUrl,
      flavor: dark ? 'dark' : 'light',
      maxDataZoom: protomapsMaxDataZoom,
      attribution: protomapsAttribution,
      devicePixelRatio: renderDevicePixelRatio,
      // Every zoom step re-rasterizes the vector basemap onto GPU-accelerated
      // canvases; a burst of zooming stacks those up until a high-refresh /
      // large-display / flaky-driver machine's GPU process dies (freezing the
      // tab across Chrome, Firefox, and Edge alike). These two GridLayer options
      // — leafletLayer extends L.GridLayer, so they pass straight through — cut
      // that churn for everyone, with no visitor setting to change:
      //   updateWhenZooming:false — during a zoom the existing tiles are just
      //     transform-scaled and the expensive re-render runs once at zoom-END,
      //     not on every intermediate level (tiles sharpen a beat after settling).
      //   keepBuffer:1 (default 2) — retain fewer off-screen tile canvases, so a
      //     rapid pan/zoom holds less GPU-canvas memory at once.
      // (If needed, `updateInterval` can be raised from its 200ms default to
      // batch grid updates further.)
      updateWhenZooming: false,
      keepBuffer: 1,
    }) as unknown as L.GridLayer
  }

  let dark = isDarkTheme()
  let layer = build(dark).addTo(map)

  const observer = new MutationObserver(() => {
    const next = isDarkTheme()
    if (next === dark) {
      return
    }

    dark = next
    map.removeLayer(layer)
    layer = build(dark).addTo(map)
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
}
