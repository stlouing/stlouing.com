import { bindSheetDialog, openSheet } from './sheet-dialog'
import { SHEET_QUERY } from './sheet-swipe'

async function fetchPlaceSheet(slug: string): Promise<Element | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}sheets/${slug}/`)
  if (!response.ok) {
    return null
  }
  const fragment = new DOMParser().parseFromString(await response.text(), 'text/html')

  return fragment.querySelector('.popup-scroll')
}

export function initPlaceSheet(rootSelector: string): void {
  const root = document.querySelector<HTMLElement>(rootSelector)
  const rows = root?.querySelector<HTMLElement>('tbody')
  const dialog = root?.querySelector<HTMLDialogElement>('[data-place-dialog]')
  const body = dialog?.querySelector<HTMLElement>('.map-sheet-body')
  if (!rows || !dialog || !body) {
    return
  }

  const sheetLayout = window.matchMedia(SHEET_QUERY)
  let activeRow: HTMLElement | null = null

  const setActiveRow = (row: HTMLElement | null): void => {
    activeRow?.classList.remove('is-active')
    row?.classList.add('is-active')
    activeRow = row
  }

  bindSheetDialog({ dialog, onClose: () => setActiveRow(null) })
  sheetLayout.addEventListener('change', () => dialog.close())

  rows.addEventListener('click', async (event) => {
    const target = event.target as Element
    const row = target.closest<HTMLElement>('tr[data-slug]')
    const link = row?.querySelector<HTMLAnchorElement>('.name-cell a')
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    if (!row || !link || modified || !sheetLayout.matches || target.closest('.score-cell')) {
      return
    }

    event.preventDefault()
    setActiveRow(row)
    const sheet = await fetchPlaceSheet(row.dataset.slug ?? '').catch(() => null)
    if (activeRow !== row) {
      return
    }
    if (!sheet) {
      window.location.href = link.href

      return
    }

    body.replaceChildren(sheet)
    openSheet(dialog)
  })
}
