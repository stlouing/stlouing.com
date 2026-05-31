import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import neighborhoods from '../data/neighborhoods.json'

// Join boundaries to the page's sections by the official NHD_NUM (unique), so
// the map and the generated sections always share one slug — no re-slugifying.
const byNumber = new Map(neighborhoods.map((neighborhood) => [neighborhood.number, neighborhood]))

interface SectionController {
  // Isolate one neighborhood's writeup, or pass null to show them all again.
  show: (slug: string | null) => void
  // The list rows, so the map can wire up list-to-map selection.
  rows: HTMLElement[]
}

/** Controls which neighborhood writeup(s) the left pane shows; null if absent. */
function createSectionController(): SectionController | null {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-section]')]
  if (rows.length === 0) {
    return null
  }

  const pane = document.querySelector<HTMLElement>('.content-pane')

  function show(slug: string | null): void {
    for (const row of rows) {
      row.hidden = slug !== null && row.dataset.section !== slug
    }

    if (pane) {
      pane.scrollTop = 0
    }
  }

  return { show, rows }
}

/**
 * Clickable St. Louis neighborhood map. Draws each official boundary with its
 * number and, on click, reveals that neighborhood's writeup in the left pane.
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
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

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

  const sections = createSectionController()
  const split = document.querySelector('[data-map-split]')
  const backLink = document.querySelector<HTMLElement>('[data-back-to-all]')
  const pathBySlug = new Map<string, L.Path>()

  backLink?.addEventListener('click', () => clearSelection())

  let selectedSlug: string | null = null

  function paintPath(slug: string, style: L.PathOptions): void {
    pathBySlug.get(slug)?.setStyle(style)
  }

  // Single source of truth for selection, driven by both map and list clicks.
  // Clicking the already-selected neighborhood clears it (shows all again).
  function selectNeighborhood(slug: string, options: { flip?: boolean } = {}): void {
    if (selectedSlug === slug) {
      clearSelection()

      return
    }

    if (selectedSlug) {
      paintPath(selectedSlug, baseStyle)
      rowFor(selectedSlug)?.classList.remove('is-active')
    }

    selectedSlug = slug
    paintPath(slug, selectedStyle)
    rowFor(slug)?.classList.add('is-active')
    sections?.show(slug)
    history.replaceState(null, '', `#${slug}`)

    if (backLink) {
      backLink.hidden = false
    }

    // On mobile only one pane shows; reveal the writeups when asked.
    if (options.flip && split) {
      split.setAttribute('data-view', 'content')
      split.dispatchEvent(new CustomEvent('mapsplit:viewchange'))
    }
  }

  function clearSelection(): void {
    if (selectedSlug) {
      paintPath(selectedSlug, baseStyle)
      rowFor(selectedSlug)?.classList.remove('is-active')
    }
    selectedSlug = null
    sections?.show(null)
    history.replaceState(null, '', location.pathname + location.search)

    if (backLink) {
      backLink.hidden = true
    }
  }

  function rowFor(slug: string): HTMLElement | undefined {
    return sections?.rows.find((row) => row.dataset.section === slug)
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
      featureLayer.on('click', () => selectNeighborhood(slug, { flip: true }))

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

  // Clicking a list row selects its neighborhood on the map (and toggles off).
  for (const row of sections?.rows ?? []) {
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
