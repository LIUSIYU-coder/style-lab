// 生成可以长按保存的人生纪念卡图片(PNG)。只用 Canvas,不依赖第三方库。
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
  /** 卡片底部上方的一句话 */
  closing: string;
  home: string;
  seed: string;
  site: string;
}

const W = 1080;
const H = 1560;
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "Noto Serif SC", serif';
const SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const C = { bg: '#efe6d6', card: '#fffdf7', line: '#dccdb3', ink: '#2e2822', muted: '#76695a', red: '#b83d2c', green: '#2e6b5a', paper2: '#f3ead9', amber: '#f6e2b8' };

/** 按字符折行(中文没有空格) */
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function shareImage(d: ShareData): Promise<string> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // 卡片
  const x0 = 64;
  const y0 = 72;
  const cw = W - x0 * 2;
  const ch = H - y0 - 150;
  ctx.save();
  ctx.shadowColor = 'rgba(92,62,30,0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.card;
  roundRect(ctx, x0, y0, cw, ch, 12);
  ctx.fill();
  ctx.restore();
  const glow = ctx.createRadialGradient(x0 + cw, y0, 10, x0 + cw, y0, 520);
  glow.addColorStop(0, 'rgba(246,226,184,0.9)');
  glow.addColorStop(1, 'rgba(246,226,184,0)');
  ctx.fillStyle = glow;
  roundRect(ctx, x0, y0, cw, ch, 12);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  roundRect(ctx, x0 + 18, y0 + 18, cw - 36, ch - 36, 6);
  ctx.stroke();

  const left = x0 + 64;
  const inner = cw - 128;
  let y = y0 + 110;

  // 邮票
  const sx = x0 + cw - 210;
  const sy = y0 + 60;
  ctx.fillStyle = C.red;
  ctx.fillRect(sx, sy, 150, 180);
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = 8;
  ctx.strokeRect(sx, sy, 150, 180);
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff8ee';
  ctx.textAlign = 'center';
  ctx.font = `700 92px ${SERIF}`;
  ctx.fillText(d.gan, sx + 75, sy + 112);
  ctx.font = `26px ${SANS}`;
  ctx.fillText(d.image, sx + 75, sy + 156);
  ctx.textAlign = 'left';

  ctx.fillStyle = C.red;
  ctx.font = `30px ${SANS}`;
  ctx.fillText('人 生 纪 念 卡', left, y);
  y += 40;

  ctx.fillStyle = C.ink;
  ctx.font = `700 84px ${SERIF}`;
  for (const l of wrap(ctx, d.title, inner - 190)) {
    y += 100;
    ctx.fillText(l, left, y);
  }
  y += 70;
  ctx.fillStyle = C.green;
  ctx.font = `42px ${SERIF}`;
  ctx.fillText(d.motto, left, y);

  // 标签
  y += 50;
  let tx = left;
  ctx.font = `30px ${SANS}`;
  for (const t of d.tags) {
    const w = ctx.measureText(t).width + 44;
    ctx.fillStyle = C.paper2;
    roundRect(ctx, tx, y, w, 56, 28);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillText(t, tx + 22, y + 39);
    tx += w + 16;
  }
  y += 110;

  ctx.fillStyle = C.muted;
  ctx.font = `30px ${SANS}`;
  for (const l of wrap(ctx, d.line, inner)) {
    ctx.fillText(l, left, y);
    y += 44;
  }
  y += 24;

  // 六条维度
  const max = Math.max(4, ...d.axes.map(a => Math.abs(a.score)));
  const labelW = 96;
  const trackX = left + labelW;
  const trackW = inner - labelW * 2;
  for (const a of d.axes) {
    const [pos, neg] = AXIS_POLES[a.axis];
    ctx.font = `30px ${SANS}`;
    ctx.fillStyle = a.score < 0 ? C.ink : C.muted;
    ctx.fillText(neg, left, y + 10);
    ctx.fillStyle = a.score > 0 ? C.ink : C.muted;
    ctx.textAlign = 'right';
    ctx.fillText(pos, left + inner, y + 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.paper2;
    roundRect(ctx, trackX, y - 10, trackW, 20, 10);
    ctx.fill();
    const w = (Math.abs(a.score) / max) * (trackW / 2);
    ctx.fillStyle = a.score >= 0 ? C.red : C.green;
    roundRect(ctx, a.score >= 0 ? trackX + trackW / 2 : trackX + trackW / 2 - w, y - 10, Math.max(w, 0.1), 20, 10);
    ctx.fill();
    ctx.fillStyle = C.line;
    ctx.fillRect(trackX + trackW / 2 - 1, y - 16, 2, 32);
    y += 62;
  }

  if (d.moment) {
    y += 12;
    ctx.fillStyle = C.red;
    ctx.font = `28px ${SANS}`;
    ctx.fillText('名场面', left, y);
    y += 50;
    ctx.fillStyle = C.ink;
    ctx.font = `36px ${SERIF}`;
    for (const l of wrap(ctx, d.moment, inner).slice(0, 2)) {
      ctx.fillText(l, left, y);
      y += 52;
    }
  }

  // 卡片底部
  const fy = y0 + ch - 120;
  ctx.fillStyle = C.muted;
  ctx.font = `32px ${SERIF}`;
  const closing = wrap(ctx, d.closing, inner);
  closing.forEach((l, i) => ctx.fillText(l, left, fy - 70 - (closing.length - 1 - i) * 46));
  ctx.strokeStyle = C.line;
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, fy - 30);
  ctx.lineTo(left + inner, fy - 30);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.ink;
  ctx.font = `700 36px ${SERIF}`;
  ctx.fillText('人生底层代码', left, fy + 20);
  ctx.fillStyle = C.muted;
  ctx.font = `26px ${SANS}`;
  ctx.fillText('把一生放进一天 · 24 小时，24 个选择', left, fy + 62);
  // 邮戳
  ctx.save();
  ctx.translate(left + inner - 96, fy + 30);
  ctx.rotate(-0.2);
  ctx.strokeStyle = 'rgba(184,61,44,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(184,61,44,0.85)';
  ctx.textAlign = 'center';
  ctx.font = `21px ${SANS}`;
  ctx.fillText(d.home, 0, -22);
  ctx.fillText('06:00—05:00', 0, 9);
  ctx.fillText(d.seed, 0, 40);
  ctx.restore();

  ctx.fillStyle = C.muted;
  ctx.textAlign = 'center';
  ctx.font = `28px ${SANS}`;
  ctx.fillText(d.site ? `来过一遍你的一生：${d.site}` : '剧情与分析均为虚构的娱乐内容', W / 2, H - 56);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
