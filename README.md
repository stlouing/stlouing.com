# St. Louing

[stlouing.com](https://stlouing.com)

A personal website documenting the food, neighborhoods, and culture of St. Louis.

## TL;DR

- Includes a [food](/food/) map and [neighborhood](/neighborhoods/) map, both have individual slugs that interlink (restuarants within a neighborhood, similar types of restaurants, etc.) and long-form [topics](/topics/) page.

## Stack

- **[Astro](https://astro.build)**
- **[MapeLibre GL](https://maplibre.org/)** + **[Protomaps](https://protomaps.com)** (`.pmtiles`) over **[OpenStreetMap](https://www.openstreetmap.org/)**
- **[GitHub Pages](https://docs.github.com/en/pages)**
- **[GoatCounter](https://www.goatcounter.com)**
- **[Formspree](https://formspree.io)**
- **[Pixelarticons](https://pixelarticons.com)** by Gerrit Halfmann ([MIT](https://github.com/halfmage/pixelarticons/blob/master/LICENSE))

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # production build
npm run preview  # serve the build locally
npm run prettier # format
```

Requires Node `>=22.12`.

## Start your own city

- Edit `site.config.mjs` with your site name, domain, city, and map bounds.
- Replace `src/content/` and `src/pages/about.md` with your own writing.
- Replace `src/data/neighborhoods.json` with your neighborhoods; delete any other `src/data/` file you don't need.
- Put your neighborhood boundaries GeoJSON in `public/`, with a number on each feature in `NHD_NUM`.
- Install the map tools with `brew install pmtiles tippecanoe`.
- Build the basemap with `npm run build:basemap -- 20261008` (any recent date from build.protomaps.com).
- Generate neighborhood shapes and neighbors with `npm run build:geo`.
- Optionally add populations with `npm run build:population -- --csv populations.csv`.
- Swap the logo, favicons, and social images in `public/` and `src/assets/`.
- Update `public/CNAME`, `public/robots.txt`, the `package.json` name, and `LICENSE`.
- See [MAPS.md](MAPS.md) for the details on any map step.

## Optional services

Set these in `.env` (see `.env.example`). Anything left unset is hidden from the site.

- `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` turn on comments, the guestbook, and reader ratings.
- `PUBLIC_FORMSPREE_URL` turns on the contact form.
- `PUBLIC_NEWSLETTER_URL` turns on newsletter signup.
- `PUBLIC_ANALYTICS_URL` turns on GoatCounter analytics.
- `PUBLIC_PMTILES_URL` serves the basemap from a host instead of `public/`.

## License

The **source code** is [MIT](LICENSE), but please don't use the site content.
