export function published<
  T extends { id: string; body?: string; data: { title?: string; draft?: boolean | undefined } },
>(entries: T[]): T[] {
  if (import.meta.env.DEV) return entries

  return entries.filter((entry) => !entry.data.draft)
}

// True when an entry has real body content (HTML comments ignored).
export function hasBody(entry: { body?: string }): boolean {
  const text = (entry.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()

  return text.length > 0
}

// A plain-text excerpt of a Markdown body: strips code, wikilinks, markdown
// syntax, and HTML, then truncates on a word boundary. Used as the fallback for
// feed/list descriptions when an entry has no authored `description`.
export function excerpt(body: string | undefined, max = 160): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/<!--[\s\S]*?-->/g, ' ') // HTML comments
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_match, target, label) => label ?? target)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown links/images -> text
    .replace(/^[>#\s]*/gm, '') // leading blockquote/heading markers
    .replace(/^[-*+]\s+/gm, '') // leading list markers
    .replace(/[*_`~]/g, '') // inline emphasis/code
    .replace(/<[^>]+>/g, ' ') // stray HTML tags
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= max) {
    return text
  }

  const truncated = text.slice(0, max)
  const lastSpace = truncated.lastIndexOf(' ')

  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`
}
