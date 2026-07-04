// Shared builder for the two map popups (food markers + neighborhood boundaries).

// Escape text before it goes into a popup's innerHTML.
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Lucide map-pin, inlined for a popup's neighborhood pin chip.
export const PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'

export interface PopupChip {
  // Visible label; escaped before insertion.
  label: string
  // Raw leading emoji or SVG markup (NOT escaped) — a cuisine emoji or PIN_SVG.
  leadingHtml?: string
  // When set, the chip is an interactive filter <button> (data-filter-set/value);
  // otherwise it's a static <span> (e.g. the neighborhood popup's area chip).
  filterSet?: string
  filterValue?: string
  // Section key (north/central/south/county/park) — adds a colored dot before the
  // label via `.chip-region .region-<section>`. Used by the neighborhood popup.
  section?: string
}

export interface PopupSource {
  label: string
  href: string
}

export interface PopupConfig {
  // Title text + the shared target for the title link and "View more".
  title: string
  link: string
  // Food only: a color-coded verdict pill (Loved / Liked / …) leading the chip
  // row, matching the list rows. `key` picks the `.verdict-<key>` color token.
  verdict?: { key: string; label: string }
  // Chip row under the title (cuisine + neighborhood pin, or a single area chip).
  chips?: PopupChip[]
  // Food only: address lines, rendered under the title.
  addressLines?: string[]
  // A one-line tagline (the entry's description), shown in accent below the chips.
  // Passed by both the Food and Neighborhood maps.
  tagline?: string
  // A short writeup teaser, clamped to a few lines by the popup CSS.
  excerpt?: string
  // Outlined buttons to external sources (Website, Instagram, Wikipedia, …).
  sources?: PopupSource[]
  // Show the ruled "View more" link (defaults on; Food hides it without a teaser).
  showMore?: boolean
}

function chipHtml(chip: PopupChip): string {
  const leading = chip.leadingHtml ? `${chip.leadingHtml} ` : ''
  const inner = `${leading}${escapeHtml(chip.label)}`
  // A section adds the colored dot (`.chip-region` + `.region-<section>`).
  const cls = chip.section ? `chip chip-region region-${chip.section}` : 'chip'
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="${cls}" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="${cls}">${inner}</span>`
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

// Lucide icon per verdict (heart / thumbs-up / circle-minus / heart-off), matching
// Verdict.astro, so the popup pill carries the same glyph as the list rows.
const VERDICT_ICON: Record<string, string> = {
  loved: sourceIcon(
    '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  ),
  liked: sourceIcon(
    '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  ),
  neutral: sourceIcon('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>'),
  'not-for-me': sourceIcon(
    '<path d="M10.5 4.893a5.5 5.5 0 0 1 1.091.931.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 1.872-1.002 3.356-2.187 4.655"/><path d="m16.967 16.967-3.459 3.346a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 2.747-4.761"/><path d="m2 2 20 20"/>',
  ),
}

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link,
    verdict,
    chips = [],
    addressLines = [],
    tagline = '',
    excerpt = '',
    sources = [],
    showMore = true,
  } = config

  const titleHtml = `<h2><a href="${link}">${escapeHtml(title)}</a></h2>`

  const verdictHtml = verdict
    ? `<span class="verdict-chip chip verdict-${verdict.key} is-filled">${VERDICT_ICON[verdict.key] ?? ''}<span>${escapeHtml(verdict.label)}</span></span>`
    : ''

  const metaInner = `${chips.map(chipHtml).join('')}`
  const metaHtml = metaInner ? `<div class="popup-meta">${metaInner}</div>` : ''

  const addressHtml = addressLines.length
    ? `<span class="tip-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const taglineHtml = tagline ? `<p class="popup-tagline">${escapeHtml(tagline)}</p>` : ''

  const excerptHtml = excerpt ? `<p class="tip-excerpt">${escapeHtml(excerpt)}</p>` : ''

  const moreHtml = showMore ? `<a class="popup-more-link" href="${link}">View more</a>` : ''

  const sourcesHtml = sources.length
    ? `<div class="popup-actions">${sources
        .map((source) => {
          const icon = SOURCE_ICON[source.label] ?? ''
          return `<a class="btn btn-outline" href="${source.href}" target="_blank" rel="noopener">${icon}${escapeHtml(source.label)}</a>`
        })
        .join('')}</div>`
    : ''

  // Order mirrors the list rows: title, then the chips, then the tagline
  // (description), with the address (Food) and excerpt below.
  return `${verdictHtml}${titleHtml}${metaHtml}${taglineHtml}${excerptHtml}${moreHtml}${sourcesHtml}`
}
