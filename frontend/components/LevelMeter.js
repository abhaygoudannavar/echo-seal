'use client';

import { useEffect, useRef } from 'react';

/* Compact input-level indicator, the kind dictation tools show while listening.
 *
 * Small and rounded rather than a full-width analyser: it sits inline beside the
 * stop button and reads as "listening", not as a measurement instrument. It is
 * still functional though, and reports the level back so the form can warn about
 * clipping, which corrupts the watermark's bits.
 */
const BARS = 9;
const BAR_W = 3;
const GAP = 3;
const MIN_H = 3;

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
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    // Deliberately not connected to the destination: that would feed back.

    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    const heights = new Float32Array(BARS);
    let raf = 0;
    let levelState = 'quiet';
    let peakHold = 0;

    const styles = getComputedStyle(canvas);
    const barColor = styles.getPropertyValue('color').trim() || '#16191d';
    const idleColor = styles.getPropertyValue('border-top-color').trim() || '#dfdcd6';
    const clipColor = styles.getPropertyValue('outline-color').trim() || '#7c2d12';

    const cssW = BARS * BAR_W + (BARS - 1) * GAP;
    const cssH = 26;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function draw() {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(time);

      let pinned = 0;
      let peak = 0;
      for (let i = 0; i < time.length; i++) {
        if (time[i] <= 1 || time[i] >= 254) pinned++;
        const a = Math.abs(time[i] - 128) / 128;
        if (a > peak) peak = a;
      }
      // Hold the peak across gaps between words so the guidance does not flicker
      // back to "quiet" mid-sentence.
      peakHold = Math.max(peak, peakHold * 0.998);

      let next;
      if (pinned / time.length > 0.005 || peak > 0.97) next = 'loud';
      else if (peakHold > 0.22) next = 'good';
      else next = 'quiet';
      if (next !== levelState) {
        levelState = next;
        levelRef.current?.(next);
      }

      ctx.clearRect(0, 0, cssW, cssH);
      // Speech energy lives low in the spectrum; sampling the whole range would
      // leave most of these few bars permanently dead.
      const usable = Math.floor(freq.length * 0.45);
      const colour = levelState === 'loud' ? clipColor : barColor;

      for (let i = 0; i < BARS; i++) {
        const start = Math.floor((i / BARS) * usable);
        const end = Math.max(start + 1, Math.floor(((i + 1) / BARS) * usable));
        let sum = 0;
        for (let j = start; j < end; j++) sum += freq[j];
        let target = sum / (end - start) / 255;

        // Taper the outer bars so the shape reads as a soft blob rather than a
        // flat block of equal sticks.
        const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        target *= 0.55 + centre * 0.45;

        // Rise fast, fall slow: peaks stay readable instead of strobing.
        heights[i] = target > heights[i] ? target : heights[i] * 0.85 + target * 0.15;

        const h = Math.max(MIN_H, heights[i] * (cssH - 4));
        const x = i * (BAR_W + GAP);
        const y = (cssH - h) / 2;

        ctx.fillStyle = heights[i] > 0.02 ? colour : idleColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, BAR_W, h, BAR_W / 2);
        else ctx.rect(x, y, BAR_W, h);
        ctx.fill();
      }
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        /* already torn down with the stream */
      }
      audio.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="level-meter" role="img" aria-label="Microphone level" />;
}
