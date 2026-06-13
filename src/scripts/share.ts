// Share control: the native share sheet where it exists (mobile), with a
// copy-the-link fallback otherwise (desktop). Wires every [data-share] button —
// no third-party scripts, no tracking; the OS/clipboard does all the work.
const COPIED_MS = 1500

export function initShare(): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-share]')]
  for (const button of buttons) {
    button.addEventListener('click', () => share(button))
  }
}

// Prefer the canonical URL (clean, no query/hash) over the raw location.
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
    } catch {
      // The user dismissed the share sheet — nothing to do.
    }

    return
  }

  // Desktop fallback: copy the link and flash a "Copied" state.
  try {
    await navigator.clipboard.writeText(url)
    flashCopied(button)
  } catch {
    // Clipboard unavailable (insecure context / blocked) — nothing to do.
  }
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
