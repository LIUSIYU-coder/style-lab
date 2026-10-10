// 生成《人生说明书》样张(节选),放进网页给买家预览。
// 用法:node scripts/make-sample.ts   → 写入 src/sample-deep.json
// 样张用固定的示例读者和固定的选择,内容由真实的生成器产出,再截取几段,不会泄露完整报告。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeChart } from '../src/engine/chart.ts';
import { buildLifeCode } from '../src/engine/profile.ts';
import { initialFlags, replayStory, resolveBeat, storyContext, TOTAL_CHOICES } from '../src/engine/story.ts';
import { buildReport, choiceOf } from '../src/engine/report.ts';
import { buildDeepReport } from '../src/engine/deep.ts';
import { whoOf, type Reader } from '../src/engine/reader.ts';

const input = { time: { year: 1998, month: 8, day: 16, hour: 9, minute: 30 }, gender: 'female' as const, longitude: 104.06 };
const reader: Reader = { name: '小满', carer: '奶奶', nick: '丫丫', friend: '小可', concern: 'work', lines: { carer: '这些年，谢谢你。', dawn: '慢慢来，别怕。' } };
const age = 28;

const chart = computeChart(input);
const code = buildLifeCode(chart);
const ctx = storyContext(code.seed, '成都市', whoOf(reader));
const flags = initialFlags(ctx);
// 固定的"选择方式":回忆页偏稳妥一点的选项,设想页偏敢闯的选项,这样样张里能看到"过去和想要的不一样"。
// 具体编号由 SAMPLE_RULE 决定,换规则后重新运行即可。
const SAMPLE_RULE: (step: number, n: number) => number = (step, n) => (step < 12 ? (step * 2) % n : (step * 3 + 1) % n);
const picks: string[] = [];
for (let i = 0; i < TOTAL_CHOICES; i++) {
  const r = resolveBeat(i, ctx, flags);
  const opt = r.options[SAMPLE_RULE(i, r.options.length)];
  opt.set.forEach(f => flags.add(f));
  picks.push(opt.key);
}
const { steps } = replayStory(ctx, picks);
const report = buildReport(chart, code, steps.map(s => choiceOf(s.resolved, s.option)), age);
const full = buildDeepReport({ chart, code, ctx, picks, report, reader, age });

// 节选:每一部分只留开头几条,让买家看到"写得多具体"而不是全部
const sample = {
  ...full,
  title: `${reader.name}的人生说明书（样张）`,
  novel: full.novel.slice(0, 1).map(c => ({ ...c, paragraphs: c.paragraphs.slice(0, 3) })),
  epilogue: full.epilogue.slice(0, 1),
  pillars: full.pillars.slice(2, 3),
  daYun: full.daYun.slice(2, 4),
  notes: [full.notes[0], full.notes[12], full.notes[20]],
  patterns: full.patterns.slice(0, 2),
  weeks: full.weeks.slice(0, 1),
  rewrites: full.rewrites.slice(0, 3),
  shift: full.shift ? { ...full.shift, rows: full.shift.rows.slice(0, 3) } : null,
};
writeFileSync(join(import.meta.dirname, '..', 'src', 'sample-deep.json'), JSON.stringify(sample, null, 1) + '\n');
console.log('样张已生成:', sample.title, `(${JSON.stringify(sample).length} 字符)`);
