import maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import { boundaryFor, officialPartsFor, type BoundaryFeature } from './boundaries'
import {
  applyColoredAreas,
  applyDashedPieces,
  applyOutlinedArea,
  coloredAreasFor,
  featureBounds,
  readMapColor,
} from './boundary-layers'
import { BADGE_POPUP_OFFSET, bindRowHover, createMapPopup, settlePopup } from './map-shared'
import { createBadge, spotPopupHtml, stackBadges } from './map-badges'
import { bindLegendCollapse, bindLegendToggles } from './map-legend'
import type { DistrictPart } from '../lib/districts'
import type { MapSpot } from '../lib/spots'

const BOUNDARY_PREFIX = 'neighborhood-boundary'
const PARTS_PREFIX = 'neighborhood-parts'
const DISTRICT_PARTS_PREFIX = 'district-parts'

function applyBoundaryLayers(
  map: MapLibreMap,
  boundary: BoundaryFeature,
  parts: BoundaryFeature[],
  token: string,
): void {
  const color = readMapColor(token)

  applyOutlinedArea(map, BOUNDARY_PREFIX, boundary, color)
  if (parts.length > 0) {
    applyDashedPieces(map, PARTS_PREFIX, parts, color)
  }
}

function addSpotMarkers(
  map: MapLibreMap,
  spots: MapSpot[],
  openPopup: (spot: MapSpot, badge: HTMLElement) => void,
): Map<string, HTMLElement> {
  const offsets = stackBadges(spots)
  const badgeByTitle = new Map<string, HTMLElement>()

  for (const spot of spots) {
    const element = createBadge(spot, openPopup)

    new maplibregl.Marker({ element, anchor: 'center', offset: offsets.get(spot) ?? [0, 0] })
      .setLngLat(spot.coords)
      .addTo(map)
    badgeByTitle.set(spot.title, element)
  }

  return badgeByTitle
}

function bindCardHover(badgeByTitle: Map<string, HTMLElement>): void {
  const cards = document.querySelectorAll<HTMLElement>('[data-map-spot]')
  bindRowHover(cards, {
    enter: (card) => badgeByTitle.get(card.dataset.mapSpot ?? '')?.classList.add('is-hovered'),
    leave: (card) => badgeByTitle.get(card.dataset.mapSpot ?? '')?.classList.remove('is-hovered'),
  })
}

function readPayload(root: HTMLElement, selector: string): unknown {
  const holder = root.parentElement?.querySelector(selector)
  if (!holder?.textContent) {
    return undefined
  }

  try {
    return JSON.parse(holder.textContent)
  } catch {
    return undefined
  }
}

function readSpots(root: HTMLElement): MapSpot[] {
  const parsed = readPayload(root, 'script[data-map-pane-spots]')

  return Array.isArray(parsed) ? (parsed as MapSpot[]) : []
}

function readBoundary(root: HTMLElement): BoundaryFeature | undefined {
  return readPayload(root, 'script[data-map-pane-boundary]') as BoundaryFeature | undefined
}

function readDistrictParts(root: HTMLElement): DistrictPart[] {
  const parsed = readPayload(root, 'script[data-map-pane-district-parts]')

  return Array.isArray(parsed) ? (parsed as DistrictPart[]) : []
}

export function initMapPane(): void {
  const root = document.querySelector<HTMLElement>('[data-map-pane]')
  if (!root) {
    return
  }

  const slug = root.dataset.slug ?? ''
  const boundaryToken = root.dataset.boundaryToken ?? '--color-map-accent'
  const spots = readSpots(root)
  const fallbackCoords = (root.dataset.coords ?? '').split(',').map(Number)

  const map = createBasemapMap(root, {
    minZoom: 10,
    maxZoom: 16,
    attributionControl: { compact: true },
    attributionCollapsed: true,
  })

  const popup = createMapPopup(BADGE_POPUP_OFFSET)

  let selectedBadge: HTMLElement | null = null
  popup.on('close', () => {
    selectedBadge?.classList.remove('is-selected')
    selectedBadge = null
  })

  const openSpotPopup = (spot: MapSpot, badge: HTMLElement): void => {
    popup.remove()
    selectedBadge = badge
    badge.classList.add('is-selected')
    popup.setLngLat(spot.coords).setHTML(spotPopupHtml(spot)).addTo(map)
    settlePopup(map, popup)
  }

  map.on('click', () => popup.remove())

  const legend = root.querySelector<HTMLElement>('[data-map-legend]')
  if (legend) {
    bindLegendCollapse(legend)
    bindLegendToggles(legend, (changes) => {
      for (const { key, showing } of changes) {
        for (const badge of root.querySelectorAll<HTMLElement>(
          `.map-badge[data-category="${key}"]`,
        )) {
          badge.hidden = !showing
        }
        if (!showing && selectedBadge?.dataset.category === key) {
          popup.remove()
        }
      }
    })
  }

  const frameView = (bounds: LngLatBoundsLike | undefined): void => {
    if (bounds) {
      const camera = map.cameraForBounds(bounds, { padding: 48 })
      if (camera) {
        map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 13) - 0.15 })
      }
    } else if (fallbackCoords.length === 2 && fallbackCoords.every(Number.isFinite)) {
      map.jumpTo({ center: [fallbackCoords[1], fallbackCoords[0]], zoom: 12.5 })
    }
  }

  const drawnBoundary = readBoundary(root)
  const boundaryPromise = drawnBoundary ? Promise.resolve(drawnBoundary) : boundaryFor(slug)
  void boundaryPromise.then((boundary) => {
    frameView(
      featureBounds(
        boundary ? [boundary] : [],
        spots.map((spot) => spot.coords),
      ),
    )
  })

  const districtParts = readDistrictParts(root)
  const partsPromise: Promise<BoundaryFeature[]> =
    districtParts.length > 0 ? Promise.resolve([]) : officialPartsFor(slug)
  const districtPartsPromise = coloredAreasFor(districtParts)

  map.on('load', async () => {
    const [boundary, parts, districtPartLayers] = await Promise.all([
      boundaryPromise,
      partsPromise,
      districtPartsPromise,
    ])
    const drawBoundaries = (): void => {
      if (boundary) {
        applyBoundaryLayers(map, boundary, parts, boundaryToken)
      }
      if (districtPartLayers.length > 0) {
        applyColoredAreas(map, DISTRICT_PARTS_PREFIX, districtPartLayers, {
          beneathLayerId: `${BOUNDARY_PREFIX}-fill`,
        })
      }
    }

    drawBoundaries()
    watchThemeChanges(map, drawBoundaries)
  })

  bindCardHover(addSpotMarkers(map, spots, openSpotPopup))
}
