// 声音:全部用 Web Audio 现场合成,不需要任何音频文件。
// iPhone 要求用户点一下之后才能出声,所以第一次在"翻开这本书"时初始化。
import type { PlaceId } from '../engine/story.ts';

interface Bed {
  src: AudioBufferSourceNode;
  f: BiquadFilterNode;
  g: GainNode;
}

const KEY = 'life-code.sound';

class SoundEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beds: Bed[] = [];
  private timers: number[] = [];
  on = true;

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) !== 'off';
    } catch {
      /* 默认开 */
    }
  }

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  set(on: boolean) {
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* 忽略 */
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.1);
  }

  private bed(type: BiquadFilterType, freq: number, q: number, gain: number): Bed | null {
    const c = this.ctx;
    if (!c || !this.master || !this.noise) return null;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise;
    src.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start(0, Math.random() * 1.5);
    g.gain.setTargetAtTime(gain, c.currentTime, 0.8);
    const b = { src, f, g };
    this.beds.push(b);
    return b;
  }

  private every(ms: number, fn: () => void) {
    this.timers.push(window.setInterval(fn, ms));
  }

  burst(freq: number, dur: number, gain: number, q = 1.2) {
    const c = this.ctx;
    if (!c || !this.master || !this.noise) return;
    const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const c = this.ctx;
    if (!c || !this.master) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start); o.stop(start + dur + 0.05);
  }

  quiet() {
    const c = this.ctx;
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (!c) return;
    for (const b of this.beds) {
      b.g.gain.setTargetAtTime(0, c.currentTime, 0.4);
      b.src.stop(c.currentTime + 2);
    }
    this.beds = [];
  }

  chime(n = 3) {
    const c = this.ctx;
    if (!c) return;
    const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * (0.18 + Math.random() * 0.25);
      const f0 = notes[Math.floor(Math.random() * notes.length)];
      this.tone(f0, t, 3.2, 0.08);
      this.tone(f0 * 2.76, t, 1.2, 0.025);
    }
  }

  flip() {
    const c = this.ctx;
    if (!c || !this.master || !this.noise) return;
    const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 0.5);
  }

  /** 选完一个选项时轻轻的一声木鱼 */
  pick() {
    const c = this.ctx;
    if (!c) return;
    this.tone(520, c.currentTime, 0.25, 0.08, 'triangle');
    this.tone(780, c.currentTime + 0.02, 0.18, 0.03);
  }

  blow() { this.burst(600, 0.35, 0.25, 0.6); }

  firecracker() {
    for (let i = 0; i < 14; i++) setTimeout(() => this.burst(1500 + Math.random() * 2500, 0.06, 0.25, 0.7), i * (50 + Math.random() * 60));
  }

  keyTurn() {
    const c = this.ctx;
    if (!c) return;
    this.burst(3000, 0.05, 0.2, 4);
    setTimeout(() => this.burst(2200, 0.08, 0.25, 4), 180);
  }

  paper() { this.burst(2500, 0.5, 0.15, 0.5); }

  private chirp() {
    const c = this.ctx;
    if (!c) return;
    for (let i = 0; i < 3; i++) {
      const t = c.currentTime + i * 0.11;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(2800 + Math.random() * 600, t);
      o.frequency.exponentialRampToValueAtTime(4200 + Math.random() * 800, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(this.master!); o.start(t); o.stop(t + 0.1);
    }
  }

  private cricket() {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 4; i++) this.tone(4400, t + i * 0.05, 0.03, 0.012);
  }

  private bell() {
    const c = this.ctx;
    if (!c) return;
    this.tone(659, c.currentTime, 1.2, 0.05);
    this.tone(523, c.currentTime + 0.6, 1.4, 0.05);
  }

  /** 每个地点的环境声 */
  ambience(place: PlaceId, hour: number, rain: boolean) {
    this.quiet();
    if (!this.ctx) return;
    const night = hour >= 20 || hour <= 4;
    const outdoor = ['market', 'school', 'park', 'street', 'city', 'station'].includes(place);
    switch (place) {
      case 'home':
        this.bed('lowpass', 300, 0.3, 0.025);
        break;
      case 'kitchen': {
        const s = this.bed('highpass', 4200, 0.6, 0.04);
        this.bed('lowpass', 250, 0.5, 0.05);
        if (s) this.every(140, () => s.g.gain.setTargetAtTime(0.02 + Math.random() * 0.05, this.ctx!.currentTime, 0.05));
        break;
      }
      case 'market': {
        const s = this.bed('highpass', 4200, 0.6, night ? 0.01 : 0.05);
        this.bed('bandpass', 450, 0.7, night ? 0.01 : 0.035);
        if (s && !night) this.every(120, () => s.g.gain.setTargetAtTime(0.03 + Math.random() * 0.05, this.ctx!.currentTime, 0.05));
        break;
      }
      case 'school':
        this.bed('bandpass', 600, 0.8, 0.03);
        setTimeout(() => this.bell(), 600);
        break;
      case 'park':
        this.bed('lowpass', 500, 0.4, 0.04);
        if (!night) this.every(2400, () => Math.random() < 0.6 && this.chirp());
        break;
      case 'street':
        this.bed('lowpass', 600, 0.4, 0.03);
        break;
      case 'city':
        this.bed('lowpass', 180, 0.6, 0.07);
        break;
      case 'station':
        this.bed('lowpass', 160, 0.7, 0.08);
        setTimeout(() => this.bell(), 800);
        break;
      case 'office':
        this.bed('lowpass', 120, 1, 0.03);
        this.every(260, () => Math.random() < 0.35 && this.burst(3500, 0.03, 0.04, 3));
        break;
    }
    if (rain) {
      this.bed('lowpass', 1400, 0.4, 0.22);
      this.bed('highpass', 5000, 0.5, 0.03);
    }
    if (night && outdoor && !rain) this.every(900, () => Math.random() < 0.7 && this.cricket());
    if (hour === 5 || hour === 6) this.every(2600, () => Math.random() < 0.5 && this.chirp());
  }

  /** 伞撑开以后,雨点打在伞面上 */
  umbrella() {
    this.every(45, () => Math.random() < 0.7 && this.burst(2200 + Math.random() * 1600, 0.04, 0.05 + Math.random() * 0.08, 3));
  }
}

export const Sound = new SoundEngine();
