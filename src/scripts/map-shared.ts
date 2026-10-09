import { CITY_BOUNDS as CONFIGURED_CITY_BOUNDS } from '../../site.config.mjs'

interface PannableMap {
  getContainer(): HTMLElement
  panBy(offset: [number, number], options?: { animate?: boolean }): void
}

export const CITY_BOUNDS = CONFIGURED_CITY_BOUNDS as [[number, number], [number, number]]

interface BoundsLike {
  getWest(): number
  getEast(): number
  getNorth(): number
  getSouth(): number
}

interface FramableMap {
  getContainer(): HTMLElement
  getCenter(): { lng: number; lat: number }
  getBounds(): BoundsLike
  fitBounds(
    bounds: [[number, number], [number, number]],
    options: { padding: number; maxZoom?: number; animate: boolean },
  ): void
  setCenter(center: [number, number]): void
}

export function fitZoomFor(map: FramableMap, bounds: BoundsLike, padding: number): number {
  const mercatorY = (lat: number): number => {
    const sine = Math.sin((lat * Math.PI) / 180)

    return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)
  }
  const spanX = (bounds.getEast() - bounds.getWest()) / 360
  const spanY = mercatorY(bounds.getSouth()) - mercatorY(bounds.getNorth())
  const container = map.getContainer()
  const scaleX = (container.clientWidth - padding * 2) / 512 / spanX
  const scaleY = (container.clientHeight - padding * 2) / 512 / spanY

  return Math.log2(Math.min(scaleX, scaleY))
}

export function frameCityView(map: FramableMap, padding: number, anchorRiver = true): void {
  map.fitBounds(CITY_BOUNDS, { padding, animate: false })

  if (!anchorRiver) {
    return
  }

  const visibleBounds = map.getBounds()
  const visibleLatSpan = visibleBounds.getNorth() - visibleBounds.getSouth()
  const visibleLngSpan = visibleBounds.getEast() - visibleBounds.getWest()
  const center = map.getCenter()

  const biasedLat = center.lat - visibleLatSpan * 0.1

  const riverEdge = CITY_BOUNDS[1][0]
  const westBiasedLng = riverEdge + visibleLngSpan * 0.06 - visibleLngSpan / 2
  const biasedLng = Math.min(center.lng, westBiasedLng)

  map.setCenter([biasedLng, biasedLat])
}

export function topChromeBottom(): number {
  return ['.masthead-nav', '.secondary-header']
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .reduce(
      (bottom, node) => (node ? Math.max(bottom, node.getBoundingClientRect().bottom) : bottom),
      0,
    )
}

export function keepPopupInView(map: PannableMap, getPopupEl: () => HTMLElement | undefined): void {
  requestAnimationFrame(() => {
    const popupEl = getPopupEl()
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
      map.panBy([dx, dy])
    }
  })
}
