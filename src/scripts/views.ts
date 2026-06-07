import { initFilter } from './filter'
import { initMap } from './map'
import type { MapApi } from './map'

/**
 * Wires a filterable list/map page: the shared filter plus a List/Map view
 * toggle. The map is created lazily the first time the Map view is shown (so
 * Leaflet measures a visible container) and re-synced on later switches.
 *
 * Markup (within `[data-filter-root]`): a `[data-view-toggle]` containing
 * `<button data-view-set="list|map">`, the list as `.list-with-map`, and the map as
 * `[data-map]`. With JS off, the toggle stays hidden and the list is shown.
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
      if (mapApi) {
        mapApi.refresh()
      } else {
        mapApi = initMap() ?? null
      }
    } else {
      // Leaving the map for the list: drop any selection so a place doesn't stay
      // expanded/highlighted. Closing the popup de-selects via the map; also clear
      // rows that were expanded directly in list view.
      mapApi?.deselect()
      for (const item of items) {
        item.classList.remove('is-active')
        item.querySelector('.list-title')?.setAttribute('aria-expanded', 'false')
      }
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.dataset.viewSet ?? 'list'))
  }

  // Clicking a place's name expands its writeup inline (list view) or toggles its
  // map popup (map view). Centralized here so list-view expansion works even
  // before the map is lazily created; map-view selection is still driven by the
  // popup events in map.ts. Only expandable rows (their title is a <button>)
  // expand in list view; body-less rows still toggle their popup over the map.
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

        return
      }
      if (title.tagName === 'BUTTON') {
        event.preventDefault()
        const expanded = item.classList.toggle('is-active')
        title.setAttribute('aria-expanded', String(expanded))
      }
    })
  }

  toggle.hidden = false // reveal only when JS is available

  // The pre-paint inline script already set data-view from storage (default map)
  // to avoid a flash; sync the toggle state and lazily init the map for it.
  const currentView = root.dataset.view === 'list' ? 'list' : 'map'
  setView(currentView)
}
