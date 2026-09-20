'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const developers = [
  {
    name: "Sahana KB",
    role: "ML/Audio — AudioSeal watermark embed/detect + the phone re-recording test",
    image: "/assets/sahana-kb.png"
  },
  {
    name: "Abhay Goudannavar",
    role: "Frontend — Amplify web app (Agent Console + Verify a Call)",
    image: "/assets/abhay-goudannavar.png"
  },
  {
    name: "Lavanya Yadwad",
    role: "AWS Backend — Lambda, API Gateway, DynamoDB, S3",
    image: "/assets/lavanya-yadwad.png"
  },
  {
    name: "Suhaan Raqeeb Kavas",
    role: "Polly integration + end-to-end testing + demo video + writeup",
    image: "/assets/suhaan-raqeeb-kavas.png"
  }
];

export default function ServiceCards() {
    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        // Animate underline SVG paths on scroll
        gsap.to('.title-underline-svg path', {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: 'power3.out',
            stagger: 0.3,
            scrollTrigger: {
                trigger: '.service-cards-wrapper',
                start: 'top 70%',
                toggleActions: 'play none none reverse'
            }
        });
    }, []);

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px'
    };

    return (
        <section className="service-cards-wrapper" style={{ padding: '80px 0', backgroundColor: 'var(--bg-color)', width: '100%' }}>
            {/* ─── "meet the Developers:" Heading ─── */}
            <div className="title-container" style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h2 className="main-title" style={{ fontSize: '3rem', fontFamily: 'Epilogue, sans-serif', fontWeight: 800, margin: 0 }}>
                    meet the <span className="italic-text" style={{ fontStyle: 'italic' }}>Developers:</span>
                </h2>
                <svg xmlns="http://www.w3.org/2000/svg" width="160" viewBox="0 0 159 17" fill="none" className="title-underline-svg" style={{ margin: '10px auto 0', display: 'block' }}>
                    <path d="M1 12.1515C53.0771 5.7187 105.529 2.30552 158 1.93652" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 160, strokeDashoffset: 160 }}></path>
                    <path d="M30.2672 15.9461C64.1899 12.8158 98.2663 11.3583 132.33 11.5735" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 160, strokeDashoffset: 160 }}></path>
                </svg>
            </div>

            {/* ─── Developers Grid ─── */}
            <div style={gridStyle}>
                {developers.map((dev) => (
                    <div key={dev.name} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* Image Container */}
                        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: '12px', backgroundColor: '#e0e0e0' }}>
                            <img
                                src={dev.image}
                                alt={dev.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%)' }}
                                loading="lazy"
                            />
                        </div>
                        
                        {/* Text Container */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Epilogue, sans-serif', margin: 0, color: 'var(--color-dark)', lineHeight: 1.2 }}>
                                {dev.name}
                            </h3>
                            <p style={{ fontSize: '0.95rem', color: '#555', fontFamily: 'Epilogue, sans-serif', lineHeight: 1.5, margin: 0 }}>
                                {dev.role}
                            </p>
                        </div>

                    </div>
                ))}
            </div>
        </section>
    );
}
