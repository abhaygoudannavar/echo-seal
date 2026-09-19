import { SITE_URL } from '../lib/site';

// Required by output: 'export' — the route must be resolvable at build time.
export const dynamic = 'force-static';

// Next generates sitemap.xml from this. A .txt copy is written separately in
// public/ because the requirement asked specifically for TXT.
export default function sitemap() {
  const now = new Date();
  return ['/', '/verify/', '/privacy/', '/terms/'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
  }));
}
