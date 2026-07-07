import maplibregl from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, PIN_SVG, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView } from './map-shared'
import { verdictLabels, type Verdict } from '../lib/verdict'
import { cuisineLabel } from '../lib/emoji'

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

  // Faint neighborhood outlines under the emoji markers, so each spot reads with
  // some geographic context. One geojson source (fetched by MapLibre from the URL)
  // + a thin line layer; the color comes from the hairline token, which differs
  // light/dark. transformStyle (see basemap.ts) carries both across a theme swap.
  const BOUNDARY_SOURCE = 'nbhd-boundaries'
  const BOUNDARY_LINE = 'nbhd-boundaries-line'
  // A muted gray (not the pale hairline token, which vanishes on the light
  // basemap); differs light/dark, so recolor on a theme swap.
  const boundaryColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-muted-2').trim() || '#6f6b61'
  function addBoundaryLayer(): void {
    if (!map.getSource(BOUNDARY_SOURCE)) {
      map.addSource(BOUNDARY_SOURCE, {
        type: 'geojson',
        data: `${import.meta.env.BASE_URL}stl-neighborhoods.geojson`,
      })
    }
    if (!map.getLayer(BOUNDARY_LINE)) {
      map.addLayer({
        id: BOUNDARY_LINE,
        type: 'line',
        source: BOUNDARY_SOURCE,
        paint: { 'line-color': boundaryColor(), 'line-width': 1, 'line-opacity': 0.7 },
      })
    }
  }
  // Add now if the style's already up, else on load (the listener would miss a
  // load that already fired).
  if (map.isStyleLoaded()) {
    addBoundaryLayer()
  } else {
    map.on('load', addBoundaryLayer)
  }

  // DOM markers survive a style swap; the boundary layer is carried over by
  // transformStyle, so on a theme change just recolor its line from the new token.
  watchThemeChanges(map, () => {
    if (map.getLayer(BOUNDARY_LINE)) {
      map.setPaintProperty(BOUNDARY_LINE, 'line-color', boundaryColor())
    }
  })

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
  // Set when a list click pans the map before opening: the keep-in-view nudge must
  // then wait for that pan to finish (running it mid-pan fights the animation and
  // lands wrong — the flaky "click twice"). Cleared when the nudge is scheduled.
  let deferKeepInView = false

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
      // Show the display label ("St. Louis-style"), but filter on the raw value.
      label: cuisineLabel(cuisine),
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
    const verdictKey = item.dataset.verdict as Verdict | undefined
    const verdict =
      verdictKey && verdictKey in verdictLabels
        ? { key: verdictKey, label: verdictLabels[verdictKey] }
        : undefined
    const popupHtml = buildPopupHtml({
      title: item.dataset.title ?? '',
      link: `/food/${item.id}/`,
      tagline: item.dataset.tagline ?? '',
      verdict,
      chips,
      addressLines: (item.dataset.address ?? '').split('\n').filter(Boolean),
      excerpt: excerptText,
      sources,
      showMore: Boolean(excerptText),
    })

    // closeOnClick:false — we manage closing (map-click + single-open) so the row
    // selection stays in sync. `anchor: 'bottom'` pins the popup ABOVE the marker
    // so it never flips sides as you pan/near edges; keepPopupInView pans the map
    // to keep it on-screen instead (matching the old Leaflet behavior). The offset
    // lifts it clear of the marker.
    const popup = new maplibregl.Popup({
      className: 'food-popup',
      closeButton: true,
      closeOnClick: false,
      anchor: 'bottom',
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
      // edges); MapLibre popups don't auto-pan. If a list click is panning the map
      // to this marker, wait for that pan to end so the nudge doesn't fight it.
      const getPopupEl = () => popup.getElement() ?? undefined
      if (deferKeepInView) {
        deferKeepInView = false
        map.once('moveend', () => keepPopupInView(map, getPopupEl))
      } else {
        keepPopupInView(map, getPopupEl)
      }
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
    const marker = markers.get(item)
    if (!marker) {
      return
    }
    // Opening from the list: always center the marker (MapLibre, unlike Leaflet,
    // won't auto-pan to the popup). Centering every time — not just when it's fully
    // off-screen — also keeps a marker near an edge or under the sticky header from
    // opening its popup hidden. The keep-in-view nudge is deferred to after the pan.
    if (activeItem !== item) {
      deferKeepInView = true
      map.easeTo({ center: marker.getLngLat() })
    }
    marker.togglePopup()
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
