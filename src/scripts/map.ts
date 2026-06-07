import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'

export interface MapApi {
  // Fix Leaflet's sizing after the map becomes visible.
  refresh: () => void
  // Open/close a place's popup (driven by the shared list-title click handler).
  togglePopup: (item: HTMLElement) => void
  // Clear the current selection (closes the open popup → de-selects the row).
  deselect: () => void
}

export function initMap(mapSelector = '[data-map]'): MapApi | undefined {
  const el = document.querySelector<HTMLElement>(mapSelector)

  if (!el) {
    return undefined
  }

  const scope: Element | Document = el.closest('[data-filter-root]') ?? document

  // Keep the selection sticky: clicking empty map space should not close the
  // open popup (which would visually de-select a place while its list row stays
  // active). Selection only changes when another marker is clicked.
  const map = L.map(el, {
    closePopupOnClick: false,
    scrollWheelZoom: true,
    touchZoom: true,
    minZoom: 10,
    maxZoom: 16,
    zoomSnap: 0.5,
  })
  addThemedTiles(map)

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, L.Marker>()

  // Coordinates of every item (ignoring the current filter), so the map can be
  // given a view even when a filter matches nothing.
  const allBounds = items
    .map((item) => (item.dataset.coords ?? '').split(',').map(Number))
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lat, lng]) => [lat, lng] as L.LatLngTuple)
  let viewInitialized = false

  let activeItem: HTMLElement | null = null

  // The open popup is the single source of truth for selection. Leaflet already
  // opens/closes the popup on marker click (and via its X button); we only mirror
  // that state onto the list row through the marker's `popupopen`/`popupclose`
  // events below. Doing it this way keeps the map and list in sync no matter how
  // the popup was opened or closed, and avoids fighting Leaflet's own toggling.
  // Accent-highlight the selected place's emoji marker (its DOM element carries
  // the `.emoji-marker` class; `.is-selected` swaps its border to the accent).
  function highlightMarker(item: HTMLElement, selected: boolean): void {
    markers.get(item)?.getElement()?.classList.toggle('is-selected', selected)
  }

  function activate(item: HTMLElement, options: { pan?: boolean } = {}): void {
    if (activeItem === item) {
      return
    }
    if (activeItem) {
      activeItem.classList.remove('is-active')
      activeItem.querySelector('.list-title')?.setAttribute('aria-expanded', 'false')
      highlightMarker(activeItem, false)
    }

    activeItem = item
    item.classList.add('is-active')
    item.querySelector('.list-title')?.setAttribute('aria-expanded', 'true')
    highlightMarker(item, true)
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const marker = markers.get(item)
    if (marker && options.pan) {
      map.panTo(marker.getLatLng())
    }
  }

  function deactivate(item: HTMLElement): void {
    if (activeItem !== item) {
      return
    }
    activeItem = null
    item.classList.remove('is-active')
    item.querySelector('.list-title')?.setAttribute('aria-expanded', 'false')
    highlightMarker(item, false)
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
          popupAnchor: [0, -30],
          // tooltipAnchor: [0, -24],
        })
        // Hover shows a tooltip; clicking opens the richer popup. While a place
        // is active (its popup is open) we suppress that place's tooltip so the
        // two never stack — the popup is simply left in place. Address lines
        // render under the title when present.
        const title = item.dataset.title ?? ''
        const addressLines = (item.dataset.address ?? '').split('\n').filter(Boolean)
        const infoHtml = addressLines.length
          ? `<h2><a href=${`/food/${item.id}`}>${title}</a></h2><span class="tip-address">${addressLines.join('<br>')}</span>`
          : `<strong>${title}</strong>`

        // The clickable popup also gets the source link (AllTrails, Instagram,
        // …). The hover tooltip can't — it's pointer-events:none — so it stays
        // info-only.
        const url = item.dataset.url ?? ''
        const google = item.dataset.google ?? ''
        const links = [
          url &&
            `<a class="popup-link" href="${url}" target="_blank" rel="noopener">Website ↗</a>`,
          google &&
            `<a class="popup-link" href="${google}" target="_blank" rel="noopener">Google Maps ↗</a>`,
        ]
          .filter(Boolean)
          .join('')
        const popupHtml = `${infoHtml}${links}`

        const placeMarker = L.marker([lat, lng], { icon }).bindPopup(popupHtml, {
          className: 'food-popup',
          offset: [0, 0],
          maxWidth: 350,
          minWidth: 220,
        })
        // .bindTooltip(infoHtml, { className: 'map-tooltip', direction: 'top', opacity: 1 })
        // Selection follows the popup: opening it (by click, the list, or
        // anything else) selects the row; closing it (toggle-click or the X)
        // de-selects it.
        placeMarker.on('popupopen', () => {
          // placeMarker.closeTooltip()
          activate(item, { pan: true })
        })
        placeMarker.on('popupclose', () => deactivate(item))
        // Don't stack the hover tooltip over the active place's popup.
        // placeMarker.on('tooltipopen', () => {
        //   if (item === activeItem) {
        //     placeMarker.closeTooltip()
        //   }
        // })
        marker = placeMarker
        markers.set(item, marker)
      }

      if (item.hidden) {
        // Removing the marker closes its popup, which de-selects via popupclose.
        marker.remove()
      } else {
        marker.addTo(map)
        bounds.push([lat, lng])
      }
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
      viewInitialized = true
    } else if (!viewInitialized) {
      // A deep-linked filter matched nothing: still give the map a view so it
      // renders an empty map instead of erroring with no center/zoom set.
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 14 })
      } else {
        map.setView([38.627, -90.2], 11)
      }
      viewInitialized = true
    }
  }

  // Open/close a place's popup on demand (the shared list-title click handler in
  // views.ts calls this in map view). The popup's open/close events keep the row
  // selection in sync; activeItem decides whether a click opens or closes.
  function togglePopup(item: HTMLElement): void {
    const marker = markers.get(item)
    if (!marker) {
      return
    }
    if (item === activeItem) {
      marker.closePopup()
    } else {
      marker.openPopup()
    }
  }

  // Close the open popup, which cascades through popupclose → deactivate to clear
  // the row's `is-active` state and the marker highlight.
  function deselect(): void {
    if (activeItem) {
      markers.get(activeItem)?.closePopup()
    }
  }

  sync()
  scope.addEventListener('filter:changed', sync)

  return { refresh: () => map.invalidateSize(), togglePopup, deselect }
}
