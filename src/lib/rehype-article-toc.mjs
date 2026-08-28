// Matches the opt-in placeholder an article drops where its contents index
// should render, written as a single raw-HTML line: <div data-article-toc></div>
const PLACEHOLDER = /^<div[^>]*\bdata-article-toc\b[^>]*>\s*(<\/div>)?\s*$/

// Plain text of a heading's subtree (headings can carry inline links).
function textOf(node) {
  if (node.type === 'text') {
    return node.value
  }

  if (!node.children) {
    return ''
  }

  return node.children.map(textOf).join('')
}

// An anchor to a heading, labeled with the heading's own text.
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

/**
 * rehype plugin: replaces the data-article-toc placeholder with a contents
 * index of every h2/h3 that follows it. With a `groups` option ({headingId:
 * label}), matching h2s are grouped under those labels (in first-appearance
 * order) and unmatched h2s are left out; without groups (or when nothing
 * matches), h2s list as sections with their h3s nested. Must run after
 * rehype-slug (it links to the generated ids) and before
 * rehype-autolink-headings (so heading text is read without the appended "#").
 */
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

    // Collect the headings that follow the placeholder. Headings without an
    // id can't be linked.
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

    // Grouped mode: file each matching h2 under its label, keeping the labels
    // in first-appearance order.
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
      // Largest group first, so the tall section leads the first newspaper
      // column and the two columns stay balanced. Equal-sized groups keep
      // their article order (the sort is stable).
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

    // Flat fallback: h2s as sections, their h3s nested.
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
