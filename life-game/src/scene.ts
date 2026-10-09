// 场景画面(暖色绘本风):天空随钟点变化,太阳与月亮沿弧线移动;中景是地点,白天是暖沙色,
// 夜里变成深蓝、窗户亮起暖黄的灯;前景是一张"贴纸",画着这一幕的关键物件,碗和杯子会冒热气。
// 全部内联 SVG,不加载外部图片。
import type { PlaceId, PropId, Scene } from './engine/story.ts';

const W = 360;
const H = 220;
const HORIZON = 168;

/* ---------------- 颜色工具 ---------------- */

function hex(c: string): number[] {
  return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
}
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* ---------------- 天空 ---------------- */

// [钟点, 天顶色, 地平线色]
const SKY: Array<[number, string, string]> = [
  [0, '#1d2540', '#3b4466'],
  [4, '#2a3150', '#5a5470'],
  [5, '#5b5880', '#e9a98a'],
  [6, '#8fb3cf', '#f6caa1'],
  [8, '#9cc8e2', '#f3e3c6'],
  [12, '#8cc3e3', '#e8f2ef'],
  [16, '#a7c4dc', '#f2dcb5'],
  [18, '#e7a27a', '#f6d39a'],
  [19, '#7d6a99', '#e79c7b'],
  [21, '#2f3858', '#6b5a78'],
  [24, '#1d2540', '#3b4466'],
];

function skyAt(hour: number): [string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, top0, bot0] = SKY[i];
    const [h1, top1, bot1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0);
      return [mix(top0, top1, t), mix(bot0, bot1, t)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}

/** 夜色程度 0(白天)– 1(深夜) */
export function nightness(hour: number): number {
  if (hour >= 7 && hour <= 17) return 0;
  if (hour >= 20 || hour <= 4) return 1;
  if (hour < 7) return (7 - hour) / 2;
  return (hour - 17) / 3;
}

function arc(t: number): [number, number] {
  return [24 + t * (W - 48), HORIZON - Math.sin(Math.PI * t) * 120];
}

const STARS: Array<[number, number, number]> = [
  [22, 18, 1.2], [58, 40, 0.9], [91, 14, 1], [130, 52, 0.8], [162, 22, 1.3], [199, 46, 0.9], [232, 12, 1],
  [266, 38, 0.8], [301, 20, 1.2], [338, 50, 0.9], [44, 78, 0.8], [112, 92, 0.8], [180, 74, 0.7], [248, 86, 0.8], [318, 98, 0.7],
];

function sky(hour: number): string {
  const [top, bottom] = skyAt(hour);
  const night = nightness(hour);
  const stars = night
    ? `<g class="stars" opacity="${night.toFixed(2)}">${STARS.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" style="--d:${(i % 7) * 0.4}s"/>`).join('')}</g>`
    : '';
  let body: string;
  if (hour >= 6 && hour <= 18) {
    const t = (hour - 6) / 12;
    const [x, y] = arc(t);
    const warm = Math.abs(t - 0.5) * 2; // 早晚更红
    body = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="40" fill="url(#sc-sunglow)"/>
      <circle r="20" fill="${mix('#fff1c4', '#f39a5b', warm)}"/>
    </g>`;
  } else {
    const hh = hour < 6 ? hour + 24 : hour;
    const [x, y] = arc((hh - 18) / 12);
    body = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="30" fill="url(#sc-moonglow)"/>
      <circle r="15" fill="#f6ecc9" mask="url(#sc-crescent)"/>
    </g>`;
  }
  return `<rect width="${W}" height="${H}" fill="url(#sc-sky)"/>
    <defs>
      <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="0.8" stop-color="${bottom}"/>
      </linearGradient>
      <radialGradient id="sc-sunglow"><stop offset="0.3" stop-color="#ffd98f" stop-opacity="0.6"/><stop offset="1" stop-color="#ffd98f" stop-opacity="0"/></radialGradient>
      <radialGradient id="sc-moonglow"><stop offset="0.3" stop-color="#f6ecc9" stop-opacity="0.35"/><stop offset="1" stop-color="#f6ecc9" stop-opacity="0"/></radialGradient>
      <mask id="sc-crescent"><circle r="15" fill="#fff"/><circle cx="6" cy="-5" r="13" fill="#000"/></mask>
      <radialGradient id="sc-lampglow"><stop offset="0" stop-color="#ffd98f" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd98f" stop-opacity="0"/></radialGradient>
    </defs>
    ${stars}${body}`;
}

/* ---------------- 地点 ---------------- */

function windows(cells: Array<[number, number]>, night: number, w = 8, h = 9): string {
  return cells
    .map(([x, y], i) => {
      const on = night > 0.3 && (i * 7 + x + y) % 5 < 1 + night * 3;
      return `<rect class="${on ? 'win on' : 'win'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
    })
    .join('');
}

function grid(x0: number, y0: number, cols: number, rows: number, dx: number, dy: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * dx, y0 + r * dy]);
  return out;
}

const GROUND = `<rect class="ground" x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}"/>`;

function house(x: number, w: number, h: number, night: number): string {
  const top = HORIZON - h;
  return `<rect class="sil" x="${x}" y="${top}" width="${w}" height="${h}"/>
    <path class="roof" d="M${x - 6} ${top + 2} L${x + w / 2} ${top - w * 0.38} L${x + w + 6} ${top + 2} Z"/>
    ${windows([[x + w * 0.2, top + h * 0.3], [x + w * 0.6, top + h * 0.3]], night, w * 0.2, h * 0.22)}`;
}

const PLACES: Record<PlaceId, (night: number) => string> = {
  home: n => `
    ${house(22, 74, 54, n)}${house(258, 70, 44, n)}
    <rect class="sil far" x="110" y="146" width="140" height="22"/>
    <path class="edge" d="M110 146 H250 M120 146 V168 M140 146 V168 M160 146 V168 M180 146 V168 M200 146 V168 M220 146 V168 M240 146 V168"/>
    <path class="edge" d="M100 112 Q180 128 258 120"/>
    <rect class="awning-2" x="132" y="116" width="10" height="13" rx="1"/><rect class="awning" x="152" y="119" width="9" height="12" rx="1"/><rect class="awning-2" x="206" y="121" width="11" height="12" rx="1"/>`,
  kitchen: n => `
    <path class="wall" fill-rule="evenodd" d="M0 0 H${W} V${H} H0 Z M96 28 H264 V128 H96 Z"/>
    <path class="edge" d="M96 28 H264 V128 H96 Z M180 28 V128 M96 78 H264"/>
    <rect class="sil" x="0" y="150" width="${W}" height="${H - 150}"/>
    <path class="tile" d="${Array.from({ length: 13 }, (_, i) => `M${i * 30} 150 V${H}`).join(' ')} M0 185 H${W}"/>
    <path class="edge" d="M44 40 V96 M36 96 Q44 110 52 96 Z M312 40 V88 M304 88 H320 V102 H304 Z"/>
    ${n > 0.3 ? `<circle cx="180" cy="14" r="40" fill="url(#sc-lampglow)"/>` : ''}
    <path class="edge" d="M180 0 V8"/><circle class="lamp" cx="180" cy="12" r="5"/>`,
  market: n => `
    ${house(8, 62, 50, n)}${house(290, 62, 56, n)}
    <rect class="sil" x="96" y="128" width="168" height="40" rx="3"/>
    ${Array.from({ length: 8 }, (_, i) => `<path class="${i % 2 ? 'awning-2' : 'awning'}" d="M${88 + i * 23} 104 h23 v14 q-11.5 8 -23 0 Z"/>`).join('')}
    <path class="edge" d="M92 104 V168 M268 104 V168"/>
    <rect class="lamp" x="170" y="132" width="20" height="12" rx="2"/>
    <path class="edge" d="M112 168 v-10 h20 v10 M228 168 v-10 h20 v10"/>
    ${n > 0.3 ? `<circle cx="180" cy="124" r="44" fill="url(#sc-lampglow)"/>` : ''}`,
  school: n => `
    <path class="sil" d="M30 ${HORIZON} V110 H74 L110 90 L146 110 H214 V${HORIZON} Z"/>
    <circle class="edge" cx="110" cy="105" r="7"/>
    ${windows(grid(40, 120, 8, 3, 21, 15), n, 9, 9)}
    <line class="edge" x1="268" y1="${HORIZON}" x2="268" y2="88"/>
    <path class="awning" d="M268 90 Q281 86 290 92 T310 94 V106 Q300 101 290 106 T268 104 Z"/>`,
  park: () => `
    ${[[38, 124, 24], [92, 132, 18], [288, 120, 28], [336, 134, 16]]
      .map(([x, y, r]) => `<rect class="sil" x="${x - 3}" y="${y}" width="6" height="${HORIZON - y}"/><circle class="roof" cx="${x}" cy="${y}" r="${r}"/>`)
      .join('')}
    <path class="edge" d="M196 156 H250 M200 156 V${HORIZON} M246 156 V${HORIZON} M196 148 H250"/>
    <path class="dash" d="M0 194 Q180 176 360 196"/>`,
  street: n => `
    ${house(4, 64, 58, n)}${house(76, 46, 40, n)}${house(258, 52, 50, n)}${house(314, 44, 38, n)}
    ${[150, 220].map(x => `<line class="edge" x1="${x}" y1="${HORIZON}" x2="${x}" y2="112"/><path class="edge" d="M${x} 112 q10 -4 14 4"/><circle class="lamp" cx="${x + 14}" cy="119" r="4"/>${n > 0.3 ? `<circle cx="${x + 14}" cy="122" r="22" fill="url(#sc-lampglow)"/>` : ''}`).join('')}
    <path class="dash" d="M0 196 H360"/>`,
  city: n => {
    const towers: Array<[number, number, number]> = [[0, 108, 40], [44, 86, 32], [80, 120, 40], [124, 76, 34], [162, 100, 44], [210, 70, 32], [246, 96, 40], [290, 82, 34], [328, 112, 32]];
    return towers
      .map(([x, top, w]) => `<rect class="sil" x="${x}" y="${top}" width="${w}" height="${HORIZON - top}"/>${windows(grid(x + 5, top + 8, Math.floor((w - 6) / 10), Math.floor((HORIZON - top - 10) / 14), 10, 14), n, 5, 7)}`)
      .join('');
  },
  station: n => `
    <path class="edge" d="M0 94 H360 M60 94 V${HORIZON} M300 94 V${HORIZON}"/>
    <path class="sil" d="M24 ${HORIZON - 6} V124 Q24 112 40 112 H330 V${HORIZON - 6} Z"/>
    <rect class="awning" x="24" y="140" width="306" height="5"/>
    ${windows(grid(48, 120, 11, 1, 25, 0), n, 16, 14)}`,
  office: n => `
    <rect class="sil" x="20" y="58" width="70" height="${HORIZON - 58}"/>
    <rect class="sil far" x="100" y="90" width="56" height="${HORIZON - 90}"/>
    <rect class="sil" x="252" y="44" width="64" height="${HORIZON - 44}"/>
    <rect class="sil far" x="320" y="98" width="40" height="${HORIZON - 98}"/>
    ${windows(grid(28, 68, 5, 7, 12, 14), n, 7, 8)}${windows(grid(260, 54, 5, 8, 12, 14), n, 7, 8)}`,
};

// 每种地点白天和夜里的配色:[剪影, 远景, 屋顶, 窗玻璃, 地面, 描边, 墙]
const DAY = ['#d9c4a1', '#e6d6b9', '#a5523f', '#a8c3cf', '#cdb48d', '#8a6f50', '#f1e2c6'];
const NIGHT = ['#3c3a55', '#4a4762', '#5a3b48', '#2f3550', '#2b2a3d', '#1f1d2d', '#4b4058'];

/* ---------------- 物件贴纸(64×64 线稿) ---------------- */

const PROPS: Record<PropId, string> = {
  chime: '<path d="M14 8 H50 M20 8 V14 M32 8 V14 M44 8 V14"/><rect x="17" y="14" width="6" height="22" rx="2"/><rect x="29" y="14" width="6" height="32" rx="2"/><rect x="41" y="14" width="6" height="18" rx="2"/><path d="M32 46 V54"/><circle cx="32" cy="57" r="3"/>',
  kite: '<polygon points="32,4 50,26 32,46 14,26"/><path d="M32 4 V46 M14 26 H50"/><path d="M32 46 q-7 5 0 9 q7 4 0 9"/>',
  umbrella: '<path d="M6 30 Q32 2 58 30 Q51 25 45 30 Q38 25 32 30 Q26 25 19 30 Q13 25 6 30 Z"/><path d="M32 30 V52 q0 6 -6 6 q-5 0 -5 -5"/>',
  lantern: '<path d="M24 8 H40 M28 8 V12 M36 8 V12"/><rect x="16" y="12" width="32" height="36" rx="14"/><path d="M32 12 V48 M23 15 Q18 30 23 45 M41 15 Q46 30 41 45 M26 48 H38 M32 48 V60 M28 52 V60 M36 52 V60"/>',
  bicycle: '<circle cx="15" cy="42" r="11"/><circle cx="49" cy="42" r="11"/><path d="M15 42 L27 24 H44 L49 42 M27 24 L34 42 H15 M44 24 L46 15 H53 M23 19 H32"/>',
  bowl: '<path d="M8 32 H56 Q54 52 32 54 Q10 52 8 32 Z M22 54 H42"/><path d="M40 10 L28 34 M48 12 L34 34"/>',
  pencil: '<polygon points="14,50 44,20 52,28 22,58"/><path d="M14 50 L9 61 L22 58 M40 24 L48 32"/>',
  phone: '<rect x="18" y="4" width="28" height="56" rx="5"/><path d="M27 10 H37 M18 48 H46"/><circle cx="32" cy="54" r="2"/>',
  signpost: '<path d="M32 6 V60 M24 60 H40"/><polygon points="12,12 46,12 53,19 46,26 12,26"/><polygon points="52,32 18,32 11,39 18,46 52,46"/>',
  notebook: '<rect x="14" y="6" width="38" height="52" rx="3"/><path d="M10 16 H18 M10 28 H18 M10 40 H18 M24 18 H44 M24 26 H44 M24 34 H38"/>',
  lamp: '<path d="M14 58 H42 M26 58 V42 L38 22"/><polygon points="32,16 52,12 47,32"/><path d="M48 34 L54 42 M43 36 L44 46"/>',
  suitcase: '<rect x="8" y="20" width="48" height="34" rx="5"/><path d="M24 20 V13 H40 V20 M20 20 V54 M44 20 V54"/><circle cx="16" cy="58" r="3"/><circle cx="48" cy="58" r="3"/>',
  laptop: '<rect x="13" y="10" width="38" height="28" rx="3"/><polygon points="6,42 58,42 63,52 1,52"/>',
  ticket: '<path d="M6 18 H58 V27 a5 5 0 0 0 0 10 V46 H6 V37 a5 5 0 0 0 0 -10 Z"/><path d="M42 20 V44" stroke-dasharray="3 3"/><path d="M14 26 H32 M14 33 H28"/>',
  cup: '<path d="M12 22 H44 V44 q0 10 -10 10 H22 q-10 0 -10 -10 Z M44 28 h6 q6 0 6 6 q0 6 -6 6 h-6"/>',
  key: '<circle cx="18" cy="32" r="11"/><circle cx="18" cy="32" r="3.5"/><path d="M29 32 H58 M48 32 V41 M55 32 V39"/>',
  box: '<rect x="8" y="24" width="48" height="30" rx="3"/><path d="M8 34 H56 M26 24 V18 H38 V24 M30 34 V40 H34 V34"/>',
  guitar: '<circle cx="22" cy="44" r="13"/><circle cx="33" cy="32" r="8"/><circle cx="24" cy="42" r="4"/><path d="M36 29 L54 11 M50 7 L58 15"/>',
  plant: '<polygon points="20,40 44,40 40,58 24,58"/><path d="M32 40 V18 M32 30 Q18 30 14 16 Q28 14 32 30 M32 24 Q44 24 50 10 Q36 8 32 24"/>',
  letter: '<rect x="7" y="16" width="50" height="34" rx="3"/><path d="M7 18 L32 37 L57 18"/>',
};

const STEAMY = new Set<PropId>(['bowl', 'cup']);

function rain(): string {
  const drops: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i * 53) % W;
    const y = (i * 37) % H;
    drops.push(`<line x1="${x}" y1="${y}" x2="${x - 3}" y2="${y + 11}" style="--d:${((i * 0.13) % 0.9).toFixed(2)}s"/>`);
  }
  return `<g class="rain">${drops.join('')}</g>`;
}

export function sceneSvg(hour: number, scene: Scene, label: string): string {
  const n = nightness(hour);
  const c = DAY.map((d, i) => mix(d, NIGHT[i], n));
  const vars = `--sc-sil:${c[0]};--sc-far:${c[1]};--sc-roof:${c[2]};--sc-win:${c[3]};--sc-ground:${c[4]};--sc-edge:${c[5]};--sc-wall:${c[6]}`;
  const steam = STEAMY.has(scene.prop)
    ? `<path class="steam" d="M30 4 q-6 -8 0 -16 q6 -8 0 -16"/><path class="steam" d="M42 6 q-6 -8 0 -16 q6 -8 0 -16"/><path class="steam" d="M54 4 q-6 -8 0 -16 q6 -8 0 -16"/>`
    : '';
  return `<svg class="scene-art" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid slice" style="${vars}">
    ${sky(hour)}
    ${GROUND}
    <g class="place">${PLACES[scene.place](n)}</g>
    <g class="prop-wrap" transform="translate(${W / 2 - 42} ${HORIZON - 62})">
      <circle class="sticker" cx="42" cy="42" r="40"/>
      ${steam}
      <g class="prop" transform="translate(10 10)">${PROPS[scene.prop]}</g>
    </g>
    ${scene.rain ? rain() : ''}
  </svg>`;
}
