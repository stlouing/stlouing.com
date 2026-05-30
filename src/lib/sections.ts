export type Group = 'guides' | 'notes' | 'pages' | 'site'

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
  { id: 'pages', label: 'Pages' },
  { id: 'notes', label: 'Notes' },
  { id: 'site', label: 'Site' },
]

export const sections: Section[] = [
  {
    label: 'Food',
    path: '/food',
    group: 'guides',
    primary: true,
    description: 'Keeping track of my favorite spots',
  },
  {
    label: 'Neighborhoods',
    path: '/neighborhoods',
    group: 'guides',
    primary: true,
    description: 'A map of St. Louis neighborhoods',
  },
  {
    label: 'Hikes',
    path: '/hikes',
    group: 'guides',
    primary: true,
    description: "Taking advantage of Missouri's beautiful nature",
  },

  { label: 'Notes', path: '/notes', group: 'notes', primary: true },

  {
    label: 'Overview',
    path: '/overview',
    group: 'pages',
    description: 'An assortment of St. Louis facts and observations',
  },
  {
    label: 'Chicago and St. Louis',
    path: '/chicago-vs-st-louis',
    group: 'pages',
    description: 'The Windy City and the Gateway to the West',
  },
  {
    label: 'St. Louis Regional Foods',
    path: '/regional-foods',
    group: 'pages',
    description: 'Provel, t-ravs, and other things',
  },

  { label: 'About', path: '/about', group: 'site', primary: true, description: 'About this site' },
  { label: 'Changelog', path: '/changelog', group: 'site', description: 'Updates to the site' },
  { label: 'Tags', path: '/tags', group: 'site', description: 'Browse everything by topic' },
]
