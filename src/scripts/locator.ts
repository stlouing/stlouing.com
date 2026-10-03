import maplibregl from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'

const PIN_SVG =
  '<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true">' +
  '<path class="marker-pin-body" style="fill:var(--color-pin)" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" />' +
  '<circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>'

export function initLocator(el: HTMLElement): void {
  const [lat, lng] = (el.dataset.coords ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return
  }

  const map = createBasemapMap(el, {
    center: [lng, lat],
    zoom: 11,
    minZoom: 10,
    maxZoom: 15,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  })
  watchThemeChanges(map)

  const element = document.createElement('div')
  element.className = 'locator-pin'
  element.style.pointerEvents = 'none'
  element.innerHTML = PIN_SVG
  new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)
}
