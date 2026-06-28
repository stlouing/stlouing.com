import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'
import { buildPopupHtml, PIN_SVG, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView, zoomEaseOptions } from './map-shared'

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

  // Clicking empty map space closes the open popup, which cascades through
  // popupclose → deactivate to de-select the row (matching the neighborhood map).
  // Leaflet's default closePopupOnClick handles this.
  const map = L.map(el, {
    ...zoomEaseOptions,
    scrollWheelZoom: true,
    touchZoom: true,
    minZoom: 10,
    maxZoom: 16,
    zoomSnap: 0.5,
  })
  addThemedTiles(map)

  // Bottom edge (viewport px) of the sticky chrome stacked above the map — the
  // site header plus the filter toolbar (see keepPopupInView in map-shared).
  const autoPanPaddingTopLeft = L.point(16, 16)
  const autoPanPaddingBottomRight = L.point(16, 24)

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

  function activate(item: HTMLElement): void {
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
    // Always bring the selected row to the top of the pane (scroll-padding keeps
    // it clear of the sticky header), not just the nearest edge.
    item.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    // Close any open popup before re-fitting. A popup opened from a marker that
    // survives the new filter (e.g. clicking its "University City" pin) would
    // otherwise stay open and get reprojected on every later zoom/pan — extra work
    // on an already GPU-stressed canvas, and a stale bit of UI. popupclose →
    // deactivate clears the selection.
    map.closePopup()

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
        // Cuisine chip(s) + a neighborhood pin, mirroring the list row's facets.
        const markerEmoji = item.dataset.marker ?? ''
        const cuisines = (item.dataset.cuisine ?? '').split('|').filter(Boolean)
        const neighborhood = item.dataset.neighborhood ?? ''
        const chips: PopupChip[] = cuisines.map((cuisine) => ({
          label: cuisine,
          leadingHtml: markerEmoji,
          filterSet: 'cuisine',
          filterValue: cuisine,
        }))
        if (neighborhood) {
          chips.push({
            label: neighborhood,
            leadingHtml: PIN_SVG,
            filterSet: 'neighborhood',
            filterValue: neighborhood,
          })
        }

        const url = item.dataset.url ?? ''
        const instagram = item.dataset.instagram ?? ''
        const google = item.dataset.google ?? ''
        const sources = [
          url && { label: 'Website', href: url },
          instagram && { label: 'Instagram', href: instagram },
          google && { label: 'Google Maps', href: google },
        ].filter(Boolean) as PopupSource[]

        // "View more" only when there's a writeup teaser to deep-link into.
        const excerptText = item.dataset.excerpt ?? ''
        const popupHtml = buildPopupHtml({
          title: item.dataset.title ?? '',
          link: `/food/${item.id}`,
          tagline: item.dataset.tagline ?? '',
          chips,
          addressLines: (item.dataset.address ?? '').split('\n').filter(Boolean),
          excerpt: excerptText,
          sources,
          showMore: Boolean(excerptText),
        })

        const placeMarker = L.marker([lat, lng], { icon }).bindPopup(popupHtml, {
          className: 'food-popup',
          offset: [0, 0],
          maxWidth: 330,
          minWidth: 210,
          autoPanPaddingTopLeft,
          autoPanPaddingBottomRight,
        })
        // .bindTooltip(infoHtml, { className: 'map-tooltip', direction: 'top', opacity: 1 })
        // Selection follows the popup: opening it (by click, the list, or
        // anything else) selects the row; closing it (toggle-click or the X)
        // de-selects it.
        placeMarker.on('popupopen', () => {
          // Select the row, but DON'T re-center the marker — centering overrides
          // Leaflet's auto-pan and pushes a tall popup's title up under the chrome.
          activate(item)
          // Keep the whole popup on-screen (below the sticky chrome, clear of the
          // map edges) rather than leaving it to Leaflet's jerky autoPan.
          keepPopupInView(map, () => placeMarker.getPopup()?.getElement() ?? undefined)
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

    // `animate: false`: this runs on every filter change, and an animated fit is a
    // multi-frame basemap repaint. Stacked up (e.g. per keystroke) those repaints
    // balloon GPU-canvas memory and can crash the tab on Windows Chrome — jump
    // instantly instead.
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12, animate: false })
      viewInitialized = true
    } else if (!viewInitialized) {
      // A deep-linked filter matched nothing: still give the map a view so it
      // renders an empty map instead of erroring with no center/zoom set.
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 12, animate: false })
      } else {
        map.setView([38.627, -90.2], 11, { animate: false })
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
