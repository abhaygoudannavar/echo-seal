// Single source of truth for absolute URLs in metadata.
//
// MUST be replaced with the real Amplify domain before launch: canonical links
// and og:image are absolute, and a wrong value makes search engines index the
// wrong host and breaks every social preview.
export const SITE_URL = 'https://echoseal.example';

export const API_URL = 'https://mzvlf6prc2.execute-api.ap-south-1.amazonaws.com';

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
