import { visit } from 'unist-util-visit'

const WIKILINK = /\[\[([^\]]+)\]\]/g

/**
 * remark plugin: turns `[[target]]` and `[[target|Label]]` into links.
 * `target` is a content entry id; resolution + base-prefixing is delegated to
 * the `resolve(target) => url | null` function passed in options. Unresolved
 * links render as <span class="wikilink-broken"> so they're visible but flagged.
 */
export function remarkWikiLink({ resolve }) {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || !node.value.includes('[[')) return

      const value = node.value
      const out = []
      let last = 0
      let match
      WIKILINK.lastIndex = 0

      while ((match = WIKILINK.exec(value)) !== null) {
        const [full, inner] = match
        if (match.index > last) {
          out.push({ type: 'text', value: value.slice(last, match.index) })
        }
        const [targetRaw, labelRaw] = inner.split('|')
        const target = targetRaw.trim()
        const label = (labelRaw ?? targetRaw).trim()
        const url = resolve(target)
        if (url) {
          out.push({
            type: 'link',
            url,
            // Tag for the hovercard script + carry the target id it looks up.
            data: { hProperties: { className: ['wikilink'], 'data-wikilink': target } },
            children: [{ type: 'text', value: label }],
          })
        } else {
          out.push({ type: 'html', value: `<span class="wikilink-broken">${label}</span>` })
        }
        last = match.index + full.length
      }

      if (last < value.length) {
        out.push({ type: 'text', value: value.slice(last) })
      }

      parent.children.splice(index, 1, ...out)
      return index + out.length
    })
  }
}
