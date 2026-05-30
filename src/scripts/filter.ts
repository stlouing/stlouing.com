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
    root.dispatchEvent(new CustomEvent('filter:changed'))
  }

  form?.addEventListener('submit', (event) => event.preventDefault())
  search?.addEventListener('input', apply)
  facets.forEach((facet) => facet.addEventListener('change', apply))
  apply()
}
