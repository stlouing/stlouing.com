const PLACEHOLDER = /^<div[^>]*\bdata-article-toc\b[^>]*>\s*(<\/div>)?\s*$/

function textOf(node) {
  if (node.type === 'text') {
    return node.value
  }

  if (!node.children) {
    return ''
  }

  return node.children.map(textOf).join('')
}

function anchorTo(heading) {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: `#${heading.properties.id}` },
    children: [{ type: 'text', value: textOf(heading).trim() }],
  }
}

function entryList(className, headings) {
  return {
    type: 'element',
    tagName: 'ol',
    properties: { className: [className] },
    children: headings.map((heading) => ({
      type: 'element',
      tagName: 'li',
      properties: {},
      children: [anchorTo(heading)],
    })),
  }
}

function navOf(children) {
  return {
    type: 'element',
    tagName: 'nav',
    properties: { className: ['article-toc'], ariaLabel: 'Contents' },
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: { className: ['article-toc-label'] },
        children: [{ type: 'text', value: 'Contents' }],
      },
      ...children,
    ],
  }
}

export function rehypeArticleToc(options = {}) {
  const groups = options.groups ?? {}

  return (tree) => {
    const children = tree.children
    const placeholderIndex = children.findIndex(
      (node) =>
        (node.type === 'raw' && PLACEHOLDER.test(node.value.trim())) ||
        (node.type === 'element' &&
          node.tagName === 'div' &&
          node.properties?.dataArticleToc !== undefined),
    )

    if (placeholderIndex === -1) {
      return
    }

    const sections = []
    for (const node of children.slice(placeholderIndex + 1)) {
      if (node.type !== 'element' || !node.properties?.id) {
        continue
      }

      if (node.tagName === 'h2') {
        sections.push({ heading: node, subheadings: [] })
      } else if (node.tagName === 'h3' && sections.length > 0) {
        sections[sections.length - 1].subheadings.push(node)
      }
    }

    if (sections.length === 0) {
      return
    }

    const grouped = new Map()
    for (const { heading } of sections) {
      const label = groups[heading.properties.id]
      if (!label) {
        continue
      }

      if (!grouped.has(label)) {
        grouped.set(label, [])
      }
      grouped.get(label).push(heading)
    }

    if (grouped.size > 0) {
      const orderedGroups = [...grouped.entries()].sort(
        (first, second) => second[1].length - first[1].length,
      )

      children[placeholderIndex] = navOf([
        {
          type: 'element',
          tagName: 'ol',
          properties: { className: ['article-toc-groups'] },
          children: orderedGroups.map(([label, headings]) => ({
            type: 'element',
            tagName: 'li',
            properties: { className: ['article-toc-group'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['article-toc-group-title'] },
                children: [{ type: 'text', value: label }],
              },
              entryList('article-toc-streets', headings),
            ],
          })),
        },
      ])

      return
    }

    children[placeholderIndex] = navOf([
      {
        type: 'element',
        tagName: 'ol',
        properties: {},
        children: sections.map(({ heading, subheadings }) => ({
          type: 'element',
          tagName: 'li',
          properties: { className: ['article-toc-section'] },
          children: [
            anchorTo(heading),
            ...(subheadings.length > 0 ? [entryList('article-toc-streets', subheadings)] : []),
          ],
        })),
      },
    ])
  }
}
