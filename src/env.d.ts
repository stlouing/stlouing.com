/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_PMTILES_URL?: string
  readonly PUBLIC_FORMSPREE_URL?: string
  readonly PUBLIC_ANALYTICS_URL?: string
  readonly PUBLIC_NEWSLETTER_URL?: string
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_ANON_KEY?: string
}

declare module '@tabler/icons-astro/dist/esm/icons/*.mjs' {
  import type { IconBook } from '@tabler/icons-astro'

  const icon: typeof IconBook
  export default icon
}
