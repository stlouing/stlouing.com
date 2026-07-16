/**
 * Base-path-safe internal link helper.
 *
 * Astro exposes the configured `base` as import.meta.env.BASE_URL (always ends
 * with a trailing slash). Routing every internal link through here means we can
 * flip between a GitHub Pages project path ("/stlouing.com/") and a custom-domain
 * root ("/") by changing one line of astro.config - no link edits needed.
 */
const BASE = import.meta.env.BASE_URL

export function href(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return BASE.endsWith('/') ? BASE + clean : `${BASE}/${clean}`
}

/**
 * Human-readable label for an external URL: strips the `https://`/`http://`
 * scheme, a leading `www.`, and any trailing slash (e.g.
 * "https://www.bluescitydeli.com/" becomes "bluescitydeli.com").
 */
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}
