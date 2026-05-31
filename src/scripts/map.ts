import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'

export function initMap(mapSelector = '[data-map]'): (() => void) | undefined {
  const el = document.querySelector<HTMLElement>(mapSelector)

  if (!el) {
    return undefined
  }

  const scope: Element | Document = el.closest('[data-filter-root]') ?? document

  const map = L.map(el, { scrollWheelZoom: true, touchZoom: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, L.Marker>()

  let activeItem: HTMLElement | null = null

  function detailsOf(item: HTMLElement): HTMLDetailsElement | null {
    return item.querySelector<HTMLDetailsElement>('details')
  }

  // One shared "active" item drives both the list (expanded <details> + accent
  // highlight) and the map (open tooltip + selected marker). Selecting the
  // active item again clears it; nothing is ever hidden.
  function setActive(item: HTMLElement | null, options: { pan?: boolean } = {}): void {
    if (activeItem && activeItem !== item) {
      activeItem.classList.remove('is-active')
      const previous = detailsOf(activeItem)
      if (previous) {
        previous.open = false
      }
      markers.get(activeItem)?.closeTooltip()
    }

    if (item && item === activeItem) {
      // Toggle off.
      item.classList.remove('is-active')
      const details = detailsOf(item)
      if (details) {
        details.open = false
      }
      markers.get(item)?.closeTooltip()
      activeItem = null

      return
    }

    activeItem = item
    if (!item) {
      return
    }

    item.classList.add('is-active')
    const details = detailsOf(item)
    if (details) {
      details.open = true
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const marker = markers.get(item)
    if (marker) {
      marker.openTooltip()
      if (options.pan) {
        map.panTo(marker.getLatLng())
      }
    }
  }

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
        // Match the neighborhoods map: a styled hover tooltip (.map-tooltip)
        // rather than a click popup.
        marker = L.marker([lat, lng], { icon }).bindTooltip(item.dataset.title ?? '', {
          className: 'map-tooltip',
          direction: 'top',
          opacity: 1,
          offset: [0, -26],
        })
        marker.on('click', () => setActive(item, { pan: true }))
        markers.set(item, marker)
      }

      if (item.hidden) {
        marker.remove()
        if (item === activeItem) {
          setActive(null)
        }
      } else {
        marker.addTo(map)
        bounds.push([lat, lng])
      }
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    }
  }

  // Clicking a list title selects its item (and pans the map to its marker).
  // The title lives in a <summary>, so suppress the native toggle and let
  // setActive own the open/close state.
  for (const item of items) {
    const title = item.querySelector<HTMLElement>('.list-title')
    if (!title) {
      continue
    }
    title.classList.add('is-clickable')
    title.addEventListener('click', (event) => {
      event.preventDefault()
      setActive(item, { pan: true })
    })
  }

  sync()
  scope.addEventListener('filter:changed', sync)

  // Returned so callers can fix sizing after the map becomes visible.
  return () => map.invalidateSize()
}
