import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, type BirthInput } from './chart.ts';
import { buildLifeCode, codeLines, TALENTS } from './profile.ts';
import { AXES, planLife, shichen, SLOTS, STAGES, TOTAL_CHOICES } from './story.ts';
import { ARCHETYPES, BALANCED, buildReport, LOCKED_ITEMS, METHOD_NOTES, type Choice } from './report.ts';
import { rng } from './rng.ts';

const input = (y: number, m: number, d: number, h: number, mi: number, gender: BirthInput['gender'] = 'female'): BirthInput => ({
  time: { year: y, month: m, day: d, hour: h, minute: mi },
  gender,
  longitude: null,
});

function play(inp: BirthInput, pick: (n: number) => number) {
  const chart = computeChart(inp);
  const code = buildLifeCode(chart);
  const plan = planLife(chart, code.seed);
  const choices: Choice[] = plan.map(p => {
    const i = pick(p.event.options.length);
    const o = p.event.options[i];
    const alternatives = p.event.options.filter((_, j) => j !== i).map(x => ({ text: x.text, effects: x.effects }));
    return { hour: p.slot.hour, agesLabel: p.slot.agesLabel, eventId: p.event.id, optionText: o.text, effects: o.effects, alternatives };
  });
  return { chart, code, plan, choices, report: buildReport(chart, code, choices) };
}

const allEvents = () => SLOTS.flatMap(s => s.variants);

test('一天 24 个整点,从清晨 6 点走到次日 5 点', () => {
  assert.equal(TOTAL_CHOICES, 24);
  assert.deepEqual(SLOTS.map(s => s.hour), [...Array(24)].map((_, i) => (6 + i) % 24));
  for (let i = 1; i < SLOTS.length; i++) assert.ok(SLOTS[i].ages[0] > SLOTS[i - 1].ages[1], `年龄要递增:第 ${i} 个小时`);
  assert.equal(shichen(6), '卯时');
  assert.equal(shichen(23), '子时');
  assert.equal(shichen(0), '子时');
  assert.equal(shichen(12), '午时');
  assert.ok(SLOTS.every(s => STAGES[s.stage]));
});

test('场景 id 不重复', () => {
  const ids = allEvents().map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('同样的出生参数得到同样的人生', () => {
  const a = play(input(1996, 3, 8, 14, 20), () => 0);
  const b = play(input(1996, 3, 8, 14, 20), () => 0);
  assert.deepEqual(a.plan.map(p => p.event.id), b.plan.map(p => p.event.id));
  assert.equal(a.code.seedHex, b.code.seedHex);
});

test('每个小时的两个场景版本都能被抽到', () => {
  const seen = new Set<string>();
  const r = rng(7);
  for (let i = 0; i < 300; i++) {
    const { plan } = play(input(1960 + Math.floor(r() * 50), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 24), 0), () => 0);
    assert.equal(plan.length, 24);
    plan.forEach(p => seen.add(p.event.id));
  }
  assert.deepEqual([...seen].sort(), allEvents().map(e => e.id).sort());
});

test('每个维度都能往两个方向走,每个选项都有效果', () => {
  for (const axis of AXES) {
    const signs = new Set(allEvents().flatMap(e => e.options.map(o => Math.sign(o.effects[axis] ?? 0))));
    assert.ok(signs.has(1) && signs.has(-1), axis);
  }
  for (const e of allEvents()) for (const o of e.options) assert.ok(Object.keys(o.effects).length > 0, o.text);
});

test('报告:标题、特征、证据和对比都生成', () => {
  for (const pick of [() => 0, () => 1, (n: number) => n - 1]) {
    const { report, code } = play(input(1988, 11, 2, 6, 45, 'male'), pick);
    assert.ok(report.title.startsWith(code.kernel));
    assert.ok(report.traits.length > 0);
    for (const t of report.traits) assert.ok(t.evidence.length > 0, t.pole);
    const quoted = report.traits.map(t => t.evidence);
    assert.equal(new Set(quoted).size, quoted.length, '各特征的证据应尽量不重复');
    assert.ok(report.contrast.text.includes(code.talent.name));
    assert.equal(report.timeline.length, 24);
    assert.equal(report.rewrites.length, 6);
    assert.equal(report.rewriteCount, report.rewrites.filter(r => r.verdict === '改写').length);
    assert.ok(report.consistency.pct >= 0 && report.consistency.pct <= 100);
    for (const a of report.axes) assert.ok(a.pct >= 50 && a.pct <= 100, `${a.axis} ${a.pct}`);
    assert.ok(report.moments.length <= 3);
    assert.notEqual(report.partner.complement.name, report.archetype.name);
  }
});

test('报告统计与手算一致', () => {
  const { report, choices } = play(input(2001, 7, 9, 21, 15), () => 0);
  for (const a of report.axes) {
    const vals = choices.map(c => c.effects[a.axis] ?? 0);
    assert.equal(a.score, vals.reduce((s, v) => s + v, 0), a.axis);
  }
  // 名场面都支持主轴,且按时间先后排列
  const idx = report.moments.map(m => choices.findIndex(c => c.optionText === m.optionText && c.hour === m.hour));
  assert.deepEqual(idx, [...idx].sort((x, y) => x - y));
  if (report.parallel) assert.ok(report.parallel.text.includes(report.parallel.alternative));
});

// 文案红线:不出现预测、改运、断言吉凶或涉及健康、钱财决策的用语
const BANNED = ['改运', '化解', '开光', '注定', '必然', '劫数', '灾', '凶', '吉凶', '大吉', '寿命', '疾病', '病', '死', '发财', '财运', '婚姻', '桃花', '克夫', '克妻', '算命', '预测'];

test('所有面向玩家的文案都不含红线词', () => {
  const { chart, code } = play(input(1990, 1, 1, 12, 0), () => 0);
  const texts = [
    ...STAGES.flatMap(s => [s.name, s.codeName]),
    ...allEvents().flatMap(e => [e.text, ...e.options.flatMap(o => [o.text, o.result])]),
    ...Object.values(TALENTS).flatMap(t => [t.name, t.desc]),
    ...LOCKED_ITEMS,
    ...METHOD_NOTES,
    ...[...Object.values(ARCHETYPES), BALANCED].flatMap(a => [a.name, a.motto, a.desc, a.role, ...a.strengths, ...a.blindSpots, a.suggestion, a.question]),
    ...codeLines(chart, code),
  ];
  const r = rng(3);
  for (let i = 0; i < 50; i++) {
    const { report } = play(input(1970 + i, 1 + (i % 12), 1 + (i % 28), i % 24, 30), n => Math.floor(r() * n));
    texts.push(report.title, report.contrast.text, report.halves.text, report.partner.text, report.parallel?.text ?? '', ...report.traits.map(t => t.evidence));
  }
  for (const t of texts) for (const w of BANNED) assert.ok(!t.includes(w), `「${t}」含有「${w}」`);
});
