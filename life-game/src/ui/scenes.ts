// 每一幕的动态画面:新中式水墨淡彩,Canvas 现场绘制。
// 光线随钟点变化(清晨粉金、正午明亮、傍晚橘红、深夜黛蓝),雨、热气、灯火、烟花都在动,
// 并且会回应玩家的手势(撑伞、吹凉、拆信、转钥匙、点灯笼)。
import type { PlaceId } from '../engine/story.ts';

/** 手势带来的画面状态,0 到 1 */
export interface SceneState {
  open: number;   // 伞撑开
  share: number;  // 走过去分伞
  cool: number;   // 豆浆吹凉
  wind: number;   // 吹气的风
  ring: number;   // 风铃晃动
  tear: number;   // 信封拆开
  turn: number;   // 钥匙转动
  lit: number;    // 灯点亮
}

export const newSceneState = (): SceneState => ({ open: 0, share: 0, cool: 0, wind: 0, ring: 0, tear: 0, turn: 0, lit: 0 });

export interface SceneSpec {
  id: string;
  place: PlaceId;
  hour: number;
  rain: boolean;
}

type Ctx = CanvasRenderingContext2D;
export type Draw = (ctx: Ctx, w: number, h: number, t: number) => void;

/* ---------------- 工具 ---------------- */

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
type RGB = [number, number, number];
const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function poly(ctx: Ctx, pts: number[][], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function vgrad(ctx: Ctx, y0: number, y1: number, stops: Array<[number, string]>) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: RGB, a: number) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, css(color, a));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** 可重复的伪随机,保证每帧画出来的窗户、星星位置不变 */
function prand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 天色 ---------------- */

interface Light {
  top: RGB;
  bottom: RGB;
  night: number;
  /** 太阳高度 -1..1,负数表示在地平线下 */
  sun: number;
  /** 整体色调,用来染墙和地面 */
  tint: RGB;
}

// 每个钟点的天色:顶部、底部、夜色程度
const SKY: Record<number, [string, string, number]> = {
  4: ['#1e2a44', '#4b4a66', 0.85],
  5: ['#3b4670', '#c99a9a', 0.55],
  6: ['#8fa3c4', '#f2c6a0', 0.2],
  7: ['#a9c0d6', '#f5dcc0', 0.05],
  9: ['#a8c4d8', '#eef0e6', 0],
  12: ['#9cc0d8', '#f1f2ea', 0],
  15: ['#a8bfd0', '#f2e2c4', 0],
  17: ['#b49cb0', '#f2b88a', 0.1],
  18: ['#7d6f95', '#ee9a72', 0.25],
  19: ['#3e4672', '#a87888', 0.55],
  20: ['#1f2a4a', '#3f4668', 0.85],
  23: ['#141b30', '#2a3150', 1],
  27: ['#141b30', '#2a3150', 1],
  28: ['#1e2a44', '#4b4a66', 0.85],
};

function lightAt(hour: number): Light {
  const h = hour < 4 ? hour + 24 : hour;
  const keys = Object.keys(SKY).map(Number).sort((a, b) => a - b);
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (h >= keys[i] && h <= keys[i + 1]) { a = keys[i]; b = keys[i + 1]; break; }
  const k = b === a ? 0 : (h - a) / (b - a);
  const top = mix(hex(SKY[a][0]), hex(SKY[b][0]), k);
  const bottom = mix(hex(SKY[a][1]), hex(SKY[b][1]), k);
  const night = lerp(SKY[a][2], SKY[b][2], k);
  const sun = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : -0.5;
  return { top, bottom, night, sun, tint: mix(bottom, top, 0.5) };
}

/** 被天色染过的固有色 */
function shade(L: Light, base: string, amount = 0.35): string {
  const c = mix(hex(base), L.tint, amount * 0.5);
  return css(mix(c, [24, 30, 48], L.night * 0.62));
}

function drawSky(ctx: Ctx, L: Light, x: number, y: number, w: number, h: number, t: number, seed: number) {
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, css(L.top)], [1, css(L.bottom)]]);
  ctx.fillRect(x, y, w, h);
  if (L.night > 0.4) {
    const r = prand(seed);
    for (let i = 0; i < 40; i++) {
      const sx = x + r() * w, sy = y + r() * h * 0.7, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,246,220,${(L.night - 0.4) * tw})`;
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }
    // 月亮
    const mx = x + w * 0.78, my = y + h * 0.22, mr = Math.min(w, h) * 0.06;
    glow(ctx, mx, my, mr * 4, [255, 236, 200], 0.18 * L.night);
    ctx.fillStyle = `rgba(250,238,210,${L.night})`;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(L.top, L.night);
    ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, Math.PI * 2); ctx.fill();
  }
  if (L.sun > -0.2) {
    const sx = x + w * 0.25, sy = y + h * (0.95 - Math.max(0, L.sun) * 0.7);
    const warm: RGB = L.sun < 0.4 ? [255, 190, 130] : [255, 244, 214];
    glow(ctx, sx, sy, Math.min(w, h) * 0.35, warm, 0.45);
    ctx.fillStyle = css(warm, 0.95);
    ctx.beginPath(); ctx.arc(sx, sy, Math.min(w, h) * 0.05, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------------- 建筑与人物 ---------------- */

/** 徽派马头墙:白墙 + 黛瓦压顶 + 两端跌落的马头 */
function huiHouse(ctx: Ctx, x: number, ground: number, bw: number, bh: number, wall: string, cap: string, windows?: { lit: number; seed: number }) {
  ctx.fillStyle = wall;
  ctx.fillRect(x, ground - bh, bw, bh);
  const st = bh * 0.2, sw = bw * 0.2;
  ctx.fillRect(x, ground - bh - st, sw, st);
  ctx.fillRect(x + bw - sw, ground - bh - st, sw, st);
  ctx.fillRect(x + sw * 0.6, ground - bh - st * 1.8, sw * 0.9, st * 1.8);
  const capLine = (cx: number, cy: number, cw: number) => {
    ctx.fillStyle = cap;
    ctx.fillRect(cx - 3, cy - 3, cw + 6, 4);
    poly(ctx, [[cx - 6, cy - 6], [cx - 1, cy - 3], [cx - 3, cy + 1]], cap);
    poly(ctx, [[cx + cw + 6, cy - 6], [cx + cw + 1, cy - 3], [cx + cw + 3, cy + 1]], cap);
  };
  capLine(x + sw, ground - bh, bw - sw * 2);
  capLine(x, ground - bh - st, sw);
  capLine(x + bw - sw, ground - bh - st, sw);
  capLine(x + sw * 0.6, ground - bh - st * 1.8, sw * 0.9);
  if (windows) {
    const r = prand(windows.seed);
    const n = Math.max(1, Math.floor(bw / 26));
    for (let i = 0; i < n; i++) {
      const on = r() < 0.6 && windows.lit > 0.3;
      ctx.fillStyle = on ? `rgba(246,190,110,${0.5 + windows.lit * 0.5})` : 'rgba(40,46,52,0.55)';
      ctx.fillRect(x + (bw / n) * (i + 0.35), ground - bh * 0.62, bw / n * 0.3, bh * 0.22);
    }
  }
}

function figure(ctx: Ctx, x: number, y: number, s: number, color: string, bag?: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y - s * 0.82, s * 0.16, 0, Math.PI * 2); ctx.fill();
  poly(ctx, [[x - s * 0.2, y - s * 0.62], [x + s * 0.2, y - s * 0.62], [x + s * 0.26, y - s * 0.12], [x - s * 0.26, y - s * 0.12]], color);
  ctx.fillRect(x - s * 0.16, y - s * 0.14, s * 0.1, s * 0.14);
  ctx.fillRect(x + s * 0.06, y - s * 0.14, s * 0.1, s * 0.14);
  if (bag) { ctx.fillStyle = bag; ctx.fillRect(x - s * 0.17, y - s * 0.6, s * 0.34, s * 0.3); }
}

function lantern(ctx: Ctx, x: number, y: number, r: number, t: number, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.3) * 0.07);
  ctx.strokeStyle = '#2f2a26';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(0, -r); ctx.stroke();
  glow(ctx, 0, 0, r * 3.2, [255, 160, 100], 0.15 + lit * 0.45);
  ctx.fillStyle = lit > 0.5 ? '#d2452f' : '#9c3a2a';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f2a26';
  ctx.fillRect(-r * 0.45, -r * 1.05, r * 0.9, r * 0.18);
  ctx.fillRect(-r * 0.45, r * 0.9, r * 0.9, r * 0.18);
  ctx.strokeStyle = '#d9a441';
  ctx.beginPath(); ctx.moveTo(0, r * 1.08); ctx.lineTo(0, r * 1.7); ctx.stroke();
  ctx.restore();
}

/* ---------------- 粒子:雨、热气、烟花 ---------------- */

function makeRain(n: number) {
  const drops = Array.from({ length: n }, () => ({ x: Math.random() * 1.1, y: Math.random(), v: 0.8 + Math.random() * 0.6, l: 0.03 + Math.random() * 0.03 }));
  return (ctx: Ctx, w: number, h: number, shelter?: (x: number, y: number) => boolean) => {
    ctx.strokeStyle = 'rgba(232,238,242,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      d.y += d.v * 0.022;
      d.x -= 0.0016;
      const x = d.x * w, y = d.y * h;
      if (d.y > 1.02 || shelter?.(x, y)) { d.y = -0.05 - Math.random() * 0.1; d.x = Math.random() * 1.1; continue; }
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + d.l * h);
    }
    ctx.stroke();
  };
}

function makeSteam() {
  const ps: Array<{ x: number; y: number; vx: number; vy: number; a: number; r: number; ph: number }> = [];
  return (ctx: Ctx, t: number, sources: Array<[number, number, number, number]>, wind: number) => {
    for (const [sx, sy, spread, rate] of sources) {
      if (Math.random() < rate) ps.push({ x: sx + (Math.random() - 0.5) * spread, y: sy, vx: 0, vy: -0.45 - Math.random() * 0.4, a: 0.45, r: 5 + Math.random() * 6, ph: Math.random() * 6 });
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.vx += wind * 0.12;
      p.x += p.vx + Math.sin(t * 2 + p.ph) * 0.35;
      p.y += p.vy;
      p.r += 0.14;
      p.a -= 0.006 + wind * 0.004;
      if (p.a <= 0) { ps.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,255,255,${p.a * 0.5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  };
}

function makeFireworks() {
  const sparks: Array<{ x: number; y: number; vx: number; vy: number; a: number; c: RGB }> = [];
  let next = 0;
  return (ctx: Ctx, w: number, h: number, t: number, on: boolean, clip?: () => void) => {
    if (on && t > next) {
      next = t + 0.9 + Math.random() * 1.2;
      const cx = w * (0.2 + Math.random() * 0.6), cy = h * (0.12 + Math.random() * 0.25);
      const colors: RGB[] = [[255, 196, 120], [235, 90, 70], [255, 230, 170], [150, 210, 190]];
      const c = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2, v = 1.2 + Math.random() * 1.4;
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: 1, c });
      }
    }
    ctx.save();
    clip?.();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.vx *= 0.985; p.a -= 0.014;
      if (p.a <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = css(p.c, p.a);
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.restore();
  };
}

/* ---------------- 九种地点 ---------------- */

/** 家:月洞窗、风铃、书桌。很多幕都发生在这里,靠窗外的天色和手边的物件区分 */
function home(spec: SceneSpec, s: SceneState): Draw {
  const fw = makeFireworks();
  const steam = makeSteam();
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    const lampOn = spec.id === 'firsthome' ? s.lit : L.night > 0.3 ? 1 : 0;
    ctx.fillStyle = shade(L, '#e8e0cf', 0.6);
    ctx.fillRect(0, 0, w, h);
    // 墙上的木纹护墙板
    ctx.fillStyle = shade(L, '#7a5a40', 0.4);
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    const cx = w * 0.38, cy = h * 0.4, R = Math.min(w, h) * 0.3;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    drawSky(ctx, L, cx - R, cy - R, R * 2, R * 2, t, 7);
    const roof = shade(L, '#9aa3a5', 0.2);
    huiHouse(ctx, cx - R, cy + R * 0.8, R * 0.8, R * 0.32, roof, '#3a3f45', { lit: L.night, seed: 3 });
    huiHouse(ctx, cx - R * 0.1, cy + R * 0.9, R * 1.1, R * 0.26, shade(L, '#b8bdbb', 0.25), '#3a3f45', { lit: L.night, seed: 4 });
    fw(ctx, w, h, t, spec.id === 'newyear' && s.lit > 0.5);
    ctx.restore();
    // 窗框
    ctx.strokeStyle = shade(L, '#5c3f2b', 0.2);
    ctx.lineWidth = R * 0.08;
    ctx.beginPath(); ctx.arc(cx, cy, R + R * 0.04, 0, Math.PI * 2); ctx.stroke();
    // 风铃
    s.ring *= 0.985;
    const sway = Math.sin(t * 1.5) * 0.08 + s.ring * Math.sin(t * 9) * 0.25;
    ctx.save();
    ctx.translate(cx + R * 0.5, cy - R * 0.92);
    ctx.rotate(sway);
    ctx.strokeStyle = '#cdb98e'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R * 0.2); ctx.stroke();
    ctx.fillStyle = '#c8a45c'; ctx.beginPath(); ctx.ellipse(0, R * 0.2, R * 0.09, R * 0.026, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = '#d9bf7f'; ctx.fillRect(i * R * 0.034 - 1.5, R * 0.22, 3, R * (0.15 + (2 - Math.abs(i)) * 0.035)); }
    ctx.fillStyle = '#b33f2e'; ctx.fillRect(-R * 0.025, R * 0.44, R * 0.05, R * 0.1);
    ctx.restore();
    // 灯笼(过年)
    if (spec.id === 'newyear') lantern(ctx, w * 0.82, h * 0.26, h * 0.07, t, s.lit);
    // 台灯
    const lx = w * 0.82, ly = h * 0.62;
    if (lampOn > 0) glow(ctx, lx, ly, w * 0.45, [255, 196, 120], 0.35 * lampOn);
    ctx.fillStyle = '#3d3029';
    ctx.fillRect(lx - 2, ly, 4, h * 0.12);
    poly(ctx, [[lx - w * 0.06, ly], [lx + w * 0.06, ly], [lx + w * 0.035, ly - h * 0.08], [lx - w * 0.035, ly - h * 0.08]], lampOn ? '#f3d9a4' : '#c9b48c');
    // 书桌
    ctx.fillStyle = shade(L, '#6b4a33', 0.2);
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, h * 0.8, w, 3);
    if (spec.id === 'dawn' || spec.id === 'subject' || spec.id === 'exam') {
      poly(ctx, [[w * 0.22, h * 0.86], [w * 0.47, h * 0.84], [w * 0.47, h * 0.97], [w * 0.18, h * 0.97]], '#efe6d2');
      poly(ctx, [[w * 0.47, h * 0.84], [w * 0.72, h * 0.86], [w * 0.76, h * 0.97], [w * 0.47, h * 0.97]], '#f6efe0');
      ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * 0.24, h * (0.86 + i * 0.025)); ctx.lineTo(w * 0.44, h * (0.85 + i * 0.025)); ctx.stroke(); }
    }
    if (spec.id === 'exam') {
      // 桌角那碗面
      ctx.fillStyle = '#f6f3ec'; ctx.beginPath(); ctx.ellipse(w * 0.88, h * 0.86, w * 0.07, h * 0.02, 0, 0, Math.PI * 2); ctx.fill();
      poly(ctx, [[w * 0.81, h * 0.86], [w * 0.95, h * 0.86], [w * 0.92, h * 0.92], [w * 0.84, h * 0.92]], '#f6f3ec');
      steam(ctx, t, [[w * 0.88, h * 0.85, w * 0.06, 0.3]], 0);
    }
    if (spec.id === 'firsthome') {
      // 钥匙
      ctx.save();
      ctx.translate(w * 0.56, h * 0.9);
      ctx.rotate(-0.3 + s.turn * Math.PI * 0.5);
      ctx.strokeStyle = '#c8a24f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, h * 0.035, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(h * 0.035, 0); ctx.lineTo(h * 0.12, 0); ctx.moveTo(h * 0.1, 0); ctx.lineTo(h * 0.1, h * 0.02); ctx.stroke();
      ctx.restore();
    }
    // 夜里整体压暗一点
    if (L.night > 0) { ctx.fillStyle = `rgba(16,20,36,${L.night * 0.18 * (1 - lampOn * 0.5)})`; ctx.fillRect(0, 0, w, h); }
  };
}

/** 厨房:灶台、锅里冒热气、格子窗 */
function kitchen(spec: SceneSpec, _s: SceneState): Draw {
  const steam = makeSteam();
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    ctx.fillStyle = shade(L, '#e9e1d0', 0.5);
    ctx.fillRect(0, 0, w, h);
    // 窗
    const wx = w * 0.56, wy = h * 0.12, ww = w * 0.34, wh = h * 0.34;
    drawSky(ctx, L, wx, wy, ww, wh, t, 11);
    huiHouse(ctx, wx - 10, wy + wh, ww * 0.6, wh * 0.4, shade(L, '#c3c6c0', 0.2), '#3a3f45');
    ctx.strokeStyle = shade(L, '#5c3f2b', 0.1); ctx.lineWidth = 4;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(wx + (ww / 3) * i, wy); ctx.lineTo(wx + (ww / 3) * i, wy + wh); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    // 瓷砖墙
    ctx.strokeStyle = 'rgba(120,110,95,0.18)'; ctx.lineWidth = 1;
    for (let y = h * 0.5; y < h * 0.66; y += h * 0.04) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // 灶台
    ctx.fillStyle = shade(L, '#8c8478', 0.3); ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.fillStyle = shade(L, '#b5ab98', 0.3); ctx.fillRect(0, h * 0.64, w, h * 0.04);
    // 锅
    const px = w * 0.3, py = h * 0.62;
    ctx.fillStyle = '#2b2725';
    ctx.beginPath(); ctx.ellipse(px, py, w * 0.15, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    poly(ctx, [[px - w * 0.15, py], [px + w * 0.15, py], [px + w * 0.12, py + h * 0.07], [px - w * 0.12, py + h * 0.07]], '#3a3532');
    glow(ctx, px, py + h * 0.1, w * 0.12, [255, 140, 60], 0.35 + 0.1 * Math.sin(t * 6));
    // 案板上的番茄和鸡蛋
    ctx.fillStyle = '#c8a06a'; ctx.fillRect(w * 0.55, h * 0.6, w * 0.3, h * 0.05);
    ctx.fillStyle = '#c9402c'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.585, h * 0.028, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9402c'; ctx.beginPath(); ctx.arc(w * 0.69, h * 0.59, h * 0.024, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3ead8'; ctx.beginPath(); ctx.ellipse(w * 0.77, h * 0.59, h * 0.018, h * 0.024, 0, 0, Math.PI * 2); ctx.fill();
    steam(ctx, t, [[px, py - h * 0.02, w * 0.2, 0.55]], 0);
    if (L.night > 0.3) { glow(ctx, w * 0.5, h * 0.05, w * 0.5, [255, 210, 150], 0.25); ctx.fillStyle = '#f3dca8'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.04, 6, 0, Math.PI * 2); ctx.fill(); }
  };
}

/** 早餐摊:红白雨棚、蒸笼、王叔、近处的一碗豆浆;夜里收摊只剩一盏灯 */
function market(spec: SceneSpec, s: SceneState): Draw {
  const steam = makeSteam();
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    drawSky(ctx, L, 0, 0, w, h * 0.5, t, 21);
    huiHouse(ctx, -w * 0.05, h * 0.5, w * 0.4, h * 0.26, shade(L, '#efe5d3'), '#5d5048', { lit: L.night, seed: 5 });
    huiHouse(ctx, w * 0.62, h * 0.5, w * 0.45, h * 0.3, shade(L, '#efe5d3'), '#5d5048', { lit: L.night, seed: 6 });
    ctx.fillStyle = shade(L, '#d9c7a6'); ctx.fillRect(0, h * 0.5, w, h * 0.5);
    const closing = L.night > 0.6;
    const ax = w * 0.12, aw = w * 0.76, ay = h * 0.16;
    for (let i = 0; i < 8; i++) poly(ctx, [[ax + (aw / 8) * i, ay], [ax + (aw / 8) * (i + 1), ay], [ax + (aw / 8) * (i + 1) + 6, ay + h * 0.1], [ax + (aw / 8) * i + 6, ay + h * 0.1]], i % 2 ? shade(L, '#f7efe2') : shade(L, '#b33f2e', 0.2));
    ctx.fillStyle = '#4b3a2e'; ctx.fillRect(ax + 4, ay + h * 0.1, 3, h * 0.3); ctx.fillRect(ax + aw, ay + h * 0.1, 3, h * 0.3);
    if (closing) {
      // 一盏灯、叠起来的小板凳
      glow(ctx, w * 0.5, h * 0.3, w * 0.4, [255, 200, 130], 0.5);
      ctx.fillStyle = '#f7d79a'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.3, 7, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = shade(L, '#a0522d', 0.1); ctx.fillRect(w * 0.66, h * (0.6 - i * 0.035), w * 0.12, h * 0.02); }
    } else {
      const bob = Math.sin(t * 2) * 1.5;
      ctx.fillStyle = '#3e3b37';
      ctx.beginPath(); ctx.arc(w * 0.56, h * 0.36 + bob, h * 0.045, 0, Math.PI * 2); ctx.fill();
      poly(ctx, [[w * 0.5, h * 0.41 + bob], [w * 0.62, h * 0.41 + bob], [w * 0.65, h * 0.56], [w * 0.47, h * 0.56]], '#3e3b37');
      poly(ctx, [[w * 0.52, h * 0.44 + bob], [w * 0.6, h * 0.44 + bob], [w * 0.61, h * 0.56], [w * 0.51, h * 0.56]], '#e9e1d2');
    }
    ctx.fillStyle = shade(L, '#8a5d3d', 0.2); ctx.fillRect(w * 0.1, h * 0.55, w * 0.8, h * 0.08);
    ctx.fillStyle = shade(L, '#6f4a30', 0.2); ctx.fillRect(w * 0.1, h * 0.63, w * 0.8, h * 0.12);
    for (let i = 0; i < 3; i++) {
      const y = h * 0.55 - i * h * 0.055;
      ctx.fillStyle = shade(L, '#c9a46a', 0.2); ctx.fillRect(w * 0.18, y - h * 0.05, w * 0.18, h * 0.05);
      ctx.strokeStyle = '#8c6c3e'; ctx.strokeRect(w * 0.18, y - h * 0.05, w * 0.18, h * 0.05);
    }
    ctx.fillStyle = '#2e2b29'; ctx.beginPath(); ctx.ellipse(w * 0.76, h * 0.55, w * 0.09, h * 0.025, 0, 0, Math.PI * 2); ctx.fill();
    // 近处的桌面和一碗豆浆
    ctx.fillStyle = shade(L, '#a3754f', 0.2); ctx.fillRect(0, h * 0.82, w, h * 0.18);
    const bx = w * 0.5, by = h * 0.85;
    poly(ctx, [[bx - w * 0.16, by - h * 0.02], [bx + w * 0.16, by - h * 0.02], [bx + w * 0.11, by + h * 0.1], [bx - w * 0.11, by + h * 0.1]], '#f6f3ec');
    ctx.fillStyle = '#2f5d86'; ctx.fillRect(bx - w * 0.145, by + h * 0.015, w * 0.29, h * 0.014);
    ctx.fillStyle = '#f6f3ec'; ctx.beginPath(); ctx.ellipse(bx, by - h * 0.02, w * 0.16, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#efe0c2'; ctx.beginPath(); ctx.ellipse(bx, by - h * 0.018, w * 0.14, h * 0.026, 0, 0, Math.PI * 2); ctx.fill();
    s.wind *= 0.95;
    steam(ctx, t, [[bx, by - h * 0.03, w * 0.12, (1 - s.cool) * 0.5], [w * 0.27, h * 0.39, w * 0.12, closing ? 0.05 : 0.35]], s.wind);
  };
}

/** 学校:教学楼、旗杆、操场边的梧桐 */
function school(spec: SceneSpec, _s: SceneState): Draw {
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    drawSky(ctx, L, 0, 0, w, h * 0.62, t, 31);
    // 教学楼
    const bx = w * 0.18, bw = w * 0.64, by = h * 0.2, bh = h * 0.42;
    ctx.fillStyle = shade(L, '#e6dccb'); ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = shade(L, '#b5402f', 0.3); ctx.fillRect(bx, by, bw, h * 0.03);
    const r = prand(9);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      const on = L.night > 0.3 && r() < 0.4;
      ctx.fillStyle = on ? 'rgba(246,200,120,0.9)' : shade(L, '#7f97a6', 0.2);
      ctx.fillRect(bx + bw * (0.04 + col * 0.12), by + bh * (0.15 + row * 0.2), bw * 0.07, bh * 0.11);
    }
    ctx.fillStyle = shade(L, '#4a3b30'); ctx.fillRect(bx + bw * 0.45, by + bh * 0.75, bw * 0.1, bh * 0.25);
    // 地面和跑道
    ctx.fillStyle = shade(L, '#c9b48e'); ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = shade(L, '#b65a43', 0.3); ctx.fillRect(0, h * 0.8, w, h * 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(0, h * 0.83); ctx.lineTo(w, h * 0.83); ctx.stroke(); ctx.setLineDash([]);
    // 旗杆
    ctx.fillStyle = '#5b5550'; ctx.fillRect(w * 0.9, h * 0.15, 2, h * 0.5);
    const wave = Math.sin(t * 3) * 3;
    poly(ctx, [[w * 0.9 + 2, h * 0.15], [w * 0.9 + 26, h * 0.16 + wave], [w * 0.9 + 26, h * 0.21 + wave], [w * 0.9 + 2, h * 0.2]], '#c9402c');
    // 梧桐
    ctx.fillStyle = shade(L, '#5a4636'); ctx.fillRect(w * 0.08, h * 0.45, 6, h * 0.25);
    for (const [dx, dy, rr] of [[0, 0.4, 0.09], [-0.05, 0.46, 0.07], [0.05, 0.47, 0.075]]) {
      ctx.fillStyle = shade(L, '#6f8a5a', 0.3);
      ctx.beginPath(); ctx.arc(w * (0.085 + dx), h * dy + Math.sin(t + dx * 10) * 1.5, w * rr, 0, Math.PI * 2); ctx.fill();
    }
  };
}

/** 河边公园:垂柳、亭子、河面、风筝 */
function park(spec: SceneSpec, _s: SceneState): Draw {
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    drawSky(ctx, L, 0, 0, w, h * 0.6, t, 41);
    // 远山
    ctx.fillStyle = shade(L, '#9fb0aa', 0.2);
    ctx.beginPath(); ctx.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, h * (0.44 + 0.05 * Math.sin(x / w * 7)));
    ctx.lineTo(w, h * 0.6); ctx.lineTo(0, h * 0.6); ctx.fill();
    // 亭子
    const px = w * 0.72, py = h * 0.56;
    poly(ctx, [[px - w * 0.12, py - h * 0.16], [px + w * 0.12, py - h * 0.16], [px + w * 0.07, py - h * 0.22], [px - w * 0.07, py - h * 0.22]], shade(L, '#3a3f45', 0.1));
    poly(ctx, [[px - w * 0.14, py - h * 0.15], [px - w * 0.12, py - h * 0.17], [px + w * 0.12, py - h * 0.17], [px + w * 0.14, py - h * 0.15]], shade(L, '#3a3f45', 0.1));
    ctx.fillStyle = shade(L, '#8a3b2d', 0.2);
    ctx.fillRect(px - w * 0.09, py - h * 0.15, 4, h * 0.15); ctx.fillRect(px + w * 0.085, py - h * 0.15, 4, h * 0.15);
    // 河
    ctx.fillStyle = vgrad(ctx, h * 0.6, h, [[0, shade(L, '#9db7bd', 0.3)], [1, shade(L, '#6f8e96', 0.3)]]);
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = h * (0.66 + i * 0.04), off = (t * 12 + i * 37) % w;
      ctx.beginPath(); ctx.moveTo(off - 30, y); ctx.lineTo(off, y); ctx.stroke();
    }
    if (L.night > 0.4) { ctx.fillStyle = 'rgba(250,238,210,0.25)'; ctx.fillRect(w * 0.74, h * 0.62, 6, h * 0.3); }
    // 岸和长椅
    ctx.fillStyle = shade(L, '#7c8a6a', 0.3); ctx.fillRect(0, h * 0.86, w, h * 0.14);
    ctx.fillStyle = shade(L, '#5b4636'); ctx.fillRect(w * 0.42, h * 0.84, w * 0.2, h * 0.02); ctx.fillRect(w * 0.43, h * 0.86, 3, h * 0.05); ctx.fillRect(w * 0.6, h * 0.86, 3, h * 0.05);
    // 垂柳
    ctx.strokeStyle = shade(L, '#4a3a2e'); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(w * 0.12, h); ctx.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.2, h * 0.12); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = shade(L, '#7d9a5d', 0.3);
    for (let i = 0; i < 24; i++) {
      const sx = w * (0.08 + i * 0.012), sy = h * (0.12 + (i % 5) * 0.02), sway = Math.sin(t * 1.2 + i) * 6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + sway, sy + h * 0.25, sx + sway * 1.5, sy + h * (0.35 + (i % 3) * 0.05)); ctx.stroke();
    }
    // 风筝(白天)
    if (L.night < 0.3) {
      const kx = w * 0.55 + Math.sin(t * 0.8) * 10, ky = h * 0.18 + Math.cos(t) * 5;
      poly(ctx, [[kx, ky - 14], [kx + 11, ky], [kx, ky + 16], [kx - 11, ky]], '#c9402c');
      ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.beginPath(); ctx.moveTo(kx, ky + 16); ctx.quadraticCurveTo(kx - 20, h * 0.5, w * 0.45, h * 0.86); ctx.stroke();
    }
  };
}

/** 巷子:青石板、马头墙、灯笼;下雨时有你和小红伞,深夜有便利店的光 */
function street(spec: SceneSpec, s: SceneState): Draw {
  const rain = makeRain(150);
  const ripples: Array<{ x: number; y: number; r: number; a: number }> = [];
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    const sky = spec.rain ? { ...L, top: mix(L.top, [127, 145, 152], 0.7), bottom: mix(L.bottom, [205, 210, 202], 0.7), sun: -1 } : L;
    drawSky(ctx, sky, 0, 0, w, h * 0.62, t, 51);
    const g1 = h * 0.5;
    [[0.02, 0.22, 0.2], [0.2, 0.18, 0.26], [0.4, 0.26, 0.18], [0.62, 0.2, 0.24], [0.8, 0.24, 0.2]].forEach(([fx, fw, fh], i) => huiHouse(ctx, fx * w, g1, fw * w, fh * h, shade(sky, '#c4c9c3', 0.4), shade(sky, '#8d979a', 0.2), { lit: sky.night, seed: 60 + i }));
    ctx.fillStyle = css(sky.bottom, 0.45); ctx.fillRect(0, 0, w, g1);
    poly(ctx, [[0, h], [w, h], [w * 0.64, h * 0.52], [w * 0.44, h * 0.52]], shade(sky, '#7b8588', 0.3));
    ctx.strokeStyle = 'rgba(40,50,55,0.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      const k = (i / 9) ** 1.8, y = lerp(h * 0.52, h, k);
      ctx.beginPath(); ctx.moveTo(lerp(w * 0.44, 0, k), y); ctx.lineTo(lerp(w * 0.64, w, k), y); ctx.stroke();
    }
    poly(ctx, [[0, h * 0.12], [w * 0.44, h * 0.44], [w * 0.44, h * 0.52], [0, h]], shade(sky, '#e6e3da', 0.5));
    poly(ctx, [[0, h * 0.08], [w * 0.44, h * 0.42], [w * 0.44, h * 0.45], [0, h * 0.14]], '#3b4448');
    poly(ctx, [[w, h * 0.06], [w * 0.64, h * 0.42], [w * 0.64, h * 0.52], [w, h * 0.9]], shade(sky, '#dedbd1', 0.5));
    poly(ctx, [[w, 0], [w * 0.6, h * 0.38], [w * 0.62, h * 0.43], [w, h * 0.12]], '#2f383c');
    if (spec.id === 'latenight') {
      // 便利店的光
      poly(ctx, [[w * 0.76, h * 0.3], [w * 0.95, h * 0.22], [w * 0.95, h * 0.78], [w * 0.76, h * 0.7]], 'rgba(255,244,214,0.95)');
      glow(ctx, w * 0.8, h * 0.75, w * 0.4, [255, 240, 200], 0.4);
      ctx.fillStyle = '#5b6b78'; ctx.fillRect(w * 0.79, h * 0.45, w * 0.12, 3); ctx.fillRect(w * 0.79, h * 0.55, w * 0.12, 3);
    } else {
      poly(ctx, [[w * 0.84, h * 0.36], [w * 0.93, h * 0.3], [w * 0.93, h * 0.74], [w * 0.84, h * 0.78]], '#4b4036');
    }
    lantern(ctx, w * 0.72, h * 0.32, h * 0.04, t, sky.night > 0.3 || spec.rain ? 1 : 0.3);
    if (spec.rain) {
      ctx.fillStyle = 'rgba(160,176,180,0.55)';
      ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.9, w * 0.12, h * 0.025, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.6, h * 0.7, w * 0.07, h * 0.015, 0, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < 0.25) ripples.push({ x: Math.random() < 0.6 ? w * (0.22 + Math.random() * 0.16) : w * (0.56 + Math.random() * 0.08), y: Math.random() < 0.6 ? h * 0.9 : h * 0.7, r: 1, a: 0.6 });
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]; r.r += 0.6; r.a -= 0.02;
        if (r.a <= 0) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(235,240,240,${r.a})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 1.8, r.r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // 屋檐下的孩子
      figure(ctx, w * 0.8, h * 0.78, h * 0.15, '#4a5a63', '#7c8a6a');
      // 你和小红伞
      const px = lerp(w * 0.36, w * 0.72, s.share), py = h * 0.95, sc = h * 0.2;
      figure(ctx, px, py, sc, '#27323a', '#b33f2e');
      const cy = py - sc * 1.02, R = sc * 0.62 * Math.max(s.open, 0.12);
      ctx.strokeStyle = '#27323a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + sc * 0.1, py - sc * 0.45); ctx.lineTo(px + sc * 0.04, cy); ctx.stroke();
      if (s.open < 0.15) {
        poly(ctx, [[px + sc * 0.04, cy - sc * 0.3], [px + sc * 0.08, cy], [px, cy]], '#b33f2e');
      } else {
        ctx.fillStyle = '#b33f2e';
        ctx.beginPath(); ctx.moveTo(px - R, cy);
        for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.quadraticCurveTo(px + Math.cos(a - Math.PI / 12) * R * 1.02, cy + Math.sin(a - Math.PI / 12) * R * 0.62, px + Math.cos(a) * R, cy + Math.sin(a) * R * 0.6); }
        ctx.lineTo(px - R, cy); ctx.fill();
        ctx.strokeStyle = 'rgba(80,20,10,0.5)'; ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.beginPath(); ctx.moveTo(px, cy - R * 0.6); ctx.lineTo(px + Math.cos(a) * R, cy + Math.sin(a) * R * 0.6 + R * 0.05); ctx.stroke(); }
      }
      rain(ctx, w, h, (x, y) => s.open > 0.5 && Math.abs(x - px) < R && y > cy - R * 0.6 && y < cy);
      ctx.fillStyle = 'rgba(210,216,212,0.1)'; ctx.fillRect(0, 0, w, h);
    }
  };
}

/** 城市:高楼天际线、天台栏杆;夜里万家灯火 */
function city(spec: SceneSpec, _s: SceneState): Draw {
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    drawSky(ctx, L, 0, 0, w, h, t, 71);
    const layers: Array<[number, string, number]> = [[0.62, '#8e98a8', 0.4], [0.74, '#5d6676', 0.25], [0.86, '#3c4250', 0.1]];
    layers.forEach(([base, color, fog], li) => {
      const r = prand(80 + li);
      let x = -10;
      while (x < w) {
        const bw = w * (0.06 + r() * 0.1), bh = h * (0.2 + r() * 0.35) * (1 - li * 0.15);
        ctx.fillStyle = shade(L, color, fog);
        ctx.fillRect(x, h * base - bh, bw, bh + h);
        if (L.night > 0.3 || li === 2) {
          for (let wy = h * base - bh + 6; wy < h * base - 4; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
            if (r() < 0.35 * L.night + 0.02) { ctx.fillStyle = `rgba(250,206,130,${0.4 + 0.5 * L.night})`; ctx.fillRect(wx, wy, 3, 4); }
          }
        }
        x += bw + 2;
      }
    });
    // 天台栏杆
    ctx.fillStyle = shade(L, '#2f3238', 0.1);
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
    ctx.fillRect(0, h * 0.78, w, 3);
    for (let x = 6; x < w; x += 22) ctx.fillRect(x, h * 0.78, 2, h * 0.12);
    // 远处一架飞机的灯
    if (L.night > 0.4) { const ax = (t * 18) % (w + 40) - 20; ctx.fillStyle = `rgba(255,90,80,${0.5 + 0.5 * Math.sin(t * 6)})`; ctx.fillRect(ax, h * 0.14, 3, 3); }
  };
}

/** 火车站:站台雨棚、绿皮火车、站台钟;拆开的录取通知书 */
function station(spec: SceneSpec, s: SceneState): Draw {
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    drawSky(ctx, L, 0, 0, w, h * 0.5, t, 91);
    // 绿皮火车
    const ty = h * 0.42, th = h * 0.24;
    ctx.fillStyle = shade(L, '#2f5e4a', 0.2); ctx.fillRect(0, ty, w, th);
    ctx.fillStyle = shade(L, '#e8d9a8', 0.2); ctx.fillRect(0, ty + th * 0.55, w, th * 0.06);
    for (let x = 10; x < w; x += w * 0.12) { ctx.fillStyle = shade(L, '#a8c2c8', 0.2); ctx.fillRect(x, ty + th * 0.15, w * 0.08, th * 0.3); }
    // 站台雨棚
    poly(ctx, [[0, 0], [w, 0], [w, h * 0.12], [0, h * 0.2]], shade(L, '#4b4f55', 0.1));
    for (let x = w * 0.1; x < w; x += w * 0.3) { ctx.fillStyle = shade(L, '#3b3f45', 0.1); ctx.fillRect(x, h * 0.12, 5, h * 0.6); }
    // 站台
    ctx.fillStyle = shade(L, '#b9b2a2', 0.3); ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.fillStyle = '#d8b74a'; ctx.fillRect(0, h * 0.68, w, 4);
    // 站台钟
    const cx = w * 0.82, cy = h * 0.26;
    ctx.fillStyle = '#f6f1e4'; ctx.beginPath(); ctx.arc(cx, cy, h * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2f2a26'; ctx.lineWidth = 2; ctx.stroke();
    const ang = ((spec.hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * h * 0.028, cy + Math.sin(ang) * h * 0.028); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t) * h * 0.04, cy + Math.sin(t) * h * 0.04); ctx.stroke();
    // 挥手的老人
    figure(ctx, w * 0.2, h * 0.86, h * 0.17, '#4a4540');
    ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3;
    const wave = Math.sin(t * 5) * 0.4;
    ctx.beginPath(); ctx.moveTo(w * 0.2 + h * 0.03, h * 0.86 - h * 0.13); ctx.lineTo(w * 0.2 + h * 0.06 + Math.sin(wave) * 8, h * 0.86 - h * 0.21); ctx.stroke();
    // 行李箱
    ctx.fillStyle = '#9c3a2a'; ctx.fillRect(w * 0.42, h * 0.76, w * 0.12, h * 0.12);
    ctx.fillStyle = '#2f2a26'; ctx.fillRect(w * 0.46, h * 0.73, w * 0.04, h * 0.03);
    // 信封
    const ex = w * 0.66, ey = h * 0.8, ew = w * 0.26, eh = h * 0.14;
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(-0.08);
    ctx.fillStyle = '#efe4c8'; ctx.fillRect(-ew / 2, -eh / 2, ew, eh);
    if (s.tear > 0) {
      ctx.fillStyle = '#fbf7ee';
      ctx.fillRect(-ew * 0.4, -eh / 2 - eh * 0.9 * s.tear, ew * 0.8, eh * 0.9);
      ctx.fillStyle = '#b33f2e'; ctx.fillRect(-ew * 0.3, -eh / 2 - eh * 0.8 * s.tear, ew * 0.6, 3);
      ctx.fillStyle = 'rgba(60,50,40,0.5)';
      for (let i = 0; i < 3; i++) ctx.fillRect(-ew * 0.3, -eh / 2 - eh * (0.6 - i * 0.15) * s.tear, ew * 0.5, 2);
    }
    poly(ctx, [[-ew / 2, -eh / 2], [ew / 2, -eh / 2], [0, -eh / 2 + eh * 0.5 * (1 - s.tear * 1.6)]], '#e2d3b0');
    ctx.fillStyle = '#b33f2e'; ctx.beginPath(); ctx.arc(0, 0, eh * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
}

/** 办公室:落地窗外的城市、显示器的光、绿植 */
function office(spec: SceneSpec, _s: SceneState): Draw {
  const skyline = city(spec, _s);
  return (ctx, w, h, t) => {
    const L = lightAt(spec.hour);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h * 0.7); ctx.clip();
    skyline(ctx, w, h * 1.1, t);
    ctx.restore();
    ctx.fillStyle = shade(L, '#4a4e55', 0.1);
    for (let x = 0; x <= w; x += w / 4) ctx.fillRect(x - 2, 0, 4, h * 0.7);
    ctx.fillStyle = shade(L, '#d8d2c6', 0.3); ctx.fillRect(0, h * 0.7, w, h * 0.3);
    // 桌子与显示器
    ctx.fillStyle = shade(L, '#8b6a4c', 0.2); ctx.fillRect(w * 0.1, h * 0.74, w * 0.8, h * 0.05);
    const mx = w * 0.32, my = h * 0.5;
    ctx.fillStyle = '#26292e'; ctx.fillRect(mx, my, w * 0.3, h * 0.2);
    const screen = L.night > 0.3 ? 0.9 : 0.6;
    ctx.fillStyle = `rgba(190,215,235,${screen})`; ctx.fillRect(mx + 4, my + 4, w * 0.3 - 8, h * 0.2 - 8);
    ctx.fillStyle = 'rgba(60,80,100,0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(mx + 10, my + 12 + i * h * 0.035, (w * 0.3 - 24) * (0.5 + 0.4 * ((i * 37) % 10) / 10), 3);
    // 光标闪
    if (Math.sin(t * 6) > 0) { ctx.fillStyle = 'rgba(40,60,80,0.8)'; ctx.fillRect(mx + 12, my + 12 + 4 * h * 0.035, 2, 8); }
    ctx.fillStyle = '#26292e'; ctx.fillRect(mx + w * 0.14, my + h * 0.2, 6, h * 0.04);
    if (L.night > 0.3) glow(ctx, mx + w * 0.15, my + h * 0.1, w * 0.4, [180, 210, 240], 0.25);
    // 绿植和杯子
    poly(ctx, [[w * 0.74, h * 0.74], [w * 0.84, h * 0.74], [w * 0.82, h * 0.66], [w * 0.76, h * 0.66]], '#a0522d');
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = '#5d7d4c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.79, h * 0.66); ctx.quadraticCurveTo(w * (0.74 + i * 0.025), h * 0.55, w * (0.72 + i * 0.035) + Math.sin(t + i) * 2, h * (0.5 + (i % 2) * 0.04)); ctx.stroke();
    }
    ctx.fillStyle = '#f2ede2'; ctx.fillRect(w * 0.18, h * 0.69, w * 0.05, h * 0.05);
  };
}

const PLACES: Record<PlaceId, (spec: SceneSpec, s: SceneState) => Draw> = { home, kitchen, market, school, park, street, city, station, office };

/** 手势会改变画面的几幕,插画可以多给一张"之后"的图,按手势进度淡入 */
export const AFTER_IMAGE: Record<string, (s: SceneState) => number> = {
  rain: s => s.open,
  college: s => s.tear,
  firsthome: s => Math.max(s.turn, s.lit),
  newyear: s => s.lit,
};

/** 用插画时:插画铺底,上面叠雨、热气、烟花这些动态层 */
function overlayOnly(spec: SceneSpec, s: SceneState, img: HTMLImageElement, after: HTMLImageElement | null): Draw {
  const rain = makeRain(120);
  const steam = makeSteam();
  const fw = makeFireworks();
  const cover = (ctx: Ctx, im: HTMLImageElement, w: number, h: number) => {
    const ir = im.naturalWidth / im.naturalHeight, cr = w / h;
    const dw = ir > cr ? h * ir : w, dh = ir > cr ? h : w / ir;
    ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };
  return (ctx, w, h, t) => {
    cover(ctx, img, w, h);
    const p = after && AFTER_IMAGE[spec.id] ? AFTER_IMAGE[spec.id](s) : 0;
    if (after && p > 0) {
      ctx.globalAlpha = Math.min(1, p);
      cover(ctx, after, w, h);
      ctx.globalAlpha = 1;
    }
    if (spec.id === 'newyear') fw(ctx, w, h * 0.6, t, s.lit > 0.5);
    s.wind *= 0.95;
    if (spec.place === 'market' && spec.hour < 20 && spec.hour > 4) steam(ctx, t, [[w * 0.5, h * 0.8, w * 0.2, (1 - s.cool) * 0.45]], s.wind);
    if (spec.place === 'kitchen' || spec.id === 'exam') steam(ctx, t, [[w * 0.35, h * 0.62, w * 0.18, 0.4]], 0);
    if (spec.rain) rain(ctx, w, h);
  };
}

export function sceneDraw(spec: SceneSpec, s: SceneState, img?: HTMLImageElement | null, after?: HTMLImageElement | null): Draw {
  return img ? overlayOnly(spec, s, img, after ?? null) : PLACES[spec.place](spec, s);
}

/** 把画面挂到一个容器上,返回停止函数 */
export function mountScene(container: HTMLElement, draw: Draw, reducedMotion: boolean): () => void {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  container.prepend(c);
  const ctx = c.getContext('2d')!;
  let w = 0, h = 0, raf = 0, alive = true, last = 0;
  const t0 = performance.now();
  const size = () => {
    const r = c.getBoundingClientRect();
    const d = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height;
    c.width = Math.max(1, Math.round(w * d));
    c.height = Math.max(1, Math.round(h * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(c);
  const loop = (now: number) => {
    if (!alive) return;
    if (!reducedMotion || now - last > 1000) {
      if (w > 0 && h > 0) draw(ctx, w, h, (now - t0) / 1000);
      last = now;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
}
