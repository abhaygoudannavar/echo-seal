'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toWav, toBase64 } from '@/lib/audio';
import { postJson } from '@/lib/api';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../styles/verify.css';
import '../globals.css';

export default function VerifyPage() {
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [recordStateMsg, setRecordStateMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [hasMic, setHasMic] = useState(true);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const MAX_BYTES = 25 * 1024 * 1024;

    useEffect(() => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setHasMic(false);
        }
    }, []);

    const handleFileChange = (e) => {
        setError('');
        setResult(null);
        setRecordedBlob(null);
        const f = e.target.files[0];
        if (f && f.size > MAX_BYTES) {
            setError('That file is larger than 25 MB. Trim it to the part with speech.');
            setFile(null);
        } else {
            setFile(f);
        }
    };

    const toggleRecording = async () => {
        setError('');
        setResult(null);

        if (isRecording) {
            mediaRecorderRef.current?.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            
            recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                setRecordedBlob(blob);
                setFile(null);
                setRecordStateMsg('Recording captured. Select Check this call.');
                setIsRecording(false);
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
            setRecordStateMsg('Recording. Play the call audio now.');
        } catch (err) {
            setRecordStateMsg('Microphone access was refused, so recording is unavailable. Upload a file instead.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);

        const source = recordedBlob || file;
        if (!source) {
            setError('Choose an audio file or record the call first.');
            return;
        }
        if (source.size > MAX_BYTES) {
            setError('That file is larger than 25 MB. Trim it to the part with speech.');
            return;
        }

        setIsSubmitting(true);
        try {
            const wav = await toWav(source);
            const wav_base64 = await toBase64(wav);
            const data = await postJson('/verify', { wav_base64 });

            if (data.verified) {
                setResult({
                    state: 'verified',
                    title: `Verified: ${data.entity_name}`,
                    detail: 'This recording carries a valid watermark registered to that organisation.',
                    meta: `agent ${data.agent_id} · confidence ${Number(data.confidence).toFixed(3)}`
                });
            } else {
                setResult({
                    state: 'unverified',
                    title: 'No watermark found',
                    detail: 'This audio carries no EchoSeal watermark. That does not prove it is a scam: it may be a human caller, or an organisation that has not registered. Treat it as unverified and confirm through a number you already trust.',
                    meta: `confidence ${Number(data.confidence).toFixed(3)}`
                });
            }
        } catch (err) {
            setResult({
                state: 'error',
                title: 'Could not check that recording',
                detail: err.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main>
            <Navbar />
            <div className="verify-page">
                <div className="verify-container">
                    <h1 className="verify-title">Verify a Call</h1>
                    <p className="verify-subtitle">Upload an audio file or record directly to check for the EchoSeal watermark.</p>
                    
                    <form className="verify-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label htmlFor="audio-file">Audio file</label>
                            <input 
                                type="file" 
                                id="audio-file" 
                                accept="audio/*, video/*" 
                                onChange={handleFileChange} 
                                aria-invalid={!!error}
                            />
                            {error && <p className="field-error" role="alert">{error}</p>}
                        </div>

                        {hasMic && (
                            <div className="record-btn-wrapper">
                                <p style={{fontWeight: 600}}>Or record live audio:</p>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={toggleRecording}
                                >
                                    {isRecording ? 'Stop recording' : (recordedBlob ? 'Record again' : 'Start recording')}
                                </button>
                                {recordStateMsg && <p style={{fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center'}}>{recordStateMsg}</p>}
                            </div>
                        )}

                        <button type="submit" className="btn" disabled={isSubmitting}>
                            {isSubmitting ? <><span className="spinner" /> Checking...</> : 'Check this call'}
                        </button>
                    </form>

                    {result && (
                        <div className="verify-result" data-state={result.state}>
                            <p className="result-title">{result.title}</p>
                            <p>{result.detail}</p>
                            {result.meta && <p className="result-meta">{result.meta}</p>}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
