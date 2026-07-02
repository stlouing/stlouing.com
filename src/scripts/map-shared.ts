// Positioning helpers shared by the two map renderers (food markers +
// neighborhood boundaries). Both keep a just-opened popup clear of the sticky
// page chrome and the map's edges in the same way.

// Structural map type so keepPopupInView stays decoupled from MapLibre's concrete
// Map type — it only needs getContainer() + panBy().
interface PannableMap {
  getContainer(): HTMLElement
  panBy(offset: [number, number], options?: { animate?: boolean }): void
}

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
