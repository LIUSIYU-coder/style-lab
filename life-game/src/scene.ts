// 场景画面:天空随钟点变化(日出、正午、晚霞、星夜),太阳与月亮沿弧线移动,
// 中景是地点剪影,前景是这一幕的关键道具(霓虹线稿)。全部内联 SVG,不加载外部图片。
import type { PlaceId, PropId, Scene } from './engine/story.ts';

const W = 360;
const H = 220;
const HORIZON = 168;

/* ---------------- 天空 ---------------- */

// [钟点, 天顶色, 地平线色]
const SKY: Array<[number, string, string]> = [
  [0, '#07051a', '#1b1145'],
  [4, '#0d0828', '#2b1a5c'],
  [5, '#24164f', '#c0569a'],
  [6, '#3a2a7a', '#ff9a7a'],
  [8, '#3157b8', '#9fd4ff'],
  [12, '#1f62d0', '#8fe8ff'],
  [16, '#3a4fb4', '#c79cff'],
  [18, '#4a2382', '#ff7a59'],
  [19, '#2b145c', '#ff4fd8'],
  [21, '#120a33', '#3a1f6e'],
  [24, '#07051a', '#1b1145'],
];

function hex(c: string): number[] {
  return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
}
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
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

/** 夜色程度 0(白天)– 1(深夜),决定星星和窗户灯光 */
export function nightness(hour: number): number {
  if (hour >= 7 && hour <= 17) return 0;
  if (hour >= 20 || hour <= 4) return 1;
  if (hour < 7) return (7 - hour) / 2;
  return (hour - 17) / 3;
}

function arc(t: number): [number, number] {
  return [20 + t * (W - 40), HORIZON - Math.sin(Math.PI * t) * 128];
}

const STARS: Array<[number, number, number]> = [
  [22, 18, 1.2], [58, 40, 0.8], [91, 14, 1], [130, 52, 0.7], [162, 22, 1.3], [199, 46, 0.8], [232, 12, 1],
  [266, 38, 0.7], [301, 20, 1.2], [338, 50, 0.9], [44, 78, 0.7], [112, 92, 0.8], [180, 74, 0.6], [248, 86, 0.8],
  [318, 98, 0.7], [76, 110, 0.6], [214, 112, 0.6], [350, 130, 0.6], [12, 120, 0.7], [150, 124, 0.5],
];

function sky(hour: number): string {
  const [top, bottom] = skyAt(hour);
  const night = nightness(hour);
  const stars = night
    ? `<g class="stars" opacity="${night.toFixed(2)}">${STARS.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" style="--d:${(i % 7) * 0.4}s"/>`).join('')}</g>`
    : '';
  let body = '';
  if (hour >= 6 && hour <= 18) {
    const [x, y] = arc((hour - 6) / 12);
    body = `<g class="sun" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="44" fill="url(#sc-sunglow)"/>
      <circle r="24" fill="url(#sc-sun)"/>
      <g fill="${bottom}">${[6, 11, 15.5, 19.5].map((yy, i) => `<rect x="-26" y="${yy}" width="52" height="${1.5 + i * 0.6}"/>`).join('')}</g>
    </g>`;
  } else {
    const hh = hour < 6 ? hour + 24 : hour;
    const [x, y] = arc((hh - 18) / 12);
    body = `<g class="moon" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="34" fill="url(#sc-moonglow)"/>
      <circle r="16" fill="#f3eeff" mask="url(#sc-crescent)"/>
    </g>`;
  }
  return `<rect width="${W}" height="${H}" fill="url(#sc-sky)"/>
    <defs>
      <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="0.78" stop-color="${bottom}"/>
      </linearGradient>
      <linearGradient id="sc-sun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff4fa8"/>
      </linearGradient>
      <radialGradient id="sc-sunglow"><stop offset="0.4" stop-color="#ffb36b" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb36b" stop-opacity="0"/></radialGradient>
      <radialGradient id="sc-moonglow"><stop offset="0.3" stop-color="#c9b8ff" stop-opacity="0.45"/><stop offset="1" stop-color="#c9b8ff" stop-opacity="0"/></radialGradient>
      <mask id="sc-crescent"><circle r="16" fill="#fff"/><circle cx="7" cy="-5" r="14" fill="#000"/></mask>
      <linearGradient id="sc-scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07051a" stop-opacity="0.6"/><stop offset="1" stop-color="#07051a" stop-opacity="0"/></linearGradient>
      <radialGradient id="sc-propglow"><stop offset="0" stop-color="#ff4fd8" stop-opacity="0.45"/><stop offset="1" stop-color="#ff4fd8" stop-opacity="0"/></radialGradient>
    </defs>
    ${stars}${body}`;
}

/* ---------------- 地点剪影 ---------------- */

// 亮着的窗户:按坐标生成,夜里亮得多,白天几乎不亮
function windows(cells: Array<[number, number]>, night: number, w = 6, h = 7): string {
  return cells
    .map(([x, y], i) => {
      const on = (i * 7 + x + y) % 5 < 1 + night * 3;
      return `<rect class="${on ? 'win on' : 'win'}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    })
    .join('');
}

function grid(x0: number, y0: number, cols: number, rows: number, dx: number, dy: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * dx, y0 + r * dy]);
  return out;
}

const GROUND = `<rect class="ground" x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}"/><line class="edge" x1="0" y1="${HORIZON}" x2="${W}" y2="${HORIZON}"/>`;

const PLACES: Record<PlaceId, (night: number) => string> = {
  home: n => `
    <path class="sil" d="M20 ${HORIZON} V128 L60 98 L100 128 V${HORIZON} Z"/>
    <path class="sil" d="M250 ${HORIZON} V136 L288 110 L326 136 V${HORIZON} Z"/>
    <path class="sil" d="M112 ${HORIZON} V150 H240 V${HORIZON} Z"/>
    ${windows([[42, 134], [70, 134], [272, 142], [298, 142]], n, 10, 10)}
    <line class="edge" x1="112" y1="150" x2="240" y2="150"/>
    ${[124, 148, 172, 196, 220].map(x => `<line class="edge" x1="${x}" y1="150" x2="${x}" y2="${HORIZON}"/>`).join('')}`,
  school: n => `
    <path class="sil" d="M30 ${HORIZON} V108 H74 L110 88 L146 108 H210 V${HORIZON} Z"/>
    <circle class="edge" cx="110" cy="104" r="7"/>
    ${windows(grid(40, 118, 8, 3, 21, 15), n)}
    <line class="edge" x1="268" y1="${HORIZON}" x2="268" y2="84"/>
    <path class="flag" d="M268 86 Q282 82 290 88 T310 90 V104 Q300 98 290 104 T268 102 Z"/>`,
  park: () => `
    ${[[34, 120, 22], [86, 128, 18], [286, 116, 26], [332, 130, 16]]
      .map(([x, y, r]) => `<line class="edge" x1="${x}" y1="${y}" x2="${x}" y2="${HORIZON}"/><circle class="sil" cx="${x}" cy="${y}" r="${r}"/>`)
      .join('')}
    <path class="edge" d="M196 156 H246 M200 156 V${HORIZON} M242 156 V${HORIZON} M196 148 H246"/>`,
  street: n => `
    <path class="sil" d="M0 ${HORIZON} V128 H40 V112 H74 V136 H104 V${HORIZON} Z M256 ${HORIZON} V120 H292 V104 H328 V130 H360 V${HORIZON} Z"/>
    ${windows(grid(8, 136, 4, 2, 22, 14), n)}${windows(grid(264, 128, 4, 3, 24, 12), n)}
    ${[130, 230].map(x => `<line class="edge" x1="${x}" y1="${HORIZON}" x2="${x}" y2="112"/><path class="edge" d="M${x} 112 q10 -4 14 4"/><circle class="lamp" cx="${x + 14}" cy="119" r="3.5"/>`).join('')}
    <path class="dash" d="M0 196 H360"/>`,
  city: n => {
    const towers: Array<[number, number, number]> = [[0, 104, 36], [40, 82, 30], [74, 118, 40], [118, 70, 34], [156, 98, 44], [204, 60, 30], [238, 92, 40], [282, 76, 34], [320, 108, 40]];
    return towers
      .map(([x, top, w]) => `<rect class="sil" x="${x}" y="${top}" width="${w}" height="${HORIZON - top}"/>${windows(grid(x + 5, top + 8, Math.floor((w - 6) / 10), Math.floor((HORIZON - top - 10) / 14), 10, 14), n, 5, 6)}`)
      .join('') + `<line class="edge" x1="219" y1="60" x2="219" y2="44"/><circle class="lamp" cx="219" cy="42" r="2.5"/>`;
  },
  station: n => `
    <path class="edge" d="M0 92 H360 M60 92 V${HORIZON} M300 92 V${HORIZON}"/>
    <path class="sil" d="M24 ${HORIZON - 6} V124 Q24 112 40 112 H330 V${HORIZON - 6} Z"/>
    ${windows(grid(48, 122, 11, 1, 25, 0), n, 16, 14)}
    <rect class="ground" x="0" y="${HORIZON - 6}" width="${W}" height="8"/>
    <line class="edge" x1="0" y1="${HORIZON - 6}" x2="${W}" y2="${HORIZON - 6}"/>`,
  office: n => `
    <rect class="sil" x="20" y="54" width="70" height="${HORIZON - 54}"/>
    <rect class="sil" x="100" y="86" width="56" height="${HORIZON - 86}"/>
    <rect class="sil" x="252" y="40" width="64" height="${HORIZON - 40}"/>
    <rect class="sil" x="320" y="96" width="40" height="${HORIZON - 96}"/>
    ${windows(grid(28, 64, 5, 7, 12, 14), n, 6, 8)}${windows(grid(108, 96, 4, 5, 12, 14), n, 6, 8)}${windows(grid(260, 50, 5, 8, 12, 14), n, 6, 8)}
    <line class="edge" x1="284" y1="40" x2="284" y2="24"/><circle class="lamp" cx="284" cy="22" r="2.5"/>`,
  mountain: () => `
    <path class="sil far" d="M0 ${HORIZON} L50 118 L96 140 L150 92 L214 138 L262 104 L320 132 L360 116 V${HORIZON} Z"/>
    <path class="sil" d="M0 ${HORIZON} L70 132 L120 150 L190 120 L250 152 L310 136 L360 150 V${HORIZON} Z"/>
    <path class="ridge" d="M0 ${HORIZON} L70 132 L120 150 L190 120 L250 152 L310 136 L360 150"/>`,
};

/* ---------------- 道具线稿(64×64) ---------------- */

const star = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 11 : 26;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(32 + r * Math.cos(a)).toFixed(1)},${(34 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
})();

const PROPS: Record<PropId, string> = {
  chime: '<path d="M14 8 H50 M20 8 V14 M32 8 V14 M44 8 V14"/><rect x="17" y="14" width="6" height="22" rx="2"/><rect x="29" y="14" width="6" height="32" rx="2"/><rect x="41" y="14" width="6" height="18" rx="2"/><path d="M32 46 V54"/><circle cx="32" cy="57" r="3"/>',
  heart: '<path d="M32 54 C10 40 6 26 14 18 C20 12 28 14 32 22 C36 14 44 12 50 18 C58 26 54 40 32 54 Z"/>',
  kite: '<polygon points="32,4 50,26 32,46 14,26"/><path d="M32 4 V46 M14 26 H50"/><path d="M32 46 q-7 5 0 9 q7 4 0 9"/>',
  plane: '<polygon points="4,30 60,8 30,58 26,36"/><path d="M26 36 L60 8 M26 36 L22 48"/>',
  umbrella: '<path d="M6 30 Q32 2 58 30 Q51 25 45 30 Q38 25 32 30 Q26 25 19 30 Q13 25 6 30 Z"/><path d="M32 30 V52 q0 6 -6 6 q-5 0 -5 -5"/>',
  lantern: '<path d="M24 8 H40 M28 8 V12 M36 8 V12"/><rect x="16" y="12" width="32" height="36" rx="14"/><path d="M32 12 V48 M23 15 Q18 30 23 45 M41 15 Q46 30 41 45 M26 48 H38 M32 48 V60 M28 52 V60 M36 52 V60"/>',
  flag: '<path d="M14 4 V60"/><path d="M14 6 Q28 2 38 8 T56 10 V30 Q46 24 36 30 T14 28 Z"/>',
  bicycle: '<circle cx="15" cy="42" r="11"/><circle cx="49" cy="42" r="11"/><path d="M15 42 L27 24 H44 L49 42 M27 24 L34 42 H15 M44 24 L46 15 H53 M23 19 H32"/>',
  piggy: '<ellipse cx="30" cy="36" rx="20" ry="14"/><path d="M22 24 L24 16 L30 23"/><rect x="48" y="31" width="8" height="9" rx="3"/><path d="M18 48 V56 M38 48 V56 M25 26 H35"/><circle cx="30" cy="11" r="5"/><circle cx="40" cy="33" r="1.5"/>',
  book: '<path d="M32 16 Q20 9 7 13 V50 Q20 46 32 53 Q44 46 57 50 V13 Q44 9 32 16 Z M32 16 V53 M13 22 Q20 20 27 23 M13 30 Q20 28 27 31 M37 23 Q44 20 51 22 M37 31 Q44 28 51 30"/>',
  letter: '<rect x="7" y="16" width="50" height="34" rx="3"/><path d="M7 18 L32 37 L57 18 M7 48 L25 32 M57 48 L39 32"/>',
  pencil: '<polygon points="14,50 44,20 52,28 22,58"/><path d="M14 50 L9 61 L22 58 M40 24 L48 32"/>',
  phone: '<rect x="18" y="4" width="28" height="56" rx="5"/><path d="M27 10 H37 M18 48 H46"/><circle cx="32" cy="54" r="2"/><path d="M24 22 H40 M24 29 H36 M24 36 H38"/>',
  signpost: '<path d="M32 6 V60 M24 60 H40"/><polygon points="12,12 46,12 53,19 46,26 12,26"/><polygon points="52,32 18,32 11,39 18,46 52,46"/>',
  notebook: '<rect x="14" y="6" width="38" height="52" rx="3"/><path d="M10 16 H18 M10 28 H18 M10 40 H18 M24 18 H44 M24 26 H44 M24 34 H38"/>',
  lamp: '<path d="M14 58 H42 M26 58 V42 L38 22"/><polygon points="32,16 52,12 47,32"/><path d="M48 34 L54 42 M43 36 L44 46 M52 30 L60 33"/>',
  suitcase: '<rect x="8" y="20" width="48" height="34" rx="5"/><path d="M24 20 V13 H40 V20 M20 20 V54 M44 20 V54 M8 34 H56"/><circle cx="16" cy="58" r="3"/><circle cx="48" cy="58" r="3"/>',
  laptop: '<rect x="13" y="10" width="38" height="28" rx="3"/><polygon points="6,42 58,42 63,52 1,52"/><path d="M20 20 L26 24 L20 28 M30 28 H40"/>',
  ticket: '<path d="M6 18 H58 V27 a5 5 0 0 0 0 10 V46 H6 V37 a5 5 0 0 0 0 -10 Z"/><path d="M42 20 V44" stroke-dasharray="3 3"/><path d="M14 26 H32 M14 33 H28"/>',
  cup: '<path d="M12 22 H44 V44 q0 10 -10 10 H22 q-10 0 -10 -10 Z M44 28 h6 q6 0 6 6 q0 6 -6 6 h-6 M22 6 q5 4 0 9 M32 6 q5 4 0 9"/>',
  key: '<circle cx="18" cy="32" r="11"/><circle cx="18" cy="32" r="3.5"/><path d="M29 32 H58 M48 32 V41 M55 32 V39"/>',
  document: '<path d="M14 4 H40 L52 16 V60 H14 Z M40 4 V16 H52 M22 26 H44 M22 34 H44 M22 42 H36"/><path d="M38 50 l4 4 l8 -10"/>',
  box: '<polygon points="8,22 32,11 56,22 32,33"/><path d="M8 22 V47 L32 58 L56 47 V22 M32 33 V58 M20 16.5 L44 27.5"/>',
  cake: '<rect x="10" y="36" width="44" height="20" rx="3"/><rect x="16" y="24" width="32" height="12" rx="3"/><path d="M24 24 V14 M32 24 V12 M40 24 V14 M10 44 Q16 40 22 44 T34 44 T46 44 T54 44"/><path d="M24 6 q3 4 0 6 q-3 -2 0 -6 M32 4 q3 4 0 6 q-3 -2 0 -6 M40 6 q3 4 0 6 q-3 -2 0 -6"/>',
  guitar: '<circle cx="22" cy="44" r="13"/><circle cx="33" cy="32" r="8"/><circle cx="24" cy="42" r="4"/><path d="M36 29 L54 11 M50 7 L58 15 M16 50 L22 44"/>',
  star,
  plant: '<polygon points="20,40 44,40 40,58 24,58"/><path d="M32 40 V18 M32 30 Q18 30 14 16 Q28 14 32 30 M32 24 Q44 24 50 10 Q36 8 32 24"/>',
  camera: '<rect x="6" y="20" width="52" height="34" rx="5"/><rect x="20" y="13" width="14" height="7" rx="2"/><circle cx="32" cy="37" r="10"/><circle cx="32" cy="37" r="4"/><circle cx="49" cy="27" r="2"/>',
};

function rain(): string {
  const drops: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i * 53) % W;
    const y = (i * 37) % H;
    drops.push(`<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 12}" style="--d:${((i * 0.13) % 0.8).toFixed(2)}s"/>`);
  }
  return `<g class="rain">${drops.join('')}</g>`;
}

export function sceneSvg(hour: number, scene: Scene, label: string): string {
  const night = nightness(hour);
  return `<svg class="scene-art" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid slice">
    ${sky(hour)}
    ${GROUND}
    <g class="place">${PLACES[scene.place](night)}</g>
    <g class="prop-wrap" transform="translate(${W / 2 - 46} ${HORIZON - 70})">
      <circle cx="46" cy="44" r="50" fill="url(#sc-propglow)"/>
      <g class="prop" transform="translate(6 4) scale(1.25)">${PROPS[scene.prop]}</g>
    </g>
    ${scene.rain ? rain() : ''}
    <rect width="${W}" height="64" fill="url(#sc-scrim)"/>
  </svg>`;
}
