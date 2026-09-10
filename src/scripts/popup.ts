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
  // Title text + the shared target for the title link and "View more". Without
  // a link the title renders as plain text and "View more" is omitted.
  title: string
  link?: string
  // Open the title link + "View more" in a new tab (an off-site spot page).
  external?: boolean
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
  // Food only: the place's Google Maps link, rendered as a small
  // "View directions" link under the address.
  directionsHref?: string
  // A one-line tagline (the entry's description). Accepted for compatibility
  // but not rendered.
  tagline?: string
  // A short writeup teaser, clamped to a few lines by the popup CSS.
  excerpt?: string
  // Outlined buttons to external sources (Website, Instagram, Wikipedia, …).
  sources?: PopupSource[]
}

// The cuisine / neighborhood / region meta in the shared eyebrow voice. A
// filterable value stays an interactive <button> (data-filter-set/value).
function chipHtml(chip: PopupChip): string {
  const inner = escapeHtml(chip.label)
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="list-meta eyebrow eyebrow--muted" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="eyebrow eyebrow--muted">${inner}</span>`
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

// Pixelarticons `external-link` (MIT) — fill-based, unlike the stroked Lucide
// set above; the pixel-art voice for the popup's outbound "View directions" link.
const DIRECTIONS_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" class="icon" aria-hidden="true"><path d="M21 11V3h-8v2h4v2h-2v2h-2v2h-2v2H9v2h2v-2h2v-2h2V9h2V7h2v4h2zM11 5H3v16h16v-8h-2v6H5V7h6V5z" fill="currentColor"/></svg>`

// The St. Louis fleur-de-lis emblem, referencing the #fleur-glyph symbol
// BaseLayout embeds once. currentColor fills it, so the popup rating CSS colors
// the filled glyphs gold and fades the rest. `className` sets `is-filled`.
function fleurGlyph(className: string): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 192" fill="currentColor" aria-hidden="true"><use href="#fleur-glyph"/></svg>`
}

// Filled fleur-de-lis count per verdict, out of four — matches Rating.astro.
const RATING_FILLED: Record<string, number> = { 'not-for-me': 1, neutral: 2, liked: 3, loved: 4 }
const RATING_TOTAL = 4

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link = '',
    external = false,
    photo = '',
    verdict,
    showRating = false,
    chips = [],
    addressLines = [],
    directionsHref = '',
    excerpt = '',
    sources = [],
  } = config

  const photoHtml = photo
    ? `<div class="popup-photo" style="background-image: url('${escapeHtml(photo)}')" aria-hidden="true"></div>`
    : ''

  const targetAttrs = external ? ' target="_blank" rel="noopener"' : ''
  const titleHtml = link
    ? `<h2><a class="title-serif title-link" href="${link}"${targetAttrs}>${escapeHtml(title)}</a></h2>`
    : `<h2><span class="title-serif">${escapeHtml(title)}</span></h2>`

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
          (_unused, index) =>
            fleurGlyph(index < filled ? 'rating-fleur is-filled' : 'rating-fleur'),
        ).join('')}</span>`
      : ''

  // Joined with the hairline tick the list eyebrows use; the list-eyebrow
  // class picks up the shared divider styling.
  const metaInner = chips
    .map(chipHtml)
    .join('<span class="eyebrow-divider" aria-hidden="true"></span>')
  const metaHtml = metaInner ? `<div class="popup-meta list-eyebrow">${metaInner}</div>` : ''

  const addressHtml = addressLines.length
    ? `<span class="popup-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const directionsHtml = directionsHref
    ? `<a class="popup-directions" href="${directionsHref}" target="_blank" rel="noopener">View directions${DIRECTIONS_ICON}</a>`
    : ''

  const excerptHtml = excerpt ? `<p class="popup-excerpt excerpt">${escapeHtml(excerpt)}</p>` : ''

  const moreHtml = link
    ? `<a class="btn btn-dark btn-compact popup-more-link" href="${link}"${targetAttrs}>View more</a>`
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
  // the serif title with the address (plus its directions link) and excerpt below.
  // The .popup-scroll wrapper caps the popup's height on short viewports and
  // scrolls internally (the close button, a sibling, stays pinned).
  return `<div class="popup-scroll">${photoHtml}${ratingHtml}${metaHtml}${titleHtml}${addressHtml}${directionsHtml}${excerptHtml}${moreHtml}</div>`
}
