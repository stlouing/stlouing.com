import maplibregl from 'maplibre-gl'
import { CITY_BOUNDS as CONFIGURED_CITY_BOUNDS } from '../../site.config.mjs'
import { initReadersVerdict } from './readers-verdict'

interface PannableMap {
  getContainer(): HTMLElement
  panBy(offset: [number, number], options?: { animate?: boolean }): void
}

const PIN_HEIGHT = 36
const PIN_HIGHLIGHT_SCALE = 1.3
const BADGE_SIZE = 30
const POPUP_GAP = 6

export const PIN_POPUP_OFFSET = Math.round(PIN_HEIGHT * PIN_HIGHLIGHT_SCALE + POPUP_GAP)
export const BADGE_POPUP_OFFSET = Math.round(BADGE_SIZE / 2 + POPUP_GAP)

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function buildCloseIcon(): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
  icon.setAttribute('class', 'icon')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'currentColor')
  icon.setAttribute('aria-hidden', 'true')
  const use = document.createElementNS(SVG_NAMESPACE, 'use')
  use.setAttribute('href', '#icon-x')
  icon.append(use)

  return icon
}

function replaceCloseGlyph(popup: maplibregl.Popup): void {
  const button = popup
    .getElement()
    ?.querySelector<HTMLButtonElement>('.maplibregl-popup-close-button')
  if (button) {
    button.replaceChildren(buildCloseIcon())
  }
}

export const SHEET_QUERY = '(max-width: 700px)'

export interface MountedMap {
  map: { remove(): void }
  disposeTheme: () => void
}

export function observeMapElements(
  elements: Iterable<HTMLElement>,
  mount: (element: HTMLElement) => MountedMap | undefined,
): void {
  const mounted = new Map<Element, MountedMap>()

  const mountObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !mounted.has(entry.target)) {
          const state = mount(entry.target as HTMLElement)
          if (state) {
            mounted.set(entry.target, state)
          }
        }
      }
    },
    { rootMargin: '600px 0px' },
  )

  const teardownObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const state = mounted.get(entry.target)
        if (!entry.isIntersecting && state) {
          state.disposeTheme()
          state.map.remove()
          mounted.delete(entry.target)
        }
      }
    },
    { rootMargin: '1800px 0px' },
  )

  for (const element of elements) {
    mountObserver.observe(element)
    teardownObserver.observe(element)
  }
}

export function readPayload<Payload>(selector: string, fallback: Payload): Payload {
  const holder = document.querySelector(selector)
  if (!holder?.textContent) {
    return fallback
  }

  try {
    return JSON.parse(holder.textContent) as Payload
  } catch {
    return fallback
  }
}

type PopupEvent = 'open' | 'close'

interface MapPopup {
  setLngLat(lngLat: [number, number]): MapPopup
  setHTML(html: string): MapPopup
  addTo(map: maplibregl.Map): MapPopup
  remove(): MapPopup
  isOpen(): boolean
  getElement(): HTMLElement | undefined
  getLngLat(): [number, number] | undefined
  on(event: PopupEvent, handler: () => void): MapPopup
}

interface Sheet {
  root: HTMLElement
  body: HTMLElement
  owner: MapPopup | null
}

let sheet: Sheet | null = null

function ensureSheet(): Sheet {
  if (sheet) {
    return sheet
  }
  const root = document.createElement('div')
  root.className = 'map-sheet'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Place details')
  root.hidden = true

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'close-button map-sheet-close'
  close.setAttribute('aria-label', 'Close')
  close.append(buildCloseIcon())
  close.addEventListener('click', () => sheet?.owner?.remove())

  const handle = document.createElement('span')
  handle.className = 'map-sheet-handle'
  handle.setAttribute('aria-hidden', 'true')

  const body = document.createElement('div')
  body.className = 'map-sheet-body'

  root.append(handle, close, body)
  document.body.append(root)
  bindSwipeToClose(root, body, () => sheet?.owner?.remove())

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      sheet?.owner?.remove()
    }
  })

  sheet = { root, body, owner: null }

  return sheet
}

const SWIPE_CLOSE_DISTANCE = 80
const SWIPE_CLOSE_VELOCITY = 0.5
const SETTLE_FALLBACK_MS = 400

function bindSwipeToClose(root: HTMLElement, body: HTMLElement, close: () => void): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let startY: number | null = null
  let startTime = 0
  let offset = 0
  let dragging = false

  const setOffset = (pixels: number): void => {
    offset = pixels
    root.style.setProperty('--sheet-offset', `${pixels}px`)
  }

  const reset = (): void => {
    root.classList.remove('is-dragging', 'is-settling')
    root.style.removeProperty('--sheet-offset')
    startY = null
    dragging = false
    offset = 0
  }

  const settle = (target: number, onDone: () => void): void => {
    root.classList.remove('is-dragging')
    if (reducedMotion.matches) {
      onDone()

      return
    }
    root.classList.add('is-settling')
    let finished = false
    const finish = (): void => {
      if (finished) {
        return
      }
      finished = true
      root.removeEventListener('transitionend', finish)
      onDone()
    }
    root.addEventListener('transitionend', finish)
    window.setTimeout(finish, SETTLE_FALLBACK_MS)
    requestAnimationFrame(() => setOffset(target))
  }

  root.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1 || root.classList.contains('is-settling')) {
        startY = null

        return
      }
      const inBody = event.target instanceof Node && body.contains(event.target)
      if (inBody && body.scrollTop > 0) {
        startY = null

        return
      }
      startY = event.touches[0].clientY
      startTime = event.timeStamp
      dragging = false
    },
    { passive: true },
  )

  root.addEventListener(
    'touchmove',
    (event) => {
      if (startY === null) {
        return
      }
      const distance = event.touches[0].clientY - startY
      if (!dragging && distance <= 0) {
        startY = null

        return
      }
      event.preventDefault()
      dragging = true
      root.classList.add('is-dragging')
      setOffset(Math.max(0, distance))
    },
    { passive: false },
  )

  const release = (event: TouchEvent): void => {
    if (startY === null) {
      return
    }
    if (!dragging) {
      startY = null

      return
    }
    const elapsed = Math.max(1, event.timeStamp - startTime)
    const shouldClose = offset > SWIPE_CLOSE_DISTANCE || offset / elapsed > SWIPE_CLOSE_VELOCITY
    startY = null
    if (shouldClose) {
      settle(root.offsetHeight, () => {
        close()
        reset()
      })
    } else {
      settle(0, reset)
    }
  }

  root.addEventListener('touchend', release)
  root.addEventListener('touchcancel', () => {
    if (dragging) {
      settle(0, reset)
    } else {
      startY = null
    }
  })
}

export function sheetHeight(): number {
  return sheet && !sheet.root.hidden ? sheet.root.getBoundingClientRect().height : 0
}

function usesSheet(): boolean {
  return window.matchMedia(SHEET_QUERY).matches
}

export function createMapPopup(offset: number): MapPopup {
  const popup = new maplibregl.Popup({
    className: 'map-popup',
    closeButton: true,
    closeOnClick: false,
    anchor: 'bottom',
    maxWidth: '320px',
    offset,
    focusAfterOpen: false,
  })
  const handlers: Record<PopupEvent, Array<() => void>> = { open: [], close: [] }
  const emit = (event: PopupEvent) => {
    if (event === 'open') {
      initReadersVerdict()
    }
    handlers[event].forEach((handler) => handler())
  }
  let html = ''
  let lngLat: [number, number] | undefined
  let inSheet = false

  popup.on('open', () => {
    replaceCloseGlyph(popup)
    emit('open')
  })
  popup.on('close', () => emit('close'))

  const facade: MapPopup = {
    setLngLat(next) {
      lngLat = next
      popup.setLngLat(next)

      return facade
    },
    setHTML(next) {
      html = next
      popup.setHTML(next)

      return facade
    },
    addTo(map) {
      if (!usesSheet()) {
        popup.addTo(map)

        return facade
      }
      const target = ensureSheet()
      if (target.owner && target.owner !== facade) {
        target.owner.remove()
      }
      target.owner = facade
      target.body.innerHTML = html
      target.root.hidden = false
      inSheet = true
      emit('open')

      return facade
    },
    remove() {
      if (inSheet) {
        inSheet = false
        if (sheet?.owner === facade) {
          sheet.owner = null
          sheet.root.hidden = true
          sheet.body.replaceChildren()
        }
        emit('close')
      } else {
        popup.remove()
      }

      return facade
    },
    isOpen() {
      return inSheet || popup.isOpen()
    },
    getElement() {
      return inSheet ? undefined : popup.getElement()
    },
    getLngLat() {
      return lngLat
    },
    on(event, handler) {
      handlers[event].push(handler)

      return facade
    },
  }

  return facade
}

export function revealAboveSheet(
  map: PannableMap & { project(lngLat: [number, number]): { y: number } },
  lngLat: [number, number],
): void {
  requestAnimationFrame(() => {
    const covered = sheetHeight()
    if (covered === 0) {
      return
    }
    const mapRect = map.getContainer().getBoundingClientRect()
    const visibleBottom = window.innerHeight - covered
    const pointY = mapRect.top + map.project(lngLat).y
    const limit = Math.min(mapRect.bottom, visibleBottom) - 24
    if (pointY > limit) {
      map.panBy([0, pointY - limit])
    }
  })
}

export function settlePopup(
  map: PannableMap & { project(lngLat: [number, number]): { y: number } },
  popup: MapPopup,
): void {
  const element = popup.getElement()
  const lngLat = popup.getLngLat()
  if (element) {
    keepPopupInView(map, () => element)
  } else if (lngLat) {
    revealAboveSheet(map, lngLat)
  }
}

export const CITY_BOUNDS = CONFIGURED_CITY_BOUNDS as [[number, number], [number, number]]

interface BoundsLike {
  getNorth(): number
  getSouth(): number
  getEast(): number
  getWest(): number
}

const CITY_VIEW_SOUTH_SHIFT = 0.15
const CITY_VIEW_WEST_SHIFT = 0.08

interface FramableMap {
  getContainer(): HTMLElement
  getCenter(): { lng: number; lat: number }
  getBounds(): BoundsLike
  fitBounds(
    bounds: [[number, number], [number, number]],
    options: { padding: number; maxZoom?: number; animate: boolean },
  ): void
  setCenter(center: [number, number]): void
  getZoom(): number
  setZoom(zoom: number): void
}

export function frameCityView(map: FramableMap, padding: number, zoomOffset = 0): void {
  map.fitBounds(CITY_BOUNDS, { padding, animate: false })
  if (zoomOffset !== 0) {
    map.setZoom(map.getZoom() + zoomOffset)
  }

  const visibleBounds = map.getBounds()
  const visibleLatSpan = visibleBounds.getNorth() - visibleBounds.getSouth()
  const visibleLngSpan = visibleBounds.getEast() - visibleBounds.getWest()
  const center = map.getCenter()

  map.setCenter([
    center.lng - visibleLngSpan * CITY_VIEW_WEST_SHIFT,
    center.lat - visibleLatSpan * CITY_VIEW_SOUTH_SHIFT,
  ])
}

export function topChromeBottom(): number {
  return document.querySelector<HTMLElement>('.masthead-nav')?.getBoundingClientRect().bottom ?? 0
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

export const DESKTOP_HOVER_QUERY = '(hover: hover) and (min-width: 701px)'

export function bindRowHover(
  items: Iterable<HTMLElement>,
  handlers: { enter: (item: HTMLElement) => void; leave: (item: HTMLElement) => void },
): void {
  if (!window.matchMedia(DESKTOP_HOVER_QUERY).matches) {
    return
  }
  for (const item of items) {
    item.addEventListener('mouseenter', () => handlers.enter(item))
    item.addEventListener('mouseleave', () => handlers.leave(item))
  }
}
