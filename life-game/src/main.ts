// 二十四时:封面 → 扉页(真实的你)→ 序(出生设定)→ 五章二十四小时 → 跋 → 书末附录(报告与人生说明书)。
import 'lxgw-wenkai-screen-webfont/lxgwwenkaigbscreen.css';
import '@fontsource/ma-shan-zheng/400.css';
import './style.css';
import { computeChart, type BirthInput, type Chart, type Gender } from './engine/chart.ts';
import { lunarDayName, lunarMonths, lunarToSolar, lunarYearLabel, solarToLunar } from './engine/calendar.ts';
import { PROVINCES } from './engine/regions.ts';
import { buildLifeCode, codeLines, type LifeCode } from './engine/profile.ts';
import {
  agesLabel, AXES, AXIS_POLES, BEATS, beatIndexForAge, CARERS, clockLabel, environmentFor, initialFlags, replayStory,
  resolveBeat, shichen, STAGES, storyContext, TOTAL_CHOICES, fill, bornPhrase, birthPeriod, timeKind, yearLabel, PICK_HINT, TIME_LABEL,
  type Carer, type ResolvedBeat, type StoryContext,
} from './engine/story.ts';
import { buildReport, choiceOf, LOCKED_ITEMS, METHOD_NOTES, type Choice, type Report } from './engine/report.ts';
import { MAX_YEAR, MIN_YEAR } from './engine/validate.ts';
import { ageOn, CONCERNS, DEFAULT_READER, MAX_LINE, MAX_NAME, MAX_NICK, cleanText, whoOf, type Reader } from './engine/reader.ts';
import type { DeepReport } from './engine/deep.ts';
import sampleDeep from './sample-deep.json';
import { clearSave, loadSave, writeSave } from './save.ts';
import { esc } from './html.ts';
import { SCENE_IMAGES, SHOP } from './config.ts';
import { forgetCode, savedCode, unlock } from './unlock.ts';
import { SOURCES } from './engine/sources.ts';
import { DAYUN_NOTE, ELEMENT_TRAIT, familyShares, HOW_TO_READ, KERNEL_LONG, PILLAR_NOTE, seasonOf, clockNote } from './engine/chart-text.ts';
import { settingLeans } from './engine/report.ts';
import { ELEMENTS } from './engine/chart.ts';
import { bindDeep, deepHtml } from './deep-view.ts';
import { shareImage } from './share-image.ts';
import { append, Book, choose, gestureButton, hold, reducedMotion, reveal, swipeUp, taps } from './ui/book.ts';
import { AFTER_IMAGE, BIRTH_LIGHT_HOUR, BIRTH_TINT, makeLayer, mountScene, newSceneState, sceneDraw, type SceneArt } from './ui/scenes.ts';
import lqip from './scenes-lqip.json';
import { Sound } from './ui/sound.ts';
import { propSvg } from './ui/props.ts';

interface Game {
  input: BirthInput;
  place: string | null;
  reader: Reader;
  chart: Chart;
  code: LifeCode;
  ctx: StoryContext;
  flags: Set<string>;
  choices: Choice[];
  picks: string[];
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`找不到元素 ${sel}`);
  return el;
};
const pad = (n: number) => String(n).padStart(2, '0');
const wait = (ms: number) => new Promise(r => setTimeout(r, reducedMotion() ? Math.min(ms, 120) : ms));

const book = new Book($('#book'));
const appendix = $('#appendix');
let game: Game | null = null;
let draft: Reader = { ...DEFAULT_READER, lines: {} };

/* ---------------- 游戏状态 ---------------- */

function newGame(input: BirthInput, place: string | null, reader: Reader, picks: string[] = []): Game {
  const chart = computeChart(input);
  const code = buildLifeCode(chart);
  const ctx = storyContext(code.seed, place, whoOf(reader, bornPhrase(input.time.hour, input.unknownTime)));
  const g: Game = { input, place, reader, chart, code, ctx, flags: initialFlags(ctx), choices: [], picks: [] };
  for (const step of replayStory(ctx, picks).steps) record(g, step.resolved, step.resolved.options.indexOf(step.option));
  return g;
}

function record(g: Game, r: ResolvedBeat, i: number) {
  const opt = r.options[i];
  opt.set.forEach(f => g.flags.add(f));
  g.picks.push(opt.key);
  g.choices.push(choiceOf(r, opt));
}

const save = (g: Game) => writeSave({ input: g.input, place: g.place, picks: g.picks, reader: g.reader });
const T = (g: Game, s: string) => fill(s, g.ctx, g.flags);

/* ---------------- 模式切换:读书 / 书末附录 ---------------- */

function readingMode(on: boolean) {
  document.body.classList.toggle('appendix-mode', !on);
  $('#stage').hidden = !on;
  appendix.hidden = on;
  if (!on) {
    Sound.quiet();
    window.scrollTo(0, 0);
  }
}

/* ---------------- 封面 ---------------- */

function coverPage(): HTMLElement {
  const saved = loadSave();
  const savedGame = saved ? newGame(saved.input, saved.place, saved.reader, saved.picks) : null;
  const el = book.page(`
    <div class="binding" aria-hidden="true"><i style="top:12%"></i><i style="top:37%"></i><i style="top:63%"></i><i style="top:88%"></i></div>
    <h1 class="label" tabindex="-1" data-focus>二十四时</h1>
    <div class="cover-mid">
      <span class="seal" aria-hidden="true">底层<br>代码</span>
      <p class="sub">把一生放进一天</p>
      <ul class="cover-gets">
        <li>做 24 个选择，约 10 分钟</li>
        <li>得到一张属于你的人生签</li>
      </ul>
      <button class="btn solid" type="button" id="open">翻开这本书</button>
      ${savedGame ? `<button class="btn light" type="button" id="resume">${savedGame.choices.length >= TOTAL_CHOICES ? '翻到书末，看看上次的一生' : `接着读 · 第 ${savedGame.choices.length + 1} 小时`}</button>` : ''}
      <button class="btn light" type="button" id="see-sample">先看看《人生说明书》</button>
      <button class="link-btn small" type="button" id="see-sources">这本书的来历</button>
      <p class="hint">免费玩 · 不用注册 · 戴上耳机更好</p>
    </div>`);
  el.classList.add('cover');
  $('#open', el).onclick = () => {
    Sound.init();
    $('#sound').hidden = false;
    Sound.chime(4);
    draft = { ...DEFAULT_READER, lines: {} };
    book.turn(preludePage());
  };
  $('#see-sample', el).onclick = () => openSample(() => readingMode(true));
  $('#see-sources', el).onclick = () => openSources(() => readingMode(true));
  // 有封面插画(public/cover.webp)就换上;没有就保持布面封面
  const art = new Image();
  art.onload = () => {
    el.style.setProperty('--cover-art', `url("${art.src}")`);
    el.classList.add('has-art');
  };
  art.src = 'cover.webp';
  const resume = el.querySelector<HTMLButtonElement>('#resume');
  if (resume && savedGame)
    resume.onclick = () => {
      Sound.init();
      $('#sound').hidden = false;
      game = savedGame;
      if (savedGame.choices.length >= TOTAL_CHOICES) openAppendix();
      else book.turn(nextPage(savedGame));
    };
  return el;
}

/* ---------------- 插画 ---------------- */

const LQIP = lqip as Record<string, string>;
const sceneUrl = (id: string) => `scenes/${id}.webp`;

/** 这一幕的插画(没开插画就返回 null,画面退回代码绘制) */
function artFor(id: string, tint: SceneArt['tint'] = null): SceneArt | null {
  if (!SCENE_IMAGES) return null;
  return {
    base: makeLayer(sceneUrl(id), LQIP[id]),
    after: AFTER_IMAGE[id] ? makeLayer(sceneUrl(`${id}-after`), LQIP[`${id}-after`]) : null,
    tint,
  };
}

/** 在读当前这一页的时候,先把下一页的图拉下来 */
const warmed = new Set<string>();
function warm(id: string) {
  if (!SCENE_IMAGES) return;
  for (const name of AFTER_IMAGE[id] ? [id, `${id}-after`] : [id]) {
    if (warmed.has(name)) continue;
    warmed.add(name);
    new Image().src = sceneUrl(name);
  }
}

/* ---------------- 序幕:先看画,再落笔 ---------------- */

function preludePage(): HTMLElement {
  const el = book.page(`
    <figure class="plate prelude-plate" role="img" aria-label="圆形月洞窗外是天空，窗边挂着一串旧风铃，木摇篮里伸出一只婴儿的手"></figure>
    <div class="prose prelude-prose"></div>
    <button class="btn solid start" type="button" id="write" hidden>落笔，写下你的故事</button>
  `, { head: '序幕', cls: 'prelude' });
  const plate = $('.plate', el);
  const prose = $('.prose', el);
  const state = newSceneState();
  queueMicrotask(async () => {
    book.onLeave(mountScene(plate, sceneDraw({ id: 'birth', place: 'home', hour: 6, rain: false }, state, artFor('birth')), reducedMotion()));
    Sound.ambience('home', 6, false);
    plate.onclick = () => { state.ring = 1; Sound.chime(2); };
    setTimeout(() => { state.ring = 1; Sound.chime(3); }, 700);
    warm('hobby');
    await reveal(prose, ['窗边挂着一串旧风铃。', '一个孩子出生了。', '这本书，写的是你。']);
    const go = $('#write', el);
    go.hidden = false;
    go.classList.add('ink-in');
    go.onclick = () => book.turn(namePage());
  });
  return el;
}

/* ---------------- 样张 ---------------- */

/** 打开《人生说明书》样张(示例读者的节选);看完回到 back */
function openSample(back: () => void) {
  readingMode(false);
  const d = sampleDeep as unknown as DeepReport;
  appendix.innerHTML = deepHtml(d, true);
  window.scrollTo(0, 0);
  bindDeep(appendix, d);
  $<HTMLElement>('#deep-title').focus({ preventScroll: true });
  $('#btn-deep-back').onclick = back;
}

/** 打开"这本书的来历"(理论与技术来源);看完回到 back */
function openSources(back: () => void) {
  readingMode(false);
  appendix.innerHTML = `
    <p class="eyebrow">书末附录</p>
    <h2 class="h2" id="sources-title" tabindex="-1">这本书的来历</h2>
    <p class="lede">它的设定从哪里来，排盘靠不靠谱，哪些话我们不说。</p>
    ${SOURCES.map(b => `<section class="panel source"><div class="panel-title"><span>${esc(b.title)}</span></div>${b.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}${(b.notes ?? []).map(n => `<p class="hint">${esc(n)}</p>`).join('')}</section>`).join('')}
    <div class="row center"><button class="btn" type="button" id="btn-sources-back">看完了，回去</button></div>
  `;
  window.scrollTo(0, 0);
  $<HTMLElement>('#sources-title').focus({ preventScroll: true });
  $('#btn-sources-back').onclick = back;
}

/* ---------------- 扉页一:你是谁 ---------------- */

function namePage(): HTMLElement {
  const el = book.page(`
    <h2 class="big-brush" tabindex="-1" data-focus>这本书，<br>写的是你。</h2>
    <p>落笔之前，先告诉它一点关于你的事。它会照着你的样子，把这一生写下去。</p>
    <div class="field"><label for="f-name">怎么称呼你（可以不填）</label>
      <input id="f-name" class="ink-input" maxlength="${MAX_NAME}" placeholder="比如：阿禾" autocomplete="nickname" value="${esc(draft.name)}"></div>
    <div class="field"><span id="carer-label">小时候，主要是谁带大你的</span>
      <div class="chips" role="group" aria-labelledby="carer-label">${CARERS.map(c => `<button class="chip" type="button" aria-pressed="${c === draft.carer}">${c}</button>`).join('')}</div>
      <p class="hint">书里那个陪你长大的人，会是 TA。</p>
    </div>
    <div class="field"><label for="f-nick">家里人小时候怎么叫你（小名，可以不填）</label>
      <input id="f-nick" class="ink-input" maxlength="${MAX_NICK}" placeholder="比如：丫丫" autocomplete="off" value="${esc(draft.nick)}">
      <p class="hint">填了，书里带大你的人会用这个名字喊你。</p></div>
    <div class="field"><label for="f-friend">小时候最好的朋友叫什么（可以不填）</label>
      <input id="f-friend" class="ink-input" maxlength="${MAX_NICK}" placeholder="不填，书里会给 TA 起个名字" autocomplete="off" value="${esc(draft.friend)}"></div>
    <button class="btn solid start" type="button" id="next">下一页</button>
  `, { head: '扉页', folio: 1, cls: 'flyleaf' });
  el.querySelectorAll<HTMLButtonElement>('.chip').forEach(b => (b.onclick = () => {
    draft.carer = b.textContent as Carer;
    el.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#next', el).onclick = () => {
    draft.name = cleanText($<HTMLInputElement>('#f-name', el).value, MAX_NAME);
    draft.nick = cleanText($<HTMLInputElement>('#f-nick', el).value, MAX_NICK);
    draft.friend = cleanText($<HTMLInputElement>('#f-friend', el).value, MAX_NICK);
    book.turn(birthPage());
  };
  return el;
}

/* ---------------- 扉页二:生辰 ---------------- */

function fillSelect(select: HTMLSelectElement, options: Array<[string, string]>, keep?: string) {
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  if (keep && options.some(([v]) => v === keep)) select.value = keep;
}

function birthPage(): HTMLElement {
  const el = book.page(`
    <h2 class="mid-brush" tabindex="-1" data-focus>它要从你出生的那一刻写起。</h2>
    <form class="form" id="birth-form" novalidate>
      <div class="seg" role="radiogroup" aria-label="历法">
        <label class="seg-item"><input type="radio" name="calendar" value="solar" checked><span>公历</span></label>
        <label class="seg-item"><input type="radio" name="calendar" value="lunar"><span>农历</span></label>
      </div>
      <div class="field" id="solar-fields"><label for="birth-date">出生日期</label>
        <input type="date" id="birth-date" name="date" value="1998-08-16" min="${MIN_YEAR}-01-01" max="${MAX_YEAR}-12-31"></div>
      <div class="field" id="lunar-fields" hidden><span>出生日期（农历）</span>
        <div class="tri">
          <select id="lunar-year" aria-label="农历年"></select>
          <select id="lunar-month" aria-label="农历月"></select>
          <select id="lunar-day" aria-label="农历日"></select>
        </div>
        <p class="hint" id="lunar-preview" aria-live="polite"></p>
      </div>
      <div class="field"><label for="birth-time">出生时间（北京时间）</label>
        <input type="time" id="birth-time" name="time" value="09:30">
        <label class="check"><input type="checkbox" id="unknown-time"><span>不清楚具体时间，按中午 12:00</span></label>
      </div>
      <div class="field"><span id="gender-label">性别</span>
        <div class="seg" role="radiogroup" aria-labelledby="gender-label">
          <label class="seg-item"><input type="radio" name="gender" value="female"><span>女</span></label>
          <label class="seg-item"><input type="radio" name="gender" value="male"><span>男</span></label>
        </div>
      </div>
      <div class="field"><span>出生地（会写进故事里，也用来校正真太阳时）</span>
        <div class="duo">
          <select id="birth-province" aria-label="省份"><option value="">省份</option></select>
          <select id="birth-city" aria-label="城市" disabled><option value="">城市</option></select>
        </div>
      </div>
      <p class="form-error" id="form-error" role="alert" hidden></p>
      <button class="btn solid start" type="submit">落笔</button>
      <p class="hint">排盘在你的手机上完成。示例日期仅作演示，请改成你自己的。</p>
    </form>
  `, { head: '扉页', folio: 2, cls: 'flyleaf' });

  const form = $<HTMLFormElement>('#birth-form', el);
  const error = $('#form-error', el);
  const unknown = $<HTMLInputElement>('#unknown-time', el);
  const time = $<HTMLInputElement>('#birth-time', el);
  const solarDate = $<HTMLInputElement>('#birth-date', el);
  const ly = $<HTMLSelectElement>('#lunar-year', el);
  const lm = $<HTMLSelectElement>('#lunar-month', el);
  const ld = $<HTMLSelectElement>('#lunar-day', el);
  const preview = $('#lunar-preview', el);
  const province = $<HTMLSelectElement>('#birth-province', el);
  const city = $<HTMLSelectElement>('#birth-city', el);

  unknown.onchange = () => (time.disabled = unknown.checked);
  const years: Array<[string, string]> = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) years.push([String(y), lunarYearLabel(y)]);
  fillSelect(ly, years);
  const refreshDays = () => {
    const m = lunarMonths(+ly.value).find(x => x.value === +lm.value);
    fillSelect(ld, Array.from({ length: m?.days ?? 30 }, (_, i) => [String(i + 1), lunarDayName(i + 1)]), ld.value);
    const s = lunarToSolar(+ly.value, +lm.value, +ld.value);
    preview.textContent = `对应公历 ${s.year}-${pad(s.month)}-${pad(s.day)}`;
  };
  const refreshMonths = () => {
    fillSelect(lm, lunarMonths(+ly.value).map(m => [String(m.value), m.label]), lm.value);
    refreshDays();
  };
  ly.onchange = refreshMonths;
  lm.onchange = refreshDays;
  ld.onchange = refreshDays;
  form.querySelectorAll<HTMLInputElement>('input[name="calendar"]').forEach(r =>
    r.addEventListener('change', () => {
      const lunar = r.value === 'lunar' && r.checked;
      $('#solar-fields', el).hidden = lunar;
      $('#lunar-fields', el).hidden = !lunar;
      if (lunar) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate.value);
        const l = m ? solarToLunar(+m[1], +m[2], +m[3]) : { year: 1998, month: 1, day: 1 };
        const y = Math.min(MAX_YEAR, Math.max(MIN_YEAR, l.year));
        ly.value = String(y);
        fillSelect(lm, lunarMonths(y).map(x => [String(x.value), x.label]), String(l.month));
        ld.value = String(l.day);
        refreshDays();
      }
    }),
  );
  for (const p of PROVINCES) province.add(new Option(p.name, p.name));
  province.onchange = () => {
    const p = PROVINCES.find(x => x.name === province.value);
    city.disabled = !p;
    fillSelect(city, p ? p.cities.map(([name, lng]) => [String(lng), name]) : [['', '城市']]);
  };
  form.oninput = () => (error.hidden = true);
  form.onsubmit = e => {
    e.preventDefault();
    const data = new FormData(form);
    const lunar = data.get('calendar') === 'lunar';
    let date: { year: number; month: number; day: number } | null = null;
    if (lunar) date = lunarToSolar(+ly.value, +lm.value, +ld.value);
    else {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate.value);
      if (m) date = { year: +m[1], month: +m[2], day: +m[3] };
    }
    const tm = /^(\d{2}):(\d{2})/.exec(unknown.checked ? '12:00' : time.value);
    const gender = data.get('gender') as Gender | null;
    const problem = !date
      ? '请填写出生日期。'
      : !lunar && (date.year < MIN_YEAR || date.year > MAX_YEAR)
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
    const place = city.value ? (city.selectedOptions[0]?.text ?? null) : null;
    game = newGame({ time: { ...date, hour: +tm[1], minute: +tm[2] }, gender, longitude: city.value ? Number(city.value) : null, ...(unknown.checked ? { unknownTime: true } : {}) }, place, { ...draft });
    save(game);
    book.turn(prologuePage(game));
  };
  return el;
}

/* ---------------- 序:出生时的设定 ---------------- */

function pillarsHtml(chart: Chart): string {
  return `<div class="pillars">${chart.pillars
    .map((p, i) => `
      <div class="pillar${i === 2 ? ' day' : ''}">
        <span class="p-label">${esc(p.label)}</span>
        <span class="p-ss">${esc(p.ganShiShen)}</span>
        <span class="p-gz el-${p.ganElement}">${esc(p.gan)}</span>
        <span class="p-gz el-${p.zhiElement}">${esc(p.zhi)}</span>
        <span class="p-hide">${p.hideGan.map(esc).join('')}</span>
      </div>`)
    .join('')}</div>`;
}

function elementsHtml(code: LifeCode): string {
  const max = Math.max(...code.stats.map(s => s.value), 1);
  return `<ul class="elements">${code.stats
    .map(s => `<li><b class="el-${s.element}">${s.element}</b><span>${esc(s.stat)}</span><i><em class="bg-${s.element}" style="width:${(s.value / max) * 100}%"></em></i><small>${s.value}</small></li>`)
    .join('')}</ul>`;
}

function prologuePage(g: Game): HTMLElement {
  const { chart, code } = g;
  const el = book.page(`
    <h2 class="mid-brush" tabindex="-1" data-focus>序 · 你出生时的样子</h2>
    <div class="codelines"></div>
    <div class="chart-box" hidden>
      ${pillarsHtml(chart)}
      <p class="chart-cap">${esc(chart.lunarText)} · 生肖${esc(chart.zodiac)} · 日柱纳音「${esc(chart.pillars[2].naYin)}」</p>
      <div class="explain">
        <h3>怎么读这张盘</h3>
        ${HOW_TO_READ.map(t => `<p>${esc(t)}</p>`).join('')}
        <ul class="pillar-note">${PILLAR_NOTE.map(n => `<li><b>${n.label} · ${n.name}</b><span>${esc(n.text)}</span></li>`).join('')}</ul>
      </div>
      <div class="kernel"><span class="k-glyph el-${chart.dayMaster.element}">${esc(chart.dayMaster.gan)}</span>
        <div><b>你的日主：${esc(code.kernel)} · ${esc(code.kernelTitle)}</b><p class="hint">意象是${esc(code.kernelImage)}</p></div></div>
      <p class="kernel-long">${esc(KERNEL_LONG[chart.dayMaster.gan] ?? code.kernelDesc)}</p>
      <p class="chips"><span class="chip on">${esc(code.power.label)}</span><span class="chip">${esc(code.power.desc)}</span></p>
      <button class="btn solid start" type="button" id="more">翻到下一页：你的五行与天赋</button>
    </div>
  `, { head: '序', folio: 3, cls: 'prologue' });
  queueMicrotask(async () => {
    Sound.ambience('home', 6, false);
    const box = $('.codelines', el);
    await reveal(box, codeLines(chart, code), 'codeline', true);
    await wait(300);
    const chartBox = $('.chart-box', el);
    chartBox.hidden = false;
    chartBox.classList.add('ink-in');
    chartBox.scrollIntoView?.({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    Sound.chime(2);
    $('#more', el).onclick = () => book.turn(prologue2Page(g));
  });
  return el;
}

function prologue2Page(g: Game): HTMLElement {
  const { chart, code } = g;
  const age = ageOn(g.input.time);
  const strong = [...ELEMENTS].sort((a, b) => chart.elements[b] - chart.elements[a])[0];
  const weak = chart.weakestElement;
  const season = seasonOf(chart.pillars[1].zhi);
  const fam = familyShares(chart);
  const step = chart.daYun.find(d => age >= d.startAge && age <= d.endAge);
  const env = environmentFor(chart, [age, age]);
  const leans = settingLeans(chart);
  const period = birthPeriod(g.input.time.hour, g.input.unknownTime);
  const el = book.page(`
    <h2 class="mid-brush" tabindex="-1" data-focus>序 · 你的五行与天赋</h2>
    <section class="explain">
      <h3>五行：你的能量分布</h3>
      ${elementsHtml(code)}
      <p><b class="el-${strong}">${strong} 最旺（${chart.elements[strong]}%）</b>：${esc(ELEMENT_TRAIT[strong].high)}</p>
      <p><b class="el-${weak}">${weak} 最弱（${chart.elements[weak]}%）</b>：${esc(ELEMENT_TRAIT[weak].low)}</p>
      <p class="hint">${esc(season.text)}</p>
    </section>
    <section class="explain">
      <h3>十神：你的天赋偏向</h3>
      <ul class="fam">${fam.map((f, i) => `<li><span>${esc(f.name)}</span><i><em class="${i === 0 ? 'top' : ''}" style="width:${Math.max(4, f.pct)}%"></em></i><small>${f.pct}%</small><span class="fam-hint">${esc(f.hint)}</span></li>`).join('')}</ul>
      <p>你最突出的是「${esc(code.talent.name)}」：${esc(code.talent.desc)}</p>
    </section>
    <section class="explain">
      <h3>六条初始倾向</h3>
      <p class="hint">下面六对倾向，是你出生设定里的"默认值"。书里的二十四个选择，会让你顺着它写，还是改写它？</p>
      <ul class="leans">${leans.map(l => `<li><span>${AXIS_POLES[l.axis].join(' / ')}</span><b>${l.sign === 0 ? '中立' : AXIS_POLES[l.axis][l.sign === 1 ? 0 : 1]}</b></li>`).join('')}</ul>
    </section>
    <section class="explain">
      <h3>大运：每十年一章</h3>
      <p class="yun-line">${chart.daYun.slice(0, 8).map(d => `<span class="${step === d ? 'cur' : ''}">${esc(d.ganZhi)}<small>${d.startAge}–${d.endAge}</small></span>`).join('')}</p>
      <p>${step ? `你现在${age}岁，行「${esc(step.ganZhi)}」大运：${esc(env.relation)}` : esc(env.relation)}</p>
      <p class="hint">${esc(DAYUN_NOTE)}</p>
    </section>
    <p class="closing">${esc(clockNote(period))}</p>
    <p class="closing">这些是这本书写给你的初始设定。接下来的二十四个小时，由你自己来写。</p>
    <button class="btn solid start" type="button" id="go">翻到第一章</button>
  `, { head: '序', folio: 4, cls: 'prologue' });
  el.querySelector('.explain')?.classList.add('ink-in');
  $('#go', el).onclick = () => book.turn(nextPage(g));
  return el;
}

/* ---------------- 章节页与每一幕 ---------------- */

const CHAPTER = ['一', '二', '三', '四', '五'];

/** 下一页:换章时先翻到章节页 */
function nextPage(g: Game): HTMLElement {
  const i = g.choices.length;
  if (i >= TOTAL_CHOICES) return afterwordPage(g);
  const beat = BEATS[i];
  if (i === 0 || BEATS[i - 1].stage !== beat.stage) return chapterPage(g, beat.stage);
  return beatPage(g);
}

function chapterPage(g: Game, si: number): HTMLElement {
  const st = STAGES[si];
  const beats = BEATS.filter(b => b.stage === si);
  const ages = si === STAGES.length - 1 ? `${beats[0].ages[0]} 岁以后` : `${beats[0].ages[0]} 到 ${beats[beats.length - 1].ages[1]} 岁`;
  const el = book.page(`
    <p class="num">第${CHAPTER[si]}章</p>
    <h2 tabindex="-1" data-focus>${esc(st.timeOfDay)}</h2>
    <p class="meta">${esc(st.shichen)} · ${esc(st.name)} · ${ages}</p>
    <p class="epigraph">${esc(T(g, st.epigraph))}</p>
    <button class="btn" type="button" id="go">翻页</button>
  `, { head: `第${CHAPTER[si]}章`, cls: 'chapter' });
  setTimeout(() => Sound.chime(2), 500);
  $('#go', el).onclick = () => book.turn(beatPage(g));
  return el;
}

/** 按句号拆成一句句;结尾的"你——"并到上一句,不单独成行 */
function sentences(text: string): string[] {
  const parts = (text.match(/[^。！？]+[。！？」"]*/g) ?? [text]).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1 && parts[parts.length - 1].length <= 3) {
    const tail = parts.pop()!;
    parts[parts.length - 1] += tail;
  }
  return parts;
}

function beatPage(g: Game): HTMLElement {
  const r = resolveBeat(g.choices.length, g.ctx, g.flags);
  const beat = r.beat;
  const st = STAGES[beat.stage];
  const env = environmentFor(g.chart, beat.ages);
  const age = ageOn(g.input.time);
  const kind = timeKind(beat.ages, age);
  const year = yearLabel(g.input.time.year, beat.ages, r.index === TOTAL_CHOICES - 1);
  const el = book.page(`
    <div class="when"><b>${clockLabel(beat.hour)}</b><span>${esc(shichen(beat.hour))} · ${esc(agesLabel(beat))}</span></div>
    <p class="era era-${kind}"><span class="era-tag">${TIME_LABEL[kind]}</span><span>${esc(year)}${kind === 'now' ? ' · 这一页的年纪，就是现在的你' : ''}</span></p>
    ${r.index === 0 ? '<p class="era-note">书里的钟点从清晨 6 点开始，不是你真实的出生时间。</p>' : ''}
    <figure class="plate" role="img" aria-label="${esc(`${st.timeOfDay}，${agesLabel(beat)}的画面`)}">${propSvg(r.scene.prop)}</figure>
    <div class="prose"></div>
    <p class="footnote">注：这几年行「${esc(env.ganZhi)}」大运。${esc(env.relation)}</p>
  `, { head: `第${CHAPTER[beat.stage]}章 · ${st.timeOfDay}`, folio: r.index + 4 });
  const plate = $('.plate', el);
  const prose = $('.prose', el);
  const state = newSceneState();
  const period = beat.id === 'birth' ? birthPeriod(g.input.time.hour, g.input.unknownTime) : null;
  const spec = { id: beat.id, place: beat.place, hour: period ? BIRTH_LIGHT_HOUR[period] : beat.hour, rain: !!beat.rain };

  queueMicrotask(async () => {
    book.onLeave(mountScene(plate, sceneDraw(spec, state, artFor(beat.id, period ? BIRTH_TINT[period] : null)), reducedMotion()));
    if (r.index + 1 < TOTAL_CHOICES) warm(BEATS[r.index + 1].id);
    Sound.ambience(beat.place, beat.hour, !!beat.rain);

    // 开场的小动作
    if (r.gesture) {
      const gs = r.gesture;
      const btn = gestureButton(prose, gs.label, gs.kind === 'hold');
      if (gs.kind === 'hold') {
        await hold(btn, 1100, p => {
          if (beat.id === 'rain') state.open = p;
          else { state.turn = p; state.lit = p > 0.9 ? 1 : 0; }
        });
        if (beat.id === 'rain') Sound.umbrella();
        else Sound.keyTurn();
      } else if (gs.kind === 'tap') {
        const times = gs.times ?? 1;
        await taps(btn, times, n => {
          if (beat.id === 'breakfast') {
            state.wind = 2.4;
            state.cool = n / times;
            Sound.blow();
            const label = btn.querySelector('.g-label');
            if (label) label.textContent = n < times ? `再吹 ${times - n} 下` : '不烫了';
          } else if (beat.id === 'newyear') {
            state.lit = 1;
            Sound.firecracker();
          } else {
            state.ring = 1;
            Sound.chime(3);
          }
        });
        await wait(400);
      } else {
        await swipeUp(btn, p => (state.tear = p));
        Sound.paper();
      }
      btn.remove();
    }

    await reveal(prose, sentences(r.text));
    append(prose, `<p class="pick-hint ink-in">${esc(PICK_HINT[kind])}</p>`);
    const i = await choose(prose, r.options.map(o => o.text));
    const opt = r.options[i];
    Sound.pick();
    if (beat.id === 'rain' && opt.key === 'a') {
      const t0 = performance.now();
      const slide = (now: number) => { state.share = Math.min(1, (now - t0) / 1600); if (state.share < 1) requestAnimationFrame(slide); };
      requestAnimationFrame(slide);
    }
    record(g, r, i);
    save(g);
    append(prose, `<div class="result ink-in"><p class="picked">你选择了：${esc(opt.text)}</p><p>${esc(opt.result)}</p></div>`);

    if (r.write) {
      const w = r.write;
      const box = append(prose, `
        <div class="write ink-in">
          <label for="w-${w.key}">${esc(w.prompt)}</label>
          <textarea id="w-${w.key}" rows="2" maxlength="${MAX_LINE}" placeholder="${esc(w.placeholder)}"></textarea>
          <div class="row"><button class="btn solid" type="button" data-act="ink">落笔</button><button class="btn ghost" type="button" data-act="skip">先不写</button></div>
          <p class="hint">你写的话只会出现在你自己的这本书里。</p>
        </div>`);
      const text = await new Promise<string>(res => {
        box.querySelector<HTMLButtonElement>('[data-act="ink"]')!.onclick = () => res(cleanText(box.querySelector('textarea')!.value, MAX_LINE));
        box.querySelector<HTMLButtonElement>('[data-act="skip"]')!.onclick = () => res('');
      });
      box.remove();
      if (text) {
        g.reader.lines[w.key] = text;
        save(g);
        append(prose, `<p class="written">${[...text].map((ch, k) => `<span style="animation-delay:${(k * 0.1).toFixed(2)}s">${esc(ch)}</span>`).join('')}</p>`);
        state.ring = 1;
        Sound.chime(4);
        await wait(text.length * 100 + 600);
      }
    }

    const last = g.choices.length >= TOTAL_CHOICES;
    const next = last ? '' : clockLabel(BEATS[g.choices.length].hour);
    const btn = append(prose, `<button class="btn turn-btn ink-in" type="button">${last ? '天亮了' : `翻页 · 到 ${next}`}</button>`) as HTMLButtonElement;
    btn.onclick = () => book.turn(nextPage(g));
  });
  return el;
}

/* ---------------- 跋 ---------------- */

function afterwordPage(g: Game): HTMLElement {
  const el = book.page(`
    <h2 class="mid-brush" tabindex="-1" data-focus>天亮了。<br>这本书，写完了。</h2>
    <p>二十四个小时，二十四个选择。从${esc(g.ctx.home)}的清晨，到最后一页。</p>
    <div class="field"><span id="concern-label">合上书之前，最后问一件现实里的事：最近最让你在意的是？</span>
      <div class="chips stack" role="group" aria-labelledby="concern-label">
        ${CONCERNS.map(c => `<button class="chip" type="button" data-k="${c.key}" aria-pressed="${g.reader.concern === c.key}">${esc(c.label)}</button>`).join('')}
      </div>
      <p class="hint">它会让书末那份《人生说明书》说到你现在的处境。不想说也可以直接合上。</p>
    </div>
    <button class="btn solid start" type="button" id="close">合上书，看看这一生</button>
  `, { head: '跋', folio: TOTAL_CHOICES + 4, cls: 'flyleaf' });
  Sound.ambience('home', 6, false);
  setTimeout(() => Sound.chime(4), 600);
  el.querySelectorAll<HTMLButtonElement>('.chip').forEach(b => (b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    el.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    g.reader.concern = on ? (b.dataset.k as Reader['concern']) : null;
    save(g);
  }));
  $('#close', el).onclick = () => openAppendix();
  return el;
}

/* ---------------- 书末附录:人生签、报告、人生说明书 ---------------- */

function dial(r: Report): string {
  const cx = 150, cy = 150, R = 112;
  const pos = (hour: number, rr: number) => {
    const a = ((hour / 24) * 360 - 90) * (Math.PI / 180);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const nodes = r.timeline
    .map(t => {
      const [x, y] = pos(t.hour, R);
      return `<circle class="node${t.main ? ' main' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${t.main ? 7 : 4.5}"><title>${clockLabel(t.hour)} · ${esc(t.agesLabel)}：${esc(t.optionText)}</title></circle>`;
    })
    .join('');
  const ticks = [0, 6, 12, 18].map(h => { const [x, y] = pos(h, R + 22); return `<text class="tick" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${clockLabel(h)}</text>`; }).join('');
  const path = r.timeline.map(t => pos(t.hour, R)).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="dial" viewBox="0 0 300 300" role="img" aria-label="一日表盘：红色节点是体现「${esc(r.mainPole)}」的时刻">
    <circle class="ring" cx="${cx}" cy="${cy}" r="${R}"/><path class="trail" d="${path}"/>${ticks}${nodes}
    <text class="center-big" x="${cx}" y="${cy + 6}" text-anchor="middle">${esc(r.archetype.name)}</text>
  </svg>`;
}

function axesHtml(r: Report): string {
  const max = Math.max(4, ...AXES.map(a => Math.abs(r.scores[a])));
  return `<div class="axes">${r.axes
    .map(l => {
      const [pos, neg] = AXIS_POLES[l.axis];
      const w = (Math.abs(l.score) / max) * 50;
      const style = l.score >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`;
      return `<div class="axis"><span class="${l.score < 0 ? 'on' : ''}">${neg}</span><span class="track"><span class="fill ${l.score >= 0 ? 'pos' : 'neg'}" style="${style}"></span></span><span class="${l.score > 0 ? 'on' : ''}">${pos}</span></div>`;
    })
    .join('')}</div>`;
}

const section = (title: string, body: string, note = '') =>
  `<section class="leaf-card"><header><h3>${esc(title)}</h3>${note ? `<span>${note}</span>` : ''}</header>${body}</section>`;

function openAppendix() {
  if (!game) return;
  readingMode(false);
  renderAppendix(game);
}

function renderAppendix(g: Game) {
  const age = ageOn(g.input.time);
  const r = buildReport(g.chart, g.code, g.choices, age);
  const nowBeat = BEATS[beatIndexForAge(age)];
  const who = g.reader.name || '你';
  const lines = Object.entries(g.reader.lines).filter(([, v]) => v);
  const rewrites = r.rewrites
    .map(w => `<tr><th scope="row">${AXIS_POLES[w.axis].join(' / ')}</th><td>${esc(w.setting)}<small>${esc(w.reason)}</small></td><td>${esc(w.choice)}</td><td><span class="verdict v-${w.verdict}">${w.verdict}</span></td></tr>`)
    .join('');
  const moments = r.moments.length
    ? `<ol class="moments">${r.moments.map(m => `<li><span class="when-s">${m.clock}<small>${esc(m.agesLabel)}</small></span><span>你选择了「${esc(m.optionText)}」</span></li>`).join('')}</ol>`
    : '<p>你的选择分布得很均匀，没有特别突出的一类时刻。</p>';

  appendix.innerHTML = `
    <p class="eyebrow">书末附录</p>
    <article class="lot ink-in" aria-labelledby="lot-name">
      <div class="lot-top"><span>${esc(who)}的人生签</span><span>${esc(g.code.seedHex.slice(2))}</span></div>
      <div class="lot-main">
        <h2 class="lot-name" id="lot-name" tabindex="-1">${esc(r.archetype.name)}</h2>
        <div class="lot-side">
          <span class="seal big">${esc(g.chart.dayMaster.gan)}<small>${esc(g.code.kernelImage)}</small></span>
          <p class="lot-motto">${esc(r.archetype.motto)}</p>
        </div>
      </div>
      <div class="chips">${r.traits.map(t => `<span class="chip on">${esc(t.pole)}</span>`).join('')}</div>
      ${axesHtml(r)}
      <p class="lot-now">${esc(who)}今年 ${age} 岁，正翻到这本书的 <b>${clockLabel(nowBeat.hour)}</b>。</p>
      <p class="lot-foot">二十四时 · 生于${esc(g.ctx.home)} · 由${esc(g.ctx.carer)}带大 · 改写了 ${r.rewriteCount} 行底层代码</p>
    </article>
    <button class="btn" type="button" id="btn-share">生成这张签的图片，发给朋友</button>

    ${section('你的选择风格', `<p class="insight">${esc(r.archetype.desc)}</p>${r.traits.map(t => `<div class="trait"><b>${esc(t.pole)}</b><p>${esc(t.evidence)}</p></div>`).join('')}`)}
    ${section('设定 vs 选择', `<p class="insight">出生设定里的六行底层代码，你<em>改写了 ${r.rewriteCount} 行</em>。</p>
      <div class="table-scroll"><table class="rewrite"><thead><tr><th scope="col">维度</th><th scope="col">出生设定</th><th scope="col">你的选择</th><th scope="col"></th></tr></thead><tbody>${rewrites}</tbody></table></div>
      <p class="hint">每一行为什么会这样、在现实里意味着什么，写在《人生说明书》里。</p>`)}
    ${r.timeSplit ? section('过去的你 → 想要的你', `<p class="insight">${esc(r.timeSplit.text)}</p>
      ${r.timeSplit.shifts.length ? `<div class="shift-rows">${r.timeSplit.shifts.slice(0, 3).map(x => `<div class="shift-row changed"><b>${AXIS_POLES[x.axis].join(' / ')}</b><span class="shift-line"><em>${esc(x.pastPole)}</em><i aria-hidden="true">→</i><em class="to">${esc(x.futurePole)}</em></span></div>`).join('')}</div>` : ''}
      <p class="hint">你今年 ${r.timeSplit.age} 岁：${r.timeSplit.pastCount} 页是你走过的回忆（选的是当时的你），${r.timeSplit.futureCount} 页是还没发生的设想（选的是想成为的你）。每一条怎么理解、从哪里开始，写在《人生说明书》里。</p>`, '回忆 vs 设想') : ''}
    ${section('一日表盘', `<div class="dial-wrap">${dial(r)}</div><p class="hint">红点是体现「${esc(r.mainPole)}」的时刻，共 ${r.timeline.filter(t => t.main).length} 个。</p>`, '24 个选择')}
    ${section('名场面', moments, `最能体现「${esc(r.mainPole)}」`)}
    ${lines.length ? section('你亲手写下的话', lines.map(([, v]) => `<p class="written still">${esc(v)}</p>`).join('')) : ''}

    ${unlockPanel(g, age)}

    <details class="leaf-card method"><summary>这些是怎么算出来的</summary><ul>${METHOD_NOTES.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>
    <div class="row center">
      <button class="btn" type="button" id="btn-replay">重读一遍，换一种选法</button>
      <button class="btn ghost" type="button" id="btn-restart">换一个人来读</button>
    </div>
    <p class="fine">本书用传统历法生成角色设定，所有剧情与分析都是虚构的娱乐内容，不构成任何预测或建议。</p>
  `;
  $<HTMLElement>('#lot-name').focus({ preventScroll: true });
  $('#btn-share').onclick = () => void openShare(g, r, age);
  bindUnlock(g);
  $('#btn-replay').onclick = () => {
    const reader = { ...g.reader, lines: {} };
    game = newGame(g.input, g.place, reader);
    save(game);
    readingMode(true);
    book.turn(chapterPage(game, 0));
  };
  $('#btn-restart').onclick = () => {
    clearSave();
    game = null;
    readingMode(true);
    book.turn(coverPage());
  };
}

/* ---------------- 人生说明书:解锁与阅读 ---------------- */

let deepCache: { key: string; deep: DeepReport } | null = null;
const gameKey = (g: Game) => JSON.stringify([g.input, g.place, g.picks, g.reader]);

function unlockPanel(g: Game, age: number): string {
  const nowBeat = BEATS[beatIndexForAge(age)];
  const teaser = `${g.reader.name || '你'}今年 ${age} 岁，正走到这本书的 ${clockLabel(nowBeat.hour)}。在这一页，你选了「${g.choices[beatIndexForAge(age)]?.optionText ?? ''}」……`;
  const blur = g.choices.slice(0, 4).map(c => c.optionText).join('。') + '。';
  const saved = savedCode();
  const action = saved
    ? `<button class="btn solid" type="button" id="btn-open-deep">打开我的人生说明书</button>
       <button class="btn ghost" type="button" id="btn-new-code">换一个兑换码</button>`
    : `<form class="unlock-form" id="unlock-form" novalidate>
         <label for="code-input">输入兑换码</label>
         <div class="code-row">
           <input id="code-input" type="text" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="24">
           <button class="btn solid" type="submit">解锁</button>
         </div>
       </form>`;
  return `
    <section class="leaf-card unlock" id="unlock">
      <header><h3>《人生说明书》</h3><span>${esc(SHOP.price)} · 买一次一直能看</span></header>
      <div class="teaser">
        <p class="teaser-head">第一节 · 你现在所在的这一页</p>
        <p>${esc(teaser)}</p>
        <p class="blur" aria-hidden="true">${esc(blur)}</p>
      </div>
      <ul class="unlock-list">${LOCKED_ITEMS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="row"><button class="link-btn dark" type="button" id="see-sample-2">先看一份样张</button><button class="link-btn dark" type="button" id="see-sources-2">这本书的来历</button></div>
      ${action}
      <p class="form-error" id="unlock-error" role="alert" hidden></p>
      <p class="hint">一个兑换码最多在 3 台设备上使用。换选法、换一个人重读，都能生成新的说明书。</p>
      <p class="hint">还没有兑换码？${esc(SHOP.where)}。</p>
    </section>`;
}

function bindUnlock(g: Game) {
  const error = $('#unlock-error');
  $('#see-sample-2').onclick = () => openSample(() => renderAppendix(g));
  $('#see-sources-2').onclick = () => openSources(() => renderAppendix(g));
  const run = async (code: string, button: HTMLButtonElement) => {
    error.hidden = true;
    const key = gameKey(g);
    if (deepCache?.key === key) return openDeep(g, deepCache.deep);
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '正在写…';
    const res = await unlock(code, g.input, g.place, g.picks, g.reader);
    button.disabled = false;
    button.textContent = label;
    if (res.ok) {
      deepCache = { key, deep: res.deep };
      openDeep(g, res.deep);
      return;
    }
    if (res.forget) forgetCode();
    error.textContent = res.error;
    error.hidden = false;
  };
  const form = document.querySelector<HTMLFormElement>('#unlock-form');
  if (form) {
    const input = $<HTMLInputElement>('#code-input');
    form.onsubmit = e => {
      e.preventDefault();
      if (input.value.replace(/[^0-9a-z]/gi, '').length < 12) {
        error.textContent = '兑换码是 12 位字母和数字，请检查一下。';
        error.hidden = false;
        input.focus();
        return;
      }
      void run(input.value.trim(), form.querySelector('button')!);
    };
  }
  const open = document.querySelector<HTMLButtonElement>('#btn-open-deep');
  if (open) open.onclick = () => void run(savedCode() ?? '', open);
  const again = document.querySelector<HTMLButtonElement>('#btn-new-code');
  if (again)
    again.onclick = () => {
      forgetCode();
      $('#unlock').outerHTML = unlockPanel(g, ageOn(g.input.time));
      bindUnlock(g);
      $<HTMLInputElement>('#code-input').focus();
    };
}

function openDeep(g: Game, deep: DeepReport) {
  appendix.innerHTML = deepHtml(deep);
  window.scrollTo(0, 0);
  bindDeep(appendix, deep);
  $<HTMLElement>('#deep-title').focus({ preventScroll: true });
  $('#btn-deep-back').onclick = () => renderAppendix(g);
  $('#btn-deep-replay').onclick = () => {
    game = newGame(g.input, g.place, { ...g.reader, lines: {} });
    save(game);
    readingMode(true);
    book.turn(chapterPage(game, 0));
  };
}

async function openShare(g: Game, r: Report, age: number) {
  const sheet = $('#share-sheet');
  const btn = $<HTMLButtonElement>('#btn-share');
  btn.disabled = true;
  try {
    $<HTMLImageElement>('#share-img').src = await shareImage({
      title: r.archetype.name,
      motto: r.archetype.motto,
      tags: r.traits.map(t => t.pole),
      gan: g.chart.dayMaster.gan,
      image: g.code.kernelImage,
      line: `日主 ${g.code.kernel} · 主轴「${r.mainPole}」· 改写了 ${r.rewriteCount} 行底层代码`,
      axes: r.axes.map(a => ({ axis: a.axis, score: a.score, pct: a.pct })),
      moment: r.moments[0] ? `${r.moments[0].clock}（${r.moments[0].agesLabel}），我选择了「${r.moments[0].optionText}」` : null,
      closing: `今年 ${age} 岁，正翻到这本书的 ${clockLabel(BEATS[beatIndexForAge(age)].hour)}。`,
      home: g.ctx.home,
      seed: g.code.seedHex.slice(2),
      site: SHOP.site || (location.protocol === 'https:' && !/claude|anthropic/.test(location.host) ? location.host : ''),
      name: g.reader.name,
    });
    sheet.hidden = false;
    $('#btn-sheet-close').focus();
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- 启动 ---------------- */

function boot() {
  const soundBtn = $<HTMLButtonElement>('#sound');
  const paint = () => {
    soundBtn.setAttribute('aria-pressed', String(Sound.on));
    soundBtn.textContent = Sound.on ? '声音 开' : '声音 关';
  };
  paint();
  soundBtn.onclick = () => {
    Sound.init();
    Sound.set(!Sound.on);
    paint();
  };
  const sheet = $('#share-sheet');
  const closeSheet = () => {
    sheet.hidden = true;
    document.querySelector<HTMLElement>('#btn-share')?.focus();
  };
  $('#btn-sheet-close').onclick = closeSheet;
  sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  readingMode(true);
  warm('birth');
  book.turn(coverPage(), false);
}

boot();
