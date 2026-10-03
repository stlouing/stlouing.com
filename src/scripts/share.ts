const COPIED_MS = 1500

export function initShare(): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-share]')]
  for (const button of buttons) {
    button.addEventListener('click', () => share(button))
  }
}

function pageUrl(): string {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  return canonical?.href ?? window.location.href
}

async function share(button: HTMLButtonElement): Promise<void> {
  const url = pageUrl()
  const title = button.dataset.shareTitle || document.title

  if (navigator.share) {
    try {
      await navigator.share({ title, url })
    } catch {}

    return
  }

  try {
    await navigator.clipboard.writeText(url)
    flashCopied(button)
  } catch {}
}

function flashCopied(button: HTMLButtonElement): void {
  const label = button.querySelector<HTMLElement>('.share-label')
  const original = label?.textContent ?? ''
  button.classList.add('is-copied')
  if (label) {
    label.textContent = 'Copied'
  }
  window.setTimeout(() => {
    button.classList.remove('is-copied')
    if (label) {
      label.textContent = original
    }
  }, COPIED_MS)
}
