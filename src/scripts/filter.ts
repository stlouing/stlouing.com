import {
  activeLegendKeys,
  allLegendKeys,
  bindLegendToggles,
  setActiveLegendKeys,
} from './map-legend'

interface Facet {
  key: string
  isActive(): boolean
  matches(item: HTMLElement): boolean
  read(params: URLSearchParams): void
  write(params: URLSearchParams): void
  set(value: string): void
  clear(): void
  bind(onChange: () => void): void
}

function itemValues(item: HTMLElement, key: string): string[] {
  return (item.dataset[key] ?? '').split('|')
}

function legendFacet(legend: HTMLElement): Facet {
  const key = legend.dataset.filterToggles ?? ''
  const all = allLegendKeys(legend)
  const isActive = () => activeLegendKeys(legend).size !== all.length
  const filtersList = key !== ''

  return {
    key,
    isActive,
    matches: (item) => {
      if (!filtersList || !isActive()) {
        return true
      }
      const active = activeLegendKeys(legend)

      return itemValues(item, key).some((value) => active.has(value))
    },
    read: (params) => {
      if (!filtersList) {
        return
      }
      const raw = params.get(key)
      const known = (raw ?? '').split(',').filter((value) => all.includes(value))
      const failOpen = raw === null || (raw !== '' && known.length === 0)
      setActiveLegendKeys(legend, new Set(failOpen ? all : known))
    },
    write: (params) => {
      if (filtersList && isActive()) {
        params.set(key, [...activeLegendKeys(legend)].join(','))
      }
    },
    set: (value) => {
      if (all.includes(value)) {
        setActiveLegendKeys(legend, new Set([value]))
      }
    },
    clear: () => {
      setActiveLegendKeys(legend, new Set(all))
    },
    bind: (onChange) => {
      bindLegendToggles(legend, onChange)
    },
  }
}

function selectFacet(select: HTMLSelectElement): Facet {
  const key = select.dataset.filterFacet ?? ''
  const isActive = () => select.value !== ''
  const assign = (value: string) => {
    select.value = value
    if (select.selectedIndex < 0) {
      select.value = ''
    }
  }

  return {
    key,
    isActive,
    matches: (item) => !isActive() || itemValues(item, key).includes(select.value),
    read: (params) => {
      assign(params.get(key) ?? '')
    },
    write: (params) => {
      if (isActive()) {
        params.set(key, select.value)
      }
    },
    set: assign,
    clear: () => {
      select.value = ''
    },
    bind: (onChange) => {
      select.addEventListener('change', onChange)
    },
  }
}

export function initFilter(rootSelector = '[data-filter-root]'): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  if (!root) {
    return
  }

  const form = root.querySelector<HTMLFormElement>('form')
  const search = root.querySelector<HTMLInputElement>('[data-filter-search]')
  const facets = [
    ...[...root.querySelectorAll<HTMLElement>('[data-map-legend]')].map(legendFacet),
    ...[...root.querySelectorAll<HTMLSelectElement>('[data-filter-facet]')].map(selectFacet),
  ]
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const count = root.querySelector<HTMLElement>('[data-filter-count]')
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]')
  const sort = root.querySelector<HTMLSelectElement>('[data-filter-sort]')
  const clears = [...root.querySelectorAll<HTMLElement>('[data-filter-clear]')]
  const list = items[0]?.parentElement ?? null

  function applySort(): void {
    if (!sort || !list) {
      return
    }
    const [field, direction] = (sort.value || '').split(':')
    if (!field) {
      return
    }

    const key = `sort${field.charAt(0).toUpperCase()}${field.slice(1)}`
    const factor = direction === 'desc' ? -1 : 1

    const ordered = [...items].sort((left, right) => {
      const leftValue = left.dataset[key] ?? ''
      const rightValue = right.dataset[key] ?? ''
      if (leftValue === '' && rightValue === '') {
        return 0
      }
      if (leftValue === '') {
        return 1
      }
      if (rightValue === '') {
        return -1
      }

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
    const query = (search?.value ?? '').trim().toLowerCase()
    let visible = 0

    for (const item of items) {
      const show =
        facets.every((facet) => facet.matches(item)) &&
        (!query || (item.dataset.search ?? '').toLowerCase().includes(query))
      item.hidden = !show
      if (show) {
        visible += 1
      }
    }

    if (count) {
      count.textContent = String(visible)
    }
    if (empty) {
      empty.hidden = visible > 0
    }

    const isFiltering = Boolean(query) || facets.some((facet) => facet.isActive())
    for (const clear of clears) {
      clear.hidden = !isFiltering
    }

    root?.dispatchEvent(new CustomEvent('filter:changed'))
  }

  function readUrl(): void {
    const params = new URLSearchParams(location.search)
    if (search) {
      search.value = params.get('q') ?? ''
    }
    for (const facet of facets) {
      facet.read(params)
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
      facet.write(params)
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
    const queryString = buildParams().toString()
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
  for (const facet of facets) {
    facet.bind(applyAndSync)
  }
  sort?.addEventListener('change', () => {
    applySort()
    root.dispatchEvent(new CustomEvent('filter:changed'))
    writeUrl()
  })

  document.addEventListener('click', (event) => {
    const setter = (event.target as HTMLElement).closest<HTMLElement>('[data-filter-set]')
    if (!setter) {
      return
    }
    const facet = facets.find((candidate) => candidate.key === setter.dataset.filterSet)
    if (!facet) {
      return
    }
    facet.set(setter.dataset.filterValue ?? '')
    applyAndSync()
  })

  function clearAll(): void {
    if (search) {
      search.value = ''
    }
    for (const facet of facets) {
      facet.clear()
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
