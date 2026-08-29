import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView } from './map-shared'
import { verdictLabels, type Verdict } from '../lib/verdict'
import { cuisineLabel } from '../lib/cuisine'

// Each clustered point carries the index of its `<li>` in the `items` array — a
// stable, serializable back-reference (Supercluster clones feature properties, so
// we can't stash the HTMLElement itself). `items[itemIndex]` recovers the row.
type LeafProps = { itemIndex: number }

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

  // Marker clustering is opt-in per page (Food sets data-map-cluster; Hikes doesn't),
  // so every clustering codepath below is gated on this flag.
  const clusterEnabled = el.dataset.mapCluster !== undefined

  const map = createBasemapMap(el, { minZoom: 10, maxZoom: 16 })

  // Faint neighborhood outlines under the pin markers, so each spot reads with
  // some geographic context. One geojson source (fetched by MapLibre from the URL)
  // + a thin line layer. transformStyle (see basemap.ts) carries both across a
  // theme swap.
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

  // Clustering state (only used when clusterEnabled). `index` is rebuilt from the
  // visible set on every filter change; `shownLeaves` tracks which pin markers are
  // currently on the map (so the render loop can diff instead of rebuilding);
  // `clusterBubbles` are the count-bubble markers; `pendingOpenItem` is a list-row
  // click waiting for its marker to emerge from a cluster.
  let index: Supercluster<LeafProps> | null = null
  const shownLeaves = new Set<HTMLElement>()
  let clusterBubbles: maplibregl.Marker[] = []
  let pendingOpenItem: HTMLElement | null = null

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

  // The teardrop pin (same shape as the neighborhood map's), colored by the
  // row's verdict via CSS classes — `currentColor` fill, so theme swaps and
  // verdict tokens apply without any JS recoloring.
  const pinSvg =
    '<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="currentColor" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>'

  // Build a place's pin marker + popup once, lazily.
  function buildMarker(item: HTMLElement, lngLat: [number, number]): maplibregl.Marker {
    // The pin lives in an inner element so hover can scale it without touching
    // the marker element's transform (MapLibre owns that for positioning — same
    // reason the neighborhood pins scale their inner .marker-pin, not the marker).
    const element = document.createElement('div')
    element.className = 'food-marker'
    const verdictClass = item.dataset.verdict
    if (verdictClass) {
      element.classList.add(`verdict-${verdictClass}`)
    }
    element.innerHTML = pinSvg

    const cuisines = (item.dataset.cuisine ?? '').split('|').filter(Boolean)
    const neighborhood = item.dataset.neighborhood ?? ''
    const chips: PopupChip[] = cuisines.map((cuisine) => ({
      // Show the display label ("St. Louis-style"), but filter on the raw value.
      label: cuisineLabel(cuisine),
      filterSet: 'cuisine',
      filterValue: cuisine,
    }))
    if (neighborhood) {
      chips.push({
        label: neighborhood,
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
      photo: item.dataset.photo ?? '',
      tagline: item.dataset.tagline ?? '',
      verdict,
      showRating: true,
      chips,
      addressLines: (item.dataset.address ?? '').split('\n').filter(Boolean),
      directionsHref: google,
      excerpt: excerptText,
      sources,
      showMore: Boolean(excerptText),
    })

    // closeOnClick:false — we manage closing (map-click + single-open) so the row
    // selection stays in sync. `anchor: 'bottom'` pins the popup ABOVE the marker
    // so it never flips sides as you pan/near edges; keepPopupInView pans the map
    // to keep it on-screen instead. The offset lifts it clear of the marker.
    const popup = new maplibregl.Popup({
      className: 'food-popup',
      closeButton: true,
      closeOnClick: false,
      anchor: 'bottom',
      maxWidth: '330px',
      offset: 22,
      focusAfterOpen: false,
    }).setHTML(popupHtml)

    const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
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

  // Rebuild the spatial index from the currently-visible places. Called on every
  // filter change so clusters always reflect what the list is showing.
  function buildIndex(): void {
    const features: Supercluster.PointFeature<LeafProps>[] = []
    items.forEach((item, itemIndex) => {
      if (item.hidden) {
        return
      }
      const lngLat = lngLatFromItem(item)
      if (!lngLat) {
        return
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: lngLat },
        properties: { itemIndex },
      })
    })

    // Deliberately light clustering — favor showing individual pin markers over
    // count bubbles:
    //   minPoints 2 (default) — a close pair merges into a "2" bubble on purpose:
    //     two nearly-stacked pins can't be clicked apart, so the cluster gives you
    //     a target that zooms in and separates them.
    //   radius 16   — the (screen-pixel) merge distance; smaller = less eager, so
    //     only genuinely close spots cluster.
    //   maxZoom 13  — the last zoom clustering is computed at, one under the map's
    //     own max (14), so clicking a cluster (or reaching zoom 14) always splits
    //     it into individual leaves.
    index = new Supercluster<LeafProps>({
      radius: 16,
      minPoints: 2,
      minZoom: 10,
      maxZoom: 13,
    }).load(features)
  }

  // A count bubble for a cluster feature. Clicking it zooms to the level where the
  // cluster splits (capped at the map's maxZoom), and the ensuing moveend re-renders.
  function buildClusterMarker(
    feature: Supercluster.ClusterFeature<Supercluster.AnyProps>,
  ): maplibregl.Marker {
    const [lng, lat] = feature.geometry.coordinates
    const count = feature.properties.point_count
    const clusterId = feature.properties.cluster_id

    const element = document.createElement('div')
    element.className = 'cluster-marker'
    element.textContent = String(feature.properties.point_count_abbreviated)
    // Size bucket for CSS — bigger bubble for a bigger cluster.
    element.dataset.size = count < 10 ? 'sm' : count < 50 ? 'md' : 'lg'
    element.addEventListener('click', () => {
      const expansionZoom = index?.getClusterExpansionZoom(clusterId) ?? map.getZoom() + 2
      // Zoom to where the cluster splits, advancing at least a couple levels so it
      // makes real progress. Capped at the map's max zoom (14), by which point
      // clustering is off entirely and every spot is its own pin.
      const target = Math.min(
        map.getMaxZoom(),
        Math.max(expansionZoom, Math.floor(map.getZoom()) + 2),
      )
      map.easeTo({ center: [lng, lat], zoom: target })
    })

    return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
  }

  // Reconcile the map with the index for the current viewport: show the existing
  // pin marker for each leaf, a count bubble for each cluster. Leaves are diffed
  // (added/removed, never rebuilt) so an open popup / selected row survives; bubbles
  // are stateless (their ids aren't stable across zoom) so they're cleared + rebuilt.
  function renderClusters(): void {
    if (!index) {
      return
    }

    const viewport = map.getBounds()
    const bbox: [number, number, number, number] = [
      viewport.getWest(),
      viewport.getSouth(),
      viewport.getEast(),
      viewport.getNorth(),
    ]
    const features = index.getClusters(bbox, Math.floor(map.getZoom()))

    const desiredLeaves = new Set<HTMLElement>()
    const clusterFeatures: Supercluster.ClusterFeature<Supercluster.AnyProps>[] = []
    for (const feature of features) {
      if (feature.properties && 'cluster' in feature.properties) {
        clusterFeatures.push(feature as Supercluster.ClusterFeature<Supercluster.AnyProps>)
      } else {
        const item = items[(feature.properties as LeafProps).itemIndex]
        if (item) {
          desiredLeaves.add(item)
        }
      }
    }

    // Leaf diff.
    for (const item of desiredLeaves) {
      if (!shownLeaves.has(item)) {
        const lngLat = lngLatFromItem(item)
        if (!lngLat) {
          continue
        }
        ;(markers.get(item) ?? buildMarker(item, lngLat)).addTo(map)
        shownLeaves.add(item)
      }
    }
    for (const item of [...shownLeaves]) {
      if (!desiredLeaves.has(item)) {
        markers.get(item)?.remove()
        shownLeaves.delete(item)
      }
    }

    // Cluster bubbles: clear + rebuild.
    for (const bubble of clusterBubbles) {
      bubble.remove()
    }
    clusterBubbles = clusterFeatures.map(buildClusterMarker)

    // A list-row click on a place that was clustered waits until its leaf appears,
    // then opens the popup (see togglePopup).
    if (pendingOpenItem && shownLeaves.has(pendingOpenItem)) {
      markers.get(pendingOpenItem)?.togglePopup()
      pendingOpenItem = null
    } else if (pendingOpenItem && !pendingOpenItem.hidden && map.getZoom() < map.getMaxZoom()) {
      // Still clustered after the last ease — keep zooming toward it until its leaf
      // emerges (or we hit max zoom). This is what lets a click on one of two nearly
      // co-located spots (e.g. the two on Delmar) actually break them apart, instead
      // of stalling at a zoom where they're still merged into one bubble.
      const lngLat = lngLatFromItem(pendingOpenItem)
      if (lngLat) {
        map.easeTo({ center: lngLat, zoom: Math.min(map.getMaxZoom(), Math.floor(map.getZoom()) + 2) })
      }
    }
  }

  // `animate` is false for the first fit (instant initial framing on load) and
  // true for later filter changes (a smooth re-fit as the visible set narrows).
  function sync(animate: boolean): void {
    // Close any open popup before re-fitting so a stale selection doesn't linger
    // when the filter changes. popupclose → deactivate clears the row.
    closeActivePopup()

    // `bounds` frames the default view and deliberately skips spots tagged
    // data-exclude-fit (far-flung outliers like the Illinois spots that would
    // otherwise zoom the whole map out). `fallbackBounds` includes everything and
    // is used only when the visible set is *entirely* excluded spots (e.g. a filter
    // that matches just one of them), so the map still frames something.
    const bounds = new maplibregl.LngLatBounds()
    const fallbackBounds = new maplibregl.LngLatBounds()
    let anyVisible = false
    let anyFitPoint = false

    const measure = (item: HTMLElement, lngLat: [number, number]): void => {
      anyVisible = true
      fallbackBounds.extend(lngLat)
      if (item.dataset.excludeFit === undefined) {
        bounds.extend(lngLat)
        anyFitPoint = true
      }
    }

    for (const item of items) {
      const lngLat = lngLatFromItem(item)
      if (!lngLat) {
        continue
      }

      if (clusterEnabled) {
        // Markers are placed by the cluster render, not here — just measure the
        // visible set so the fit-to-bounds below still frames it.
        if (!item.hidden) {
          measure(item, lngLat)
        }
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
        measure(item, lngLat)
      }
    }

    if (clusterEnabled) {
      // Drop leaves that just became hidden, rebuild the index for the new visible
      // set, and render once now (fitBounds may not move the camera, so its moveend
      // isn't guaranteed). The fitBounds moveend re-runs renderClusters idempotently.
      for (const item of [...shownLeaves]) {
        if (item.hidden) {
          markers.get(item)?.remove()
          shownLeaves.delete(item)
        }
      }
      buildIndex()
      renderClusters()
    }

    if (anyVisible) {
      map.fitBounds(anyFitPoint ? bounds : fallbackBounds, { padding: 30, maxZoom: 12, animate })
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
    // Clustered place: zoom in to break it out of the cluster, then let the ensuing
    // renderClusters open the popup on the revealed leaf (via pendingOpenItem). No
    // deferKeepInView — the popup opens after the move settles, so keep-in-view can
    // run immediately.
    if (clusterEnabled && !shownLeaves.has(item)) {
      const lngLat = lngLatFromItem(item)
      if (!lngLat) {
        return
      }
      pendingOpenItem = item
      deferKeepInView = false
      map.easeTo({
        center: lngLat,
        zoom: Math.min(map.getMaxZoom(), Math.max(Math.floor(map.getZoom()) + 2, 14)),
      })
      return
    }

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

  // Re-cluster after any camera change (pan, zoom, or programmatic fit/ease). One
  // listener covers them all. Only registered when clustering is on, so the Hikes
  // path adds nothing new.
  if (clusterEnabled) {
    map.on('moveend', renderClusters)
  }

  // Initial framing is instant; filter re-fits animate.
  sync(false)
  scope.addEventListener('filter:changed', () => sync(true))

  return { refresh: () => map.resize(), togglePopup, deselect }
}
