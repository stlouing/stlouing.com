import maplibregl from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, PIN_SVG, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView } from './map-shared'

export interface MapApi {
  // Fix the map's sizing after the container becomes visible.
  refresh: () => void
  // Open/close a place's popup (driven by the shared list-title click handler).
  togglePopup: (item: HTMLElement) => void
  // Clear the current selection (closes the open popup → de-selects the row).
  deselect: () => void
}

// The list rows store coordinates as "lat,lng" (Leaflet's order); MapLibre wants
// [lng, lat]. Parse + swap in one place so the rest of the file is unambiguous.
function lngLatFromItem(item: HTMLElement): [number, number] | null {
  const [lat, lng] = (item.dataset.coords ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return [lng, lat]
}

export function initMap(mapSelector = '[data-map]'): MapApi | undefined {
  const el = document.querySelector<HTMLElement>(mapSelector)

  if (!el) {
    return undefined
  }

  const scope: Element | Document = el.closest('[data-filter-root]') ?? document

  const map = createBasemapMap(el, { minZoom: 10, maxZoom: 15 })
  // Marker-only map: DOM markers survive a style swap, so there's nothing to
  // re-add when the theme (and thus the basemap flavor) changes.
  watchThemeChanges(map)

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, maplibregl.Marker>()
  const popups = new Map<HTMLElement, maplibregl.Popup>()

  // Coordinates of every item (ignoring the current filter), so the map can be
  // given a view even when a filter matches nothing.
  const allLngLats = items
    .map((item) => lngLatFromItem(item))
    .filter((coord): coord is [number, number] => coord !== null)

  let viewInitialized = false
  let activeItem: HTMLElement | null = null

  // The open popup is the single source of truth for selection: the popup's
  // open/close events mirror that state onto the list row (and the marker's accent
  // highlight), no matter how the popup was opened or closed.
  function highlightMarker(item: HTMLElement, selected: boolean): void {
    markers.get(item)?.getElement().classList.toggle('is-selected', selected)
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

  function closeActivePopup(): void {
    if (activeItem) {
      popups.get(activeItem)?.remove()
    }
  }

  // Build a place's emoji marker + popup once, lazily. The popup carries the same
  // card the list row shows: cuisine/neighborhood chips (which filter), a tagline,
  // an address, a writeup teaser, and external source buttons.
  function buildMarker(item: HTMLElement, lngLat: [number, number]): maplibregl.Marker {
    const element = document.createElement('div')
    element.className = 'emoji-marker'
    element.textContent = item.dataset.marker ?? '📍'

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

    // closeOnClick:false — we manage closing (map-click + single-open) so the row
    // selection stays in sync; a radial offset lifts the popup clear of the marker.
    const popup = new maplibregl.Popup({
      className: 'food-popup',
      closeButton: true,
      closeOnClick: false,
      maxWidth: '330px',
      offset: 22,
      focusAfterOpen: false,
    }).setHTML(popupHtml)

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(lngLat)
      .setPopup(popup)

    // Selection follows the popup: opening it selects the row; closing it (X,
    // toggle-click, or a map-space click) de-selects it. Only one popup is open at
    // a time — opening a new one closes the previously selected place's popup.
    popup.on('open', () => {
      if (activeItem && activeItem !== item) {
        popups.get(activeItem)?.remove()
      }
      activate(item)
      // Keep the whole popup on-screen (below the sticky chrome, clear of the map
      // edges); MapLibre popups don't auto-pan.
      keepPopupInView(map, () => popup.getElement() ?? undefined)
    })
    popup.on('close', () => deactivate(item))

    markers.set(item, marker)
    popups.set(item, popup)

    return marker
  }

  // `animate` is false for the first fit (instant initial framing on load) and
  // true for later filter changes (a smooth re-fit as the visible set narrows).
  function sync(animate: boolean): void {
    // Close any open popup before re-fitting so a stale selection doesn't linger
    // when the filter changes. popupclose → deactivate clears the row.
    closeActivePopup()

    const bounds = new maplibregl.LngLatBounds()
    let anyVisible = false

    for (const item of items) {
      const lngLat = lngLatFromItem(item)
      if (!lngLat) {
        continue
      }

      let marker = markers.get(item)
      if (!marker) {
        marker = buildMarker(item, lngLat)
      }

      if (item.hidden) {
        marker.remove()
      } else {
        marker.addTo(map)
        bounds.extend(lngLat)
        anyVisible = true
      }
    }

    if (anyVisible) {
      map.fitBounds(bounds, { padding: 30, maxZoom: 12, animate })
      viewInitialized = true
    } else if (!viewInitialized) {
      // A deep-linked filter matched nothing: still give the map a view.
      if (allLngLats.length) {
        const allBounds = new maplibregl.LngLatBounds()
        for (const coord of allLngLats) {
          allBounds.extend(coord)
        }
        map.fitBounds(allBounds, { padding: 30, maxZoom: 12, animate })
      } else {
        map.jumpTo({ center: [-90.2, 38.627], zoom: 11 })
      }
      viewInitialized = true
    }
  }

  // Open/close a place's popup on demand (the shared list-title click handler in
  // views.ts calls this in map view). togglePopup mirrors the marker's own click.
  function togglePopup(item: HTMLElement): void {
    markers.get(item)?.togglePopup()
  }

  function deselect(): void {
    closeActivePopup()
  }

  // Clicking empty map space closes the open popup (→ popupclose → deactivate).
  map.on('click', () => deselect())

  // Initial framing is instant; filter re-fits animate.
  sync(false)
  scope.addEventListener('filter:changed', () => sync(true))

  return { refresh: () => map.resize(), togglePopup, deselect }
}
