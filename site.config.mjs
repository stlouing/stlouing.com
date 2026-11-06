export const SITE_NAME = 'St. Louing'
export const SITE_DOMAIN = 'stlouing.com'
export const SITE_URL = `https://${SITE_DOMAIN}`
export const REPO = 'stlouing/stlouing.com'
export const DEFAULT_BRANCH = 'main'
export const FOUNDED_YEAR = '2026'

export const CITY = 'St. Louis'
export const CITY_SHORT = 'STL'
export const REGION = 'Missouri'
export const REGION_CODE = 'MO'

export const TAGLINE = `An independent guide to the food, neighborhoods, and culture of ${CITY}`
export const SITE_DESCRIPTION = `${TAGLINE}.`
export const DEFAULT_TITLE = `${SITE_NAME}: Food, Neighborhoods, and Culture of ${CITY}`
export const HOME_INTRO = `Welcome to ${SITE_NAME}, my ongoing project to document living in ${CITY} and learning to love it!`
export const DEFAULT_SOCIAL_IMAGE_ALT = `${SITE_NAME} logo`

export const CONTACT_EMAIL = `hello@${SITE_DOMAIN}`
export const FEEDBACK_EMAIL = `hello+feedback@${SITE_DOMAIN}`
export const INSTAGRAM_HANDLE = 'st.louing'

export const SOCIALS = [
  { label: 'GitHub', url: 'https://github.com/stlouing' },
  { label: 'Instagram', url: `https://instagram.com/${INSTAGRAM_HANDLE}` },
  { label: 'YouTube', url: 'https://www.youtube.com/@stlouing' },
  { label: 'Bluesky', url: `https://bsky.app/profile/${SITE_DOMAIN}` },
  { label: 'Substack', url: 'https://stlouing.substack.com' },
  { label: 'Twitter', url: 'https://x.com/stlouing' },
]

export const PINNED_TOPIC_ID = 'field-notes'
export const PROMOTED_TOPIC_ID = 'st-louis-style-pizza'
export const BEST_PROMO_PHOTO_ID = 'kishimoto-mendo'
export const BEST_PROMO_TEASER =
  'My favorite ramen, tacos, pizza (Chicago, St. Louis, Detroit, etc), sandwiches, and more! Also a list of the top-voted spots by readers.'
export const STREETS_TOPIC_ID = 'walkable-st-louis'
export const FEATURED_FOOD_IDS = [
  'teerak-thai',
  'grand-pied',
  'kishimoto-mendo',
  'dalies-smokehouse',
  'nicky-slices',
  'buds-pizza-and-beer',
  'woofies-hot-dogs',
  'sultan',
]

export const MAP_CENTER = [-90.2, 38.627]
export const CITY_BOUNDS = [
  [-90.32049, 38.53298],
  [-90.17505, 38.77434],
]
export const BASEMAP_BOUNDS = [-90.95, 38.18, -89.85, 38.95]
export const BASEMAP_FILE = 'stl.pmtiles'
export const NEIGHBORHOOD_BOUNDARIES_FILE = 'stl-neighborhoods.geojson'
export const NEIGHBORHOOD_PARTS_FILE = 'stl-neighborhood-parts.geojson'
