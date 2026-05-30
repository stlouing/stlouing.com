import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'

/** Match Astro's auto heading ids (github-slugger) so polygon clicks can jump
 *  to a `## Neighborhood Name` section on the page. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

/**
 * Clickable St. Louis neighborhood-boundary map. Loads the locally bundled
 * GeoJSON, draws each boundary, and on click scrolls to that neighborhood's
 * heading on the page (or shows a popup if it hasn't been written yet).
 */
export async function initNeighborhoodMap(selector = '[data-neighborhood-map]'): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) return

  const mapAccent =
    getComputedStyle(document.documentElement).getPropertyValue('--color-map-accent').trim() ||
    '#5a3a93'

  let geojson: unknown
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}stl-neighborhoods.geojson`)
    if (!response.ok) return
    geojson = await response.json()
  } catch {
    return
  }

  const map = L.map(element, { scrollWheelZoom: true, touchZoom: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  const baseStyle: L.PathOptions = {
    color: mapAccent,
    weight: 2,
    fillColor: mapAccent,
    fillOpacity: 0.15,
  }
  const hoverStyle: L.PathOptions = { weight: 3, fillOpacity: 0.2 }

  const boundaries = L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
    style: () => baseStyle,
    onEachFeature: (feature, featureLayer) => {
      const name = String(feature.properties?.NHD_NAME ?? 'Neighborhood')
      const path = featureLayer as L.Path

      featureLayer.bindTooltip(name, { sticky: true })
      featureLayer.on('mouseover', () => path.setStyle(hoverStyle))
      featureLayer.on('mouseout', () => path.setStyle(baseStyle))
      featureLayer.on('click', () => {
        const target = document.getElementById(slugify(name))
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          history.replaceState(null, '', `#${slugify(name)}`)
        } else {
          featureLayer.bindPopup(`<strong>${name}</strong><br>Not written yet.`).openPopup()
        }
      })
    },
  }).addTo(map)

  map.fitBounds(boundaries.getBounds(), { padding: [10, 10] })
}
