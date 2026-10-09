import 'augmented-ui/aug-core.min.css';
import 'augmented-ui/region-mixins.min.css';
import 'augmented-ui/border-inlay-mixins.min.css';
import './style.css';
import { computeChart, type BirthInput, type Chart, type Gender } from './engine/chart.ts';
import { lunarDayName, lunarMonths, lunarToSolar, lunarYearLabel, solarToLunar } from './engine/calendar.ts';
import { PROVINCES } from './engine/regions.ts';
import { buildLifeCode, codeLines, type LifeCode } from './engine/profile.ts';
import { AXES, AXIS_POLES, clockLabel, planLife, shichen, TOTAL_CHOICES, type Effects, type PlannedSlot } from './engine/story.ts';
import { sceneSvg } from './scene.ts';
import { clearSave, loadSave, writeSave } from './save.ts';
import { buildReport, LOCKED_ITEMS, METHOD_NOTES, type Choice, type Report } from './engine/report.ts';

type ScreenId = 'intro' | 'form' | 'decode' | 'code' | 'stage' | 'result';

interface Game {
  input: BirthInput;
  chart: Chart;
  code: LifeCode;
  plan: PlannedSlot[];
  choices: Choice[];
  /** 每一步选的是第几个选项，用于存档 */
  picks: number[];
}

let game: Game | null = null;
let typingTimer = 0;

const OPTION_MARKS = ['甲', '乙', '丙'];
const MIN_YEAR = 1920;
const MAX_YEAR = 2026;

const pad = (n: number) => String(n).padStart(2, '0');

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`找不到元素 ${sel}`);
  return el;
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/* ---------------- 切角外框 ---------------- */

// 用 augmented-ui 给各类元素加切角和渐变边框；已手动指定的元素不覆盖。
const AUG: Array<[string, string]> = [
  ['.btn.primary', 'tl-clip br-clip border'],
  ['.btn:not(.primary):not(.ghost)', 'tl-clip br-clip border'],
  ['.option', 'tl-clip br-clip border'],
  ['.panel', 'tl-clip br-clip border'],
  ['.talisman', 'tl-clip br-clip border'],
  ['.terminal', 'tr-clip bl-clip border'],
  ['.env', 'tl-clip border'],
  ['.outcome', 'tl-clip br-clip border'],
  ['.yun li', 'tl-clip br-clip border'],
];

function augment(root: ParentNode = document) {
  for (const [sel, value] of AUG) {
    root.querySelectorAll(sel).forEach(el => {
      if (!el.hasAttribute('data-augmented-ui')) el.setAttribute('data-augmented-ui', value);
    });
  }
}

/* ---------------- 页面切换 ---------------- */

function show(id: ScreenId, render?: () => void) {
  const update = () => {
    render?.();
    augment();
    document.querySelectorAll<HTMLElement>('.screen').forEach(s => (s.hidden = s.id !== `screen-${id}`));
    window.scrollTo(0, 0);
  };
  const focusHeading = () => document.querySelector<HTMLElement>(`#screen-${id} h1, #screen-${id} h2`)?.focus({ preventScroll: true });
  if (!document.startViewTransition || reducedMotion()) {
    update();
    focusHeading();
    return;
  }
  document.startViewTransition(update).finished.finally(focusHeading);
}

/* ---------------- 表单 ---------------- */

function fillSelect(select: HTMLSelectElement, options: Array<[string, string]>, keep?: string) {
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  if (keep && options.some(([v]) => v === keep)) select.value = keep;
}

function setupForm() {
  const form = $<HTMLFormElement>('#birth-form');
  const error = $('#form-error');
  const unknown = $<HTMLInputElement>('#unknown-time');
  const time = $<HTMLInputElement>('#birth-time');
  const solarDate = $<HTMLInputElement>('#birth-date');
  const lunarYear = $<HTMLSelectElement>('#lunar-year');
  const lunarMonth = $<HTMLSelectElement>('#lunar-month');
  const lunarDay = $<HTMLSelectElement>('#lunar-day');
  const preview = $('#lunar-preview');
  const province = $<HTMLSelectElement>('#birth-province');
  const city = $<HTMLSelectElement>('#birth-city');

  unknown.addEventListener('change', () => (time.disabled = unknown.checked));

  /* 历法切换 */
  const years: Array<[string, string]> = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) years.push([String(y), lunarYearLabel(y)]);
  fillSelect(lunarYear, years);
  const refreshMonths = () => {
    fillSelect(lunarMonth, lunarMonths(+lunarYear.value).map(m => [String(m.value), m.label]), lunarMonth.value);
    refreshDays();
  };
  const refreshDays = () => {
    const m = lunarMonths(+lunarYear.value).find(x => x.value === +lunarMonth.value);
    const days: Array<[string, string]> = Array.from({ length: m?.days ?? 30 }, (_, i) => [String(i + 1), lunarDayName(i + 1)]);
    fillSelect(lunarDay, days, lunarDay.value);
    const s = lunarToSolar(+lunarYear.value, +lunarMonth.value, +lunarDay.value);
    preview.textContent = `对应公历 ${s.year}-${pad(s.month)}-${pad(s.day)}`;
  };
  lunarYear.addEventListener('change', refreshMonths);
  lunarMonth.addEventListener('change', refreshDays);
  lunarDay.addEventListener('change', refreshDays);

  const setCalendar = (lunar: boolean) => {
    $('#solar-fields').hidden = lunar;
    $('#lunar-fields').hidden = !lunar;
    solarDate.disabled = lunar;
    if (lunar) {
      // 把已填的公历日期换算过来，作为农历的初始值
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate.value);
      const l = m ? solarToLunar(+m[1], +m[2], +m[3]) : { year: 1998, month: 1, day: 1 };
      const y = Math.min(MAX_YEAR, Math.max(MIN_YEAR, l.year));
      lunarYear.value = String(y);
      fillSelect(lunarMonth, lunarMonths(y).map(x => [String(x.value), x.label]), String(l.month));
      lunarDay.value = String(l.day);
      refreshDays();
    }
  };
  form.querySelectorAll<HTMLInputElement>('input[name="calendar"]').forEach(r =>
    r.addEventListener('change', () => setCalendar(r.value === 'lunar' && r.checked)),
  );

  /* 省份 → 城市 */
  for (const p of PROVINCES) province.add(new Option(p.name, p.name));
  province.addEventListener('change', () => {
    const p = PROVINCES.find(x => x.name === province.value);
    city.disabled = !p;
    fillSelect(city, p ? p.cities.map(([name, lng]) => [String(lng), name]) : [['', '先选省份']]);
  });

  form.addEventListener('input', () => (error.hidden = true));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const isLunar = data.get('calendar') === 'lunar';
    let date: { year: number; month: number; day: number } | null = null;
    if (isLunar) {
      date = lunarToSolar(+lunarYear.value, +lunarMonth.value, +lunarDay.value);
    } else {
      const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data.get('date') ?? ''));
      if (dm) date = { year: +dm[1], month: +dm[2], day: +dm[3] };
    }
    const tm = /^(\d{2}):(\d{2})/.exec(unknown.checked ? '12:00' : String(data.get('time') ?? ''));
    const gender = data.get('gender') as Gender | null;
    const problem = !date
      ? '请填写出生日期。'
      : !isLunar && (date.year < MIN_YEAR || date.year > MAX_YEAR)
        ? `出生年份需要在 ${MIN_YEAR} 到 ${MAX_YEAR} 年之间。`
        : !tm
          ? '请填写出生时间，或勾选"不清楚具体时间"。'
          : !gender
            ? '请选择性别，它决定大运的排列方向。'
            : '';
    if (problem || !date || !tm || !gender) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }
    game = newGame({
      time: { ...date, hour: +tm[1], minute: +tm[2] },
      gender,
      longitude: city.value ? Number(city.value) : null,
    });
    writeSave({ input: game.input, picks: [] });
    show('decode', startDecode);
  });
}

/* ---------------- 解码动画 ---------------- */

function startDecode() {
  if (!game) return;
  const lines = codeLines(game.chart, game.code);
  const body = $('#term-body');
  const bar = $('#decode-progress');
  const next = $('#btn-show-code');
  const skip = $('#btn-skip');
  next.hidden = true;
  skip.hidden = false;
  window.clearTimeout(typingTimer);

  const total = lines.join('').length;
  const finish = () => {
    window.clearTimeout(typingTimer);
    body.innerHTML = lines.map((l, i) => (i === lines.length - 1 ? `<span class="done">${esc(l)}</span>` : esc(l))).join('\n');
    bar.style.width = '100%';
    next.hidden = false;
    skip.hidden = true;
    next.focus();
  };
  skip.onclick = finish;
  if (reducedMotion()) return finish();

  let line = 0;
  let ch = 0;
  let typed = 0;
  const tick = () => {
    if (line >= lines.length) return finish();
    ch++;
    typed++;
    const done = lines.slice(0, line).map(esc);
    body.innerHTML = [...done, esc(lines[line].slice(0, ch)) + '<span class="caret"></span>'].join('\n');
    bar.style.width = `${Math.round((typed / total) * 100)}%`;
    if (ch >= lines[line].length) {
      line++;
      ch = 0;
      typingTimer = window.setTimeout(tick, 260);
    } else {
      typingTimer = window.setTimeout(tick, lines[line][ch - 1] === ' ' ? 4 : 16);
    }
  };
  body.textContent = '';
  tick();
}

/* ---------------- 底层代码 ---------------- */

/** 五行五边形雷达图：单一系列，每个顶点直接标注五行、属性名和数值。 */
function radar(code: LifeCode): string {
  const cx = 150;
  const cy = 140;
  const R = 80;
  const top = Math.max(...code.stats.map(s => s.value));
  const max = Math.max(40, Math.ceil(top / 10) * 10);
  const pt = (r: number, i: number) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (r: (i: number) => number) => code.stats.map((_, i) => pt(r(i), i).map(n => n.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon class="grid" points="${poly(() => R * f)}"/>`).join('');
  const spokes = code.stats.map((_, i) => `<line class="spoke" x1="${cx}" y1="${cy}" x2="${pt(R, i)[0].toFixed(1)}" y2="${pt(R, i)[1].toFixed(1)}"/>`).join('');
  const valueR = (i: number) => Math.max(4, (code.stats[i].value / max) * R);
  const dots = code.stats.map((s, i) => `<circle class="dot fill-${s.element}" cx="${pt(valueR(i), i)[0].toFixed(1)}" cy="${pt(valueR(i), i)[1].toFixed(1)}" r="4.5"/>`).join('');
  const labels = code.stats
    .map((s, i) => {
      const [x, y] = pt(R + 18, i);
      const anchor = Math.abs(x - cx) < 5 ? 'middle' : x > cx ? 'start' : 'end';
      const y1 = i === 0 ? y - 22 : y > cy + 20 ? y + 6 : y - 4;
      return `<text text-anchor="${anchor}" x="${x.toFixed(1)}"><tspan class="glyph fill-${s.element}" y="${y1.toFixed(1)}">${s.element}</tspan><tspan class="name" x="${x.toFixed(1)}" y="${(y1 + 16).toFixed(1)}">${esc(s.stat)} <tspan class="val">${s.value}</tspan></tspan></text>`;
    })
    .join('');
  const summary = code.stats.map(s => `${s.element}${s.stat}${s.value}`).join(',');
  return `<svg class="radar" viewBox="0 0 300 262" role="img" aria-label="五行占比：${esc(summary)}">
    ${rings}${spokes}
    <g class="radar-draw"><polygon class="area" points="${poly(valueR)}"/>${dots}</g>
    ${labels}
  </svg>`;
}

function renderCode() {
  if (!game) return;
  const { chart, code } = game;
  const pillars = chart.pillars
    .map(
      (p, i) => `
      <div class="talisman${i === 2 ? ' day' : ''}">
        <span class="lbl">${esc(p.label)}</span>
        <span class="ss">${esc(p.ganShiShen)}</span>
        <span class="gz el-${p.ganElement}">${esc(p.gan)}</span>
        <span class="gz el-${p.zhiElement}">${esc(p.zhi)}</span>
        <span class="rule"></span>
        <span class="hide">${p.hideGan.map(esc).join('')}</span>
      </div>`,
    )
    .join('');
  const yun = chart.daYun
    .map(d => `<li><b>${esc(d.ganZhi)}</b><span>${d.startAge}–${d.endAge}岁</span></li>`)
    .join('');

  $('#screen-code').innerHTML = `
    <p class="eyebrow">step 03 · character ready</p>
    <h2 class="h2" id="code-title" tabindex="-1">你的底层代码</h2>
    <div class="hud-bar"><span class="lv">LV.0 · 角色已生成</span><span>SEED ${esc(code.seedHex)}</span></div>

    <div class="panel reveal">
      <div class="panel-title"><span>四柱源码</span><b>${esc(chart.lunarText)} · 生肖${esc(chart.zodiac)}</b></div>
      <div class="pillars">${pillars}</div>
    </div>

    <div class="panel reveal">
      <div class="kernel">
        <div class="kernel-hex"><span class="el-${chart.dayMaster.element}">${esc(chart.dayMaster.gan)}</span></div>
        <h3>${esc(code.kernel)} · ${esc(code.kernelTitle)}内核</h3>
        <p>意象：${esc(code.kernelImage)}。${esc(code.kernelDesc)}</p>
      </div>
      <div class="chips"><span class="chip magenta">${esc(code.power.label)}</span><span class="chip">${esc(code.power.desc)}</span></div>
    </div>

    <div class="panel reveal">
      <div class="panel-title"><span>初始属性</span><b>五行占比 %</b></div>
      <div class="radar-wrap">${radar(code)}</div>
    </div>

    <div class="split">
      <div class="panel module reveal">
        <span class="hint">天赋模块</span>
        <b>${esc(code.talent.name)}</b>
        <p>${esc(code.talent.desc)}</p>
      </div>
      <div class="panel module reveal">
        <span class="hint">成长空间</span>
        <b class="el-${code.patch.element}">${esc(code.patch.element)} · ${esc(code.patch.stat)}</b>
        <p>${esc(code.patch.desc)}</p>
      </div>
    </div>

    <div class="panel reveal">
      <div class="panel-title"><span>运行环境（大运）</span><b>${esc(chart.startYunText)}</b></div>
      <div class="yun-scroll" tabindex="0" aria-label="大运列表，可横向滑动"><ul class="yun">${yun}</ul></div>
    </div>

    <p class="fine">以上设定只用来生成这局游戏里的角色。接下来的 24 个小时，由你决定怎么过。</p>
    <button class="btn primary" type="button" id="btn-play">进入人生</button>
  `;
  $('#btn-play').onclick = () => show('stage', renderSlot);
}

/* ---------------- 人生 24 小时 ---------------- */

function newGame(input: BirthInput, picks: number[] = []): Game {
  const chart = computeChart(input);
  const code = buildLifeCode(chart);
  const g: Game = { input, chart, code, plan: planLife(chart, code.seed), choices: [], picks: [] };
  for (const i of picks) {
    const p = g.plan[g.choices.length];
    if (!p || !p.event.options[i]) break;
    record(g, p, i);
  }
  return g;
}

function record(g: Game, p: PlannedSlot, i: number) {
  const opt = p.event.options[i];
  const alternatives = p.event.options.filter((_, j) => j !== i).map(o => ({ text: o.text, effects: o.effects }));
  g.picks.push(i);
  g.choices.push({ hour: p.slot.hour, agesLabel: p.slot.agesLabel, eventId: p.event.id, optionText: opt.text, effects: opt.effects, alternatives });
}

function effectChips(effects: Effects): string {
  return AXES.filter(a => effects[a])
    .map(a => {
      const v = effects[a]!;
      const pole = AXIS_POLES[a][v > 0 ? 0 : 1];
      return `<span class="gain">+${Math.abs(v)} ${esc(pole)}</span>`;
    })
    .join('');
}

function hud(p: PlannedSlot, done: number): string {
  const bar = Array.from({ length: TOTAL_CHOICES }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
  return `<div class="hud-block"><div class="hud-bar"><span class="lv">LV.${p.slot.stage + 1} · ${esc(p.stage.name)}</span><span>EXP ${done}/${TOTAL_CHOICES}</span></div>
    <div class="exp" role="progressbar" aria-label="人生进度" aria-valuemin="0" aria-valuemax="${TOTAL_CHOICES}" aria-valuenow="${done}">${bar}</div></div>`;
}

/** 字符先乱码滚动，再逐个定格（Arwes 风格的解密效果，自己实现）。 */
function decipher(el: HTMLElement, text: string) {
  if (reducedMotion()) {
    el.textContent = text;
    return;
  }
  const glyphs = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥01#%&';
  let frame = 0;
  const total = 14;
  const tick = () => {
    frame++;
    el.textContent = [...text]
      .map((ch, i) => (ch === ' ' || ch === ':' || frame > (i / text.length) * total + 4 ? ch : glyphs[(frame * 7 + i * 13) % glyphs.length]))
      .join('');
    if (frame < total + 5) requestAnimationFrame(tick);
    else el.textContent = text;
  };
  tick();
}

function renderSlot() {
  if (!game) return;
  const g = game;
  const p = g.plan[g.choices.length];
  const ev = p.event;
  const env = p.environment;
  const clock = clockLabel(p.slot.hour);
  const screen = $('#screen-stage');
  screen.innerHTML = `
    ${hud(p, g.choices.length)}
    <figure class="scene" data-augmented-ui="tl-clip br-clip border">
      ${sceneSvg(p.slot.hour, ev.scene, `${clock} 的场景`)}
      <figcaption class="scene-hud">
        <span class="clock" id="scene-clock">${clock}</span>
        <span class="sc">${shichen(p.slot.hour)}</span>
        <span class="age">${esc(p.slot.agesLabel)}</span>
      </figcaption>
    </figure>
    <div class="stage-name"><h2 id="stage-title" tabindex="-1">人生第 ${g.choices.length + 1} 小时</h2><span>// ${esc(p.stage.name)} · ${esc(p.stage.codeName)}</span></div>
    <div class="env"><span class="tag">环境</span><b class="${env.element ? `el-${env.element}` : ''}">${esc(env.ganZhi)}</b><span>${esc(env.relation)}</span></div>
    <p class="event-text reveal">${esc(ev.text)}</p>
    <div class="options" id="options">
      ${ev.options
        .map(
          (o, i) => `<button class="option reveal" type="button" data-i="${i}" data-augmented-ui="tl-clip br-clip border"><span class="mark">${OPTION_MARKS[i]}</span><span>${esc(o.text)}</span></button>`,
        )
        .join('')}
    </div>
  `;
  decipher($('#scene-clock'), clock);
  screen.querySelectorAll<HTMLButtonElement>('.option').forEach(btn =>
    btn.addEventListener('click', () => choose(Number(btn.dataset.i))),
  );
}

function choose(i: number) {
  if (!game) return;
  const g = game;
  const p = g.plan[g.choices.length];
  const opt = p.event.options[i];
  record(g, p, i);
  writeSave({ input: g.input, picks: g.picks });

  const isLast = g.choices.length >= TOTAL_CHOICES;
  const next = g.plan[g.choices.length];
  const nextLabel = isLast ? '生成选择画像' : `前往 ${clockLabel(next.slot.hour)}`;
  $('#screen-stage .hud-block').outerHTML = hud(p, g.choices.length);
  $('#options').outerHTML = `
    <div class="outcome reveal" aria-live="polite">
      <p class="picked">你选择了「${esc(opt.text)}」</p>
      <p class="story">${esc(opt.result)}</p>
      <div class="chips">${effectChips(opt.effects)}</div>
      <button class="btn primary" type="button" id="btn-next" data-augmented-ui="tl-clip br-clip border">${nextLabel}</button>
    </div>`;
  augment($('#screen-stage'));
  const btn = $('#btn-next');
  btn.focus({ preventScroll: true });
  btn.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  btn.onclick = () => {
    if (!isLast) return show('stage', renderSlot);
    requestTiltPermission();
    show('result', renderResult);
  };
}

/* ---------------- 结果 ---------------- */

/** 人生一日表盘:24 个节点按钟点排在圆周上，体现主轴的时刻高亮。 */
function dial(r: Report): string {
  const cx = 150;
  const cy = 150;
  const R = 112;
  const pos = (hour: number, rr: number) => {
    const a = ((hour / 24) * 360 - 90) * (Math.PI / 180);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const nodes = r.timeline
    .map(t => {
      const [x, y] = pos(t.hour, R);
      return `<circle class="node${t.main ? ' main' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${t.main ? 7 : 5}"><title>${clockLabel(t.hour)} · ${esc(t.agesLabel)}:${esc(t.optionText)}</title></circle>`;
    })
    .join('');
  const ticks = [0, 6, 12, 18]
    .map(h => {
      const [x, y] = pos(h, R + 24);
      return `<text class="tick" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${clockLabel(h)}</text>`;
    })
    .join('');
  const path = r.timeline.map(t => pos(t.hour, R)).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="dial-chart" viewBox="0 0 300 300" role="img" aria-label="人生一日表盘：金色节点是体现「${esc(r.mainPole)}」的时刻">
    <circle class="ring" cx="${cx}" cy="${cy}" r="${R}"/>
    <path class="trail" d="${path}"/>
    ${ticks}${nodes}
    <text class="center-big" x="${cx}" y="${cy - 4}" text-anchor="middle">${esc(r.archetype.name)}</text>
    <text class="center-small" x="${cx}" y="${cy + 20}" text-anchor="middle">06:00 出生 → 05:00 破晓</text>
  </svg>`;
}

function section(title: string, body: string, note = ''): string {
  return `<section class="panel report-block"><div class="panel-title"><span>${esc(title)}</span>${note ? `<b>${note}</b>` : ''}</div>${body}</section>`;
}

/** 全息卡：跟随手指或陀螺仪倾斜，高光和镭射纹随角度移动；没有输入时自动缓慢流光。 */
let tiltPermission = false;
function requestTiltPermission() {
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
  if (DOE?.requestPermission) {
    DOE.requestPermission().then(r => (tiltPermission = r === 'granted')).catch(() => {});
  } else {
    tiltPermission = true;
  }
}

function setupHolo(wrap: HTMLElement) {
  if (reducedMotion()) return;
  const set = (x: number, y: number) => {
    wrap.classList.add('live');
    wrap.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
    wrap.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
    wrap.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
    wrap.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
  };
  wrap.addEventListener('pointermove', e => {
    const b = wrap.getBoundingClientRect();
    set((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  });
  wrap.addEventListener('pointerleave', () => wrap.classList.remove('live'));
  if (tiltPermission) {
    const onTilt = (e: DeviceOrientationEvent) => {
      if (!wrap.isConnected) return window.removeEventListener('deviceorientation', onTilt);
      if (e.gamma == null || e.beta == null) return;
      set(Math.min(1, Math.max(0, 0.5 + e.gamma / 50)), Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 50)));
    };
    window.addEventListener('deviceorientation', onTilt);
  }
}

function renderResult() {
  if (!game) return;
  const g = game;
  const r = buildReport(g.chart, g.code, g.choices);
  const max = Math.max(4, ...AXES.map(a => Math.abs(r.scores[a])));
  const axes = r.axes
    .map(l => {
      const [pos, neg] = AXIS_POLES[l.axis];
      const w = (Math.abs(l.score) / max) * 50;
      const style = l.score >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`;
      return `<div class="axis"><span class="l${l.score < 0 ? ' on' : ''}">${neg}</span><span class="track"><span class="fill ${l.score >= 0 ? 'pos' : 'neg'}" style="${style}"></span></span><span class="${l.score > 0 ? 'on' : ''}">${pos}</span><span class="pct">${l.score === 0 ? '—' : `${l.pct}%`}</span></div>`;
    })
    .join('');
  const tagColors = ['cyan', 'magenta', 'gold'];
  const tags = r.traits.map((t, i) => `<span class="chip ${tagColors[i]}">${esc(t.pole)}</span>`).join('');
  const moments = r.moments.length
    ? `<ol class="moments">${r.moments.map(m => `<li><span class="when">${m.clock}<small>${esc(m.agesLabel)}</small></span><span>你选择了「${esc(m.optionText)}」</span></li>`).join('')}</ol>`
    : '<p class="insight">你的选择分布得很均匀，没有特别突出的一类时刻。</p>';
  const rewrites = r.rewrites
    .map(w => `<tr><th scope="row">${AXIS_POLES[w.axis].join(' / ')}</th><td>${esc(w.setting)}<small>${esc(w.reason)}</small></td><td>${esc(w.choice)}</td><td><span class="verdict v-${w.verdict}">${w.verdict}</span></td></tr>`)
    .join('');
  const strengths = r.archetype.strengths.map(x => `<li>${esc(x)}</li>`).join('');
  const blinds = r.archetype.blindSpots.map(x => `<li>${esc(x)}</li>`).join('');

  const screen = $('#screen-result');
  screen.innerHTML = `
    <p class="eyebrow">step 04 · game clear</p>
    <div class="hud-bar"><span class="lv">人生 24 小时 · 通关</span><span>EXP ${TOTAL_CHOICES}/${TOTAL_CHOICES}</span></div>

    <div class="holo" id="holo">
      <div class="share-card" data-augmented-ui="tl-clip br-clip border">
        <div class="foil" aria-hidden="true"></div>
        <div class="glare" aria-hidden="true"></div>
        <p class="eyebrow">角色卡 · ${esc(g.code.seedHex)}</p>
        <h2 class="result-title" id="result-title" tabindex="-1">${esc(r.title)}</h2>
        <p class="motto">${esc(r.archetype.motto)}</p>
        <div class="seal" aria-hidden="true"><span>代</span><span>底</span><span>码</span><span>层</span></div>
        <div class="chips">${tags}</div>
        <p class="card-line">内核 <b class="el-${g.chart.dayMaster.element}">${esc(g.code.kernel)}</b> · 主轴 <b>${esc(r.mainPole)}</b> · 改写 <b>${r.rewriteCount}</b> 行代码</p>
        <div class="axes">${axes}</div>
        <div class="card-foot"><span>${esc(g.code.kernelTitle)}内核 · ${esc(g.code.talent.name)}</span><span>人生底层代码</span></div>
      </div>
    </div>
    <p class="shot-hint">截图这张卡片，就可以分享你的角色卡</p>

    ${section('你的选择风格', `<p class="insight">${esc(r.archetype.desc)}</p><div class="traits">${r.traits.map(t => `<div class="trait"><b>${esc(t.pole)}</b><p>${esc(t.evidence)}</p></div>`).join('')}</div>`)}

    ${section('人生一日表盘', `<div class="dial-wrap">${dial(r)}</div><p class="hint">金色节点是体现「${esc(r.mainPole)}」的时刻，共 ${r.timeline.filter(t => t.main).length} 个。</p>`, '24 个选择')}

    ${section('名场面', moments, `最能体现「${esc(r.mainPole)}」`)}

    ${section('设定 vs 选择', `<p class="insight">在六行底层代码里，你<em>改写了 ${r.rewriteCount} 行</em>。</p>
      <div class="table-scroll"><table class="rewrite"><thead><tr><th scope="col">维度</th><th scope="col">出生设定</th><th scope="col">你的选择</th><th scope="col"></th></tr></thead><tbody>${rewrites}</tbody></table></div>
      <p class="hint">${esc(r.contrast.text)}</p>`)}

    ${section('前半天 vs 后半天', `<div class="halves"><div><span class="hint">06:00–17:00</span><b>${esc(r.halves.morning)}</b></div><span class="arrow" aria-hidden="true">→</span><div><span class="hint">18:00–05:00</span><b>${esc(r.halves.night)}</b></div></div><p class="insight">${esc(r.halves.text)}</p>`)}

    ${section('选择一致性', `<div class="meter"><span style="width:${r.consistency.pct}%"></span></div><p class="insight"><b class="big">${r.consistency.pct}%</b> · ${esc(r.consistency.label)}</p><p class="hint">只统计你这一局：同一维度上，选择方向互相抵消得越少，数值越高。</p>`)}

    ${section('优势与盲点', `<div class="split"><div class="module"><span class="hint">优势</span><ul class="dots">${strengths}</ul></div><div class="module"><span class="hint">盲点</span><ul class="dots">${blinds}</ul></div></div>`)}

    ${section('搭档', `<p class="insight">${esc(r.partner.text)}</p>${r.partner.same ? `<p class="hint">和你同频的是「${esc(r.partner.same.name)}」:${esc(r.partner.same.motto)}。</p>` : ''}<p class="hint">把游戏发给朋友，看看 TA 是哪一种。</p>`)}

    ${r.parallel ? section('平行人生', `<p class="insight">${esc(r.parallel.text)}</p><button class="btn" type="button" id="btn-parallel">重开这一天，换一种选法</button>`) : ''}

    ${section('这周的小实验', `<p class="insight">${esc(r.archetype.suggestion)}</p><p class="hint">留给自己的问题：${esc(r.archetype.question)}</p>`)}

    <section class="panel locked report-block">
      <div class="panel-title"><span>完整深度报告</span><b>内测中</b></div>
      <ul>${LOCKED_ITEMS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <button class="btn" type="button" id="btn-full">我想看完整报告</button>
      <p class="note" id="full-note" hidden>完整报告还在制作中。上线后会出现在这里。</p>
    </section>

    <details class="panel method">
      <summary>这份报告是怎么算的</summary>
      <ul class="dots">${METHOD_NOTES.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </details>

    <div class="btn-row">
      <button class="btn" type="button" id="btn-replay">换一种选法</button>
      <button class="btn" type="button" id="btn-restart">换个出生时间</button>
    </div>
    <p class="fine">本游戏用传统历法生成角色设定，所有剧情与分析都是虚构的娱乐内容，不构成任何预测或建议。出生信息只在你的浏览器里计算，不会上传。</p>
  `;
  setupHolo($('#holo'));
  $('#btn-full').onclick = () => {
    $('#full-note').hidden = false;
  };
  const replay = () => {
    game = newGame(g.input);
    writeSave({ input: g.input, picks: [] });
    show('stage', renderSlot);
  };
  $('#btn-replay').onclick = replay;
  document.querySelector<HTMLElement>('#btn-parallel')?.addEventListener('click', replay);
  $('#btn-restart').onclick = () => {
    clearSave();
    show('form');
  };
}

/* ---------------- 启动 ---------------- */

function boot() {
  augment();
  setupForm();
  $('#btn-start').onclick = () => show('form');
  const saved = loadSave();
  if (saved) {
    const g = newGame(saved.input, saved.picks);
    const resume = $('#btn-resume');
    const done = g.choices.length >= TOTAL_CHOICES;
    resume.textContent = done ? '查看上次的选择画像' : `继续上次的人生 · 第 ${g.choices.length + 1} 小时`;
    resume.hidden = false;
    resume.onclick = () => {
      game = g;
      if (done) show('result', renderResult);
      else if (g.choices.length === 0) show('code', renderCode);
      else show('stage', renderSlot);
    };
  }
  $('#btn-show-code').onclick = () => show('code', renderCode);
  document.querySelectorAll<HTMLElement>('[data-go]').forEach(b => (b.onclick = () => show(b.dataset.go as ScreenId)));
}

boot();
