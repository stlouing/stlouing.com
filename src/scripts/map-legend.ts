export interface LegendChange {
  key: string
  showing: boolean
}

const LEGEND_DOT_LIMIT = 4

function legendItems(legend: HTMLElement): HTMLButtonElement[] {
  return [...legend.querySelectorAll<HTMLButtonElement>('[data-legend-key]')]
}

function isPressed(item: HTMLElement): boolean {
  return item.getAttribute('aria-pressed') !== 'false'
}

function setLegendPressed(item: HTMLButtonElement, showing: boolean): void {
  item.setAttribute('aria-pressed', String(showing))
  const row = item.closest<HTMLElement>('.map-legend-row')
  if (row) {
    row.dataset.pressed = String(showing)
  }
}

export function activeLegendKeys(legend: HTMLElement): Set<string> {
  return new Set(
    legendItems(legend)
      .filter(isPressed)
      .map((item) => item.dataset.legendKey ?? ''),
  )
}

export function allLegendKeys(legend: HTMLElement): string[] {
  return legendItems(legend).map((item) => item.dataset.legendKey ?? '')
}

function updateLegendShown(legend: HTMLElement): void {
  const items = legendItems(legend)
  const active = activeLegendKeys(legend)
  for (const shown of legend.querySelectorAll<HTMLElement>('[data-legend-shown]')) {
    shown.textContent = `${active.size} of ${items.length} shown`
  }
  const dots = legend.querySelector<HTMLElement>('[data-legend-dots]')
  if (!dots) {
    return
  }
  dots.replaceChildren()
  for (const item of items.filter(isPressed).slice(0, LEGEND_DOT_LIMIT)) {
    const swatch = item.querySelector<HTMLElement>('.map-legend-swatch')
    const dot = document.createElement('span')
    dot.className = 'map-legend-dot'
    dot.style.setProperty('--badge-color', swatch?.style.getPropertyValue('--badge-color') ?? '')
    dots.append(dot)
  }
}

export function setActiveLegendKeys(legend: HTMLElement, keys: Set<string>): void {
  for (const item of legendItems(legend)) {
    setLegendPressed(item, keys.has(item.dataset.legendKey ?? ''))
  }
  updateLegendShown(legend)
}

export function bindLegendToggles(
  legend: HTMLElement,
  onChange: (changes: LegendChange[]) => void,
): void {
  const items = legendItems(legend)
  const itemFor = (key: string) => items.find((item) => item.dataset.legendKey === key)

  const toggle = (item: HTMLButtonElement) => {
    const showing = !isPressed(item)
    setLegendPressed(item, showing)
    updateLegendShown(legend)
    onChange([{ key: item.dataset.legendKey ?? '', showing }])
  }

  const only = (item: HTMLButtonElement) => {
    const active = activeLegendKeys(legend)
    const key = item.dataset.legendKey ?? ''
    const alreadyAlone = active.size === 1 && active.has(key)
    const changes: LegendChange[] = []
    for (const other of items) {
      const otherKey = other.dataset.legendKey ?? ''
      const showing = alreadyAlone || otherKey === key
      if (isPressed(other) !== showing) {
        setLegendPressed(other, showing)
        changes.push({ key: otherKey, showing })
      }
    }
    updateLegendShown(legend)
    if (changes.length > 0) {
      onChange(changes)
    }
  }

  for (const item of items) {
    const row = item.closest<HTMLElement>('.map-legend-row') ?? item
    row.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-legend-only]')) {
        return
      }
      toggle(item)
    })
  }
  for (const button of legend.querySelectorAll<HTMLButtonElement>('[data-legend-only]')) {
    button.addEventListener('click', () => {
      const item = itemFor(button.dataset.legendOnly ?? '')
      if (item) {
        only(item)
      }
    })
  }
}

const SCROLL_HINT_STEP = 0.8

function bindLegendScrollHint(legend: HTMLElement): void {
  const list = legend.querySelector<HTMLElement>('.map-legend-list')
  const hint = legend.querySelector<HTMLElement>('[data-legend-more]')
  if (!list || !hint) {
    return
  }
  const update = () => {
    hint.hidden = list.scrollHeight <= list.clientHeight
    const remaining = list.scrollHeight - list.clientHeight - list.scrollTop
    hint.toggleAttribute('data-at-end', remaining <= 1)
  }

  list.addEventListener('scroll', update, { passive: true })
  new ResizeObserver(() => requestAnimationFrame(update)).observe(list)
  hint.addEventListener('click', () => {
    list.scrollBy({ top: list.clientHeight * SCROLL_HINT_STEP, behavior: 'smooth' })
  })
}

const NARROW_SCREEN_QUERY = '(max-width: 700px)'

export function bindLegendCollapse(legend: HTMLElement, collapseQuery = NARROW_SCREEN_QUERY): void {
  const collapse = legend.querySelector<HTMLButtonElement>('[data-legend-collapse]')
  const body = legend.querySelector<HTMLElement>('[data-legend-body]')
  const narrowScreen = window.matchMedia(collapseQuery)
  const setExpanded = (expanded: boolean) => {
    collapse?.setAttribute('aria-expanded', String(expanded))
    if (body) {
      body.hidden = !expanded
    }
  }

  setExpanded(!narrowScreen.matches)
  legend.dataset.legendReady = ''
  legend.parentElement?.addEventListener(
    'click',
    (event) => {
      if (narrowScreen.matches && event.target instanceof Node && !legend.contains(event.target)) {
        setExpanded(false)
      }
    },
    { capture: true },
  )
  collapse?.addEventListener('click', () => {
    setExpanded(collapse.getAttribute('aria-expanded') !== 'true')
  })
  legend
    .querySelector<HTMLButtonElement>('[data-legend-close]')
    ?.addEventListener('click', () => setExpanded(false))
  bindLegendScrollHint(legend)
  updateLegendShown(legend)
}
