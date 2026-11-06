import { neighborhoodName } from './neighborhoods'
import { officialPartAt, type OfficialPart } from './official-parts'

interface LocatedPlace {
  neighborhood?: string
  district?: string
  coords?: [number, number]
}

function namedArea(slug: string | undefined): OfficialPart | undefined {
  return slug ? { slug, name: neighborhoodName(slug) } : undefined
}

export function placeLocation({ neighborhood, district, coords }: LocatedPlace) {
  const officialPart = neighborhood ? officialPartAt(neighborhood, coords) : undefined
  if (officialPart && officialPart.slug !== neighborhood) {
    return { area: officialPart, district: namedArea(neighborhood) }
  }

  return { area: namedArea(neighborhood), district: namedArea(district) }
}
