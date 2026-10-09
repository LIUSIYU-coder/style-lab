import './style.css';
import { computeChart, type Chart, type Gender } from './engine/chart.ts';
import { lunarDayName, lunarMonths, lunarToSolar, lunarYearLabel, solarToLunar } from './engine/calendar.ts';
import { PROVINCES } from './engine/regions.ts';
import { buildLifeCode, codeLines, type LifeCode } from './engine/profile.ts';
import { AXES, AXIS_POLES, type Effects, type PlannedStage, planLife } from './engine/story.ts';
import { buildReport, LOCKED_ITEMS, type Choice } from './engine/report.ts';

type ScreenId = 'intro' | 'form' | 'decode' | 'code' | 'stage' | 'result';

interface Game {
  chart: Chart;
  code: LifeCode;
  plan: PlannedStage[];
  choices: Choice[];
  stage: number;
  event: number;
}

let game: Game | null = null;
let typingTimer = 0;

const OPTION_MARKS = ['甲', '乙', '丙'];
const TOTAL_CHOICES = 10;
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

/* ---------------- 页面切换 ---------------- */

function show(id: ScreenId, render?: () => void) {
  const update = () => {
    render?.();
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
      // 把已填的公历日期换算过来,作为农历的初始值
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
          ? '请填写出生时间,或勾选"不清楚具体时间"。'
          : !gender
            ? '请选择性别,它决定大运的排列方向。'
            : '';
    if (problem || !date || !tm || !gender) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }
    const chart = computeChart({
      time: { ...date, hour: +tm[1], minute: +tm[2] },
      gender,
      longitude: city.value ? Number(city.value) : null,
    });
    const code = buildLifeCode(chart);
    game = { chart, code, plan: planLife(chart, code.seed), choices: [], stage: 0, event: 0 };
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

/** 五行五边形雷达图:单一系列,每个顶点直接标注五行、属性名和数值。 */
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
  return `<svg class="radar" viewBox="0 0 300 262" role="img" aria-label="五行占比:${esc(summary)}">
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
        <p>意象:${esc(code.kernelImage)}。${esc(code.kernelDesc)}</p>
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
      <div class="panel-title"><span>运行环境(大运)</span><b>${esc(chart.startYunText)}</b></div>
      <div class="yun-scroll" tabindex="0" aria-label="大运列表,可横向滑动"><ul class="yun">${yun}</ul></div>
    </div>

    <p class="fine">以上设定只用来生成这局游戏里的角色。接下来的十个选择,由你决定。</p>
    <button class="btn primary" type="button" id="btn-play">进入人生</button>
  `;
  $('#btn-play').onclick = () => show('stage', renderStage);
}

/* ---------------- 人生阶段 ---------------- */

function effectChips(effects: Effects): string {
  return AXES.filter(a => effects[a])
    .map(a => {
      const v = effects[a]!;
      const pole = AXIS_POLES[a][v > 0 ? 0 : 1];
      return `<span class="gain">+${Math.abs(v)} ${esc(pole)}</span>`;
    })
    .join('');
}

function hud(level: number, done: number): string {
  const bar = Array.from({ length: TOTAL_CHOICES }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
  return `<div class="hud-block"><div class="hud-bar"><span class="lv">LV.${level}</span><span>EXP ${done}/${TOTAL_CHOICES}</span></div>
    <div class="exp" role="progressbar" aria-label="人生进度" aria-valuemin="0" aria-valuemax="${TOTAL_CHOICES}" aria-valuenow="${done}">${bar}</div></div>`;
}

function renderStage() {
  if (!game) return;
  const g = game;
  const planned = g.plan[g.stage];
  const ev = planned.events[g.event];
  const env = planned.environment;
  const screen = $('#screen-stage');
  screen.innerHTML = `
    ${hud(g.stage + 1, g.choices.length)}
    <div class="stage-head">
      <div class="stage-ages">${planned.stage.ages[0]}–${planned.stage.ages[1]}<small>岁</small></div>
      <div class="stage-name"><h2 id="stage-title" tabindex="-1">${esc(planned.stage.name)}</h2><span>// ${esc(planned.stage.codeName)}</span></div>
    </div>
    <div class="env"><span class="tag">环境</span><b class="${env.element ? `el-${env.element}` : ''}">${esc(env.ganZhi)}</b><span>${esc(env.relation)}</span></div>
    <p class="event-text reveal">${esc(ev.text)}</p>
    <div class="options" id="options">
      ${ev.options
        .map(
          (o, i) => `<button class="option reveal" type="button" data-i="${i}"><span class="mark">${OPTION_MARKS[i]}</span><span>${esc(o.text)}</span></button>`,
        )
        .join('')}
    </div>
  `;
  screen.querySelectorAll<HTMLButtonElement>('.option').forEach(btn =>
    btn.addEventListener('click', () => choose(Number(btn.dataset.i))),
  );
}

function choose(i: number) {
  if (!game) return;
  const g = game;
  const planned = g.plan[g.stage];
  const ev = planned.events[g.event];
  const opt = ev.options[i];
  g.choices.push({ stageName: planned.stage.name, ages: planned.stage.ages, eventId: ev.id, optionText: opt.text, effects: opt.effects });

  const isLast = g.choices.length >= TOTAL_CHOICES;
  const nextLabel = isLast ? '生成选择画像' : g.event + 1 < planned.events.length ? '继续' : `进入下一阶段`;
  $('#screen-stage .hud-block').outerHTML = hud(g.stage + 1, g.choices.length);
  $('#options').outerHTML = `
    <div class="outcome reveal" aria-live="polite">
      <p class="picked">你选择了「${esc(opt.text)}」</p>
      <p class="story">${esc(opt.result)}</p>
      <div class="chips">${effectChips(opt.effects)}</div>
      <button class="btn primary" type="button" id="btn-next">${nextLabel}</button>
    </div>`;
  const next = $('#btn-next');
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  next.onclick = () => {
    if (isLast) return show('result', renderResult);
    if (g.event + 1 < planned.events.length) {
      g.event++;
      renderStage();
      $('#stage-title').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else {
      g.stage++;
      g.event = 0;
      show('stage', renderStage);
    }
  };
}

/* ---------------- 结果 ---------------- */

function renderResult() {
  if (!game) return;
  const g = game;
  const report = buildReport(g.code, g.choices);
  const max = Math.max(3, ...AXES.map(a => Math.abs(report.scores[a])));
  const axes = AXES.map(a => {
    const s = report.scores[a];
    const [pos, neg] = AXIS_POLES[a];
    const w = (Math.abs(s) / max) * 50;
    const style = s >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`;
    return `<div class="axis"><span class="l${s < 0 ? ' on' : ''}">${neg}</span><span class="track"><span class="fill ${s >= 0 ? 'pos' : 'neg'}" style="${style}"></span></span><span class="${s > 0 ? 'on' : ''}">${pos}</span></div>`;
  }).join('');
  const tagColors = ['cyan', 'magenta', 'gold'];
  const tags = report.traits.map((t, i) => `<span class="chip ${tagColors[i]}">${esc(t.pole)}</span>`).join('');
  const traits = report.traits
    .map(t => `<div class="trait"><b>${esc(t.pole)}</b><p>${esc(t.evidence)}</p></div>`)
    .join('');

  const screen = $('#screen-result');
  screen.innerHTML = `
    <p class="eyebrow">step 04 · game clear</p>
    <div class="hud-bar"><span class="lv">LV.5 · 通关</span><span>EXP ${TOTAL_CHOICES}/${TOTAL_CHOICES}</span></div>
    <div class="holo reveal"><div class="share-card">
      <p class="eyebrow">角色卡 · ${esc(g.code.seedHex)}</p>
      <h2 class="result-title" id="result-title" tabindex="-1">${esc(report.title)}</h2>
      <p class="motto">${esc(report.archetype.motto)}</p>
      <div class="seal" aria-hidden="true"><span>代</span><span>底</span><span>码</span><span>层</span></div>
      <div class="chips">${tags}</div>
      <div class="axes">${axes}</div>
      <div class="card-foot"><span>${esc(g.code.kernel)} · ${esc(g.code.talent.name)}</span><span>人生底层代码</span></div>
    </div></div>
    <p class="shot-hint">截图这张卡片,就可以分享你的选择画像</p>

    <div class="panel">
      <div class="panel-title"><span>你的选择风格</span></div>
      <p class="insight">${esc(report.archetype.desc)}</p>
      <div class="traits">${traits}</div>
    </div>

    <div class="panel">
      <div class="panel-title"><span>设定 vs 选择</span></div>
      <p class="insight">${esc(report.contrast.text)}</p>
    </div>

    <div class="panel">
      <div class="panel-title"><span>这周的小实验</span></div>
      <p class="insight">${esc(report.archetype.suggestion)}</p>
    </div>

    <div class="panel locked">
      <div class="panel-title"><span>完整深度报告</span><b>内测中</b></div>
      <ul>${LOCKED_ITEMS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <button class="btn" type="button" id="btn-full">我想看完整报告</button>
      <p class="note" id="full-note" hidden>完整报告还在制作中。上线后会出现在这里。</p>
    </div>

    <div class="btn-row">
      <button class="btn" type="button" id="btn-replay">换一种选法</button>
      <button class="btn" type="button" id="btn-restart">换个出生时间</button>
    </div>
    <p class="fine">本游戏用传统历法生成角色设定,所有剧情与分析都是虚构的娱乐内容,不构成任何预测或建议。出生信息只在你的浏览器里计算,不会上传。</p>
  `;
  $('#btn-full').onclick = () => {
    $('#full-note').hidden = false;
  };
  $('#btn-replay').onclick = () => {
    g.choices = [];
    g.stage = 0;
    g.event = 0;
    show('stage', renderStage);
  };
  $('#btn-restart').onclick = () => show('form');
}

/* ---------------- 启动 ---------------- */

function boot() {
  setupForm();
  $('#btn-start').onclick = () => show('form');
  $('#btn-show-code').onclick = () => show('code', renderCode);
  document.querySelectorAll<HTMLElement>('[data-go]').forEach(b => (b.onclick = () => show(b.dataset.go as ScreenId)));
}

boot();
