import './style.css';
import { computeChart, type Chart, type Gender } from './engine/chart.ts';
import { CITIES } from './engine/cities.ts';
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

function setupForm() {
  const select = $<HTMLSelectElement>('#birth-city');
  for (const c of CITIES) select.add(new Option(c.name, String(c.longitude)));

  const unknown = $<HTMLInputElement>('#unknown-time');
  const time = $<HTMLInputElement>('#birth-time');
  unknown.addEventListener('change', () => (time.disabled = unknown.checked));

  const form = $<HTMLFormElement>('#birth-form');
  const error = $('#form-error');
  form.addEventListener('input', () => (error.hidden = true));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const date = String(data.get('date') ?? '');
    const clock = unknown.checked ? '12:00' : String(data.get('time') ?? '');
    const gender = data.get('gender') as Gender | null;
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const tm = /^(\d{2}):(\d{2})/.exec(clock);
    const problem = !dm
      ? '请填写出生日期。'
      : +dm[1] < 1920 || +dm[1] > 2026
        ? '出生年份需要在 1920 到 2026 年之间。'
        : !tm
          ? '请填写出生时间,或勾选"不清楚具体时间"。'
          : !gender
            ? '请选择性别,它决定大运的排列方向。'
            : '';
    if (problem || !dm || !tm || !gender) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }
    const city = String(data.get('city') ?? '');
    const chart = computeChart({
      time: { year: +dm[1], month: +dm[2], day: +dm[3], hour: +tm[1], minute: +tm[2] },
      gender,
      longitude: city ? Number(city) : null,
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

function renderCode() {
  if (!game) return;
  const { chart, code } = game;
  const pillars = chart.pillars
    .map(
      (p, i) => `
      <div class="pillar${i === 2 ? ' day' : ''}">
        <span class="lbl">${esc(p.label)}</span>
        <span class="ss">${esc(p.ganShiShen)}</span>
        <span class="gz el-${p.ganElement}">${esc(p.gan)}</span>
        <span class="gz el-${p.zhiElement}">${esc(p.zhi)}</span>
        <span class="hide">${p.hideGan.map(esc).join('')}</span>
      </div>`,
    )
    .join('');
  const stats = code.stats
    .map(
      s => `
      <div class="stat">
        <span class="ch el-${s.element}">${s.element}</span>
        <span class="name">${esc(s.stat)}</span>
        <span class="track"><span class="fill bg-${s.element}" style="width:${Math.max(2, s.value)}%"></span></span>
        <span class="val">${s.value}</span>
      </div>`,
    )
    .join('');
  const yun = chart.daYun
    .map(d => `<li><b>${esc(d.ganZhi)}</b><span>${d.startAge}–${d.endAge}岁</span></li>`)
    .join('');

  $('#screen-code').innerHTML = `
    <p class="eyebrow">第三步 · 读取完成</p>
    <h2 class="h2" id="code-title" tabindex="-1">你的底层代码</h2>

    <div class="panel reveal">
      <div class="panel-title"><span>四柱源码</span><b>${esc(chart.lunarText)} · 生肖${esc(chart.zodiac)}</b></div>
      <div class="pillars">${pillars}</div>
    </div>

    <div class="panel reveal">
      <div class="kernel">
        <div class="kernel-glyph el-${chart.dayMaster.element}">${esc(chart.dayMaster.gan)}</div>
        <h3>${esc(code.kernel)} · ${esc(code.kernelTitle)}内核</h3>
        <p>意象:${esc(code.kernelImage)}。${esc(code.kernelDesc)}</p>
      </div>
      <div class="chips"><span class="chip gold">${esc(code.power.label)}</span><span class="chip">${esc(code.power.desc)}</span></div>
    </div>

    <div class="panel reveal">
      <div class="panel-title"><span>初始属性</span><b>五行占比 %</b></div>
      <div class="stats">${stats}</div>
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
      return `<span class="chip up">${esc(pole)} +${Math.abs(v)}</span>`;
    })
    .join('');
}

function ticks(done: number): string {
  return `<div class="ticks" aria-label="已完成 ${done} / ${TOTAL_CHOICES} 个选择">${Array.from({ length: TOTAL_CHOICES }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</div>`;
}

function renderStage() {
  if (!game) return;
  const g = game;
  const planned = g.plan[g.stage];
  const ev = planned.events[g.event];
  const env = planned.environment;
  const screen = $('#screen-stage');
  screen.innerHTML = `
    ${ticks(g.choices.length)}
    <div class="stage-head">
      <div class="stage-ages">${planned.stage.ages[0]}–${planned.stage.ages[1]}<small>岁</small></div>
      <div class="stage-name"><h2 id="stage-title" tabindex="-1">${esc(planned.stage.name)}</h2><span>// ${esc(planned.stage.codeName)}</span></div>
    </div>
    <div class="env"><b class="${env.element ? `el-${env.element}` : ''}">${esc(env.ganZhi)}</b><span>${esc(env.relation)}</span></div>
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
  $('#screen-stage .ticks').outerHTML = ticks(g.choices.length);
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
    return `<div class="axis"><span class="l${s < 0 ? ' on' : ''}">${neg}</span><span class="track"><span class="fill" style="${style}"></span></span><span class="${s > 0 ? 'on' : ''}">${pos}</span></div>`;
  }).join('');
  const tags = report.traits.map(t => `<span class="chip gold">${esc(t.pole)}</span>`).join('');
  const traits = report.traits
    .map(t => `<div class="trait"><b>${esc(t.pole)}</b><p>${esc(t.evidence)}</p></div>`)
    .join('');

  const screen = $('#screen-result');
  screen.innerHTML = `
    <p class="eyebrow">第四步 · 十个选择已完成</p>
    <div class="share-card reveal">
      <p class="eyebrow">选择画像 · ${esc(g.code.seedHex)}</p>
      <h2 class="result-title" id="result-title" tabindex="-1">${esc(report.title)}</h2>
      <p class="motto">${esc(report.archetype.motto)}</p>
      <div class="seal" aria-hidden="true"><span>代</span><span>底</span><span>码</span><span>层</span></div>
      <div class="chips">${tags}</div>
      <div class="axes">${axes}</div>
      <div class="card-foot"><span>${esc(g.code.kernel)} · ${esc(g.code.talent.name)}</span><span>人生底层代码</span></div>
    </div>
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
