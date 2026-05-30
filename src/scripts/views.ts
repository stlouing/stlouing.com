import { initFilter } from './filter'
import { initMap } from './map'

/**
 * Wires a filterable list/map page: the shared filter plus a List/Map view
 * toggle. The map is created lazily the first time the Map view is shown (so
 * Leaflet measures a visible container) and re-synced on later switches.
 *
 * Markup (within `[data-filter-root]`): a `[data-view-toggle]` containing
 * `<button data-view-set="list|map">`, the list as `.spot-list`, and the map as
 * `[data-map]`. With JS off, the toggle stays hidden and the list is shown.
 */
export function initFilterableMapPage(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)

  if (!root) {
    return
  }

  initFilter(rootSelector)

  const toggle = root.querySelector<HTMLElement>('[data-view-toggle]')
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-view-set]')]
  if (!toggle || buttons.length === 0) {
    return
  }

  let refreshMap: (() => void) | null = null

  function setView(view: string): void {
    root.dataset.view = view

    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.viewSet === view))
    }

    if (view === 'map') {
      if (refreshMap) {
        refreshMap()
      } else {
        refreshMap = initMap() ?? null
      }
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.dataset.viewSet ?? 'list'))
  }

  toggle.hidden = false // reveal only when JS is available
}
