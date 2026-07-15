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

// Where a food place sits in the pipeline (mirrors the `status` field on the
// food collection). Independent of whether it has a writeup yet.
export type FoodStatus = 'written' | 'tried' | 'want-to-try' | 'suggested'

// The "My Review" line shown above the readers' poll. A rated place shows its
// verdict statement (colored); an unrated place shows where it sits instead.
export interface WriterState {
  // The full-sentence statement ("Loved it", "Haven't visited yet", …).
  statement: string
  // The colored verdict when one exists; absent for the unrated states, which
  // render in a muted, verdict-less treatment.
  verdict?: Verdict
  // 'pending' = visited, not written up yet; 'unvisited' = not visited yet.
  // Absent for a rated place. Lets the UI pick a muted icon per state.
  kind?: 'pending' | 'unvisited'
}

// Resolve the writer's stance for the "My Review" slot. A rating/verdict wins;
// otherwise the status decides the placeholder line (tried → "Haven't reviewed
// yet"; want-to-try / suggested → "Haven't visited yet").
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
    return { statement: "Haven't reviewed yet", kind: 'pending' }
  }

  return { statement: "Haven't visited yet", kind: 'unvisited' }
}

// Whether a place is "explored by me" — full-color on the map. Written + tried
// count as explored; want-to-try + suggested are grayed until I've been.
export function isExplored(status: FoodStatus = 'written'): boolean {
  return status === 'written' || status === 'tried'
}
