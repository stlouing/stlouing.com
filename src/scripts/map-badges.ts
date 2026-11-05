import { badgeIconNode, buildPopupHtml, type PopupChip } from './popup'
import { metersBetween, type LngLat } from '../lib/geo'
import type { MapSpot } from '../lib/spots'

const STACKED_BADGE_RADIUS = 22
const STACKED_BADGE_DISTANCE_METERS = 45

export function stackBadges<Item extends { coords: LngLat }>(
  spots: Item[],
): Map<Item, [number, number]> {
  const stacks: Item[][] = []
  for (const spot of spots) {
    const stack = stacks.find(
      (candidate) =>
        metersBetween(candidate[0].coords, spot.coords) <= STACKED_BADGE_DISTANCE_METERS,
    )
    if (stack) {
      stack.push(spot)
    } else {
      stacks.push([spot])
    }
  }

  const offsets = new Map<Item, [number, number]>()
  for (const stack of stacks) {
    stack.forEach((spot, index) => {
      if (stack.length <= 1) {
        offsets.set(spot, [0, 0])

        return
      }
      const angle = (Math.PI * 2 * index) / stack.length
      offsets.set(spot, [
        Math.cos(angle) * STACKED_BADGE_RADIUS,
        Math.sin(angle) * STACKED_BADGE_RADIUS,
      ])
    })
  }

  return offsets
}

function badgeBody(category: string, iconName?: string): HTMLSpanElement {
  const body = document.createElement('span')
  body.className = 'map-badge-body'
  const icon = badgeIconNode(category, iconName)
  if (icon) {
    body.append(icon)
  }

  return body
}

export function createBadge(
  spot: MapSpot,
  onClick: (spot: MapSpot, badge: HTMLElement) => void,
): HTMLElement {
  const element = spot.url ? document.createElement('a') : document.createElement('button')
  element.className = 'map-badge'
  element.dataset.category = spot.category
  element.dataset.spotId = spot.id
  element.setAttribute('aria-label', spot.title)
  if (element instanceof HTMLAnchorElement && spot.url) {
    element.href = spot.url
  }
  if (element instanceof HTMLButtonElement) {
    element.type = 'button'
  }
  element.append(badgeBody(spot.category, spot.icon))

  element.addEventListener('click', (clickEvent) => {
    clickEvent.preventDefault()
    clickEvent.stopPropagation()
    onClick(spot, element)
  })

  return element
}

export function createClusterBadge(
  category: string,
  count: number,
  onClick: () => void,
): HTMLElement {
  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'map-badge map-badge--cluster'
  badge.dataset.category = category
  badge.setAttribute('aria-label', `${count} places, zoom in`)
  const body = badgeBody(category)
  const label = document.createElement('span')
  label.className = 'map-badge-count'
  label.textContent = String(count)
  body.append(label)
  badge.append(body)
  badge.addEventListener('click', (clickEvent) => {
    clickEvent.stopPropagation()
    onClick()
  })

  return badge
}

function spotChips(spot: MapSpot): PopupChip[] {
  if (spot.filters && spot.filters.length > 0) {
    return spot.filters.map((filter) => ({
      label: filter.label,
      filterSet: filter.facet,
      filterValue: filter.value,
    }))
  }

  return spot.meta ? [{ label: spot.meta }] : []
}

export function spotPopupHtml(spot: MapSpot): string {
  return buildPopupHtml({
    title: spot.title,
    link: spot.url,
    chips: spotChips(spot),
    rating: spot.rating,
    showRating: spot.category === 'food',
    excerpt: spot.tagline ?? '',
    addressLines: spot.addressLines ?? [],
    directionsHref: spot.directionsHref,
    websiteHref: spot.websiteHref,
    photo: spot.photo ?? '',
    category: spot.category,
    icon: spot.icon,
    voteSlug: spot.voteSlug,
    viewMore: spot.written ?? true,
  })
}
