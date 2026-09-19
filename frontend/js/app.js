/* EchoSeal frontend logic: generate watermarked speech, and verify a recording. */

import { toWav, toBase64 } from './wav.js';

const API = 'https://mzvlf6prc2.execute-api.ap-south-1.amazonaws.com';

/* A cold Lambda takes ~35 s to answer and API Gateway cuts it off at 30 s, so a
   503 here means "not warm yet" rather than "broken". One quiet retry turns that
   into a slow success instead of a dead end. */
const RETRY_STATUSES = new Set([502, 503, 504]);

async function postJson(path, body, { retry = true } = {}) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (RETRY_STATUSES.has(res.status) && retry) {
    await new Promise((r) => setTimeout(r, 2000));
    return postJson(path, body, { retry: false });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function setBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${busyLabel}`;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.label || btn.textContent;
    btn.disabled = false;
  }
}

function showResult(el, state, title, detail, meta) {
  el.hidden = false;
  el.dataset.state = state;
  el.innerHTML = '';

  const h = document.createElement('p');
  h.className = 'result-title';
  h.textContent = title;
  el.appendChild(h);

  if (detail) {
    const p = document.createElement('p');
    p.textContent = detail;
    el.appendChild(p);
  }
  if (meta) {
    const m = document.createElement('p');
    m.className = 'meta';
    m.textContent = meta;
    el.appendChild(m);
  }
}

/* ── Verify ───────────────────────────────────────────────────────────────── */

function initVerify() {
  const form = document.getElementById('verify-form');
  if (!form) return;

  const fileInput = document.getElementById('audio-file');
  const fileError = document.getElementById('audio-file-error');
  const result = document.getElementById('verify-result');
  const submit = form.querySelector('button[type="submit"]');
  const recordBtn = document.getElementById('record-btn');
  const recordState = document.getElementById('record-state');

  let recordedBlob = null;
  let recorder = null;

  const MAX_BYTES = 25 * 1024 * 1024;

  function clearError() {
    fileError.textContent = '';
    fileInput.setAttribute('aria-invalid', 'false');
  }

  function fail(msg) {
    fileError.textContent = msg;
    fileInput.setAttribute('aria-invalid', 'true');
    fileInput.focus();
  }

  fileInput.addEventListener('change', () => {
    clearError();
    recordedBlob = null;
    const f = fileInput.files[0];
    if (f && f.size > MAX_BYTES) {
      fail('That file is larger than 25 MB. Trim it to the part with speech.');
    }
  });

  /* Recording is offered only where it can actually work. Without
     getUserMedia the button stays hidden rather than failing on click. */
  if (recordBtn) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      recordBtn.closest('.field')?.setAttribute('hidden', '');
    } else {
      recordBtn.addEventListener('click', async () => {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            recordedBlob = new Blob(chunks, { type: recorder.mimeType });
            fileInput.value = '';
            clearError();
            recordBtn.textContent = 'Record again';
            recordState.textContent = 'Recording captured. Select Check this call.';
          };
          recorder.start();
          recordBtn.textContent = 'Stop recording';
          recordState.textContent = 'Recording. Play the call audio now.';
        } catch {
          recordState.textContent =
            'Microphone access was refused, so recording is unavailable. Upload a file instead.';
        }
      });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    result.hidden = true;

    const source = recordedBlob || fileInput.files[0];
    if (!source) {
      fail('Choose an audio file or record the call first.');
      return;
    }
    if (source.size > MAX_BYTES) {
      fail('That file is larger than 25 MB. Trim it to the part with speech.');
      return;
    }

    setBusy(submit, true, 'Checking');
    try {
      // Everything is converted, including files already named .wav: the
      // extension says nothing reliable about the contents, and the API reads
      // 16 kHz mono PCM only.
      const wav = await toWav(source);
      const wav_base64 = await toBase64(wav);
      const data = await postJson('/verify', { wav_base64 });

      if (data.verified) {
        showResult(
          result, 'verified',
          `Verified: ${data.entity_name}`,
          'This recording carries a valid watermark registered to that organisation.',
          `agent ${data.agent_id} · confidence ${Number(data.confidence).toFixed(3)}`
        );
      } else {
        showResult(
          result, 'unverified',
          'No watermark found',
          'This audio carries no EchoSeal watermark. That does not prove it is a scam: ' +
          'it may be a human caller, or an organisation that has not registered. ' +
          'Treat it as unverified and confirm through a number you already trust.',
          `confidence ${Number(data.confidence).toFixed(3)}`
        );
      }
    } catch (err) {
      showResult(result, 'error', 'Could not check that recording', err.message);
    } finally {
      setBusy(submit, false);
    }
  });
}

/* ── Generate ─────────────────────────────────────────────────────────────── */

function initGenerate() {
  const form = document.getElementById('generate-form');
  if (!form) return;

  const textInput = document.getElementById('speech-text');
  const textError = document.getElementById('speech-text-error');
  const agentSelect = document.getElementById('agent-id');
  const result = document.getElementById('generate-result');
  const submit = form.querySelector('button[type="submit"]');
  const honeypot = document.getElementById('company-website');

  const MAX_CHARS = 600;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    textError.textContent = '';
    textInput.setAttribute('aria-invalid', 'false');
    result.hidden = true;

    // Honeypot: a real person never sees this field, so anything in it is a bot.
    // Silently succeeding would waste Polly spend, so it just stops here.
    if (honeypot && honeypot.value) return;

    const text = textInput.value.trim();
    if (!text) {
      textError.textContent = 'Enter the words the assistant should say.';
      textInput.setAttribute('aria-invalid', 'true');
      textInput.focus();
      return;
    }
    if (text.length > MAX_CHARS) {
      textError.textContent = `Keep it under ${MAX_CHARS} characters. That is ${text.length}.`;
      textInput.setAttribute('aria-invalid', 'true');
      textInput.focus();
      return;
    }

    setBusy(submit, true, 'Generating');
    try {
      const data = await postJson('/generate', {
        agent_id: Number(agentSelect.value),
        text,
      });

      result.hidden = false;
      result.dataset.state = 'verified';
      result.innerHTML = '';

      const h = document.createElement('p');
      h.className = 'result-title';
      h.textContent = `Watermarked as ${data.entity_name}`;
      result.appendChild(h);

      const p = document.createElement('p');
      p.textContent =
        'Play this through a speaker and record it on a phone, then check it on the ' +
        'Verify page. The watermark survives that round trip.';
      result.appendChild(p);

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = data.audio_url;
      audio.style.marginTop = '0.75rem';
      audio.style.width = '100%';
      result.appendChild(audio);

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `agent ${data.agent_id} · 16 kHz mono · link expires in 1 hour`;
      result.appendChild(meta);
    } catch (err) {
      showResult(result, 'error', 'Could not generate that audio', err.message);
    } finally {
      setBusy(submit, false);
    }
  });
}

initVerify();
initGenerate();
