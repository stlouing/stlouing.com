export function published<T extends { data: { draft?: boolean } }>(entries: T[]): T[] {
  if (import.meta.env.DEV) return entries
  return entries.filter((entry) => !entry.data.draft)
}

// True when an entry has real body content (HTML comments ignored).
export function hasBody(entry: { body?: string }): boolean {
  const text = (entry.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()

  return text.length > 0
}
