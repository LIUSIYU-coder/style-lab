import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, type BirthInput } from './chart.ts';
import { buildLifeCode } from './profile.ts';
import { agesLabel, resolveBeat, storyContext, TOTAL_CHOICES } from './story.ts';
import { buildReport, type Choice } from './report.ts';
import { buildDeepReport, DEEP_TEXTS, missingProse, type DeepReport } from './deep.ts';
import { BANNED } from './banned.ts';
import { rng } from './rng.ts';

function run(inp: BirthInput, rand: () => number, place: string | null) {
  const chart = computeChart(inp);
  const code = buildLifeCode(chart);
  const ctx = storyContext(code.seed, place);
  const flags = new Set<string>();
  const picks: string[] = [];
  const choices: Choice[] = [];
  for (let i = 0; i < TOTAL_CHOICES; i++) {
    const r = resolveBeat(i, ctx, flags);
    const k = Math.floor(rand() * r.options.length);
    const opt = r.options[k];
    opt.set.forEach(f => flags.add(f));
    picks.push(opt.key);
    choices.push({
      hour: r.beat.hour, agesLabel: agesLabel(r.beat), eventId: r.beat.id, optionText: opt.text, effects: opt.effects,
      alternatives: r.options.filter((_, j) => j !== k).map(x => ({ text: x.text, effects: x.effects })),
    });
  }
  const report = buildReport(chart, code, choices);
  return { chart, code, ctx, picks, report };
}

function allText(d: DeepReport): string[] {
  return [
    d.title, d.summary, ...d.novel.flatMap(c => [c.title, c.subtitle, ...c.paragraphs]), ...d.epilogue,
    ...d.pillars.flatMap(p => [p.label, p.ganZhi, p.name, p.naYin, ...p.text]),
    ...d.daYun.flatMap(y => [y.ganZhi, y.ages, y.theme, y.text, y.inGame ?? '']),
    ...d.notes.flatMap(n => [n.picked, n.note, ...n.tags, ...n.others.flatMap(o => [o.text, o.result])]),
    ...d.patterns.flatMap(p => [p.title, p.text, p.evidence ?? '']), d.combo.name, d.combo.text,
    ...d.weeks.flatMap(w => [w.title, w.why, ...w.steps]), ...d.letter,
  ];
}

test('每个选项都写了小说旁白', () => {
  assert.deepEqual(missingProse(), []);
});

test('深度解析结构完整、无占位符、无红线词', () => {
  const r = rng(11);
  for (const t of DEEP_TEXTS) for (const w of BANNED) assert.ok(!t.includes(w), `「${t}」含有「${w}」`);
  for (let i = 0; i < 400; i++) {
    const inp: BirthInput = {
      time: { year: 1950 + (i % 70), month: 1 + (i % 12), day: 1 + (i % 28), hour: i % 24, minute: (i * 7) % 60 },
      gender: i % 2 ? 'male' : 'female', longitude: i % 3 ? 104 + (i % 20) : null,
    };
    const g = run(inp, r, i % 2 ? '成都市' : null);
    const d = buildDeepReport({ ...g });
    assert.equal(d.novel.length, 5);
    assert.equal(d.novel.reduce((n, c) => n + c.paragraphs.length, 0), 24 + 10);
    assert.equal(d.notes.length, 24);
    assert.equal(d.pillars.length, 4);
    assert.equal(d.weeks.length, 4);
    assert.ok(d.daYun.length > 0);
    const words = allText(d).join('').length;
    assert.ok(words > 6000, `只有 ${words} 字`);
    for (const t of allText(d)) {
      assert.ok(!/[{}]|undefined|NaN/.test(t), `「${t}」有未替换的内容`);
      for (const w of BANNED) assert.ok(!t.includes(w), `「${t}」含有「${w}」`);
    }
  }
});

test('选择不完整或编号无效时拒绝生成', () => {
  const g = run({ time: { year: 1999, month: 9, day: 9, hour: 9, minute: 9 }, gender: 'female', longitude: null }, rng(1), null);
  assert.throws(() => buildDeepReport({ ...g, picks: g.picks.slice(0, 23) }));
  assert.throws(() => buildDeepReport({ ...g, picks: [...g.picks.slice(0, 23), 'z'] }));
});
