export type Verdict = 'loved' | 'liked' | 'neutral' | 'not-for-me'

export function verdictFromRating(rating: number): Verdict {
  if (rating >= 9) {
    return 'loved'
  }

  if (rating >= 7) {
    return 'liked'
  }

  return 'neutral'
}

export function resolveVerdict(data: { verdict?: Verdict; rating?: number }): Verdict | undefined {
  if (data.verdict) {
    return data.verdict
  }

  if (typeof data.rating === 'number') {
    return verdictFromRating(data.rating)
  }

  return undefined
}

export const verdictLabels: Record<Verdict, string> = {
  loved: 'Loved',
  liked: 'Liked',
  neutral: 'Neutral',
  'not-for-me': 'Not for me',
}

export const verdictStatements: Record<Verdict, string> = {
  loved: 'Loved it',
  liked: 'Liked it',
  neutral: 'It was fine',
  'not-for-me': 'Not for me',
}

export const verdictSortValue: Record<Verdict, number> = {
  loved: 9,
  liked: 7,
  neutral: 5,
  'not-for-me': 2,
}

export type FoodStatus = 'written' | 'tried' | 'want-to-try' | 'suggested'

export interface WriterState {
  statement: string
  verdict?: Verdict
  kind?: 'pending' | 'unvisited'
}

export function resolveWriterState(data: {
  verdict?: Verdict
  rating?: number
  status?: FoodStatus
}): WriterState {
  const verdict = resolveVerdict(data)
  if (verdict) {
    return { statement: verdictStatements[verdict], verdict }
  }

  if (data.status === 'tried') {
    return { statement: 'Not yet rated', kind: 'pending' }
  }

  return { statement: 'Unexplored', kind: 'unvisited' }
}

export function isExplored(status: FoodStatus = 'written'): boolean {
  return status === 'written' || status === 'tried'
}
