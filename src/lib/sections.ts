export type Group = 'explore' | 'lists' | 'notes' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
  // Icon keyword from the shared <Icon> registry, shown beside the label in the
  // primary nav and the homepage lists.
  icon?: string
}

// Homepage groups, in display order. 'notes' is intentionally omitted for now —
// it has no content yet, so the section stays defined (its page + feed work) but
// isn't surfaced on the homepage or in the nav until there are posts.
// `kicker` is the right-justified caption shown opposite the label in the
// homepage group headers.
export const groups: { id: Group; label?: string; kicker?: string }[] = [
  { id: 'explore', label: 'Maps' },
  { id: 'topics', label: 'Topics' },
  { id: 'lists', label: 'Lists' },
  { id: 'site', label: 'Site' },
]

export const sections: Section[] = [
  {
    label: 'Food',
    path: '/food/',
    group: 'explore',
    primary: true,
    icon: 'utensils',
    description: `An interactive map of my favorite spots across the St. Louis metro, filterable by cuisine, rating, and neighborhood`,
  },
  {
    label: 'Neighborhoods',
    path: '/neighborhoods/',
    group: 'explore',
    primary: true,
    icon: 'map-pin',
    description: `The 79 neighborhoods and 9 parks of St. Louis city, plus a few additional points of interest in the county`,
  },
  // {
  //   label: 'Hikes',
  //   path: '/hikes',
  //   group: 'explore',
  //   description: 'Exploring the nature of Missouri',
  // },

  {
    label: 'Topics',
    path: '/topics/',
    group: 'topics',
    primary: true,
    icon: 'book',
    description: "Field notes and deep dives on what I've learned.",
  },

  // Lists: my subjective picks and running lists.
  {
    label: 'The Best Food in St. Louis',
    path: '/best/',
    group: 'lists',
    icon: 'award',
    description: 'My favorite restaurants and cafes so far!',
  },
  {
    label: 'The Backlog',
    path: '/food/backlog/',
    group: 'lists',
    icon: 'list-checks',
    description: "Places I haven't tried or rated yet.",
  },
  {
    label: 'Annual Events',
    path: '/events/',
    group: 'lists',
    icon: 'calendar',
    description: 'A calendar of festivals and events across the city.',
  },
  {
    label: 'Sitemap',
    path: '/sitemap/',
    group: 'site',
    icon: 'folder-tree',
    description: 'An index of every page on the site.',
  },
  // Hidden until it has posts (omitted from `groups` above and not `primary`).
  { label: 'Notes', path: '/notes/', group: 'notes' },

  {
    label: 'About',
    path: '/about/',
    group: 'site',
    primary: true,
    icon: 'info',
    description: 'Why I made this city exploration website.',
  },
  {
    label: 'Tags',
    path: '/tags/',
    group: 'site',
    icon: 'tags',
    description: 'Browse everything by topic.',
  },
  {
    label: 'Feedback',
    path: '/feedback/',
    group: 'site',
    primary: true,
    icon: 'message-circle-heart',
    description: 'Let me know your thoughts!',
  },
]
