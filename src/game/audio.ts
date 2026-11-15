// Procedural Web Audio: every sound and the music are synthesized at runtime.
export type MusicMode = 'menu' | 'day' | 'night' | 'intro' | 'tense' | 'ending' | 'none';

type SfxName =
  | 'click' | 'step' | 'jump' | 'land' | 'mine' | 'break' | 'pickup' | 'place' | 'craft'
  | 'robot' | 'hurt' | 'alarm' | 'explosion' | 'transmit' | 'sos' | 'growl' | 'enemyDie'
  | 'whoosh' | 'thunder' | 'error' | 'complete' | 'eat' | 'hit' | 'power' | 'rumble';

const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];
const PROG: Record<string, number[][]> = {
  // chord tones as semitone offsets from A2 (110Hz)
  menu: [[0, 7, 12, 15, 19], [-4, 3, 8, 12, 15], [-7, 0, 5, 8, 12], [-2, 5, 10, 14, 17]],
  day: [[0, 7, 12, 15, 19], [-4, 3, 8, 12, 15], [3, 10, 15, 19, 22], [-2, 5, 10, 14, 17]],
  night: [[0, 7, 12, 15], [1, 8, 13, 16], [-4, 3, 8, 12], [-5, 2, 7, 10]],
  tense: [[0, 6, 12, 15], [1, 7, 13, 16], [0, 6, 12, 15], [-1, 5, 11, 14]],
  intro: [[0, 7, 12, 15], [-4, 3, 8, 12]],
  ending: [[3, 10, 15, 19, 22], [-2, 5, 10, 14, 17], [0, 7, 12, 15, 19], [-4, 3, 8, 12, 15]],
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  amb!: GainNode;
  delay!: DelayNode;
  noiseBuf!: AudioBuffer;
  musicVol = 0.6;
  sfxVol = 0.8;
  mode: MusicMode = 'none';
  timer: number | null = null;
  private nextChord = 0;
  private chordIdx = 0;
  private nextArp = 0;
  private wind: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private windTarget = 0;
  private stormTarget = 0;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(c.destination);
      this.music = c.createGain();
      this.sfx = c.createGain();
      this.amb = c.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.amb.connect(this.master);
      this.delay = c.createDelay(1.5);
      this.delay.delayTime.value = 0.42;
      const fb = c.createGain();
      fb.gain.value = 0.38;
      const dl = c.createBiquadFilter();
      dl.type = 'lowpass';
      dl.frequency.value = 2200;
      this.delay.connect(dl);
      dl.connect(fb);
      fb.connect(this.delay);
      dl.connect(this.music);
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.timer = window.setInterval(() => this.tick(), 90);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.1);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.7, t, 0.05);
    this.amb.gain.setTargetAtTime(this.sfxVol * 0.5, t, 0.1);
  }

  setMusic(mode: MusicMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.ctx) {
      this.nextChord = this.ctx.currentTime + 0.1;
      this.chordIdx = 0;
    }
  }

  setAmbient(wind: number, storm: number): void {
    this.windTarget = wind;
    this.stormTarget = storm;
  }

  // ---------------- music scheduler ----------------
  private tick(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    this.updateWind();
    if (this.mode === 'none') return;
    const prog = PROG[this.mode] ?? PROG.day;
    const chordLen = this.mode === 'tense' ? 4 : this.mode === 'intro' ? 5 : 8;
    while (this.nextChord < now + 0.3) {
      const chord = prog[this.chordIdx % prog.length];
      this.pad(chord, this.nextChord, chordLen);
      this.bass(chord[0], this.nextChord, chordLen);
      this.chordIdx++;
      this.nextChord += chordLen;
    }
    const arpRate = this.mode === 'night' ? 0.9 : this.mode === 'tense' ? 0.25 : this.mode === 'intro' ? 0.3 : 0.45;
    if (this.nextArp < now) this.nextArp = now + 0.05;
    while (this.nextArp < now + 0.3) {
      const density = this.mode === 'night' ? 0.35 : this.mode === 'menu' ? 0.6 : this.mode === 'tense' ? 0.9 : 0.55;
      if (Math.random() < density) {
        const chord = prog[(this.chordIdx - 1 + prog.length) % prog.length];
        const deg = chord[Math.floor(Math.random() * chord.length)] + 12 * (Math.random() < 0.5 ? 1 : 2);
        this.pluck(110 * Math.pow(2, deg / 12), this.nextArp);
      }
      this.nextArp += arpRate;
    }
  }

  private pad(chord: number[], t: number, len: number): void {
    const c = this.ctx!;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = this.mode === 'night' ? 600 : this.mode === 'tense' ? 900 : 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + len * 0.3);
    g.gain.linearRampToValueAtTime(0.0, t + len + 1.5);
    filt.connect(g);
    g.connect(this.music);
    for (const semi of chord.slice(0, 4)) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 110 * Math.pow(2, semi / 12);
        o.detune.value = det;
        o.connect(filt);
        o.start(t);
        o.stop(t + len + 1.6);
      }
    }
  }

  private bass(semi: number, t: number, len: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = 55 * Math.pow(2, semi / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.mode === 'tense' ? 0.12 : 0.08, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + len + 0.1);
  }

  private pluck(freq: number, t: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.4);
    o.connect(g);
    g.connect(this.music);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + 1.5);
  }

  private updateWind(): void {
    const c = this.ctx!;
    if (!this.wind) {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 400;
      filt.Q.value = 0.7;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.amb);
      src.start();
      this.wind = { src, filt, gain };
    }
    const now = c.currentTime;
    const gust = 0.5 + 0.5 * Math.sin(now * 0.37) * Math.sin(now * 0.11);
    const level = this.windTarget * (0.04 + gust * 0.06) + this.stormTarget * 0.32;
    this.wind.gain.gain.setTargetAtTime(level, now, 0.4);
    this.wind.filt.frequency.setTargetAtTime(300 + gust * 500 + this.stormTarget * 600, now, 0.4);
  }

  // ---------------- sfx ----------------
  private env(g: GainNode, t: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, delay = 0, q = 1): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const rnd = 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'click': this.tone('square', 900, 600, 0.06, 0.12); break;
      case 'step': this.noise(0.05, 0.12, 'lowpass', 700 * rnd, 300); break;
      case 'jump': this.tone('square', 260 * rnd, 520, 0.1, 0.07); break;
      case 'land': this.noise(0.09, 0.2, 'lowpass', 400, 120); this.tone('sine', 110, 60, 0.1, 0.15); break;
      case 'mine': this.tone('triangle', 1400 * rnd, 900, 0.05, 0.08); this.noise(0.04, 0.1, 'highpass', 3000); break;
      case 'break': this.noise(0.18, 0.25, 'bandpass', 900 * rnd, 300, 0, 1.2); break;
      case 'pickup': this.tone('sine', 660, 660, 0.07, 0.1); this.tone('sine', 990, 990, 0.09, 0.1, 0.06); break;
      case 'place': this.noise(0.08, 0.2, 'lowpass', 500, 150); this.tone('square', 180, 120, 0.06, 0.05); break;
      case 'craft': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.08, 0.06, i * 0.07)); break;
      case 'robot': [1200, 1600, 1350].forEach((f, i) => this.tone('sine', f, f * 1.1, 0.05, 0.08, i * 0.06)); break;
      case 'hurt': this.tone('sawtooth', 240, 70, 0.25, 0.14); this.noise(0.12, 0.15, 'lowpass', 800, 200); break;
      case 'hit': this.noise(0.08, 0.22, 'bandpass', 1500, 500); this.tone('square', 300, 120, 0.08, 0.08); break;
      case 'alarm': for (let i = 0; i < 4; i++) { this.tone('square', 880, 880, 0.18, 0.07, i * 0.4); this.tone('square', 660, 660, 0.18, 0.07, i * 0.4 + 0.2); } break;
      case 'explosion': this.noise(2.0, 0.6, 'lowpass', 1200, 60); this.tone('sine', 70, 30, 1.6, 0.5); break;
      case 'rumble': this.noise(1.2, 0.3, 'lowpass', 200, 60); break;
      case 'transmit': this.tone('sine', 300, 1600, 1.2, 0.1); this.tone('triangle', 600, 2400, 1.2, 0.05, 0.1); break;
      case 'sos': {
        const pattern = [0.08, 0.08, 0.08, 0.24, 0.24, 0.24, 0.08, 0.08, 0.08];
        let t = 0;
        pattern.forEach((d, i) => { this.tone('sine', 800, 800, d, 0.1, t); t += d + (i === 2 || i === 5 ? 0.22 : 0.1); });
        break;
      }
      case 'growl': this.tone('sawtooth', 120 * rnd, 70, 0.4, 0.12); this.noise(0.35, 0.1, 'bandpass', 400, 200); break;
      case 'enemyDie': this.tone('sawtooth', 400, 60, 0.4, 0.12); this.noise(0.3, 0.2, 'lowpass', 1500, 100); break;
      case 'whoosh': this.noise(0.6, 0.25, 'bandpass', 300, 2500, 0, 2); break;
      case 'thunder': this.noise(2.4, 0.5, 'lowpass', 900, 40); break;
      case 'error': this.tone('square', 220, 180, 0.15, 0.08); break;
      case 'complete': [523, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.09, i * 0.1)); break;
      case 'eat': this.noise(0.06, 0.15, 'lowpass', 1200, 400); this.noise(0.06, 0.15, 'lowpass', 1000, 300, 0.12); break;
      case 'power': this.tone('sawtooth', 60, 240, 1.0, 0.1); this.tone('sine', 240, 960, 0.8, 0.06, 0.4); break;
    }
  }

  alienChirp(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const f = 1500 + Math.random() * 1500;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const c = this.ctx;
      const t = c.currentTime + i * 0.09;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 0.6 : 1.5), t + 0.07);
      const g = c.createGain();
      this.env(g, t, 0.005, 0.025, 0.08);
      o.connect(g);
      g.connect(this.amb);
      o.start(t);
      o.stop(t + 0.12);
    }
  }
}

export const audio = new AudioEngine();
void SCALE_MINOR;
