import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { addThemedTiles } from './tiles'
import { buildPopupHtml, escapeHtml, type PopupChip, type PopupSource } from './popup'
import { keepPopupInView, zoomEaseOptions } from './map-shared'
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
  // Section colors: the three St. Louis City regions (North yellow, Central red,
  // South violet); St. Louis County is blue; parks are green by `type`, regardless
  // of which region they sit in.
  const colorNorth = readColor('--color-map-north', '#b8860b')
  const colorCentral = readColor('--color-map-central', '#c0392b')
  const colorSouth = readColor('--color-map-south', '#6a47a6')
  const colorCounty = readColor('--color-map-county', '#2766ad')
  const colorPark = readColor('--color-map-park', '#2e7d4a')

  function colorForArea(area: { group?: string; type?: string } | undefined): string {
    if (area?.type === 'park') {
      return colorPark
    }
    if (area?.group === 'St. Louis County') {
      return colorCounty
    }
    if (area?.group === 'North City') {
      return colorNorth
    }
    if (area?.group === 'South City') {
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
    ...zoomEaseOptions,
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

  // The boundary popup matches the Food map's (shared buildPopupHtml): the
  // neighborhood name (linked to its page), an area chip, a writeup teaser, then
  // resource buttons. The area + links are read off the matching list row's data
  // attributes (set server-side).
  function popupHtmlFor(slug: string, name: string): string {
    if (!slug) {
      return `<h2>${escapeHtml(name)}</h2>`
    }
    const row = rowFor(slug)
    const area = row?.dataset.area ?? ''
    const region = row?.dataset.region ?? ''
    // Each chip carries its section's colored dot. Parks lead with a green "Park"
    // chip, then their region chip (e.g. "Park" + "Central Corridor").
    const chips: PopupChip[] = []
    if (row?.dataset.type === 'park') {
      chips.push({ label: 'Park', section: 'park' })
    }
    if (area) {
      chips.push({ label: area, section: region })
    }
    const link = `${import.meta.env.BASE_URL}neighborhoods/${slug}`
    const sources = [
      row?.dataset.wikipedia && { label: 'Wikipedia', href: row.dataset.wikipedia },
      row?.dataset.mytownview && { label: 'MyTownView', href: row.dataset.mytownview },
      row?.dataset.official && { label: 'Website', href: row.dataset.official },
      row?.dataset.city && { label: 'St. Louis City', href: row.dataset.city },
    ].filter(Boolean) as PopupSource[]

    // Every neighborhood has its own page (a writeup or the computed data layer),
    // so "View more" always shows — the builder's default.
    return buildPopupHtml({
      title: name,
      link,
      chips,
      tagline: row?.dataset.tagline ?? '',
      excerpt: row?.dataset.excerpt ?? '',
      sources,
    })
  }

  const bounds = L.latLngBounds([])

  L.geoJSON(geojson, {
    style: (feature) => {
      const color = colorForArea(byNumber.get(Number(feature?.properties?.NHD_NUM)))

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
        colorBySlug.set(slug, colorForArea(entry))
      }

      featureLayer.bindPopup(popupHtmlFor(slug, name), {
        className: 'food-popup',
        maxWidth: 330,
        minWidth: 210,
        // Lift the popup clear of the marker (the explored pin rises ~34px from
        // its tip), so it floats above it instead of covering it.
        offset: [0, -38],
        autoPanPaddingTopLeft,
        autoPanPaddingBottomRight,
      })
      featureLayer.on('popupopen', () => {
        if (!slug) {
          return
        }
        activate(slug)
        // Keep the popup clear of the sticky chrome + map edges (see map-shared).
        keepPopupInView(map, () => featureLayer.getPopup()?.getElement() ?? undefined)
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

      // Centered boundary badge. Explored neighborhoods (a writeup exists) get a
      // filled, clickable region-colored marker that opens their popup — an obvious
      // tap target; unexplored ones keep a quiet, non-interactive number so clicks
      // fall through to the polygon. A merged neighborhood can show a range (e.g.
      // Dogtown → "41-44"); the box widens to fit it.
      if (Number.isFinite(number)) {
        const badge = entry && 'numberLabel' in entry ? entry.numberLabel : String(number)
        const width = Math.max(26, (badge?.length ?? 1) * 11)
        const explored = Boolean(slug) && (rowFor(slug)?.classList.contains('is-written') ?? false)

        if (explored) {
          const color = colorForArea(entry)
          const marker = L.marker(layerBounds.getCenter(), {
            icon: L.divIcon({
              className: 'neighborhood-marker',
              // viewBox is padded 2px beyond the 24×32 path so the 2px ring stroke
              // (which sits half-outside the path edge) isn't clipped; the tip at
              // path (12,32) lands at pixel (14,34) in the padded box.
              html: `<svg class="marker-pin" viewBox="-2 -2 28 36" width="28" height="36" fill="none" aria-hidden="true"><path class="marker-pin-body" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 20 12 20s12-11 12-20c0-6.617-5.383-12-12-12z" fill="${color}" /><circle class="marker-pin-dot" cx="12" cy="12" r="4.5" /></svg>`,
              iconSize: [28, 36],
              iconAnchor: [14, 34],
            }),
            title: name,
            riseOnHover: true,
          }).addTo(map)
          // Anchor the popup to the pin (the polygon's own center can differ from
          // the marker's), so it sits directly above the marker.
          marker.on('click', () => featureLayer.openPopup(marker.getLatLng()))
          // Hovering the marker previews its boundary, like hovering the polygon.
          marker.on('mouseover', () => {
            if (slug !== selectedSlug) {
              path.setStyle(hoverStyle)
            }
          })
          marker.on('mouseout', () => {
            path.setStyle(slug === selectedSlug ? selectedStyleFor(slug) : baseStyleFor(slug))
          })
        } else if (!entry?.type) {
          // Only standard numbered city neighborhoods get a number badge — parks
          // and county municipalities aren't numbered, so they show none.
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

  // Deep-link support: /neighborhoods#slug selects that neighborhood on load, so
  // the "View on the neighborhood map" links (and any backlinks) highlight its
  // boundary and frame it on the map. Otherwise frame the whole City of St. Louis.
  const initialSlug = location.hash.slice(1)
  if (initialSlug && pathBySlug.has(initialSlug)) {
    activate(initialSlug)
    const selectedBounds = (pathBySlug.get(initialSlug) as L.Polygon | undefined)?.getBounds()
    if (selectedBounds) {
      map.fitBounds(selectedBounds, { padding: [40, 40], animate: false, maxZoom: 13 })
    }
  } else {
    // Frame the whole city, then zoom in half a level for a tighter default view.
    map.fitBounds(bounds, { padding: [10, 10], animate: false })
    map.setZoom(map.getZoom() + 0.5, { animate: false })
    // Bias the view ~10% south: the far-north tip is a long, thin neighborhood we
    // don't need centered, so drop it off the top and pull more of South City in.
    const visibleLatSpan = map.getBounds().getNorth() - map.getBounds().getSouth()
    const center = map.getCenter()
    map.setView([center.lat - visibleLatSpan * 0.1, center.lng], map.getZoom(), { animate: false })
  }
}
