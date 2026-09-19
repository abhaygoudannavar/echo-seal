/* Audio to 16 kHz mono 16-bit WAV, in the browser.
 *
 * The /verify endpoint reads WAV only. MediaRecorder produces webm or ogg
 * depending on the browser, and people upload m4a from their phones, so
 * everything is decoded through the Web Audio API and re-encoded here.
 *
 * Resampling to 16 kHz is not strictly required (the backend resamples too) but
 * it cuts upload size by roughly two thirds, which matters on a phone connection
 * and keeps the request under API Gateway's payload ceiling.
 */

const TARGET_RATE = 16000;

/** Decode any browser-supported audio into a mono Float32Array at 16 kHz. */
async function decodeToMono16k(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('This browser does not support the Web Audio API.');

  // A plain context decodes any format the browser knows; the OfflineContext
  // below then does the resampling.
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error('That file could not be read as audio.');
  } finally {
    ctx.close();
  }

  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  if (!frames) throw new Error('That audio file appears to be empty.');

  const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    1, frames, TARGET_RATE
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;

  // The context is mono, so connecting straight to the destination down-mixes a
  // stereo source by averaging the channels, per the Web Audio down-mix rules.
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/** Wrap Float32 samples in a 16-bit PCM WAV container. */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // format: PCM
  view.setUint16(22, 1, true);           // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);  // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: values outside [-1, 1] would wrap and turn into
    // loud noise rather than clipping.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/* Bring the recording into the level range the detector works best at.
 *
 * Automatic gain control is disabled during capture because it mangles the
 * watermark, which leaves the user aiming at a level by hand. Measured: a capture
 * peaking at 0.07 scored 0.0007, while the same audio scaled up scored 0.17.
 *
 * This is only a scale factor, so it cannot create information. It does not undo
 * clipping, and on a recording that was too quiet at the microphone it lifts the
 * noise along with the signal. It removes the easy failure, not the hard one.
 *
 * The gain is capped so near-silence is not amplified into loud hiss, and the
 * target sits below full scale to leave headroom.
 */
const TARGET_PEAK = 0.7;
const MAX_GAIN = 12;

function normalize(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) return samples;

  const gain = Math.min(TARGET_PEAK / peak, MAX_GAIN);
  // Already at or above target: leave it alone rather than pulling it down, since
  // a loud capture is usually clipped and quieter will not undo that.
  if (gain <= 1) return samples;

  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/** Convert a File or Blob of any supported type into a 16 kHz mono WAV Blob. */
export async function toWav(fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer();
  const samples = await decodeToMono16k(buf);
  return encodeWav(normalize(samples), TARGET_RATE);
}

/** Base64 for the JSON request body, chunked so large files do not blow the stack. */
export async function toBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
