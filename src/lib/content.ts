export function published<
  T extends { id: string; body?: string; data: { title?: string; draft?: boolean | undefined } },
>(entries: T[]): T[] {
  if (import.meta.env.DEV) return entries

  return entries.filter((entry) => !entry.data.draft)
}

export const PINNED_TOPIC_ID = 'field-notes'
export function sortTopics<Entry extends { id: string; data: { updated: Date } }>(
  entries: Entry[],
): Entry[] {
  return [...entries].sort((left, right) => {
    if (left.id === PINNED_TOPIC_ID) {
      return -1
    }
    if (right.id === PINNED_TOPIC_ID) {
      return 1
    }

    return right.data.updated.valueOf() - left.data.updated.valueOf()
  })
}

export function hasBody(entry: { body?: string }): boolean {
  const text = (entry.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()

  return text.length > 0
}

export const PREVIEW_EXCERPT_CHARS = 120
export const META_DESCRIPTION_CHARS = 150

export function excerpt(body: string | undefined, max = 160): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_match, target, label) => label ?? target)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[>#\s]*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= max) {
    return text
  }

  const truncated = text.slice(0, max)
  const lastSpace = truncated.lastIndexOf(' ')

  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`
}
