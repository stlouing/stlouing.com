// Shared date formatting. Always UTC: date-only frontmatter (e.g. 2026-05-31)
// parses as UTC midnight, so formatting in any other zone shifts it a day.
const format = (date: Date, month: 'long' | 'short'): string =>
  date.toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric', timeZone: 'UTC' })

// "June 1, 2026" — used on detail pages.
export const formatDate = (date: Date): string => format(date, 'long')

// "Jun 1, 2026" — used in compact lists.
export const formatDateShort = (date: Date): string => format(date, 'short')
