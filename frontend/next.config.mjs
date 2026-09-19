/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: every route is prerendered to HTML at build time, so per-page
  // meta tags exist in the served markup. Social card scrapers do not run
  // JavaScript, so a client-rendered SPA cannot have per-page previews.
  output: 'export',
  // Amplify serves /verify/index.html for /verify with this on.
  trailingSlash: true,
  images: { unoptimized: true },
  // Pin the workspace root: there is a stray package-lock.json in the home
  // directory that Next would otherwise infer as the root.
  outputFileTracingRoot: import.meta.dirname,
};
export default nextConfig;
