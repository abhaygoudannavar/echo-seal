'use client';

import { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import Link from 'next/link';

export default function Navbar() {
    

    useEffect(() => {
        const updateNavbarColor = () => {
            const navbar = document.querySelector('.navbar');
            if (!navbar) return;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const heroHeight = window.innerHeight * 0.85;
            if (scrollY > heroHeight) {
                navbar.classList.remove('on-dark');
                navbar.classList.add('on-light');
            } else {
                navbar.classList.remove('on-light');
                navbar.classList.add('on-dark');
            }
        };
        window.addEventListener('scroll', updateNavbarColor);
        updateNavbarColor();
        return () => window.removeEventListener('scroll', updateNavbarColor);
    }, []);

    

    return (
        <nav className="navbar on-dark">
            {/* Left side */}
            <div className="nav-left" style={{ display: 'flex', alignItems: 'center' }}>
                <Link href="/" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 800, fontSize: '1.2rem', marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ backgroundColor: '#000', padding: '4px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/assets/logo.png" id="main-logo-img" alt="EchoSeal Logo" style={{ height: '35px', width: 'auto', mixBlendMode: 'screen' }} />
                    </div>
                </Link>
            </div>

            {/* Center - EchoSeal logo (hidden visually, kept for TransitionScribble) */}
            <div className="nav-center">
                <svg className="logo-echoseal" width="300" height="80" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ visibility: 'hidden' }}>
                    <text x="15" y="60" fill="currentColor" fontFamily="'Caveat', cursive" fontSize="64" fontWeight="bold">EchoSeal</text>
                </svg>
            </div>

            {/* Right side - Navigation */}
            <div className="nav-right" style={{ display: 'flex', gap: '24px', alignItems: 'center', position: 'relative', marginRight: '20px' }}>
                <a href="#how-it-works" style={{ textDecoration: 'none', color: '#000', backgroundColor: '#fff', fontWeight: 600, padding: '8px 20px', borderRadius: '50px', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', pointerEvents: 'auto' }}>How it works</a>
            </div>
        </nav>
    );
}
