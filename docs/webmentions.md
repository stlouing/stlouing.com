# Webmentions — implementation guide (not yet built)

Webmentions are the IndieWeb's open, decentralized replacement for comments/likes: when
someone links to one of your posts from their own site (or from Mastodon/Bluesky/GitHub via a
bridge), your site is notified and can display that reply, like, or repost beneath the post.

**This is not implemented yet** — this doc is the recipe for adding it later. The groundwork it
depends on **is** already in place (see "Already done" below), so the remaining work is the
webmention-specific plumbing only.

## Outcome (what you get when this is built)

- Replies, likes, and reposts from other sites/social accounts appear under each note (a
  "Webmentions" section, styled like "Mentioned in"): a facepile of like/repost avatars plus a
  list of reply text with author names.
- Two-way: the site also **sends** webmentions when a note links out, so the sites you reference
  get notified.
- Fully static — mentions are fetched at build time; no runtime backend.

## Already done (prerequisites)

These shipped with the "rel=me + microformats" work and are what webmentions need to parse:

- **Microformats**: notes are `h-entry` (`p-name`, `dt-published`, `e-content`, `u-url`,
  `p-author h-card`) — see `src/pages/notes/[slug].astro`. The homepage is the author `h-card`
  — see `src/pages/index.astro`.
- **`rel="me"`** identity links for every persona social — see `src/layouts/BaseLayout.astro`
  (driven by `SOCIALS` in `src/lib/site.ts`).

## To implement

### 1. Receive — register + advertise an endpoint

1. Sign in to **https://webmention.io** with `https://stlouing.com` (IndieAuth uses the
   `rel="me"` links already in the `<head>`; the linked profiles must link back to the site).
2. Copy the API **token** webmention.io gives you.
3. Add to the `<head>` in `src/layouts/BaseLayout.astro`:
   ```html
   <link rel="webmention" href="https://webmention.io/stlouing.com/webmention" />
   <link rel="pingback" href="https://webmention.io/stlouing.com/xmlrpc" />
   ```

### 2. Display — fetch at build, render under notes

Mirror the existing backlinks pattern (`src/lib/backlinks.ts` + `src/components/Backlinks.astro`).

- **`src/lib/webmentions.ts`** — module-cached fetch + getter (same shape as `backlinks.ts`):
  - Fetch all mentions for the domain from webmention.io's jf2 API, paginating:
    `https://webmention.io/api/mentions.jf2?domain=stlouing.com&token=${TOKEN}&per-page=100&page=N`
  - Read the token from `import.meta.env.WEBMENTION_IO_TOKEN`; **return `[]` if it's missing** so
    local builds (and PRs without the secret) still succeed.
  - Cache the result once; expose `getWebmentions(absoluteUrl)` that filters items by
    `wm-target === absoluteUrl` and groups by `wm-property`
    (`like-of`/`repost-of` → facepile; `in-reply-to`/`mention-of` → replies).
- **`src/components/Webmentions.astro`** — props: the grouped mentions. Render a like/repost
  facepile (each `author.photo` linked to `author.url`) and a replies list
  (`author.name` + `content.text`/`content.html`). Style it like `Backlinks.astro`.
- In **`src/pages/notes/[slug].astro`**, fetch with the note's absolute permalink (the
  `permalink` already computed there) and render `<Webmentions>` in the `entry-footer`, next to
  `<Backlinks>`.

### 3. Send — notify the sites a note links to

In **`.github/workflows/deploy.yml`**:

- Pass the token to the build so the display fetch works:
  ```yaml
  - uses: withastro/action@v3
    env:
      WEBMENTION_IO_TOKEN: ${{ secrets.WEBMENTION_IO_TOKEN }}
  ```
- Add a job that runs after `deploy` and sends webmentions for any outbound links in the feed
  (the RSS feed already carries full post content):
  ```yaml
  send-webmentions:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - run: npx -y webmention https://stlouing.com/rss.xml --limit 0 --send
  ```
  Alternative to the CI step: a hosted cron at **https://webmention.app** pointed at the feed.

## Owner / external actions (one-time)

- Create the **webmention.io** account (step 1) and add the token as the GitHub Actions secret
  **`WEBMENTION_IO_TOKEN`** (repo → Settings → Secrets and variables → Actions).
- Optional: set up **https://brid.gy** to backfeed likes/replies from Mastodon, Bluesky, and
  GitHub into webmention.io.

## Testing

- Local build with no token → site builds, the Webmentions section is simply empty.
- Send yourself a test from **https://webmention.rocks** (or via Bridgy), rebuild, and confirm
  it renders under the target note.
- Validate the microformats a sender will read: paste a note URL into
  https://php.microformats.io or the "Are you Indie?" checker at https://indiewebify.me.
