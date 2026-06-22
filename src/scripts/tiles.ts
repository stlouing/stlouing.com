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
