export const RATING_MAX = 5

export type FleurFill = 'full' | 'half' | 'empty'

export function fleurFills(rating: number | undefined): FleurFill[] {
  const value = rating ?? 0

  return Array.from({ length: RATING_MAX }, (_unused, index) => {
    if (value >= index + 1) {
      return 'full'
    }
    if (value >= index + 0.5) {
      return 'half'
    }

    return 'empty'
  })
}

export function ratingLabel(rating: number | undefined): string {
  return rating === undefined ? 'Not yet rated' : `Rating: ${rating} out of ${RATING_MAX}`
}

export type FoodStatus = 'written' | 'tried' | 'want-to-try'

export function isExplored(status: FoodStatus = 'written'): boolean {
  return status === 'written' || status === 'tried'
}
