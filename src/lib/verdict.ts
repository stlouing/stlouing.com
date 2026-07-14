export type Verdict = 'loved' | 'liked' | 'neutral' | 'not-for-me'

// Map an existing 0–10 rating to a verdict: 9–10 loved, 7–8 liked, the rest neutral.
// Nothing maps to 'not-for-me' automatically — that one is only ever set by hand,
// which keeps the auto-derived floor gentle.
export function verdictFromRating(rating: number): Verdict {
  if (rating >= 9) {
    return 'loved'
  }

  if (rating >= 7) {
    return 'liked'
  }

  return 'neutral'
}

// The verdict to show for a place: an explicit `verdict` wins; otherwise it's
// derived from the numeric rating; otherwise there isn't one.
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

// Full-sentence phrasing of the writer's stance (vs. the plain chip nouns above). Shared
// by the food page's verdict card and the top-of-page "My review" teaser so they match.
export const verdictStatements: Record<Verdict, string> = {
  loved: 'Loved it',
  liked: 'Liked it',
  neutral: 'It was fine',
  'not-for-me': 'Not for me',
}

// A representative 0–10 value so verdict-only places (no numeric rating) still
// sort sensibly next to rated ones.
export const verdictSortValue: Record<Verdict, number> = {
  loved: 9,
  liked: 7,
  neutral: 5,
  'not-for-me': 2,
}
