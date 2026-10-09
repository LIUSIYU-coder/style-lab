import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, type BirthInput } from './chart.ts';
import { buildLifeCode, codeLines, TALENTS } from './profile.ts';
import { AXES, EVENTS_PER_STAGE, planLife, STAGES } from './story.ts';
import { buildReport, LOCKED_ITEMS, type Choice } from './report.ts';
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
  const choices: Choice[] = plan.flatMap(p =>
    p.events.map(e => {
      const o = e.options[pick(e.options.length)];
      return { stageName: p.stage.name, ages: p.stage.ages, eventId: e.id, optionText: o.text, effects: o.effects };
    }),
  );
  return { chart, code, plan, report: buildReport(code, choices) };
}

test('同样的出生参数得到同样的人生', () => {
  const a = play(input(1996, 3, 8, 14, 20), () => 0);
  const b = play(input(1996, 3, 8, 14, 20), () => 0);
  assert.deepEqual(a.plan.map(p => p.events.map(e => e.id)), b.plan.map(p => p.events.map(e => e.id)));
  assert.equal(a.code.seedHex, b.code.seedHex);
});

test('每个阶段抽到固定数量的事件,所有事件都能被抽到', () => {
  const seen = new Set<string>();
  const r = rng(7);
  for (let i = 0; i < 300; i++) {
    const { plan } = play(input(1960 + Math.floor(r() * 50), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 24), 0), () => 0);
    for (const p of plan) {
      assert.equal(p.events.length, EVENTS_PER_STAGE);
      p.events.forEach(e => seen.add(e.id));
    }
  }
  const all = STAGES.flatMap(s => s.events.map(e => e.id));
  assert.deepEqual([...seen].sort(), [...all].sort());
});

test('每个维度都能往两个方向走', () => {
  for (const axis of AXES) {
    const signs = new Set(STAGES.flatMap(s => s.events.flatMap(e => e.options.map(o => Math.sign(o.effects[axis] ?? 0)))));
    assert.ok(signs.has(1) && signs.has(-1), axis);
  }
  for (const s of STAGES) for (const e of s.events) for (const o of e.options) assert.ok(Object.keys(o.effects).length > 0, o.text);
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
  }
});

// 文案红线:不出现预测、改运、断言吉凶或涉及健康、钱财决策的用语
const BANNED = ['改运', '化解', '开光', '注定', '命中注定', '必然', '劫数', '灾', '凶', '吉', '寿', '疾病', '发财', '财运', '婚姻', '桃花', '克夫', '克妻', '算命', '预测'];

test('所有面向玩家的文案都不含红线词', () => {
  const { chart, code } = play(input(1990, 1, 1, 12, 0), () => 0);
  const texts = [
    ...STAGES.flatMap(s => [s.name, s.codeName, ...s.events.flatMap(e => [e.text, ...e.options.flatMap(o => [o.text, o.result])])]),
    ...Object.values(TALENTS).flatMap(t => [t.name, t.desc]),
    ...LOCKED_ITEMS,
    ...codeLines(chart, code),
  ];
  const r = rng(3);
  for (let i = 0; i < 50; i++) {
    const { report } = play(input(1970 + i, 1 + (i % 12), 1 + (i % 28), i % 24, 30), n => Math.floor(r() * n));
    texts.push(report.title, report.archetype.desc, report.archetype.motto, report.archetype.suggestion, report.contrast.text, ...report.traits.map(t => t.evidence));
  }
  for (const t of texts) for (const w of BANNED) assert.ok(!t.includes(w), `「${t}」含有「${w}」`);
});
