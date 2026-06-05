/**
 * Canonical site URL (root-relative, no base prefix) for a content entry.
 *
 * Single source of truth shared by the wikilink resolver (astro.config.mjs),
 * the backlinks index (lib/backlinks.ts), and the tag index (lib/tags.ts) so a
 * given entry always links to the same place. Every food / hike / neighborhood /
 * note entry has its own detail page at `/<collection>/<id>`; topics are
 * flattened to the site root (`/<id>`). Pass the result through href() / BASE
 * before use in markup.
 *
 * @param {string} collection - the content collection name
 * @param {string} id - the entry id (its slug within the collection)
 * @returns {string} root-relative URL path, e.g. "/food/louie" or "/overview"
 */
export function entryUrl(collection, id) {
  if (collection === 'topics') {
    return `/${id}`
  }

  return `/${collection}/${id}`
}
