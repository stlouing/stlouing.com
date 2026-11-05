const NARROW_QUERY = '(max-width: 700px)'

export function initFilterSentence(rootSelector: string): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  if (!root) {
    return
  }

  syncCountNoun(root)
  syncNarrowLabels(root)
}

function syncCountNoun(root: HTMLElement): void {
  const count = root.querySelector<HTMLElement>('[data-filter-count]')
  const noun = root.querySelector<HTMLElement>('[data-count-noun]')
  if (!count || !noun) {
    return
  }

  root.addEventListener('filter:changed', () => {
    noun.textContent = count.textContent === '1' ? 'spot' : 'spots'
  })
}

function syncNarrowLabels(root: HTMLElement): void {
  const narrow = window.matchMedia(NARROW_QUERY)
  const options = [...root.querySelectorAll<HTMLOptionElement>('option[data-narrow-label]')].map(
    (option) => ({ option, wideLabel: option.text }),
  )
  const searches = [
    ...root.querySelectorAll<HTMLInputElement>('input[data-narrow-placeholder]'),
  ].map((search) => ({ search, widePlaceholder: search.placeholder }))

  const apply = (): void => {
    for (const { option, wideLabel } of options) {
      option.text = narrow.matches ? (option.dataset.narrowLabel ?? wideLabel) : wideLabel
    }
    for (const { search, widePlaceholder } of searches) {
      search.placeholder = narrow.matches
        ? (search.dataset.narrowPlaceholder ?? widePlaceholder)
        : widePlaceholder
    }
  }

  narrow.addEventListener('change', apply)
  apply()
}
