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
      highlightMarker(activeItem, false)
    }

    activeItem = item
    item.classList.add('is-active')
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
        // Selection follows the popup: opening it (by click, the list, or
        // anything else) selects the row; closing it (toggle-click or the X)
        // de-selects it.
        placeMarker.on('popupopen', () => {
          placeMarker.closeTooltip()
          activate(item, { pan: true })
        })
        placeMarker.on('popupclose', () => deactivate(item))
        // Don't stack the hover tooltip over the active place's popup.
        placeMarker.on('tooltipopen', () => {
          if (item === activeItem) {
            placeMarker.closeTooltip()
          }
        })
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

  const root = scope instanceof Element ? scope : null

  // In map view, clicking a list title toggles its place's popup (expand + pan)
  // instead of following its link; the popup events keep the row in sync. In list
  // view the title is a normal link to the detail page, so we leave it alone.
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
      const marker = markers.get(item)
      if (!marker) {
        return
      }
      if (item === activeItem) {
        marker.closePopup()
      } else {
        marker.openPopup()
      }
    })
  }

  sync()
  scope.addEventListener('filter:changed', sync)

  // Returned so callers can fix sizing after the map becomes visible.
  return () => map.invalidateSize()
}
