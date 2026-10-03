import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, escapeHtml, type PopupChip } from './popup'
import { frameCityView, keepPopupInView } from './map-shared'
import neighborhoods from '../data/neighborhoods.json'

const byNumber = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.number, neighborhood]),
)

function forEachPosition(geometry: Geometry, fn: (position: Position) => void): void {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const position of ring) {
        fn(position)
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const position of ring) {
          fn(position)
        }
      }
    }
  }
}

export async function initAreaMap(selector = '[data-area-map]'): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    return
  }

  type RegionKey = 'north' | 'central' | 'south' | 'county' | 'park'

  function readRegionColors(): Record<RegionKey, string> {
    const styles = getComputedStyle(document.documentElement)
    const readColor = (token: string, fallback: string) =>
      styles.getPropertyValue(token).trim() || fallback

    return {
      north: readColor('--color-map-north', '#b8860b'),
      central: readColor('--color-map-central', '#c0392b'),
      south: readColor('--color-map-south', '#6a47a6'),
      county: readColor('--color-map-county', '#2766ad'),
      park: readColor('--color-map-park', '#2e7d4a'),
    }
  }

  function regionKeyForArea(area: { group?: string; type?: string } | undefined): RegionKey {
    if (area?.type === 'park') {
      return 'park'
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

  let regionColors = readRegionColors()
  function regionColorExpression(): ExpressionSpecification {
    return [
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
      regionColors.central,
    ]
  }

  let geojson: FeatureCollection
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    if (!response.ok) {
      return
    }
    geojson = await response.json()
  } catch {
    return
  }

  const rows = [...document.querySelectorAll<HTMLElement>('[data-section]')]
  function rowFor(slug: string): HTMLElement | undefined {
    return rows.find((row) => row.dataset.section === slug)
  }

  const SOURCE_ID = 'neighborhoods'
  const FILL_LAYER = 'neighborhoods-fill'
  const LINE_LAYER = 'neighborhoods-line'
  const slugToFeatureIds = new Map<string, number[]>()
  const centerBySlug = new Map<string, [number, number]>()
  const boundsBySlug = new Map<string, maplibregl.LngLatBounds>()
  const nameBySlug = new Map<string, string>()
  const regionKeyBySlug = new Map<string, RegionKey>()

  geojson.features.forEach((feature: Feature, index: number) => {
    feature.id = index
    const number = Number(feature.properties?.NHD_NUM)
    const entry = byNumber.get(number)
    const name = entry?.name ?? String(feature.properties?.NHD_NAME ?? 'Neighborhood')
    const slug = entry?.slug ?? ''
    const region = regionKeyForArea(entry)
    feature.properties = { ...feature.properties, region, slug, name }

    const featureBounds = new maplibregl.LngLatBounds()
    forEachPosition(feature.geometry, (position) => {
      featureBounds.extend([position[0], position[1]])
    })

    if (slug) {
      slugToFeatureIds.set(slug, [...(slugToFeatureIds.get(slug) ?? []), index])
      centerBySlug.set(slug, featureBounds.getCenter().toArray() as [number, number])
      boundsBySlug.set(slug, featureBounds)
      nameBySlug.set(slug, name)
      regionKeyBySlug.set(slug, region)
    }
  })

  const map = createBasemapMap(element, { minZoom: 10, maxZoom: 13 })

  const canHover = window.matchMedia('(hover: hover)').matches

  let selectedSlug: string | null = null
  let hoveredId: number | null = null

  function setSlugState(slug: string, state: { selected?: boolean; hover?: boolean }): void {
    for (const id of slugToFeatureIds.get(slug) ?? []) {
      map.setFeatureState({ source: SOURCE_ID, id }, state)
    }
  }

  function activate(slug: string): void {
    if (selectedSlug === slug) {
      return
    }
    if (selectedSlug) {
      setSlugState(selectedSlug, { selected: false })
      rowFor(selectedSlug)?.classList.remove('is-active')
    }

    selectedSlug = slug
    setSlugState(slug, { selected: true })
    rowFor(slug)?.classList.add('is-active')
    rowFor(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function deactivate(slug: string): void {
    if (selectedSlug !== slug) {
      return
    }
    setSlugState(slug, { selected: false })
    rowFor(slug)?.classList.remove('is-active')
    selectedSlug = null
  }

  function popupHtmlFor(slug: string): string {
    const name = nameBySlug.get(slug) ?? ''
    if (!slug) {
      return `<h2>${escapeHtml(name)}</h2>`
    }
    const row = rowFor(slug)
    const area = row?.dataset.area ?? ''
    const chips: PopupChip[] = []
    if (row?.dataset.type === 'park') {
      chips.push({ label: 'Park' })
    }
    if (area) {
      chips.push({ label: area })
    }
    const link = `${import.meta.env.BASE_URL}neighborhoods/${slug}/`

    return buildPopupHtml({
      title: name,
      link,
      photo: row?.dataset.photo ?? '',
      chips,
      tagline: row?.dataset.tagline ?? '',
      excerpt: row?.dataset.excerpt ?? '',
    })
  }

  const popup = new maplibregl.Popup({
    className: 'map-popup',
    closeButton: true,
    closeOnClick: false,
    anchor: 'bottom',
    maxWidth: '320px',
    offset: 38,
    focusAfterOpen: false,
  })
  popup.on('close', () => {
    if (selectedSlug) {
      deactivate(selectedSlug)
    }
  })

  function openPopupFor(slug: string, deferKeepInView = false): void {
    const center = centerBySlug.get(slug)
    if (!center) {
      return
    }
    popup.setLngLat(center).setHTML(popupHtmlFor(slug)).addTo(map)
    activate(slug)
    const getPopupEl = () => popup.getElement() ?? undefined
    if (deferKeepInView) {
      map.once('moveend', () => keepPopupInView(map, getPopupEl))
    } else {
      keepPopupInView(map, getPopupEl)
    }
  }

  function addBoundaryLayers(): void {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': regionColorExpression(),
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.4,
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            0.1,
          ],
        },
      })
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
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

  function addExploredMarkers(): void {
    for (const [slug, ids] of slugToFeatureIds) {
      if (ids.length === 0) {
        continue
      }
      const explored = rowFor(slug)?.classList.contains('is-written') ?? false
      if (!explored) {
        continue
      }
      const center = centerBySlug.get(slug)
      if (!center) {
        continue
      }

      const element = document.createElement('div')
      element.className = 'map-pin'
      element.dataset.region = regionKeyBySlug.get(slug) ?? 'central'
      element.innerHTML = `<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="currentColor" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>`

      new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(center).addTo(map)

      element.addEventListener('click', (event) => {
        event.stopPropagation()
        openPopupFor(slug)
      })
      element.addEventListener('mouseenter', () => {
        if (!canHover) {
          return
        }
        if (slug !== selectedSlug) {
          setSlugState(slug, { hover: true })
        }
      })
      element.addEventListener('mouseleave', () => {
        if (!canHover) {
          return
        }
        setSlugState(slug, { hover: false })
      })
    }
  }

  function addBoundaryInteractions(): void {
    map.on('mousemove', FILL_LAYER, (event) => {
      if (!canHover) {
        return
      }
      const feature = event.features?.[0]
      if (feature?.id === undefined) {
        return
      }
      const id = feature.id as number
      if (hoveredId !== null && hoveredId !== id) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredId }, { hover: false })
      }
      hoveredId = id
      const slug = String(feature.properties?.slug ?? '')
      if (slug !== selectedSlug) {
        map.setFeatureState({ source: SOURCE_ID, id }, { hover: true })
      }
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', FILL_LAYER, () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredId }, { hover: false })
      }
      hoveredId = null
      map.getCanvas().style.cursor = ''
    })
    map.on('click', (event) => {
      const hits = map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] })
      const slug = hits.length ? String(hits[0].properties?.slug ?? '') : ''
      if (slug) {
        openPopupFor(slug)
      } else {
        popup.remove()
      }
    })
  }

  const split = document.querySelector('[data-map-split]')

  function frameInitialView(): void {
    const initialSlug = location.hash.slice(1)
    if (initialSlug && slugToFeatureIds.has(initialSlug)) {
      activate(initialSlug)
      const selectedBounds = boundsBySlug.get(initialSlug)
      if (selectedBounds) {
        map.fitBounds(selectedBounds, { padding: 40, maxZoom: 13, animate: false })
      }
    } else {
      frameCityView(map, 40, false)
    }
  }

  let framed = false
  function frameWhenSized(): void {
    if (framed || element?.clientHeight === 0) {
      return
    }
    framed = true
    frameInitialView()
  }

  if (split) {
    const observer = new MutationObserver(() => {
      if (split.getAttribute('data-view') !== 'map') {
        return
      }
      map.resize()
      frameWhenSized()
    })
    observer.observe(split, { attributes: true, attributeFilter: ['data-view'] })
  }

  map.on('load', () => {
    addBoundaryLayers()
    addBoundaryInteractions()
    addExploredMarkers()
    watchThemeChanges(map, () => {
      regionColors = readRegionColors()
      if (map.getLayer(FILL_LAYER)) {
        map.setPaintProperty(FILL_LAYER, 'fill-color', regionColorExpression())
      }
      if (map.getLayer(LINE_LAYER)) {
        map.setPaintProperty(LINE_LAYER, 'line-color', regionColorExpression())
      }
    })
    frameWhenSized()
  })
}
