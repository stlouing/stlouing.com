import { initFilter } from './filter'
import { initMap } from './map'
import type { MapApi } from './map'

/**
 * Wires a filterable list/map page: the shared filter plus a List/Map view
 * toggle. The map is created lazily the first time the Map view is shown (so
 * Leaflet measures a visible container) and re-synced on later switches.
 */
// Shared across the Food and Hikes pages so the chosen view follows the user.
// The same key + default are duplicated in the pre-paint inline script in
// FilterMapPage.astro (which can't import this module).
const VIEW_STORAGE_KEY = 'list-map-view'

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

  let mapApi: MapApi | null = null

  function setView(view: string): void {
    if (!root) {
      return
    }

    root.dataset.view = view
    localStorage.setItem(VIEW_STORAGE_KEY, view)

    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.viewSet === view))
    }

    if (view === 'map') {
      for (const item of items) {
        item.classList.remove('is-active')
      }

      if (mapApi) {
        mapApi.refresh()
      } else {
        mapApi = initMap() ?? null
      }
    } else {
      // Closing the popup de-selects via the map; also clear any leftover row
      // selection so the list isn't left with a stray highlight.
      mapApi?.deselect()

      for (const item of items) {
        item.classList.remove('is-active')
      }
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.dataset.viewSet ?? 'list'))
  }

  // The title is a link to the detail page. In list view we let it navigate; in
  // map view we intercept the click to open/close that place's popup instead
  // (map-view selection is otherwise driven by the popup events in map.ts).
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
  for (const item of items) {
    const title = item.querySelector<HTMLElement>('.list-title')
    if (!title) {
      continue
    }
    title.addEventListener('click', (event) => {
      if (root.dataset.view === 'map' && mapApi) {
        event.preventDefault()
        mapApi.togglePopup(item)
      }
    })
  }

  toggle.hidden = false // reveal only when JS is available

  // The pre-paint inline script already set data-view from storage (default map)
  // to avoid a flash; sync the toggle state and lazily init the map for it.
  const currentView = root.dataset.view === 'list' ? 'list' : 'map'
  setView(currentView)
}
