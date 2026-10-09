// 人生 24 小时：把一生放进一天。清晨 06:00 出生，走到第二天 05:00 天快亮。
// 24 幕是一条连贯的人生：外婆、巷口王叔的早餐摊、5 岁那场雨里认识的朋友、小时候的爱好、
// 离开还是留下的城市，会在后面一次次出现。前面的选择会改变后面的剧情和可选项。
// 剧情是虚构的平行人生，不对现实中的人做任何预测。
import { controls, generatedBy, generates, stemElement, type Chart, type Element } from './chart.ts';
import { rng } from './rng.ts';

/** 六条选择维度，正值是前一个倾向，负值是后一个倾向。 */
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

export type PlaceId = 'home' | 'kitchen' | 'market' | 'school' | 'park' | 'street' | 'city' | 'station' | 'office';
export type PropId =
  | 'chime' | 'kite' | 'umbrella' | 'lantern' | 'bicycle' | 'bowl' | 'pencil' | 'phone' | 'signpost' | 'notebook'
  | 'lamp' | 'suitcase' | 'laptop' | 'ticket' | 'cup' | 'key' | 'box' | 'guitar' | 'plant' | 'letter';

export interface Scene {
  place: PlaceId;
  prop: PropId;
  rain?: boolean;
}

export type Hobby = 'draw' | 'music' | 'sport' | 'make';
export const HOBBIES: Record<Hobby, { name: string; thing: string; prop: PropId }> = {
  draw: { name: '画画', thing: '一本新画本', prop: 'pencil' },
  music: { name: '唱歌', thing: '一把新吉他', prop: 'guitar' },
  sport: { name: '运动', thing: '一辆新自行车', prop: 'bicycle' },
  make: { name: '做手工', thing: '一个新工具箱', prop: 'box' },
};

/** 文案:一段固定文字,或按条件挑选的多个版本(第一个满足条件的生效,条件为 null 表示默认)。 */
type Line = string | Array<[cond: string | null, text: string]>;

interface OptionDef {
  /** 出现条件,如 'close'、'!recipe'、'left&!back' */
  if?: string;
  text: Line;
  result: Line;
  effects: Effects;
  set?: string[];
}

export interface Beat {
  id: string;
  hour: number;
  ages: [number, number];
  stage: number;
  place: PlaceId;
  /** 'hobby' 表示按玩家小时候选的爱好显示道具 */
  prop: PropId | 'hobby';
  rain?: boolean;
  text: Line;
  options: OptionDef[];
}

export interface Stage {
  name: string;
  timeOfDay: string;
}

export const STAGES: readonly Stage[] = [
  { name: '童年', timeOfDay: '清晨' },
  { name: '青春', timeOfDay: '午后' },
  { name: '而立', timeOfDay: '傍晚' },
  { name: '中年', timeOfDay: '深夜' },
  { name: '晚年', timeOfDay: '破晓' },
];

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

/** 钟点对应的时辰，如 6 → "卯时" */
export function shichen(hour: number): string {
  return BRANCHES[Math.floor(((hour + 1) % 24) / 2)] + '时';
}

export function clockLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function agesLabel(beat: Pick<Beat, 'ages' | 'hour' | 'stage'>): string {
  return beat.stage === 4 && beat.hour === 5 ? `${beat.ages[0]} 岁以后` : `${beat.ages[0]}–${beat.ages[1]} 岁`;
}

const o = (text: Line, result: Line, effects: Effects, extra: Partial<Pick<OptionDef, 'if' | 'set'>> = {}): OptionDef => ({ text, result, effects, ...extra });

export const BEATS: readonly Beat[] = [
  // ---------------- 童年 · 清晨 ----------------
  {
    id: 'birth', hour: 6, ages: [0, 2], stage: 0, place: 'home', prop: 'chime',
    text: '{home}的一个清晨，你出生了。外婆在窗边挂了一串风铃，说这样你睁开眼，第一眼就能看到光。你——',
    options: [
      o('伸手去抓那串叮当响的风铃', '风铃乱响，你咯咯笑出了声。外婆说：这孩子胆子大。', { act: 1, risk: 1 }),
      o('盯着窗帘缝里的光斑看了很久', '光一点点挪过墙面，你看得很认真，一声都没哭。', { act: -1, emo: -1 }),
      o('哇哇大哭，把全家人都叫了过来', '一屋子的人围过来哄你，你哭着哭着就笑了。', { emo: 1, self: -1 }),
      o('攥住外婆的手指不放', '外婆的手指很暖，你攥着它，又安心地睡着了。', { self: -1, risk: -1 }),
    ],
  },
  {
    id: 'hobby', hour: 7, ages: [3, 4], stage: 0, place: 'park', prop: 'kite',
    text: '三岁那年春天，外婆每天傍晚带你去河边的小公园。你最喜欢——',
    options: [
      o('拿树枝在地上画画，一画就是一下午', '你画的太阳长了八条腿，外婆说，那是会走路的太阳。', { self: 1, act: -1 }, { set: ['hobby:draw'] }),
      o('追着天上的风筝跑，跑得满头大汗', '你一路跑到河堤尽头，回来时裤腿上全是泥。', { act: 1, risk: 1 }, { set: ['hobby:sport'] }),
      o('跟着广场上的音乐跳来跳去', '跳舞的阿姨们把你围在中间，说这孩子有节奏感。', { emo: 1, rule: 1 }, { set: ['hobby:music'] }),
      o('蹲在一边，用瓶盖和石子搭一座小城', '你的小城有桥有路，还有一个瓶盖做的广场。', { time: 1, rule: -1 }, { set: ['hobby:make'] }),
    ],
  },
  {
    id: 'rain', hour: 8, ages: [5, 6], stage: 0, place: 'street', prop: 'umbrella', rain: true,
    text: '一个下雨天，巷口站着一个新搬来的孩子，浑身都湿透了。后来你知道，TA 叫{friend}。你——',
    options: [
      o('走过去，把伞分 TA 一半', '你们挤在一把小伞下走回家，从那天起，成了形影不离的朋友。', { self: -1, emo: 1 }, { set: ['close'] }),
      o('跑回家，拿来一条干毛巾', '{friend}接过毛巾，憋了半天，小声说了句：谢谢。', { act: 1, self: -1 }, { set: ['close'] }),
      o('远远看着，没有走过去', '第二天在幼儿园，{friend}正好坐在你旁边，你们谁也没说话。', { self: 1, emo: -1 }),
      o('拉着外婆一起过去', '外婆把{friend}送回了家，{friend}的妈妈塞给你一大把糖。', { rule: -1, self: -1 }, { set: ['close'] }),
    ],
  },
  {
    id: 'breakfast', hour: 9, ages: [7, 8], stage: 0, place: 'market', prop: 'bowl',
    text: [
      ['close', '上小学了。每天早上，巷口王叔的早餐摊冒着热气，{friend}总在那儿等你一起上学。今天你兜里多了五毛钱——'],
      [null, '上小学了。每天早上，巷口王叔的早餐摊冒着热气。{friend}也在那儿买早饭，你们见了面只是点点头。今天你兜里多了五毛钱——'],
    ],
    options: [
      o('买两个肉包，分给{friend}一个', '王叔又多塞了一根油条：好朋友，一起吃。', { self: -1, emo: 1 }, { set: ['close'] }),
      o('存起来，攒钱买一本漫画书', '一个月后，你抱着那本漫画，在被窝里打着手电看到半夜。', { time: 1, risk: -1 }),
      o('买一碗豆浆，坐在小板凳上慢慢喝', '豆浆很烫，你吹了很久，觉得这五毛钱花得真值。', { time: -1, self: 1 }),
      o('帮王叔收碗，他说今天的早饭不要钱', '王叔说你手脚麻利，以后可以来当小伙计。', { act: 1, rule: 1 }),
    ],
  },
  {
    id: 'festival', hour: 10, ages: [9, 10], stage: 0, place: 'school', prop: 'hobby',
    text: '四年级，学校要办艺术节，每个人都要报一个节目。你想到了{hobby}——',
    options: [
      o('报名，拉上{friend}一起', '你们排练了整整一个月，上台时腿在抖，台下的掌声很响。', { act: 1, self: -1 }, { set: ['close'] }),
      o('报名，一个人准备', '你在家练了很多遍。演完下台，手心全是汗，心里却很亮堂。', { self: 1, act: 1 }),
      o('不上台，在后台帮大家做道具', '你做的道具被三个班借去用了，老师在全校表扬了你。', { emo: -1, rule: -1 }),
      o('报一个从没试过的节目：说相声', '你忘了一半的词，全场却笑得最响。', { risk: 1, rule: 1 }),
    ],
  },
  {
    id: 'noodles', hour: 11, ages: [11, 12], stage: 0, place: 'kitchen', prop: 'bowl',
    text: '小学最后一个暑假，外婆说要教你做她拿手的番茄鸡蛋面。你——',
    options: [
      o('认真记下每一步，写在一个小本子上', '那个小本子，后来跟着你去了很多地方。', { time: 1, rule: -1 }, { set: ['recipe'] }),
      o('不看步骤，按自己的想法放调料', '面有点咸，外婆还是吃了个精光：比我做的有意思。', { rule: 1, risk: 1 }),
      o('只负责尝味道，嘴上说下次再学', '那个夏天你吃了很多碗面，一次也没学会。', { time: -1, emo: 1 }),
      o('学会以后，第二天就做给{friend}吃', '{friend}吃完抹抹嘴：这是我吃过最好吃的面。', { act: 1, self: -1 }, { set: ['recipe', 'close'] }),
    ],
  },

  // ---------------- 青春 · 午后 ----------------
  {
    id: 'middleschool', hour: 12, ages: [13, 14], stage: 1, place: 'school', prop: 'pencil',
    text: [
      ['close', '初中分班，你和{friend}被分到了不同的班。第一天午休，你——'],
      [null, '初中开学，你发现{friend}成了你的同桌。TA 还是不太爱说话。你——'],
    ],
    options: [
      o('跑去{friend}的班门口，等 TA 一起吃饭', '你们在走廊上边吃边吐槽新老师，跟以前一模一样。', { self: -1, emo: 1 }, { if: 'close' }),
      o('在新班级找人一起吃', '你认识了三个新朋友，晚上回家才想起没去找{friend}。', { risk: 1, self: 1 }, { if: 'close' }),
      o('和{friend}约好，每周五放学一起走回家', '这个约定坚持了三年，一次都没断过。', { time: 1, rule: -1 }, { if: 'close' }),
      o('一个人在教室里看书', '你看完了半本小说，觉得一个人待着也挺自在。', { self: 1, emo: -1 }, { if: 'close' }),
      o('主动问{friend}借一块橡皮', '一块橡皮，开始了一段很长的友谊。', { emo: 1, self: -1 }, { if: '!close', set: ['close'] }),
      o('各做各的，互不打扰', '你们井水不犯河水，期末却考了同一个分数。', { self: 1, emo: -1 }, { if: '!close' }),
      o('在{friend}的课本角上画了一个小人', '第二天，那个小人旁边多了一个{friend}画的小人。', { risk: 1, rule: 1 }, { if: '!close', set: ['close'] }),
      o('帮{friend}捡起掉在地上的作业本', '{friend}小声说了句谢谢，后来总把零食分你一半。', { act: 1, self: -1 }, { if: '!close', set: ['close'] }),
    ],
  },
  {
    id: 'subject', hour: 13, ages: [15, 16], stage: 1, place: 'home', prop: 'signpost',
    text: '选科的时候，你想选的方向和家里希望的不一样。晚饭桌上，菜都凉了。你——',
    options: [
      o('坚持自己的选择，和家里认真谈了三次', '他们最后点了头：自己选的路，自己走好。', { self: 1, risk: 1 }),
      o('听家里的，把{hobby}留到周末', '从那以后，你的周末都属于{hobby}。', { self: -1, risk: -1 }),
      o('去问问外婆怎么想', '外婆说：喜欢的事，做久了就是本事。你想了一整夜。', { self: -1, act: -1 }),
      o('先按家里说的选，偷偷准备另一条路', '你在课桌里藏了另一套课本，悄悄学了一年。', { rule: 1, time: 1 }),
    ],
  },
  {
    id: 'exam', hour: 14, ages: [17, 18], stage: 1, place: 'home', prop: 'lamp',
    text: '高考前的最后一天，窗外的蝉叫得很响。外婆煮了一碗面，端到你的书桌上。你——',
    options: [
      o('把错题本再翻一遍', '翻到第三遍，心反而静了下来。', { rule: -1, act: -1 }),
      o('放下书，陪外婆在楼下坐一会儿', '外婆说考成什么样都没关系，你突然一点也不紧张了。', { emo: 1, time: -1 }),
      o('给{friend}发消息，约好考完一起去吃烧烤', '{friend}只回了一个字：好。你们谁都没提考试。', { self: -1, emo: 1 }),
      o('早早关灯睡觉', '你睡了一个很长的觉，第二天醒得比闹钟还早。', { rule: -1, time: 1 }),
    ],
  },
  {
    id: 'college', hour: 15, ages: [19, 20], stage: 1, place: 'station', prop: 'suitcase',
    text: '录取通知书到了。一所学校在{far}，一所就在{home}本地。你——',
    options: [
      o('去{far}，想看看外面的世界', '出发那天，外婆往你的箱子里塞了一罐她做的辣酱。', { risk: 1, self: 1 }, { set: ['left'] }),
      o('留在{home}，周末还能回家吃饭', '每个周末回家，巷口的早餐摊都还在老地方。', { risk: -1, self: -1 }, { set: ['stayed'] }),
      o('选专业更好的那一所，在{far}', '你在{far}的图书馆里，泡掉了整整四年。', { time: 1, act: -1 }, { set: ['left'] }),
      o('和{friend}商量好，一起去{far}', '你们在同一座城市的两所学校，周末一起吃遍了大街小巷。', { self: -1, emo: 1 }, { if: 'close', set: ['left'] }),
    ],
  },
  {
    id: 'firstjob', hour: 16, ages: [21, 22], stage: 1, place: 'office', prop: 'laptop',
    text: '毕业了。一份稳定的工作，和一个学长拉你去创业的机会，一起摆在你面前。你——',
    options: [
      o('选稳定的工作', '你很快摸清了节奏，攒下了第一笔属于自己的钱。', { risk: -1, time: 1 }),
      o('跟学长去创业', '第一年很苦，你一个人学会了五个岗位的活。', { risk: 1, act: 1 }, { set: ['startup'] }),
      o('先出去走一个月，回来再定', '你在路上想明白了：先找份工作，把日子过稳。', { time: -1, emo: 1 }),
      o('去帮王叔，把早餐摊做到网上', '王叔的早餐第一次有了外卖，门口排队的人多了一倍。', { rule: 1, self: -1 }, { if: 'stayed', set: ['stall'] }),
      o('上班之余，把{hobby}做成一个小副业', '第一个月只赚了三百块，你却比拿工资还开心。', { risk: 1, time: 1 }, { if: '!stayed' }),
    ],
  },
  {
    id: 'crossroad', hour: 17, ages: [23, 24], stage: 1, place: 'city', prop: 'ticket',
    text: [
      ['left', '在{far}的第三年，{home}的一家公司向你发来了邀请。下班路上，你——'],
      [null, '{friend}从外地打来电话，说{far}那边机会多，问你要不要过去。你——'],
    ],
    options: [
      o('回{home}去', '回家的第一个早上，你在王叔的摊子上吃了一碗热馄饨。', { risk: -1, self: -1 }, { if: 'left', set: ['back'] }),
      o('留在{far}，这里已经有了自己的生活', '你在{far}有了常去的面馆，老板记得你不要香菜。', { self: 1, time: 1 }, { if: 'left' }),
      o('去一座从没去过的新城市看看', '你又一次拖着箱子上了火车，这一次，一点都不怕。', { risk: 1, rule: 1 }, { if: 'left' }),
      o('先打个电话，问问外婆', '外婆说：哪里吃得香、睡得着，哪里就是家。', { self: -1, act: -1 }, { if: 'left' }),
      o('收拾行李，去{far}', '临走前，王叔塞给你一袋包子，说路上吃。', { risk: 1, self: 1 }, { if: '!left', set: ['left'] }),
      o('留在{home}，这里有你熟悉的一切', '你在{home}换了一份更喜欢的工作。', { risk: -1, time: 1 }, { if: '!left' }),
      o('先请几天假，过去看看再说', '你在{far}待了一周，回来的时候，心里有了答案。', { act: -1, time: 1 }, { if: '!left' }),
      o('劝{friend}回{home}来', '{friend}笑你恋家，说会考虑考虑。', { self: -1, emo: 1 }, { if: '!left' }),
    ],
  },

  // ---------------- 而立 · 傍晚 ----------------
  {
    id: 'firsthome', hour: 18, ages: [25, 27], stage: 2, place: 'home', prop: 'key',
    text: '你在{city}有了第一间自己的小屋。屋子很小，窗外能看到一大片晚霞。你——',
    options: [
      o('花一个周末，把它布置成家', '小台灯、旧地毯、一盆绿萝。你很喜欢下班推开门的那一刻。', { time: 1, act: 1 }),
      o('照着那个小本子，做了第一碗番茄鸡蛋面', '味道差了一点，但热气一上来，屋子就有了家的样子。', { emo: 1, rule: -1 }, { if: 'recipe' }),
      o('去楼下面馆端回一碗面，坐在窗边吃', '面馆老板记住了你，后来总给你多卧一个蛋。', { time: -1, self: -1 }, { if: '!recipe' }),
      o('先凑合住，把钱留着去看更大的世界', '那一年，你去了三个没去过的地方。', { risk: 1, time: -1 }),
      o('叫上几个同事来家里吃火锅', '六个人挤在小桌边，锅一开，窗户上全是雾气。', { self: -1, emo: 1 }),
    ],
  },
  {
    id: 'sixyears', hour: 19, ages: [28, 30], stage: 2, place: 'office', prop: 'signpost',
    text: [
      ['startup', '创业第五年，公司撑了下来，你却已经很久没有好好吃一顿饭了。你——'],
      [null, '工作第六年，你做到了不错的位置，却开始觉得日子在重复。你——'],
    ],
    options: [
      o('继续往前冲，再拼一年', '公司又长大了一圈，你学会了在凌晨两点吃泡面也不觉得苦。', { risk: 1, act: 1 }, { if: 'startup' }),
      o('把公司交给合伙人，休息一阵', '你回了一趟{home}，在外婆家睡了三天三夜。', { self: -1, risk: -1 }, { if: 'startup' }),
      o('多招几个人，把担子分出去', '新来的同事很能干，你第一次准时下了班。', { rule: -1, self: -1 }, { if: 'startup' }),
      o('给自己定一条规矩：每天好好吃午饭', '就这一条，你坚持了下来，气色好了很多。', { time: 1, rule: -1 }, { if: 'startup' }),
      o('换个方向，从头学起', '前半年很狼狈，后来你发现自己又在长了。', { risk: 1, rule: 1 }, { if: '!startup' }),
      o('往深处走，把这件事做到最好', '你成了别人口中"找你准没错"的那个人。', { time: 1, risk: -1 }, { if: '!startup' }),
      o('把{hobby}重新捡起来，下班以后做', '你在一个个晚上，找回了那个小时候的自己。', { emo: 1, time: -1 }, { if: '!startup' }),
      o('申请调去一个新部门', '新部门一切从零开始，你反而觉得每天都有盼头。', { act: 1, self: 1 }, { if: '!startup' }),
    ],
  },
  {
    id: 'oldfriend', hour: 20, ages: [31, 33], stage: 2, place: 'city', prop: 'phone',
    text: [
      ['close', '{friend}突然打来电话，声音有点哑："我想换个活法，你觉得我疯了吗？"你——'],
      [null, '一个周末，你在街上遇见了多年没联系的{friend}。TA 在路边支了一个小摊。你——'],
    ],
    options: [
      o('二话不说，支持 TA', '{friend}在电话那头笑了：就知道你会这么说。', { emo: 1, risk: 1 }, { if: 'close' }),
      o('陪 TA 一起，把利弊列在纸上', '你们列了两页纸，最后是{friend}自己做的决定。', { act: -1, time: 1 }, { if: 'close' }),
      o('劝 TA 先稳一稳，再看看', '{friend}听进去了，半年后才动身，走得很稳。', { risk: -1, rule: -1 }, { if: 'close' }),
      o('第二天请了假，坐车去见 TA', '你们在{friend}家楼下的小馆子，从中午一直聊到天黑。', { act: 1, self: -1 }, { if: 'close' }),
      o('坐下来，和 TA 聊了一下午', '聊起巷口的早餐摊，你们才发现，彼此都还记得那场雨。', { self: -1, emo: 1 }, { if: '!close', set: ['close'] }),
      o('买了 TA 摊上的东西，留了联系方式', '那天晚上，{friend}给你发来一句：常联系。', { act: 1, rule: -1 }, { if: '!close', set: ['close'] }),
      o('点点头，各自走开', '走出很远，你回头看了一眼，那个小摊亮着一盏暖黄的灯。', { emo: -1, self: 1 }, { if: '!close' }),
      o('第二天，又特意去了一次', '{friend}笑了：我就猜你会再来。', { risk: 1, emo: 1 }, { if: '!close', set: ['close'] }),
    ],
  },
  {
    id: 'newyear', hour: 21, ages: [34, 36], stage: 2, place: 'home', prop: 'lantern',
    text: [
      ['left&!back', '过年回到{home}，外婆的头发全白了。年夜饭桌上，她问你这些年过得好不好。你——'],
      [null, '过年，一大家子挤在外婆家吃年夜饭。外婆的头发全白了，她问你这些年过得好不好。你——'],
    ],
    options: [
      o('把这些年的事，一件件讲给她听', '外婆听得很认真，最后只说了一句：你长大了。', { emo: 1, self: -1 }),
      o('只说好的，难处一个字都没提', '外婆没多问，只往你碗里夹了一块最大的鱼。', { emo: -1, rule: -1 }),
      o('拉着外婆一起包饺子，有些话不用说也懂', '你包的饺子破了一半，外婆笑得很开心。', { act: 1, emo: -1 }),
      o('提议明年春天，带外婆出去走走', '外婆嘴上说麻烦，第二天就开始翻衣柜找衣服。', { time: 1, risk: 1 }, { set: ['trip'] }),
    ],
  },
  {
    id: 'latenight', hour: 22, ages: [37, 39], stage: 2, place: 'street', prop: 'cup',
    text: '加完班，楼下便利店的灯还亮着。手机里，家人群在聊：外婆学会了用视频通话。你——',
    options: [
      o('买一份关东煮，坐在窗边慢慢吃', '热气扑在脸上，你觉得这一天总算结束了。', { time: -1, emo: -1 }),
      o('给外婆打一个视频电话', '外婆把镜头对着自己的鼻子，喊了半天你听不听得见。', { self: -1, emo: 1 }),
      o('回家把明天要做的事列成清单', '第二天，你按着清单一件件划掉，心里很踏实。', { time: 1, rule: -1 }),
      o('和便利店的店员聊了几句', '店员说你常来，下次给你留最后一个饭团。', { self: -1, risk: 1 }),
    ],
  },
  {
    id: 'forty', hour: 23, ages: [40, 42], stage: 2, place: 'home', prop: 'hobby',
    text: '四十岁生日，{friend}送了你一样礼物：{thing}。你——',
    options: [
      o('当晚就用了起来', '你玩到半夜，像是回到了小时候。', { act: 1, risk: 1 }),
      o('好好收起来，说等闲下来再用', '它在柜子里放得整整齐齐，你偶尔会拿出来看看。', { time: 1, act: -1 }),
      o('约{friend}每周一起玩一次', '每周六下午，成了你们雷打不动的时间。', { self: -1, rule: -1 }),
      o('用它做了一份回礼，送给{friend}', '{friend}收到时愣了半天，说这是今年最好的礼物。', { emo: 1, self: -1 }),
    ],
  },

  // ---------------- 中年 · 深夜 ----------------
  {
    id: 'stall', hour: 0, ages: [43, 47], stage: 3, place: 'market', prop: 'bowl',
    text: [
      ['left&!back', '听家里人说，巷口王叔的早餐摊要收了。王叔想把摊子交给一个愿意接手的人。你——'],
      [null, '巷口王叔的早餐摊要收了。王叔说，想把摊子交给一个愿意接手的人。你——'],
    ],
    options: [
      o('帮王叔找一个想接手的年轻人', '接手的是个爱笑的年轻人，招牌没换，豆浆还是原来的味道。', { self: -1, act: 1 }),
      o('赶回去吃最后一碗馄饨，拍下那块旧招牌', '王叔说：你小时候五毛钱的那碗豆浆，我都记得。', { emo: 1, time: -1 }),
      o('把王叔的故事写下来，发给老街坊们', '很多人在下面留言，说起了自己小时候的那碗豆浆。', { emo: 1, rule: 1 }),
      o('自己接下这个摊子，周末去帮忙', '你周末四点起床和面，忙得脚不沾地，却笑得最多。', { risk: 1, act: 1 }, { if: 'stall' }),
      o('什么都没做，只是心里有点空', '那天早上，你在路上买了一个包子，却没吃出以前的味道。', { emo: -1, act: -1 }, { if: '!stall' }),
    ],
  },
  {
    id: 'mentor', hour: 1, ages: [48, 52], stage: 3, place: 'office', prop: 'cup',
    text: '公司来了一个年轻人，跟你刚工作时很像。TA 搞砸了一件事，一个人躲在楼梯间。你——',
    options: [
      o('走过去，讲了你当年搞砸的那件事', 'TA 听完笑出了声，眼睛却还是红的。', { emo: 1, self: -1 }),
      o('留一张便条：明天一起复盘', '第二天的复盘只用了二十分钟，TA 记了满满一页。', { time: 1, rule: -1 }),
      o('不去打扰，让 TA 自己缓一缓', '一个小时后，TA 回到工位，把事情处理完了。', { self: 1, emo: -1 }),
      o('带 TA 下楼吃一碗热汤面', '一碗面下肚，TA 说：好像也没那么糟。', { act: 1, emo: 1 }),
    ],
  },
  {
    id: 'grandma', hour: 2, ages: [53, 57], stage: 3, place: 'kitchen', prop: 'bowl',
    text: '外婆九十岁了，很多事记不清了，却还记得你小时候爱吃的那碗面。你——',
    options: [
      o('翻开那个小本子，做给她吃', '外婆吃了一口，慢慢点头：嗯，是这个味道。', { emo: 1, rule: -1 }, { if: 'recipe' }),
      o('请外婆再教你一次', '她站在灶台边一步步地说，这一次，你全记下来了。', { time: 1, rule: -1 }, { if: '!recipe', set: ['recipe'] }),
      o('搬回去，陪她住一段日子', '每天傍晚，你们坐在窗边，听风铃叮当响。', { self: -1, time: -1 }),
      o('把她讲的老故事一段段录下来', '你录了二十多段，最喜欢她讲年轻时第一次进城的那段。', { time: 1, act: 1 }),
      o(
        [['trip', '兑现那年过年的约定，带她去看年轻时住过的地方'], [null, '带她去看看年轻时住过的地方']],
        '外婆站在老房子前看了很久，说：样子变了，树还在。',
        { risk: 1, emo: 1 },
      ),
    ],
  },
  {
    id: 'retire', hour: 3, ages: [58, 62], stage: 3, place: 'park', prop: 'plant',
    text: '你从工作里退了下来，日子一下子空出了一大块。你——',
    options: [
      o('去一个年轻时一直想去的地方', '你在陌生的小镇住了一个月，每天都去同一家早餐店。', { risk: 1, time: -1 }),
      o('报一个{hobby}班，从头学起', '你成了班上年纪最大、笔记最认真的那一个。', { time: 1, act: 1 }),
      o('在巷子里开一家小面馆，用外婆的方子', '小面馆只有六张桌子，番茄鸡蛋面卖得最好。', { rule: 1, self: 1 }, { if: 'recipe' }),
      o('在小区里帮大家修修补补', '邻居们都知道，有什么坏了，就去找你。', { self: -1, act: 1 }, { if: '!recipe' }),
      o('每天早上去公园，和老朋友们一起走走', '你们走得很慢，聊的还是年轻时候的事。', { self: -1, emo: 1 }),
    ],
  },

  // ---------------- 晚年 · 破晓 ----------------
  {
    id: 'again', hour: 4, ages: [63, 75], stage: 4, place: 'park', prop: 'letter',
    text: '公园里，一个年轻人问你："如果重来一次，你会换一条路吗？"你——',
    options: [
      o('说：会，我想试试另一条', 'TA 眼睛一亮，说想听听那条路是什么样子。', { risk: 1, emo: 1 }),
      o('说：不会，每一步都算数', 'TA 点点头，好像明白了点什么。', { risk: -1, emo: -1 }),
      o('笑着说：你先走你的，走完再来告诉我', 'TA 愣了一下，然后也笑了。', { self: 1, time: 1 }),
      o('讲起了巷口那个早餐摊的故事', '你讲了很久，TA 说明天一早也想去尝尝。', { emo: 1, rule: -1 }),
    ],
  },
  {
    id: 'dawn', hour: 5, ages: [76, 88], stage: 4, place: 'home', prop: 'notebook',
    text: [
      ['recipe', '天快亮了。你翻开那个用了一辈子的小本子，第一页是外婆的面，最后一页还空着。窗外，巷口传来早餐摊开张的声音。你——'],
      [null, '天快亮了。你翻开那本写了一辈子的日记，最后一页还空着。窗外，巷口传来早餐摊开张的声音。你——'],
    ],
    options: [
      o('写下一句给年轻时自己的话', '你写了很久，最后只留下五个字：慢慢来，别怕。', { emo: 1, time: 1 }),
      o('留着这页空白，等天亮再写', '光一点点爬上桌子，像很多年前的那个早晨。', { emo: -1, time: -1 }),
      o('下楼去买一碗热豆浆', '摊子的新主人认出了你，多给你加了一勺糖。', { act: 1, risk: 1 }),
      o('给{friend}打个电话："起来没？去吃早饭。"', '电话那头传来{friend}的声音：早就起了，就等你。', { self: -1, emo: 1 }),
    ],
  },
];

export const TOTAL_CHOICES = BEATS.length;

/* ---------------- 剧情状态与文案解析 ---------------- */

export interface StoryContext {
  friend: string;
  home: string;
  far: string;
}

const FRIEND_NAMES = ['小满', '阿远', '乐乐', '阿禾', '小舟', '安安', '阿树', '米粒'];
const FAR_CITIES = ['海边的那座城市', '北方的大城市', '南方的老城', '西边的山城'];

/** 朋友的名字和远方的城市按种子固定;家乡用玩家填的出生地,没填就是"小城"。 */
export function storyContext(seed: number, placeName: string | null): StoryContext {
  const r = rng(seed ^ 0x5eed);
  return {
    friend: FRIEND_NAMES[Math.floor(r() * FRIEND_NAMES.length)],
    far: FAR_CITIES[Math.floor(r() * FAR_CITIES.length)],
    home: placeName ? placeName.replace(/(市|区|县|自治州|地区|盟)$/, '') : '小城',
  };
}

export function matches(cond: string | null | undefined, flags: ReadonlySet<string>): boolean {
  if (!cond) return true;
  return cond.split('&').every(c => (c.startsWith('!') ? !flags.has(c.slice(1)) : flags.has(c)));
}

function hobbyOf(flags: ReadonlySet<string>): Hobby {
  for (const h of Object.keys(HOBBIES) as Hobby[]) if (flags.has(`hobby:${h}`)) return h;
  return 'draw';
}

function fill(line: Line, ctx: StoryContext, flags: ReadonlySet<string>): string {
  const text = typeof line === 'string' ? line : (line.find(([c]) => matches(c, flags)) ?? line[line.length - 1])[1];
  const hobby = HOBBIES[hobbyOf(flags)];
  const city = flags.has('left') && !flags.has('back') ? ctx.far : ctx.home;
  return text
    .replaceAll('{friend}', ctx.friend)
    .replaceAll('{home}', ctx.home)
    .replaceAll('{far}', ctx.far)
    .replaceAll('{city}', city)
    .replaceAll('{hobby}', hobby.name)
    .replaceAll('{thing}', hobby.thing);
}

export interface ResolvedOption {
  text: string;
  result: string;
  effects: Effects;
  set: string[];
}

export interface ResolvedBeat {
  beat: Beat;
  index: number;
  text: string;
  scene: Scene;
  options: ResolvedOption[];
}

/** 按当前剧情状态,解析第 index 幕的文字、画面和可选项。 */
export function resolveBeat(index: number, ctx: StoryContext, flags: ReadonlySet<string>): ResolvedBeat {
  const beat = BEATS[index];
  return {
    beat,
    index,
    text: fill(beat.text, ctx, flags),
    scene: { place: beat.place, prop: beat.prop === 'hobby' ? HOBBIES[hobbyOf(flags)].prop : beat.prop, rain: beat.rain },
    options: beat.options
      .filter(opt => matches(opt.if, flags))
      .map(opt => ({ text: fill(opt.text, ctx, flags), result: fill(opt.result, ctx, flags), effects: opt.effects, set: opt.set ?? [] })),
  };
}

/* ---------------- 运行环境(大运) ---------------- */

export interface Environment {
  ganZhi: string;
  element: Element | null;
  relation: string;
}

export function environmentFor(chart: Chart, ages: [number, number]): Environment {
  const mid = Math.floor((ages[0] + ages[1]) / 2);
  const step = chart.daYun.find(d => mid >= d.startAge && mid <= d.endAge);
  if (!step) {
    const before = chart.daYun.length > 0 && mid < chart.daYun[0].startAge;
    return before
      ? { ganZhi: '童限', element: null, relation: '大运还没开始，按出生时的设定过日子。' }
      : { ganZhi: '自在', element: null, relation: '大运已经走完，按自己的节奏过日子。' };
  }
  const e = stemElement(step.ganZhi[0]);
  return { ganZhi: step.ganZhi, element: e, relation: relationText(chart.dayMaster.element, e) };
}

export function relationText(kernel: Element, env: Element): string {
  if (env === kernel) return '这几年的气候和你的本性合拍，日子过得顺手。';
  if (env === generatedBy(kernel)) return '这几年的气候在滋养你。';
  if (env === generates(kernel)) return '这几年，你在把力气给出去。';
  if (controls(env) === kernel) return '这几年的气候在磨你的性子。';
  return '这几年，日子由你来掌舵。';
}
