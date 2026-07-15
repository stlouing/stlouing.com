import maplibregl from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'

// The same teardrop pin the neighborhood map uses (shared .marker-pin styles for
// the ring + dot + shadow), but the body is accent. The fill goes in a `style`
// attribute (not the `fill` presentation attribute) because var() only resolves in
// a CSS context — so it themes with dark mode and never falls back to invisible.
const PIN_SVG =
  '<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true">' +
  '<path class="marker-pin-body" style="fill:var(--color-accent)" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" />' +
  '<circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>'

// Turn a placeholder box into a small "where is it" map: the themed basemap
// centered on one pin. The full filterable map lives at /food. Skips silently
// without valid coords.
export function initLocator(el: HTMLElement): void {
  // Rows store "lat,lng" (Leaflet's order); MapLibre wants [lng, lat].
  const [lat, lng] = (el.dataset.coords ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return
  }

  const map = createBasemapMap(el, {
    center: [lng, lat],
    // Zoomed out enough to place the spot in its surroundings, not just a few
    // blocks (a "where is it" view, not a street close-up).
    zoom: 11,
    minZoom: 10,
    maxZoom: 15,
    // A plain scroll or one-finger drag moves the PAGE, not the map; two fingers
    // (or ⌘/ctrl + scroll) pan/zoom it, with a hint overlay. MapLibre's built-in
    // replacement for the old hand-rolled two-finger gesture gating, so a locator
    // sitting inline in a scrolling page never traps the reader.
    cooperativeGestures: true,
    // Small map: collapse the required OSM/Protomaps credit to the "ⓘ" toggle
    // rather than a wide line across the bottom.
    attributionControl: { compact: true },
  })
  watchThemeChanges(map)

  // Non-interactive accent pin at the spot (pointer-events off so it never eats a
  // gesture meant for the map).
  const element = document.createElement('div')
  element.className = 'locator-pin'
  element.style.pointerEvents = 'none'
  element.innerHTML = PIN_SVG
  new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)
}
