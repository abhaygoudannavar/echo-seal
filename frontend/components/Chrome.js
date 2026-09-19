'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 10h1.6l1.3-3.2 1.9 6.4 1.3-3.2h2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
