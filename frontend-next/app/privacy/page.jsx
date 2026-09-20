import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Privacy() {
    return (
        <div style={{ backgroundColor: 'var(--color-white)', color: 'var(--color-dark)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header className="main-header" style={{ position: 'relative', background: 'var(--color-dark)' }}>
                <Navbar />
            </header>
            <main style={{ flex: 1, padding: '100px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Epilogue, sans-serif', width: '100%' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '40px', fontWeight: 800 }}>Privacy Policy</h1>
                <div className="privacy-content">
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}><em>Last Updated: September 20, 2026</em></p>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>At Echo Seal, we are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our website.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>1. Information We Collect</h3>
                    <ul style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px', paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '10px' }}><strong>Media Uploads:</strong> To provide our core service, we collect the audio, video, or image files you upload for deepfake analysis.</li>
                        <li style={{ marginBottom: '10px' }}><strong>Usage Data:</strong> We may collect basic, non-identifiable information about how you interact with our website, such as browser type, device information, and time spent on the platform to help us improve performance.</li>
                    </ul>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>2. How We Use Your Data</h3>
                    <ul style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px', paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '10px' }}><strong>Service Delivery:</strong> Uploaded media is processed strictly for the purpose of running our detection algorithms and returning results to you.</li>
                        <li style={{ marginBottom: '10px' }}><strong>Data Retention:</strong> We do not permanently store or claim ownership of the media you upload. Files are retained temporarily on our secure servers only as long as necessary to complete the analysis, after which they are automatically deleted.</li>
                        <li style={{ marginBottom: '10px' }}><strong>Improvement:</strong> We do not use your personal uploads to train our machine learning models without explicit prior consent.</li>
                    </ul>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>3. Data Security</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>We implement industry-standard security measures to protect your data during transmission and processing. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>4. Sharing of Information</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>We do not sell, rent, or trade your personal information or uploaded media to third parties. We may only disclose information if required to do so by law or in response to valid requests by public authorities.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>5. Third-Party Links</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>Our website may contain links to other websites. We are not responsible for the privacy practices or content of those third-party sites.</p>
                </div>
            </main>
            <footer className="main-footer" style={{ background: 'var(--color-dark)' }}>
                <Footer />
            </footer>
        </div>
    );
}
