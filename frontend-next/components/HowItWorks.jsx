'use client';
import React from 'react';

export default function HowItWorks() {
    return (
        <section id="how-it-works" style={{ padding: '100px 20px', backgroundColor: 'var(--color-black-deep)', color: 'var(--color-white)', fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                    
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>What we do <br/><span style={{ color: 'var(--color-pink)' }}>and don't do</span></h2>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <li style={{ fontSize: '1.1rem' }}>✅ <strong>We do:</strong> Apply invisible cryptographic watermarks to synthetic voices.</li>
                            <li style={{ fontSize: '1.1rem' }}>✅ <strong>We do:</strong> Let you verify if an audio clip belongs to a registered agent.</li>
                            <li style={{ fontSize: '1.1rem' }}>✅ <strong>We do:</strong> Protect organizations from being impersonated by scammers.</li>
                            <li style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)' }}>❌ <strong>We don't:</strong> Store audio recordings or personal identifying information.</li>
                            <li style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)' }}>❌ <strong>We don't:</strong> Detect deepfakes using probabilistic AI models.</li>
                        </ul>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: '2.5rem', fontWeight: 800, marginBottom: '20px' }}>Basically <br/><span style={{ color: '#4ade80' }}>how it works</span></h2>
                        <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <li style={{ fontSize: '1.1rem' }}><strong>Register:</strong> Your organization registers an AI agent with EchoSeal.</li>
                            <li style={{ fontSize: '1.1rem' }}><strong>Generate:</strong> We apply an inaudible watermark directly into the audio payload before it leaves the server.</li>
                            <li style={{ fontSize: '1.1rem' }}><strong>Verify:</strong> A customer records a snippet of the phone call and uploads it to our Zero-Trust verification portal.</li>
                            <li style={{ fontSize: '1.1rem' }}><strong>Confirm:</strong> We instantly check if the audio carries the unique signature of the registered organization.</li>
                        </ol>
                    </div>

                </div>
            </div>
        </section>
    );
}
