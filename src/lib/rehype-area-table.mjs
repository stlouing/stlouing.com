import { element, neighborhoodLinker, separated, text } from './hast-nodes.mjs'
import { officialNamesBySlug } from './official-names.mjs'

const AREA_TABLE = /\bdata-area-table\b/

const HEADINGS = ['Name', 'Type', 'Neighborhoods']

function isPlaceholder(node) {
  if (node.type === 'raw') {
    return AREA_TABLE.test(node.value)
  }

  return node.type === 'element' && node.properties?.dataAreaTable !== undefined
}

function byName(left, right) {
  return left.name.localeCompare(right.name)
}

export function rehypeAreaTable(options = {}) {
  const rows = options.neighborhoods ?? []
  const streets = options.streets ?? []
  const parts = options.parts ?? []
  const nameBySlug = new Map(rows.map((row) => [row.slug, row.name]))
  const slugByName = new Map(rows.filter((row) => !row.ignored).map((row) => [row.name, row.slug]))
  const officialNames = officialNamesBySlug(rows)
  const placeLink = neighborhoodLinker(options)

  const areaRow = (row, type, parts) =>
    element('tr', {}, [
      element('td', {}, [placeLink(row.slug, row.name)]),
      element('td', {}, [text(type)]),
      element('td', {}, separated(parts)),
    ])

  const districtRow = (row) => {
    const slugs = streets
      .filter((street) => row.streets?.includes(street.id))
      .flatMap((street) => street.neighborhoods)
    const parts = [...new Set(slugs)]
      .map((slug) => ({ slug, name: nameBySlug.get(slug) ?? slug }))
      .sort(byName)

    return areaRow(
      row,
      'District',
      parts.map((part) => placeLink(part.slug, part.name)),
    )
  }

  const partOf = (name) => {
    const slug = slugByName.get(name)

    return element('span', {}, [text('part of '), slug ? placeLink(slug, name) : text(name)])
  }

  const groupedRow = (row) => {
    const names = [...officialNames.get(row.slug)].sort((left, right) => left.localeCompare(right))
    const partialNames = parts
      .filter((part) => part.NHD_NUM === row.number && part.NHD_NAME !== row.name)
      .map((part) => part.NHD_NAME)

    return areaRow(row, 'Grouped', [...names.map(text), ...partialNames.map(partOf)])
  }

  const areaTable = () =>
    element('table', {}, [
      element('thead', {}, [
        element(
          'tr',
          {},
          HEADINGS.map((heading) => element('th', {}, [text(heading)])),
        ),
      ]),
      element('tbody', {}, [
        ...rows
          .filter((row) => row.type === 'district')
          .sort(byName)
          .map(districtRow),
        ...rows
          .filter((row) => (officialNames.get(row.slug)?.length ?? 0) > 1)
          .sort(byName)
          .map(groupedRow),
      ]),
    ])

  return (tree) => {
    tree.children = tree.children.map((node) => (isPlaceholder(node) ? areaTable() : node))
  }
}
