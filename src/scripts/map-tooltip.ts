import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl'
import type { TooltipSide } from '../lib/area-maps'

export function addMapTooltip(
  map: MapLibreMap,
  label: string,
  point: [number, number],
  side: TooltipSide,
): maplibregl.Marker {
  const anchor = document.createElement('div')
  const tooltip = document.createElement('div')
  tooltip.className = `map-tooltip map-tooltip--${side}`
  const shape = document.createElement('span')
  shape.className = 'map-tooltip-shape'
  shape.setAttribute('aria-hidden', 'true')
  const text = document.createElement('span')
  text.textContent = label
  tooltip.append(shape, text)
  anchor.append(tooltip)

  return new maplibregl.Marker({ element: anchor }).setLngLat(point).addTo(map)
}
