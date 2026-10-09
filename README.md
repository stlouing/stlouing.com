# St. Louing

[stlouing.com](https://stlouing.com)

A personal website documenting the food, neighborhoods, and culture of St. Louis.

## TL;DR

- Includes a [food](https://stlouing.com/food/) map and [neighborhood](https://stlouing.com/neighborhoods/) map, both have individual slugs that interlink (restuarants within a neighborhood, similar types of restaurants, etc.) and long-form [topics](https://stlouing.com/topics/) page.

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

- Install the map tools with `brew install pmtiles tippecanoe`.
- Run `npm run setup` and answer the prompts: it clears the St. Louis content and data, fills in `site.config.mjs`, and builds your city's map.
- Check `site.config.mjs` and add any other socials or copy changes.
- Write your About page in `src/pages/about.md` and add food posts to `src/content/food/`.
- Swap the logo, favicons, and `public/og.png` for your own.
- Update `public/CNAME`, `public/robots.txt`, the `package.json` name, and `LICENSE`.
- For neighborhood pages, follow [MAPS.md](MAPS.md).

## Optional services

Set these in `.env` (see `.env.example`). Anything left unset is hidden from the site.

- `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` turn on comments, the guestbook, and reader ratings.
- `PUBLIC_FORMSPREE_URL` turns on the contact form.
- `PUBLIC_NEWSLETTER_URL` turns on newsletter signup.
- `PUBLIC_ANALYTICS_URL` turns on GoatCounter analytics.
- `PUBLIC_PMTILES_URL` serves the basemap from a host instead of `public/`.

## License

The **source code** is [MIT](LICENSE), but please don't use the site content.
