import { verdictLabels } from '../lib/verdict'

// The four verdicts carry a color dot; the status groups (un-rated places) read
// neutral. Labels for the group headers keyed by data-group.
const groupLabels: Record<string, string> = {
  ...verdictLabels,
  tried: 'Tried, not yet rated',
  'want-to-try': 'Want to try',
  suggested: 'Suggested by readers',
}

const verdictKeys = new Set<string>(['loved', 'liked', 'neutral', 'not-for-me'])

/**
 * Grouped Food list enhancement (progressive). The list is a single flat `<ul>`
 * of `[data-filter-item]` rows; the shared filter (filter.ts) sorts + hides them
 * and dispatches `filter:changed`. This (re)builds the group-header rows on top:
 * by verdict (Loved / Liked / Fine, colored) or, when the "Alphabetical" sort is
 * chosen, by first letter (A / B / C). Headers always reflect the *visible* rows,
 * so they track filtering too. With JS off, the rows show as a plain flat list.
 */
export function initFoodGroups(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  const list = root?.querySelector<HTMLElement>('[data-food-rows]')
  if (!root || !list) {
    return
  }

  const sortSelect = root.querySelector<HTMLSelectElement>('[data-filter-sort]')

  const letterOf = (row: HTMLElement): string => {
    const first = (row.dataset.sortName ?? '').charAt(0).toUpperCase()

    return /[A-Z]/.test(first) ? first : '#'
  }

  const buildHeader = (mode: 'verdict' | 'alpha', key: string, count: number): HTMLLIElement => {
    const header = document.createElement('li')
    header.className = 'group-header'
    header.dataset.groupHeader = ''

    // Verdict headers carry their color (via [data-verdict]) and a leading dot.
    // The other two kinds are tagged so each gets its own type: status-group
    // headers (un-rated places) read like the pane title; letter headers read big
    // + accent.
    if (mode === 'verdict' && verdictKeys.has(key)) {
      header.dataset.verdict = key
      // const dot = document.createElement('span')
      // dot.className = 'group-dot'
      // header.appendChild(dot)
    } else if (mode === 'verdict') {
      header.classList.add('group-header-status')
    } else {
      header.classList.add('group-header-alpha')
    }

    const label = document.createElement('span')
    label.className = 'group-label'
    label.textContent = mode === 'verdict' ? (groupLabels[key] ?? key) : key

    const countEl = document.createElement('span')
    countEl.className = 'group-count'
    countEl.textContent = String(count)

    // Both verdict + letter headers get a rule line that fills the row and pushes
    // the count to the end (verdict headers also keep their leading dot).
    const rule = document.createElement('span')
    rule.className = 'group-rule'

    // Verdict headers carry the matching fleur rating after the label — cloned from
    // the hidden per-verdict templates the page renders (the Astro Rating component
    // can't run in this client script).
    const fleur =
      mode === 'verdict' && verdictKeys.has(key)
        ? document.querySelector(`[data-fleur="${key}"] .rating`)?.cloneNode(true)
        : null

    header.append(label, ...(fleur ? [fleur] : []), rule, countEl)

    return header
  }

  function rebuild(): void {
    list?.querySelectorAll('[data-group-header]').forEach((header) => header.remove())

    const mode = (sortSelect?.value ?? '').startsWith('name') ? 'alpha' : 'verdict'
    const rows = [...list.querySelectorAll<HTMLElement>('[data-filter-item]')].filter(
      (row) => !row.hidden,
    )

    // Rows arrive already sorted (filter.ts), so a group boundary is just a change
    // in the current key from one row to the next.
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
