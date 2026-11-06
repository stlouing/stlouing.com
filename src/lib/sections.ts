import { CITY } from './site'
import { NEIGHBORHOODS_ENABLED } from './neighborhood-data'
export type Group = 'explore' | 'lists' | 'topics' | 'site'

export interface Section {
  label: string
  path: string
  group: Group
  primary?: boolean
  description?: string
  icon?: string
}

export const groups: { id: Group; label?: string; kicker?: string }[] = [
  { id: 'explore', label: 'Explore' },
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
    description: `Every restaurant I've tried or want to try across the ${CITY} metro, filterable by cuisine and sorted by rating`,
  },
  ...(NEIGHBORHOODS_ENABLED
    ? [
        {
          label: 'Neighborhoods',
          path: '/neighborhoods/',
          group: 'explore' as const,
          primary: true,
          icon: 'map-pin',
          description: `The neighborhoods and parks of St. Louis city, plus county towns, districts, landmarks, museums, and murals`,
        },
      ]
    : []),
  {
    label: 'Directory',
    path: '/list/',
    group: 'explore',
    description: `A searchable database of the restaurants, bars, and cafes on this site`,
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
    label: `The Best Food in ${CITY}`,
    path: '/best/',
    group: 'lists',
    icon: 'award',
    description: 'All my favorites so far for specific items.',
  },
  {
    label: 'Sitemap',
    path: '/sitemap/',
    group: 'site',
    icon: 'folder-tree',
    description: 'An index of every page on the site.',
  },

  {
    label: 'About',
    path: '/about/',
    group: 'site',
    primary: true,
    icon: 'info',
    description: 'Why I made this city exploration website.',
  },
]
