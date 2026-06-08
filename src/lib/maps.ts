// Build a Google Maps "search" link for a place from its name + address (or, as
// a fallback, its coordinates). Generated at render time so the link never has
// to be hardcoded in each entry's frontmatter.
export function googleMapsHref(place: {
  title: string
  address?: string[]
  coords?: [number, number]
}): string {
  let query = place.title
  if (place.address && place.address.length > 0) {
    query = [place.title, ...place.address].join(', ')
  } else if (place.coords) {
    query = place.coords.join(',')
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
