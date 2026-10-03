const HOST_LABELS: Record<string, string> = {
  'alltrails.com': 'AllTrails',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'x.com': 'Twitter',
  'twitter.com': 'Twitter',
}

export function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')

    return HOST_LABELS[host] ?? host
  } catch {
    return 'Visit'
  }
}
