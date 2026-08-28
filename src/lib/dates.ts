// Shared date formatting. Always UTC: date-only frontmatter (e.g. 2026-05-31)
// parses as UTC midnight, so formatting in any other zone shifts it a day.
// One format site-wide — "June 1, 2026" — so dates never mismatch.
export const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
