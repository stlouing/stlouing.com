export type Group = 'maps' | 'notes' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
}

// Homepage groups, in display order (a 2-up grid: maps | notes / pages | site).
export const groups: { id: Group; label?: string }[] = [
  { id: 'maps', label: 'Maps' },
  { id: 'topics', label: 'Topics' },
  { id: 'notes', label: 'Notes' },
  { id: 'site', label: 'Site' },
]

export const sections: Section[] = [
  {
    label: 'Food',
    path: '/food',
    group: 'maps',
    primary: true,
    description: `An interactive map of my favorite spots across the STL metro, filterable by cuisine and neighborhood. All ratings are subjective based on my taste and experiences.`,
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

  { label: 'Notes', path: '/notes', group: 'notes', primary: true },

  { label: 'About', path: '/about', group: 'site', primary: true, description: 'About this site' },
  { label: 'Tags', path: '/tags', group: 'site', description: 'Browse everything by topic' },
]
