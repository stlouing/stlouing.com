// Shared builder for the two map popups (food markers + neighborhood boundaries).

// Escape text before it goes into a popup's innerHTML.
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface PopupChip {
  // Visible label; escaped before insertion.
  label: string
  // When set, the chip is an interactive filter <button> (data-filter-set/value);
  // otherwise it's a static <span> (e.g. the neighborhood popup's area chip).
  filterSet?: string
  filterValue?: string
}

export interface PopupSource {
  label: string
  href: string
}

export interface PopupConfig {
  // Title text + the shared target for the title link and "View more".
  title: string
  link: string
  // A photo banner atop the popup (an entry with a picture): rendered as a
  // centered cover background, full width, fixed height (--popup-photo-height).
  photo?: string
  // Food only: the place's rating, shown as four fleur-de-lis leading the chip
  // row, matching the list rows. `key` is the verdict (not-for-me/neutral/liked/
  // loved) that sets how many of the four glyphs are filled; `label` is its word,
  // carried into the rating's aria-label.
  verdict?: { key: string; label: string }
  // Food only: render the rating row even without a verdict — all four fleurs
  // faded, aria-label "Not yet rated" — matching Rating.astro in the list rows.
  // Neighborhood popups leave it unset and show no rating.
  showRating?: boolean
  // Chip row under the title (cuisine + neighborhood pin, or a single area chip).
  chips?: PopupChip[]
  // Food only: address lines, rendered under the title.
  addressLines?: string[]
  // A one-line tagline (the entry's description). Accepted for compatibility
  // but not rendered.
  tagline?: string
  // A short writeup teaser, clamped to a few lines by the popup CSS.
  excerpt?: string
  // Outlined buttons to external sources (Website, Instagram, Wikipedia, …).
  sources?: PopupSource[]
  // Show the ruled "View more" link (defaults on; Food hides it without a teaser).
  showMore?: boolean
}

// The cuisine / neighborhood / region meta, styled like the list rows'
// `.list-headline .list-meta` — plain uppercase mono text, no emoji, no pill. A
// filterable value stays an interactive <button> (data-filter-set/value).
function chipHtml(chip: PopupChip): string {
  const inner = escapeHtml(chip.label)
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="list-meta" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="list-meta">${inner}</span>`
}

// Inline 14×14 source icons (Lucide), matching the labeled links on the detail
// pages. currentColor so each follows its button's text color. class="icon" lets
// `.btn .icon` recolor it on hover.
function sourceIcon(inner: string): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">${inner}</svg>`
}

const SOURCE_ICON: Record<string, string> = {
  Wikipedia: sourceIcon(
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  ),
  MyTownView: sourceIcon(
    '<path d="M12 16v5"/><path d="M16 14.639V21"/><path d="M20 10.656V21"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18.463V21"/><path d="M8 14.656V21"/>',
  ),
  Website: sourceIcon(
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ),
  'St. Louis City': sourceIcon(
    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  ),
  'Google Maps': sourceIcon(
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  ),
  Instagram: sourceIcon(
    '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  ),
}

// The St. Louis fleur-de-lis emblem (single-color glyph, no disc), matching
// FleurGlyph.astro. currentColor fills it, so the popup rating CSS colors the
// filled glyphs gold and fades the rest. `className` sets `is-filled` per glyph.
function fleurGlyph(className: string): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="182 148 176 192" fill="currentColor" aria-hidden="true"><path d="m265.771 335.804c-3.19254-1.711-8.09537-6.65389-9.61564-9.7337-1.8243-3.65014-1.71029-4.71476 1.10219-8.8972 4.1047-6.12159 6.30907-11.3306 7.29725-17.2621l0.49408-2.96574 9.57763-0.22813 0.45608 2.77563c0.57009 3.46003 2.24238 8.63105 3.83866 11.7869 1.29221 2.58551 5.09286 8.51699 5.66296 8.85919 0.79814 0.49429 0.34206 3.19387-0.98817 5.89345-1.67228 3.34596-5.70097 7.52841-9.27358 9.61963-3.23055 1.86309-5.2829 1.90111-8.55146 0.15209z"/><path d="m239.47 315.158c-3.23055-2.85167-3.23055-3.53607 0.076-7.07214 3.07853-3.30794 5.16889-6.50181 6.08104-9.23941l0.72212-2.09123h8.2094v1.82507c0 3.46003-2.66045 9.80975-5.70097 13.7641-4.56078 5.89345-5.58695 6.19762-9.3876 2.81364z"/><path d="m293.287 315.31c-2.77447-3.23189-4.44676-5.74136-5.81499-8.7071-1.44425-3.0798-2.50843-6.844-2.50843-8.66907v-1.1787h4.18071c3.64863 0 4.21872 0.076 4.40875 0.68441 1.25422 3.68816 2.96451 6.42576 6.87917 10.9504 2.8505 3.26991 2.81248 4.22047-0.30404 6.92005-1.90033 1.63496-2.54644 1.97716-3.72464 1.97716-1.21621 0-1.63428-0.26616-3.11653-1.97716z"/><path d="m230.615 285.729v-5.70333l39.2607 0.076 39.2227 0.11407v11.0264l-39.2227 0.11407-39.2607 0.076z"/><path d="m199.487 276.755c-3.64862-0.98857-6.84117-2.81364-9.50162-5.4752-2.88849-2.8897-4.59878-5.62729-6.04303-9.58162-0.87414-2.47144-0.98817-3.34595-1.02617-7.90863 0-5.85542 0.41807-7.64247 2.81248-11.2926 3.76264-5.77938 10.6038-10.6082 17.673-12.5474 3.26855-0.8745 12.5041-0.76044 17.1409 0.22814 16.3808 3.422 26.4525 15.285 32.1155 37.7181 0.64611 2.47145 1.1402 5.01894 1.1402 5.6273v1.17869h-8.62747l-1.78631-2.28134c-2.58444-3.26991-7.44927-8.06072-10.2618-10.0759-5.01686-3.57409-10.6038-5.4752-14.2524-4.82882-7.79134 1.40682-12.6182 7.83259-11.44 15.1709 0.22803 1.21672 0.38006 2.77563 0.38006 3.46002v1.21672l-3.11653-0.038c-1.7483 0-4.06669-0.26616-5.20689-0.57034z"/><path d="m332.282 273.219c0.30404-4.79081-0.22805-7.41434-2.16638-10.19-2.85048-4.22047-8.74148-6.42576-13.7583-5.28509-6.61313 1.55891-14.5565 7.45236-20.3715 15.1709l-1.33023 1.74903-4.25672 0.038h-4.29473v-1.55891c0-2.85167 2.69846-12.2812 5.24489-18.2127 6.91718-16.2735 17.559-24.3343 33.7498-25.4749 9.34959-0.64637 14.9746 0.79847 21.6637 5.51324 7.25924 5.17102 10.8318 12.1671 10.2618 20.0758-0.49408 6.61587-3.07853 12.2432-7.56329 16.4636-4.18071 3.95432-8.89351 5.85543-14.6705 5.85543h-2.77447z"/><path d="m264.365 269.493c-1.59627-12.7375-5.66296-24.7525-12.2381-36.2352-5.2449-9.12534-7.37326-14.1063-8.58947-20.1518-1.10218-5.39916-0.95016-14.9808 0.34206-19.3914 1.7863-6.08356 5.92901-13.4219 10.8318-19.0872 4.7128-5.47521 12.8082-11.7109 15.2026-11.7109 2.88849 0 12.9222 8.47897 17.9391 15.2089 3.00251 3.99234 6.68914 11.2166 7.98135 15.7792 1.33023 4.67675 1.67229 11.8249 0.76013 17.2241-1.10219 6.57785-2.92649 11.2166-7.75332 19.9237-4.18071 7.52841-6.00502 11.2166-7.86734 16.0834-2.81248 7.22423-5.13087 16.8058-5.70097 23.2316-0.41807 4.79081 0.11402 4.33454-5.43492 4.33454h-4.82682z"/></svg>`
}

// Filled fleur-de-lis count per verdict, out of four — matches Rating.astro.
const RATING_FILLED: Record<string, number> = {
  'not-for-me': 1,
  neutral: 2,
  liked: 3,
  loved: 4,
}
const RATING_TOTAL = 4

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link,
    photo = '',
    verdict,
    showRating = false,
    chips = [],
    addressLines = [],
    excerpt = '',
    sources = [],
    showMore = true,
  } = config

  const photoHtml = photo
    ? `<div class="popup-photo" style="background-image: url('${escapeHtml(photo)}')" aria-hidden="true"></div>`
    : ''

  const titleHtml = `<h2><a href="${link}">${escapeHtml(title)}</a></h2>`

  // The rating, matching Rating.astro: four fleur-de-lis, filled to the verdict's
  // level (not-for-me = 1 … loved = 4), all four faded when unrated. The label
  // rides along as an aria-label.
  const filled = verdict ? (RATING_FILLED[verdict.key] ?? 0) : 0
  const ratingLabel = verdict
    ? `Rating: ${escapeHtml(verdict.label)}, ${filled} of ${RATING_TOTAL}`
    : 'Not yet rated'
  const ratingHtml =
    verdict || showRating
      ? `<span class="rating" role="img" aria-label="${ratingLabel}">${Array.from(
          { length: RATING_TOTAL },
          (_unused, index) => fleurGlyph(index < filled ? 'rating-fleur is-filled' : 'rating-fleur'),
        ).join('')}</span>`
      : ''

  // Joined with the hairline tick the list eyebrows use; the list-eyebrow
  // class picks up the shared divider styling.
  const metaInner = chips.map(chipHtml).join('<span class="eyebrow-divider" aria-hidden="true"></span>')
  const metaHtml = metaInner ? `<div class="popup-meta list-eyebrow">${metaInner}</div>` : ''

  const addressHtml = addressLines.length
    ? `<span class="tip-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const excerptHtml = excerpt ? `<p class="tip-excerpt">${escapeHtml(excerpt)}</p>` : ''

  const moreHtml = showMore
    ? `<a class="btn btn-dark btn-compact popup-more-link" href="${link}">View more</a>`
    : ''

  const sourcesHtml = sources.length
    ? `<div class="popup-actions">${sources
        .map((source) => {
          const icon = SOURCE_ICON[source.label] ?? ''
          return `<a class="btn btn-outline btn-compact" href="${source.href}" target="_blank" rel="noopener">${icon}${escapeHtml(source.label)}</a>`
        })
        .join('')}</div>`
    : ''

  // Order mirrors the list rows: the photo banner, rating, the eyebrow, then
  // the serif title with the address and excerpt below.
  return `${photoHtml}${ratingHtml}${metaHtml}${titleHtml}${addressHtml}${excerptHtml}${moreHtml}`
}
