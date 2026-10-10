// 排盘:四柱、藏干、十神、五行分布、大运。排盘计算交给 lunar-typescript(MIT)。
import { Solar } from 'lunar-typescript';
import { correctBirthTime, type Correction, type WallTime } from './solar-time.ts';

export type Element = '木' | '火' | '土' | '金' | '水';
export const ELEMENTS: readonly Element[] = ['木', '火', '土', '金', '水'];

export type Gender = 'male' | 'female';

/** 十神按功能归为五类,对应游戏里的"天赋模块"。 */
export type Family = '比劫' | '食伤' | '财星' | '官杀' | '印星';
export const FAMILIES: readonly Family[] = ['比劫', '食伤', '财星', '官杀', '印星'];

const STEM_ELEMENT: Record<string, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_ELEMENT: Record<string, Element> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const ZODIAC: Record<string, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇', 午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};
const FAMILY_OF: Record<string, Family> = {
  比肩: '比劫', 劫财: '比劫', 食神: '食伤', 伤官: '食伤', 正财: '财星', 偏财: '财星',
  正官: '官杀', 七杀: '官杀', 正印: '印星', 偏印: '印星',
};

/** 相生:木→火→土→金→水→木 */
export function generates(e: Element): Element {
  return ELEMENTS[(ELEMENTS.indexOf(e) + 1) % 5];
}
/** 生我者 */
export function generatedBy(e: Element): Element {
  return ELEMENTS[(ELEMENTS.indexOf(e) + 4) % 5];
}
/** 相克:木克土、土克水、水克火、火克金、金克木 */
export function controls(e: Element): Element {
  return ELEMENTS[(ELEMENTS.indexOf(e) + 2) % 5];
}

export function stemElement(gan: string): Element {
  const e = STEM_ELEMENT[gan];
  if (!e) throw new Error(`未知天干:${gan}`);
  return e;
}
export function branchElement(zhi: string): Element {
  const e = BRANCH_ELEMENT[zhi];
  if (!e) throw new Error(`未知地支:${zhi}`);
  return e;
}

export interface Pillar {
  label: '年柱' | '月柱' | '日柱' | '时柱';
  gan: string;
  zhi: string;
  ganElement: Element;
  zhiElement: Element;
  /** 天干十神;日柱为"日主" */
  ganShiShen: string;
  hideGan: string[];
  hideShiShen: string[];
  naYin: string;
}

export interface DaYunStep {
  ganZhi: string;
  startAge: number;
  endAge: number;
  startYear: number;
}

export interface Chart {
  input: WallTime;
  gender: Gender;
  correction: Correction;
  pillars: [Pillar, Pillar, Pillar, Pillar];
  dayMaster: { gan: string; element: Element; yang: boolean };
  /** 五行占比,合计 100 */
  elements: Record<Element, number>;
  /** 日主与生扶日主的五行合计占比 */
  support: number;
  strong: boolean;
  families: Record<Family, number>;
  dominantFamily: Family;
  weakestElement: Element;
  zodiac: string;
  lunarText: string;
  startYunText: string;
  daYun: DaYunStep[];
}

// 藏干按本气、中气、余气分权重
const HIDE_WEIGHTS: Record<number, number[]> = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
// 月令对五行分布影响最大
const BRANCH_FACTOR = [1, 1.5, 1, 1];

export interface BirthInput {
  /** 北京时间(UTC+8)的钟表时间 */
  time: WallTime;
  gender: Gender;
  /** 出生地经度;null 表示不做真太阳时校正 */
  longitude: number | null;
  /** 玩家说不清具体时间(这时 time 里的钟点是按中午补的,不能当成真实出生时段) */
  unknownTime?: boolean;
}

export function computeChart(input: BirthInput): Chart {
  const correction = correctBirthTime(input.time, input.longitude);
  const t = correction.time;
  const lunar = Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0).getLunar();
  const ec = lunar.getEightChar();
  // 晚子时(23:00–24:00)日柱算次日,与 tyme4ts 默认一致;默认的 sect 2 在这一时段日柱、时柱不自洽。
  ec.setSect(1);

  const raw = [
    { label: '年柱', gz: ec.getYear(), ss: ec.getYearShiShenGan(), hide: ec.getYearHideGan(), hideSs: ec.getYearShiShenZhi(), ny: ec.getYearNaYin() },
    { label: '月柱', gz: ec.getMonth(), ss: ec.getMonthShiShenGan(), hide: ec.getMonthHideGan(), hideSs: ec.getMonthShiShenZhi(), ny: ec.getMonthNaYin() },
    { label: '日柱', gz: ec.getDay(), ss: '日主', hide: ec.getDayHideGan(), hideSs: ec.getDayShiShenZhi(), ny: ec.getDayNaYin() },
    { label: '时柱', gz: ec.getTime(), ss: ec.getTimeShiShenGan(), hide: ec.getTimeHideGan(), hideSs: ec.getTimeShiShenZhi(), ny: ec.getTimeNaYin() },
  ] as const;

  const pillars = raw.map(p => {
    const gan = p.gz[0];
    const zhi = p.gz[1];
    return {
      label: p.label,
      gan,
      zhi,
      ganElement: stemElement(gan),
      zhiElement: branchElement(zhi),
      ganShiShen: p.ss,
      hideGan: [...p.hide],
      hideShiShen: [...p.hideSs],
      naYin: p.ny,
    } satisfies Pillar;
  }) as Chart['pillars'];

  const dayGan = pillars[2].gan;
  const dmElement = stemElement(dayGan);

  const elementScore: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const familyScore: Record<Family, number> = { 比劫: 0, 食伤: 0, 财星: 0, 官杀: 0, 印星: 0 };
  pillars.forEach((p, i) => {
    elementScore[p.ganElement] += 1;
    const fam = FAMILY_OF[p.ganShiShen];
    if (fam) familyScore[fam] += 1;
    const w = HIDE_WEIGHTS[p.hideGan.length] ?? [];
    p.hideGan.forEach((g, j) => {
      elementScore[stemElement(g)] += (w[j] ?? 0) * BRANCH_FACTOR[i];
      const hf = FAMILY_OF[p.hideShiShen[j]];
      if (hf) familyScore[hf] += w[j] ?? 0;
    });
  });

  const total = ELEMENTS.reduce((s, e) => s + elementScore[e], 0);
  const elements = toPercentages(elementScore, total);
  const support = elements[dmElement] + elements[generatedBy(dmElement)];

  const dominantFamily = FAMILIES.reduce((best, f) => (familyScore[f] > familyScore[best] ? f : best), FAMILIES[0]);
  const weakestElement = ELEMENTS.reduce((min, e) => (elements[e] < elements[min] ? e : min), ELEMENTS[0]);

  const yun = ec.getYun(input.gender === 'male' ? 1 : 0);
  const daYun = yun
    .getDaYun(9)
    .slice(1)
    .map(d => ({ ganZhi: d.getGanZhi(), startAge: d.getStartAge(), endAge: d.getEndAge(), startYear: d.getStartYear() }));

  return {
    input: input.time,
    gender: input.gender,
    correction,
    pillars,
    dayMaster: { gan: dayGan, element: dmElement, yang: '甲丙戊庚壬'.includes(dayGan) },
    elements,
    support,
    strong: support >= 40,
    families: familyScore,
    dominantFamily,
    weakestElement,
    zodiac: ZODIAC[pillars[0].zhi],
    lunarText: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    startYunText: `${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天后起运`,
    daYun,
  };
}

/** 四舍五入后合计仍为 100(最大余数法)。 */
function toPercentages(score: Record<Element, number>, total: number): Record<Element, number> {
  const exact = ELEMENTS.map(e => ({ e, v: (score[e] / total) * 100 }));
  const out = Object.fromEntries(exact.map(x => [x.e, Math.floor(x.v)])) as Record<Element, number>;
  let rest = 100 - ELEMENTS.reduce((s, e) => s + out[e], 0);
  [...exact].sort((a, b) => (b.v % 1) - (a.v % 1)).forEach(x => {
    if (rest > 0) {
      out[x.e] += 1;
      rest -= 1;
    }
  });
  return out;
}
