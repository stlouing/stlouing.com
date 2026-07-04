import { initFilter } from './filter'
import { initMap } from './map'
import type { MapApi } from './map'

/**
 * Wires a filterable list/map page. Two view modes (set via `data-view-mode` on
 * the root):
 *
 * - "toggle" (Hikes): a top List/Map toggle, one pane at a time. The chosen view
 *   is remembered across pages.
 * - "floating" (Food): no top toggle. Desktop always shows both panes; mobile
 *   opens on the list and flips to the map via a floating bottom button. The map
 *   is built lazily the first time it's shown, so mobile never loads it just to
 *   swap back to the list.
 *
 */
const VIEW_STORAGE_KEY = 'list-map-view'
const DESKTOP_QUERY = '(min-width: 701px)'

export function initFilterableMapPage(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)

  if (!root) {
    return
  }

  initFilter(rootSelector)

  const isFloating = root.dataset.viewMode === 'floating'
  const toggle = root.querySelector<HTMLElement>('[data-view-toggle]')
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-view-set]')]
  const floatingToggle = root.querySelector<HTMLButtonElement>('[data-map-split-toggle]')

  // The title is a link to the detail page. Food (floating) always navigates
  // there. Toggle-mode pages (Hikes) intercept the click in map view to open/close
  // that place's popup instead (the map is the one-pane-at-a-time focus there).
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]

  let mapApi: MapApi | null = null

  function setView(view: string): void {
    if (!root) {
      return
    }

    root.dataset.view = view

    // Only the remembered-toggle mode persists; floating mode is always list-first
    // on mobile / both on desktop, so there's nothing to remember.
    if (!isFloating) {
      localStorage.setItem(VIEW_STORAGE_KEY, view)
    }

    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.viewSet === view))
    }

    // The floating button names the view it switches TO.
    if (floatingToggle) {
      floatingToggle.textContent = view === 'map' ? 'List' : 'Map'
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

  for (const item of items) {
    const title = item.querySelector<HTMLElement>('.list-title')
    if (!title) {
      continue
    }
    title.addEventListener('click', (event) => {
      if (!isFloating && root.dataset.view === 'map' && mapApi) {
        event.preventDefault()
        mapApi.togglePopup(item)
      }
    })
  }

  if (isFloating) {
    const desktop = window.matchMedia(DESKTOP_QUERY)

    // Desktop shows both panes (the 'map' state, which lazily builds the map);
    // mobile opens on the list and only builds the map when toggled.
    setView(desktop.matches ? 'map' : 'list')

    floatingToggle?.addEventListener('click', () => {
      setView(root.dataset.view === 'map' ? 'list' : 'map')
    })

    // Crossing into desktop must show both panes, even if the user left the list
    // showing on a narrow screen.
    desktop.addEventListener('change', (event) => {
      if (event.matches && root.dataset.view !== 'map') {
        setView('map')
      }
    })

    return
  }

  if (!toggle || buttons.length === 0) {
    return
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.dataset.viewSet ?? 'list'))
  }

  toggle.hidden = false // reveal only when JS is available

  // The pre-paint inline script already set data-view from storage (default map)
  // to avoid a flash; sync the toggle state and lazily init the map for it.
  const currentView = root.dataset.view === 'list' ? 'list' : 'map'
  setView(currentView)
}
