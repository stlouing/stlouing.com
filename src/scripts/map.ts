import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'

export function initMap(mapSelector = '[data-map]'): (() => void) | undefined {
  const el = document.querySelector<HTMLElement>(mapSelector)

  if (!el) {
    return undefined
  }

  const scope: Element | Document = el.closest('[data-filter-root]') ?? document

  // Keep the selection sticky: clicking empty map space should not close the
  // open popup (which would visually de-select a place while its list row stays
  // active). Selection only changes when another marker is clicked.
  const map = L.map(el, { scrollWheelZoom: true, touchZoom: true, closePopupOnClick: false })
  addThemedTiles(map)

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, L.Marker>()

  let activeItem: HTMLElement | null = null
  // Set while we close a popup ourselves (switching/toggling), so the marker's
  // `popupclose` handler can tell our closes apart from the user pressing the X.
  let closingActivePopup = false

  function closePopupFor(item: HTMLElement): void {
    closingActivePopup = true
    markers.get(item)?.closePopup()
    closingActivePopup = false
  }

  // One shared "active" item drives both the list (the `is-active` class shows
  // the description + accent highlight in map view) and the map (open popup +
  // panned marker). Selecting the active item again clears it.
  function setActive(item: HTMLElement | null, options: { pan?: boolean } = {}): void {
    if (activeItem && activeItem !== item) {
      activeItem.classList.remove('is-active')
      closePopupFor(activeItem)
    }

    if (item && item === activeItem) {
      // Toggle off.
      item.classList.remove('is-active')
      closePopupFor(item)
      activeItem = null

      return
    }

    activeItem = item
    if (!item) {
      return
    }

    item.classList.add('is-active')
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const marker = markers.get(item)
    if (marker) {
      marker.closeTooltip()
      marker.openPopup()
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
          tooltipAnchor: [0, -24],
        })
        // Hover shows a tooltip; clicking opens the richer popup. While a place
        // is active (its popup is open) we suppress that place's tooltip so the
        // two never stack — the popup is simply left in place. Address lines
        // render under the title when present.
        const title = item.dataset.title ?? ''
        const addressLines = (item.dataset.address ?? '').split('\n').filter(Boolean)
        const infoHtml = addressLines.length
          ? `<strong>${title}</strong><br><span class="tip-address">${addressLines.join('<br>')}</span>`
          : `<strong>${title}</strong>`

        const placeMarker = L.marker([lat, lng], { icon })
          .bindPopup(infoHtml, { className: 'food-popup', offset: [0, 0] })
          .bindTooltip(infoHtml, { className: 'map-tooltip', direction: 'top', opacity: 1 })
        placeMarker.on('click', () => setActive(item, { pan: true }))
        // Keep the hover tooltip off the active place — its popup stands alone.
        placeMarker.on('tooltipopen', () => {
          if (item === activeItem) {
            placeMarker.closeTooltip()
          }
        })
        // Closing the popup with its X de-selects the list row too; our own
        // programmatic closes are flagged so they don't trigger this.
        placeMarker.on('popupclose', () => {
          if (!closingActivePopup && item === activeItem) {
            setActive(null)
          }
        })
        marker = placeMarker
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

  const root = scope instanceof Element ? scope : null

  // In map view, clicking a list title selects its item (expand + pan) instead
  // of following its link. In list view the title is a normal link to the
  // detail page, so we leave the click alone.
  for (const item of items) {
    const title = item.querySelector<HTMLElement>('.list-title')
    if (!title) {
      continue
    }
    title.addEventListener('click', (event) => {
      if (root?.getAttribute('data-view') !== 'map') {
        return
      }
      event.preventDefault()
      setActive(item, { pan: true })
    })
  }

  sync()
  scope.addEventListener('filter:changed', sync)

  // Returned so callers can fix sizing after the map becomes visible.
  return () => map.invalidateSize()
}
