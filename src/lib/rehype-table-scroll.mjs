import { visit } from 'unist-util-visit'

/**
 * rehype plugin: wraps every markdown <table> in <div class="table-scroll">.
 * With the wrapper owning horizontal overflow, the table itself can lay out as
 * a real full-width table — stretching to the column when its content is
 * narrow, scrolling inside the wrapper when nowrap columns outgrow a phone.
 */
export function rehypeTableScroll() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === null || node.tagName !== 'table') {
        return
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'] },
        children: [node],
      }

      // Resume after the wrapper so the freshly wrapped table isn't revisited.
      return index + 1
    })
  }
}
