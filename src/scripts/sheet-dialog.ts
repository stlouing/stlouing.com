import { bindScrollCue } from './sheet-scroll-cue'
import { bindSwipeToClose } from './sheet-swipe'

interface SheetDialogOptions {
  dialog: HTMLDialogElement
  opener?: HTMLElement
  onOpen?: () => void
  onClose?: () => void
}

export function openSheet(dialog: HTMLDialogElement): void {
  dialog.show()
  const body = dialog.querySelector('.map-sheet-body')
  if (body) {
    body.scrollTop = 0
  }
}

export function bindSheetDialog({ dialog, opener, onOpen, onClose }: SheetDialogOptions): void {
  opener?.addEventListener('click', () => {
    if (dialog.open) {
      dialog.close()

      return
    }

    openSheet(dialog)
    onOpen?.()
  })

  dialog.querySelector('[data-sheet-close]')?.addEventListener('click', () => dialog.close())

  const body = dialog.querySelector<HTMLElement>('.map-sheet-body')
  if (body) {
    bindSwipeToClose(dialog, body, () => dialog.close())
    bindScrollCue(dialog, body)
  }

  if (onClose) {
    dialog.addEventListener('close', onClose)
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) {
      dialog.close()
    }
  })

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node
    if (dialog.open && !dialog.contains(target) && !opener?.contains(target)) {
      dialog.close()
    }
  })
}
