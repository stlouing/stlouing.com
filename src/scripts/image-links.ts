export function initImageLinks(): void {
  const images = document.querySelectorAll<HTMLImageElement>('.body img:not(.emblem)')

  for (const image of images) {
    const fullSizeSource = image.getAttribute('src')
    if (!fullSizeSource || image.closest('a')) {
      continue
    }

    const link = document.createElement('a')
    link.className = 'image-link'
    link.href = fullSizeSource
    image.replaceWith(link)
    link.append(image)
  }
}
