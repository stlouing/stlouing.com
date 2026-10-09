# St. Louing

[stlouing.com](https://stlouing.com)

A personal website documenting the food, neighborhoods, and culture of St. Louis.

## TL;DR

- Includes a **[food](/food/) map and **[neighborhood](/neighborhoods/)** map, both have individual slugs that interlink (restuarants within a neighborhood, similar types of restaurants, etc.) and long-form **[topics](/topics/)\*\* page.

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

Update the following:

1. **`site.config.mjs`**
2. **Content** — replace `src/content/`, `src/pages/about.md`, and `src/data/`.
3. **Maps** — see [MAPS.md](MAPS.md).
4. **Branding** — `public/logo.svg`, `public/og.png`, `public/og/`, the favicons, and `src/assets/`.
5. **Static files** — `public/CNAME`, `public/robots.txt`, `package.json` `name`, `LICENSE`, and this README.

### Optional services

All of these are `PUBLIC_*` build variables (see `.env.example`).

| Variable                                           | Turns on                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` | comments, guestbook (page and nav link), reader ratings, Reader Favorites |
| `PUBLIC_FORMSPREE_URL`                             | the contact form                                                          |
| `PUBLIC_NEWSLETTER_URL`                            | newsletter signup in the footer and article action bar                    |
| `PUBLIC_ANALYTICS_URL`                             | GoatCounter analytics                                                     |
| `PUBLIC_PMTILES_URL`                               | the hosted basemap (otherwise `public/<BASEMAP_FILE>` is used)            |

## License

The **source code** is [MIT](LICENSE), but please don't use the site content.
