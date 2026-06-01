import * as L from 'leaflet'

// Required tile attribution. OpenStreetMap's policy and CARTO's terms both
// mandate visible credit; CARTO additionally needs its own line since its
// basemap is built on OSM data.
const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const cartoAttribution = `${osmAttribution} &copy; <a href="https://carto.com/attributions">CARTO</a>`

// Base map tiles that follow the site theme. Light is standard OpenStreetMap;
// dark is CARTO's dark basemap (keyless, attribution-only) — a real dark map
// rather than a CSS invert of the light tiles. The dark layer gets a class so
// CSS can lift its brightness (CARTO dark is very dim out of the box).
const lightTiles = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: { maxZoom: 19, attribution: osmAttribution } as L.TileLayerOptions,
}

const darkTiles = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  options: {
    maxZoom: 20,
    subdomains: 'abcd',
    className: 'tiles-dark',
    attribution: cartoAttribution,
  } as L.TileLayerOptions,
}

function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

/**
 * Adds a base tile layer that follows the site theme and swaps tiles live when
 * the user toggles dark mode (watched via the <html> data-theme attribute).
 */
export function addThemedTiles(map: L.Map): void {
  function build(dark: boolean): L.TileLayer {
    const tiles = dark ? darkTiles : lightTiles

    return L.tileLayer(tiles.url, tiles.options)
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
