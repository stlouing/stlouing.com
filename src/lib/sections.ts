export type Group = 'explore' | 'lists' | 'notes' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
  icon?: string
}

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
  {
    label: 'Topics',
    path: '/topics/',
    group: 'topics',
    primary: true,
    icon: 'book',
    description: "Field notes and deep dives on what I've learned.",
  },

  {
    label: 'The Best Food in St. Louis',
    path: '/best/',
    group: 'lists',
    icon: 'award',
    description: 'My favorite restaurants and cafes so far!',
  },
  {
    label: 'Annual Events in St. Louis',
    path: '/events/',
    group: 'lists',
    icon: 'calendar',
    description: 'A calendar of festivals and events across the city.',
  },
  {
    label: 'Backlog',
    path: '/food/backlog/',
    group: 'lists',
    icon: 'list-checks',
    description: "Places I haven't tried or rated yet.",
  },
  {
    label: 'Sitemap',
    path: '/sitemap/',
    group: 'site',
    icon: 'folder-tree',
    description: 'An index of every page on the site.',
  },
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
    label: 'Guestbook',
    path: '/guestbook/',
    group: 'site',
    icon: 'notebook',
    description: 'Sign your name and leave a note.',
  },
  {
    label: 'Contact',
    path: '/contact/',
    group: 'site',
    primary: true,
    icon: 'message-circle-heart',
    description: 'Let me know your thoughts!',
  },
]
