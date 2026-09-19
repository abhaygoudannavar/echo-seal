'use client';

import { useRef, useState } from 'react';
import { toWav, toBase64 } from '../lib/wav';
import { postJson } from '../lib/api';
import Result from './Result';

const MAX_BYTES = 25 * 1024 * 1024;

export default function VerifyForm() {
  const fileRef = useRef(null);
  const recordedRef = useRef(null);
  const recorderRef = useRef(null);

  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordState, setRecordState] = useState('');
  const [result, setResult] = useState(null);

  // Recording is only offered where it can work. Checked lazily so this does not
  // run during the static export, where navigator does not exist.
  const canRecord =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder;

  function onFileChange() {
    setFileError('');
    recordedRef.current = null;
    const f = fileRef.current?.files?.[0];
    if (f && f.size > MAX_BYTES) {
      setFileError('That file is larger than 25 MB. Trim it to the part with speech.');
    }
  }

  async function toggleRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recordedRef.current = new Blob(chunks, { type: rec.mimeType });
        if (fileRef.current) fileRef.current.value = '';
        setFileError('');
        setRecording(false);
        setRecordState('Recording captured. Select Check this call.');
      };
      rec.start();
      setRecording(true);
      setRecordState('Recording. Play the call audio now.');
    } catch {
      setRecording(false);
      setRecordState(
        'Microphone access was refused, so recording is unavailable. Upload a file instead.'
      );
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFileError('');
    setResult(null);

    const source = recordedRef.current || fileRef.current?.files?.[0];
    if (!source) {
      setFileError('Choose an audio file or record the call first.');
      fileRef.current?.focus();
      return;
    }
    if (source.size > MAX_BYTES) {
      setFileError('That file is larger than 25 MB. Trim it to the part with speech.');
      return;
    }

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
    <div className="panel" style={{ marginTop: '1.75rem' }}>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="audio-file">Recording</label>
          <input
            type="file"
            id="audio-file"
            ref={fileRef}
            onChange={onFileChange}
            accept="audio/*,.wav,.m4a,.mp3,.ogg,.webm,.aac,.caf"
            aria-invalid={fileError ? 'true' : 'false'}
            aria-describedby="audio-file-error"
          />
          <p className="field-error" id="audio-file-error" role="alert" aria-live="polite">
            {fileError}
          </p>
          <p className="hint">
            Any common audio format, up to 25 MB. It is converted in your browser before
            sending, so large files upload quickly.
          </p>
        </div>

        {canRecord ? (
          <div className="field">
            <span className="visually-hidden" id="record-label">
              Record the call audio
            </span>
            <label htmlFor="record-btn">Or record it now</label>
            <div className="btn-row">
              <button
                className="btn btn-secondary"
                type="button"
                id="record-btn"
                onClick={toggleRecording}
              >
                {recording ? 'Stop recording' : recordedRef.current ? 'Record again' : 'Start recording'}
              </button>
              <span className="hint" aria-live="polite" style={{ margin: 0 }}>
                {recordState}
              </span>
            </div>
            <p className="hint">
              Play the call on a speaker and hold this device near it. The watermark
              survives being played and re-recorded.
            </p>
          </div>
        ) : null}

        <div className="btn-row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Checking
              </>
            ) : (
              'Check this call'
            )}
          </button>
        </div>
      </form>

      {result ? (
        <Result state={result.state} title={result.title} meta={result.meta}>
          <p>{result.body}</p>
        </Result>
      ) : null}
    </div>
  );
}
