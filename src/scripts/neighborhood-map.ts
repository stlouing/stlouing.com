import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { buildPopupHtml, escapeHtml, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView } from './map-shared'
import neighborhoods from '../data/neighborhoods.json'

// Join boundaries to the page's sections by the official NHD_NUM (unique), so
// the map and the generated sections always share one slug — no re-slugifying.
// `ignored` rows are absorbed neighborhoods (e.g. the pieces of Dogtown) kept
// only as data; skip them so they don't shadow the merged entry's number.
const byNumber = new Map(
  neighborhoods
    .filter((neighborhood) => !('ignored' in neighborhood))
    .map((neighborhood) => [neighborhood.number, neighborhood]),
)

// Walk every [lng, lat] coordinate of a Polygon/MultiPolygon feature.
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

/**
 * Clickable St. Louis neighborhood map (MapLibre GL / WebGL). Draws each official
 * boundary, and on click expands that neighborhood's writeup in the left pane.
 * Boundaries are one geojson source; hover + selection are driven by feature-state
 * so the GPU repaints without touching the DOM.
 */
export async function initNeighborhoodMap(selector = '[data-neighborhood-map]'): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    return
  }

  type RegionKey = 'north' | 'central' | 'south' | 'county' | 'park'

  // Section colors, read live from the CSS map-color tokens (they differ light/dark).
  // The three St. Louis City regions (North yellow, Central red, South violet); St.
  // Louis County is blue; parks are green by `type`, regardless of region.
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

  // Fill/line color as a MapLibre `match` on each feature's region key, so the whole
  // basemap recolors with one setPaintProperty when the theme toggles.
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

  // Preprocess the boundaries: give each feature a stable numeric id (for
  // feature-state), stamp its region color + slug + name into its properties (so
  // the paint expressions and click handler read them straight off the feature),
  // and collect per-slug centers/bounds + the whole-city bounds for framing.
  const SOURCE_ID = 'neighborhoods'
  const FILL_LAYER = 'neighborhoods-fill'
  const LINE_LAYER = 'neighborhoods-line'
  const slugToFeatureIds = new Map<string, number[]>()
  const centerBySlug = new Map<string, [number, number]>()
  const boundsBySlug = new Map<string, maplibregl.LngLatBounds>()
  const nameBySlug = new Map<string, string>()
  const regionKeyBySlug = new Map<string, RegionKey>()
  const pinBodyBySlug = new Map<string, Element>()
  // Bounds used to frame the default view — St. Louis City only. The St. Louis
  // County municipalities (Chesterfield, Clayton, Kirkwood, …) still render, but
  // they sit far west/south and must NOT drive the fit, or the city shrinks to a
  // corner. Chesterfield especially is way out west; it just exists on the map.
  const cityBounds = new maplibregl.LngLatBounds()

  geojson.features.forEach((feature: Feature, index: number) => {
    feature.id = index
    const number = Number(feature.properties?.NHD_NUM)
    const entry = byNumber.get(number)
    const name = entry?.name ?? String(feature.properties?.NHD_NAME ?? 'Neighborhood')
    const slug = entry?.slug ?? ''
    const region = regionKeyForArea(entry)
    feature.properties = { ...feature.properties, region, slug, name }

    const isCounty = entry?.group === 'St. Louis County'
    const featureBounds = new maplibregl.LngLatBounds()
    forEachPosition(feature.geometry, (position) => {
      const lngLat: [number, number] = [position[0], position[1]]
      featureBounds.extend(lngLat)

      // County municipalities render but don't count toward the city framing.
      if (!isCounty) {
        cityBounds.extend(lngLat)
      }
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

  // Touch devices synthesize hover (mouseenter/mousemove) events on tap, which
  // makes the hover card flicker and fights tap-to-open. Gate every hover behavior
  // on a genuinely hover-capable pointer (a mouse), so mobile is tap-only.
  const canHover = window.matchMedia('(hover: hover)').matches

  let selectedSlug: string | null = null
  let hoveredId: number | null = null

  function setSlugState(slug: string, state: { selected?: boolean; hover?: boolean }): void {
    for (const id of slugToFeatureIds.get(slug) ?? []) {
      map.setFeatureState({ source: SOURCE_ID, id }, state)
    }
  }

  // Selection follows the boundary's popup (open = selected), mirroring the Food
  // map: opening highlights the boundary (feature-state), marks its row active,
  // and scrolls that row to the top of the pane; closing clears all three.
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

  // The boundary popup matches the Food map's (shared buildPopupHtml): the
  // neighborhood name (linked to its page), an area chip, a writeup teaser, then
  // resource buttons — read off the matching list row's data attributes.
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
    const sources = [
      row?.dataset.wikipedia && { label: 'Wikipedia', href: row.dataset.wikipedia },
      row?.dataset.mytownview && { label: 'MyTownView', href: row.dataset.mytownview },
      row?.dataset.official && { label: 'Website', href: row.dataset.official },
      row?.dataset.city && { label: 'St. Louis City', href: row.dataset.city },
    ].filter(Boolean) as PopupSource[]

    return buildPopupHtml({
      title: name,
      link,
      photo: row?.dataset.photo ?? '',
      chips,
      tagline: row?.dataset.tagline ?? '',
      excerpt: row?.dataset.excerpt ?? '',
      sources,
    })
  }

  // One reused popup. Opening it for a slug re-anchors + refills it; the single
  // instance means only one is ever open. Its close event clears the selection.
  // `anchor: 'bottom'` pins it ABOVE the pin so it never flips sides as you pan/near
  // edges; keepPopupInView pans the map to keep it on-screen instead.
  const popup = new maplibregl.Popup({
    className: 'food-popup',
    closeButton: true,
    closeOnClick: false,
    anchor: 'bottom',
    maxWidth: '330px',
    // Lift the popup clear of the explored pin (which rises ~34px from its tip).
    offset: 38,
    focusAfterOpen: false,
  })
  popup.on('close', () => {
    if (selectedSlug) {
      deactivate(selectedSlug)
    }
  })

  // A lightweight hover card (name + region + population + food count) so the map
  // reads without clicking each boundary. Its own popup instance, pointer-events
  // off (CSS), and suppressed for the neighborhood whose full popup is already open.
  const hoverTip = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'map-hover-tip',
    anchor: 'bottom',
    // Clear the explored-neighborhood pin (~34px tall) so the card sits above it
    // rather than overlapping — matches the full popup's offset.
    offset: 38,
    // Let the no-wrap fact lines size the card instead of the default 240px cap.
    maxWidth: 'none',
    focusAfterOpen: false,
  })

  // Anchored to the neighborhood's center (not the cursor) and guarded by slug, so
  // moving within a boundary doesn't rebuild/re-jitter the tip every frame.
  let hoverTipSlug: string | null = null
  function hideHoverTip(): void {
    hoverTip.remove()
    hoverTipSlug = null
  }

  function showHoverTip(slug: string): void {
    if (!canHover || !slug || slug === selectedSlug) {
      hideHoverTip()
      return
    }
    if (slug === hoverTipSlug) {
      return
    }
    const name = nameBySlug.get(slug)
    const center = centerBySlug.get(slug)
    if (!name || !center) {
      hideHoverTip()
      return
    }
    const row = rowFor(slug)
    const population = Number(row?.dataset.population ?? '')
    const spots = Number(row?.dataset.spots ?? '')
    const facts = [
      row?.dataset.area ?? '',
      Number.isFinite(population) && population > 0
        ? `${population.toLocaleString()} residents`
        : '',
      Number.isFinite(spots) && spots > 0
        ? `${spots} food ${spots === 1 ? 'spot' : 'spots'} mapped`
        : '',
    ].filter(Boolean)
    // Each data point on its own no-wrap line (see the .hover-tip-fact CSS).
    const factsHtml = facts
      .map((fact) => `<span class="hover-tip-fact">${escapeHtml(fact)}</span>`)
      .join('')
    hoverTip
      .setLngLat(center)
      .setHTML(`<span class="hover-tip-name">${escapeHtml(name)}</span>${factsHtml}`)
      .addTo(map)
    hoverTipSlug = slug
  }

  function openPopupFor(slug: string, deferKeepInView = false): void {
    const center = centerBySlug.get(slug)
    if (!center) {
      return
    }
    // The full popup supersedes the hover card.
    hideHoverTip()
    popup.setLngLat(center).setHTML(popupHtmlFor(slug)).addTo(map)
    activate(slug)
    // Keep the popup clear of the sticky chrome + map edges (see map-shared). When a
    // list click is panning to this neighborhood, wait for the pan to end so the
    // nudge doesn't fight the animation.
    const getPopupEl = () => popup.getElement() ?? undefined
    if (deferKeepInView) {
      map.once('moveend', () => keepPopupInView(map, getPopupEl))
    } else {
      keepPopupInView(map, getPopupEl)
    }
  }

  // Add (or re-add, after a theme-driven setStyle) the boundary source + fill/line
  // layers. fill/line opacity + width come from feature-state so hover/selection
  // repaint on the GPU. Re-applies the current selection after a style reload.
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
    // Feature-state is cleared by a style reload; restore the live selection.
    if (selectedSlug) {
      setSlugState(selectedSlug, { selected: true })
    }
  }

  // Explored neighborhoods (a writeup exists) get a filled, clickable region-colored
  // pin marker that opens their popup; unexplored ones have none, so clicks fall
  // through to the polygon.
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
      const region = regionKeyBySlug.get(slug) ?? 'central'
      const color = regionColors[region]

      const element = document.createElement('div')
      element.className = 'neighborhood-marker'
      // viewBox is padded 2px beyond the 24×32 path so the 2px ring stroke (which
      // sits half-outside the path edge) isn't clipped; the tip at path (12,32)
      // lands at pixel (14,34) in the padded box.
      element.innerHTML = `<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="${color}" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>`
      // Keep the pin body so it recolors alongside the polygons on a theme swap.
      const pinBody = element.querySelector('.marker-pin-body')
      if (pinBody) {
        pinBodyBySlug.set(slug, pinBody)
      }

      new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(center).addTo(map)

      element.addEventListener('click', (event) => {
        event.stopPropagation()
        openPopupFor(slug)
      })
      // Hovering the marker previews its boundary, like hovering the polygon.
      element.addEventListener('mouseenter', () => {
        if (!canHover) {
          return
        }
        if (slug !== selectedSlug) {
          setSlugState(slug, { hover: true })
        }
        showHoverTip(slug)
      })
      element.addEventListener('mouseleave', () => {
        if (!canHover) {
          return
        }
        setSlugState(slug, { hover: false })
        hideHoverTip()
      })
    }
  }

  // Boundary hover (feature-state) + click-to-open. A single map-level click opens
  // the boundary under the pointer or, on empty space, closes the popup.
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
      showHoverTip(slug)
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', FILL_LAYER, () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: SOURCE_ID, id: hoveredId }, { hover: false })
      }
      hoveredId = null
      hideHoverTip()
      map.getCanvas().style.cursor = ''
    })
    map.on('click', (event) => {
      hideHoverTip()
      const hits = map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] })
      const slug = hits.length ? String(hits[0].properties?.slug ?? '') : ''
      if (slug) {
        openPopupFor(slug)
      } else {
        popup.remove()
      }
    })
  }

  // The row title is a plain link to the neighborhood's detail page (like the Food
  // list), so clicking one in the list navigates there; the map's own polygons and
  // pins still open the in-place popup. `split` drives the map-pane observer below.
  const split = document.querySelector('[data-map-split]')

  // Deep-link support: /neighborhoods#slug selects + frames that neighborhood on
  // load; otherwise frame the whole City of St. Louis.
  function frameInitialView(): void {
    const initialSlug = location.hash.slice(1)
    if (initialSlug && slugToFeatureIds.has(initialSlug)) {
      activate(initialSlug)
      const selectedBounds = boundsBySlug.get(initialSlug)
      if (selectedBounds) {
        // Instant on initial load — no fly-in.
        map.fitBounds(selectedBounds, { padding: 40, maxZoom: 13, animate: false })
      }
    } else {
      // Frame the whole city. Instant on initial load — no fly-in. (setCenter
      // below is a jump.)
      map.fitBounds(cityBounds, { padding: 40, animate: false })

      const visibleBounds = map.getBounds()
      const visibleLatSpan = visibleBounds.getNorth() - visibleBounds.getSouth()
      const visibleLngSpan = visibleBounds.getEast() - visibleBounds.getWest()
      const center = map.getCenter()

      // Bias ~10% south: the far-north tip is a long, thin neighborhood we don't need
      // centered, so drop it off the top and pull more of South City in.
      const biasedLat = center.lat - visibleLatSpan * 0.1

      // Pull the view west so the Mississippi (the city's east edge) sits ~6% from
      // the right edge, rather than framing empty Illinois on a wide pane. Math.min
      // means we only ever shift WEST — a narrow/mobile viewport that already fits
      // the city tightly (little horizontal slack) is left centered as-is.
      const riverEdge = cityBounds.getEast()
      const westBiasedLng = riverEdge + visibleLngSpan * 0.06 - visibleLngSpan / 2
      const biasedLng = Math.min(center.lng, westBiasedLng)

      map.setCenter([biasedLng, biasedLat])
    }
  }

  // On mobile the page opens on the reading pane, so the map starts hidden and
  // would measure a zero-size container. Only frame once it actually has a size; if
  // it's hidden at load, wait for the first switch to the map pane, then re-measure.
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
    // A theme swap carries the boundary source/layers onto the new style via
    // transformStyle (see basemap.ts); once it lands, recolor the boundaries + pins
    // from the new theme's CSS map-color tokens (the paint/SVG had the old values).
    watchThemeChanges(map, () => {
      regionColors = readRegionColors()
      if (map.getLayer(FILL_LAYER)) {
        map.setPaintProperty(FILL_LAYER, 'fill-color', regionColorExpression())
      }
      if (map.getLayer(LINE_LAYER)) {
        map.setPaintProperty(LINE_LAYER, 'line-color', regionColorExpression())
      }
      for (const [slug, pinBody] of pinBodyBySlug) {
        const region = regionKeyBySlug.get(slug)
        if (region) {
          pinBody.setAttribute('fill', regionColors[region])
        }
      }
    })
    frameWhenSized()
  })
}
