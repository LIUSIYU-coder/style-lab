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
export type Line = string | Array<[cond: string | null, text: string]>;

interface OptionDef {
  /** 稳定编号(a、b、c…),存档和深度解析用它定位选项 */
  key: string;
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
  /** 这一幕开场时要玩家用手做的一个小动作 */
  gesture?: Gesture;
  /** 选完之后请玩家亲手写一句话(写进深度解析) */
  write?: { key: WriteKey; prompt: Line; placeholder: string };
}

export interface Gesture {
  kind: 'hold' | 'tap' | 'swipe';
  label: Line;
  /** tap 需要点几下 */
  times?: number;
}

export type WriteKey = 'carer' | 'dawn';
export const WRITE_KEYS: readonly WriteKey[] = ['carer', 'dawn'];

export interface Stage {
  name: string;
  timeOfDay: string;
  /** 对应的时辰 */
  shichen: string;
  /** 章首的一句话 */
  epigraph: string;
}

export const STAGES: readonly Stage[] = [
  { name: '童年', timeOfDay: '清晨', shichen: '卯时到巳时', epigraph: '故事从{home}的一个清晨开始。那时候天很亮，日子很长，{carer}的风铃挂在窗边。' },
  { name: '青春', timeOfDay: '午后', shichen: '午时到申时', epigraph: '午后的太阳晒得人发懒，可这几年你一点也不懒：在长个子，也在长主意。' },
  { name: '而立', timeOfDay: '傍晚', shichen: '酉时到亥时', epigraph: '城市的灯一盏盏亮起来。你开始自己付房租、自己拿主意，也开始知道，选择是有代价的。' },
  { name: '中年', timeOfDay: '深夜', shichen: '子时到丑时', epigraph: '夜深了。年轻时以为很远的事，一件件走到了眼前。' },
  { name: '晚年', timeOfDay: '破晓', shichen: '寅时', epigraph: '天快亮了。窗外有鸟叫，巷口有早餐摊开张的声音。' },
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

const o = (key: string, text: Line, result: Line, effects: Effects, extra: Partial<Pick<OptionDef, 'if' | 'set'>> = {}): OptionDef => ({ key, text, result, effects, ...extra });

export const BEATS: readonly Beat[] = [
  // ---------------- 童年 · 清晨 ----------------
  {
    id: 'birth', hour: 6, ages: [0, 2], stage: 0, place: 'home', prop: 'chime',
    gesture: { kind: 'tap', label: '轻点一下，让窗边的风铃响起来' },
    text: [
      ['parent', '{home}的一个清晨，你出生了。家里不宽裕，大部分时间是{carer}一个人带着你。{ta}在窗边挂了一串旧风铃，说这样你每天睁开眼，第一眼就能看到光。你——'],
      [null, '{home}的一个清晨，你出生了。爸妈白天都要上班，你是{carer}带大的。{ta}在窗边挂了一串旧风铃，说这样你每天睁开眼，第一眼就能看到光。你——'],
    ],
    options: [
      o('a', '伸手去抓那串叮当响的风铃', [['nick', '风铃被你扯得乱响，{carer}赶紧把它挂高了一点，嘴上念叨：{nick}啊，你这孩子，胆子真大。'], [null, '风铃被你扯得乱响，{carer}赶紧把它挂高了一点，嘴上念叨：这孩子，胆子大。']], { act: 1, risk: 1 }),
      o('b', '盯着窗帘缝里的光斑看了很久', '光一点点挪过墙面，你看得很认真，一声都没哭。{carer}说你是个"看事的人"。', { act: -1, emo: -1 }),
      o('c', '哇哇大哭，把全家人都叫了过来', '一屋子的人围过来哄你，有人唱歌，有人摇拨浪鼓。你哭着哭着，就笑了。', { emo: 1, self: -1 }),
      o('d', '攥住{carer}的手指不放', '{carer}的手指粗糙又暖和。你攥着它，又安心地睡着了，{ta}一动也不敢动。', { self: -1, risk: -1 }),
    ],
  },
  {
    id: 'hobby', hour: 7, ages: [3, 4], stage: 0, place: 'park', prop: 'kite',
    text: '三岁那年春天，{carer}每天傍晚牵着你去河边的小公园。有人放风筝，有人跳广场舞，还有一群孩子在沙堆里打滚。你最喜欢——',
    options: [
      o('a', '捡根树枝，在地上画画，一画就是一下午', '你画的太阳长了八条腿。{carer}蹲下来看了很久，说那是一颗会走路的太阳。', { self: 1, act: -1 }, { set: ['hobby:draw'] }),
      o('b', '追着天上的风筝跑，跑得满头大汗', '你一路跑到河堤尽头，摔了一跤也没哭，回来时裤腿上全是泥。', { act: 1, risk: 1 }, { set: ['hobby:sport'] }),
      o('c', '跟着广场上的音乐跳来跳去', '跳舞的阿姨们把你围在中间，有人塞给你一块糖，说这孩子天生有节奏感。', { emo: 1, rule: 1 }, { set: ['hobby:music'] }),
      o('d', '蹲在一边，用瓶盖和石子搭一座小城', '你的小城有桥有路，还有一个瓶盖做的广场。天黑了，你还不肯走。', { time: 1, rule: -1 }, { set: ['hobby:make'] }),
    ],
  },
  {
    id: 'rain', hour: 8, ages: [5, 6], stage: 0, place: 'street', prop: 'umbrella', rain: true,
    gesture: { kind: 'hold', label: '雨下大了。按住，撑开你的小红伞' },
    text: '下了一整天的雨。放学时，巷口的屋檐下站着一个新搬来的孩子，书包湿透了，鞋子里全是水，谁也不认识。后来你才知道，TA 叫{friend}。你——',
    options: [
      o('a', '走过去，把伞分 TA 一半', '你们挤在一把小伞下走回家，两个人的肩膀都湿了。从那天起，你们成了形影不离的朋友。', { self: -1, emo: 1 }, { set: ['close'] }),
      o('b', '跑回家，拿来一条干毛巾', '{friend}接过毛巾，憋了半天，小声说了句：谢谢。第二天，你的桌上多了一颗糖。', { act: 1, self: -1 }, { set: ['close'] }),
      o('c', '远远看着，没有走过去', '你在窗边看了很久，直到有个大人把{friend}接走。第二天在班上，{friend}正好坐在你旁边，你们谁也没说话。', { self: 1, emo: -1 }),
      o('d', '拉着{carer}一起过去', '{carer}把{friend}送回了家。{friend}的妈妈连声道谢，塞给你一大把糖。', { rule: -1, self: -1 }, { set: ['close'] }),
    ],
  },
  {
    id: 'breakfast', hour: 9, ages: [7, 8], stage: 0, place: 'market', prop: 'bowl',
    gesture: { kind: 'tap', times: 3, label: '热豆浆端上来了，轻点三下把它吹凉' },
    text: [
      ['close', '上小学了。每天早上，巷口王叔的早餐摊准时冒着热气，油条在锅里滋滋作响，{friend}总在摊子边上等你一起上学。今天，你兜里多了几块零花钱——'],
      [null, '上小学了。每天早上，巷口王叔的早餐摊准时冒着热气，油条在锅里滋滋作响。{friend}也在那儿买早饭，你们见了面只是点点头。今天，你兜里多了几块零花钱——'],
    ],
    options: [
      o('a', '买两个肉包，分给{friend}一个', '王叔看在眼里，又多塞了一根油条：好朋友，一起吃。', { self: -1, emo: 1 }, { set: ['close'] }),
      o('b', '存起来，攒着买那本想了很久的漫画', '一个月后，你终于抱回了那本漫画，在被窝里打着手电看到半夜。', { time: 1, risk: -1 }),
      o('c', '买一碗甜豆浆，坐在小板凳上慢慢喝', '豆浆很烫，你吹了很久。王叔说你是他见过喝得最认真的小孩。', { time: -1, self: 1 }),
      o('d', '帮王叔收拾碗筷，他说今天的早饭不要钱', '王叔说你手脚麻利，以后可以来当小伙计。你偷偷高兴了一整天。', { act: 1, rule: 1 }),
    ],
  },
  {
    id: 'festival', hour: 10, ages: [9, 10], stage: 0, place: 'school', prop: 'hobby',
    text: '四年级，学校要办艺术节，班主任让每个人都报一个节目。全班都在交头接耳，你想到了{hobby}——',
    options: [
      o('a', '报名，拉上{friend}一起', '你们排练了整整一个月，上台时腿在抖，台下的掌声却很响。', { act: 1, self: -1 }, { set: ['close'] }),
      o('b', '报名，一个人准备', '你在家练了很多遍。演完下台，手心全是汗，心里却很亮堂。', { self: 1, act: 1 }),
      o('c', '不上台，在后台帮大家做道具', '你做的纸板月亮被三个班借去用了，班主任在全校大会上点了你的名。', { emo: -1, rule: -1 }),
      o('d', '报一个从没试过的节目：说相声', '你忘了一半的词，急得满脸通红，全场却笑得最响。', { risk: 1, rule: 1 }),
    ],
  },
  {
    id: 'noodles', hour: 11, ages: [11, 12], stage: 0, place: 'kitchen', prop: 'bowl',
    text: [
      ['nick', '小学最后一个暑假，蝉叫得人心烦。{carer}在厨房里扬声喊你的小名：“{nick}，进来！”{ta}要教你做拿手的番茄鸡蛋面："以后{carer}不在你身边，你也饿不着。"你——'],
      [null, '小学最后一个暑假，蝉叫得人心烦。{carer}把你叫进厨房，说要教你做{ta}拿手的番茄鸡蛋面："以后{carer}不在你身边，你也饿不着。"你——'],
    ],
    options: [
      o('a', '认真记下每一步，写在一个小本子上', '"番茄要先炒出沙，鸡蛋要嫩。"你一笔一笔地记。那个小本子，后来跟着你去了很多地方。', { time: 1, rule: -1 }, { set: ['recipe'] }),
      o('b', '不看步骤，按自己的想法放调料', '面有点咸，{carer}还是吃了个精光，笑着说：比我做的有意思。', { rule: 1, risk: 1 }),
      o('c', '只负责尝味道，嘴上说下次再学', '那个夏天你吃了很多碗面，一次也没学会。{carer}也不催，只是每天多煮一碗。', { time: -1, emo: 1 }),
      o('d', '学会以后，第二天就做给{friend}吃', '{friend}吃得满头大汗，抹抹嘴说：这是我吃过最好吃的面。', { act: 1, self: -1 }, { set: ['recipe', 'close'] }),
    ],
  },

  // ---------------- 青春 · 午后 ----------------
  {
    id: 'middleschool', hour: 12, ages: [13, 14], stage: 1, place: 'school', prop: 'pencil',
    text: [
      ['close', '上了初中，第一次月考排名贴在了走廊上。你和{friend}被分到了不同的班，成绩也拉开了距离。午休铃响了，你——'],
      [null, '上了初中，第一次月考排名贴在了走廊上。你发现{friend}成了你的同桌，TA 的名字就排在你下面一位。TA 还是不太爱说话。你——'],
    ],
    options: [
      o('a', '跑去{friend}的班门口，等 TA 一起吃饭', '你们端着饭盒在走廊上边吃边吐槽新老师，好像什么都没变。', { self: -1, emo: 1 }, { if: 'close' }),
      o('b', '在新班级找人一起吃', '你认识了三个新朋友，聊得很开心，晚上回家才想起没去找{friend}。', { risk: 1, self: 1 }, { if: 'close' }),
      o('c', '和{friend}约好，每周五放学一起走回家', '这个约定坚持了三年，一次都没断过，哪怕下雨天也一样。', { time: 1, rule: -1 }, { if: 'close' }),
      o('d', '一个人留在教室，把错题重新做一遍', '你一个人把卷子订正完，期中考试往前挪了十名。', { self: 1, emo: -1 }, { if: 'close' }),
      o('e', '主动问{friend}借一块橡皮', '一块橡皮，开始了一段很长的友谊。后来你们连橡皮都用同一块。', { emo: 1, self: -1 }, { if: '!close', set: ['close'] }),
      o('f', '各做各的，互不打扰', '你们井水不犯河水，期末却考了同一个分数，相视一笑。', { self: 1, emo: -1 }, { if: '!close' }),
      o('g', '在{friend}的课本角上画了一个小人', '第二天，那个小人旁边多了一个{friend}画的小人，还举着一面小旗子。', { risk: 1, rule: 1 }, { if: '!close', set: ['close'] }),
      o('h', '帮{friend}捡起掉在地上的作业本', '{friend}小声说了句谢谢，后来总把零食分你一半。', { act: 1, self: -1 }, { if: '!close', set: ['close'] }),
    ],
  },
  {
    id: 'subject', hour: 13, ages: [15, 16], stage: 1, place: 'home', prop: 'signpost',
    text: '分科表要在周一交。你想选的方向和爸妈希望的不一样，他们说"那个方向以后不好找工作"。晚饭桌上谁都没说话，菜都凉了。你——',
    options: [
      o('a', '坚持自己的选择，和爸妈认真谈了三次', '第三次，你把想了很久的理由一条条说清楚。他们最后点了头：自己选的路，自己走好。', { self: 1, risk: 1 }),
      o('b', '听爸妈的，把{hobby}留到周末', '你在分科表上签了名。从那以后，你的周末都属于{hobby}。', { self: -1, risk: -1 }),
      o('c', '去问问{carer}怎么想', '{carer}剥着毛豆说：喜欢的事，做久了就是本事。你想了一整夜。', { self: -1, act: -1 }),
      o('d', '先按爸妈说的选，偷偷准备另一条路', '你在课桌里藏了另一套课本，每天晚自习多学一个小时。', { rule: 1, time: 1 }),
    ],
  },
  {
    id: 'exam', hour: 14, ages: [17, 18], stage: 1, place: 'home', prop: 'lamp',
    text: [
      ['nick', '高考前的最后一天。窗外的蝉叫得很响，书桌上的试卷堆得比台灯还高。{carer}煮了一碗番茄鸡蛋面，轻手轻脚地端进来，小声说：“{nick}，趁热吃。”你——'],
      [null, '高考前的最后一天。窗外的蝉叫得很响，书桌上的试卷堆得比台灯还高。{carer}煮了一碗番茄鸡蛋面，轻手轻脚地端进来。你——'],
    ],
    options: [
      o('a', '把错题本再翻一遍', '翻到第三遍，你发现那些错过的题都认识你了。心反而静了下来。', { rule: -1, act: -1 }),
      o('b', '放下书，陪{carer}在楼下坐一会儿', '{carer}说考成什么样都没关系，有面吃就行。你突然一点也不紧张了。', { emo: 1, time: -1 }),
      o('c', '给{friend}发消息，约好考完一起去吃烧烤', '{friend}只回了一个字：好。你们谁都没提考试。', { self: -1, emo: 1 }),
      o('d', '早早关灯睡觉', '你睡了一个很长的觉，第二天醒得比闹钟还早，窗外天刚亮。', { rule: -1, time: 1 }),
    ],
  },
  {
    id: 'college', hour: 15, ages: [19, 20], stage: 1, place: 'station', prop: 'suitcase',
    gesture: { kind: 'swipe', label: '向上滑，拆开那个厚厚的信封' },
    text: '录取通知书寄到了，信封比想象中厚。一所学校在{far}，一所就在{home}本地。{carer}什么也没说，只是把你小时候的照片翻出来看了一遍又一遍。你——',
    options: [
      o('a', '去{far}，想看看外面的世界', '出发那天，{carer}往你的箱子里塞了一罐{ta}做的辣酱，站在站台上一直挥手。', { risk: 1, self: 1 }, { set: ['left'] }),
      o('b', '留在{home}，周末还能回家吃饭', '每个周末回家，巷口的早餐摊都还在老地方，王叔会多给你一个茶叶蛋。', { risk: -1, self: -1 }, { set: ['stayed'] }),
      o('c', '选专业更好的那一所，在{far}', '你在{far}的图书馆里泡掉了整整四年，靠窗那个位置几乎成了你的。', { time: 1, act: -1 }, { set: ['left'] }),
      o('d', '和{friend}商量好，一起去{far}', '你们在同一座城市的两所学校，周末一起吃遍了大街小巷，谁也没想家。', { self: -1, emo: 1 }, { if: 'close', set: ['left'] }),
    ],
  },
  {
    id: 'firstjob', hour: 16, ages: [21, 22], stage: 1, place: 'office', prop: 'laptop',
    text: '毕业季，你投了四十多份简历。最后剩下两条路：一份稳定的工作，工资不高但有五险一金；一个学长拉你去创业，工资减半，说"做成了大家一起分"。你——',
    options: [
      o('a', '选稳定的工作', '你很快摸清了节奏，第一个月工资到账，给{carer}买了一件新棉袄。', { risk: -1, time: 1 }),
      o('b', '跟学长去创业', '第一年很苦，你睡过公司的沙发，一个人学会了五个岗位的活。', { risk: 1, act: 1 }, { set: ['startup'] }),
      o('c', '先出去走一个月，回来再定', '你在路上想明白了：先找份工作，把日子过稳。回来那天，你瘦了五斤。', { time: -1, emo: 1 }),
      o('d', '去帮王叔，把早餐摊做到网上', '王叔的早餐第一次有了外卖，门口排队的人多了一倍。王叔说你是他的"大学生军师"。', { rule: 1, self: -1 }, { if: 'stayed', set: ['stall'] }),
      o('e', '上班之余，把{hobby}做成一个小副业', '第一个月只赚了三百块，你却比拿工资还开心。', { risk: 1, time: 1 }, { if: '!stayed' }),
    ],
  },
  {
    id: 'crossroad', hour: 17, ages: [23, 24], stage: 1, place: 'city', prop: 'ticket',
    text: [
      ['left', '在{far}的第三年，房租又涨了，地铁要坐一个小时。这时，{home}的一家公司向你发来了邀请。下班的地铁上，你——'],
      [null, '{friend}从{far}打来电话，说那边机会多、工资高，问你要不要过去。电话那头很吵，听得出 TA 很忙。你——'],
    ],
    options: [
      o('a', '回{home}去', '回家的第一个早上，你在王叔的摊子上吃了一碗热馄饨，眼眶有点发热。', { risk: -1, self: -1 }, { if: 'left', set: ['back'] }),
      o('b', '留在{far}，这里已经有了自己的生活', '你在{far}有了常去的面馆，老板记得你不要香菜。', { self: 1, time: 1 }, { if: 'left' }),
      o('c', '去一座从没去过的新城市看看', '你又一次拖着箱子上了火车，这一次，一点都不怕。', { risk: 1, rule: 1 }, { if: 'left' }),
      o('d', '先打个电话，问问{carer}', '{carer}在电话里说：哪里吃得香、睡得着，哪里就是家。', { self: -1, act: -1 }, { if: 'left' }),
      o('e', '收拾行李，去{far}', '临走前，王叔塞给你一袋包子，说路上吃。{carer}送到巷口，就不肯再往前送了。', { risk: 1, self: 1 }, { if: '!left', set: ['left'] }),
      o('f', '留在{home}，这里有你熟悉的一切', '你在{home}换了一份更喜欢的工作，下班还能赶上{carer}做的晚饭。', { risk: -1, time: 1 }, { if: '!left' }),
      o('g', '先请几天假，过去看看再说', '你在{far}待了一周，看了{friend}住的地方，回来的时候，心里有了答案。', { act: -1, time: 1 }, { if: '!left' }),
      o('h', '劝{friend}回{home}来', '{friend}在电话那头笑你恋家，说会考虑考虑。', { self: -1, emo: 1 }, { if: '!left' }),
    ],
  },

  // ---------------- 而立 · 傍晚 ----------------
  {
    id: 'firsthome', hour: 18, ages: [25, 27], stage: 2, place: 'home', prop: 'key',
    gesture: { kind: 'hold', label: '按住，转动钥匙' },
    text: '你在{city}租下了第一间只属于自己的小屋。房租占掉了三分之一的工资，屋子小得转不开身，但窗外能看到一大片晚霞。拿到钥匙的那个傍晚，你——',
    options: [
      o('a', '花一个周末，把它布置成家', '小台灯、旧地毯、一盆绿萝。你很喜欢下班推开门、灯亮起来的那一刻。', { time: 1, act: 1 }),
      o('b', '翻开那个小本子，做了第一碗番茄鸡蛋面', '味道差了一点，但热气一上来，屋子就有了家的样子。你拍了张照片发给{carer}。', { emo: 1, rule: -1 }, { if: 'recipe' }),
      o('c', '去楼下面馆端回一碗面，坐在窗边吃', '面馆老板记住了你，后来总给你多卧一个蛋。', { time: -1, self: -1 }, { if: '!recipe' }),
      o('d', '先凑合住，把钱留着去看更大的世界', '那一年，你去了三个没去过的地方，回来时行李箱里塞满了明信片。', { risk: 1, time: -1 }),
      o('e', '叫上几个同事来家里吃火锅', '六个人挤在小桌边，锅一开，窗户上全是雾气，楼下的邻居都闻到了香味。', { self: -1, emo: 1 }),
    ],
  },
  {
    id: 'sixyears', hour: 19, ages: [28, 30], stage: 2, place: 'office', prop: 'signpost',
    text: [
      ['startup', '创业第五年，公司撑过了最难的时候，账上终于有了盈余。可你已经很久没有好好吃一顿饭，体检单你都没敢细看。你——'],
      [null, '工作第六年，公司开始裁员。你的名字不在名单上，但你旁边的工位空了。你做到了不错的位置，却开始觉得日子在重复。你——'],
    ],
    options: [
      o('a', '继续往前冲，再拼一年', '公司又长大了一圈。你学会了在凌晨两点吃泡面，也不觉得苦。', { risk: 1, act: 1 }, { if: 'startup' }),
      o('b', '把公司交给合伙人，休息一阵', '你回了一趟{home}，在{carer}家睡了三天三夜，醒来就有饭吃。', { self: -1, risk: -1 }, { if: 'startup' }),
      o('c', '多招几个人，把担子分出去', '新来的同事很能干。你第一次准时下了班，站在公司楼下，不知道该去哪儿。', { rule: -1, self: -1 }, { if: 'startup' }),
      o('d', '给自己定一条规矩：每天好好吃午饭', '就这一条，你坚持了下来，气色好了很多，团队也跟着你一起吃午饭。', { time: 1, rule: -1 }, { if: 'startup' }),
      o('e', '辞职，换个方向从头学起', '前半年很狼狈，存款一天天变少。后来你发现，自己又在长了。', { risk: 1, rule: 1 }, { if: '!startup' }),
      o('f', '往深处走，把手上这件事做到最好', '你成了别人口中"找你准没错"的那个人，裁员的名单再也轮不到你。', { time: 1, risk: -1 }, { if: '!startup' }),
      o('g', '把{hobby}重新捡起来，下班以后做', '你在一个个晚上，找回了那个小时候的自己。', { emo: 1, time: -1 }, { if: '!startup' }),
      o('h', '主动申请调去一个新部门', '新部门一切从零开始，你反而觉得每天都有盼头。', { act: 1, self: 1 }, { if: '!startup' }),
    ],
  },
  {
    id: 'oldfriend', hour: 20, ages: [31, 33], stage: 2, place: 'city', prop: 'phone',
    text: [
      ['close', '深夜，{friend}突然打来电话，声音有点哑："我想把工作辞了，换个活法。你觉得我疯了吗？"你听见那头有风声，TA 好像在天台上。你——'],
      [null, '一个周末，你在街上遇见了多年没联系的{friend}。TA 在路边支了一个小摊，卖自己做的东西。你们隔着人群，同时认出了对方。你——'],
    ],
    options: [
      o('a', '二话不说，支持 TA', '{friend}在电话那头笑了：就知道你会这么说。', { emo: 1, risk: 1 }, { if: 'close' }),
      o('b', '陪 TA 一起，把利弊列在纸上', '你们在电话里列了两页纸，最后是{friend}自己做的决定。', { act: -1, time: 1 }, { if: 'close' }),
      o('c', '劝 TA 先稳一稳，存点钱再说', '{friend}听进去了，半年后才动身，走得很稳。', { risk: -1, rule: -1 }, { if: 'close' }),
      o('d', '第二天请了假，坐车去见 TA', '你们在{friend}家楼下的小馆子，从中午一直聊到天黑，谁也没看手机。', { act: 1, self: -1 }, { if: 'close' }),
      o('e', '坐下来，和 TA 聊了一下午', '聊起巷口的早餐摊，你们才发现，彼此都还记得那场雨。', { self: -1, emo: 1 }, { if: '!close', set: ['close'] }),
      o('f', '买了 TA 摊上的东西，留了联系方式', '那天晚上，{friend}给你发来一句：常联系。', { act: 1, rule: -1 }, { if: '!close', set: ['close'] }),
      o('g', '点点头，各自走开', '走出很远，你回头看了一眼，那个小摊亮着一盏暖黄的灯。', { emo: -1, self: 1 }, { if: '!close' }),
      o('h', '第二天，又特意去了一次', '{friend}看见你，笑了：我就猜你会再来。', { risk: 1, emo: 1 }, { if: '!close', set: ['close'] }),
    ],
  },
  {
    id: 'newyear', hour: 21, ages: [34, 36], stage: 2, place: 'home', prop: 'lantern',
    gesture: { kind: 'tap', label: '点一下，点亮门口的灯笼' },
    write: { key: 'carer', prompt: '如果现在能对{carer}说一句话，你会说什么？', placeholder: '这些年，谢谢你。' },
    text: [
      ['parent&left&!back', '过年回到{home}。{carer}的头发已经全白了，背也有点驼。年夜饭桌上，{ta}夹了一块鱼放进你碗里，问你这些年过得好不好。你——'],
      ['parent', '过年，一大家子挤在家里吃年夜饭。{carer}的头发已经全白了，背也有点驼。{ta}夹了一块鱼放进你碗里，问你这些年过得好不好。你——'],
      ['left&!back', '过年回到{home}。爸妈的鬓角白了，{carer}的头发已经全白，走路要扶着墙。年夜饭桌上，{ta}夹了一块鱼放进你碗里，问你这些年过得好不好。你——'],
      [null, '过年，一大家子挤在{carer}家吃年夜饭。爸妈的鬓角白了，{carer}的头发已经全白，走路要扶着墙。{ta}夹了一块鱼放进你碗里，问你这些年过得好不好。你——'],
    ],
    options: [
      o('a', '把这些年的事，一件件讲给{ta}听', '好的坏的你都讲了。{carer}听得很认真，最后只说了一句：你长大了。', { emo: 1, self: -1 }),
      o('b', '只说好的，难处一个字都没提', '{carer}没多问，只是又往你碗里夹了一块最大的鱼。', { emo: -1, rule: -1 }),
      o('c', '拉着{carer}一起包饺子，有些话不用说也懂', '你包的饺子破了一半，{carer}笑得很开心，说跟你小时候包的一模一样。', { act: 1, emo: -1 }),
      o('d', '提议明年春天，带{carer}出去走走', '{carer}嘴上说麻烦，第二天就开始翻衣柜找衣服。', { time: 1, risk: 1 }, { set: ['trip'] }),
    ],
  },
  {
    id: 'latenight', hour: 22, ages: [37, 39], stage: 2, place: 'street', prop: 'cup',
    text: '又加班到十点。写字楼的灯一盏盏灭了，楼下便利店还亮着。手机里，家人群在热闹地聊：{carer}学会了用视频通话，正在挨个打给大家。你——',
    options: [
      o('a', '买一份关东煮，坐在窗边慢慢吃', '热气扑在脸上，你看着街上的车灯，觉得这一天总算结束了。', { time: -1, emo: -1 }),
      o('b', '给{carer}回一个视频电话', '{carer}把镜头对着自己的鼻子，喊了半天你听不听得见。你笑出了声。', { self: -1, emo: 1 }),
      o('c', '回家把明天要做的事列成清单', '第二天，你按着清单一件件划掉，心里很踏实。', { time: 1, rule: -1 }),
      o('d', '和便利店的店员聊了几句', '店员是个刚来城市的年轻人，说你常来，下次给你留最后一个饭团。', { self: -1, risk: 1 }),
    ],
  },
  {
    id: 'forty', hour: 23, ages: [40, 42], stage: 2, place: 'home', prop: 'hobby',
    text: '四十岁生日那天，没有人特意张罗。傍晚，{friend}敲门进来，送了你一样礼物：{thing}。TA 说："你小时候最喜欢{hobby}，后来好像就忘了。"你——',
    options: [
      o('a', '当晚就用了起来', '你玩到半夜，手生了很多，心却像回到了小时候。', { act: 1, risk: 1 }),
      o('b', '好好收起来，说等闲下来再用', '它在柜子里放得整整齐齐，你偶尔会拿出来看看。', { time: 1, act: -1 }),
      o('c', '约{friend}每周一起玩一次', '每周六下午，成了你们雷打不动的时间。', { self: -1, rule: -1 }),
      o('d', '用它做了一份回礼，送给{friend}', '{friend}收到时愣了半天，说这是今年最好的礼物。', { emo: 1, self: -1 }),
    ],
  },

  // ---------------- 中年 · 深夜 ----------------
  {
    id: 'stall', hour: 0, ages: [43, 47], stage: 3, place: 'market', prop: 'bowl',
    text: [
      ['left&!back', '家里人发来消息：巷口王叔的早餐摊要收了。王叔七十多岁了，凌晨三点起不来了，他想把摊子交给一个愿意接手的人。你——'],
      [null, '巷口王叔的早餐摊要收了。王叔七十多岁了，凌晨三点起不来了，他想把摊子交给一个愿意接手的人。你——'],
    ],
    options: [
      o('a', '帮王叔找一个想接手的年轻人', '接手的是个爱笑的年轻人，招牌没换，豆浆还是原来的味道。王叔每天还去摊子边坐坐。', { self: -1, act: 1 }),
      o('b', '赶回去吃最后一碗馄饨，拍下那块旧招牌', '王叔说：你小时候喝豆浆要加两勺糖，我都记得。', { emo: 1, time: -1 }),
      o('c', '把王叔的故事写下来，发给老街坊们', '很多人在下面留言，说起了自己小时候的那碗豆浆。', { emo: 1, rule: 1 }),
      o('d', '自己接下这个摊子，周末去帮忙', '你周末四点起床和面，忙得脚不沾地，却笑得最多。', { risk: 1, act: 1 }, { if: 'stall' }),
      o('e', '什么都没做，只是心里有点空', '那天早上，你在路上买了一个包子，却没吃出以前的味道。', { emo: -1, act: -1 }, { if: '!stall' }),
    ],
  },
  {
    id: 'mentor', hour: 1, ages: [48, 52], stage: 3, place: 'office', prop: 'cup',
    text: '公司来了一个年轻人，跟你刚工作时很像：拼命、要强、不爱求助。TA 搞砸了一个重要的项目，一个人躲在楼梯间，眼睛红红的。你——',
    options: [
      o('a', '走过去，讲了你当年搞砸的那件事', 'TA 听完笑出了声，眼睛却还是红的。', { emo: 1, self: -1 }),
      o('b', '留一张便条：明天一起复盘', '第二天的复盘只用了二十分钟，TA 记了满满一页。', { time: 1, rule: -1 }),
      o('c', '不去打扰，让 TA 自己缓一缓', '一个小时后，TA 回到工位，把事情一件件处理完了。', { self: 1, emo: -1 }),
      o('d', '带 TA 下楼吃一碗热汤面', '一碗面下肚，TA 说：好像也没那么糟。', { act: 1, emo: 1 }),
    ],
  },
  {
    id: 'grandma', hour: 2, ages: [53, 57], stage: 3, place: 'kitchen', prop: 'bowl',
    text: [
      ['nick', '{carer}很老了。很多事记不清了，有时叫错你的名字，可一开口，喊的还是你的小名：“{nick}”。{ta}还记得你小时候爱吃的那碗面，记得窗边那串风铃。你——'],
      [null, '{carer}很老了。很多事记不清了，有时叫错你的名字，却还记得你小时候爱吃的那碗面，记得窗边那串风铃。你——'],
    ],
    options: [
      o('a', '翻开那个小本子，照着做给{ta}吃', '{carer}吃了一口，慢慢点头：嗯，是这个味道。', { emo: 1, rule: -1 }, { if: 'recipe' }),
      o('b', '请{carer}再教你一次', '{ta}站在灶台边，一步一步慢慢地说。这一次，你全记下来了。', { time: 1, rule: -1 }, { if: '!recipe', set: ['recipe'] }),
      o('c', '搬回去，陪{ta}住一段日子', '每天傍晚，你们坐在窗边，听风铃叮当响，谁也不说话。', { self: -1, time: -1 }),
      o('d', '把{ta}讲的老故事一段段录下来', '你录了二十多段，最喜欢{ta}讲年轻时第一次进城的那段。', { time: 1, act: 1 }),
      o(
        'e',
        [['trip', '兑现那年过年的约定，带{ta}去看年轻时住过的地方'], [null, '带{ta}去看看年轻时住过的地方']],
        '{carer}站在老房子前看了很久，说：样子变了，树还在。',
        { risk: 1, emo: 1 },
      ),
    ],
  },
  {
    id: 'retire', hour: 3, ages: [58, 62], stage: 3, place: 'park', prop: 'plant',
    text: '你从工作里退了下来。第一个星期一早上，闹钟照常响了，你却不用出门。日子一下子空出了一大块。你——',
    options: [
      o('a', '去一个年轻时一直想去的地方', '你在陌生的小镇住了一个月，每天都去同一家早餐店。', { risk: 1, time: -1 }),
      o('b', '报一个{hobby}班，从头学起', '你成了班上年纪最大、笔记最认真的那一个。', { time: 1, act: 1 }),
      o('c', '在巷子里开一家小面馆，用{carer}的方子', '小面馆只有六张桌子，番茄鸡蛋面卖得最好，墙上挂着那串旧风铃。', { rule: 1, self: 1 }, { if: 'recipe' }),
      o('d', '在小区里帮大家修修补补', '邻居们都知道，有什么坏了，就去找你。', { self: -1, act: 1 }, { if: '!recipe' }),
      o('e', '每天早上去公园，和老朋友们一起走走', '你们走得很慢，聊的还是年轻时候的事。', { self: -1, emo: 1 }),
    ],
  },

  // ---------------- 晚年 · 破晓 ----------------
  {
    id: 'again', hour: 4, ages: [63, 75], stage: 4, place: 'park', prop: 'letter',
    text: '清晨的公园，一个年轻人坐到你旁边的长椅上，看起来很迷茫。聊了几句，TA 突然问你："如果人生能重来一次，你会换一条路吗？"你——',
    options: [
      o('a', '说：会，我想试试另一条', 'TA 眼睛一亮，说想听听那条路是什么样子。', { risk: 1, emo: 1 }),
      o('b', '说：不会，每一步都算数', 'TA 点点头，好像明白了点什么。', { risk: -1, emo: -1 }),
      o('c', '笑着说：你先走你的，走完再来告诉我', 'TA 愣了一下，然后也笑了。', { self: 1, time: 1 }),
      o('d', '讲起了巷口那个早餐摊的故事', '你讲了很久，TA 说明天一早也想去尝尝。', { emo: 1, rule: -1 }),
    ],
  },
  {
    id: 'dawn', hour: 5, ages: [76, 88], stage: 4, place: 'home', prop: 'notebook',
    write: { key: 'dawn', prompt: '写一句话，给很多年前那个站在雨里的孩子', placeholder: '慢慢来，别怕。' },
    text: [
      ['recipe', '天快亮了。你翻开那个用了一辈子的小本子，第一页是{carer}的番茄鸡蛋面，最后一页还空着。窗外，巷口传来早餐摊开张的声音，风铃轻轻响了一下。你——'],
      [null, '天快亮了。你翻开那本写了一辈子的日记，最后一页还空着。窗外，巷口传来早餐摊开张的声音，风铃轻轻响了一下。你——'],
    ],
    options: [
      o('a', '写下一句给年轻时自己的话', '你写了很久，最后只留下五个字：慢慢来，别怕。', { emo: 1, time: 1 }),
      o('b', '留着这页空白，等天亮再写', '光一点点爬上桌子，像很多年前的那个早晨。', { emo: -1, time: -1 }),
      o('c', '下楼去买一碗热豆浆', '摊子的新主人认出了你，多给你加了一勺糖。', { act: 1, risk: 1 }),
      o('d', '给{friend}打个电话："起来没？去吃早饭。"', '电话那头传来{friend}的声音：早就起了，就等你。', { self: -1, emo: 1 }),
    ],
  },
];

export const TOTAL_CHOICES = BEATS.length;

/* ---------------- 剧情状态与文案解析 ---------------- */

export interface StoryContext {
  friend: string;
  home: string;
  far: string;
  /** 小时候主要带大你的人 */
  carer: Carer;
  /** 家里人怎么叫你(小名),没填为空 */
  nick: string;
}

export const CARERS = ['外婆', '奶奶', '外公', '爷爷', '妈妈', '爸爸'] as const;
export type Carer = (typeof CARERS)[number];
const CARER_TA: Record<Carer, string> = { 外婆: '她', 奶奶: '她', 外公: '他', 爷爷: '他', 妈妈: '她', 爸爸: '他' };

/** 每局开始时就有的剧情标记(比如是爸妈自己带大的) */
export function initialFlags(ctx: StoryContext): Set<string> {
  const flags = new Set<string>();
  if (ctx.carer === '妈妈' || ctx.carer === '爸爸') flags.add('parent');
  if (ctx.nick) flags.add('nick');
  return flags;
}

const FRIEND_NAMES = ['小满', '阿远', '乐乐', '阿禾', '小舟', '安安', '阿树', '米粒'];
const FAR_CITIES = ['海边那座城', '北方那座大城', '南方那座老城', '西边那座山城'];

export interface WhoYouAre {
  carer: Carer;
  /** 玩家填的最好朋友的名字,没填就按种子挑一个 */
  friend?: string;
  nick?: string;
}

/** 朋友的名字和远方的城市按种子固定;家乡用玩家填的出生地,没填就是"小城"。 */
export function storyContext(seed: number, placeName: string | null, who: WhoYouAre = { carer: '外婆' }): StoryContext {
  const r = rng(seed ^ 0x5eed);
  const picked = FRIEND_NAMES[Math.floor(r() * FRIEND_NAMES.length)];
  return {
    friend: who.friend || picked,
    far: FAR_CITIES[Math.floor(r() * FAR_CITIES.length)],
    home: placeName ? placeName.replace(/(市|区|县|自治州|地区|盟)$/, '') : '小城',
    carer: who.carer,
    nick: who.nick ?? '',
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

export function fill(line: Line, ctx: StoryContext, flags: ReadonlySet<string>): string {
  const text = typeof line === 'string' ? line : (line.find(([c]) => matches(c, flags)) ?? line[line.length - 1])[1];
  const hobby = HOBBIES[hobbyOf(flags)];
  const city = flags.has('left') && !flags.has('back') ? ctx.far : ctx.home;
  return text
    .replaceAll('{nick}', ctx.nick)
    .replaceAll('{carer}', ctx.carer)
    .replaceAll('{ta}', CARER_TA[ctx.carer])
    .replaceAll('{friend}', ctx.friend)
    .replaceAll('{home}', ctx.home)
    .replaceAll('{far}', ctx.far)
    .replaceAll('{city}', city)
    .replaceAll('{hobby}', hobby.name)
    .replaceAll('{thing}', hobby.thing);
}

export interface ResolvedOption {
  key: string;
  text: string;
  result: string;
  effects: Effects;
  set: string[];
}

export interface ResolvedBeat {
  beat: Beat;
  index: number;
  text: string;
  gesture: (Gesture & { label: string }) | null;
  write: { key: WriteKey; prompt: string; placeholder: string } | null;
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
    gesture: beat.gesture ? { ...beat.gesture, label: fill(beat.gesture.label, ctx, flags) } : null,
    write: beat.write ? { ...beat.write, prompt: fill(beat.write.prompt, ctx, flags) } : null,
    scene: { place: beat.place, prop: beat.prop === 'hobby' ? HOBBIES[hobbyOf(flags)].prop : beat.prop, rain: beat.rain },
    options: beat.options
      .filter(opt => matches(opt.if, flags))
      .map(opt => ({ key: opt.key, text: fill(opt.text, ctx, flags), result: fill(opt.result, ctx, flags), effects: opt.effects, set: opt.set ?? [] })),
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

export interface StoryStep {
  resolved: ResolvedBeat;
  option: ResolvedOption;
}

/**
 * 按存档里的选项编号重走一遍剧情。前端恢复存档、服务器生成深度解析都用它,
 * 保证两边看到的是同一个故事。遇到无效编号就停在那里。
 */
export function replayStory(ctx: StoryContext, picks: readonly string[]): { steps: StoryStep[]; flags: Set<string> } {
  const flags = initialFlags(ctx);
  const steps: StoryStep[] = [];
  for (const key of picks) {
    if (steps.length >= TOTAL_CHOICES) break;
    const resolved = resolveBeat(steps.length, ctx, flags);
    const option = resolved.options.find(x => x.key === key);
    if (!option) break;
    option.set.forEach(f => flags.add(f));
    steps.push({ resolved, option });
  }
  return { steps, flags };
}

/** 现实中的年纪落在这本书的第几幕(超过最后一幕时返回最后一幕) */
export function beatIndexForAge(age: number): number {
  const i = BEATS.findIndex(b => age <= b.ages[1]);
  return i === -1 ? BEATS.length - 1 : i;
}

/* ---------------- 回忆 / 此刻 / 设想 ---------------- */

export type TimeKind = 'past' | 'now' | 'future';

/** 按玩家现实中的年龄,这一页是已经过去的回忆、正在经历的此刻,还是还没发生的设想 */
export function timeKind(ages: readonly [number, number], age: number): TimeKind {
  if (ages[1] < age) return 'past';
  if (ages[0] > age) return 'future';
  return 'now';
}

/** 这一页对应的真实年份,最后一页是"起" */
export function yearLabel(birthYear: number, ages: readonly [number, number], last = false): string {
  const a = birthYear + ages[0];
  const b = birthYear + ages[1];
  if (last) return `${a} 年起`;
  return a === b ? `${a} 年` : `${a}—${b} 年`;
}

export const TIME_LABEL: Record<TimeKind, string> = { past: '回忆', now: '此刻', future: '设想' };

/** 选项前面的一句提示:回忆里选"当时的你",设想里选"想要的你",这样同一份选择两种含义都读得通 */
export const PICK_HINT: Record<TimeKind, string> = {
  past: '回想那几年，选一个和当时的你更接近的。',
  now: '这一页就是现在，选一个此刻的你。',
  future: '这一页还没有发生。选一个你希望自己会成为的。',
};
