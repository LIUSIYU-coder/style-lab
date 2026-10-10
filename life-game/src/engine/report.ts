// 选择画像报告。所有统计只基于这一局的 24 个选择和出生设定，不和其他玩家比较，不编造百分位。
// 只描述游戏中的选择倾向；建议只给低风险的小行动；不涉及吉凶、财运、婚恋、健康。
import type { Chart, Family } from './chart.ts';
import type { LifeCode } from './profile.ts';
import { agesLabel, AXES, AXIS_POLES, clockLabel, timeKind, type Axis, type Effects, type ResolvedBeat, type ResolvedOption } from './story.ts';

export interface Choice {
  hour: number;
  agesLabel: string;
  /** 这一幕对应的年龄范围,用来分出"回忆"和"设想" */
  ages: [number, number];
  eventId: string;
  optionText: string;
  effects: Effects;
  /** 这一幕没选的其他选项，用于"平行人生" */
  alternatives: Array<{ text: string; effects: Effects }>;
}

export interface Archetype {
  pole: string;
  name: string;
  motto: string;
  desc: string;
  role: string;
  strengths: [string, string];
  blindSpots: [string, string];
  suggestion: string;
  question: string;
}

/** 把剧情里的一次选择记成报告用的 Choice */
export function choiceOf(r: ResolvedBeat, opt: ResolvedOption): Choice {
  return {
    hour: r.beat.hour,
    agesLabel: agesLabel(r.beat),
    ages: r.beat.ages,
    eventId: r.beat.id,
    optionText: opt.text,
    effects: opt.effects,
    alternatives: r.options.filter(o => o !== opt).map(o => ({ text: o.text, effects: o.effects })),
  };
}

const A = (
  pole: string, name: string, motto: string, desc: string, role: string,
  strengths: [string, string], blindSpots: [string, string], suggestion: string, question: string,
): Archetype => ({ pole, name, motto, desc, role, strengths, blindSpots, suggestion, question });

export const ARCHETYPES: Record<string, Archetype> = {
  冒险: A('冒险', '破局者', '愿意为可能性付出代价', '在关键路口，你更常选那条看不清尽头的路。', '开路',
    ['敢在没把握的时候先迈出一步', '遇到变化反应快，不怕从头再来'],
    ['容易低估代价，来不及做准备', '新鲜感过去之后，可能不太想收尾'],
    '这周挑一件小事，出手前先写一个"最坏情况怎么办"的预案。', '最近一次"先跳下去再说"，结果怎么样？'),
  稳妥: A('稳妥', '筑城者', '先把地基打牢，再往上盖', '你习惯先确认脚下是实的，再迈下一步。', '打地基',
    ['做事有底，别人愿意把重要的事交给你', '很少因为一时冲动而后悔'],
    ['可能因为等"准备好"而错过时机', '面对变化，第一反应常常是防守'],
    '这周做一件小小的新鲜事：换一条路回家，或者点一道没吃过的菜。', '有没有一件事，你已经准备得足够好，只差开始？'),
  独立: A('独立', '独行者', '自己的路自己定', '重要的决定，你更愿意自己拿主意、自己扛。', '单点突破',
    ['能独自扛事，不依赖别人的认可', '判断不容易被人带偏'],
    ['习惯一个人扛，有时会错过别人的帮助', '不太说出自己的需要'],
    '这周找一个人，把手上的一件小事交给他，和他一起做完。', '上一次主动开口请人帮忙，是什么时候？'),
  联结: A('联结', '摆渡人', '在乎人，也被人在乎', '你做选择时，总会把身边的人放进考虑里。', '连接人',
    ['能感知别人的需要，让人愿意靠近', '擅长把人连在一起做成事'],
    ['容易把别人的事排在自己前面', '拒绝别人时会犹豫很久'],
    '这周留出一小时，只做一件只为自己的事，不用跟任何人商量。', '最近有没有一件只为自己做的事？'),
  远谋: A('远谋', '布局者', '看得远，也等得起', '你常常为以后的自己做准备，愿意先忍一忍。', '看远处',
    ['愿意为以后的自己投入时间', '有耐心，等得起慢慢来的回报'],
    ['可能为了以后，忽略了现在的感受', '计划被打乱时，会有些不安'],
    '这周给自己一个没有目的的下午，做什么都行，只要当下开心。', '今天有什么值得好好享受的小事？'),
  当下: A('当下', '逐光者', '活在此刻，享受过程', '你更看重眼前的体验，不太愿意为遥远的回报压抑自己。', '点亮气氛',
    ['享受过程，容易感到满足', '能带动身边人的情绪'],
    ['长线的目标容易被眼前的事打断', '回头看时，可能会希望早点开始准备'],
    '这周花十分钟，写下三个月后想看到的一个小变化。', '三个月后的你，希望现在的你多做哪一件事？'),
  行动: A('行动', '开拓者', '想到就做，边走边看', '比起想清楚，你更习惯先动起来。', '推进度',
    ['执行速度快，想到就能落地', '在实践中学得最快'],
    ['偶尔会因为动得太快而返工', '不太有耐心听完长篇解释'],
    '下一次想立刻动手的时候，先停五分钟，写下三种可能的做法。', '有没有一件事，你做完才发现其实可以换个做法？'),
  思考: A('思考', '观星者', '先看清，再出手', '你习惯把局面想透，再决定怎么走。', '想清楚',
    ['能把复杂的局面想明白', '很少在同一个地方摔两次'],
    ['想得太多时，会迟迟没有开始', '别人可能看不出你心里早有答案'],
    '这周挑一件想了很久的小事，定一个时间，到点就做第一步。', '你脑子里已经想好、却还没动手的事是什么？'),
  外放: A('外放', '燃灯者', '把情绪变成光', '你的感受会很快被身边的人看见，也常常感染别人。', '带动情绪',
    ['情绪真诚，容易让人亲近', '能把感受变成感染力'],
    ['情绪起伏大的时候，别人可能接不住', '有时会在冲动下说出还没想好的话'],
    '这周试一次：情绪上来时先写下来，第二天再决定要不要说。', '最近一次被情绪推着走，事后你怎么看？'),
  内收: A('内收', '守夜人', '心里有数，不必声张', '你习惯把感受收在心里，自己慢慢消化。', '稳住局面',
    ['情绪稳定，关键时刻靠得住', '能安静地消化很多事'],
    ['别人不容易知道你在想什么', '委屈可能在心里放得太久'],
    '这周试着把一件让你开心的小事，讲给一个信任的人听。', '有没有一句话，你很想说，却一直没说出口？'),
  破格: A('破格', '改写者', '规则可以被改进', '遇到不合理的事，你更愿意站出来改变它。', '提新方案',
    ['能看到规则背后的问题，敢提新做法', '不怕成为第一个'],
    ['有时会低估规则存在的理由', '和习惯照章办事的人合作时，容易有摩擦'],
    '这周找一条你常绕开的规则，弄清楚它当初为什么存在。', '你最想改的一条"规矩"是什么？'),
  守序: A('守序', '执衡者', '相信秩序的力量', '你尊重已有的规则，习惯在框架里把事做好。', '定规矩',
    ['做事可靠、有章法', '能把混乱的事情理顺'],
    ['遇到规则之外的情况，可能一时不知道怎么办', '对"不按常理出牌"的人会有些抵触'],
    '这周在一件小事上试试不按惯例来，看看会发生什么。', '有没有一条你一直遵守、却从没想过为什么的规矩？'),
};

export const BALANCED: Archetype = A('平衡', '调和者', '每条路都走过一点', '你的选择没有明显偏向哪一边，在不同处境下会换不同的打法。', '补位',
  ['能在不同处境下换不同的打法', '很少走极端'],
  ['别人有时看不清你的立场', '重要的选择上可能会犹豫'],
  '这周留意一下，自己在什么时候最想冒险，什么时候最想求稳。', '在什么情况下，你会最想站到某一边？');

export const LOCKED_ITEMS = [
  '你现在所在的这一页：按你的真实年龄，你正走到书里的哪一刻，那几年的章节背景是什么',
  '你最近在意的那件事：结合你的选择方式，给你的具体提醒',
  '六行底层代码逐行深读：哪一行是天生的，哪一行是你亲手改写的，在现实里意味着什么',
  '过去的你和想要的你：回忆里的选择，和你对未来的选择，哪几条线变了方向、各自从哪里开始',
  '做决定、和人相处、面对压力时的你，四柱逐柱与大运人生章节',
  '24 个选择逐条批注：没走的那条路会怎样；四周小实验',
  '"破晓时分的你"写来的一封信，附赠用你的选择写成的小说《你的这一天》',
];

/** 报告里"怎么算的"说明 */
export const METHOD_NOTES = [
  '六条维度只来自你这一局的 24 个选择：每个选项会给一到两条维度加分。',
  '百分比是你在这条维度上选向主导一侧的分数占比，只统计你自己这一局，不和其他玩家比较。',
  '"设定倾向"由五行占比和十神分布按固定规则换算，是游戏设定，不是命理断语。',
  '排盘和这份报告都在你的浏览器里计算。兑换深度解析时，出生参数和选择会发给服务器生成内容，服务器不保存。',
];

export function poleOf(axis: Axis, score: number): string {
  return AXIS_POLES[axis][score >= 0 ? 0 : 1];
}

/* ---------------- 设定倾向:出生设定在六条轴上的"默认值" ---------------- */

export interface Lean {
  axis: Axis;
  sign: 1 | -1 | 0;
  reason: string;
}

function familyShare(chart: Chart): Record<Family, number> {
  const total = Object.values(chart.families).reduce((s, v) => s + v, 0) || 1;
  return Object.fromEntries(Object.entries(chart.families).map(([k, v]) => [k, (v / total) * 100])) as Record<Family, number>;
}

/**
 * 映射规则（游戏设定，不是命理断语）:
 * 冒险 ← 木火多于土金；独立 ← 比劫多；远谋 ← 印星多；行动 ← 财星多于印星；外放 ← 火多于水；破格 ← 食伤多于官杀。
 */
export function settingLeans(chart: Chart): Lean[] {
  const e = chart.elements;
  const f = familyShare(chart);
  const lean = (axis: Axis, value: number, threshold: number, plus: string, minus: string): Lean => {
    const sign = value >= threshold ? 1 : value <= -threshold ? -1 : 0;
    return { axis, sign, reason: sign === 1 ? plus : sign === -1 ? minus : '两边差不多' };
  };
  return [
    lean('risk', e.木 + e.火 - (e.土 + e.金), 12, '木火占比高', '土金占比高'),
    lean('self', f.比劫 - 20, 8, '比劫多', '比劫少'),
    lean('time', f.印星 - 20, 8, '印星多', '印星少'),
    lean('act', f.财星 - f.印星, 10, '财星多于印星', '印星多于财星'),
    lean('emo', e.火 - e.水, 10, '火多于水', '水多于火'),
    lean('rule', f.食伤 - f.官杀, 10, '食伤多于官杀', '官杀多于食伤'),
  ];
}

/* ---------------- 报告结构 ---------------- */

export interface AxisLine {
  axis: Axis;
  score: number;
  pole: string;
  /** 本局在这条轴上，选向主导一侧的分数占比 */
  pct: number;
  strength: '鲜明' | '偏向' | '平衡';
}

export interface Moment {
  hour: number;
  clock: string;
  agesLabel: string;
  optionText: string;
}

export interface Rewrite {
  axis: Axis;
  setting: string;
  reason: string;
  choice: string;
  verdict: '顺写' | '改写' | '自由';
}

export interface Report {
  scores: Record<Axis, number>;
  axes: AxisLine[];
  archetype: Archetype;
  partner: { same: Archetype | null; complement: Archetype; text: string };
  title: string;
  mainAxis: Axis;
  mainPole: string;
  traits: Array<{ axis: Axis; pole: string; score: number; evidence: string }>;
  timeline: Array<{ hour: number; agesLabel: string; main: boolean; optionText: string }>;
  moments: Moment[];
  rewrites: Rewrite[];
  rewriteCount: number;
  halves: { morning: string; night: string; turn: Moment | null; text: string };
  consistency: { pct: number; label: string };
  parallel: { moment: Moment; alternative: string; text: string } | null;
  contrast: { aligned: boolean | null; text: string };
  /** 过去和此刻的选择 vs 对还没发生的那几页的选择;玩家年龄太小或太大、某一边不足 4 页时为 null */
  timeSplit: TimeSplit | null;
}

export interface TimeSplit {
  age: number;
  /** 回忆和此刻的页数 / 设想的页数 */
  pastCount: number;
  futureCount: number;
  /** 两边方向不同的维度,按差异从大到小 */
  shifts: Array<{ axis: Axis; pastPole: string; futurePole: string }>;
  /** 两边方向一致的维度 */
  same: Array<{ axis: Axis; pole: string }>;
  text: string;
}

/**
 * 回忆里选的是"当时的你",设想里选的是"想成为的你"。
 * 把两边分开统计:哪几条维度,想要的和过去的不一样?这是游戏里最贴近现实的发现,但只是选择倾向,不是预测。
 */
export function splitByTime(choices: Choice[], age: number): TimeSplit | null {
  const past = choices.filter(c => timeKind(c.ages, age) !== 'future');
  const future = choices.filter(c => timeKind(c.ages, age) === 'future');
  if (past.length < 4 || future.length < 4) return null;
  const ps = sumScores(past);
  const fs = sumScores(future);
  const shifts: TimeSplit['shifts'] = [];
  const same: TimeSplit['same'] = [];
  const ranked = [...AXES].sort((a, b) => Math.abs(ps[b] - fs[b]) - Math.abs(ps[a] - fs[a]));
  for (const axis of ranked) {
    if (ps[axis] === 0 || fs[axis] === 0) continue;
    if (Math.sign(ps[axis]) !== Math.sign(fs[axis])) shifts.push({ axis, pastPole: poleOf(axis, ps[axis]), futurePole: poleOf(axis, fs[axis]) });
    else same.push({ axis, pole: poleOf(axis, ps[axis]) });
  }
  const text = shifts.length
    ? `回想过去，你更多是「${shifts[0].pastPole}」的人；可是面对还没发生的那几页，你选的是「${shifts[0].futurePole}」。你想成为的样子，和过去的自己有不一样的地方。`
    : same.length
      ? `过去的你和想要的你，在「${same[0].pole}」这条线上方向一致：你想继续做的，正是你一直在做的那种人。`
      : '过去和想要的未来，你的选择都比较均衡，没有哪一边特别突出。';
  return { age, pastCount: past.length, futureCount: future.length, shifts, same, text };
}

/** 天赋模块在选择维度上的"默认倾向",用来对比设定和选择。 */
const TALENT_LEAN: Record<Family, { axis: Axis; sign: 1 | -1 }> = {
  比劫: { axis: 'self', sign: 1 },
  食伤: { axis: 'emo', sign: 1 },
  财星: { axis: 'act', sign: 1 },
  官杀: { axis: 'rule', sign: -1 },
  印星: { axis: 'act', sign: -1 },
};

function sumScores(choices: Choice[]): Record<Axis, number> {
  const scores = Object.fromEntries(AXES.map(a => [a, 0])) as Record<Axis, number>;
  for (const c of choices) for (const a of AXES) scores[a] += c.effects[a] ?? 0;
  return scores;
}

function rankAxes(scores: Record<Axis, number>): Axis[] {
  return [...AXES].sort((a, b) => Math.abs(scores[b]) - Math.abs(scores[a]));
}

const moment = (c: Choice): Moment => ({ hour: c.hour, clock: clockLabel(c.hour), agesLabel: c.agesLabel, optionText: c.optionText });

export function buildReport(chart: Chart, code: LifeCode, choices: Choice[], age?: number): Report {
  const scores = sumScores(choices);
  const ranked = rankAxes(scores);
  const mainAxis = ranked[0];
  const mainSign = Math.sign(scores[mainAxis]);
  const archetype = mainSign === 0 ? BALANCED : ARCHETYPES[poleOf(mainAxis, scores[mainAxis])];
  const mainPole = mainSign === 0 ? '平衡' : poleOf(mainAxis, scores[mainAxis]);
  const supports = (c: Choice, axis: Axis, sign: number) => sign !== 0 && Math.sign(c.effects[axis] ?? 0) === sign;

  const axes: AxisLine[] = AXES.map(axis => {
    let pos = 0;
    let neg = 0;
    for (const c of choices) {
      const v = c.effects[axis] ?? 0;
      if (v > 0) pos += v;
      else neg -= v;
    }
    const s = scores[axis];
    const pct = pos + neg === 0 ? 50 : Math.round((Math.max(pos, neg) / (pos + neg)) * 100);
    const strength = Math.abs(s) >= 5 ? '鲜明' : Math.abs(s) >= 2 ? '偏向' : '平衡';
    return { axis, score: s, pole: s === 0 ? '平衡' : poleOf(axis, s), pct, strength };
  });

  // 每个突出特征引用一个体现它的选择，尽量不重复
  const used = new Set<Choice>();
  const traits = ranked
    .filter(a => scores[a] !== 0)
    .slice(0, 3)
    .map(axis => {
      const sign = Math.sign(scores[axis]);
      const matches = choices.filter(c => supports(c, axis, sign));
      const hit = matches.find(c => !used.has(c)) ?? matches[0];
      if (hit) used.add(hit);
      return {
        axis,
        pole: poleOf(axis, scores[axis]),
        score: scores[axis],
        evidence: hit ? `${clockLabel(hit.hour)} · ${hit.agesLabel}，你选择了「${hit.optionText}」。` : '',
      };
    });

  // 名场面:最能体现主轴的三个选择，按时间顺序
  const moments = choices
    .filter(c => supports(c, mainAxis, mainSign))
    .sort((a, b) => Math.abs(b.effects[mainAxis] ?? 0) - Math.abs(a.effects[mainAxis] ?? 0))
    .slice(0, 3)
    .sort((a, b) => choices.indexOf(a) - choices.indexOf(b))
    .map(moment);

  const timeline = choices.map(c => ({ hour: c.hour, agesLabel: c.agesLabel, main: supports(c, mainAxis, mainSign), optionText: c.optionText }));

  // 设定 vs 选择:逐轴比较
  const rewrites: Rewrite[] = settingLeans(chart).map(l => {
    const s = scores[l.axis];
    const setting = l.sign === 0 ? '中立' : AXIS_POLES[l.axis][l.sign === 1 ? 0 : 1];
    const choice = s === 0 ? '平衡' : poleOf(l.axis, s);
    const verdict = l.sign === 0 || s === 0 ? '自由' : Math.sign(s) === l.sign ? '顺写' : '改写';
    return { axis: l.axis, setting, reason: l.reason, choice, verdict };
  });
  const rewriteCount = rewrites.filter(r => r.verdict === '改写').length;

  // 前半天 vs 后半天
  const half = Math.ceil(choices.length / 2);
  const am = sumScores(choices.slice(0, half));
  const pm = sumScores(choices.slice(half));
  const amAxis = rankAxes(am)[0];
  const pmAxis = rankAxes(pm)[0];
  const morning = am[amAxis] === 0 ? '平衡' : poleOf(amAxis, am[amAxis]);
  const night = pm[pmAxis] === 0 ? '平衡' : poleOf(pmAxis, pm[pmAxis]);
  const turnChoice = morning !== night ? choices.slice(half).find(c => supports(c, pmAxis, Math.sign(pm[pmAxis]))) : undefined;
  const turn = turnChoice ? moment(turnChoice) : null;
  const halvesText =
    morning === night
      ? `从清晨到深夜，你一直在选「${morning}」。这条主线贯穿了你的一整天。`
      : `上半天你更多选择「${morning}」，下半天转向了「${night}」。` + (turn ? `转折出现在 ${turn.clock}（${turn.agesLabel}）。` : '');

  // 一致性:同一条轴上选择方向有多稳定
  let net = 0;
  let gross = 0;
  for (const a of AXES) {
    let sum = 0;
    for (const c of choices) {
      const v = c.effects[a] ?? 0;
      sum += v;
      gross += Math.abs(v);
    }
    net += Math.abs(sum);
  }
  const pct = gross ? Math.round((net / gross) * 100) : 0;
  const consistency = { pct, label: pct >= 60 ? '方向很稳定' : pct >= 35 ? '有主线，也有例外' : '每次都看情况' };

  // 同频与互补
  const secondAxis = ranked[1];
  const same = scores[secondAxis] === 0 ? null : ARCHETYPES[poleOf(secondAxis, scores[secondAxis])];
  const complement = mainSign === 0 ? ARCHETYPES['冒险'] : ARCHETYPES[poleOf(mainAxis, -scores[mainAxis])];

  // 平行人生:一个"如果当时选了另一边"的节点
  let parallel: Report['parallel'] = null;
  for (const c of choices) {
    if (!supports(c, mainAxis, mainSign)) continue;
    const alt = c.alternatives.find(o => supports({ ...c, effects: o.effects }, mainAxis, -mainSign));
    if (alt) {
      const m = moment(c);
      const otherPole = AXIS_POLES[mainAxis][mainSign === 1 ? 1 : 0];
      parallel = { moment: m, alternative: alt.text, text: `如果 ${m.clock}（${m.agesLabel}）你选了「${alt.text}」，这一天会往「${otherPole}」偏一点。` };
      break;
    }
  }

  return {
    scores,
    axes,
    archetype,
    partner: { same, complement, text: `和「${complement.name}」搭档时，你负责${archetype.role}，TA 负责${complement.role}。` },
    title: `${code.kernel} · ${archetype.name}`,
    mainAxis,
    mainPole,
    traits,
    timeline,
    moments,
    rewrites,
    rewriteCount,
    halves: { morning, night, turn, text: halvesText },
    consistency,
    parallel,
    contrast: contrastFor(code, scores),
    timeSplit: age === undefined ? null : splitByTime(choices, age),
  };
}

function contrastFor(code: LifeCode, scores: Record<Axis, number>): Report['contrast'] {
  const lean = TALENT_LEAN[code.talent.family];
  const expected = AXIS_POLES[lean.axis][lean.sign === 1 ? 0 : 1];
  const other = AXIS_POLES[lean.axis][lean.sign === 1 ? 1 : 0];
  const s = scores[lean.axis] * lean.sign;
  if (s > 0) return { aligned: true, text: `底层代码里的「${code.talent.name}」偏向「${expected}」，你在游戏里也一次次选择了「${expected}」。` };
  if (s < 0) return { aligned: false, text: `底层代码里的「${code.talent.name}」偏向「${expected}」，但你在游戏里更多选择了「${other}」。` };
  return { aligned: null, text: `底层代码里的「${code.talent.name}」偏向「${expected}」，而你在「${expected}」和「${other}」之间保持了平衡。` };
}
