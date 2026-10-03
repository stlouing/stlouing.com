const BASE = import.meta.env.BASE_URL

export function href(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return BASE.endsWith('/') ? BASE + clean : `${BASE}/${clean}`
}

export function rootRelative(path: string): string {
  return path.startsWith(BASE) ? `/${path.slice(BASE.length)}` : path
}

export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}
