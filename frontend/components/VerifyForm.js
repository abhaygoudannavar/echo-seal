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

export default function VerifyForm() {
  const fileRef = useRef(null);
  const recordedRef = useRef(null);
  const recorderRef = useRef(null);

  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordState, setRecordState] = useState('');
  // Held in state (not a ref) so the meter mounts as soon as capture starts.
  const [stream, setStream] = useState(null);
  // 'quiet' | 'good' | 'loud' from the meter, so the level target is visible
  // rather than something to guess at.
  const [level, setLevel] = useState('quiet');
  const [result, setResult] = useState(null);
  // DEBUG: object URL of the converted WAV actually sent to the API.
  const [debugUrl, setDebugUrl] = useState(null);

  // Recording is only offered where it can work, but the capability check must
  // happen after mount rather than during render: navigator does not exist during
  // the static export, so a render-time check makes the server emit markup without
  // this block while the client emits it with, which is a hydration mismatch.
  // Starting false means both renders agree, then it flips on once mounted.
  const [canRecord, setCanRecord] = useState(false);

  useEffect(() => {
    setCanRecord(!!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder);
  }, []);

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
      // These three are ON by default and each one destroys the watermark.
      // getUserMedia is tuned for voice calls: noise suppression strips low-level
      // content, which is precisely what a mark sitting 29 dB under the speech is,
      // and echo cancellation actively subtracts audio the machine is playing.
      // Measured elsewhere in this project: iPhone spatial audio, which applies the
      // same class of processing, drove detection to exactly 0.0000.
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
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
        recordedRef.current = new Blob(chunks, { type: rec.mimeType });
        if (fileRef.current) fileRef.current.value = '';
        setFileError('');
        setRecording(false);
        setRecordState('Recording captured. Select Check this call.');
      };
      setLevel('quiet');
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
      // DEBUG: keep the exact bytes that were sent, so a failing capture can be
      // downloaded and measured offline. Remove once recording is confirmed working.
      setDebugUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(wav);
      });
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
        // A watermark is present but its identifier did not survive intact, so it
        // matched no registered organisation. Reporting this as "no watermark" would
        // be wrong and would hide the real cause, which is almost always a distorted
        // or clipped recording.
        setResult({
          state: 'unverified',
          title: 'Watermark detected, but the sender could not be identified',
          body:
            'A watermark is present, but too damaged to match a registered organisation. ' +
            'This usually means the recording was too loud and clipped. Lower the playback ' +
            'volume, move the microphone further away, and record it again.',
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
            {recording && stream ? (
              <>
                <LevelMeter stream={stream} onLevel={setLevel} />
                {level === 'loud' ? (
                  <p className="field-error" role="alert" style={{ minHeight: 0 }}>
                    Too loud. Peaks are clipping, which corrupts the watermark. Turn the
                    volume down or move further away.
                  </p>
                ) : level === 'quiet' ? (
                  <p className="hint" role="status" style={{ margin: 0 }}>
                    Too quiet. Turn the volume up or move closer, until the bars fill
                    roughly half the height.
                  </p>
                ) : (
                  <p className="hint" role="status" style={{ margin: 0, color: 'var(--accent)' }}>
                    Level looks good. Keep it here.
                  </p>
                )}
              </>
            ) : null}
            <p className="hint">
              Play the call on a speaker and hold this device near it. The watermark
              survives being played and re-recorded. If the bars stay flat, the
              microphone is not hearing the playback.
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

      {debugUrl ? (
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          <a href={debugUrl} download="echoseal-captured.wav">
            Download the exact audio that was checked
          </a>{' '}
          (diagnostic)
        </p>
      ) : null}
    </div>
  );
}
