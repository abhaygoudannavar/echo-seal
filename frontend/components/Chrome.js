'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Mark() {
  // Plain <img>: next/image wants a loader and the static export has none, and at
  // 26px a 111 KB PNG is not worth a pipeline.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="brand__logo" src="/img/logo.png" alt="" width="26" height="26" />;
}

/* Client component purely so aria-current tracks the route without every page
   having to pass its own name in. */
export function Header() {
  const path = usePathname();
  const isHome = path === '/';
  const isVerify = path?.startsWith('/verify');

  return (
    <header className="site-head">
      <div className="wrap">
        <Link className="brand" href="/">
          <Mark />
          EchoSeal
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/" aria-current={isHome ? 'page' : undefined}>
            Home
          </Link>
          <Link href="/verify/" aria-current={isVerify ? 'page' : undefined}>
            Verify a call
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <p style={{ margin: 0 }}>Built for the WeMakeDevs First Commit hackathon.</p>
        <nav className="foot-links" aria-label="Footer">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
