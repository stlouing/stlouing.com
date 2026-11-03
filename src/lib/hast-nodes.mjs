export function text(value) {
  return { type: 'text', value }
}

export function element(tagName, properties, children) {
  return { type: 'element', tagName, properties, children }
}

export function separated(nodes) {
  return nodes.flatMap((node, index) => (index === 0 ? [node] : [text(', '), node]))
}

export function neighborhoodLinker(options = {}) {
  const hasEntry = options.hasEntry ?? (() => false)
  const base = options.base ?? '/'

  return (slug, name) => {
    const href = `${base}neighborhoods/${slug}/`
    const properties = hasEntry(slug)
      ? { href, className: ['wikilink'], dataWikilink: slug }
      : { href }

    return element('a', properties, [text(name)])
  }
}
