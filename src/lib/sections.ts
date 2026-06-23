export type Group = 'maps' | 'lists' | 'notes' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
}

// Homepage groups, in display order. 'notes' is intentionally omitted for now —
// it has no content yet, so the section stays defined (its page + feed work) but
// isn't surfaced on the homepage or in the nav until there are posts.
export const groups: { id: Group; label?: string }[] = [
  { id: 'maps', label: 'Maps' },
  { id: 'topics', label: 'Topics' },
  { id: 'lists', label: 'Lists' },
  { id: 'site', label: 'Site' },
]

export const sections: Section[] = [
  {
    label: 'Food',
    path: '/food',
    group: 'maps',
    primary: true,
    description: `An interactive map of my favorite spots across the STL metro, filterable by cuisine and neighborhood. All ratings are subjective, based on my taste and experiences.`,
  },
  {
    label: 'Neighborhoods',
    path: '/neighborhoods',
    group: 'maps',
    primary: true,
    description: `A map of the 79 neighborhoods and 9 parks in St. Louis city, where I can keep track of the unique things I've learned about a given area.`,
  },
  // {
  //   label: 'Hikes',
  //   path: '/hikes',
  //   group: 'maps',
  //   description: 'Exploring the nature of Missouri',
  // },

  {
    label: 'Topics',
    path: '/topics',
    group: 'topics',
    primary: true,
    description: 'Evergreen pages, tended over time',
  },

  // Lists: my subjective picks and running lists. (Pronunciations + Slang are
  // reference, reached via the St. Louis Overview topic; Want to Try lives with
  // Food on the /food page — none of them are top-level groups anymore.)
  {
    label: 'Best of St. Louis Food',
    path: '/best',
    group: 'lists',
    description: 'My favorite food so far, ranked and by category.',
  },
  {
    label: 'Want to Try',
    path: '/food/want-to-try',
    group: 'lists',
    description: "Places I haven't tried or rated yet.",
  },
  {
    label: 'Sitemap',
    path: '/sitemap',
    group: 'lists',
    description: 'A human-readable index of every page.',
  },
  // Hidden until it has posts (omitted from `groups` above and not `primary`).
  { label: 'Notes', path: '/notes', group: 'notes' },

  {
    label: 'About',
    path: '/about',
    group: 'site',
    primary: true,
    description: 'Why I made this city exploration digital garden.',
  },
  { label: 'Tags', path: '/tags', group: 'site', description: 'Browse everything by topic.' },
  {
    label: 'Feedback',
    path: '/feedback',
    group: 'site',
    description: 'Let me know your thoughts!',
  },
]
