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

  return undefined
}

function buildHeaderRow(label: string, count: number, columns: number): HTMLTableRowElement {
  const row = document.createElement('tr')
  row.className = 'group-row'
  row.dataset.groupRow = ''
  row.setAttribute('role', 'row')

  const cell = document.createElement('th')
  cell.scope = 'colgroup'
  cell.setAttribute('role', 'rowheader')
  cell.colSpan = columns
  cell.textContent = label

  const total = document.createElement('span')
  total.className = 'count'
  total.textContent = String(count)

  cell.append(total)
  row.append(cell)

  return row
}

export function initTableGroups(rootSelector: string): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  const body = root?.querySelector<HTMLElement>('tbody')
  const sort = root?.querySelector<HTMLSelectElement>('[data-filter-sort]')
  if (!root || !body || !sort) {
    return
  }

  const columns = root.querySelectorAll('thead th').length

  const rebuild = (): void => {
    body.querySelectorAll('[data-group-row]').forEach((row) => row.remove())

    const keyOf = groupKeyReader(sort.value)
    if (!keyOf) {
      return
    }

    const rows = [...body.querySelectorAll<HTMLElement>('[data-filter-item]')].filter(
      (row) => !row.hidden,
    )
    const groups: { key: string; rows: HTMLElement[] }[] = []
    for (const row of rows) {
      const key = keyOf(row)
      const last = groups[groups.length - 1]
      if (last?.key === key) {
        last.rows.push(row)
      } else {
        groups.push({ key, rows: [row] })
      }
    }

    for (const group of groups) {
      group.rows[0].before(buildHeaderRow(group.key, group.rows.length, columns))
    }
  }

  root.addEventListener('filter:changed', rebuild)
  rebuild()
}
