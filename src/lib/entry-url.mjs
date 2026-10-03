export function entryUrl(collection, id) {
  if (collection === 'topics') {
    return `/${id}/`
  }

  return `/${collection}/${id}/`
}
