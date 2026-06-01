import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'
import neighborhoods from '../data/neighborhoods.json'

// Join boundaries to the page's sections by the official NHD_NUM (unique), so
// the map and the generated sections always share one slug — no re-slugifying.
const byNumber = new Map(neighborhoods.map((neighborhood) => [neighborhood.number, neighborhood]))

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
  const mapAccent = styles.getPropertyValue('--color-map-accent').trim() || '#5a3a93'

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

  const map = L.map(element, { scrollWheelZoom: true, touchZoom: true })
  addThemedTiles(map)

  const baseStyle: L.PathOptions = {
    color: mapAccent,
    weight: 2,
    fillColor: mapAccent,
    fillOpacity: 0.1,
  }
  const hoverStyle: L.PathOptions = { weight: 3, fillOpacity: 0.3 }
  const selectedStyle: L.PathOptions = {
    color: mapAccent,
    weight: 4,
    fillColor: mapAccent,
    fillOpacity: 0.4,
  }

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
      paintPath(selectedSlug, baseStyle)
      setRowExpanded(selectedSlug, false)
    }

    selectedSlug = slug
    paintPath(slug, selectedStyle)
    setRowExpanded(slug, true)
    rowFor(slug)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    history.replaceState(null, '', `#${slug}`)
  }

  function clearSelection(): void {
    if (selectedSlug) {
      paintPath(selectedSlug, baseStyle)
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
    style: () => baseStyle,
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
        path.setStyle(slug === selectedSlug ? selectedStyle : baseStyle)
      })
      featureLayer.on('click', () => selectNeighborhood(slug))

      // Numbered badge centered on the boundary (non-interactive so clicks fall
      // through to the polygon underneath).
      if (Number.isFinite(number)) {
        L.marker(layerBounds.getCenter(), {
          icon: L.divIcon({
            className: 'neighborhood-number',
            html: String(number),
            iconSize: [20, 20],
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

  // Fit the whole city, then step one level closer for a tighter default view.
  map.fitBounds(bounds, { padding: [10, 10] })
  map.setZoom(map.getZoom() + 1)
}
