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

export interface WriterState {
  statement?: string
  rating?: number
  kind?: 'pending' | 'unvisited'
}

export function resolveWriterState(data: { rating?: number; status?: FoodStatus }): WriterState {
  if (typeof data.rating === 'number') {
    return { rating: data.rating }
  }

  if (data.status === 'tried') {
    return { statement: 'Not yet rated', kind: 'pending' }
  }

  return { statement: 'Unexplored', kind: 'unvisited' }
}

export function isExplored(status: FoodStatus = 'written'): boolean {
  return status === 'written' || status === 'tried'
}
