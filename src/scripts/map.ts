import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'

/**
 * Leaflet + OpenStreetMap island. Reads coordinates straight from the rendered
 * `[data-filter-item]` rows (data-coords / data-title) so the map and
 * the list share one source of truth, and re-syncs markers whenever the filter
 * emits "filter:changed". Uses circle markers to avoid bundler icon-path issues
 * and to stay on-theme via the --color-accent token.
 */
export function initMap(mapSelector = '[data-map]'): (() => void) | undefined {
  const el = document.querySelector<HTMLElement>(mapSelector)

  if (!el) {
    return undefined
  }

  const scope: Element | Document = el.closest('[data-filter-root]') ?? document

  const map = L.map(el, { scrollWheelZoom: true, touchZoom: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, L.Marker>()

  function sync(): void {
    const bounds: L.LatLngTuple[] = []

    for (const item of items) {
      const [lat, lng] = (item.dataset.coords ?? '').split(',').map(Number)
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue

      let marker = markers.get(item)
      if (!marker) {
        const icon = L.divIcon({
          className: 'emoji-marker',
          html: item.dataset.marker ?? '📍',
          iconSize: [36, 36],
          iconAnchor: [22, 22],
          popupAnchor: [0, -26],
        })
        marker = L.marker([lat, lng], { icon }).bindPopup(item.dataset.title ?? '')
        markers.set(item, marker)
      }

      if (item.hidden) {
        marker.remove()
      } else {
        marker.addTo(map)
        bounds.push([lat, lng])
      }
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    }
  }

  sync()
  scope.addEventListener('filter:changed', sync)

  // Returned so callers can fix sizing after the map becomes visible.
  return () => map.invalidateSize()
}
