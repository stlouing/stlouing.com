// Site-wide constants.
export const REPO = 'stlouing/stlouing.com'
export const DEFAULT_BRANCH = 'main'

export const SITE_TITLE = 'St. Louing'
export const SITE_DESCRIPTION =
  'An independent guide to the food, neighborhoods, and culture of St. Louis.'

// The visible tagline, shared by the homepage nameplate and the h-card note.
export const TAGLINE = `An independent guide to the food, neighborhoods, and culture of St. Louis`

export const NEWSLETTER_URL = import.meta.env.PUBLIC_NEWSLETTER_URL ?? ''

// Feedback form endpoint (Formspree). Comes from the PUBLIC_FORMSPREE_URL env var
// (a local .env in dev, the FORMSPREE_URL Actions variable in CI). The PUBLIC_
// prefix is required — Vite only exposes prefixed vars to import.meta.env, and the
// URL is public in the built page anyway. Empty when unset, where the /contact
// page renders without the form (email fallback only).
export const FEEDBACK_ENDPOINT = import.meta.env.PUBLIC_FORMSPREE_URL ?? ''

export interface Social {
  label: string
  url: string
}

export const SOCIALS: Social[] = [
  { label: 'GitHub', url: 'https://github.com/stlouing' },
  { label: 'Instagram', url: 'https://instagram.com/st.louing' },
  { label: 'YouTube', url: 'https://www.youtube.com/@stlouing' },
  { label: 'Bluesky', url: 'https://bsky.app/profile/stlouing.com' },
  { label: 'Substack', url: 'https://stlouing.substack.com' },
  { label: 'Twitter', url: 'https://x.com/stlouing' },
]

// GitHub "edit this file" deep link for a repo-relative source path.
export function editUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '')

  return `https://github.com/${REPO}/edit/${DEFAULT_BRANCH}/${clean}`
}
