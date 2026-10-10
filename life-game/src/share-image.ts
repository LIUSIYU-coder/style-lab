// 生成可以长按保存的"人生签"图片(PNG)。只用 Canvas,不依赖第三方库。
// 版式:夜色书桌上一张宣纸签,左边竖排原型名,右上朱砂印,下面六维和一句话。
import { AXIS_POLES, type Axis } from './engine/story.ts';

export interface ShareData {
  title: string;
  motto: string;
  tags: string[];
  gan: string;
  image: string;
  line: string;
  axes: Array<{ axis: Axis; score: number; pct: number }>;
  moment: string | null;
  /** 签底部的一句话 */
  closing: string;
  home: string;
  seed: string;
  site: string;
  /** 玩家的称呼,可以为空 */
  name: string;
}

const W = 1080;
const H = 1600;
const BRUSH = '"Ma Shan Zheng", "LXGW WenKai Screen", "Kaiti SC", "STKaiti", serif';
const BODY = '"LXGW WenKai Screen", "Kaiti SC", "STKaiti", "Songti SC", serif';
const UI = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const C = { desk: '#18202a', desk2: '#243041', paper: '#f2ecdd', edge: '#d8cdb5', ink: '#25211c', soft: '#6d6457', red: '#b33f2e', green: '#4e7863', paper2: '#e9e1cd', cream: '#fbf3e4' };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function shareImage(d: ShareData): Promise<string> {
  await document.fonts?.ready;
  // 确保签上要用的字已经下载
  await Promise.allSettled([document.fonts?.load(`96px ${BRUSH}`, d.title + d.gan + '人生签'), document.fonts?.load(`40px ${BODY}`, d.motto + d.closing)]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H * 0.3, H);
  bg.addColorStop(0, C.desk2);
  bg.addColorStop(1, C.desk);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 签纸
  const x0 = 80, y0 = 90, cw = W - 160, ch = H - 250;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = C.paper;
  rr(ctx, x0, y0, cw, ch, 8);
  ctx.fill();
  ctx.restore();
  const warm = ctx.createRadialGradient(x0 + cw, y0, 10, x0 + cw, y0, 600);
  warm.addColorStop(0, 'rgba(184,146,74,0.22)');
  warm.addColorStop(1, 'rgba(184,146,74,0)');
  ctx.fillStyle = warm;
  rr(ctx, x0, y0, cw, ch, 8);
  ctx.fill();
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 2;
  rr(ctx, x0 + 16, y0 + 16, cw - 32, ch - 32, 4);
  ctx.stroke();

  const left = x0 + 70;
  const inner = cw - 140;

  ctx.fillStyle = C.soft;
  ctx.font = `28px ${UI}`;
  ctx.fillText(`${d.name ? d.name + '的' : ''}人生签`, left, y0 + 90);
  ctx.textAlign = 'right';
  ctx.fillText(d.seed, left + inner, y0 + 90);
  ctx.textAlign = 'left';

  // 竖排原型名
  ctx.fillStyle = C.ink;
  ctx.font = `150px ${BRUSH}`;
  const chars = [...d.title];
  chars.forEach((c, i) => ctx.fillText(c, left - 6, y0 + 280 + i * 160));
  const nameBottom = y0 + 280 + (chars.length - 1) * 160;

  // 朱砂印
  const sx = left + 230, sy = y0 + 150;
  ctx.save();
  ctx.translate(sx + 90, sy + 100);
  ctx.rotate(-0.06);
  ctx.fillStyle = C.red;
  rr(ctx, -90, -100, 180, 200, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,220,0.4)';
  ctx.lineWidth = 4;
  rr(ctx, -80, -90, 160, 180, 6);
  ctx.stroke();
  ctx.fillStyle = C.cream;
  ctx.textAlign = 'center';
  ctx.font = `120px ${BRUSH}`;
  ctx.fillText(d.gan, 0, 30);
  ctx.font = `26px ${UI}`;
  ctx.fillText(d.image, 0, 78);
  ctx.restore();
  ctx.textAlign = 'left';

  // 签文
  let y = sy + 270;
  ctx.fillStyle = C.green;
  ctx.font = `46px ${BODY}`;
  for (const l of wrap(ctx, d.motto, inner - 240)) {
    ctx.fillText(l, sx, y);
    y += 62;
  }
  y += 20;
  ctx.font = `30px ${UI}`;
  let tx = sx;
  for (const t of d.tags) {
    const w = ctx.measureText(t).width + 40;
    ctx.fillStyle = C.red;
    rr(ctx, tx, y - 36, w, 52, 26);
    ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.fillText(t, tx + 20, y);
    tx += w + 12;
    if (tx > left + inner - 120) { tx = sx; y += 66; }
  }

  // 六维
  y = Math.max(nameBottom + 90, y + 90);
  const labelW = 90;
  const trackX = left + labelW;
  const trackW = inner - labelW * 2;
  const max = Math.max(4, ...d.axes.map(a => Math.abs(a.score)));
  for (const a of d.axes) {
    const [pos, neg] = AXIS_POLES[a.axis];
    ctx.font = `30px ${BODY}`;
    ctx.fillStyle = a.score < 0 ? C.ink : C.soft;
    ctx.fillText(neg, left, y + 10);
    ctx.fillStyle = a.score > 0 ? C.ink : C.soft;
    ctx.textAlign = 'right';
    ctx.fillText(pos, left + inner, y + 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.paper2;
    rr(ctx, trackX, y - 8, trackW, 16, 8);
    ctx.fill();
    const w = (Math.abs(a.score) / max) * (trackW / 2);
    if (w > 0) {
      ctx.fillStyle = a.score >= 0 ? C.red : C.green;
      rr(ctx, a.score >= 0 ? trackX + trackW / 2 : trackX + trackW / 2 - w, y - 8, w, 16, 8);
      ctx.fill();
    }
    ctx.fillStyle = C.edge;
    ctx.fillRect(trackX + trackW / 2 - 1, y - 14, 2, 28);
    y += 50;
  }

  // 底部那句话的位置固定,名场面放在中间,放不下就少写一行
  const fy = y0 + ch - 110;
  ctx.font = `36px ${BODY}`;
  const closing = wrap(ctx, d.closing, inner);
  const closingTop = fy - 60 - (closing.length - 1) * 50 - 30;
  y += 10;
  if (d.moment && y + 90 < closingTop) {
    ctx.fillStyle = C.red;
    ctx.font = `26px ${UI}`;
    ctx.fillText('名 场 面', left, y);
    y += 50;
    ctx.fillStyle = C.ink;
    ctx.font = `34px ${BODY}`;
    const room = Math.max(1, Math.floor((closingTop - y) / 50));
    for (const l of wrap(ctx, d.moment, inner).slice(0, Math.min(2, room))) {
      ctx.fillText(l, left, y);
      y += 50;
    }
  }

  ctx.fillStyle = C.ink;
  ctx.font = `36px ${BODY}`;
  closing.forEach((l, i) => ctx.fillText(l, left, fy - 60 - (closing.length - 1 - i) * 50));
  ctx.strokeStyle = C.edge;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(left, fy - 20);
  ctx.lineTo(left + inner, fy - 20);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.ink;
  ctx.font = `44px ${BRUSH}`;
  ctx.fillText('二十四时', left, fy + 38);
  ctx.fillStyle = C.soft;
  ctx.font = `24px ${UI}`;
  ctx.fillText(`生于${d.home} · 二十四小时，二十四个选择`, left + 200, fy + 32);

  ctx.fillStyle = '#c9b98f';
  ctx.textAlign = 'center';
  ctx.font = `28px ${UI}`;
  ctx.fillText(d.site ? `翻开《二十四时》：${d.site}` : '剧情与分析均为虚构的娱乐内容', W / 2, H - 70);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
