const files = import.meta.glob<string>('/src/content/{food,neighborhoods,topics}/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const titles = new Map(
  Object.entries(files).flatMap(([file, source]) => {
    const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? ''
    const title = source.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)?.[1]

    return title ? [[slug, title] as const] : []
  }),
)

export function wikiTitle(slug: string): string {
  return titles.get(slug) ?? slug
}
