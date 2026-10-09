// 人生阶段与事件。剧情是虚构的平行人生,出生参数只决定"抽到哪些事件"和"运行环境",
// 每一步怎么走由玩家自己选。
import { controls, generatedBy, generates, stemElement, type Chart, type Element } from './chart.ts';
import { rng } from './rng.ts';

/** 六条选择维度,正值是前一个倾向,负值是后一个倾向。 */
export type Axis = 'risk' | 'self' | 'time' | 'act' | 'emo' | 'rule';
export const AXES: readonly Axis[] = ['risk', 'self', 'time', 'act', 'emo', 'rule'];
export const AXIS_POLES: Record<Axis, [string, string]> = {
  risk: ['冒险', '稳妥'],
  self: ['独立', '联结'],
  time: ['远谋', '当下'],
  act: ['行动', '思考'],
  emo: ['外放', '内收'],
  rule: ['破格', '守序'],
};

export type Effects = Partial<Record<Axis, number>>;

export interface Option {
  text: string;
  result: string;
  effects: Effects;
}

export interface GameEvent {
  id: string;
  tag: Element;
  text: string;
  options: Option[];
}

export interface Stage {
  id: string;
  name: string;
  codeName: string;
  ages: [number, number];
  events: GameEvent[];
}

export const STAGES: readonly Stage[] = [
  {
    id: 'child',
    name: '童年',
    codeName: '开机',
    ages: [0, 6],
    events: [
      {
        id: 'crane',
        tag: '木',
        text: '幼儿园手工课,老师让大家照着样子折纸鹤。你折到一半——',
        options: [
          { text: '照着步骤一步一步折完', result: '你的纸鹤翅膀对得整整齐齐,被放在展示架第一排。', effects: { rule: -1, act: -1 } },
          { text: '觉得不好玩,改折一架纸飞机', result: '纸飞机飞出了窗外,全班都跑去看。老师没生气,只是笑了。', effects: { rule: 1, risk: 1 } },
        ],
      },
      {
        id: 'rain',
        tag: '水',
        text: '下雨天,楼道口站着一个新搬来的孩子,没人和他玩。你——',
        options: [
          { text: '走过去,把伞分他一半', result: '那天之后,你多了一个形影不离的朋友。', effects: { self: -1, emo: 1 } },
          { text: '远远看着,回家把他画进本子', result: '你发现自己很喜欢观察别人,画了整整一本。', effects: { self: 1, act: -1 } },
        ],
      },
      {
        id: 'newyear',
        tag: '火',
        text: '过年家里来了一屋子亲戚,有人起哄让你表演个节目。你——',
        options: [
          { text: '站上板凳,大声背了一首诗', result: '掌声和红包一起到来,你第一次尝到被看见的滋味。', effects: { emo: 1, act: 1 } },
          { text: '躲进房间,说什么也不出来', result: '你在门后听完了整场热闹,觉得这样也挺好。', effects: { emo: -1, self: 1 } },
        ],
      },
    ],
  },
  {
    id: 'youth',
    name: '少年',
    codeName: '加载',
    ages: [7, 12],
    events: [
      {
        id: 'monitor',
        tag: '金',
        text: '班里选班干部,同桌一直怂恿你去竞选。你——',
        options: [
          { text: '自己上台,竞选纪律委员', result: '你当选了,也第一次体会到"管人"有多难。', effects: { act: 1, rule: -1 } },
          { text: '推荐同桌去,你帮他写稿', result: '同桌当选了,你成了班里最可靠的幕后军师。', effects: { self: -1, act: -1 } },
        ],
      },
      {
        id: 'pocket',
        tag: '土',
        text: '暑假,你攒下了一笔零花钱。你——',
        options: [
          { text: '存进存钱罐,等攒够了买个大的', result: '年底,你抱回了那套一直想要的书。', effects: { time: 1, risk: -1 } },
          { text: '当天就去买了想要的游戏卡', result: '那个夏天你玩得很尽兴,一点都不后悔。', effects: { time: -1, act: 1 } },
          { text: '买材料做手工,卖给同学', result: '你赚回了本钱,还多出几块,第一次觉得自己像个老板。', effects: { risk: 1, rule: 1 } },
        ],
      },
      {
        id: 'exam',
        tag: '木',
        text: '考试前一晚,你发现有一整章完全没看。你——',
        options: [
          { text: '熬夜把这一章啃完', result: '第二天有点困,但最后那道大题你写出来了。', effects: { act: 1, risk: 1 } },
          { text: '放掉这一章,把会的再巩固一遍', result: '你稳稳拿到了会的那部分分数。', effects: { risk: -1, act: -1 } },
        ],
      },
    ],
  },
  {
    id: 'teen',
    name: '青春',
    codeName: '第一次编译',
    ages: [13, 18],
    events: [
      {
        id: 'subject',
        tag: '火',
        text: '选科的时候,你喜欢的方向和家里希望的不一样。你——',
        options: [
          { text: '坚持自己的选择,和家里谈了三次', result: '他们最后同意了,只说了一句"以后别后悔"。', effects: { self: 1, risk: 1 } },
          { text: '听家里的,把兴趣留到课外', result: '从那以后,你的周末都属于那件喜欢的事。', effects: { self: -1, risk: -1 } },
        ],
      },
      {
        id: 'dream',
        tag: '水',
        text: '你在日记本上写下了一个很大的梦想。你——',
        options: [
          { text: '拿给最好的朋友看', result: '朋友说"你肯定行",这句话你记了很多年。', effects: { emo: 1, self: -1 } },
          { text: '锁进抽屉,谁也不告诉', result: '它成了只属于你一个人的发动机。', effects: { emo: -1, self: 1 } },
        ],
      },
      {
        id: 'nickname',
        tag: '金',
        text: '班里有人被起了难听的外号,大家都在笑。你——',
        options: [
          { text: '当场说一句"别这样"', result: '气氛僵了几秒,但后来没人再叫那个外号。', effects: { rule: 1, emo: 1 } },
          { text: '下课后去找那个同学聊天', result: '你们成了朋友,他后来说,那天很谢谢你。', effects: { self: -1, emo: -1 } },
        ],
      },
    ],
  },
  {
    id: 'launch',
    name: '闯荡',
    codeName: '上线',
    ages: [19, 25],
    events: [
      {
        id: 'firstjob',
        tag: '木',
        text: '毕业时摆着两条路:一份稳定的工作,和朋友拉你一起创业。你——',
        options: [
          { text: '选择稳定的工作', result: '你很快摸清了节奏,也攒下了第一笔属于自己的钱。', effects: { risk: -1, time: 1 } },
          { text: '跟朋友去创业', result: '第一年很苦,但你一个人学会了五个岗位的活。', effects: { risk: 1, act: 1 } },
        ],
      },
      {
        id: 'city',
        tag: '火',
        text: '你有机会去另一座城市生活。你——',
        options: [
          { text: '拖着两个箱子出发', result: '新城市的第一个晚上,你在楼下吃了一碗陌生的面。', effects: { risk: 1, self: 1 } },
          { text: '留在熟悉的城市,离家人近一点', result: '每个周末的家常饭,成了你的充电站。', effects: { risk: -1, self: -1 } },
        ],
      },
      {
        id: 'process',
        tag: '土',
        text: '工作中你发现一个流程特别低效。你——',
        options: [
          { text: '写了一份改进方案交上去', result: '方案被采纳了一半,领导记住了你的名字。', effects: { rule: 1, act: 1 } },
          { text: '先按规矩做,把问题记在本子上', result: '一年后,你成了最懂这套流程的人。', effects: { rule: -1, time: 1 } },
        ],
      },
    ],
  },
  {
    id: 'iterate',
    name: '而立',
    codeName: '迭代',
    ages: [26, 35],
    events: [
      {
        id: 'plateau',
        tag: '金',
        text: '你在一个领域做到了不错的位置,却开始觉得日子在重复。你——',
        options: [
          { text: '换个方向,从头学起', result: '前半年很狼狈,后来你发现自己又在长了。', effects: { risk: 1, rule: 1 } },
          { text: '往深处走,把这件事做到顶尖', result: '你成了别人口中"找他准没错"的那个人。', effects: { time: 1, risk: -1 } },
        ],
      },
      {
        id: 'oldfriend',
        tag: '水',
        text: '一个很久没联系的老朋友,突然发来一句"在吗"。你——',
        options: [
          { text: '直接打电话过去', result: '你们聊了两个小时,好像从来没分开过。', effects: { act: 1, emo: 1 } },
          { text: '先想想他为什么找你,再仔细回复', result: '你回得很周到,对方说你还是那么细心。', effects: { act: -1, emo: -1 } },
        ],
      },
      {
        id: 'holiday',
        tag: '火',
        text: '你终于有了一段完整的假期。你——',
        options: [
          { text: '订一张机票,去没去过的地方', result: '你在陌生的街上迷了路,却笑得很开心。', effects: { risk: 1, time: -1 } },
          { text: '在家补觉、做饭、收拾房间', result: '假期结束时,你觉得自己被"修好"了。', effects: { risk: -1, emo: -1 } },
          { text: '报一个短期课程,学一样新东西', result: '假期结束,你多了一项新技能。', effects: { time: 1, act: 1 } },
        ],
      },
    ],
  },
];

export const EVENTS_PER_STAGE = 2;

export interface PlannedStage {
  stage: Stage;
  events: GameEvent[];
  environment: { ganZhi: string; element: Element | null; relation: string };
}

/** 根据出生参数,为每个阶段抽取事件并标注"运行环境"(该年龄段所在的大运)。 */
export function planLife(chart: Chart, seed: number): PlannedStage[] {
  const random = rng(seed);
  return STAGES.map(stage => ({
    stage,
    events: pickWeighted(stage.events, EVENTS_PER_STAGE, e => 1 + chart.elements[e.tag] / 25, random),
    environment: environmentFor(chart, stage.ages),
  }));
}

function environmentFor(chart: Chart, ages: [number, number]): PlannedStage['environment'] {
  const mid = Math.floor((ages[0] + ages[1]) / 2);
  const step = chart.daYun.find(d => mid >= d.startAge && mid <= d.endAge);
  if (!step) return { ganZhi: '童限', element: null, relation: '大运未启动,由出生设定直接运行。' };
  const e = stemElement(step.ganZhi[0]);
  return { ganZhi: step.ganZhi, element: e, relation: relationText(chart.dayMaster.element, e) };
}

export function relationText(kernel: Element, env: Element): string {
  if (env === kernel) return '环境与内核同频,运行顺畅。';
  if (env === generatedBy(kernel)) return '环境在给内核供能。';
  if (env === generates(kernel)) return '内核在向环境输出能量。';
  if (controls(env) === kernel) return '环境在打磨内核。';
  return '内核在驾驭环境。';
}

function pickWeighted<T>(items: readonly T[], n: number, weight: (t: T) => number, random: () => number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < n && pool.length) {
    const total = pool.reduce((s, t) => s + weight(t), 0);
    let r = random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= weight(pool[i]);
      if (r < 0) break;
    }
    picked.push(pool.splice(i, 1)[0]);
  }
  // 保持事件在阶段内的原始顺序
  return items.filter(t => picked.includes(t));
}
