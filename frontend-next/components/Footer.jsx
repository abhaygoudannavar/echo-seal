'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SOCIAL_ICONS } from '@/lib/data';

export default function Footer() {
    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        // Sticker pop-in animations on scroll
        const stickers = gsap.utils.toArray('.footer-sticker');
        stickers.forEach((sticker, i) => {
            gsap.fromTo(sticker,
                { scale: 0, opacity: 0, rotation: -20 + Math.random() * 40 },
                {
                    scale: 1, opacity: 1, rotation: 0,
                    duration: 0.8, ease: 'elastic.out(1, 0.4)',
                    scrollTrigger: {
                        trigger: '.footer-bottom',
                        start: 'top 80%',
                        toggleActions: 'play none none reverse'
                    },
                    delay: i * 0.12
                }
            );
        });
    }, []);

    return (
        <div className="footer-wrapper">
            {/* Top info row */}
            <div className="footer-top">
                <div className="footer-col">
                </div>
            </div>

            {/* Big EchoSeal wordmark */}
            <div className="footer-bottom">
                <div className="footer-big-text">
                    <h2 className="footer-echoseal-wordmark">EchoSeal</h2>
                </div>

                {/* Credits */}
                <div className="footer-bottom-row">
                    <div></div>
                    <div className="footer-credits-wrapper" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: '20px' }}>
                        <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                            <a href="/terms" style={{color: '#000', opacity: 0.8, textDecoration: 'none', fontFamily: 'Epilogue, sans-serif', fontSize: '1rem'}}>Terms and Conditions</a>
                            <a href="/privacy" style={{color: '#000', opacity: 0.8, textDecoration: 'none', fontFamily: 'Epilogue, sans-serif', fontSize: '1rem'}}>Privacy Policy</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
