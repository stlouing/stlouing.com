const statusLabels: Record<string, string> = {
  tried: 'Tried',
  'want-to-try': 'Want to try',
}

export function letterOf(row: HTMLElement): string {
  const first = (row.dataset.sortName ?? '').charAt(0).toUpperCase()

  return /[A-Z]/.test(first) ? first : '#'
}

function isRatingKey(key: string): boolean {
  return /^[0-9]/.test(key)
}

export function initListGroups(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  const list = root?.querySelector<HTMLElement>('[data-grouped-rows]')
  if (!root || !list) {
    return
  }

  const sortSelect = root.querySelector<HTMLSelectElement>('[data-filter-sort]')

  const buildHeader = (mode: 'rating' | 'alpha', key: string, count: number): HTMLLIElement => {
    const header = document.createElement('li')
    header.className = 'group-header'
    header.dataset.groupHeader = ''

    if (mode === 'alpha') {
      header.classList.add('group-header-alpha')
    } else if (!isRatingKey(key)) {
      header.classList.add('group-header-status')
    }

    const label = document.createElement('span')
    label.className = 'group-label'
    label.textContent = mode === 'rating' ? (statusLabels[key] ?? key) : key

    const countEl = document.createElement('span')
    countEl.className = 'count'
    countEl.textContent = String(count)

    const rule = document.createElement('span')
    rule.className = 'group-rule'

    const fleur =
      mode === 'rating' && isRatingKey(key)
        ? document.querySelector(`[data-fleur="${key}"] .rating`)?.cloneNode(true)
        : null

    header.append(label, ...(fleur ? [fleur] : []), rule, countEl)

    return header
  }

  function rebuild(): void {
    list?.querySelectorAll('[data-group-header]').forEach((header) => header.remove())

    const mode = (sortSelect?.value ?? '').startsWith('name') ? 'alpha' : 'rating'
    list.dataset.groupMode = mode
    const rows = [...list.querySelectorAll<HTMLElement>('[data-filter-item]')].filter(
      (row) => !row.hidden,
    )

    const groups: { key: string; rows: HTMLElement[] }[] = []
    for (const row of rows) {
      const key = mode === 'alpha' ? letterOf(row) : (row.dataset.group ?? '')
      const last = groups[groups.length - 1]
      if (!last || last.key !== key) {
        groups.push({ key, rows: [row] })
      } else {
        last.rows.push(row)
      }
    }

    for (const group of groups) {
      group.rows[0].before(buildHeader(mode, group.key, group.rows.length))
    }
  }

  root.addEventListener('filter:changed', rebuild)
  rebuild()
}
