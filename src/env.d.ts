/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Production basemap URL (object storage). Set in CI; unset in local dev, where
  // the map falls back to the local public/stl.pmtiles file. See docs/protomaps-basemap.md.
  readonly PUBLIC_PMTILES_URL?: string
  // Feedback form endpoint (Formspree). Set in CI; unset on a fresh clone, where
  // the /contact page renders without the form. PUBLIC_ so import.meta.env sees it.
  readonly PUBLIC_FORMSPREE_URL?: string
  // Analytics endpoint (GoatCounter base URL). Set in CI; unset on a clone, where
  // no analytics script is emitted. The /count path is appended in BaseLayout.
  readonly PUBLIC_ANALYTICS_URL?: string
  // Newsletter URL (Substack). Set in CI; unset on a clone, where the signup +
  // footer link self-hide.
  readonly PUBLIC_NEWSLETTER_URL?: string
}
