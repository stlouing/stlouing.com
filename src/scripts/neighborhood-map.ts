import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'
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

/**
 * Clickable St. Louis neighborhood map. Draws each official boundary with its
 * number and, on click, expands that neighborhood's writeup in the left pane.
 */
export async function initNeighborhoodMap(selector = '[data-neighborhood-map]'): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    return
  }

  const styles = getComputedStyle(document.documentElement)
  const readColor = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback
  // One color per region group — top→bottom: North red, Central purple, South blue.
  const colorCentral = readColor('--color-map-central', readColor('--color-map-accent', '#6a47a6'))
  const colorNorth = readColor('--color-map-north', '#9c3b2e')
  const colorSouth = readColor('--color-map-south', '#225aa9')

  function colorForGroup(group: string | undefined): string {
    if (group === 'North City') {
      return colorNorth
    }
    if (group === 'South City') {
      return colorSouth
    }

    return colorCentral
  }

  let geojson: GeoJSON.FeatureCollection
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    if (!response.ok) {
      return
    }
    geojson = await response.json()
  } catch {
    return
  }

  const map = L.map(element, {
    scrollWheelZoom: true,
    touchZoom: true,
    minZoom: 10,
    maxZoom: 16,
    zoomSnap: 0.5,
  })
  addThemedTiles(map)

  const colorBySlug = new Map<string, string>()
  function baseStyleFor(slug: string): L.PathOptions {
    const color = colorBySlug.get(slug) ?? colorCentral

    return { color, weight: 2, fillColor: color, fillOpacity: 0.1 }
  }
  function selectedStyleFor(slug: string): L.PathOptions {
    const color = colorBySlug.get(slug) ?? colorCentral

    return { color, weight: 4, fillColor: color, fillOpacity: 0.4 }
  }
  const hoverStyle: L.PathOptions = { weight: 3, fillOpacity: 0.3 }

  const rows = [...document.querySelectorAll<HTMLElement>('[data-section]')]
  const pathBySlug = new Map<string, L.Path>()

  let selectedSlug: string | null = null

  function paintPath(slug: string, style: L.PathOptions): void {
    pathBySlug.get(slug)?.setStyle(style)
  }

  // Single source of truth for selection, driven by both map and list clicks.
  // Selecting a neighborhood expands its writeup inline (and highlights its
  // boundary); selecting the already-selected one collapses it again. Other
  // rows stay in place — only the chosen one expands. On mobile this never
  // switches panes: a map click keeps you on the map (the floating toggle is
  // the only way to flip to the writeups).
  function selectNeighborhood(slug: string): void {
    if (selectedSlug === slug) {
      clearSelection()

      return
    }

    if (selectedSlug) {
      paintPath(selectedSlug, baseStyleFor(selectedSlug))
      setRowExpanded(selectedSlug, false)
    }

    selectedSlug = slug
    paintPath(slug, selectedStyleFor(slug))
    setRowExpanded(slug, true)
    // Bring the chosen neighborhood to the top of the pane (scroll-padding on
    // .content-pane keeps it clear of the sticky header).
    rowFor(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${slug}`)
  }

  function clearSelection(): void {
    if (selectedSlug) {
      paintPath(selectedSlug, baseStyleFor(selectedSlug))
      setRowExpanded(selectedSlug, false)
    }
    selectedSlug = null
    history.replaceState(null, '', location.pathname + location.search)
  }

  // Expand/collapse a row's writeup: `is-active` toggles the body and caret via
  // CSS, and `aria-expanded` keeps the disclosure button accessible.
  function setRowExpanded(slug: string, expanded: boolean): void {
    const row = rowFor(slug)
    if (!row) {
      return
    }
    row.classList.toggle('is-active', expanded)
    row.querySelector('.neighborhood-toggle')?.setAttribute('aria-expanded', String(expanded))
  }

  function rowFor(slug: string): HTMLElement | undefined {
    return rows.find((row) => row.dataset.section === slug)
  }

  const bounds = L.latLngBounds([])

  L.geoJSON(geojson, {
    style: (feature) => {
      const color = colorForGroup(byNumber.get(Number(feature?.properties?.NHD_NUM))?.group)

      return { color, weight: 2, fillColor: color, fillOpacity: 0.1 }
    },
    onEachFeature: (feature, featureLayer) => {
      const number = Number(feature.properties?.NHD_NUM)
      const entry = byNumber.get(number)
      const name = entry?.name ?? String(feature.properties?.NHD_NAME ?? 'Neighborhood')
      const slug = entry?.slug ?? ''
      const path = featureLayer as L.Path
      const layerBounds = (featureLayer as L.Polygon).getBounds()
      bounds.extend(layerBounds)
      if (slug) {
        pathBySlug.set(slug, path)
        colorBySlug.set(slug, colorForGroup(entry?.group))
      }

      featureLayer.bindTooltip(name, {
        className: 'map-tooltip',
        direction: 'top',
        sticky: true,
        opacity: 1,
        offset: [0, -2],
      })
      featureLayer.on('mouseover', () => {
        if (slug !== selectedSlug) {
          path.setStyle(hoverStyle)
        }
      })
      featureLayer.on('mouseout', () => {
        path.setStyle(slug === selectedSlug ? selectedStyleFor(slug) : baseStyleFor(slug))
      })
      featureLayer.on('click', () => selectNeighborhood(slug))

      // Numbered badge centered on the boundary (non-interactive so clicks fall
      // through to the polygon underneath). A merged neighborhood can show a
      // range (e.g. Dogtown → "41-44"); the box widens to fit it.
      if (Number.isFinite(number)) {
        const badge = entry && 'numberLabel' in entry ? entry.numberLabel : String(number)
        const width = Math.max(20, badge?.length || 1 * 9)
        L.marker(layerBounds.getCenter(), {
          icon: L.divIcon({
            className: 'neighborhood-number',
            html: badge,
            iconSize: [width, 20],
            iconAnchor: [width / 2, 10],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(map)
      }
    },
  }).addTo(map)

  // Clicking a list row expands its neighborhood (and toggles off), mirroring
  // the map click.
  for (const row of rows) {
    const slug = row.dataset.section
    if (!slug) {
      continue
    }
    const title = row.querySelector<HTMLElement>('.list-title') ?? row
    title.classList.add('is-clickable')
    title.addEventListener('click', () => selectNeighborhood(slug))
  }

  // Default framing favors the south + central city. The northernmost of Forest
  // Park / CWE / Skinker (the top of #46) is the city's effective dividing line;
  // everything above it is the north side we want scrolled out of view.
  const topAnchorSlugs = ['forest-park', 'central-west-end', 'skinker-debaliviere']
  const northEdges = topAnchorSlugs
    .map((slug) => pathBySlug.get(slug) as L.Polygon | undefined)
    .filter((anchorPath): anchorPath is L.Polygon => Boolean(anchorPath))
    .map((anchorPath) => anchorPath.getBounds().getNorth())

  // Pin the top of #46 just below the viewport top, then zoom one 0.5 step (the
  // map's zoomSnap) tighter than the full-corridor fit so the south tip (Patch)
  // is cropped off the bottom. Pinning the top — rather than fitBounds, which
  // always keeps the whole span visible — makes the framing independent of the
  // pane's aspect ratio. Bump ZOOM_BOOST to zoom in further.
  const ZOOM_BOOST = 0.5
  const TOP_INSET_PX = 8

  function frameNeighborhood(): void {
    if (northEdges.length === 0) {
      map.fitBounds(bounds, { padding: [10, 10], animate: false })

      return
    }

    const topLat = Math.max(...northEdges)
    const midLng = (bounds.getWest() + bounds.getEast()) / 2
    const corridor = L.latLngBounds(
      [bounds.getSouth(), bounds.getWest()],
      [topLat, bounds.getEast()],
    )
    const fitZoom = map.getBoundsZoom(corridor, false, L.point(TOP_INSET_PX, TOP_INSET_PX))
    const targetZoom = Math.min(fitZoom + ZOOM_BOOST, map.getMaxZoom())

    // Place the center so the top edge lands TOP_INSET_PX below the viewport top.
    const topPoint = map.project([topLat, midLng], targetZoom)
    const center = map.unproject(
      topPoint.add(L.point(0, map.getSize().y / 2 - TOP_INSET_PX)),
      targetZoom,
    )
    map.setView(center, targetZoom, { animate: false })
  }

  // Deep-link support: /neighborhoods#slug selects that neighborhood on load, so
  // the "View on the neighborhood map" links (and any backlinks) expand its
  // writeup, highlight its boundary, and frame it on the map. Otherwise fall back
  // to the southside framing above.
  const initialSlug = location.hash.slice(1)
  if (initialSlug && pathBySlug.has(initialSlug)) {
    selectNeighborhood(initialSlug)
    const selectedBounds = (pathBySlug.get(initialSlug) as L.Polygon | undefined)?.getBounds()
    if (selectedBounds) {
      map.fitBounds(selectedBounds, { padding: [40, 40], animate: false, maxZoom: 13 })
    }
  } else {
    frameNeighborhood()
  }
}
