'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

/* Splash screen, shown once per session.
 *
 * Deliberately once: a verification tool people may reach mid-scam-call should not
 * make them sit through an animation every visit. sessionStorage rather than
 * localStorage so it still shows to a judge opening a fresh window.
 *
 * Anyone arriving on a deep link (/verify) skips it entirely. They came for the
 * tool, not the title card.
 */
const SEEN_KEY = 'echoseal.intro';
const WORD = 'ECHOSEAL';

export default function IntroScreen() {
  const [show, setShow] = useState(false);
  const root = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (window.location.pathname !== '/') return;
    // Respect a stated preference for less motion: skip straight to the site.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* Private windows throw; showing the intro once is harmless. */
    }
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;

    const el = root.current;
    document.body.style.overflow = 'hidden';

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let waveOpacity = 0;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // A waveform, because the product is about audio. Two mirrored traces with an
    // envelope so it reads as speech rather than a sine generator.
    const draw = (t) => {
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      ctx.clearRect(0, 0, w, h);
      const cy = h / 2;
      const seg = 120;

      const trace = (scale, width, alpha) => {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        for (let k = 0; k <= seg; k++) {
          const n = k / seg;
          const env = Math.sin(n * Math.PI);
          const v =
            Math.sin(n * 8 + t * 0.002) * 25 +
            Math.sin(n * 14 - t * 0.003) * 12 +
            Math.sin(n * 22 + t * 0.0015) * 6 +
            Math.sin(n * 3.5 + t * 0.001) * Math.sin(n * 7 + t * 0.0008) * 20;
          ctx.lineTo((k * w) / seg, cy + v * env * waveOpacity * scale);
        }
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, 'rgba(134,201,160,0)');
        g.addColorStop(0.5, `rgba(134,201,160,${alpha})`);
        g.addColorStop(1, 'rgba(134,201,160,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      trace(1, 1.5, 0.5);
      trace(-0.4, 1, 0.15);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(q('.intro__orb'), { opacity: 1, duration: 1.6, stagger: 0.25 }, 0);
    tl.to(canvas, { opacity: 0.6, duration: 1.2 }, 0.4);
    tl.to({}, { duration: 1.2, onUpdate() { waveOpacity = this.progress(); } }, 0.4);
    tl.to(q('.intro__scanline'), { opacity: 1, duration: 0.1 }, 0.7);
    tl.to(q('.intro__scanline'), { top: '100%', duration: 1.1, ease: 'power2.inOut' }, 0.7);
    tl.to(q('.intro__scanline'), { opacity: 0, duration: 0.2 }, 1.7);
    tl.to(q('.intro__logo'), { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.6)' }, 0.9);
    tl.to(q('.intro__char'), {
      opacity: 1, y: '0%', rotateX: 0, duration: 0.8, ease: 'back.out(1.4)', stagger: 0.05,
    }, 1.2);
    tl.to(q('.intro__subtitle'), { opacity: 1, y: 0, duration: 0.7 }, 1.8);
    tl.to(q('.intro__line'), { width: 200, duration: 0.7, ease: 'power2.inOut' }, 2.0);
    tl.to(q('.intro__enter'), { opacity: 1, y: 0, duration: 0.7 }, 2.2);

    const orbs = q('.intro__orb');
    const floats = orbs.map((o, i) =>
      gsap.to(o, {
        x: (i % 2 ? -25 : 30), y: (i % 2 ? -15 : 20),
        duration: 8 + i * 2, ease: 'sine.inOut', yoyo: true, repeat: -1,
      })
    );

    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      tl.kill();
      floats.forEach((f) => f.kill());
      document.body.style.overflow = '';
    };
  }, [show]);

  function dismiss() {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* not persisting is fine */
    }
    // The overlay covers the whole page, so a fade that never completes would trap
    // the visitor with no way through. Hide unconditionally after the fade's
    // duration regardless of whether GSAP reports back.
    const hide = () => setShow(false);
    setTimeout(hide, 600);
    if (root.current) {
      gsap.to(root.current, { opacity: 0, duration: 0.5, ease: 'power2.inOut', onComplete: hide });
    } else {
      hide();
    }
  }

  if (!show) return null;

  return (
    <div className="intro" ref={root} role="dialog" aria-label="Introduction">
      <div className="intro__bg" aria-hidden="true">
        <span className="intro__orb intro__orb--1" />
        <span className="intro__orb intro__orb--2" />
        <span className="intro__orb intro__orb--3" />
      </div>
      <span className="intro__scanline" aria-hidden="true" />
      <canvas className="intro__waveform" ref={canvasRef} aria-hidden="true" />

      <div className="intro__content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="intro__logo" src="/img/logo.png" alt="" width="72" height="72" />
        <h1 className="intro__title" aria-label="EchoSeal">
          {WORD.split('').map((c, i) => (
            <span className="intro__char" key={i} aria-hidden="true">{c}</span>
          ))}
        </h1>
        <p className="intro__subtitle">Zero trust voice provenance</p>
        <span className="intro__line" aria-hidden="true" />
        <button className="intro__enter" type="button" onClick={dismiss} autoFocus>
          Enter
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <span className="intro__corner intro__corner--left">WeMakeDevs First Commit</span>
      <span className="intro__corner intro__corner--right">AudioSeal · AWS</span>
    </div>
  );
}
