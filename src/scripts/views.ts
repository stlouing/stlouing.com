import { initFilter } from './filter'
import { initMap } from './map'
import type { MapApi } from './map'

/**
 * Wires the filterable list/map page (Food). Desktop always shows both panes;
 * mobile opens on the list and flips to the map via the floating bottom
 * button. The map is built lazily the first time it's shown, so mobile never
 * loads it just to swap back to the list.
 */
const DESKTOP_QUERY = '(min-width: 701px)'

export function initFilterableMapPage(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)

  if (!root) {
    return
  }

  initFilter(rootSelector)

  const floatingToggle = root.querySelector<HTMLButtonElement>('[data-map-split-toggle]')
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]

  let mapApi: MapApi | null = null

  function setView(view: string): void {
    if (!root) {
      return
    }

    root.dataset.view = view

    // The floating button names the view it switches TO.
    if (floatingToggle) {
      floatingToggle.textContent = view === 'map' ? 'View list' : 'View map'
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
}
