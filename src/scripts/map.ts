import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, type PopupChip } from './popup'
import { fitZoomFor, frameCityView, keepPopupInView } from './map-shared'
import { verdictLabels, type Verdict } from '../lib/verdict'
import { cuisineLabel } from '../lib/cuisine'
import { MAP_CENTER, NEIGHBORHOOD_BOUNDARIES_FILE } from '../../site.config.mjs'
import { NEIGHBORHOODS_ENABLED } from '../lib/neighborhood-data'

type LeafProps = { itemIndex: number }

export interface MapApi {
  refresh: () => void
  togglePopup: (item: HTMLElement) => void
  deselect: () => void
}

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

  const clusterEnabled = el.dataset.mapCluster !== undefined

  const map = createBasemapMap(el, { minZoom: 10, maxZoom: 16 })

  const BOUNDARY_SOURCE = 'nbhd-boundaries'
  const BOUNDARY_LINE = 'nbhd-boundaries-line'
  const boundaryColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-muted-2').trim() ||
    '#6f6b61'
  function addBoundaryLayer(): void {
    if (!NEIGHBORHOODS_ENABLED) {
      return
    }

    if (!map.getSource(BOUNDARY_SOURCE)) {
      map.addSource(BOUNDARY_SOURCE, {
        type: 'geojson',
        data: `${import.meta.env.BASE_URL}${NEIGHBORHOOD_BOUNDARIES_FILE}`,
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
  if (map.isStyleLoaded()) {
    addBoundaryLayer()
  } else {
    map.on('load', addBoundaryLayer)
  }

  watchThemeChanges(map, () => {
    if (map.getLayer(BOUNDARY_LINE)) {
      map.setPaintProperty(BOUNDARY_LINE, 'line-color', boundaryColor())
    }
  })

  const items = [...scope.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const markers = new Map<HTMLElement, maplibregl.Marker>()
  const popups = new Map<HTMLElement, maplibregl.Popup>()

  let index: Supercluster<LeafProps> | null = null
  const shownLeaves = new Set<HTMLElement>()
  let clusterBubbles: maplibregl.Marker[] = []
  let pendingOpenItem: HTMLElement | null = null

  const allLngLats = items
    .map((item) => lngLatFromItem(item))
    .filter((coord): coord is [number, number] => coord !== null)

  let viewInitialized = false
  let activeItem: HTMLElement | null = null
  let deferKeepInView = false

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

  const pinSvg =
    '<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="currentColor" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>'

  function buildMarker(item: HTMLElement, lngLat: [number, number]): maplibregl.Marker {
    const element = document.createElement('div')
    element.className = 'map-pin'
    const verdictClass = item.dataset.verdict
    if (verdictClass) {
      element.classList.add(`verdict-${verdictClass}`)
    }
    element.innerHTML = pinSvg

    const cuisines = (item.dataset.cuisine ?? '').split('|').filter(Boolean)
    const neighborhood = item.dataset.neighborhood ?? ''
    const chips: PopupChip[] = cuisines.map((cuisine) => ({
      label: cuisineLabel(cuisine),
      filterSet: 'cuisine',
      filterValue: cuisine,
    }))
    if (neighborhood) {
      chips.push({ label: neighborhood, filterSet: 'neighborhood', filterValue: neighborhood })
    }

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
      directionsHref: item.dataset.google ?? '',
    })

    const popup = new maplibregl.Popup({
      className: 'map-popup',
      closeButton: true,
      closeOnClick: false,
      anchor: 'bottom',
      maxWidth: '320px',
      offset: 38,
      focusAfterOpen: false,
    }).setHTML(popupHtml)

    const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
      .setLngLat(lngLat)
      .setPopup(popup)

    popup.on('open', () => {
      if (activeItem && activeItem !== item) {
        popups.get(activeItem)?.remove()
      }
      activate(item)
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

    index = new Supercluster<LeafProps>({
      radius: 16,
      minPoints: 2,
      minZoom: 10,
      maxZoom: 13,
    }).load(features)
  }

  function buildClusterMarker(
    feature: Supercluster.ClusterFeature<Supercluster.AnyProps>,
  ): maplibregl.Marker {
    const [lng, lat] = feature.geometry.coordinates
    const count = feature.properties.point_count
    const clusterId = feature.properties.cluster_id

    const element = document.createElement('div')
    element.className = 'cluster-marker'
    element.textContent = String(feature.properties.point_count_abbreviated)
    element.dataset.size = count < 10 ? 'sm' : count < 50 ? 'md' : 'lg'
    element.addEventListener('click', () => {
      const expansionZoom = index?.getClusterExpansionZoom(clusterId) ?? map.getZoom() + 2
      const target = Math.min(
        map.getMaxZoom(),
        Math.max(expansionZoom, Math.floor(map.getZoom()) + 2),
      )
      map.easeTo({ center: [lng, lat], zoom: target })
    })

    return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
  }

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

    for (const bubble of clusterBubbles) {
      bubble.remove()
    }
    clusterBubbles = clusterFeatures.map(buildClusterMarker)

    if (pendingOpenItem && shownLeaves.has(pendingOpenItem)) {
      markers.get(pendingOpenItem)?.togglePopup()
      pendingOpenItem = null
    } else if (pendingOpenItem && !pendingOpenItem.hidden && map.getZoom() < map.getMaxZoom()) {
      const lngLat = lngLatFromItem(pendingOpenItem)
      if (lngLat) {
        map.easeTo({
          center: lngLat,
          zoom: Math.min(map.getMaxZoom(), Math.floor(map.getZoom()) + 2),
        })
      }
    }
  }

  function sync(animate: boolean): void {
    closeActivePopup()

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
      const fitTarget = anyFitPoint ? bounds : fallbackBounds
      const allShown = items.every((item) => !item.hidden)
      if (allShown && fitZoomFor(map, fitTarget, 30) < map.getMinZoom()) {
        frameCityView(map, 30)
      } else {
        map.fitBounds(fitTarget, { padding: 30, maxZoom: 12, animate })
      }
      viewInitialized = true
    } else if (!viewInitialized) {
      if (allLngLats.length) {
        const allBounds = new maplibregl.LngLatBounds()
        for (const coord of allLngLats) {
          allBounds.extend(coord)
        }
        map.fitBounds(allBounds, { padding: 30, maxZoom: 12, animate })
      } else {
        map.jumpTo({ center: MAP_CENTER as [number, number], zoom: 11 })
      }
      viewInitialized = true
    }
  }

  function togglePopup(item: HTMLElement): void {
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
    if (activeItem !== item) {
      deferKeepInView = true
      map.easeTo({ center: marker.getLngLat() })
    }
    marker.togglePopup()
  }

  function deselect(): void {
    closeActivePopup()
  }

  map.on('click', () => deselect())

  if (clusterEnabled) {
    map.on('moveend', renderClusters)
  }

  sync(false)
  scope.addEventListener('filter:changed', () => sync(true))

  return { refresh: () => map.resize(), togglePopup, deselect }
}
