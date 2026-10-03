export const REPO = 'stlouing/stlouing.com'
export const DEFAULT_BRANCH = 'main'

export const SITE_TITLE = 'St. Louing'
export const SITE_DESCRIPTION =
  'An independent guide to the food, neighborhoods, and culture of St. Louis.'

export const TAGLINE = `An independent guide to the food, neighborhoods, and culture of St. Louis`

export const NEWSLETTER_URL = import.meta.env.PUBLIC_NEWSLETTER_URL ?? ''

export const SUPABASE_ENABLED = Boolean(
  import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
)

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

export function editUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '')

  return `https://github.com/${REPO}/edit/${DEFAULT_BRANCH}/${clean}`
}
