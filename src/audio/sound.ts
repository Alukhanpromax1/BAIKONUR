/**
 * Original synthesised sound layer (Web Audio API). No audio files, samples or third-party
 * recordings are used. Sound is optional and never required to understand the game.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { stop: () => void } | null = null;
let enabled = false;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Brown-ish noise: integrate white noise for a soft, low rumble.
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function startAmbience() {
  const c = ensure();
  if (!c || !master || ambience) return;
  const out = c.createGain();
  out.gain.value = 0.0;
  out.gain.linearRampToValueAtTime(0.55, c.currentTime + 3);
  out.connect(master);

  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 4);
  noise.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  const ng = c.createGain();
  ng.gain.value = 0.5;
  noise.connect(lp).connect(ng).connect(out);
  noise.start();

  const oscs = [55, 82.4, 110.3].map((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = [0.07, 0.035, 0.02][i];
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.03;
    const lg = c.createGain();
    lg.gain.value = g.gain.value * 0.5;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(out);
    o.start();
    lfo.start();
    return [o, lfo];
  });
  ambience = {
    stop: () => {
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
      setTimeout(() => {
        try {
          noise.stop();
          oscs.flat().forEach((o) => o.stop());
        } catch {
          /* already stopped */
        }
      }, 800);
    },
  };
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  const c = ensure();
  if (!c || !master) return;
  if (on) {
    void c.resume().catch(() => undefined);
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.linearRampToValueAtTime(0.5, c.currentTime + 0.4);
    startAmbience();
  } else {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.linearRampToValueAtTime(0, c.currentTime + 0.25);
    ambience?.stop();
    ambience = null;
  }
}

function tone(freq: number, duration: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const c = ensure();
  if (!c || !master || !enabled || c.state !== 'running') return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.12, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + duration + 0.05);
}

export const sfx = {
  click: () => tone(880, 0.07, { type: 'triangle', gain: 0.06 }),
  select: () => {
    tone(660, 0.09, { type: 'triangle', gain: 0.07 });
    tone(990, 0.12, { type: 'triangle', gain: 0.05, delay: 0.06 });
  },
  confirm: () => {
    tone(523.25, 0.14, { gain: 0.09 });
    tone(783.99, 0.22, { gain: 0.09, delay: 0.1 });
  },
  warning: () => {
    for (let i = 0; i < 3; i++) tone(440, 0.16, { type: 'square', gain: 0.045, delay: i * 0.28 });
  },
  tick: () => tone(1200, 0.03, { type: 'square', gain: 0.02 }),
  reveal: () => {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.5, { gain: 0.07, delay: i * 0.12 }));
  },
  launch: () => {
    const c = ensure();
    if (!c || !master || !enabled || c.state !== 'running') return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(90, c.currentTime);
    lp.frequency.exponentialRampToValueAtTime(900, c.currentTime + 2.2);
    lp.frequency.exponentialRampToValueAtTime(120, c.currentTime + 4.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1.6, c.currentTime + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 4.9);
    src.connect(lp).connect(g).connect(master);
    src.start();
    tone(48, 4.5, { type: 'sawtooth', gain: 0.07, slideTo: 90 });
  },
};
