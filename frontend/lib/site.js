// Single source of truth for absolute URLs in metadata.
//
// Canonical links and og:image are absolute, so this must match the domain the
// site is actually served from or search engines index the wrong host and every
// social preview breaks. Update it here and in public/sitemap.txt together.
export const SITE_URL = 'https://main.d2ylqawe7qumqu.amplifyapp.com';

// Deployed API by default. Override to run entirely offline against the local
// Lambda container via backend/local-proxy.mjs, which is the fallback if the
// venue network dies during a demo:
//   NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://mzvlf6prc2.execute-api.ap-south-1.amazonaws.com';

/* A page-level `openGraph` export REPLACES the layout's rather than deep-merging,
   so any page defining its own title silently loses the inherited image. Build
   openGraph through this helper so the image is always present. */
export const OG_IMAGE = {
  url: '/img/social-preview.png',
  width: 1200,
  height: 630,
  alt: 'EchoSeal: is that voice really your bank?',
};

export function openGraph({ title, description, url, type = 'website' }) {
  return { title, description, url, type, siteName: 'EchoSeal', images: [OG_IMAGE] };
}
