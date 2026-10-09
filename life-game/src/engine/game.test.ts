import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, type BirthInput } from './chart.ts';
import { buildLifeCode, codeLines, TALENTS } from './profile.ts';
import { agesLabel, AXES, BEATS, clockLabel, replayStory, resolveBeat, shichen, STAGES, storyContext, TOTAL_CHOICES } from './story.ts';
import { ARCHETYPES, BALANCED, buildReport, LOCKED_ITEMS, METHOD_NOTES, type Choice } from './report.ts';
import { rng } from './rng.ts';
import { BANNED } from './banned.ts';

const input = (y: number, m: number, d: number, h: number, mi: number, gender: BirthInput['gender'] = 'female'): BirthInput => ({
  time: { year: y, month: m, day: d, hour: h, minute: mi },
  gender,
  longitude: null,
});

/** 走完一生:pick 决定每一幕选第几个可用选项 */
function play(inp: BirthInput, pick: (n: number, step: number) => number, place: string | null = null) {
  const chart = computeChart(inp);
  const code = buildLifeCode(chart);
  const ctx = storyContext(code.seed, place);
  const flags = new Set<string>();
  const choices: Choice[] = [];
  const texts: string[] = [];
  const seenOptions: string[] = [];
  for (let i = 0; i < TOTAL_CHOICES; i++) {
    const r = resolveBeat(i, ctx, flags);
    assert.ok(r.options.length >= 3 && r.options.length <= 5, `${r.beat.id} 有 ${r.options.length} 个选项`);
    const k = pick(r.options.length, i);
    const opt = r.options[k];
    texts.push(r.text, ...r.options.flatMap(x => [x.text, x.result]));
    seenOptions.push(...r.options.map(x => `${r.beat.id}:${x.text}`));
    opt.set.forEach(f => flags.add(f));
    choices.push({
      hour: r.beat.hour,
      agesLabel: agesLabel(r.beat),
      eventId: r.beat.id,
      optionText: opt.text,
      effects: opt.effects,
      alternatives: r.options.filter((_, j) => j !== k).map(x => ({ text: x.text, effects: x.effects })),
    });
  }
  return { chart, code, ctx, flags, choices, texts, seenOptions, report: buildReport(chart, code, choices) };
}

test('一天 24 幕,从清晨 6 点走到次日 5 点,年龄递增', () => {
  assert.equal(TOTAL_CHOICES, 24);
  assert.deepEqual(BEATS.map(b => b.hour), [...Array(24)].map((_, i) => (6 + i) % 24));
  for (let i = 1; i < BEATS.length; i++) assert.ok(BEATS[i].ages[0] > BEATS[i - 1].ages[1], BEATS[i].id);
  assert.equal(shichen(6), '卯时');
  assert.equal(shichen(0), '子时');
  assert.equal(shichen(12), '午时');
  assert.equal(clockLabel(5), '05:00');
  assert.ok(BEATS.every(b => STAGES[b.stage]));
  assert.equal(new Set(BEATS.map(b => b.id)).size, 24);
});

test('剧情连贯:家乡用出生地,朋友名字固定', () => {
  const a = play(input(1996, 3, 8, 14, 20), () => 0, '成都市');
  assert.equal(a.ctx.home, '成都');
  assert.ok(a.texts[0].startsWith('成都的一个清晨'));
  assert.ok(a.texts.some(t => t.includes(a.ctx.friend)));
  const b = play(input(1996, 3, 8, 14, 20), () => 0, '成都市');
  assert.deepEqual(a.choices.map(c => c.optionText), b.choices.map(c => c.optionText));
  assert.equal(play(input(1996, 3, 8, 14, 20), () => 0).ctx.home, '小城');
});

test('前面的选择会改变后面的剧情', () => {
  // 5 岁那场雨里把伞分给朋友 vs 远远看着:7 岁早餐摊那一幕文字不同
  const close = play(input(1990, 5, 5, 8, 0), (_n, step) => (step === 2 ? 0 : 1));
  const far = play(input(1990, 5, 5, 8, 0), (_n, step) => (step === 2 ? 2 : 1));
  assert.notEqual(close.texts.find(t => t.startsWith('上小学了')), far.texts.find(t => t.startsWith('上小学了')));
});

test('随机走 2000 次:选项数量合规、占位符都被替换、每个选项都能走到', () => {
  const r = rng(99);
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const run = play(input(1950 + (i % 60), 1 + (i % 12), 1 + (i % 28), i % 24, 0), n => Math.floor(r() * n), i % 2 ? '杭州市' : null);
    for (const t of run.texts) assert.ok(!/[{}]/.test(t), `残留占位符:${t}`);
    run.seenOptions.forEach(s => seen.add(s.split(':')[0] + ':' + s.split(':').slice(1).join(':').replace(/成都|杭州|小城/g, '')));
  }
  // 每个选项定义至少被看到过一次(按幕统计数量)
  for (const b of BEATS) {
    const count = [...seen].filter(s => s.startsWith(b.id + ':')).length;
    assert.ok(count >= b.options.length, `${b.id}:只走到 ${count}/${b.options.length} 个选项`);
  }
});

test('每个维度都能往两个方向走,每个选项都有效果', () => {
  const all = BEATS.flatMap(b => b.options);
  for (const axis of AXES) {
    const signs = new Set(all.map(o => Math.sign(o.effects[axis] ?? 0)));
    assert.ok(signs.has(1) && signs.has(-1), axis);
  }
  for (const o of all) assert.ok(Object.keys(o.effects).length > 0);
});

test('报告:各模块生成且统计正确', () => {
  for (const pick of [() => 0, () => 1, (n: number) => n - 1]) {
    const { report, code, choices } = play(input(1988, 11, 2, 6, 45, 'male'), pick);
    assert.ok(report.title.startsWith(code.kernel));
    assert.equal(report.timeline.length, 24);
    assert.equal(report.rewrites.length, 6);
    for (const a of report.axes) {
      assert.equal(a.score, choices.reduce((s, c) => s + (c.effects[a.axis] ?? 0), 0), a.axis);
      assert.ok(a.pct >= 50 && a.pct <= 100);
    }
    const quoted = report.traits.map(t => t.evidence);
    assert.equal(new Set(quoted).size, quoted.length);
    assert.ok(report.moments.length <= 3);
    if (report.parallel) assert.ok(report.parallel.text.includes(report.parallel.alternative));
  }
});

// 文案红线:不出现预测、改运、断言吉凶或涉及健康、钱财决策的用语

test('所有面向玩家的文案都不含红线词', () => {
  const r = rng(3);
  const texts: string[] = [
    ...STAGES.flatMap(s => [s.name, s.timeOfDay]),
    ...Object.values(TALENTS).flatMap(t => [t.name, t.desc]),
    ...LOCKED_ITEMS,
    ...METHOD_NOTES,
    ...[...Object.values(ARCHETYPES), BALANCED].flatMap(a => [a.name, a.motto, a.desc, a.role, ...a.strengths, ...a.blindSpots, a.suggestion, a.question]),
  ];
  for (let i = 0; i < 300; i++) {
    const run = play(input(1970 + (i % 50), 1 + (i % 12), 1 + (i % 28), i % 24, 30), n => Math.floor(r() * n));
    const rp = run.report;
    texts.push(...run.texts, ...codeLines(run.chart, run.code), rp.title, rp.contrast.text, rp.halves.text, rp.partner.text, rp.parallel?.text ?? '', ...rp.traits.map(t => t.evidence));
  }
  for (const t of texts) for (const w of BANNED) assert.ok(!t.includes(w), `「${t}」含有「${w}」`);
});

test('选项编号在每一幕内唯一,按编号重走得到同一个故事', () => {
  for (const b of BEATS) {
    const keys = b.options.map(x => x.key);
    assert.equal(new Set(keys).size, keys.length, b.id);
    assert.ok(keys.every(k => /^[a-h]$/.test(k)), b.id);
  }
  const r = rng(7);
  for (let n = 0; n < 200; n++) {
    const a = play(input(1980 + (n % 40), 1 + (n % 12), 1 + (n % 28), n % 24, 0), m => Math.floor(r() * m));
    const keys: string[] = [];
    const flags = new Set<string>();
    for (let i = 0; i < a.choices.length; i++) {
      const opt = resolveBeat(i, a.ctx, flags).options.find(x => x.text === a.choices[i].optionText)!;
      opt.set.forEach(f => flags.add(f));
      keys.push(opt.key);
    }
    const re = replayStory(a.ctx, keys);
    assert.equal(re.steps.length, 24);
    assert.deepEqual(re.steps.map(s => s.option.text), a.choices.map(c => c.optionText));
    assert.deepEqual([...re.flags].sort(), [...a.flags].sort());
  }
  assert.equal(replayStory(storyContext(1, null), ['z']).steps.length, 0);
});
