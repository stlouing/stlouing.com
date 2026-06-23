import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'
import neighborhoods from '../data/neighborhoods.json'

// Escape text before it goes into the popup's innerHTML.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

  // Extra top auto-pan padding so an opened popup clears the sticky header
  // instead of being cut off at the top (most noticeable on mobile).
  const headerHeight =
    parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'), 10) ||
    64
  const autoPanPaddingTopLeft = L.point(16, headerHeight + 16)
  const autoPanPaddingBottomRight = L.point(16, 24)

  // Bottom edge (viewport px) of the sticky chrome above the map — the site
  // header. A popup opened near the top is nudged below this (mirrors the Food map).
  function topChromeBottom(): number {
    return ['.site-header', '.secondary-header']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .reduce(
        (bottom, node) => (node ? Math.max(bottom, node.getBoundingClientRect().bottom) : bottom),
        0,
      )
  }

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
  const centerBySlug = new Map<string, L.LatLng>()

  let selectedSlug: string | null = null

  function paintPath(slug: string, style: L.PathOptions): void {
    pathBySlug.get(slug)?.setStyle(style)
  }

  function setRowActive(slug: string, active: boolean): void {
    rowFor(slug)?.classList.toggle('is-active', active)
  }

  // Selection follows the boundary's popup (open = selected), mirroring the Food
  // map. Opening a neighborhood's popup highlights its boundary, marks its row
  // active, and scrolls that row to the top of the pane; closing it clears all
  // three. Keyed by slug so switching neighborhoods stays in sync no matter how
  // the popup was opened (map click or list row).
  function activate(slug: string): void {
    if (selectedSlug === slug) {
      return
    }

    if (selectedSlug) {
      paintPath(selectedSlug, baseStyleFor(selectedSlug))
      setRowActive(selectedSlug, false)
    }

    selectedSlug = slug
    paintPath(slug, selectedStyleFor(slug))
    setRowActive(slug, true)
    // Bring the chosen neighborhood to the top of the pane (scroll-padding on
    // .content-pane keeps it clear of the sticky header).
    rowFor(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${slug}`)
  }

  function deactivate(slug: string): void {
    if (selectedSlug !== slug) {
      return
    }
    paintPath(slug, baseStyleFor(slug))
    setRowActive(slug, false)
    selectedSlug = null
  }

  function rowFor(slug: string): HTMLElement | undefined {
    return rows.find((row) => row.dataset.section === slug)
  }

  // The boundary popup matches the Food map's: the neighborhood name (linked to
  // its page) in big text, its area, then quick resource links. The area + links
  // are read off the matching list row's data attributes (set server-side).
  function buildPopupHtml(slug: string, name: string): string {
    if (!slug) {
      return `<h2>${escapeHtml(name)}</h2>`
    }
    const row = rowFor(slug)
    const area = row?.dataset.area ?? ''
    const official = row?.dataset.official
    const wikipedia = row?.dataset.wikipedia
    const city = row?.dataset.city
    const niche = row?.dataset.niche
    const excerptText = row?.dataset.excerpt ?? ''
    const link = `${import.meta.env.BASE_URL}neighborhoods/${slug}`

    // Same spirit as the food popup: linked title, an area chip, a writeup teaser
    // (when written), a ruled "View more", then the resources as buttons.
    const titleHtml = `<h2><a href="${link}">${escapeHtml(name)}</a></h2>`
    const metaHtml = area
      ? `<div class="popup-meta"><span class="popup-chip">${escapeHtml(area)}</span></div>`
      : ''
    const excerptHtml = excerptText ? `<p class="tip-excerpt">${escapeHtml(excerptText)}</p>` : ''
    // Every neighborhood has its own page (a writeup or the computed data layer),
    // so "View more" always shows — not just when there's a writeup excerpt.
    const moreHtml = `<a class="popup-more-link" href="${link}">View more</a>`
    const sources = [
      official &&
        `<a class="popup-btn" href="${official}" target="_blank" rel="noopener">Website</a>`,
      wikipedia &&
        `<a class="popup-btn" href="${wikipedia}" target="_blank" rel="noopener">Wikipedia</a>`,
      city &&
        `<a class="popup-btn" href="${city}" target="_blank" rel="noopener">City of St. Louis</a>`,
      niche && `<a class="popup-btn" href="${niche}" target="_blank" rel="noopener">Niche</a>`,
    ]
      .filter(Boolean)
      .join('')
    const sourcesHtml = sources ? `<div class="popup-actions">${sources}</div>` : ''

    return `${titleHtml}${metaHtml}${excerptHtml}${moreHtml}${sourcesHtml}`
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
        centerBySlug.set(slug, layerBounds.getCenter())
        colorBySlug.set(slug, colorForGroup(entry?.group))
      }

      featureLayer.bindPopup(buildPopupHtml(slug, name), {
        className: 'food-popup',
        maxWidth: 330,
        minWidth: 210,
        offset: [0, -2],
        autoPanPaddingTopLeft,
        autoPanPaddingBottomRight,
      })
      featureLayer.on('popupopen', () => {
        if (!slug) {
          return
        }
        activate(slug)
        // Mirror the Food map: nudge the popup clear of the sticky header (top)
        // and the map's left/right edges, rather than leaving it to Leaflet's
        // autoPan (which jerks the map around, especially on mobile).
        requestAnimationFrame(() => {
          const popupEl = featureLayer.getPopup()?.getElement()
          if (!popupEl) {
            return
          }
          const popupRect = popupEl.getBoundingClientRect()
          const mapRect = map.getContainer().getBoundingClientRect()
          const pad = 16
          const topLimit = topChromeBottom() + 8
          let dx = 0
          let dy = 0
          if (popupRect.top < topLimit) {
            dy = popupRect.top - topLimit
          }
          if (popupRect.left < mapRect.left + pad) {
            dx = popupRect.left - (mapRect.left + pad)
          } else if (popupRect.right > mapRect.right - pad) {
            dx = popupRect.right - (mapRect.right - pad)
          }
          if (dx !== 0 || dy !== 0) {
            map.panBy([dx, dy], { animate: true })
          }
        })
      })
      featureLayer.on('popupclose', () => {
        if (slug) {
          deactivate(slug)
        }
      })
      featureLayer.on('mouseover', () => {
        if (slug !== selectedSlug) {
          path.setStyle(hoverStyle)
        }
      })
      featureLayer.on('mouseout', () => {
        path.setStyle(slug === selectedSlug ? selectedStyleFor(slug) : baseStyleFor(slug))
      })

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

  // The row title links to the neighborhood's page. In the reading (list) view we
  // let that link navigate; in map view we intercept the click to open that
  // neighborhood's popup instead (highlighting its boundary + scrolling the row
  // up), and clicking the open one again closes it.
  const split = document.querySelector('[data-map-split]')
  for (const row of rows) {
    const slug = row.dataset.section
    if (!slug) {
      continue
    }
    const title = row.querySelector<HTMLElement>('.list-title') ?? row
    title.classList.add('is-clickable')
    title.addEventListener('click', (event) => {
      if (split?.getAttribute('data-view') !== 'map') {
        return
      }
      event.preventDefault()
      const path = pathBySlug.get(slug)
      if (!path) {
        return
      }
      if (selectedSlug === slug) {
        path.closePopup()
      } else {
        path.openPopup(centerBySlug.get(slug))
      }
    })
  }

  // The zoom is sized from the central #46 corridor (Forest Park / CWE / Skinker
  // line down to the south tip), so it doesn't change when the pin moves. The view
  // is then pinned with the far-north #70 at the top — showing more of the north
  // side — which puts #2 (Patch) near the bottom.
  const zoomAnchorSlugs = ['forest-park', 'central-west-end', 'skinker-debaliviere']
  const zoomNorthEdges = zoomAnchorSlugs
    .map((slug) => pathBySlug.get(slug) as L.Polygon | undefined)
    .filter((anchorPath): anchorPath is L.Polygon => Boolean(anchorPath))
    .map((anchorPath) => anchorPath.getBounds().getNorth())

  // Neighborhood whose north edge pins the top of the view. #70 = Mark Twain I-70
  // Industrial (the far-north anchor). ZOOM_BOOST offsets the corridor fit (0 = fit);
  // pinning the top — rather than fitBounds — keeps it independent of pane aspect.
  const PIN_SLUG = 'mark-twain-i-70-industrial'
  const ZOOM_BOOST = 0
  const TOP_INSET_PX = 8

  function frameNeighborhood(): void {
    const pinPath = pathBySlug.get(PIN_SLUG) as L.Polygon | undefined
    if (zoomNorthEdges.length === 0 || !pinPath) {
      map.fitBounds(bounds, { padding: [10, 10], animate: false })

      return
    }

    const zoomTopLat = Math.max(...zoomNorthEdges)
    const pinTopLat = pinPath.getBounds().getNorth()
    const midLng = (bounds.getWest() + bounds.getEast()) / 2
    const corridor = L.latLngBounds(
      [bounds.getSouth(), bounds.getWest()],
      [zoomTopLat, bounds.getEast()],
    )
    const fitZoom = map.getBoundsZoom(corridor, false, L.point(TOP_INSET_PX, TOP_INSET_PX))
    const targetZoom = Math.min(fitZoom + ZOOM_BOOST, map.getMaxZoom())

    // Pin the top of #70 TOP_INSET_PX below the viewport top.
    const topPoint = map.project([pinTopLat, midLng], targetZoom)
    const center = map.unproject(
      topPoint.add(L.point(0, map.getSize().y / 2 - TOP_INSET_PX)),
      targetZoom,
    )
    map.setView(center, targetZoom, { animate: false })
  }

  // Deep-link support: /neighborhoods#slug selects that neighborhood on load, so
  // the "View on the neighborhood map" links (and any backlinks) highlight its
  // boundary and frame it on the map. Otherwise fall back to the southside
  // framing above.
  const initialSlug = location.hash.slice(1)
  if (initialSlug && pathBySlug.has(initialSlug)) {
    activate(initialSlug)
    const selectedBounds = (pathBySlug.get(initialSlug) as L.Polygon | undefined)?.getBounds()
    if (selectedBounds) {
      map.fitBounds(selectedBounds, { padding: [40, 40], animate: false, maxZoom: 13 })
    }
  } else {
    frameNeighborhood()
  }
}
