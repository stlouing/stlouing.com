const statusLabels: Record<string, string> = { tried: 'Tried', 'want-to-try': 'Want to try' }

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

  const buildHeader = (mode: 'rating' | 'alpha', key: string): HTMLLIElement => {
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

    const fleur =
      mode === 'rating' && isRatingKey(key)
        ? document.querySelector(`[data-fleur="${key}"] .rating`)?.cloneNode(true)
        : null

    header.append(label, ...(fleur ? [fleur] : []))

    return header
  }

  function rebuild(): void {
    list?.querySelectorAll('[data-group-header]').forEach((header) => header.remove())

    const mode = (sortSelect?.value ?? '').startsWith('name') ? 'alpha' : 'rating'
    list.dataset.groupMode = mode
    const rows = [...list.querySelectorAll<HTMLElement>('[data-filter-item]')].filter(
      (row) => !row.hidden,
    )

    let previousKey: string | undefined
    for (const row of rows) {
      const key = mode === 'alpha' ? letterOf(row) : (row.dataset.group ?? '')
      if (key !== previousKey) {
        row.before(buildHeader(mode, key))
        previousKey = key
      }
    }
  }

  root.addEventListener('filter:changed', rebuild)
  rebuild()
}
