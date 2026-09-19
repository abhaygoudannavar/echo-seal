'use client';

import { useState } from 'react';
import { postJson } from '../lib/api';
import Result from './Result';

const MAX_CHARS = 600;

export default function GenerateForm() {
  const [agentId, setAgentId] = useState('0');
  const [text, setText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [textError, setTextError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setTextError('');
    setResult(null);

    // A real person never sees this field, so anything in it is a bot. Silently
    // succeeding would waste Polly spend, so it just stops here.
    if (honeypot) return;

    const value = text.trim();
    if (!value) {
      setTextError('Enter the words the assistant should say.');
      return;
    }
    if (value.length > MAX_CHARS) {
      setTextError(`Keep it under ${MAX_CHARS} characters. That is ${value.length}.`);
      return;
    }

    setBusy(true);
    try {
      const data = await postJson('/generate', { agent_id: Number(agentId), text: value });
      setResult({
        state: 'verified',
        title: `Watermarked as ${data.entity_name}`,
        audio: data.audio_url,
        meta: `agent ${data.agent_id} · 16 kHz mono · link expires in 1 hour`,
      });
    } catch (err) {
      setResult({ state: 'error', title: 'Could not generate that audio', body: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="agent-id">Registered organisation</label>
          <select id="agent-id" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="0">SecureBank AI Assistant</option>
            <option value="2047">Example Telecom Support</option>
          </select>
          <p className="hint">
            Two demonstration entries. The registry holds two because over the air
            re-recording corrupts a few bits of the identifier, and these two are far
            enough apart to stay distinguishable.
          </p>
        </div>

        <div className="field">
          <label htmlFor="speech-text">What the assistant says</label>
          <textarea
            id="speech-text"
            maxLength={MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={textError ? 'true' : 'false'}
            aria-describedby="speech-text-error"
            placeholder="This is SecureBank calling about a recent transaction on your account."
          />
          <p className="field-error" id="speech-text-error" role="alert" aria-live="polite">
            {textError}
          </p>
          <p className="hint">
            Up to {MAX_CHARS} characters. Spoken by Amazon Polly, then watermarked.
          </p>
        </div>

        <div className="field" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
          <label htmlFor="company-website">Company website</label>
          <input
            type="text"
            id="company-website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="btn-row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Generating
              </>
            ) : (
              'Generate watermarked audio'
            )}
          </button>
        </div>
      </form>

      {result ? (
        <Result state={result.state} title={result.title} meta={result.meta}>
          {result.audio ? (
            <>
              <p>
                Play this through a speaker and record it on a phone, then check it on the
                Verify page. The watermark survives that round trip.
              </p>
              <audio controls src={result.audio} style={{ marginTop: '0.75rem', width: '100%' }}>
                Your browser cannot play audio inline. Use the link to download the clip.
              </audio>
            </>
          ) : (
            <p>{result.body}</p>
          )}
        </Result>
      ) : null}
    </div>
  );
}
