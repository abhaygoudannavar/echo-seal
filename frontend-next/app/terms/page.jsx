import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Terms() {
    return (
        <div style={{ backgroundColor: 'var(--color-white)', color: 'var(--color-dark)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header className="main-header" style={{ position: 'relative', background: 'var(--color-dark)' }}>
                <Navbar />
            </header>
            <main style={{ flex: 1, padding: '100px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Epilogue, sans-serif', width: '100%' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '40px', fontWeight: 800 }}>Terms and Conditions</h1>
                <div className="terms-content">
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}><em>Last Updated: September 20, 2026</em></p>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>Welcome to Echo Seal. By accessing or using our website and services, you agree to comply with and be bound by the following Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>1. Acceptance of Terms</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>By accessing Echo Seal, you confirm that you are legally capable of entering into a binding contract and agree to these Terms.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>2. Description of Service</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>Echo Seal provides tools and services related to media analysis, including the detection of synthetic media or "deepfakes." Due to the evolving nature of artificial intelligence, our detection results are provided for informational purposes only and should not be considered definitive legal or forensic evidence.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>3. User Responsibilities and Acceptable Use</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '10px' }}>When using our services, you agree not to:</p>
                    <ul style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px', paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '10px' }}>Upload content that violates the intellectual property, privacy, or publicity rights of any third party.</li>
                        <li style={{ marginBottom: '10px' }}>Use the service for any illegal, harmful, or malicious activities.</li>
                        <li style={{ marginBottom: '10px' }}>Attempt to reverse-engineer, disrupt, or compromise the integrity of our detection algorithms or website infrastructure.</li>
                    </ul>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>4. User Uploads and Intellectual Property</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '10px' }}>You retain all ownership rights to the media files you upload for analysis. By uploading files, you grant Echo Seal a temporary, secure license solely to process and analyze the content to provide you with the requested service.</p>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>All original content, branding, website design, and underlying technology of Echo Seal remain the exclusive property of its creators.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>5. Disclaimer of Warranties</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>Echo Seal is provided on an "as-is" and "as-available" basis. We make no warranties, express or implied, regarding the absolute accuracy, reliability, or continuous availability of our detection tools.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>6. Limitation of Liability</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>To the maximum extent permitted by law, Echo Seal and its creators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, the results provided, or your inability to access the platform.</p>
                    
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '30px', marginBottom: '10px' }}>7. Changes to Terms</h3>
                    <p style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '20px' }}>We reserve the right to modify these terms at any time. Continued use of the platform after changes implies your acceptance of the updated terms.</p>
                </div>
            </main>
            <footer className="main-footer" style={{ background: 'var(--color-dark)' }}>
                <Footer />
            </footer>
        </div>
    );
}
