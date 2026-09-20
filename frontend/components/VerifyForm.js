'use client';

import { useEffect, useRef, useState } from 'react';
import { toWav, toBase64 } from '../lib/wav';
import { postJson } from '../lib/api';
import Result from './Result';
import LevelMeter from './LevelMeter';

const MAX_BYTES = 25 * 1024 * 1024;
// Mirrors DETECTION_THRESHOLD in the backend's watermark.py. Above this a watermark
// is present; whether it resolves to an organisation is a separate question.
const DETECTION_THRESHOLD = 0.25;

const ACCEPT = 'audio/*,.wav,.m4a,.mp3,.ogg,.webm,.aac,.caf,.qta';

function humanSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function MicIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="5" width="4" height="14" rx="1.2" />
      <rect x="13" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 001.54.84l10-6.5a1 1 0 000-1.68l-10-6.5A1 1 0 008 5.5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default function VerifyForm() {
  const fileRef = useRef(null);
  const recorderRef = useRef(null);

  // The chosen audio, whichever way it arrived. Held in state rather than read off
  // the input on submit, because a recording never touches the input at all.
  const [source, setSource] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordState, setRecordState] = useState('');
  const [stream, setStream] = useState(null);
  const [level, setLevel] = useState('quiet');
  const [result, setResult] = useState(null);

  // Capability check must run after mount: navigator does not exist during the
  // static export, and branching on it during render is a hydration mismatch.
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => {
    setCanRecord(!!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder);
  }, []);

  function accept(file, label) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`That file is ${humanSize(file.size)}. Trim it to the part with speech, under 25 MB.`);
      return;
    }
    setError('');
    setResult(null);
    setSource(file);
    setSourceLabel(label || `${file.name} · ${humanSize(file.size)}`);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // Trust the decoder, not the extension: a mislabelled file still decodes or
    // fails on its own merits, and browsers report inconsistent types for audio.
    accept(file);
  }

  function clearSource() {
    setSource(null);
    setSourceLabel('');
    setError('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function togglePause() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      setPaused(true);
      setRecordState('Paused.');
    } else if (rec.state === 'paused') {
      rec.resume();
      setPaused(false);
      setRecordState('Recording. Play the call now.');
    }
  }

  function stopRecording() {
    // stop() is valid from both the recording and paused states.
    if (recorderRef.current) recorderRef.current.stop();
  }

  async function startRecording() {
    try {
      // All three are ON by default and each destroys the watermark. getUserMedia is
      // tuned for voice calls: noise suppression strips low-level content, which is
      // exactly what a mark 29 dB under the speech is, and echo cancellation
      // subtracts audio the machine is playing.
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      setStream(mediaStream);
      const chunks = [];
      // mediaStream, not the `stream` state: setState is async, so the state
      // variable is still null inside this closure.
      const rec = new MediaRecorder(mediaStream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        mediaStream.getTracks().forEach((t) => t.stop());
        setStream(null);
        setRecording(false);
        setPaused(false);
        const blob = new Blob(chunks, { type: rec.mimeType });
        accept(blob, `Recording · ${humanSize(blob.size)}`);
        setRecordState('Recording captured.');
      };
      setLevel('quiet');
      rec.start();
      setRecording(true);
      setPaused(false);
      setRecordState('Recording. Play the call now.');
    } catch {
      setRecording(false);
      setPaused(false);
      setRecordState('Microphone access was refused. Upload a file instead.');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!source) {
      setError('Add a recording first, either by choosing a file or recording one.');
      return;
    }
    setError('');
    setResult(null);
    setBusy(true);
    try {
      // Everything is converted, including files already named .wav: the extension
      // says nothing reliable about the contents, and the API reads 16 kHz mono
      // PCM only.
      const wav = await toWav(source);
      const wav_base64 = await toBase64(wav);
      const data = await postJson('/verify', { wav_base64 });

      if (data.verified) {
        setResult({
          state: 'verified',
          title: `Verified: ${data.entity_name}`,
          body: 'This recording carries a valid watermark registered to that organisation.',
          meta: `agent ${data.agent_id} · confidence ${Number(data.confidence).toFixed(3)}`,
        });
      } else if (Number(data.confidence) >= DETECTION_THRESHOLD) {
        // A watermark is present but its identifier did not survive intact. Reporting
        // this as "no watermark" would hide the real cause, which is almost always a
        // distorted or clipped recording.
        setResult({
          state: 'unverified',
          title: 'Watermark detected, but the sender could not be identified',
          body:
            'A watermark is present, but too damaged to match a registered organisation. ' +
            'This usually means the recording was too loud and clipped. Lower the volume, ' +
            'move the microphone further away, and try again.',
          meta: `confidence ${Number(data.confidence).toFixed(3)}`,
        });
      } else {
        setResult({
          state: 'unverified',
          title: 'No watermark found',
          body:
            'This audio carries no EchoSeal watermark. That does not prove it is a scam: ' +
            'it may be a human caller, or an organisation that has not registered. Treat it ' +
            'as unverified and confirm through a number you already trust.',
          meta: `confidence ${Number(data.confidence).toFixed(3)}`,
        });
      }
    } catch (err) {
      setResult({ state: 'error', title: 'Could not check that recording', body: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="verify" onSubmit={onSubmit} noValidate>
      {/* The native control is kept for keyboard and assistive tech, and driven by
          the dropzone label. Hiding it with `hidden` would take it out of the
          accessibility tree entirely. */}
      <input
        type="file"
        id="audio-file"
        ref={fileRef}
        className="visually-hidden"
        accept={ACCEPT}
        onChange={(e) => accept(e.target.files?.[0])}
        aria-describedby="audio-file-error"
      />

      {source ? (
        <div className="dropzone dropzone--filled">
          <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span className="dropzone__name">{sourceLabel}</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={clearSource}>
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor="audio-file"
          className={`dropzone${dragging ? ' dropzone--over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <svg className="dropzone__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="dropzone__title">Drop a recording here, or choose a file</span>
          <span className="dropzone__hint">
            Any common audio format, up to 25 MB. It is converted in your browser, so
            large files still upload quickly.
          </span>
        </label>
      )}

      <p className="field-error" id="audio-file-error" role="alert" aria-live="polite">
        {error}
      </p>

      {canRecord ? (
        <>
          <div className="verify__or"><span>or</span></div>

          <div className="verify__record">
            {recording ? (
              <>
                {/* Icon-only, so each carries its own label. aria-pressed would be
                    wrong: these are actions, not a toggle state. */}
                <button
                  className="btn btn-icon btn-secondary"
                  type="button"
                  onClick={togglePause}
                  aria-label={paused ? 'Resume recording' : 'Pause recording'}
                  title={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? <ResumeIcon /> : <PauseIcon />}
                </button>
                <button
                  className="btn btn-icon"
                  type="button"
                  onClick={stopRecording}
                  aria-label="Stop recording"
                  title="Stop"
                >
                  <StopIcon />
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" type="button" onClick={startRecording}>
                <MicIcon />
                Record the call
              </button>
            )}
            {recording && stream && !paused ? (
              <LevelMeter stream={stream} onLevel={setLevel} />
            ) : null}
            <span className="hint" aria-live="polite">{recordState}</span>
          </div>

          {recording && stream ? (
            <>
              {level === 'loud' ? (
                <p className="field-error" role="alert" style={{ minHeight: 0 }}>
                  Too loud. Peaks are clipping, which corrupts the watermark. Turn the
                  volume down or move further away.
                </p>
              ) : level === 'quiet' ? (
                <p className="hint" role="status" style={{ margin: 0 }}>
                  Too quiet. Turn the volume up or move closer, until the bars fill about
                  half the height.
                </p>
              ) : (
                <p className="hint hint--good" role="status" style={{ margin: 0 }}>
                  Level looks good. Keep it here.
                </p>
              )}
            </>
          ) : (
            <p className="hint">
              Play the call on another device and hold this one near it. A Mac cannot
              hear its own speakers, so you need two devices.
            </p>
          )}
        </>
      ) : null}

      <div className="verify__actions">
        <button className="btn btn-lg" type="submit" disabled={busy || !source}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Checking
            </>
          ) : (
            'Check this call'
          )}
        </button>
        {busy ? <span className="hint">This can take up to 30 seconds.</span> : null}
      </div>

      {result ? (
        <Result state={result.state} title={result.title} meta={result.meta}>
          <p>{result.body}</p>
        </Result>
      ) : null}
    </form>
  );
}
