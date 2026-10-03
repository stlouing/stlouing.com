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
