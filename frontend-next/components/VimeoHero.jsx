'use client';

import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function VimeoHero() {
    const iframeRef = useRef(null);
    const playerRef = useRef(null);
    const bubbleRef = useRef(null);
    const titleRef = useRef(null);
    const controlsRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);

    useEffect(() => {
        const bubble = bubbleRef.current;
        const hero = playerRef.current;
        const title = titleRef.current;
        const controls = controlsRef.current;
        if (!bubble || !hero) return;

        gsap.set(bubble, { xPercent: -50, yPercent: -50 });
        const xTo = gsap.quickTo(bubble, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        const yTo = gsap.quickTo(bubble, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.3)' });

        let isOverElement = false;

        const onMouseMove = (e) => { xTo(e.clientX); yTo(e.clientY); };
        const onMouseEnter = () => {
            if (isOverElement) return;
            gsap.to(bubble, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
        };
        const onMouseLeave = () => {
            gsap.to(bubble, { scale: 0, rotation: -30, opacity: 0, duration: 0.3, ease: 'power2.in' });
        };

        hero.addEventListener('mousemove', onMouseMove);
        hero.addEventListener('mouseenter', onMouseEnter);
        hero.addEventListener('mouseleave', onMouseLeave);

        const hideBubble = () => {
            isOverElement = true;
            gsap.to(bubble, { scale: 0, rotation: -30, opacity: 0, duration: 0.3, ease: 'power2.in' });
        };
        const showBubble = () => {
            isOverElement = false;
            gsap.to(bubble, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
        };

        if (title) { title.addEventListener('mouseenter', hideBubble); title.addEventListener('mouseleave', showBubble); }
        if (controls) { controls.addEventListener('mouseenter', hideBubble); controls.addEventListener('mouseleave', showBubble); }

        return () => {
            hero.removeEventListener('mousemove', onMouseMove);
            hero.removeEventListener('mouseenter', onMouseEnter);
            hero.removeEventListener('mouseleave', onMouseLeave);
            if (title) { title.removeEventListener('mouseenter', hideBubble); title.removeEventListener('mouseleave', showBubble); }
            if (controls) { controls.removeEventListener('mouseenter', hideBubble); controls.removeEventListener('mouseleave', showBubble); }
        };
    }, []);

    const toggleMute = () => setIsMuted((m) => !m);

    return (
        <>
            {/* Mute bubble — fixed position, follows cursor */}
            <div
                ref={bubbleRef}
                className={`vimeo-mute-bubble ${isMuted ? 'is--muted' : 'is--unmuted'}`}
            >
                <div className="vimeo-mute-bubble__blob">
                    <img src="/assets/VimeoHero SVG/mute-bubble-blob.svg" alt="" className="vimeo-mute-bubble__blob-svg" />
                    <div className="vimeo-mute-bubble__icon vimeo-mute-bubble__mute">
                        <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.38 8.5C12.89 7.93 13.74 7.84 14.36 8.27l.13.14L52 41.92l.12.1c.5.57.5 1.41 0 1.98-.52.58-1.38.66-2 .22L44.99 39.65c-.73 1.04-1.55 2.01-2.44 2.91a1.5 1.5 0 0 1-2.12-2.12c.86-.86 1.63-1.8 2.31-2.8l-4.92-4.39a9.47 9.47 0 0 1-1.99 2.6 1.5 1.5 0 0 1-2.12-2.12c.73-.73 1.35-1.59 1.81-2.53L29 25.36v18.14a2 2 0 0 1-3.31 1.26L14.68 37.08a.5.5 0 0 0-.27-.08H8.5A3.5 3.5 0 0 1 5 33.5v-13A3.5 3.5 0 0 1 8.5 17h5.92a.5.5 0 0 0 .27-.08l2.84-1.82-5.02-4.48-.11-.11c-.51-.56-.52-1.43-.02-2.01Z" fill="currentColor"/>
                            <path d="M40.43 11.44a1.5 1.5 0 0 1 2.12 0A22.44 22.44 0 0 1 49 27c0 2.5-.42 4.91-1.19 7.15l-2.46-2.2A19.48 19.48 0 0 0 46 27a19.44 19.44 0 0 0-5.57-13.44 1.5 1.5 0 0 1 0-2.12Z" fill="currentColor"/>
                            <path d="M33.72 18.16a1.5 1.5 0 0 1 2.12 0 12.46 12.46 0 0 1 3.66 8.56l-3.7-3.3a9.46 9.46 0 0 0-2.08-3.14 1.5 1.5 0 0 1 0-2.12Z" fill="currentColor"/>
                            <path d="M26.69 9.24A2 2 0 0 1 29 10.5v6.85l-6.25-5.59 3.94-2.52Z" fill="currentColor"/>
                        </svg>
                    </div>
                    <div className="vimeo-mute-bubble__icon vimeo-mute-bubble__unmute">
                        <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M29 10.5a2 2 0 0 0-3.31-1.26L14.68 16.92a.5.5 0 0 1-.27.08H8.5A3.5 3.5 0 0 0 5 20.5v13A3.5 3.5 0 0 0 8.5 37h5.92a.5.5 0 0 1 .27.08l12.01 7.68A2 2 0 0 0 29 43.5v-33Z" fill="currentColor"/>
                            <path d="M40.44 11.44a1.5 1.5 0 0 1 2.12 0 22.44 22.44 0 0 1 0 31.11 1.5 1.5 0 0 1-2.12-2.12 19.44 19.44 0 0 0 0-26.87 1.5 1.5 0 0 1 0-2.12Z" fill="currentColor"/>
                            <path d="M35.84 18.16a1.5 1.5 0 0 0-2.12 2.12 9.47 9.47 0 0 1 0 13.44 1.5 1.5 0 0 0 2.12 2.12 12.47 12.47 0 0 0 0-17.68Z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Main hero container */}
            <div
                className={`vimeo-hero ${isPlaying ? 'is-playing' : 'is-paused'} ${isMuted ? 'is-muted' : 'is-unmuted'}`}
                ref={playerRef}
                onClick={toggleMute}
            >
                <video
                    ref={iframeRef}
                    autoPlay loop muted playsInline
                    className="vimeo-hero__iframe"
                    style={{ objectFit: 'cover', backgroundColor: '#111' }}
                />

                <div className="vimeo-hero__fade" />

                {/* EchoSeal Hero Title — centered */}
                <div className="home-header__title" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
                    <h1 className="vimeo-hero__title" ref={titleRef} onClick={(e) => e.stopPropagation()}>
                        <span className="vimeo-hero__word is--relative">
                            <span>Echo</span>
                            <span className="home-header__smiley">
                                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="home-header__smiley-svg">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.82.37 1.85.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.96.33 1.99.58 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                            </span>
                        </span>
                        <span className="vimeo-hero__word is--relative">
                            <span className="home-header__star">
                                <span className="home-header__star-inner">
                                    <img src="/assets/VimeoHero SVG/pink-star.svg" alt="" className="home-header__star-svg" />
                                </span>
                            </span>
                            <img src="/assets/VimeoHero SVG/oval-underline.svg" alt="" className="home-header__title-line-svg" />
                            <span>Seal</span>
                        </span>
                    </h1>
                    <div className="hero-action-buttons" style={{ position: 'relative', display: 'flex', gap: '20px', zIndex: 100, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <a href="/verify" onClick={(e) => { e.preventDefault(); window.location.href = '/verify'; }} style={{ padding: '15px 30px', background: 'var(--color-black)', color: 'var(--color-white)', borderRadius: '30px', textDecoration: 'none', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'Epilogue, sans-serif' }}>Check Recording</a>
                        <a href="/generate" onClick={(e) => { e.preventDefault(); window.location.href = '/generate'; }} style={{ padding: '15px 30px', background: 'var(--color-white)', color: 'var(--color-black)', borderRadius: '30px', textDecoration: 'none', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'Epilogue, sans-serif' }}>Get Watermarked</a>
                    </div>
                </div>

                <div ref={controlsRef} style={{ display: 'none' }} />
            </div>
        </>
    );
}
