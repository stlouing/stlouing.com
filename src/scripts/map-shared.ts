// Positioning helpers shared by the two map renderers (food markers +
// neighborhood boundaries). Both keep a just-opened popup clear of the sticky
// page chrome and the map's edges in the same way.
import type * as L from 'leaflet'

// Slow the wheel zoom on Windows. A Windows mouse wheel reports much larger,
// discrete deltas than a Mac trackpad, so the default `wheelPxPerZoomLevel` (60)
// makes each notch a big zoom step — fast, and a burst of steps re-renders the
// vector basemap canvas enough to crash Chrome's GPU process. A higher value means
// more scroll per zoom level, so each notch is a small step: smoother, slower, and
// fewer level-crossings (= fewer canvas re-renders) per gesture. We deliberately
// keep the *default* short debounce — a long debounce accumulates a fast spin into
// one big jump (the opposite of what we want). Windows-only so it doesn't dull the
// zoom elsewhere; raise the number if it's still too fast, lower it if too sluggish.
const isWindows = typeof navigator !== 'undefined' && /\bWindows NT\b/.test(navigator.userAgent)

export const zoomEaseOptions: L.MapOptions = isWindows ? { wheelPxPerZoomLevel: 220 } : {}

// Bottom edge (viewport px) of the page's sticky chrome above the map — the site
// header plus the secondary/filter toolbar. A popup opened near the top is nudged
// below this so its title isn't hidden behind them.
export function topChromeBottom(): number {
  return ['.site-header', '.secondary-header']
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .reduce(
      (bottom, node) => (node ? Math.max(bottom, node.getBoundingClientRect().bottom) : bottom),
      0,
    )
}

// Keep a just-opened popup fully on-screen: below the sticky chrome at the top,
// and clear of the map's left/right edges. We pan the map ourselves instead of
// relying on Leaflet's autoPan (which jerks the map around, especially on
// mobile). Run inside a rAF so the popup has been laid out + measured; `getPopupEl`
// returns the open popup's element, which differs per layer (marker vs feature).
export function keepPopupInView(map: L.Map, getPopupEl: () => HTMLElement | undefined): void {
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
      // Instant, not animated: an animated pan repaints the basemap canvas across
      // many frames on every popup open, which piles onto GPU-canvas memory and can
      // crash the tab on Windows Chrome.
      map.panBy([dx, dy], { animate: false })
    }
  })
}
