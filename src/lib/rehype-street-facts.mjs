import { element, neighborhoodLinker, separated, text } from './hast-nodes.mjs'

const STREET_MAP = /\bdata-street-map="([^"]+)"/

function streetIdsIn(node) {
  if (node.type === 'raw') {
    return node.value.match(STREET_MAP)?.[1].split(/\s+/) ?? null
  }

  if (node.type !== 'element') {
    return null
  }

  if (typeof node.properties?.dataStreetMap === 'string') {
    return node.properties.dataStreetMap.split(/\s+/)
  }

  for (const child of node.children ?? []) {
    const ids = streetIdsIn(child)
    if (ids) {
      return ids
    }
  }

  return null
}

function routesOf(streets) {
  const routes = []
  for (const street of streets) {
    const joined = routes.find(
      (route) =>
        route.road === street.road && (route.to === street.from || route.from === street.to),
    )
    if (!joined) {
      routes.push({ road: street.road, from: street.from, to: street.to })
    } else if (joined.to === street.from) {
      joined.to = street.to
    } else {
      joined.from = street.from
    }
  }

  return routes
}

function factItem(label, children) {
  return element('li', {}, [text(`${label}: `), ...children])
}

function hostOf(url) {
  return new URL(url).hostname.replace(/^www\./, '')
}

export function rehypeStreetFacts(options = {}) {
  const streetById = new Map((options.streets ?? []).map((street) => [street.id, street]))
  const rows = options.neighborhoods ?? []
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]))
  const districts = rows.filter((row) => row.type === 'district')
  const placeLink = neighborhoodLinker(options)

  const factsFor = (ids) => {
    const streets = ids.flatMap((id) => (streetById.has(id) ? [streetById.get(id)] : []))
    const items = routesOf(streets.filter((street) => street.neighborhoods.length > 0)).map(
      (route) =>
        factItem('Street', [
          element('strong', {}, [text(route.road)]),
          text(`, from ${route.from} to ${route.to}`),
        ]),
    )

    const district = districts.find((row) => row.streets?.some((id) => ids.includes(id)))
    if (district) {
      items.push(factItem('District', [placeLink(district.slug, district.name)]))
    }

    const slugs = [...new Set(streets.flatMap((street) => street.neighborhoods))]
    if (slugs.length > 0) {
      items.push(
        factItem(
          slugs.length > 1 ? 'Neighborhoods' : 'Neighborhood',
          separated(
            slugs.map((slug) => {
              const row = rowBySlug.get(slug)

              return placeLink(slug, row?.name ?? slug)
            }),
          ),
        ),
      )
    }

    const websites = [...new Set(streets.flatMap((street) => street.websites ?? []))]
    if (websites.length > 0) {
      items.push(
        factItem(
          websites.length > 1 ? 'Websites' : 'Website',
          separated(websites.map((url) => element('a', { href: url }, [text(hostOf(url))]))),
        ),
      )
    }

    return items.length > 0 ? element('ul', {}, items) : null
  }

  return (tree) => {
    for (let index = tree.children.length - 1; index >= 0; index -= 1) {
      const ids = streetIdsIn(tree.children[index])
      const facts = ids ? factsFor(ids) : null
      if (facts) {
        tree.children.splice(index, 0, facts, text('\n'))
      }
    }
  }
}
