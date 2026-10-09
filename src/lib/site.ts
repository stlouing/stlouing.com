import { DEFAULT_BRANCH, REPO } from '../../site.config.mjs'

export * from '../../site.config.mjs'

export const NEWSLETTER_URL = import.meta.env.PUBLIC_NEWSLETTER_URL ?? ''

export const SUPABASE_ENABLED = Boolean(
  import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
)

export const FEEDBACK_ENDPOINT = import.meta.env.PUBLIC_FORMSPREE_URL ?? ''

export function editUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '')

  return `https://github.com/${REPO}/edit/${DEFAULT_BRANCH}/${clean}`
}
