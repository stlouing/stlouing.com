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

1. Set `BASEMAP_BOUNDS` to a box around your metro area. Keep it tight; the file
   size grows with the area.
2. Install the tools: `brew install pmtiles tippecanoe`.
3. Pick a recent daily build date from <https://build.protomaps.com> and run:

   ```sh
   scripts/build-basemap.sh 20260906
   ```

   This extracts your box at zoom 0–14 and keeps only the layers the style
   draws, writing `public/<BASEMAP_FILE>`. `npm run dev` reads it from there.

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

Two files are derived from the boundaries and committed, so the site build never
does geometry work:

- **`src/data/neighborhood-geo.json`** — `viewBox`, plus `shapes` (one SVG path
  string per slug, all projected into that shared viewBox, used for the small
  inline locator maps) and `adjacency` (slug → bordering slugs, used for
  "Nearby neighborhoods").
- **`src/data/neighborhood-population.json`** — slug → population. Optional;
  neighborhoods without an entry just don't show a population.

Regenerate both whenever the boundaries or the roster change.

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

## Attribution

The basemap and corridor geometry are OpenStreetMap data under the
[ODbL](https://opendatacommons.org/licenses/odbl/). The "© OpenStreetMap"
credit shown on every map is what the licence requires, so keep it visible.
