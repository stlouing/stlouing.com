import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'

// Escape text before it goes into the popup's innerHTML.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Lucide map-pin, inlined for the neighborhood pin in the popup.
const PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'

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

  // Bottom edge (viewport px) of the sticky chrome stacked above the map — the
  // site header plus the filter toolbar. A popup opened near the top is nudged
  // below this so its title isn't hidden behind them (the cut-off popups on mobile).
  function topChromeBottom(): number {
    return ['.site-header', '.secondary-header']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .reduce(
        (bottom, node) => (node ? Math.max(bottom, node.getBoundingClientRect().bottom) : bottom),
        0,
      )
  }
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
        const titleHtml = `<h2><a href="/food/${item.id}">${escapeHtml(title)}</a></h2>`

        // Cuisine chip(s) + a neighborhood pin, mirroring the list row's facets.
        const markerEmoji = item.dataset.marker ?? ''
        const cuisines = (item.dataset.cuisine ?? '').split('|').filter(Boolean)
        const neighborhood = item.dataset.neighborhood ?? ''
        const chips = cuisines
          .map(
            (cuisine) =>
              `<button type="button" class="popup-chip" data-filter-set="cuisine" data-filter-value="${escapeHtml(cuisine)}">${markerEmoji} ${escapeHtml(cuisine)}</button>`,
          )
          .join('')
        const pin = neighborhood
          ? `<button type="button" class="popup-pin" data-filter-set="neighborhood" data-filter-value="${escapeHtml(neighborhood)}">${PIN_SVG} ${escapeHtml(neighborhood)}</button>`
          : ''
        const metaHtml = chips || pin ? `<div class="popup-meta">${chips}${pin}</div>` : ''

        const addressLines = (item.dataset.address ?? '').split('\n').filter(Boolean)
        const addressHtml = addressLines.length
          ? `<span class="tip-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
          : ''

        // A short teaser of the writeup, when there is one.
        const excerptText = item.dataset.excerpt ?? ''
        const excerptHtml = excerptText
          ? `<p class="tip-excerpt">${escapeHtml(excerptText)}</p>`
          : ''

        // Buttons: "View more" (the writeup) plus the external sources.
        const url = item.dataset.url ?? ''
        const instagram = item.dataset.instagram ?? ''
        const google = item.dataset.google ?? ''
        // "View more" gets its own centered, ruled line; the external sources sit
        // in a button row below it.
        const moreHtml = excerptText
          ? `<a class="popup-more-link" href="/food/${item.id}">View more</a>`
          : ''
        const sources = [
          url && `<a class="popup-btn" href="${url}" target="_blank" rel="noopener">Website</a>`,
          instagram &&
            `<a class="popup-btn" href="${instagram}" target="_blank" rel="noopener">Instagram</a>`,
          google &&
            `<a class="popup-btn" href="${google}" target="_blank" rel="noopener">Directions</a>`,
        ]
          .filter(Boolean)
          .join('')
        const sourcesHtml = sources ? `<div class="popup-actions">${sources}</div>` : ''

        const popupHtml = `${titleHtml}${metaHtml}${addressHtml}${excerptHtml}${moreHtml}${sourcesHtml}`

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
          // Keep the whole popup on-screen: below the sticky header + filter
          // toolbar at the top, and clear of the map's left/right edges (the
          // sticky chrome overlays the top on mobile, and a wide popup near an
          // edge can otherwise spill off-screen). The panBy offset is
          // (current edge − desired edge), which nudges that edge into place.
          requestAnimationFrame(() => {
            const popupEl = placeMarker.getPopup()?.getElement()
            if (!popupEl) {
              return
            }
            const popupRect = popupEl.getBoundingClientRect()
            const mapRect = map.getContainer().getBoundingClientRect()
            const pad = 16
            const topLimit = topChromeBottom() + 8
            let dx = 0
            let dy = 0
            if (popupRect.top < topLimit) {
              dy = popupRect.top - topLimit
            }
            if (popupRect.left < mapRect.left + pad) {
              dx = popupRect.left - (mapRect.left + pad)
            } else if (popupRect.right > mapRect.right - pad) {
              dx = popupRect.right - (mapRect.right - pad)
            }
            if (dx !== 0 || dy !== 0) {
              map.panBy([dx, dy], { animate: true })
            }
          })
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
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
      viewInitialized = true
    } else if (!viewInitialized) {
      // A deep-linked filter matched nothing: still give the map a view so it
      // renders an empty map instead of erroring with no center/zoom set.
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 12 })
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
