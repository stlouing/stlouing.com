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
  const clears = [...root.querySelectorAll<HTMLElement>('[data-filter-clear]')]
  const tray = root.querySelector<HTMLElement>('[data-filter-active]')
  const chips = root.querySelector<HTMLElement>('[data-filter-chips]')
  const list = items[0]?.parentElement ?? null

  const iconX =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'

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
      chip.className = 'chip chip-filter chip-blue'
      chip.dataset.removeFacet = facetKey
      chip.setAttribute('aria-label', `Remove ${facetLabel} filter`)

      const labelSpan = document.createElement('span')
      labelSpan.className = 'chip-label'
      labelSpan.textContent = `${facetLabel}:`
      const valueSpan = document.createElement('span')
      valueSpan.className = 'chip-value'
      valueSpan.textContent = facet.selectedOptions[0]?.text ?? facet.value
      const removeMark = document.createElement('span')
      removeMark.className = 'chip-x'
      removeMark.setAttribute('aria-hidden', 'true')
      removeMark.innerHTML = iconX

      chip.append(labelSpan, valueSpan, removeMark)
      chips.appendChild(chip)
    }
  }

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

    for (const facet of facets) {
      facet.classList.toggle('is-active', Boolean(facet.value))
    }
    renderChips()
    const isFiltering = Boolean(q) || facets.some((facet) => facet.value)
    if (tray) {
      tray.hidden = !isFiltering
    }
    for (const clear of clears) {
      clear.hidden = !isFiltering
    }

    if (root) {
      root.dispatchEvent(new CustomEvent('filter:changed'))
    }
  }

  function readUrl(): void {
    const params = new URLSearchParams(location.search)
    if (search) {
      search.value = params.get('q') ?? ''
    }
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

  function buildParams(): URLSearchParams {
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
    if (sort && sort.value && sort.value !== sort.options[0]?.value) {
      params.set('sort', sort.value)
    }

    return params
  }

  function syncRobots(hasFilters: boolean): void {
    const id = 'robots-filtered'
    const existing = document.getElementById(id)
    if (hasFilters && !existing) {
      const meta = document.createElement('meta')
      meta.id = id
      meta.name = 'robots'
      meta.content = 'noindex, follow'
      document.head.appendChild(meta)
    } else if (!hasFilters && existing) {
      existing.remove()
    }
  }

  function writeUrl(): void {
    const params = buildParams()
    const queryString = params.toString()
    syncRobots(queryString.length > 0)
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

  root.addEventListener('click', (event) => {
    const setter = (event.target as HTMLElement).closest<HTMLElement>('[data-filter-set]')
    if (!setter) {
      return
    }
    const facetKey = setter.dataset.filterSet ?? ''
    const value = setter.dataset.filterValue ?? ''
    const select = facets.find((facet) => facet.dataset.filterFacet === facetKey)
    if (!select) {
      return
    }
    select.value = value
    applyAndSync()
  })

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

  function clearAll(): void {
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
  }
  for (const clear of clears) {
    clear.addEventListener('click', clearAll)
  }

  readUrl()
  applySort()
  apply()
  syncRobots(buildParams().toString().length > 0)
}
