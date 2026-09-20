'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function Showreel() {
    const sectionRef = useRef(null);

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);
        
        const texts = gsap.utils.toArray('.showreel__fade-up');
        texts.forEach(text => {
            gsap.fromTo(text, 
                { y: 50, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1, ease: 'power3.out',
                    scrollTrigger: {
                        trigger: text,
                        start: 'top 85%',
                        toggleActions: 'play none none reverse'
                    }
                }
            );
        });
    }, []);

    return (
        <section className="showreel-section" id="showreel-section" ref={sectionRef}>
            <div className="showreel__container">
                <div className="showreel__block showreel__fade-up">
                    <h2 className="showreel__heading">The Age of AI and the Deepfake Threat</h2>
                    <p className="showreel__text">
                        Artificial intelligence has driven incredible human advancement, but it has also handed cybercriminals unprecedented power. As AI generation becomes indistinguishable from reality, corporate fraud has evolved from basic phishing emails to highly sophisticated, real-time voice and video cloning.
                    </p>
                </div>

                <div className="showreel__block showreel__fade-up">
                    <h3 className="showreel__subheading">The $25.6 Million Deepfake Heist</h3>
                    <p className="showreel__text">
                        The ultimate proof of this new threat occurred in February 2024, when a multinational firm in Hong Kong was targeted by a first-of-its-kind AI heist:
                    </p>
                    <ul className="showreel__list">
                        <li><strong>The Setup:</strong> Scammers used advanced AI voice and video cloning to impersonate the company's UK-based Chief Financial Officer.</li>
                        <li><strong>The Call:</strong> A finance employee joined a live video conference filled with familiar faces and voices, all instructing him to execute funds for a "secret transaction."</li>
                        <li><strong>The Loss:</strong> Because the deepfakes were perfectly rendered in real-time, the worker believed the interaction was authentic and authorized 15 transfers totaling $25.6 million.</li>
                        <li><strong>The Discovery:</strong> The massive fraud only came to light a week later when the worker checked directly with the corporate headquarters.</li>
                    </ul>
                </div>

                <div className="showreel__block showreel__fade-up">
                    <h3 className="showreel__subheading">The Problem: Why Current Security Fails</h3>
                    <p className="showreel__text">
                        The traditional way to secure digital media is by attaching metadata, but metadata is useless in the real world—it gets stripped away the moment a file is compressed, downloaded, or transmitted over a phone line. Passive AI detectors also fail because modern deepfakes no longer make obvious robotic mistakes.
                    </p>
                </div>

                <div className="showreel__block showreel__fade-up">
                    <h3 className="showreel__subheading">The Solution: Introducing Echo Seal</h3>
                    <p className="showreel__text">
                        To solve this, we must shift from trying to detect fakes to cryptographically proving reality. Echo Seal is a zero-trust verification platform built on Audio Steganography (inaudible acoustic watermarking).
                    </p>
                    <p className="showreel__text" style={{ marginTop: '1rem' }}>
                        Instead of attaching a vulnerable tag to a file, Echo Seal embeds a cryptographic hash directly into the frequency domain of the audio signal itself. These microscopic mathematical shifts in the sound waves are entirely imperceptible to the human ear, but they act as an indestructible digital passport that survives phone lines, bad connections, and compression.
                    </p>
                    <p className="showreel__text" style={{ marginTop: '1rem' }}>
                        With Echo Seal, organizations don't have to guess if a caller is real. If the audio stream lacks the hidden cryptographic signature, it is instantly flagged as a hostile deepfake—stopping scams before a single dollar is wired.
                    </p>
                </div>
            </div>
        </section>
    );
}