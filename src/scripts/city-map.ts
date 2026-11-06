import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, MapGeoJSONFeature } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import Supercluster from 'supercluster'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, type PopupChip } from './popup'
import { neighborhoodFeatures, officialParts } from './boundaries'
import {
  BADGE_POPUP_OFFSET,
  PIN_POPUP_OFFSET,
  STACKED_MAP_QUERY,
  bindRowHover,
  createMapPopup,
  frameCityView,
  readPayload,
  settlePopup,
} from './map-shared'
import { createBadge, createClusterBadge, spotPopupHtml, stackBadges } from './map-badges'
import { activeLegendKeys, bindLegendCollapse } from './map-legend'
import { NEIGHBORHOOD_ICON, neighborhoodRecords as neighborhoods } from '../lib/neighborhood-data'
import type { AreaPopup } from '../lib/neighborhoods'
import type { MapSpot } from '../lib/spots'

const CITY_VIEW_PADDING = 40
const CITY_VIEW_ZOOM_IN = 0.5
const FILTER_FIT_PADDING = 40
const FILTER_FIT_MAX_ZOOM = 12

type RegionKey = 'north' | 'central' | 'south' | 'county' | 'park' | 'district'
type LeafProperties = { spotIndex: number }

const bySlug = new Map(neighborhoods.map((neighborhood) => [neighborhood.slug, neighborhood]))
const byNumber = new Map(
  neighborhoods.flatMap((neighborhood) => {
    if (neighborhood.mergedInto) {
      const parent = bySlug.get(neighborhood.mergedInto)

      return parent ? [[neighborhood.number, parent] as const] : []
    }

    return 'ignored' in neighborhood ? [] : [[neighborhood.number, neighborhood] as const]
  }),
)

function forEachPosition(geometry: Geometry, visit: (position: Position) => void): void {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const position of ring) {
        visit(position)
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const position of ring) {
          visit(position)
        }
      }
    }
  }
}

function regionKeyForArea(area: { group?: string; type?: string } | undefined): RegionKey {
  if (area?.type === 'park') {
    return 'park'
  }
  if (area?.type === 'district') {
    return 'district'
  }
  if (area?.group === 'St. Louis County') {
    return 'county'
  }
  if (area?.group === 'North City') {
    return 'north'
  }
  if (area?.group === 'South City') {
    return 'south'
  }

  return 'central'
}

function readRegionColors(): Record<RegionKey, string> {
  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string) => styles.getPropertyValue(token).trim()

  return {
    north: readColor('--color-map-north'),
    central: readColor('--color-map-central'),
    south: readColor('--color-map-south'),
    county: readColor('--color-map-county'),
    park: readColor('--color-map-park'),
    district: readColor('--color-map-district'),
  }
}

function topArea(hits: MapGeoJSONFeature[]): MapGeoJSONFeature | undefined {
  return hits.find((hit) => hit.properties?.region === 'district') ?? hits[0]
}

export async function initCityMap(selector = '[data-city-map]'): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    return
  }

  const spots = readPayload<MapSpot[]>('script[data-city-map-spots]', [])
  const areas = readPayload<Record<string, AreaPopup>>('script[data-city-map-areas]', {})
  const districtShapes = readPayload<Feature[]>('script[data-city-map-districts]', [])
  const rowTarget = element.dataset.rowTarget === 'spot' ? 'spot' : 'area'
  const filterRoot = element.closest<HTMLElement>('[data-filter-root]')
  const rows = [...(filterRoot ?? document).querySelectorAll<HTMLElement>('[data-filter-item]')]
  const legend = element.querySelector<HTMLElement>('[data-map-legend]')
  const categoryLegend = legend && !legend.dataset.filterToggles ? legend : null
  const spotById = new Map(spots.map((spot) => [spot.id, spot]))

  let regionColors = readRegionColors()
  const regionColorExpression = (): ExpressionSpecification => [
    'match',
    ['get', 'region'],
    'north',
    regionColors.north,
    'central',
    regionColors.central,
    'south',
    regionColors.south,
    'county',
    regionColors.county,
    'park',
    regionColors.park,
    'district',
    regionColors.district,
    regionColors.central,
  ]
  const isDistrict: ExpressionSpecification = ['==', ['get', 'region'], 'district']
  const districtOnTop: ExpressionSpecification = ['case', isDistrict, 1, 0]

  const [features, partFeatures] = await Promise.all([neighborhoodFeatures(), officialParts()])

  const SOURCE_ID = 'neighborhoods'
  const FILL_LAYER = 'neighborhoods-fill'
  const LINE_LAYER = 'neighborhoods-line'
  const PARTS_SOURCE_ID = 'neighborhood-parts'
  const PARTS_LINE_LAYER = 'neighborhood-parts-line'
  const slugToFeatureIds = new Map<string, number[]>()
  const boundsBySlug = new Map<string, maplibregl.LngLatBounds>()

  const trackArea = (slug: string, geometry: Geometry, id: number): void => {
    const slugBounds = boundsBySlug.get(slug) ?? new maplibregl.LngLatBounds()
    forEachPosition(geometry, (position) => {
      slugBounds.extend([position[0], position[1]])
    })
    boundsBySlug.set(slug, slugBounds)
    slugToFeatureIds.set(slug, [...(slugToFeatureIds.get(slug) ?? []), id])
  }

  const areaFeatures: Feature[] = features.map((source, index) => {
    const entry = byNumber.get(Number(source.properties?.NHD_NUM))
    const slug = entry?.slug ?? ''
    if (slug) {
      trackArea(slug, source.geometry as Geometry, index)
    }

    return {
      type: 'Feature',
      id: index,
      geometry: source.geometry as Geometry,
      properties: {
        ...source.properties,
        region: regionKeyForArea(entry),
        slug,
        name: entry?.name ?? String(source.properties?.NHD_NAME ?? 'Neighborhood'),
      },
    }
  })
  const districtFeatures: Feature[] = districtShapes.map((source, index) => {
    const id = areaFeatures.length + index
    const slug = String(source.properties?.slug ?? '')
    trackArea(slug, source.geometry, id)

    return {
      type: 'Feature',
      id,
      geometry: source.geometry,
      properties: { region: 'district', slug, name: areas[slug]?.name ?? slug },
    }
  })
  const areaCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [...areaFeatures, ...districtFeatures],
  }
  const parts: FeatureCollection = {
    type: 'FeatureCollection',
    features: partFeatures.map((part) => ({
      type: 'Feature',
      geometry: part.geometry as Geometry,
      properties: { region: regionKeyForArea(byNumber.get(Number(part.properties?.NHD_NUM))) },
    })),
  }

  const map = createBasemapMap(element, { minZoom: 10, maxZoom: 16 })
  const canHover = window.matchMedia('(hover: hover)').matches

  let selectedSlug: string | null = null
  let hoveredFeatureId: number | null = null

  function setSlugState(slug: string, state: { selected?: boolean; hover?: boolean }): void {
    for (const id of slugToFeatureIds.get(slug) ?? []) {
      map.setFeatureState({ source: SOURCE_ID, id }, state)
    }
  }

  function selectArea(slug: string | null): void {
    if (selectedSlug) {
      setSlugState(selectedSlug, { selected: false })
    }
    selectedSlug = slug
    if (slug) {
      setSlugState(slug, { selected: true })
    }
  }

  function areaPopupHtml(slug: string): string {
    const area = areas[slug]
    const chips: PopupChip[] = []
    if (area?.park) {
      chips.push({ label: 'Park' })
    }
    if (area?.area) {
      chips.push({ label: area.area })
    }

    return buildPopupHtml({
      title: area?.name ?? '',
      link: `${import.meta.env.BASE_URL}neighborhoods/${slug}/`,
      photo: area?.photo ?? '',
      chips,
      swatchColor: `var(--color-map-${regionKeyForArea(bySlug.get(slug))})`,
      icon: NEIGHBORHOOD_ICON,
      tagline: area?.tagline ?? '',
      excerpt: area?.excerpt ?? '',
      viewMore: area?.written ?? false,
    })
  }

  const areaPopup = createMapPopup(PIN_POPUP_OFFSET)
  areaPopup.on('close', () => selectArea(null))

  function openAreaPopup(slug: string): void {
    const bounds = boundsBySlug.get(slug)
    if (!bounds) {
      return
    }
    const center = bounds.getCenter().toArray() as [number, number]
    areaPopup.setLngLat(center).setHTML(areaPopupHtml(slug)).addTo(map)
    selectArea(slug)
    settlePopup(map, areaPopup)
  }

  const badgePopup = createMapPopup(BADGE_POPUP_OFFSET)
  let selectedSpotId: string | null = null
  let selectedBadge: HTMLElement | null = null
  badgePopup.on('close', () => {
    selectedBadge?.classList.remove('is-selected')
    selectedBadge = null
    selectedSpotId = null
  })

  function openBadgePopup(spot: MapSpot, badge: HTMLElement): void {
    areaPopup.remove()
    badgePopup.remove()
    selectedBadge = badge
    selectedSpotId = spot.id
    badge.classList.add('is-selected')
    badgePopup.setLngLat(spot.coords).setHTML(spotPopupHtml(spot)).addTo(map)
    settlePopup(map, badgePopup)
  }

  function closePopups(): void {
    areaPopup.remove()
    badgePopup.remove()
  }

  let visibleIds: Set<string> | null = null
  const indexByCategory = new Map<string, Supercluster<LeafProperties>>()

  function visibleSpots(): MapSpot[] {
    return visibleIds ? spots.filter((spot) => visibleIds?.has(spot.id)) : spots
  }

  function buildIndexes(): void {
    indexByCategory.clear()
    const shown = visibleSpots()
    const categories = new Set(shown.map((spot) => spot.category))
    for (const category of categories) {
      const features: Supercluster.PointFeature<LeafProperties>[] = shown
        .filter((spot) => spot.category === category)
        .map((spot) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: spot.coords },
          properties: { spotIndex: spots.indexOf(spot) },
        }))
      indexByCategory.set(
        category,
        new Supercluster<LeafProperties>({
          radius: 22,
          minPoints: 2,
          minZoom: 10,
          maxZoom: 15,
        }).load(features),
      )
    }
  }

  let badgeMarkers: maplibregl.Marker[] = []
  const badgeBySpotId = new Map<string, HTMLElement>()

  function renderBadges(): void {
    for (const marker of badgeMarkers) {
      marker.remove()
    }
    badgeMarkers = []
    badgeBySpotId.clear()
    const active = categoryLegend ? activeLegendKeys(categoryLegend) : null
    const viewport = map.getBounds()
    const bbox: [number, number, number, number] = [
      viewport.getWest(),
      viewport.getSouth(),
      viewport.getEast(),
      viewport.getNorth(),
    ]
    const zoom = Math.floor(map.getZoom())
    const placed: { spot: MapSpot; element: HTMLElement }[] = []

    for (const [category, index] of indexByCategory) {
      if (active && !active.has(category)) {
        continue
      }
      for (const feature of index.getClusters(bbox, zoom)) {
        const center = feature.geometry.coordinates as [number, number]
        if (feature.properties && 'cluster' in feature.properties) {
          const cluster = feature.properties as Supercluster.ClusterProperties
          const badge = createClusterBadge(category, cluster.point_count, () => {
            const expansionZoom = index.getClusterExpansionZoom(cluster.cluster_id)
            const target = Math.min(
              map.getMaxZoom(),
              Math.max(expansionZoom, Math.floor(map.getZoom()) + 1),
            )
            map.easeTo({ center, zoom: target })
          })
          placed.push({
            spot: { id: '', title: '', category: category as MapSpot['category'], coords: center },
            element: badge,
          })
        } else {
          const spot = spots[(feature.properties as LeafProperties).spotIndex]
          const badge = createBadge(spot, openBadgePopup)
          if (spot.id === selectedSpotId) {
            badge.classList.add('is-selected')
            selectedBadge = badge
          }
          badgeBySpotId.set(spot.id, badge)
          placed.push({ spot, element: badge })
        }
      }
    }

    const offsets = stackBadges(placed.map((entry) => entry.spot))
    for (const entry of placed) {
      badgeMarkers.push(
        new maplibregl.Marker({
          element: entry.element,
          anchor: 'center',
          offset: offsets.get(entry.spot) ?? [0, 0],
        })
          .setLngLat(entry.spot.coords)
          .addTo(map),
      )
    }
    showHoveredSpot()
  }

  let hoverMarker: maplibregl.Marker | null = null
  let hoveredSpotId: string | null = null

  function highlightSpot(id: string, highlighted: boolean): void {
    hoveredSpotId = highlighted ? id : null
    showHoveredSpot()
  }

  function showHoveredSpot(): void {
    hoverMarker?.remove()
    hoverMarker = null
    for (const badge of badgeBySpotId.values()) {
      badge.classList.remove('is-hovered')
    }
    const id = hoveredSpotId
    if (!id) {
      return
    }
    const badge = badgeBySpotId.get(id)
    if (badge) {
      badge.classList.add('is-hovered')

      return
    }
    const spot = spotById.get(id)
    if (!spot) {
      return
    }
    const temporary = createBadge(spot, openBadgePopup)
    temporary.classList.add('is-hovered')
    hoverMarker = new maplibregl.Marker({ element: temporary, anchor: 'center' })
      .setLngLat(spot.coords)
      .addTo(map)
  }

  function frameSpots(animate: boolean): void {
    const shown = visibleSpots()
    if (!visibleIds || shown.length === 0) {
      frameCityView(map, CITY_VIEW_PADDING, CITY_VIEW_ZOOM_IN)

      return
    }
    const fitted = shown.filter((spot) => !spot.excludeFit)
    const bounds = new maplibregl.LngLatBounds()
    for (const spot of fitted.length > 0 ? fitted : shown) {
      bounds.extend(spot.coords)
    }
    map.fitBounds(bounds, { padding: FILTER_FIT_PADDING, maxZoom: FILTER_FIT_MAX_ZOOM, animate })
  }

  let visibleKey = ''

  function syncWithRows(animate: boolean): void {
    const shownRows = rows.filter((row) => !row.hidden)
    const ids = shownRows.length === rows.length ? null : new Set(shownRows.map((row) => row.id))
    const key = ids ? [...ids].sort().join('|') : '*'
    if (key === visibleKey) {
      return
    }
    visibleKey = key
    visibleIds = ids
    if (selectedSpotId && ids && !ids.has(selectedSpotId)) {
      badgePopup.remove()
    }
    buildIndexes()
    renderBadges()
    frameSpots(animate)
  }

  function addBoundaryLayers(): void {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: areaCollection })
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        layout: { 'fill-sort-key': districtOnTop },
        paint: {
          'fill-color': regionColorExpression(),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.4,
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            isDistrict,
            0.2,
            0.1,
          ],
        },
      })
    }
    if (!map.getSource(PARTS_SOURCE_ID)) {
      map.addSource(PARTS_SOURCE_ID, { type: 'geojson', data: parts })
    }
    if (!map.getLayer(PARTS_LINE_LAYER)) {
      map.addLayer({
        id: PARTS_LINE_LAYER,
        type: 'line',
        source: PARTS_SOURCE_ID,
        paint: {
          'line-color': regionColorExpression(),
          'line-width': 1.25,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        },
      })
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-sort-key': districtOnTop },
        paint: {
          'line-color': regionColorExpression(),
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            4,
            ['boolean', ['feature-state', 'hover'], false],
            3,
            2,
          ],
        },
      })
    }
    if (selectedSlug) {
      setSlugState(selectedSlug, { selected: true })
    }
  }

  function addBoundaryInteractions(): void {
    map.on('mousemove', FILL_LAYER, (event) => {
      if (!canHover) {
        return
      }
      const feature = topArea(event.features ?? [])
      if (feature?.id === undefined) {
        return
      }
      const id = feature.id as number
      if (hoveredFeatureId !== null && hoveredFeatureId !== id) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false })
      }
      hoveredFeatureId = id
      if (String(feature.properties?.slug ?? '') !== selectedSlug) {
        map.setFeatureState({ source: SOURCE_ID, id }, { hover: true })
      }
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', FILL_LAYER, () => {
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false })
      }
      hoveredFeatureId = null
      map.getCanvas().style.cursor = ''
    })
    map.on('click', (event) => {
      const hit = topArea(map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] }))
      const slug = String(hit?.properties?.slug ?? '')
      badgePopup.remove()
      if (slug) {
        openAreaPopup(slug)
      } else {
        areaPopup.remove()
      }
    })
  }

  function bindRows(): void {
    bindRowHover(rows, {
      enter: (row) => {
        if (rowTarget === 'spot') {
          highlightSpot(row.id, true)
        } else if (row.id !== selectedSlug) {
          setSlugState(row.id, { hover: true })
        }
      },
      leave: (row) => {
        if (rowTarget === 'spot') {
          highlightSpot(row.id, false)
        } else {
          setSlugState(row.id, { hover: false })
        }
      },
    })
  }

  let framed = false
  function frameWhenSized(): void {
    if (framed || element?.clientHeight === 0) {
      return
    }
    framed = true
    frameSpots(false)
  }

  const split = element.closest('[data-map-split]')
  if (split) {
    const observer = new MutationObserver(() => {
      if (split.getAttribute('data-view') !== 'map') {
        closePopups()

        return
      }
      map.resize()
      frameWhenSized()
    })
    observer.observe(split, { attributes: true, attributeFilter: ['data-view'] })
  }

  if (legend) {
    bindLegendCollapse(legend, STACKED_MAP_QUERY)
  }

  function syncWithLegend(): void {
    const selectedCategory = selectedBadge?.dataset.category
    if (
      categoryLegend &&
      selectedCategory &&
      !activeLegendKeys(categoryLegend).has(selectedCategory)
    ) {
      badgePopup.remove()
    }
    renderBadges()
  }

  map.on('load', () => {
    addBoundaryLayers()
    addBoundaryInteractions()
    bindRows()
    if (rowTarget === 'spot') {
      syncWithRows(false)
      filterRoot?.addEventListener('filter:changed', () => syncWithRows(true))
    } else {
      buildIndexes()
      renderBadges()
      filterRoot?.addEventListener('filter:changed', syncWithLegend)
    }
    map.on('moveend', renderBadges)
    watchThemeChanges(map, () => {
      regionColors = readRegionColors()
      for (const layer of [FILL_LAYER, LINE_LAYER, PARTS_LINE_LAYER]) {
        if (!map.getLayer(layer)) {
          continue
        }
        const property = layer === FILL_LAYER ? 'fill-color' : 'line-color'
        map.setPaintProperty(layer, property, regionColorExpression())
      }
    })
    frameWhenSized()
  })
}
