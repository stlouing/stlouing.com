import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'

// A filled accent map-pin (Lucide's outline pin, solid). CSS variables resolve
// against :root once it's in the DOM, so it themes with dark mode for free.
const PIN_SVG =
  '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path fill="var(--color-accent)" d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
  '<circle fill="var(--color-background)" cx="12" cy="10" r="3"/></svg>'

// Turn a placeholder box into a small "where is it" map: the themed basemap
// centered on one pin. Page-scroll zoom is off so it never hijacks scrolling; the
// full filterable map lives at /food. Skips silently without valid coords.
export function initLocator(el: HTMLElement): void {
  const [lat, lng] = (el.dataset.coords ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return
  }

  // Pannable/zoomable so a reader can get their bearings, but with page-scroll
  // zoom off so hovering it never hijacks the page scroll. The full filterable
  // map lives at /food.
  const map = L.map(el, {
    center: [lat, lng],
    zoom: 15,
    minZoom: 11,
    maxZoom: 17,
    scrollWheelZoom: false,
  })
  // Keep the required OSM/Protomaps credit clear of the corner tag.
  map.attributionControl.setPosition('bottomleft')
  addThemedTiles(map)

  const icon = L.divIcon({
    className: 'locator-pin',
    html: PIN_SVG,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  })
  L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(map)
}
