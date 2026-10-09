// 选择画像:根据玩家在游戏里的选择生成总结。只描述游戏中的选择倾向,建议只给低风险的小行动。
import type { Family } from './chart.ts';
import type { LifeCode } from './profile.ts';
import { AXES, AXIS_POLES, type Axis, type Effects } from './story.ts';

export interface Choice {
  stageName: string;
  ages: [number, number];
  eventId: string;
  optionText: string;
  effects: Effects;
}

export interface Archetype {
  pole: string;
  name: string;
  motto: string;
  desc: string;
  suggestion: string;
}

const ARCHETYPES: Record<string, Archetype> = {
  冒险: { pole: '冒险', name: '破局者', motto: '愿意为可能性付出代价', desc: '在关键路口,你更常选那条看不清尽头的路。', suggestion: '这周挑一件小事,出手前先写一个"最坏情况怎么办"的预案。' },
  稳妥: { pole: '稳妥', name: '筑城者', motto: '先把地基打牢,再往上盖', desc: '你习惯先确认脚下是实的,再迈下一步。', suggestion: '这周做一件小小的新鲜事:换一条路回家,或者点一道没吃过的菜。' },
  独立: { pole: '独立', name: '独行者', motto: '自己的路自己定', desc: '重要的决定,你更愿意自己拿主意、自己扛。', suggestion: '这周找一个人,把手上的一件小事交给他,和他一起做完。' },
  联结: { pole: '联结', name: '摆渡人', motto: '在乎人,也被人在乎', desc: '你做选择时,总会把身边的人放进考虑里。', suggestion: '这周留出一小时,只做一件只为自己的事,不用跟任何人商量。' },
  远谋: { pole: '远谋', name: '布局者', motto: '看得远,也等得起', desc: '你常常为以后的自己做准备,愿意先忍一忍。', suggestion: '这周给自己一个没有目的的下午,做什么都行,只要当下开心。' },
  当下: { pole: '当下', name: '逐光者', motto: '活在此刻,享受过程', desc: '你更看重眼前的体验,不太愿意为遥远的回报压抑自己。', suggestion: '这周花十分钟,写下三个月后想看到的一个小变化。' },
  行动: { pole: '行动', name: '开拓者', motto: '想到就做,边走边看', desc: '比起想清楚,你更习惯先动起来。', suggestion: '下一次想立刻动手的时候,先停五分钟,写下三种可能的做法。' },
  思考: { pole: '思考', name: '观星者', motto: '先看清,再出手', desc: '你习惯把局面想透,再决定怎么走。', suggestion: '这周挑一件想了很久的小事,定一个时间,到点就做第一步。' },
  外放: { pole: '外放', name: '燃灯者', motto: '把情绪变成光', desc: '你的感受会很快被身边的人看见,也常常感染别人。', suggestion: '这周试一次:情绪上来时先写下来,第二天再决定要不要说。' },
  内收: { pole: '内收', name: '守夜人', motto: '心里有数,不必声张', desc: '你习惯把感受收在心里,自己慢慢消化。', suggestion: '这周试着把一件让你开心的小事,讲给一个信任的人听。' },
  破格: { pole: '破格', name: '改写者', motto: '规则可以被改进', desc: '遇到不合理的事,你更愿意站出来改变它。', suggestion: '这周找一条你常绕开的规则,弄清楚它当初为什么存在。' },
  守序: { pole: '守序', name: '执衡者', motto: '相信秩序的力量', desc: '你尊重已有的规则,习惯在框架里把事做好。', suggestion: '这周在一件小事上试试不按惯例来,看看会发生什么。' },
};

const BALANCED: Archetype = {
  pole: '平衡',
  name: '调和者',
  motto: '每条路都走过一点',
  desc: '你的选择没有明显偏向哪一边,在不同处境下会换不同的打法。',
  suggestion: '这周留意一下,自己在什么时候最想冒险,什么时候最想求稳。',
};

/** 天赋模块在选择维度上的"默认倾向",用来对比设定和选择。 */
const TALENT_LEAN: Record<Family, { axis: Axis; sign: 1 | -1 }> = {
  比劫: { axis: 'self', sign: 1 },
  食伤: { axis: 'emo', sign: 1 },
  财星: { axis: 'act', sign: 1 },
  官杀: { axis: 'rule', sign: -1 },
  印星: { axis: 'act', sign: -1 },
};

export const LOCKED_ITEMS = [
  '十个选择逐条回看:每一步和你的底层代码有什么关系',
  '六个维度的完整解读',
  '设定与选择之间的每一处冲突',
  '为你挑选的 30 天小实验清单',
  '无水印分享长图',
];

export interface Trait {
  axis: Axis;
  pole: string;
  score: number;
  evidence: string;
}

export interface Report {
  scores: Record<Axis, number>;
  archetype: Archetype;
  title: string;
  traits: Trait[];
  contrast: { aligned: boolean | null; text: string };
}

export function poleOf(axis: Axis, score: number): string {
  return AXIS_POLES[axis][score >= 0 ? 0 : 1];
}

export function buildReport(code: LifeCode, choices: Choice[]): Report {
  const scores = Object.fromEntries(AXES.map(a => [a, 0])) as Record<Axis, number>;
  for (const c of choices) for (const a of AXES) scores[a] += c.effects[a] ?? 0;

  const ranked = [...AXES].sort((a, b) => Math.abs(scores[b]) - Math.abs(scores[a]));
  const top = ranked[0];
  const archetype = scores[top] === 0 ? BALANCED : ARCHETYPES[poleOf(top, scores[top])];

  const used = new Set<Choice>();
  const traits = ranked
    .filter(a => scores[a] !== 0)
    .slice(0, 3)
    .map(axis => ({ axis, pole: poleOf(axis, scores[axis]), score: scores[axis], evidence: evidenceFor(axis, scores[axis], choices, used) }));

  return {
    scores,
    archetype,
    title: `${code.kernel} · ${archetype.name}`,
    traits,
    contrast: contrastFor(code, scores),
  };
}

/** 找一个体现该倾向的选择作为证据;尽量不和前面的特征重复引用同一个选择。 */
function evidenceFor(axis: Axis, score: number, choices: Choice[], used: Set<Choice>): string {
  const sign = Math.sign(score);
  const matches = choices.filter(c => Math.sign(c.effects[axis] ?? 0) === sign);
  const hit = matches.find(c => !used.has(c)) ?? matches[0];
  if (!hit) return '';
  used.add(hit);
  return `${hit.ages[0]}–${hit.ages[1]} 岁,你选择了「${hit.optionText}」。`;
}

function contrastFor(code: LifeCode, scores: Record<Axis, number>): Report['contrast'] {
  const lean = TALENT_LEAN[code.talent.family];
  const expected = AXIS_POLES[lean.axis][lean.sign === 1 ? 0 : 1];
  const other = AXIS_POLES[lean.axis][lean.sign === 1 ? 1 : 0];
  const s = scores[lean.axis] * lean.sign;
  if (s > 0) {
    return { aligned: true, text: `底层代码里的「${code.talent.name}」偏向「${expected}」,你在游戏里也一次次选择了「${expected}」。设定和选择是同一个方向。` };
  }
  if (s < 0) {
    return { aligned: false, text: `底层代码里的「${code.talent.name}」偏向「${expected}」,但你在游戏里更多选择了「${other}」。设定和选择走向了不同的方向,这是这局游戏里最值得回看的地方。` };
  }
  return { aligned: null, text: `底层代码里的「${code.talent.name}」偏向「${expected}」,而你在「${expected}」和「${other}」之间保持了平衡。` };
}
