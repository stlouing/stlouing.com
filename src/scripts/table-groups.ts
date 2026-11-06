import { letterOf } from './list-groups'

const OTHER_LOCATION = 'Other'

function groupKeyReader(sortValue: string): ((row: HTMLElement) => string) | undefined {
  const [field] = sortValue.split(':')
  if (field === 'name') {
    return letterOf
  }
  if (field === 'neighborhood') {
    return (row) => row.dataset.groupName || OTHER_LOCATION
  }
  if (field === 'rating') {
    return (row) => row.dataset.groupRating ?? ''
  }

  return undefined
}

function buildHeaderRow(
  label: string,
  columns: number,
  visual: Node | undefined,
): HTMLTableRowElement {
  const row = document.createElement('tr')
  row.className = 'group-row'
  row.dataset.groupRow = ''
  row.setAttribute('role', 'row')

  const cell = document.createElement('th')
  cell.scope = 'colgroup'
  cell.setAttribute('role', 'rowheader')
  cell.colSpan = columns
  cell.append(visual ?? label)
  row.append(cell)

  return row
}

function trackStickyOffsets(root: HTMLElement): void {
  const nav = root.querySelector<HTMLElement>('[data-page-nav]')
  const head = root.querySelector<HTMLElement>('thead')
  if (!nav || !head) {
    return
  }

  const observer = new ResizeObserver(() => {
    root.style.setProperty('--page-nav-height', `${nav.getBoundingClientRect().height}px`)
    root.style.setProperty('--table-head-height', `${head.getBoundingClientRect().height}px`)
  })
  observer.observe(nav)
  observer.observe(head)
}

export function initTableGroups(rootSelector: string): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  const body = root?.querySelector<HTMLElement>('tbody')
  const sort = root?.querySelector<HTMLSelectElement>('[data-filter-sort]')
  if (!root || !body || !sort) {
    return
  }

  const columns = root.querySelectorAll('thead th').length
  const ratingLabels = root.querySelector<HTMLTemplateElement>('template[data-rating-labels]')
  const groupVisual = (key: string): Node | undefined =>
    ratingLabels?.content.querySelector(`[data-rating-label="${key}"]`)?.cloneNode(true)

  const rebuild = (): void => {
    body.querySelectorAll('[data-group-row]').forEach((row) => row.remove())

    const keyOf = groupKeyReader(sort.value)
    if (!keyOf) {
      return
    }

    const rows = [...body.querySelectorAll<HTMLElement>('[data-filter-item]')].filter(
      (row) => !row.hidden,
    )
    let previousKey: string | undefined
    for (const row of rows) {
      const key = keyOf(row)
      if (key !== previousKey) {
        row.before(buildHeaderRow(key, columns, groupVisual(key)))
        previousKey = key
      }
    }
  }

  root.addEventListener('filter:changed', rebuild)
  rebuild()
  trackStickyOffsets(root)
}
