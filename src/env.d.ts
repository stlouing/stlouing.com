/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Production basemap URL (object storage). Set in CI; unset in local dev, where
  // the map falls back to the local public/stl.pmtiles file. See docs/protomaps-basemap.md.
  readonly PUBLIC_PMTILES_URL?: string
}
