import { makeCanvas, rect, px, line, outline, Canv, disc } from './canvas';

type Ctx = CanvasRenderingContext2D;

export interface Pose {
  by?: number; // body vertical offset
  lean?: number; // horizontal offset of upper body
  fdx?: number; fdy?: number; // front foot offset
  bdx?: number; bdy?: number; // back foot offset
  arm?: number; // front arm angle, radians from straight down, + = forward
  barm?: number; // back arm angle
  tool?: 'none' | 'multitool' | 'pickaxe';
  kneel?: boolean;
}

const SUIT = '#e8e6f2';
const SUIT_SH = '#b5b0c9';
const SUIT_DK = '#8f8aa8';
const VISOR = '#43d9ff';
const VISOR_HI = '#c8f8ff';
const ORANGE = '#ff8a3d';
const BOOT = '#3a3552';

function limb(ctx: Ctx, x: number, y: number, ang: number, len: number, col: string): [number, number] {
  const ex = x + Math.sin(ang) * len;
  const ey = y + Math.cos(ang) * len;
  line(ctx, x, y, ex, ey, col, 2);
  return [ex, ey];
}

export function drawAstronaut(ctx: Ctx, p: Pose): void {
  const by = p.by ?? 0;
  const ln = p.lean ?? 0;
  const tool = p.tool ?? 'none';
  const ox = 4; // canvas is 24 wide to fit tools; body occupies x 4..19
  // back arm
  const barm = p.barm ?? -(p.arm ?? 0) * 0.6;
  const [bhx, bhy] = limb(ctx, ox + 6 + ln, 10 + by, barm, 5, SUIT_DK);
  rect(ctx, bhx, bhy, 2, 2, '#77728f');
  // legs
  const hipY = 16 + by;
  if (p.kneel) {
    line(ctx, ox + 6, hipY, ox + 4, 21, SUIT_DK, 2);
    line(ctx, ox + 4, 21, ox + 1, 22, SUIT_DK, 2);
    line(ctx, ox + 8, hipY, ox + 11, 20, SUIT_SH, 2);
    line(ctx, ox + 11, 20, ox + 11, 22, SUIT_SH, 2);
    rect(ctx, ox + 0, 22, 3, 2, BOOT);
    rect(ctx, ox + 11, 22, 3, 2, BOOT);
  } else {
    const bfx = ox + 6 + (p.bdx ?? 0), bfy = 21 + (p.bdy ?? 0);
    line(ctx, ox + 6, hipY, bfx, bfy, SUIT_DK, 2);
    rect(ctx, bfx - 1, bfy + 1, 4, 2, '#2a2640');
    const ffx = ox + 8 + (p.fdx ?? 0), ffy = 21 + (p.fdy ?? 0);
    line(ctx, ox + 8, hipY, ffx, ffy, SUIT_SH, 2);
    rect(ctx, ffx - 1, ffy + 1, 4, 2, BOOT);
  }
  // backpack
  rect(ctx, ox + 2 + ln, 9 + by, 3, 7, '#8a86a3');
  rect(ctx, ox + 2 + ln, 9 + by, 1, 7, '#a7a3bf');
  px(ctx, ox + 3 + ln, 11 + by, ORANGE);
  px(ctx, ox + 3 + ln, 13 + by, '#43d9ff');
  // torso
  rect(ctx, ox + 5 + ln, 9 + by, 6, 7, SUIT);
  rect(ctx, ox + 5 + ln, 9 + by, 1, 7, '#ffffff');
  rect(ctx, ox + 10 + ln, 9 + by, 1, 7, SUIT_SH);
  rect(ctx, ox + 5 + ln, 15 + by, 6, 1, '#6b6688');
  px(ctx, ox + 8 + ln, 11 + by, ORANGE);
  px(ctx, ox + 9 + ln, 11 + by, VISOR);
  // helmet
  const hx = ox + 4 + ln, hy = 1 + by;
  rect(ctx, hx + 2, hy, 4, 1, SUIT);
  rect(ctx, hx + 1, hy + 1, 6, 1, SUIT);
  rect(ctx, hx, hy + 2, 8, 4, SUIT);
  rect(ctx, hx + 1, hy + 6, 6, 1, SUIT_SH);
  rect(ctx, hx + 2, hy + 7, 4, 1, '#6b6688');
  px(ctx, hx + 1, hy + 2, '#ffffff');
  px(ctx, hx + 2, hy + 1, '#ffffff');
  // visor (facing right)
  rect(ctx, hx + 4, hy + 2, 4, 3, VISOR);
  rect(ctx, hx + 4, hy + 5, 3, 1, '#2aa6d6');
  px(ctx, hx + 5, hy + 2, VISOR_HI);
  px(ctx, hx + 6, hy + 2, VISOR_HI);
  // front arm
  const arm = p.arm ?? 0;
  const sx = ox + 8 + ln, sy = 10 + by;
  const [hxx, hyy] = limb(ctx, sx, sy, arm, 5, '#d8d5e6');
  rect(ctx, hxx, hyy, 2, 2, SUIT_SH);
  if (tool === 'pickaxe') {
    const ex = hxx + 1 + Math.sin(arm) * 6, ey = hyy + 1 + Math.cos(arm) * 6;
    line(ctx, hxx + 1, hyy + 1, ex, ey, '#8a5a3c', 1);
    const pa = arm + Math.PI / 2;
    const hx1 = ex + Math.sin(pa) * 3, hy1 = ey + Math.cos(pa) * 3;
    const hx2 = ex - Math.sin(pa) * 3, hy2 = ey - Math.cos(pa) * 3;
    line(ctx, hx1, hy1, hx2, hy2, '#c3c9da', 2);
    px(ctx, hx1, hy1, '#ffffff');
  } else if (tool === 'multitool') {
    const ex = hxx + Math.sin(arm) * 3, ey = hyy + Math.cos(arm) * 3;
    rect(ctx, ex - 1, ey - 1, 3, 3, ORANGE);
    px(ctx, ex + Math.round(Math.sin(arm) * 2), ey + Math.round(Math.cos(arm) * 2), '#6ff3ff');
  }
}

function frame(p: Pose): Canv {
  const [c, ctx] = makeCanvas(24, 24);
  drawAstronaut(ctx, p);
  return outline(c);
}

export function buildAstronaut(): Record<string, Canv[]> {
  const f: Record<string, Canv[]> = {};
  f.idle = [0, 0, 1, 1].map((b) => frame({ by: b, arm: 0.12, barm: -0.1 }));
  f.walk = [0, 1, 2, 3, 4, 5].map((i) => {
    const ph = (i / 6) * Math.PI * 2;
    const s = Math.sin(ph);
    return frame({
      by: i % 3 === 1 ? -1 : 0,
      fdx: Math.round(s * 3), fdy: s > 0.3 ? -1 : 0,
      bdx: Math.round(-s * 3), bdy: s < -0.3 ? -1 : 0,
      arm: -s * 0.7, barm: s * 0.7,
    });
  });
  f.run = [0, 1, 2, 3, 4, 5].map((i) => {
    const ph = (i / 6) * Math.PI * 2;
    const s = Math.sin(ph);
    return frame({
      by: i % 3 === 1 ? -1 : 0, lean: 1,
      fdx: Math.round(s * 4), fdy: s > 0.2 ? -2 : 0,
      bdx: Math.round(-s * 4), bdy: s < -0.2 ? -2 : 0,
      arm: 0.4 - s * 1.1, barm: 0.4 + s * 1.1,
    });
  });
  f.jump = [frame({ by: -1, fdx: 2, fdy: -3, bdx: -1, bdy: -2, arm: 2.4, barm: 2.0 })];
  f.fall = [frame({ by: 0, fdx: 2, fdy: -1, bdx: -3, bdy: 0, arm: 1.8, barm: -1.6 })];
  f.land = [frame({ by: 2, fdx: 3, bdx: -3, arm: 0.9, barm: -0.9 })];
  const mineAngles = [2.8, 2.1, 1.3, 0.55];
  f.mine_multitool = mineAngles.map((a) => frame({ arm: a, tool: 'multitool', lean: a < 1.5 ? 1 : 0 }));
  f.mine_pickaxe = mineAngles.map((a) => frame({ arm: a, tool: 'pickaxe', lean: a < 1.5 ? 1 : 0 }));
  f.use = [frame({ arm: 1.3, lean: 1 }), frame({ arm: 1.6, lean: 1 })];
  f.interact = [frame({ arm: 1.2, lean: 1, fdx: 1 }), frame({ arm: 1.55, lean: 1, fdx: 1 })];
  f.hurt = [frame({ by: 0, lean: -1, arm: 2.7, barm: 2.4, fdx: -1, bdx: -2 })];
  f.kneel = [frame({ by: 4, kneel: true, arm: 0.6, barm: 0.3 })];
  return f;
}

// ---------- B-07 robot ----------
export function buildRobot(): Canv[] {
  const frames: Canv[] = [];
  for (let eye = 0; eye < 2; eye++) {
    for (let fl = 0; fl < 2; fl++) {
      const [c, ctx] = makeCanvas(14, 14);
      const B = '#d8d5e6', S = '#a39fbd';
      rect(ctx, 5, 2, 4, 1, B);
      rect(ctx, 4, 3, 6, 1, B);
      rect(ctx, 3, 4, 8, 4, B);
      rect(ctx, 4, 8, 6, 1, S);
      rect(ctx, 5, 9, 4, 1, S);
      px(ctx, 4, 4, '#ffffff'); px(ctx, 5, 3, '#ffffff');
      // eye socket
      rect(ctx, 6, 4, 4, 3, '#120e22');
      if (eye === 0) { rect(ctx, 7, 5, 2, 1, '#43d9ff'); px(ctx, 8, 4, '#c8f8ff'); }
      else rect(ctx, 6, 5, 4, 1, '#2aa6d6');
      // fins
      rect(ctx, 2, 5, 1, 2, '#8a86a3');
      rect(ctx, 11, 5, 1, 2, '#8a86a3');
      // antenna
      px(ctx, 6, 1, '#8a86a3');
      // thruster
      rect(ctx, 6, 10, 2, 1, '#77728f');
      if (fl === 0) { rect(ctx, 6, 11, 2, 1, '#ff9b3d'); px(ctx, 6, 12, '#ffe08a'); }
      else { rect(ctx, 6, 11, 2, 2, '#ff9b3d'); px(ctx, 7, 13, '#ffe08a'); }
      frames.push(outline(c));
    }
  }
  return frames;
}

export function buildPortrait(robot: Canv): Canv {
  const [c, ctx] = makeCanvas(28, 28);
  rect(ctx, 0, 0, 28, 28, '#120e22');
  rect(ctx, 1, 1, 26, 26, '#241c44');
  disc(ctx, 14, 14, 11, '#2e2458');
  ctx.drawImage(robot, 0, 0, 14, 14, 0, 0, 28, 28);
  return c;
}
