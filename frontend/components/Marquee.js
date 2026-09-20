'use client';

import { useEffect, useRef } from 'react';

/* Horizontal marquee whose speed and direction follow the scroll.
 *
 * It drifts on its own so the strip is never dead, and scrolling adds to that
 * drift: down pushes it one way, up the other. Driven by transform in a rAF loop
 * rather than a CSS animation, because a CSS keyframe cannot react to scroll
 * direction.
 *
 * The header and the rest of the page do not move. Only this strip does, which is
 * the point: it reads as a ticker rather than a parallax effect.
 */
const ITEMS = [
  'Inaudible watermark',
  'Survives phone re-recording',
  'Registered senders only',
  'AudioSeal by Meta',
  '16 bit agent identifier',
  'Verified in seconds',
];

export default function Marquee() {
  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let offset = 0;
    let velocity = 0;
    let lastScroll = window.scrollY;
    let raf = 0;

    // Half, because the item list is rendered twice for a seamless wrap.
    const width = () => track.scrollWidth / 2;

    const onScroll = () => {
      const y = window.scrollY;
      velocity += (y - lastScroll) * 0.35;
      lastScroll = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const tick = () => {
      // Constant drift plus whatever the scroll contributed, which decays back to
      // the baseline so the strip settles instead of coasting forever.
      offset -= 0.4 + velocity;
      velocity *= 0.92;

      const w = width();
      if (w > 0) {
        // Wrap in both directions: scrolling up can push offset positive.
        if (offset <= -w) offset += w;
        if (offset > 0) offset -= w;
        track.style.transform = `translate3d(${offset}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track" ref={trackRef}>
        {[0, 1].map((copy) =>
          ITEMS.map((item, i) => (
            <span className="marquee__item" key={`${copy}-${i}`}>
              {item}
              <span className="marquee__dot" />
            </span>
          ))
        )}
      </div>
    </div>
  );
}
