/**
 * Generic, framework-free list filter (progressive enhancement).
 *
 * Markup contract, all within a `[data-filter-root]` container:
 *   - `[data-filter-item]`   one per result; carries `data-<facet>` values
 *                            (pipe-separated for multi-value) and `data-search`
 *                            (lowercased-on-read free-text haystack).
 *   - `[data-filter-facet="<facet>"]`  a <select> whose value must be contained
 *                            in the item's matching `data-<facet>` attribute.
 *   - `[data-filter-search]` a text/search input matched against `data-search`.
 *   - `[data-filter-count]`  optional element showing the visible count.
 *   - `[data-filter-empty]`  optional "no matches" element (toggled).
 *
 * With JS off, every item is visible and the page is fully usable.
 */
export function initFilter(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  if (!root) return

  const form = root.querySelector<HTMLFormElement>('form')
  const search = root.querySelector<HTMLInputElement>('[data-filter-search]')
  const facets = [...root.querySelectorAll<HTMLSelectElement>('[data-filter-facet]')]
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const count = root.querySelector<HTMLElement>('[data-filter-count]')
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]')
  const sort = root.querySelector<HTMLSelectElement>('[data-filter-sort]')
  const clear = root.querySelector<HTMLElement>('[data-filter-clear]')
  const tray = root.querySelector<HTMLElement>('[data-filter-active]')
  const chips = root.querySelector<HTMLElement>('[data-filter-chips]')
  const list = items[0]?.parentElement ?? null

  // Build the active-filter chip tray: one removable chip per applied facet.
  function renderChips(): void {
    if (!chips) {
      return
    }
    chips.textContent = ''
    for (const facet of facets) {
      if (!facet.value) {
        continue
      }
      const facetKey = facet.dataset.filterFacet ?? ''
      const facetLabel = facet.dataset.filterLabel ?? facetKey
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'filter-chip'
      chip.dataset.removeFacet = facetKey
      chip.setAttribute('aria-label', `Remove ${facetLabel} filter`)

      const labelSpan = document.createElement('span')
      labelSpan.className = 'chip-label'
      labelSpan.textContent = `${facetLabel}:`
      const valueSpan = document.createElement('span')
      valueSpan.className = 'chip-value'
      valueSpan.textContent = facet.value
      const removeMark = document.createElement('span')
      removeMark.className = 'chip-x'
      removeMark.setAttribute('aria-hidden', 'true')
      removeMark.textContent = '×'

      chip.append(labelSpan, valueSpan, removeMark)
      chips.appendChild(chip)
    }
  }

  // Reorder the rows by the selected `field:direction` (e.g. "rating:desc"). The
  // sort key reads `data-sort-<field>`; missing values always sort last, numeric
  // values compare as numbers, everything else compares as text.
  function applySort(): void {
    if (!sort || !list) return
    const [field, direction] = (sort.value || '').split(':')
    if (!field) return

    const key = `sort${field.charAt(0).toUpperCase()}${field.slice(1)}`
    const factor = direction === 'desc' ? -1 : 1

    const ordered = [...items].sort((left, right) => {
      const leftValue = left.dataset[key] ?? ''
      const rightValue = right.dataset[key] ?? ''
      if (leftValue === '' && rightValue === '') return 0
      if (leftValue === '') return 1
      if (rightValue === '') return -1

      const leftNumber = Number(leftValue)
      const rightNumber = Number(rightValue)
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
        return (leftNumber - rightNumber) * factor
      }

      return leftValue.localeCompare(rightValue) * factor
    })

    for (const item of ordered) {
      list.appendChild(item)
    }
  }

  function apply(): void {
    const q = (search?.value ?? '').trim().toLowerCase()
    let visible = 0

    for (const item of items) {
      let show = true

      for (const facet of facets) {
        const value = facet.value
        if (!value) continue
        const key = facet.dataset.filterFacet ?? ''
        const itemValues = (item.dataset[key] ?? '').split('|')
        if (!itemValues.includes(value)) {
          show = false
          break
        }
      }

      if (show && q) {
        show = (item.dataset.search ?? '').toLowerCase().includes(q)
      }

      item.hidden = !show
      if (show) visible += 1
    }

    if (count) count.textContent = String(visible)
    if (empty) empty.hidden = visible > 0

    // Active-filter UI: highlight the applied dropdowns, rebuild the chip tray,
    // and reveal the tray + clear control only while something is filtering.
    for (const facet of facets) {
      facet.classList.toggle('is-active', Boolean(facet.value))
    }
    renderChips()
    const isFiltering = Boolean(q) || facets.some((facet) => facet.value)
    if (tray) {
      tray.hidden = !isFiltering
    }
    if (clear) {
      clear.hidden = !isFiltering
    }

    if (root) {
      root.dispatchEvent(new CustomEvent('filter:changed'))
    }
  }

  // Reflect the current filters/sort in the querystring so a filtered view is
  // shareable and bookmarkable, and restore them on load.
  function readUrl(): void {
    const params = new URLSearchParams(location.search)
    if (search) {
      search.value = params.get('q') ?? ''
    }
    // Derive facet state only from the URL — reset to "All" when a facet isn't in
    // the querystring, so a browser-restored <select> value on reload can't leave
    // the list silently filtered (and the "clear" control wrongly shown).
    for (const facet of facets) {
      facet.value = params.get(facet.dataset.filterFacet ?? '') ?? ''
    }
    if (sort) {
      const value = params.get('sort')
      if (value !== null) {
        sort.value = value
      }
    }
  }

  function writeUrl(): void {
    const params = new URLSearchParams()
    const query = (search?.value ?? '').trim()
    if (query) {
      params.set('q', query)
    }
    for (const facet of facets) {
      if (facet.value) {
        params.set(facet.dataset.filterFacet ?? '', facet.value)
      }
    }
    // Omit the sort param while it's the default (first option).
    if (sort && sort.value && sort.value !== sort.options[0]?.value) {
      params.set('sort', sort.value)
    }
    const queryString = params.toString()
    const url = queryString ? `${location.pathname}?${queryString}` : location.pathname
    history.replaceState(null, '', url)
  }

  function applyAndSync(): void {
    apply()
    writeUrl()
  }

  form?.addEventListener('submit', (event) => event.preventDefault())
  search?.addEventListener('input', applyAndSync)
  facets.forEach((facet) => facet.addEventListener('change', applyAndSync))
  sort?.addEventListener('change', () => {
    applySort()
    root.dispatchEvent(new CustomEvent('filter:changed'))
    writeUrl()
  })

  // In-list controls that set a facet value when clicked (e.g. a cuisine pill or
  // the neighborhood label on the food list). Reuses the normal apply + URL sync.
  const setters = [...root.querySelectorAll<HTMLElement>('[data-filter-set]')]
  for (const setter of setters) {
    setter.addEventListener('click', () => {
      const facetKey = setter.dataset.filterSet ?? ''
      const value = setter.dataset.filterValue ?? ''
      const select = facets.find((facet) => facet.dataset.filterFacet === facetKey)
      if (!select) {
        return
      }
      select.value = value
      applyAndSync()
    })
  }

  // Remove a single filter via its chip's ✕.
  chips?.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-remove-facet]')
    if (!chip) {
      return
    }
    const select = facets.find((facet) => facet.dataset.filterFacet === chip.dataset.removeFacet)
    if (!select) {
      return
    }
    select.value = ''
    applyAndSync()
  })

  // Reset search, every facet, and the sort to their defaults, then re-render.
  clear?.addEventListener('click', () => {
    if (search) {
      search.value = ''
    }
    for (const facet of facets) {
      facet.value = ''
    }
    if (sort) {
      sort.value = sort.options[0]?.value ?? ''
    }
    applySort()
    applyAndSync()
  })

  readUrl()
  applySort()
  apply()
}
