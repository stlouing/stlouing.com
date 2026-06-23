// Shared builder for the two map popups (food markers + neighborhood boundaries).
// Both render the same card — a linked title, a chip row, an optional address,
// a writeup teaser, a ruled "View more", and a row of outlined source buttons —
// using the site's shared `.chip` / `.btn` classes. The markup is injected via
// Leaflet's popup `innerHTML`, so all text is escaped here.

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
}

export interface PopupSource {
  label: string
  href: string
}

export interface PopupConfig {
  // Title text + the shared target for the title link and "View more".
  title: string
  link: string
  // Chip row under the title (cuisine + neighborhood pin, or a single area chip).
  chips?: PopupChip[]
  // Food only: address lines, rendered under the title.
  addressLines?: string[]
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
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="chip" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="chip">${inner}</span>`
}

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link,
    chips = [],
    addressLines = [],
    excerpt = '',
    sources = [],
    showMore = true,
  } = config

  const titleHtml = `<h2><a href="${link}">${escapeHtml(title)}</a></h2>`

  const metaHtml = chips.length
    ? `<div class="popup-meta">${chips.map(chipHtml).join('')}</div>`
    : ''

  const addressHtml = addressLines.length
    ? `<span class="tip-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const excerptHtml = excerpt ? `<p class="tip-excerpt">${escapeHtml(excerpt)}</p>` : ''

  const moreHtml = showMore ? `<a class="popup-more-link" href="${link}">View more</a>` : ''

  const sourcesHtml = sources.length
    ? `<div class="popup-actions">${sources
        .map(
          (source) =>
            `<a class="btn btn-outline" href="${source.href}" target="_blank" rel="noopener">${escapeHtml(source.label)}</a>`,
        )
        .join('')}</div>`
    : ''

  return `${titleHtml}${metaHtml}${addressHtml}${excerptHtml}${moreHtml}${sourcesHtml}`
}
