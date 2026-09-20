'use client';

import React, { useState } from 'react';
import { postJson } from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../styles/generate.css';
import '../globals.css';

export default function GeneratePage() {
    const [agentId, setAgentId] = useState('0');
    const [text, setText] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const MAX_CHARS = 600;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);

        // Honeypot: a real person never sees this field, so anything in it is a bot.
        if (honeypot) return;

        const trimmedText = text.trim();
        if (!trimmedText) {
            setError('Enter the words the assistant should say.');
            return;
        }
        if (trimmedText.length > MAX_CHARS) {
            setError(`Keep it under ${MAX_CHARS} characters. That is ${trimmedText.length}.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const data = await postJson('/generate', {
                agent_id: Number(agentId),
                text: trimmedText,
            });

            setResult({
                state: 'success',
                entity_name: data.entity_name,
                audio_url: data.audio_url,
                agent_id: data.agent_id
            });
        } catch (err) {
            setResult({
                state: 'error',
                title: 'Could not generate that audio',
                detail: err.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main>
            <Navbar />
            <div className="generate-page">
                <div className="generate-container">
                    <h1 className="generate-title">Generate Audio</h1>
                    <p className="generate-subtitle">Create a watermarked speech payload for a simulated agent.</p>
                    
                    <form className="generate-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label htmlFor="agent-id">Registered organisation</label>
                            <select 
                                id="agent-id" 
                                value={agentId} 
                                onChange={(e) => setAgentId(e.target.value)}
                            >
                                <option value="0">SecureBank AI Assistant</option>
                                <option value="2047">Example Telecom Support</option>
                            </select>
                            <p className="hint">
                                Two demonstration entries to test distinct identifier recovery.
                            </p>
                        </div>

                        <div className="field">
                            <label htmlFor="speech-text">What the assistant says</label>
                            <textarea 
                                id="speech-text" 
                                maxLength={MAX_CHARS}
                                placeholder="This is SecureBank calling about a recent transaction on your account."
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setError('');
                                }}
                                aria-invalid={!!error}
                            />
                            {error && <p className="field-error" role="alert">{error}</p>}
                            <p className="hint">Up to 600 characters. Spoken by Amazon Polly, then watermarked.</p>
                        </div>

                        {/* Honeypot Field */}
                        <div className="field" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
                            <label htmlFor="company-website">Company website</label>
                            <input 
                                type="text" 
                                id="company-website" 
                                tabIndex="-1" 
                                autoComplete="off"
                                value={honeypot}
                                onChange={(e) => setHoneypot(e.target.value)}
                            />
                        </div>

                        <button type="submit" className="btn" disabled={isSubmitting}>
                            {isSubmitting ? <><span className="spinner" /> Generating...</> : 'Generate watermarked audio'}
                        </button>
                    </form>

                    {result && result.state === 'success' && (
                        <div className="generate-result" data-state="success">
                            <p className="result-title">Watermarked as {result.entity_name}</p>
                            <p style={{marginBottom: '10px'}}>Play this through a speaker and record it on a phone, then check it on the Verify page. The watermark survives that round trip.</p>
                            <audio className="audio-player" controls src={result.audio_url}></audio>
                            <p className="result-meta">agent {result.agent_id} · 16 kHz mono · link expires in 1 hour</p>
                        </div>
                    )}

                    {result && result.state === 'error' && (
                        <div className="generate-result" data-state="error">
                            <p className="result-title">{result.title}</p>
                            <p>{result.detail}</p>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
