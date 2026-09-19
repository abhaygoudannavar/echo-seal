import './globals.css';
import { Header, Footer } from '../components/Chrome';
import ConsentBanner from '../components/ConsentBanner';
import { SITE_URL } from '../lib/site';

/* metadataBase makes the per-page canonical and og:image values absolute.
   Social card scrapers reject relative image URLs. */
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'EchoSeal: verify an AI voice on a phone call',
    template: '%s | EchoSeal',
  },
  description:
    'Banks watermark their AI voice assistants with EchoSeal. Anyone receiving a call can ' +
    'check the recording and see which registered organisation it came from.',
  icons: { icon: '/img/favicon.svg', apple: '/img/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'EchoSeal',
    images: [{ url: '/img/social-preview.png', width: 1200, height: 630,
               alt: 'EchoSeal: is that voice really your bank?' }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">
          <div className="wrap">{children}</div>
        </main>
        <Footer />
        <ConsentBanner />
      </body>
    </html>
  );
}
