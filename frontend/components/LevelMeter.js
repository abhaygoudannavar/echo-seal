'use client';

import { useEffect, useRef } from 'react';

/* Live input level while recording.
 *
 * This is feedback, not decoration: flat bars mean the microphone is not picking
 * up the playback, which is the difference between a bad capture and a missing
 * watermark. Drawn on a canvas rather than as React state so it does not
 * re-render the form sixty times a second.
 */
const BARS = 44;

export default function LevelMeter({ stream, onLevel }) {
  const canvasRef = useRef(null);
  const levelRef = useRef(onLevel);
  levelRef.current = onLevel;

  useEffect(() => {
    if (!stream) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const audio = new Ctx();
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    // Deliberately not connected to audio.destination: routing the mic to the
    // speakers would feed back.

    const freq = new Uint8Array(analyser.frequencyBinCount);
    // Time-domain samples, to detect clipping. The frequency data cannot show it:
    // a squared-off waveform still reads as plenty of energy.
    const time = new Uint8Array(analyser.fftSize);
    const heights = new Float32Array(BARS);
    let raf = 0;
    let levelState = 'quiet';
    let peakHold = 0;

    // Canvas cannot read CSS custom properties, so pull the resolved colours off
    // the element. This keeps the meter correct in both light and dark mode.
    const styles = getComputedStyle(canvas);
    const barColor = styles.getPropertyValue('color').trim() || '#16191d';
    const idleColor = styles.getPropertyValue('border-top-color').trim() || '#dfdcd6';
    const clipColor = styles.getPropertyValue('outline-color').trim() || '#7c2d12';

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(freq);

      // 128 is silence in this 8-bit representation, so 0 and 255 are full scale.
      // Clipping flattens the peaks and that is what corrupts the watermark's bits,
      // so it is worth warning about while there is still time to turn it down.
      analyser.getByteTimeDomainData(time);
      let pinned = 0;
      let peak = 0;
      for (let i = 0; i < time.length; i++) {
        if (time[i] <= 1 || time[i] >= 254) pinned++;
        const a = Math.abs(time[i] - 128) / 128;
        if (a > peak) peak = a;
      }
      // Hold the peak across gaps between words. At ~60fps this retains roughly
      // 90% after a second and 55% after five, so natural pauses in speech do not
      // flip the reading back to "quiet" while someone is clearly talking. A fast
      // decay made the guidance flicker on every pause, which is worse than useless.
      peakHold = Math.max(peak, peakHold * 0.998);

      // Measured targets: a capture peaking near full scale clipped and corrupted
      // 9 of 16 ID bits; one peaking at 0.07 left the mark below the noise floor
      // and scored 0.0007. The usable window sits between.
      // Clipping is judged on the instantaneous frame, since even a brief flat-topped
      // peak corrupts bits. Quiet is judged on the held peak, so it only reports
      // "too quiet" once the input has genuinely stayed low, not between words.
      let next;
      if (pinned / time.length > 0.005 || peak > 0.97) next = 'loud';
      else if (peakHold > 0.22) next = 'good';
      else next = 'quiet';

      if (next !== levelState) {
        levelState = next;
        levelRef.current?.(next);
      }

      const ctx = canvas.getContext('2d');
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = Math.max(1, (w - gap * (BARS - 1)) / BARS);
      // Speech energy sits well below the top of the FFT range, so only the lower
      // part of the spectrum is sampled; using the whole range leaves most bars dead.
      const usable = Math.floor(freq.length * 0.55);

      for (let i = 0; i < BARS; i++) {
        const start = Math.floor((i / BARS) * usable);
        const end = Math.max(start + 1, Math.floor(((i + 1) / BARS) * usable));
        let sum = 0;
        for (let j = start; j < end; j++) sum += freq[j];
        const target = sum / (end - start) / 255;

        // Fall slower than it rises, so peaks stay readable instead of flickering.
        heights[i] = target > heights[i] ? target : heights[i] * 0.82 + target * 0.18;

        const barH = Math.max(2, heights[i] * (h - 4));
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        ctx.fillStyle =
          levelState === 'loud' ? clipColor : heights[i] > 0.02 ? barColor : idleColor;
        ctx.fillRect(x, y, barW, barH);
      }
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      try {
        source.disconnect();
      } catch {
        /* already torn down with the stream */
      }
      audio.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      className="level-meter"
      role="img"
      aria-label="Live microphone input level"
      height="44"
    />
  );
}
