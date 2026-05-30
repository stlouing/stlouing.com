// Site-wide constants.
export const REPO = 'stlouing/stlouing.com'
export const DEFAULT_BRANCH = 'main'

export const SITE_TITLE = 'St. Louing'
export const SITE_DESCRIPTION = "A transplant's guide to St. Louis"

// GitHub "edit this file" deep link for a repo-relative source path.
export function editUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '')

  return `https://github.com/${REPO}/edit/${DEFAULT_BRANCH}/${clean}`
}
