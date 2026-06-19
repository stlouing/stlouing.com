/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Production basemap URL (object storage). Set in CI; unset in local dev, where
  // the map falls back to the local public/stl.pmtiles file. See docs/protomaps-basemap.md.
  readonly PUBLIC_PMTILES_URL?: string
  // Feedback form endpoint (Formspree). Set in CI; unset on a fresh clone, where
  // the /feedback page renders without the form. PUBLIC_ so import.meta.env sees it.
  readonly PUBLIC_FORMSPREE_URL?: string
}
