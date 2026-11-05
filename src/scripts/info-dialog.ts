export function initInfoDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-info-dialog]')
  const opener = document.querySelector<HTMLButtonElement>('[data-info-open]')
  if (!dialog || !opener) {
    return
  }

  opener.addEventListener('click', () => {
    if (dialog.open) {
      dialog.close()
    } else {
      dialog.show()
    }
  })

  dialog.querySelector('[data-info-close]')?.addEventListener('click', () => {
    dialog.close()
  })

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) {
      dialog.close()
    }
  })

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node
    if (dialog.open && !dialog.contains(target) && !opener.contains(target)) {
      dialog.close()
    }
  })
}
