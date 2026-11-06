const SCROLL_END_TOLERANCE = 8

export function bindScrollCue(root: HTMLElement, body: HTMLElement): void {
  const cue = document.createElement('span')
  cue.className = 'sheet-scroll-cue'
  cue.textContent = 'Scroll for more'
  cue.setAttribute('aria-hidden', 'true')
  root.append(cue)

  const update = (): void => {
    const remaining = body.scrollHeight - body.clientHeight - body.scrollTop
    cue.classList.toggle('is-visible', remaining > SCROLL_END_TOLERANCE)
  }

  body.addEventListener('scroll', update, { passive: true })
  body.addEventListener('load', update, true)
  new ResizeObserver(update).observe(body)
  new MutationObserver(update).observe(body, { childList: true })
}
