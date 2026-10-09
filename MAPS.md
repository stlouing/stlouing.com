# Maps

How the map data fits together, and how to rebuild it for a different city.

Every map is [MapLibre GL](https://maplibre.org/) drawing a self-hosted
[Protomaps](https://protomaps.com) basemap (one `.pmtiles` file), with the site's
own data layered on top. There are no map API keys and no tile service.

City-wide map settings live in `site.config.mjs`:

| Setting                        | What it does                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| `MAP_CENTER`                   | `[lng, lat]` the maps open on                                      |
| `CITY_BOUNDS`                  | `[[west, south], [east, north]]` the overview maps fit to          |
| `BASEMAP_BOUNDS`               | `[west, south, east, north]` cut out of the planet for the basemap |
| `BASEMAP_FILE`                 | basemap filename in `public/`                                      |
| `NEIGHBORHOOD_BOUNDARIES_FILE` | neighborhood boundary GeoJSON filename in `public/`                |

## 1. Basemap

The basemap is generated, not committed (it's ~30 MB and gitignored).

1. In `site.config.mjs`, set `BASEMAP_BOUNDS` to a `[west, south, east, north]`
   box around your metro area and `BASEMAP_FILE` to a filename. Keep the box
   tight; the file size grows with the area. Central Edinburgh is about 8 MB,
   greater St. Louis about 30 MB.
2. Install the tools: `brew install pmtiles tippecanoe`.
3. Pick a recent daily build date from <https://build.protomaps.com> and run:

   ```sh
   npm run build:basemap -- 20261008
   ```

   This downloads just your box from that day's planet build at zoom 0–14
   (it takes seconds, not the whole planet), keeps only the layers the style
   draws, and writes `public/<BASEMAP_FILE>`. `npm run dev` reads it from there.

4. For production, upload the file to any static host that supports HTTP range
   requests (an S3/R2/Supabase Storage bucket works) and set
   `PUBLIC_PMTILES_URL` to its URL at build time. Use a long cache header.

## 2. Neighborhood boundaries

Put a GeoJSON file of your neighborhood polygons at
`public/<NEIGHBORHOOD_BOUNDARIES_FILE>`. Most cities publish one on their open
data portal. Each feature needs two properties:

- `NHD_NUM` — a unique number. **This is the join key** with
  `src/data/neighborhoods.json`; never join on names, which rarely match exactly.
- `NHD_NAME` — the display name, used as a fallback label.

If your source file uses other property names, rename them to these before
committing.

## 3. Neighborhood roster

`src/data/neighborhoods.json` is the hand-written list of neighborhoods:

```json
{ "number": 1, "name": "Carondelet", "slug": "carondelet", "group": "South City" }
```

- `number` matches `NHD_NUM` in the boundary file.
- `slug` is the URL (`/neighborhoods/<slug>/`) and the key every other data file uses.
- `group` is the region the neighborhood belongs to.
- Optional: `"type": "park"` for parks, `"type": "city"` / `"community"` with
  `"coords": [lat, lng]` for places outside the boundary file, and
  `"ignored": true` for rows kept only as data (skipped everywhere).

Regions are defined in `src/lib/neighborhoods.ts` (`regions`, the group→region
mapping, and `regionTokenBySlug`, which picks each region's map colour from the
`--color-map-*` tokens in `src/styles/global.css`). Replace the St. Louis groups
there with your city's.

## 4. Derived neighborhood data

Two files are generated and committed, so the site build never does geometry
work or network calls.

### Shapes and neighbors

```sh
npm run build:geo
```

Writes **`src/data/neighborhood-geo.json`**: a `viewBox`, `shapes` (one SVG path
per slug, all projected into that viewBox, used for the small inline locator
maps) and `adjacency` (slug → bordering slugs, used for "Nearby neighborhoods").
Two neighborhoods count as neighbors when their boundaries share a vertex.

It reads `public/<NEIGHBORHOOD_BOUNDARIES_FILE>` and joins each feature to
`neighborhoods.json` by number. Rows with `coords` (places pinned by a point, not
a shape) are left out. Options:

- `--boundaries <path>` — a different GeoJSON file
- `--number-property <name>` — the feature property holding the number
  (default `NHD_NUM`), if your source file uses another name
- `--width <pixels>` — viewBox width (default `1000`)

```sh
npm run build:geo -- --boundaries data/edinburgh-areas.geojson --number-property AREA_ID
```

Rerun whenever the boundaries or the roster change.

### Population

```sh
npm run build:population
```

Writes **`src/data/neighborhood-population.json`** (slug → population). It's
optional: neighborhoods without an entry just don't show a population. Sources:

- `--wikipedia "<page title>"` — reads the first table on a Wikipedia page
  whose rows start with a linked neighborhood name followed by a population.
  Defaults to `List of neighborhoods of <CITY>`.
- `--csv <path>` — a CSV with a header row and `name,population` rows, for
  cities where Wikipedia has no such table.

Names are matched loosely (case and punctuation ignored). When the source uses a
different name than the site, map the slug to the source name, or a list of
names to add together, in `src/data/neighborhood-population-aliases.json`:

```json
{ "the-grove": "Forest Park Southeast", "dogtown": ["Cheltenham", "Franz Park"] }
```

Rows with a `type` (parks, outlying towns) and names the source can't match keep
whatever value the file already had, so hand-entered numbers survive a rerun.
Unmatched names are listed at the end of the run.

## 5. Places on the map

- **Food** — each entry in `src/content/food/` has `coords: [lat, lng]` and a
  `neighborhood` name in its frontmatter.
- **Notable spots** — `src/data/spots.json`, keyed by neighborhood slug, with
  `coords: [lng, lat]`.
- **Walkable corridors** — street polylines in `src/data/corridors.json`,
  generated from OpenStreetMap by `node scripts/fetch-corridors.mjs`. Edit the
  `corridors` list at the top of that script (street name, the two cross-street
  endpoints, and a rough `center`), then run it. Passing corridor ids re-fetches
  just those. Set `OVERPASS_URL` to a mirror if the default rate-limits you.
- **Corridor spots** — `src/data/corridor-spots.json`, keyed by corridor id,
  `coords: [lng, lat]`.

**Watch the coordinate order.** It isn't uniform:

| Where                                                                            | Order        |
| -------------------------------------------------------------------------------- | ------------ |
| `corridors.json`, `corridor-spots.json`, `spots.json`, `site.config.mjs`         | `[lng, lat]` |
| `neighborhoods.json` `coords`, food frontmatter `coords`, corridor script points | `[lat, lng]` |

## Which data files are required

Only `src/data/neighborhoods.json` and `src/data/neighborhood-geo.json` are
required. Every other file in `src/data/` powers one optional feature and can be
deleted; that feature just disappears:

| File                                    | Feature                                          |
| --------------------------------------- | ------------------------------------------------ |
| `corridors.json`, `corridor-spots.json` | walkable corridor maps                           |
| `spots.json`                            | notable spots on neighborhood pages              |
| `festivals.json`                        | events page and neighborhood festivals           |
| `best-food.json`                        | the Best Food picks (category → restaurant slug) |
| `rip.json`                              | closed restaurants on the backlog page           |
| `neighborhood-population.json`          | population on neighborhood pages                 |
| `neighborhood-population-aliases.json`  | name mapping for the population script           |
| `city-county-boundaries.json`           | the city/county boundary article figure          |

## Attribution

The basemap and corridor geometry are OpenStreetMap data under the
[ODbL](https://opendatacommons.org/licenses/odbl/). The "© OpenStreetMap"
credit shown on every map is what the licence requires, so keep it visible.
