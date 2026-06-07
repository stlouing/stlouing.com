export type Group = 'guides' | 'notes' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
}

// Homepage groups, in display order (a 2-up grid: guides | notes / pages | site).
export const groups: { id: Group; label?: string }[] = [
  { id: 'guides', label: 'Guides' },
  { id: 'topics', label: 'Topics' },
  { id: 'notes', label: 'Notes' },
  { id: 'site', label: 'Site' },
]

export const sections: Section[] = [
  {
    label: 'Food',
    path: '/food',
    group: 'guides',
    primary: true,
    description: `An interactive map of my favorite spots, filterable by cuisine and neighborhood. All ratings are subjective based on my taste and experiences.`,
  },
  {
    label: 'Neighborhoods',
    path: '/neighborhoods',
    group: 'guides',
    primary: true,
    description: `A map of the 79 neighborhoods and 9 parks in St. Louis, where I can keep track of the unique things I've learned about each area.`,
  },
  // {
  //   label: 'Hikes',
  //   path: '/hikes',
  //   group: 'guides',
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
