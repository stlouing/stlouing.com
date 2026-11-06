export const SHEET_QUERY = '(max-width: 700px)'

const SWIPE_CLOSE_DISTANCE = 80
const SWIPE_CLOSE_VELOCITY = 0.5
const SETTLE_FALLBACK_MS = 400

function buildHandle(): HTMLElement {
  const handle = document.createElement('span')
  handle.className = 'map-sheet-handle'
  handle.setAttribute('aria-hidden', 'true')

  return handle
}

export function bindSwipeToClose(root: HTMLElement, body: HTMLElement, close: () => void): void {
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

  root.prepend(buildHandle())

  root.addEventListener(
    'touchstart',
    (event) => {
      if (
        event.touches.length !== 1 ||
        getComputedStyle(root).position !== 'fixed' ||
        root.classList.contains('is-settling')
      ) {
        startY = null

        return
      }
      const target = event.target as Element
      const inScrolledBody = body.contains(target) && body.scrollTop > 0
      if (inScrolledBody || target.closest('textarea')) {
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
