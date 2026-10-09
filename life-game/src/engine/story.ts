// 人生 24 小时:把一生放进一天。清晨 06:00 出生，走到第二天 05:00 天快亮。
// 每个整点是一个人生场景，每个场景准备两个版本，按出生参数抽一个；每一步怎么走由玩家自己选。
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

export type PlaceId = 'home' | 'school' | 'park' | 'street' | 'city' | 'station' | 'office' | 'mountain';
export type PropId =
  | 'chime' | 'heart' | 'kite' | 'plane' | 'umbrella' | 'lantern' | 'flag' | 'bicycle' | 'piggy' | 'book'
  | 'letter' | 'pencil' | 'phone' | 'signpost' | 'notebook' | 'lamp' | 'suitcase' | 'laptop' | 'ticket' | 'cup'
  | 'key' | 'document' | 'box' | 'cake' | 'guitar' | 'star' | 'plant' | 'camera';

export interface Scene {
  place: PlaceId;
  prop: PropId;
  rain?: boolean;
}

export interface Option {
  text: string;
  result: string;
  effects: Effects;
}

export interface GameEvent {
  id: string;
  tag: Element;
  scene: Scene;
  text: string;
  options: Option[];
}

export interface Stage {
  name: string;
  codeName: string;
}

export const STAGES: readonly Stage[] = [
  { name: '童年', codeName: '开机' },
  { name: '青春', codeName: '编译' },
  { name: '而立', codeName: '上线运行' },
  { name: '中年', codeName: '迭代' },
  { name: '晚年', codeName: '存档' },
];

export interface Slot {
  /** 钟点 0–23 */
  hour: number;
  ages: [number, number];
  agesLabel: string;
  stage: number;
  variants: [GameEvent, GameEvent];
}

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

/** 钟点对应的时辰，如 6 → "卯时" */
export function shichen(hour: number): string {
  return BRANCHES[Math.floor(((hour + 1) % 24) / 2)] + '时';
}

export function clockLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

type SlotSpec = [hour: number, ages: [number, number], stage: number, a: GameEvent, b: GameEvent];

const ev = (id: string, tag: Element, scene: Scene, text: string, options: Option[]): GameEvent => ({ id, tag, scene, text, options });
const op = (text: string, result: string, effects: Effects): Option => ({ text, result, effects });

const SPECS: SlotSpec[] = [
  // ---------------- 童年 ----------------
  [6, [0, 2], 0,
    ev('chime', '金', { place: 'home', prop: 'chime' }, '天刚亮，床头的风铃被风吹得叮当响，一道光从窗帘缝里照进来。你——', [
      op('伸手去够那串风铃', '风铃叮当乱响，你咯咯笑出了声。', { act: 1, risk: 1 }),
      op('安静地盯着光斑看', '光从墙上一点点挪过去，你看得入了迷。', { act: -1, emo: -1 }),
    ]),
    ev('visitors', '火', { place: 'home', prop: 'heart' }, '家里来了很多人，围着你看个不停。有人张开手，想抱抱你。你——', [
      op('张开小手，让他抱', '你被举得高高的，满屋子的人都笑了。', { self: -1, emo: 1 }),
      op('把头埋进熟悉的怀里', '你只认那个熟悉的味道，谁哄也不撒手。', { self: 1, emo: -1 }),
    ])],
  [7, [3, 4], 0,
    ev('kite', '木', { place: 'park', prop: 'kite' }, '公园的草地上，有个孩子在放风筝，线被风扯得笔直。你——', [
      op('跑过去问能不能让你拉一下', '他把线递给你，风筝在你手里抖了抖，又稳稳飞高。', { act: 1, self: -1 }),
      op('捡根树枝，在地上画一只风筝', '你画的风筝有三条尾巴，比天上那只还长。', { self: 1, act: -1 }),
    ]),
    ev('crane', '木', { place: 'school', prop: 'plane' }, '幼儿园手工课，老师让大家照着样子折纸鹤。你折到一半——', [
      op('照着步骤一步一步折完', '你的纸鹤翅膀对得整整齐齐，被放在展示架第一排。', { rule: -1, act: -1 }),
      op('觉得不好玩，改折一架纸飞机', '纸飞机飞出了窗外，全班都跑去看。老师没生气，只是笑了。', { rule: 1, risk: 1 }),
    ])],
  [8, [5, 6], 0,
    ev('rain', '水', { place: 'street', prop: 'umbrella', rain: true }, '下雨了，楼道口站着一个新搬来的孩子，浑身湿漉漉的，没人和他玩。你——', [
      op('走过去，把伞分他一半', '那天之后，你多了一个形影不离的朋友。', { self: -1, emo: 1 }),
      op('远远看着，回家把他画进本子', '你发现自己很喜欢观察别人，画了整整一本。', { self: 1, act: -1 }),
    ]),
    ev('newyear', '火', { place: 'home', prop: 'lantern' }, '过年了，门口挂着红灯笼，一屋子亲戚起哄让你表演个节目。你——', [
      op('站上板凳，大声背了一首诗', '掌声和红包一起到来，你第一次尝到被看见的滋味。', { emo: 1, act: 1 }),
      op('躲进房间，说什么也不出来', '你在门后听完了整场热闹，觉得这样也挺好。', { emo: -1, self: 1 }),
    ])],
  [9, [7, 8], 0,
    ev('monitor', '金', { place: 'school', prop: 'flag' }, '班里选班干部，同桌一直怂恿你去竞选。你——', [
      op('自己上台，竞选纪律委员', '你当选了，也第一次体会到"管人"有多难。', { act: 1, rule: -1 }),
      op('推荐同桌去，你帮他写稿', '同桌当选了，你成了班里最可靠的幕后军师。', { self: -1, act: -1 }),
    ]),
    ev('bike', '木', { place: 'street', prop: 'bicycle' }, '第一次骑没有辅助轮的自行车，后面扶着的那只手悄悄松开了。你发现了——', [
      op('咬着牙继续往前骑', '你歪歪扭扭骑出了二十米，回头的时候笑得很大声。', { risk: 1, act: 1 }),
      op('马上停下来，要求再扶一圈', '你稳稳停住，又练了三圈才放心松手。', { risk: -1, act: -1 }),
    ])],
  [10, [9, 10], 0,
    ev('pocket', '土', { place: 'home', prop: 'piggy' }, '暑假，你攒下了一笔零花钱，存钱罐沉甸甸的。你——', [
      op('继续存着，等攒够了买个大的', '年底，你抱回了那套一直想要的书。', { time: 1, risk: -1 }),
      op('当天就去买了想要的游戏卡', '那个夏天你玩得很尽兴，一点都不后悔。', { time: -1, act: 1 }),
      op('买材料做手工，卖给同学', '你赚回了本钱，还多出几块，第一次觉得自己像个老板。', { risk: 1, rule: 1 }),
    ]),
    ev('exam', '木', { place: 'school', prop: 'book' }, '考试前一天，你发现有一整章完全没看。你——', [
      op('拼一把，把这一章啃完', '第二天有点困，但最后那道大题你写出来了。', { act: 1, risk: 1 }),
      op('放掉这一章，把会的再巩固一遍', '你稳稳拿到了会的那部分分数。', { risk: -1, act: -1 }),
    ])],
  [11, [11, 12], 0,
    ev('note', '水', { place: 'school', prop: 'letter' }, '课桌里多了一张没署名的纸条：「放学后，操场边的大树下见。」你——', [
      op('放学后去树下看看是谁', '原来是隔壁班的同学，想请你一起办黑板报。', { risk: 1, act: 1 }),
      op('把纸条交给老师', '老师笑着说，可能是有人想交朋友，下次可以自己去看看。', { rule: -1, risk: -1 }),
    ]),
    ev('homework', '土', { place: 'home', prop: 'pencil' }, '暑假的最后一天，作业还剩一半没写。你——', [
      op('关上门，一口气写完', '写完最后一个字的时候，你觉得自己像个英雄。', { act: 1, self: 1 }),
      op('先和朋友玩完最后一场，明天早起补', '那场球踢得很痛快，第二天你五点就爬了起来。', { time: -1, emo: 1 }),
      op('约同学一起来家里赶作业', '三个人互相抄错了同一道题，笑了整整一个下午。', { self: -1, rule: 1 }),
    ])],

  // ---------------- 青春 ----------------
  [12, [13, 14], 1,
    ev('deskmate', '金', { place: 'school', prop: 'pencil' }, '新学期换了座位，同桌是一个很少说话的人。你——', [
      op('主动问他借一块橡皮', '一块橡皮，开始了一段三年的友谊。', { emo: 1, self: -1 }),
      op('各做各的，互不打扰', '你们井水不犯河水，期末却考了同一个分数。', { self: 1, emo: -1 }),
    ]),
    ev('firstphone', '水', { place: 'home', prop: 'phone' }, '你有了第一部自己的手机，群里的聊天一刻也停不下来。你——', [
      op('一直聊到很晚', '第二天上课打了三个哈欠，但你多了好几个朋友。', { time: -1, emo: 1 }),
      op('定好时间，到点就关机', '你的作息表贴在床头，被同学叫作"人形时钟"。', { rule: -1, time: 1 }),
    ])],
  [13, [15, 16], 1,
    ev('subject', '火', { place: 'school', prop: 'signpost' }, '选科的时候，你喜欢的方向和家里希望的不一样。你——', [
      op('坚持自己的选择，和家里谈了三次', '他们最后同意了，只说了一句"以后别后悔"。', { self: 1, risk: 1 }),
      op('听家里的，把兴趣留到课外', '从那以后，你的周末都属于那件喜欢的事。', { self: -1, risk: -1 }),
    ]),
    ev('dream', '水', { place: 'home', prop: 'notebook' }, '你在日记本上写下了一个很大的梦想。你——', [
      op('拿给最好的朋友看', '朋友说"你肯定行"，这句话你记了很多年。', { emo: 1, self: -1 }),
      op('锁进抽屉，谁也不告诉', '它成了只属于你一个人的发动机。', { emo: -1, self: 1 }),
    ])],
  [14, [17, 18], 1,
    ev('nickname', '金', { place: 'school', prop: 'flag' }, '班里有人被起了难听的外号，大家都在笑。你——', [
      op('当场说一句"别这样"', '气氛僵了几秒，但后来没人再叫那个外号。', { rule: 1, emo: 1 }),
      op('下课后去找那个同学聊天', '你们成了朋友，他后来说，那天很谢谢你。', { self: -1, emo: -1 }),
    ]),
    ev('bigexam', '土', { place: 'school', prop: 'lamp' }, '大考前的最后一天，教室里只剩翻书的声音。你——', [
      op('把错题本再翻一遍', '翻到第三遍，心反而静了下来。', { rule: -1, act: -1 }),
      op('合上书，出去绕操场走一圈', '风吹过来，你突然觉得，考成什么样都能接住。', { act: 1, time: -1 }),
    ])],
  [15, [19, 20], 1,
    ev('arrive', '木', { place: 'station', prop: 'suitcase' }, '列车到站，新城市的风扑面而来，行李箱的轮子在站台上咔咔作响。你——', [
      op('先去吃一碗本地的面', '面很辣，你被呛出了眼泪，却觉得这座城市挺有意思。', { risk: 1, time: -1 }),
      op('先按地图把住处安顿好', '天黑之前，你的小床已经铺得整整齐齐。', { risk: -1, time: 1 }),
    ]),
    ev('clubs', '火', { place: 'school', prop: 'flag' }, '开学的社团招新，一排排摊位都在朝你招手。你——', [
      op('报了一个完全没接触过的社团', '第一次活动你什么都不会，却玩得最开心。', { risk: 1, rule: 1 }),
      op('只报了和专业相关的那一个', '一年后，你成了社团里最懂行的人。', { time: 1, risk: -1 }),
      op('被学长拉进了人最多的那个', '你认识了一大群人，通讯录一下子满了。', { self: -1, emo: 1 }),
    ])],
  [16, [21, 22], 1,
    ev('firstjob', '木', { place: 'office', prop: 'laptop' }, '毕业时摆着两条路：一份稳定的工作，和朋友拉你一起创业。你——', [
      op('选择稳定的工作', '你很快摸清了节奏，也攒下了第一笔属于自己的钱。', { risk: -1, time: 1 }),
      op('跟朋友去创业', '第一年很苦，但你一个人学会了五个岗位的活。', { risk: 1, act: 1 }),
    ]),
    ev('intern', '金', { place: 'office', prop: 'document' }, '第一次实习，主管把一个你完全不会的任务交给了你。你——', [
      op('先说"我试试"，下班后自学', '你熬了两个通宵，交出去的时候手都在抖，但它能用。', { act: 1, risk: 1 }),
      op('坦白说不会，请他指个方向', '主管愣了一下，然后把你介绍给了一位老同事。', { act: -1, self: -1 }),
    ])],
  [17, [23, 24], 1,
    ev('city', '火', { place: 'city', prop: 'ticket' }, '你有机会去另一座城市生活，车票就在手机里。你——', [
      op('拖着两个箱子出发', '新城市的第一顿饭，你在楼下吃了一碗陌生的面。', { risk: 1, self: 1 }),
      op('留在熟悉的城市，离家人近一点', '每个周末的家常饭，成了你的充电站。', { risk: -1, self: -1 }),
    ]),
    ev('farewell', '水', { place: 'city', prop: 'cup' }, '散伙饭吃到最后，有人提议以后每年都聚一次。你——', [
      op('第一个站起来说"我来组织"', '后来的很多年，大家都在等你发的那条群消息。', { act: 1, emo: 1 }),
      op('笑着举杯，把这一刻记在心里', '你把那晚的照片设成了屏保，换过很多次手机都没删。', { emo: -1, time: -1 }),
    ])],

  // ---------------- 而立 ----------------
  [18, [25, 27], 2,
    ev('process', '土', { place: 'office', prop: 'lamp' }, '工作中你发现一个流程特别低效。你——', [
      op('写了一份改进方案交上去', '方案被采纳了一半，领导记住了你的名字。', { rule: 1, act: 1 }),
      op('先按规矩做，把问题记在本子上', '一年后，你成了最懂这套流程的人。', { rule: -1, time: 1 }),
    ]),
    ev('rent', '土', { place: 'home', prop: 'key' }, '第一次一个人租房，房间很小，但窗外能看到一大片晚霞。你——', [
      op('花一个周末把它布置得像个家', '小台灯、旧地毯、一盆绿萝，你很喜欢下班回家的那一刻。', { time: 1, act: 1 }),
      op('先凑合住，把钱留着去看更大的世界', '那一年你去了三个没去过的地方。', { risk: 1, time: -1 }),
    ])],
  [19, [28, 30], 2,
    ev('plateau', '金', { place: 'office', prop: 'signpost' }, '你在一个领域做到了不错的位置，却开始觉得日子在重复。你——', [
      op('换个方向，从头学起', '前半年很狼狈，后来你发现自己又在长了。', { risk: 1, rule: 1 }),
      op('往深处走，把这件事做到顶尖', '你成了别人口中"找他准没错"的那个人。', { time: 1, risk: -1 }),
    ]),
    ev('sideproject', '火', { place: 'city', prop: 'laptop' }, '朋友邀你一起做一个小项目，每周要占掉两个晚上。你——', [
      op('答应下来，一起试试', '项目没赚到什么，却让你们成了最好的搭档。', { risk: 1, self: -1 }),
      op('婉拒，把晚上留给自己', '你用这些晚上读完了二十本书。', { self: 1, risk: -1 }),
    ])],
  [20, [31, 33], 2,
    ev('oldfriend', '水', { place: 'city', prop: 'phone' }, '一个很久没联系的老朋友，突然发来一句"在吗"。你——', [
      op('直接打电话过去', '你们聊了两个小时，好像从来没分开过。', { act: 1, emo: 1 }),
      op('先想想他为什么找你，再仔细回复', '你回得很周到，对方说你还是那么细心。', { act: -1, emo: -1 }),
    ]),
    ev('rejected', '金', { place: 'office', prop: 'document' }, '例会上，你的方案被当众否掉了。你——', [
      op('当场再争取一次', '会议室安静了几秒，有人开始认真看你的方案。', { emo: 1, rule: 1 }),
      op('会后单独找对方聊', '聊完才发现，他担心的是一个你没想到的问题。', { emo: -1, act: -1 }),
      op('回去改出一个更好的版本', '一周后，新版本被直接通过了。', { time: 1, self: 1 }),
    ])],
  [21, [34, 36], 2,
    ev('holiday', '火', { place: 'mountain', prop: 'camera' }, '你终于有了一段完整的假期。你——', [
      op('订一张机票，去没去过的地方', '你在陌生的街上迷了路，却笑得很开心。', { risk: 1, time: -1 }),
      op('在家补觉、做饭、收拾房间', '假期结束时，你觉得自己被"修好"了。', { risk: -1, emo: -1 }),
      op('报一个短期课程，学一样新东西', '假期结束，你多了一项新技能。', { time: 1, act: 1 }),
    ]),
    ev('oldbox', '土', { place: 'home', prop: 'box' }, '搬家的时候，你翻出一箱小时候的东西。你——', [
      op('一件件拍照留念，然后清掉大半', '照片存进了相册，箱子轻了一半，心里也轻了。', { act: 1, emo: -1 }),
      op('全部带走，一样都舍不得', '那只旧箱子，跟着你去了新家的柜子顶上。', { emo: 1, risk: -1 }),
    ])],
  [22, [37, 39], 2,
    ev('newtool', '木', { place: 'office', prop: 'laptop' }, '身边的年轻人都在用一种你完全不懂的新工具。你——', [
      op('报个课，从头学', '你成了组里第一个用它做出成果的"老人"。', { time: 1, act: 1 }),
      op('找个年轻同事请他教你', '他教得很认真，你们从此成了忘年交。', { self: -1, emo: 1 }),
      op('先观望，用熟悉的方式做好手上的事', '你的活依然干得又快又稳。', { risk: -1, rule: -1 }),
    ]),
    ev('latenight', '水', { place: 'street', prop: 'cup' }, '加完班，楼下的便利店还亮着灯。你——', [
      op('买一份关东煮，坐在窗边慢慢吃', '热气扑在脸上，你觉得这一天总算结束了。', { time: -1, emo: -1 }),
      op('给家里打个电话', '电话那头的声音，比关东煮还暖。', { self: -1, emo: 1 }),
    ])],
  [23, [40, 42], 2,
    ev('birthday', '火', { place: 'home', prop: 'cake' }, '四十岁生日，蛋糕上的蜡烛插得满满的。许愿的时候，你——', [
      op('许了一个十年后的愿望', '你把它写在纸上，夹进了常读的那本书里。', { time: 1, emo: -1 }),
      op('只许了"今年开心"', '蜡烛一口气吹灭，大家的欢呼声很响。', { time: -1, emo: 1 }),
    ]),
    ev('guitar', '木', { place: 'home', prop: 'guitar' }, '你在柜子深处看到一把落了灰的吉他。你——', [
      op('擦干净，重新练起来', '手指疼了一个月，然后你弹完了一整首歌。', { risk: 1, act: 1 }),
      op('送给了刚学琴的邻居孩子', '后来每到傍晚，楼道里都会传来生涩的琴声。', { self: -1, emo: 1 }),
    ])],

  // ---------------- 中年 ----------------
  [0, [43, 47], 3,
    ev('mentor', '土', { place: 'office', prop: 'book' }, '一个年轻人找到你，想请你带带他。你——', [
      op('答应下来，把踩过的坑都告诉他', '几年后，他在一次分享会上提到了你的名字。', { self: -1, emo: 1 }),
      op('给他推荐几本书，让他自己去闯', '他闯出了一条你都没想到的路。', { self: 1, act: -1 }),
    ]),
    ev('expand', '金', { place: 'city', prop: 'ticket' }, '公司要派人去一座新城市开拓业务。你——', [
      op('举手报名', '新城市的第一个夜晚，你站在空荡荡的办公室里，心跳得很快。', { risk: 1, act: 1 }),
      op('留下来，守住现在的团队', '团队越来越稳，大家都说有你在就踏实。', { risk: -1, rule: -1 }),
    ])],
  [1, [48, 52], 3,
    ev('summit', '木', { place: 'mountain', prop: 'star' }, '你开始在周末去爬山。山顶的风很大，星星离得很近。你——', [
      op('拍一张照片，发给老朋友', '朋友回了一句"下次带上我"。', { emo: 1, self: -1 }),
      op('关掉手机，一个人坐一会儿', '那天的星星，你记了很久。', { emo: -1, self: 1 }),
    ]),
    ev('reunion', '火', { place: 'city', prop: 'cup' }, '老同学聚会，大家聊起了当年的梦想。你——', [
      op('说出自己还在偷偷做的那件事', '桌上安静了一下，然后有人说："原来你还在做。"', { emo: 1, risk: 1 }),
      op('笑着听大家说', '你听到了很多从没听过的故事。', { emo: -1, act: -1 }),
    ])],
  [2, [53, 57], 3,
    ev('freetime', '水', { place: 'park', prop: 'plant' }, '你突然有了一大段完全空出来的时间。你——', [
      op('去上一门一直想上的课', '你成了班里最认真做笔记的那个人。', { time: 1, act: 1 }),
      op('把这段时间留给身边的人', '你们一起做了很多以前总说"以后再说"的事。', { self: -1, emo: 1 }),
    ]),
    ev('handover', '金', { place: 'office', prop: 'key' }, '你把一手做起来的项目交给年轻人。交接那天，你——', [
      op('写了一份很长的交接说明', '那份说明后来被大家叫作"项目圣经"。', { rule: -1, time: 1 }),
      op('只说了一句"按你的想法来"', '他做出了一个你都没想到的新版本。', { rule: 1, self: -1 }),
    ])],
  [3, [58, 62], 3,
    ev('journey', '火', { place: 'station', prop: 'suitcase' }, '你决定去一个年轻时一直想去的地方。出发前，你——', [
      op('把行程排得满满当当', '每一站都按计划完成，你在本子上打满了勾。', { time: 1, rule: -1 }),
      op('只买了一张去程的票', '你在路上遇到的事，比计划里的有趣得多。', { risk: 1, rule: 1 }),
    ]),
    ev('language', '水', { place: 'school', prop: 'book' }, '你开始学一门新语言，班上的同学都比你小几十岁。你——', [
      op('第一个举手回答', '你的发音不太标准，却是全班最敢说的那个。', { act: 1, emo: 1 }),
      op('课后自己多练几遍', '期末考试，你拿了全班第一。', { act: -1, self: 1 }),
    ])],

  // ---------------- 晚年 ----------------
  [4, [63, 75], 4,
    ev('again', '土', { place: 'park', prop: 'letter' }, '一个年轻人问你："如果重来一次，你会换一条路吗？"你——', [
      op('说"会，我想试试另一条"', '他眼睛一亮，说想听听那条路的样子。', { risk: 1, emo: 1 }),
      op('说"不会，每一步都算数"', '他点点头，好像明白了点什么。', { risk: -1, emo: -1 }),
    ]),
    ev('tree', '木', { place: 'park', prop: 'plant' }, '你在院子里种下一棵要很多年才会长大的树。你——', [
      op('每天记录它长了多少', '你的本子上，画满了一条慢慢升高的线。', { time: 1, rule: -1 }),
      op('种下就不管它，让它自己长', '某天你发现，它已经比你还高了。', { time: -1, rule: 1 }),
    ])],
  [5, [76, 88], 4,
    ev('lastpage', '水', { place: 'home', prop: 'notebook' }, '天快亮了。你翻开一本写满了的本子，最后一页还空着。你——', [
      op('写下一句给年轻时自己的话', '你写了很久，最后只留下五个字。', { emo: 1, time: 1 }),
      op('留着这页空白，等天亮再写', '窗外的天一点点亮了，你笑了笑，合上了本子。', { emo: -1, time: -1 }),
    ]),
    ev('dawn', '金', { place: 'home', prop: 'lamp' }, '窗外的天开始泛白，远处传来第一声鸟叫。你——', [
      op('推开窗，深深吸一口气', '风有点凉，带着一整天的味道。', { act: 1, risk: 1 }),
      op('再坐一会儿，慢慢等它亮', '光一点点爬上桌子，像很多年前的那个早晨。', { act: -1, risk: -1 }),
    ])],
];

export const SLOTS: readonly Slot[] = SPECS.map(([hour, ages, stage, a, b]) => ({
  hour,
  ages,
  agesLabel: stage === 4 && hour === 5 ? `${ages[0]} 岁以后` : `${ages[0]}–${ages[1]} 岁`,
  stage,
  variants: [a, b],
}));

export const TOTAL_CHOICES = SLOTS.length;

export interface PlannedSlot {
  index: number;
  slot: Slot;
  stage: Stage;
  event: GameEvent;
  environment: { ganZhi: string; element: Element | null; relation: string };
}

/** 根据出生参数，为每个小时抽取场景版本，并标注"运行环境"(该年龄段所在的大运）。 */
export function planLife(chart: Chart, seed: number): PlannedSlot[] {
  const random = rng(seed);
  return SLOTS.map((slot, index) => {
    const [a, b] = slot.variants;
    const wa = 1 + chart.elements[a.tag] / 25;
    const wb = 1 + chart.elements[b.tag] / 25;
    const event = random() * (wa + wb) < wa ? a : b;
    return { index, slot, stage: STAGES[slot.stage], event, environment: environmentFor(chart, slot.ages) };
  });
}

function environmentFor(chart: Chart, ages: [number, number]): PlannedSlot['environment'] {
  const mid = Math.floor((ages[0] + ages[1]) / 2);
  const step = chart.daYun.find(d => mid >= d.startAge && mid <= d.endAge);
  if (!step) {
    const before = chart.daYun.length && mid < chart.daYun[0].startAge;
    return before
      ? { ganZhi: '童限', element: null, relation: '大运未启动，由出生设定直接运行。' }
      : { ganZhi: '自在', element: null, relation: '大运已走完，按自己的节奏运行。' };
  }
  const e = stemElement(step.ganZhi[0]);
  return { ganZhi: step.ganZhi, element: e, relation: relationText(chart.dayMaster.element, e) };
}

export function relationText(kernel: Element, env: Element): string {
  if (env === kernel) return '环境与内核同频，运行顺畅。';
  if (env === generatedBy(kernel)) return '环境在给内核供能。';
  if (env === generates(kernel)) return '内核在向环境输出能量。';
  if (controls(env) === kernel) return '环境在打磨内核。';
  return '内核在驾驭环境。';
}
