import { initFilter } from './filter'
import { initMap } from './map'
import type { MapApi } from './map'

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
      mapApi?.deselect()

      for (const item of items) {
        item.classList.remove('is-active')
      }
    }
  }

  const desktop = window.matchMedia(DESKTOP_QUERY)

  setView(desktop.matches ? 'map' : 'list')

  floatingToggle?.addEventListener('click', () => {
    setView(root.dataset.view === 'map' ? 'list' : 'map')
  })

  desktop.addEventListener('change', (event) => {
    if (event.matches && root.dataset.view !== 'map') {
      setView('map')
    }
  })
}
