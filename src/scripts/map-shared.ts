// Positioning + framing helpers shared by the two map renderers (food markers +
// neighborhood boundaries). Both keep a just-opened popup clear of the sticky
// page chrome and the map's edges in the same way, and both frame their default
// view on the City of St. Louis.

// Structural map type so keepPopupInView stays decoupled from MapLibre's concrete
// Map type — it only needs getContainer() + panBy().
interface PannableMap {
  getContainer(): HTMLElement
  panBy(offset: [number, number], options?: { animate?: boolean }): void
}

// The City of St. Louis bounding box, [[west, south], [east, north]], taken from
// public/stl-neighborhoods.geojson (the 88 city neighborhoods + parks; the
// St. Louis County municipalities excluded). The east edge is the Mississippi.
export const CITY_BOUNDS: [[number, number], [number, number]] = [
  [-90.32049, 38.53298],
  [-90.17505, 38.77434],
]

// A LngLatBounds without depending on MapLibre's concrete class.
interface BoundsLike {
  getWest(): number
  getEast(): number
  getNorth(): number
  getSouth(): number
}

// The slice of the MapLibre Map the framing helpers need (structural, like
// PannableMap below, so this module stays decoupled from maplibre-gl).
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

// The zoom a fitBounds would need to show `bounds` in the map's container (the
// standard web-mercator fit; 512 px = MapLibre's world size at zoom 0). Used to
// predict when a fit would land below the map's minZoom: MapLibre clamps the
// zoom but keeps the bounds' center, which on a narrow (phone) pane strands the
// view over the middle of the bounds with the edges off-screen.
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

// Frame the default view on the City of St. Louis, biased so the city reads
// anchored to its river instead of floating in the middle of the frame.
// Instant (no fly-in) — this is initial framing, not a transition.
export function frameCityView(map: FramableMap, padding: number): void {
  map.fitBounds(CITY_BOUNDS, { padding, animate: false })

  const visibleBounds = map.getBounds()
  const visibleLatSpan = visibleBounds.getNorth() - visibleBounds.getSouth()
  const visibleLngSpan = visibleBounds.getEast() - visibleBounds.getWest()
  const center = map.getCenter()

  // Bias ~10% south: the far-north tip is a long, thin neighborhood we don't need
  // centered, so drop it off the top and pull more of South City in.
  const biasedLat = center.lat - visibleLatSpan * 0.1

  // Pull the view west so the Mississippi (the city's east edge) sits ~6% from
  // the right edge, rather than framing empty Illinois on a wide pane. Math.min
  // means we only ever shift WEST — a viewport that already fits the city
  // tightly (little horizontal slack) is left centered as-is.
  const riverEdge = CITY_BOUNDS[1][0]
  const westBiasedLng = riverEdge + visibleLngSpan * 0.06 - visibleLngSpan / 2
  const biasedLng = Math.min(center.lng, westBiasedLng)

  map.setCenter([biasedLng, biasedLat])
}

// Bottom edge (viewport px) of the page's sticky chrome above the map — the site
// header plus the secondary/filter toolbar. A popup opened near the top is nudged
// below this so its title isn't hidden behind them.
export function topChromeBottom(): number {
  return ['.masthead-nav', '.secondary-header']
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .reduce(
      (bottom, node) => (node ? Math.max(bottom, node.getBoundingClientRect().bottom) : bottom),
      0,
    )
}

// Keep a just-opened popup fully on-screen: below the sticky chrome at the top,
// and clear of the map's left/right edges. MapLibre popups don't auto-pan, so we
// nudge the map ourselves. Run inside a rAF so the popup has been laid out +
// measured; `getPopupEl` returns the open popup's element.
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
    // The panBy offset is (current edge − desired edge), nudging that edge into place.
    if (popupRect.top < topLimit) {
      dy = popupRect.top - topLimit
    }
    if (popupRect.left < mapRect.left + pad) {
      dx = popupRect.left - (mapRect.left + pad)
    } else if (popupRect.right > mapRect.right - pad) {
      dx = popupRect.right - (mapRect.right - pad)
    }
    if (dx !== 0 || dy !== 0) {
      // Instant, not animated: the nudge should just place the popup, not play a
      // visible pan every time one opens.
      map.panBy([dx, dy])
    }
  })
}
