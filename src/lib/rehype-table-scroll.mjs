import { visit } from 'unist-util-visit'

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

      return index + 1
    })
  }
}
