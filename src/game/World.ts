import { VIEW_W, VIEW_H, TILE, clamp, lerp } from './constants';
import { Input } from './input';
import { Particles } from './particles';
import { Body, moveBody, Solids, GRAVITY, JUMP_SPEED, MAX_FALL } from './physics';
import { sprites, Sprites } from './art/sprites';
import { drawText, measure } from './font';
import { audio } from './audio';
import { touchEnabled } from './settings';
import {
  getState, update, ui, emitUi, inputBlocked, say, setCinematic, subscribe, saveNow,
} from '../store/gameStore';
import type { Mood } from '../store/types';
import { BaseScene } from './BaseScene';
import { tickClock } from '../data/radiation';
import { nextGuide, Guide } from '../data/guide';
import { dayDef } from '../data/days';
import { ROOMS, ROOM_W, ROOM_INDEX } from './art/baseArt';
import { ExploreScene } from './ExploreScene';

export interface Interactable {
  id: string;
  x: number; // centre (world px)
  y: number; // bottom (world px)
  w: number;
  h: number;
  label: string;
  /** Seconds the player must hold E (scans). */
  hold?: number;
  action: () => void;
}

export interface Scene {
  kind: 'base' | 'explore';
  width: number;
  solids: Solids;
  enter(w: World, from: 'start' | 'door'): void;
  update(w: World, dt: number): void;
  drawBack(w: World, ctx: CanvasRenderingContext2D, camX: number): void;
  drawFront(w: World, ctx: CanvasRenderingContext2D, camX: number): void;
  interactables(w: World): Interactable[];
  areaName(x: number): string;
  music(): 'day' | 'night' | 'tense';
}

export type PState = 'idle' | 'walk' | 'jump' | 'fall' | 'land' | 'interact' | 'repair' | 'lying' | 'getup';

export class Player {
  body: Body = { x: 0, y: 0, w: 10, h: 22, vx: 0, vy: 0, onGround: true, hitWallX: false };
  facing: 1 | -1 = 1;
  state: PState = 'idle';
  animT = 0;
  actionT = 0;
  action: 'interact' | 'repair' = 'interact';
  landT = 0;
  stepT = 0;
  get cx(): number { return this.body.x + this.body.w / 2; }
  get feet(): number { return this.body.y + this.body.h; }
  place(x: number, feet: number): void {
    this.body.x = x - this.body.w / 2;
    this.body.y = feet - this.body.h - 0.01;
    this.body.vx = 0;
    this.body.vy = 0;
  }
  act(kind: 'interact' | 'repair', t = 0.5): void {
    this.action = kind;
    this.actionT = t;
    this.animT = 0;
  }
}

export class World {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: Input;
  particles = new Particles();
  spr: Sprites = sprites();
  player = new Player();
  nova = { x: 0, y: 0, vx: 0, vy: 0, t: 0, blink: 2, mood: 'happy' as Mood, scan: 0 };
  scene: Scene;
  base: BaseScene;
  explore: ExploreScene;
  camX = 0;
  t = 0;
  fade = 1;
  private fadeDir = -1;
  private pending: (() => void) | null = null;
  focus: Interactable | null = null;
  holdT = 0;
  shakeT = 0;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  private liveT = 0;
  private lockedHintT = 0;
  private cooldown = 0;
  // ---- NOVA guidance: notices when the player is stuck and points the way
  private stuckT = 0;
  private progressKey = '';
  private autoHints = 0;
  private guideArrow: { scene: 'base' | 'explore'; x: number; until: number; label: string } | null = null;
  private holdTaps = 0;
  private holdTapId = '';
  private holdTipShown = new Set<string>();
  cine: { name: string; t: number; step: number } | null = null;
  private unsub: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas, VIEW_W, VIEW_H);
    this.base = new BaseScene();
    this.explore = new ExploreScene();
    const s = getState();
    this.scene = s.scene === 'explore' ? this.explore : this.base;
    this.scene.enter(this, 'start');
    this.nova.x = this.player.cx - 24;
    this.nova.y = this.player.body.y - 8;
    this.snapCamera();
    if (s.day === 1 && s.phase === 'briefing' && !s.flags.woke) this.startCinematic('wake');
    this.unsub = subscribe(() => this.onState());
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.unsub();
    audio.setAmbient(0, 0);
  }

  private lastPhase = getState().phase;
  private onState(): void {
    const s = getState();
    if (s.phase === 'briefing' && this.lastPhase !== 'briefing' && s.scene === 'base' && this.scene !== this.base) {
      this.scene = this.base;
      this.base.enter(this, 'start');
      this.snapCamera();
    } else if (s.phase === 'briefing' && this.lastPhase === 'report') {
      this.base.enter(this, 'start');
      this.snapCamera();
    }
    this.lastPhase = s.phase;
  }

  // ---------------------------------------------------------------- transitions
  transition(fn: () => void): void {
    this.pending = fn;
    this.fadeDir = 1;
  }

  goOutside(): void {
    audio.play('whoosh');
    this.transition(() => {
      update((s) => { s.scene = 'explore'; s.suitO2 = 100; s.flags.wentOutside = true; s.dayLog.events.push({ kind: 'eva', text: 'Went outside on a surface walk (EVA)' }); });
      this.scene = this.explore;
      this.explore.enter(this, 'door');
      this.snapCamera();
      saveNow();
    });
  }

  goInside(reason?: string): void {
    audio.play('whoosh');
    this.transition(() => {
      update((s) => { s.scene = 'base'; s.suitO2 = 100; s.carrying = null; });
      this.scene = this.base;
      this.base.enter(this, 'door');
      this.snapCamera();
      if (reason) say(reason, 'worried');
      saveNow();
    });
  }

  startCinematic(name: string): void {
    this.cine = { name, t: 0, step: 0 };
    setCinematic(name);
  }

  endCinematic(): void {
    this.cine = null;
    setCinematic(null);
  }

  shake(t: number): void {
    this.shakeT = Math.max(this.shakeT, t);
  }

  snapCamera(): void {
    this.camX = clamp(this.player.cx - VIEW_W / 2, 0, this.scene.width - VIEW_W);
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.tick(dt);
    this.render();
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private tick(dt: number): void {
    this.t += dt;
    const s = getState();
    // fade transitions
    if (this.fadeDir !== 0) {
      this.fade = clamp(this.fade + this.fadeDir * dt * 3, 0, 1);
      if (this.fade >= 1 && this.fadeDir > 0) {
        this.pending?.();
        this.pending = null;
        this.fadeDir = -1;
      } else if (this.fade <= 0 && this.fadeDir < 0) this.fadeDir = 0;
    }
    const pausedByModal = ui.modal?.kind === 'pause' || ui.modal?.kind === 'minigame' || ui.modal?.kind === 'powergrid' || ui.modal?.kind === 'settings';
    if (pausedByModal) return;
    if (this.cine) this.updateCinematic(dt);
    const free = !inputBlocked() && this.fadeDir === 0 && !this.cine;
    // ignore keys for a moment after a dialogue or menu closes, so the key that closed it doesn't trigger something else
    this.cooldown = free ? Math.max(0, this.cooldown - dt) : 0.3;
    const flying = this.scene === this.explore && this.explore.controlsLocked();
    const controls = free && this.cooldown <= 0 && !flying;
    this.updatePlayer(dt, controls);
    this.updateNova(dt);
    this.scene.update(this, dt);
    this.particles.update(dt);
    if (controls) this.updateInteraction(dt);
    else { this.focus = null; this.holdT = 0; }
    // camera
    const follow = this.scene === this.explore ? this.explore.cameraTarget() : null;
    const target = clamp((follow ?? this.player.cx + this.player.facing * 30) - VIEW_W / 2, 0, this.scene.width - VIEW_W);
    this.camX += (target - this.camX) * (1 - Math.exp(-dt * 5));
    this.shakeT = Math.max(0, this.shakeT - dt);
    // simulated mission clock and suit radiation monitor
    if (s.phase === 'play') update((st) => tickClock(st, dt, this.scene.kind === 'explore'), { silent: true });
    if (s.phase === 'play') this.watchProgress(dt, free && !flying);
    // live HUD values (a few times per second)
    this.liveT -= dt;
    if (this.liveT <= 0) {
      this.liveT = 0.2;
      const area = this.scene.areaName((this.scene === this.explore ? this.explore.cameraTarget() : null) ?? this.player.cx);
      if (!ui.live || ui.live.area !== area || Math.abs(ui.live.suitO2 - s.suitO2) >= 1 || ui.live.outside !== (this.scene.kind === 'explore') || Math.abs(ui.live.dose - s.radDose) >= 0.005 || Math.abs(ui.live.hours - s.missionHours) >= 0.1) {
        ui.live = { area, suitO2: s.suitO2, outside: this.scene.kind === 'explore', dose: s.radDose, hours: s.missionHours };
        emitUi();
      }
    }
    // audio
    audio.setMusic(this.cine?.name === 'final' ? 'ending' : this.scene.music());
    const storm = this.scene.kind === 'base' && s.day === 5;
    audio.setAmbient(this.scene.kind === 'explore' ? 1 : 0.15, storm ? 0.7 : 0);
  }

  private updatePlayer(dt: number, controls: boolean): void {
    const p = this.player;
    const b = p.body;
    p.animT += dt;
    p.actionT = Math.max(0, p.actionT - dt);
    p.landT = Math.max(0, p.landT - dt);
    if (p.state === 'lying' || p.state === 'getup') {
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
      moveBody(this.scene.solids, b, dt);
      return;
    }
    let move = 0;
    if (controls) {
      if (this.input.key('KeyA', 'ArrowLeft')) move -= 1;
      if (this.input.key('KeyD', 'ArrowRight')) move += 1;
    }
    const max = 92;
    if (move) {
      b.vx += move * 900 * dt;
      b.vx = clamp(b.vx, -max, max);
      p.facing = move > 0 ? 1 : -1;
    } else {
      const f = 1100 * dt;
      b.vx = Math.abs(b.vx) <= f ? 0 : b.vx - Math.sign(b.vx) * f;
    }
    if (controls && b.onGround && this.input.hit('KeyW', 'ArrowUp', 'Space')) {
      b.vy = -JUMP_SPEED;
      audio.play('jump');
    }
    // releasing jump early makes a shorter hop (keeps control responsive in low gravity)
    if (!this.input.key('KeyW', 'ArrowUp', 'Space') && b.vy < -JUMP_SPEED * 0.4) b.vy *= 0.7;
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
    const was = b.onGround;
    moveBody(this.scene.solids, b, dt, true);
    if (!was && b.onGround) { p.landT = 0.1; audio.play('land'); this.particles.burst(p.cx, p.feet, this.scene.kind === 'explore' ? '#c96a3a' : '#8f99b3', 4, 30); }
    b.x = clamp(b.x, 2, this.scene.width - b.w - 2);
    if (b.onGround && Math.abs(b.vx) > 20) {
      p.stepT -= dt;
      if (p.stepT <= 0) {
        p.stepT = 0.3;
        audio.play('step');
        if (this.scene.kind === 'explore') this.particles.burst(p.cx - p.facing * 3, p.feet, '#d9875a', 2, 18);
      }
    }
    let st: PState;
    if (p.actionT > 0) st = p.action;
    else if (!b.onGround) st = b.vy < 0 ? 'jump' : 'fall';
    else if (p.landT > 0) st = 'land';
    else st = Math.abs(b.vx) > 8 ? 'walk' : 'idle';
    if (st !== p.state) { p.state = st; if (st !== 'repair' && st !== 'interact') p.animT = 0; }
    // locked door hint
    if (controls && b.hitWallX && move !== 0) {
      this.lockedHintT -= dt;
      if (this.lockedHintT <= 0) {
        this.lockedHintT = 4;
        const it = this.scene.interactables(this).find((i) => i.id.startsWith('door:') && Math.abs(i.x - p.cx) < 30);
        it?.action();
      }
    }
  }

  private updateNova(dt: number): void {
    const n = this.nova;
    const p = this.player;
    n.t += dt;
    n.blink -= dt;
    if (n.blink < -0.12) n.blink = 2 + Math.random() * 3;
    n.scan = Math.max(0, n.scan - dt);
    const line = ui.dialogue[0];
    n.mood = line?.mood ?? (this.holdT > 0 ? 'thinking' : ui.rewards.length ? 'celebrating' : 'happy');
    let tx = p.cx - p.facing * 26;
    let ty = p.body.y - 6 + Math.sin(n.t * 2.2) * 3;
    if (this.cine?.name === 'wake' && this.cine.step < 2) { tx = p.cx + 120; ty = p.body.y - 30; }
    const k = 8, d = 5;
    n.vx += ((tx - n.x) * k - n.vx * d) * dt;
    n.vy += ((ty - n.y) * k - n.vy * d) * dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (Math.random() < dt * 5) this.particles.add({ x: n.x, y: n.y + 10, vy: 26, vx: (Math.random() - 0.5) * 8, max: 0.3, color: '#ffb347', glow: true, fade: true });
  }

  /** Interactables including NOVA herself. */
  allInteractables(): Interactable[] {
    const list = this.scene.interactables(this);
    list.push({
      id: 'nova', x: this.nova.x, y: this.nova.y + 12, w: 22, h: 26, label: 'TALK TO NOVA',
      action: () => this.talkToNova(),
    });
    return list;
  }

  talkToNova(): void {
    const s = getState();
    this.nova.scan = 1;
    if (s.day === 1 && !s.flags.talkedNova) {
      say("I'm so glad you're okay! I'm NOVA. I help run the base and I love solving problems.", 'happy');
      say('Every repair we make earns energy, and energy lets us switch machines back on. Teamwork!', 'celebrating', 'NOVA', () => update((st) => { st.flags.talkedNova = true; }));
      return;
    }
    this.novaHint(false);
  }

  /**
   * NOVA explains the next step and where it is, and shows an arrow for a while.
   * `auto` = NOVA noticed the player seems stuck (no progress for a while).
   */
  novaHint(auto: boolean): void {
    const s = getState();
    const g = nextGuide(s);
    if (!g) {
      if (!auto) say(`We've done everything for Day ${s.day}! Rest in the sleep pod in the Command Center, or press NEXT DAY.`, 'celebrating');
      return;
    }
    const where = this.directions(g);
    const first = dayDef(s.day).objectives.find((o) => !o.done(s));
    if (auto) say(`Need a hand? Our next step is: ${first?.text ?? 'the next objective'}.`, 'curious');
    say(`${g.text}${where ? ` ${where}` : ''}`, auto ? 'happy' : 'thinking');
    this.nova.scan = 1;
  }

  /** "Go to LIFE SUPPORT — 2 rooms to your right." and set the guide arrow. */
  private directions(g: Guide): string {
    const spot = g.spot;
    if (!spot) { this.guideArrow = null; return ''; }
    const here = this.scene.kind;
    const cx = this.player.cx;
    let tx: number, sceneOf: 'base' | 'explore', label: string;
    if (spot.scene === 'base') {
      if (here === 'explore') {
        this.guideArrow = { scene: 'explore', x: 14 * 16, until: this.t + 25, label: 'AIRLOCK' };
        return 'First head back left to the airlock hatch and go inside.';
      }
      sceneOf = 'base';
      const idx = ROOM_INDEX[spot.room];
      tx = idx * ROOM_W + spot.x;
      label = ROOMS[idx].name;
      const cur = clamp(Math.floor(cx / ROOM_W), 0, ROOMS.length - 1);
      this.guideArrow = { scene: sceneOf, x: tx, until: this.t + 25, label };
      const n = idx - cur;
      if (n === 0) return Math.abs(tx - cx) < 30 ? "It's right here!" : `It's in this room, to your ${tx > cx ? 'right' : 'left'}. Follow my arrow!`;
      return `It's in the ${label} — ${Math.abs(n)} room${Math.abs(n) > 1 ? 's' : ''} to your ${n > 0 ? 'right' : 'left'}. Follow my arrow!`;
    }
    tx = spot.tile * 16 + 8;
    label = this.explore.areaName(tx);
    if (here === 'base') { this.guideArrow = null; return ''; }
    this.guideArrow = { scene: 'explore', x: tx, until: this.t + 25, label };
    return Math.abs(tx - cx) < 40 ? "It's right here!" : `Walk ${tx > cx ? 'right' : 'left'} to ${label}. Follow my arrow!`;
  }

  /** No objective progress for a while → NOVA offers a hint (first after 60 s, then every 90 s). */
  private watchProgress(dt: number, active: boolean): void {
    const s = getState();
    const def = dayDef(s.day);
    const done = def.objectives.filter((o) => o.done(s)).length;
    const key = `${s.day}|${done}|${s.dayLog.events.length}|${s.completed.length}|${s.accepted.length}|${s.carrying ?? ''}`;
    if (key !== this.progressKey) { this.progressKey = key; this.stuckT = 0; this.autoHints = 0; if (this.guideArrow && done === def.objectives.length) this.guideArrow = null; return; }
    if (!active || done === def.objectives.length || ui.modal) return;
    this.stuckT += dt;
    if (this.stuckT >= (this.autoHints ? 90 : 60)) {
      this.stuckT = 0;
      this.autoHints++;
      this.novaHint(true);
    }
  }

  private updateInteraction(dt: number): void {
    const p = this.player;
    const list = this.allInteractables();
    // nearest in range (prefer machines over NOVA)
    let best: Interactable | null = null;
    let bd = 1e9;
    for (const it of list) {
      const dx = Math.abs(it.x - p.cx);
      const dy = Math.abs(it.y - it.h / 2 - (p.body.y + p.body.h / 2));
      if (dx < it.w / 2 + 14 && dy < it.h / 2 + 30) {
        const d = dx + (it.id === 'nova' ? 40 : 0);
        if (d < bd) { bd = d; best = it; }
      }
    }
    // tap/click on something in range
    if (this.input.clickL) {
      const mx = this.input.mouseX + this.camX, my = this.input.mouseY;
      const hit = list.find((it) => mx > it.x - it.w / 2 - 4 && mx < it.x + it.w / 2 + 4 && my > it.y - it.h - 4 && my < it.y + 4 && Math.abs(it.x - p.cx) < it.w / 2 + 50);
      if (hit && !hit.hold) { this.use(hit); return; }
      if (hit) best = hit;
    }
    if (best?.id !== this.focus?.id) this.holdT = 0;
    this.focus = best;
    if (!best) return;
    if (best.hold) {
      if (this.input.key('KeyE', 'Enter')) {
        this.holdT += dt;
        p.act('interact', 0.2);
        this.nova.scan = 0.3;
        if (Math.random() < dt * 10) this.particles.add({ x: best.x + (Math.random() - 0.5) * best.w, y: best.y - Math.random() * best.h, vy: -20, max: 0.6, color: '#5ff3ff', glow: true, fade: true });
        if (Math.floor(this.holdT * 5) !== Math.floor((this.holdT - dt) * 5)) audio.play('mine');
        if (this.holdT >= best.hold) { this.holdT = 0; this.holdTaps = 0; this.use(best); }
      } else this.holdT = Math.max(0, this.holdT - dt * 2);
      // quick taps never fill the bar: after a few, NOVA explains
      if (this.input.hit('KeyE', 'Enter')) {
        if (this.holdTapId !== best.id) { this.holdTapId = best.id; this.holdTaps = 0; }
        this.holdTaps++;
        if (this.holdTaps >= 3 && !this.holdTipShown.has(best.id)) {
          this.holdTipShown.add(best.id);
          this.holdTaps = 0;
          say('Tip: this one needs a long press. HOLD E (or hold the E button) until the scan bar fills up!', 'curious');
        }
      }
      return;
    }
    if (this.input.hit('KeyE', 'Enter')) this.use(best);
  }

  private use(it: Interactable): void {
    const p = this.player;
    p.facing = it.x > p.cx ? 1 : -1;
    p.act('interact', 0.4);
    audio.play('click');
    it.action();
  }

  // ---------------------------------------------------------------- cinematics
  private updateCinematic(dt: number): void {
    const c = this.cine!;
    c.t += dt;
    const p = this.player;
    if (c.name === 'wake') {
      if (c.step === 0) { p.state = 'lying'; if (c.t > 2.2) { c.step = 1; p.state = 'getup'; audio.play('land'); } }
      else if (c.step === 1 && c.t > 3.4) {
        c.step = 2;
        p.state = 'idle';
        say('Explorer! Are you okay? That storm damaged several systems.', 'worried');
        say("We've lost communication with Earth, and our energy reserves are running low.", 'worried');
        say("Don't worry. We can repair this place together. First, let's check the base!", 'happy', 'NOVA', () => {
          update((s) => { s.flags.woke = true; });
          this.endCinematic();
        });
      }
      return;
    }
    if (c.name === 'radiation') {
      if (c.t < 7 && Math.random() < 0.6) this.particles.add({ x: this.camX + VIEW_W + 4, y: 40 + Math.random() * 30, vx: -320, vy: 30, max: 1.6, color: Math.random() < 0.5 ? '#ffe08a' : '#ff9b6b', glow: true });
      if (c.step === 0) { c.step = 1; audio.play('alarm'); this.shake(1); }
      if (c.step === 1 && c.t > 3) { c.step = 2; say('The particle storm is passing over us right now. The water walls are soaking it up!', 'surprised'); }
      if (c.step === 2 && c.t > 6.5 && ui.dialogue.length === 0) {
        c.step = 3;
        say('All clear! Water and thick walls make great shields because they slow radiation down. Real Mars missions plan shelters like this.', 'celebrating', 'NOVA', () => {
          update((s) => { s.flags.shelterDone = true; s.dayLog.events.push({ kind: 'decision', text: 'Took cover in the radiation shelter' }); });
          this.endCinematic();
        });
      }
      return;
    }
    if (c.name === 'final') {
      if (c.step === 0) { c.step = 1; audio.play('transmit'); this.shake(0.6); }
      if (Math.random() < 0.7) this.particles.add({ x: this.base.dishX() + (Math.random() - 0.5) * 6, y: 60, vx: 40 + Math.random() * 30, vy: -120 - Math.random() * 60, max: 1.6, color: '#5ff3ff', glow: true, fade: true, size: 2 });
      if (c.step === 1 && c.t > 2.5) { c.step = 2; audio.play('sos'); say('Signal sent! Now we wait... radio waves are fast, but space is really, really big.', 'thinking'); }
      if (c.step === 2 && c.t > 5 && ui.dialogue.length === 0) {
        c.step = 3;
        audio.play('complete');
        say('"ARES-7, this is Mission Control. We hear you loud and clear! Great work, explorer."', 'celebrating', 'MISSION CONTROL', () => {
          this.endCinematic();
          import('../store/gameStore').then((m) => m.finishGame());
        });
      }
    }
  }

  // ---------------------------------------------------------------- rendering
  private render(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const sx = this.shakeT > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const camX = Math.round(this.camX) + sx;
    ctx.save();
    this.scene.drawBack(this, ctx, camX);
    this.drawPlayer(ctx, camX);
    this.drawNova(ctx, camX);
    this.particles.draw(ctx, camX, 0);
    this.scene.drawFront(this, ctx, camX);
    ctx.restore();
    this.drawGuideArrow(ctx, camX);
    this.drawPrompt(ctx, camX);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(6,4,18,${this.fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, camX: number): void {
    const p = this.player;
    const A = p.facing === 1 ? this.spr.astro : this.spr.astroL;
    const fr = (arr: HTMLCanvasElement[], fps: number) => arr[Math.floor(p.animT * fps) % arr.length];
    const x = Math.round(p.cx - 12 - camX), y = Math.round(p.feet - 24);
    if (p.state === 'lying') {
      ctx.save();
      ctx.translate(Math.round(p.cx - camX), Math.round(p.feet));
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(A.idle[0], -12, -24);
      ctx.restore();
      return;
    }
    let img: HTMLCanvasElement;
    switch (p.state) {
      case 'walk': img = fr(A.walk, 10); break;
      case 'jump': img = A.jump[0]; break;
      case 'fall': img = A.fall[0]; break;
      case 'land': img = A.land[0]; break;
      case 'interact': img = fr(A.interact, 6); break;
      case 'repair': img = fr(A.mine_multitool, 12); break;
      case 'getup': img = A.kneel[0]; break;
      default: img = fr(A.idle, 2.5);
    }
    ctx.drawImage(img, x, y);
    const carrying = getState().carrying;
    if (carrying) ctx.drawImage(this.spr.icons.water_container, x + 6, y - 12);
  }

  private drawNova(ctx: CanvasRenderingContext2D, camX: number): void {
    const n = this.nova;
    const frames = (n.vx < -5 || (Math.abs(n.vx) <= 5 && this.player.cx < n.x)) ? this.spr.novaL[n.mood] : this.spr.nova[n.mood];
    const blink = n.blink < 0 ? 2 : 0;
    const flame = Math.floor(n.t * 10) % 2;
    ctx.drawImage(frames[blink + flame], Math.round(n.x - 11 - camX), Math.round(n.y - 11));
    if (n.scan > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(95,243,255,0.18)';
      const dir = this.focus ? Math.sign(this.focus.x - n.x) || 1 : 1;
      ctx.beginPath();
      ctx.moveTo(n.x - camX, n.y);
      ctx.lineTo(n.x - camX + dir * 50, n.y + 40);
      ctx.lineTo(n.x - camX + dir * 50, n.y - 10);
      ctx.fill();
      ctx.restore();
    }
  }

  /** NOVA's guide arrow: bobs over the target, or waits at the screen edge pointing the way. */
  private drawGuideArrow(ctx: CanvasRenderingContext2D, camX: number): void {
    const g = this.guideArrow;
    if (!g || this.t > g.until || g.scene !== this.scene.kind || this.cine) return;
    const sx = g.x - camX;
    const bob = Math.round(Math.sin(this.t * 6) * 3);
    const col = Math.floor(this.t * 3) % 2 ? '#ffd43b' : '#ffffff';
    ctx.fillStyle = col;
    if (sx >= 12 && sx <= VIEW_W - 12) {
      const y = (this.scene.kind === 'base' ? 118 : 70) + bob;
      ctx.beginPath(); ctx.moveTo(sx - 7, y); ctx.lineTo(sx + 7, y); ctx.lineTo(sx, y + 9); ctx.closePath(); ctx.fill();
      ctx.fillRect(sx - 2, y - 8, 4, 8);
      drawText(ctx, g.label, Math.round(sx), y - 18, { align: 'center', color: col });
      if (Math.abs(g.x - this.player.cx) < 24) this.guideArrow = null;
    } else {
      const right = sx > VIEW_W;
      const x = right ? VIEW_W - 10 + bob : 10 - bob;
      const y = 96;
      ctx.beginPath();
      if (right) { ctx.moveTo(x - 9, y - 7); ctx.lineTo(x - 9, y + 7); ctx.lineTo(x, y); }
      else { ctx.moveTo(x + 9, y - 7); ctx.lineTo(x + 9, y + 7); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
      drawText(ctx, g.label, right ? VIEW_W - 22 : 22, y - 4, { align: right ? 'right' : 'left', color: col });
    }
  }

  private drawPrompt(ctx: CanvasRenderingContext2D, camX: number): void {
    const it = this.focus;
    if (!it || inputBlocked()) return;
    const touch = touchEnabled();
    const key = touch ? 'TAP' : it.hold ? 'HOLD E' : 'E';
    const label = it.label;
    const w = measure(label) + measure(key) + 18;
    const x = Math.round(clamp(it.x - camX - w / 2, 4, VIEW_W - w - 4));
    const y = Math.round(clamp(it.y - it.h - 18, 6, VIEW_H - 20));
    ctx.fillStyle = '#0b0816';
    ctx.fillRect(x - 1, y - 1, w + 2, 15);
    ctx.fillStyle = '#1e1840';
    ctx.fillRect(x, y, w, 13);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(x, y, w, 1);
    const kw = measure(key) + 6;
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(x + 3, y + 2, kw, 9);
    drawText(ctx, key, x + 6, y + 3, { color: '#1e1840', shadow: null });
    drawText(ctx, label, x + kw + 8, y + 3, { color: '#ffffff' });
    // little pointer
    const px = Math.round(clamp(it.x - camX, x + 4, x + w - 4));
    ctx.fillStyle = '#1e1840';
    ctx.fillRect(px - 2, y + 13, 5, 2);
    ctx.fillRect(px - 1, y + 15, 3, 1);
    if (it.hold && this.holdT > 0) {
      const k = clamp(this.holdT / it.hold, 0, 1);
      ctx.fillStyle = '#0b0816';
      ctx.fillRect(x, y + 17, w, 5);
      ctx.fillStyle = '#5ff3ff';
      ctx.fillRect(x + 1, y + 18, Math.round((w - 2) * k), 3);
      drawText(ctx, 'SCANNING...', x + w / 2, y + 24, { align: 'center', color: '#5ff3ff' });
    }
  }
}

export const tileAt = (px: number) => Math.floor(px / TILE);
export { lerp };
