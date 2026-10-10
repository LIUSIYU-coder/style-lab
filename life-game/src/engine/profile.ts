// "人生底层代码":把排盘结果翻译成游戏里的角色设定。
// 文案只描述游戏角色的设定，不对现实中的人做任何预测。
import { ELEMENTS, type Chart, type Element, type Family } from './chart.ts';
import { hashString } from './rng.ts';

export const ELEMENT_STAT: Record<Element, string> = {
  木: '成长',
  火: '热情',
  土: '稳定',
  金: '决断',
  水: '洞察',
};

export const KERNELS: Record<string, { title: string; image: string; desc: string }> = {
  甲: { title: '主干型', image: '参天大树', desc: '向上长，有主见，认准方向就不太回头。' },
  乙: { title: '藤蔓型', image: '花草藤蔓', desc: '柔韧，会借力，在缝隙里也能找到路。' },
  丙: { title: '恒星型', image: '正午太阳', desc: '热烈直接，习惯照亮周围的人。' },
  丁: { title: '灯火型', image: '一盏灯火', desc: '细腻专注，光不大，但能照亮一个角落很久。' },
  戊: { title: '山岳型', image: '高山大地', desc: '厚重可靠，别人愿意站在你身后。' },
  己: { title: '田园型', image: '田园沃土', desc: '包容，会经营，能把小事养成大事。' },
  庚: { title: '利刃型', image: '刀剑钢铁', desc: '果断讲效率，遇到问题想直接切开。' },
  辛: { title: '珠玉型', image: '珠玉首饰', desc: '精致有标准，对细节和品质很在意。' },
  壬: { title: '江河型', image: '江河大海', desc: '开阔爱流动，不喜欢被困在一个地方。' },
  癸: { title: '雨露型', image: '雨露云雾', desc: '敏感细腻，影响别人的方式安静而持久。' },
};

export const TALENTS: Record<Family, { name: string; desc: string }> = {
  比劫: { name: '自主型', desc: '自己的事自己定，遇事第一反应是靠自己。' },
  食伤: { name: '表达型', desc: '想法多，喜欢输出、创造和被看见。' },
  财星: { name: '务实型', desc: '关注结果和手里的资源，擅长把事情落地。' },
  官杀: { name: '担当型', desc: '对规则和责任敏感，压力下能扛事。' },
  印星: { name: '好学型', desc: '爱吸收、爱琢磨，需要一点安全感再出发。' },
};

export interface LifeCode {
  kernel: string;
  kernelTitle: string;
  kernelImage: string;
  kernelDesc: string;
  power: { label: string; desc: string };
  talent: { family: Family; name: string; desc: string };
  patch: { element: Element; stat: string; desc: string };
  stats: Array<{ element: Element; stat: string; value: number }>;
  seed: number;
  seedHex: string;
}

export function seedOf(chart: Chart): number {
  const t = chart.input;
  return hashString(
    [t.year, t.month, t.day, t.hour, t.minute, chart.gender, chart.correction.solarMinutes ?? 'clock'].join('|'),
  );
}

export function buildLifeCode(chart: Chart): LifeCode {
  const dm = chart.dayMaster;
  const k = KERNELS[dm.gan];
  const talent = TALENTS[chart.dominantFamily];
  const seed = seedOf(chart);
  return {
    kernel: dm.gan + dm.element,
    kernelTitle: k.title,
    kernelImage: k.image,
    kernelDesc: k.desc,
    power: chart.strong
      ? { label: '底气足', desc: '性子里有股劲，适合主动出击。' }
      : { label: '身段软', desc: '性子柔和，擅长借力和合作。' },
    talent: { family: chart.dominantFamily, ...talent },
    patch: {
      element: chart.weakestElement,
      stat: ELEMENT_STAT[chart.weakestElement],
      desc: `「${ELEMENT_STAT[chart.weakestElement]}」是初始值最低的属性，也是这一生里最有长进空间的一项。`,
    },
    stats: ELEMENTS.map(e => ({ element: e, stat: ELEMENT_STAT[e], value: chart.elements[e] })),
    seed,
    seedHex: '0x' + seed.toString(16).toUpperCase().padStart(8, '0'),
  };
}

/** 推算稿纸上逐行打出的内容。 */
export function codeLines(chart: Chart, code: LifeCode): string[] {
  const t = chart.input;
  const pad = (n: number) => String(n).padStart(2, '0');
  const corr = chart.correction;
  const notes: string[] = [];
  if (corr.dstMinutes) notes.push('夏令时减一小时');
  if (corr.solarMinutes !== null) notes.push(`真太阳时${corr.solarMinutes >= 0 ? '加' : '减'} ${Math.abs(Math.round(corr.solarMinutes))} 分钟`);
  return [
    `出生时辰：${t.year} 年 ${t.month} 月 ${t.day} 日 ${pad(t.hour)}:${pad(t.minute)}`,
    `时间校正：${notes.length ? notes.join('，') : '按钟表时间'}`,
    `农历：${chart.lunarText}，生肖${chart.zodiac}`,
    `四柱：${chart.pillars.map(p => p.gan + p.zhi).join('　')}`,
    `日主：${code.kernel}，${code.kernelImage}`,
    `五行：${code.stats.map(s => `${s.element} ${s.value}`).join('　')}`,
    `天赋：${code.talent.name}`,
    `命盘编号：${code.seedHex}`,
    '推算完毕，翻开你的这一天。',
  ];
}
