// 深度解析(付费内容)。只在服务器上运行:前端 main.ts 不能 import 这个文件,
// 否则内容会被打包进网页,兑换码就失去意义。前端只用 `import type`。
// 文案红线与 report.ts 相同:只描述游戏里的选择和角色设定,不做任何现实预测。
import type { Chart, Element, Pillar } from './chart.ts';
import { generatedBy, generates, controls, stemElement } from './chart.ts';
import { ELEMENT_STAT, KERNELS, type LifeCode } from './profile.ts';
import {
  AXES, AXIS_POLES, BEATS, STAGES, agesLabel, clockLabel, fill, resolveBeat,
  type Axis, type Effects, type ResolvedOption, type StoryContext,
} from './story.ts';
import { ARCHETYPES, BALANCED, poleOf, settingLeans, type Archetype, type Report } from './report.ts';

/* ================= 一、《你的这一天》:每个选项一段旁白 ================= */

/**
 * 键为 `${幕 id}:${选项 key}`。写的是"那一刻的你"心里发生了什么,
 * 和游戏里的结果文字连在一起读,组成一篇完整的小说。
 */
const PROSE: Record<string, string> = {
  'birth:a': '你伸出小手，去够那串叮当响的风铃。那是你这一生第一次，想把好听的东西握在手里。',
  'birth:b': '你一直盯着墙上那块慢慢挪动的光斑。很多年后你还会这样：先安静地看，看明白了再开口。',
  'birth:c': '你张开嘴，哭得惊天动地。你很早就知道，只要开口，就会有人来。',
  'birth:d': '你的小手握住了一根手指，就再也不肯松开。有人在身边，就什么都不怕——这是你最早记住的一件事。',

  'hobby:a': '你捡起一根树枝，在沙地上画了一下午。没人教过你，你却好像天生知道：世界可以由你重新画一遍。',
  'hobby:b': '你追着风筝一直跑，风从耳边呼呼地过去。那天你发现，自己能跑得比想象中远。',
  'hobby:c': '音乐一响，你的脚就停不下来。热闹从四面八方涌过来，你一点也不怯，只觉得好玩。',
  'hobby:d': '你蹲在沙堆边，捡来瓶盖和石子，一块一块往上垒。那是你的第一件作品，每一条路怎么走，都是你自己定的。',

  'rain:a': '你走过去，把伞往 TA 那边斜了斜。那年你才五六岁，已经懂得把好东西分出去一半。',
  'rain:b': '你冒着雨跑回家，拿来一条干毛巾。你不太会说安慰的话，但你知道该做点什么。',
  'rain:c': '你站在原地，没有动。不是不在乎，只是那时的你，还不知道怎么开口。',
  'rain:d': '你拉着外婆的衣角，一起走向那个陌生的孩子。你知道自己一个人不够，但可以去找帮手。',

  'breakfast:a': '你把零花钱换成两个热乎乎的肉包，一个塞进{friend}手里。那时你还不懂什么叫分享，只知道好吃的东西，两个人吃更香。',
  'breakfast:b': '你把零花钱攥在手心，一路攥回家，放进床底下的铁皮盒。盒子一天天变沉，你的耐心也是。',
  'breakfast:c': '你要了一碗甜豆浆，坐在矮矮的小板凳上，看早上的人来人往。你很早就会给自己留一点慢下来的时间。',
  'breakfast:d': '你挽起袖子，帮王叔把碗一摞摞收好。被大人当成帮手，是那个年纪最骄傲的事。',

  'festival:a': '你拉上{friend}一起报了名。一个人上台会怕，两个人就不怕了——这是你那时想到的办法。',
  'festival:b': '你一个人报了名。没有人陪，你也想看看，自己一个人能做到什么样。',
  'festival:c': '你没有上台，躲在后台剪纸、粘胶水。灯光不在你身上，可那台晚会的每个角落都有你的手艺。',
  'festival:d': '你报了一个从没碰过的节目。你也说不清为什么，大概就是想试试，不会的东西到底有多难。',

  'noodles:a': '你搬来小板凳，站在灶台边，盯着外婆的每一个动作，生怕漏掉一步。',
  'noodles:b': '你不看外婆，按自己的想法往锅里放调料。你从小就想知道，如果换一种做法，会是什么味道。',
  'noodles:c': '你守在灶台边，只负责尝。那时你以为，外婆会一直在厨房里，一直等着你说"下次再学"。',
  'noodles:d': '你学会的第二天，就端着一碗面去找{friend}。学到的东西，你总想第一时间拿给在乎的人看。',

  'middleschool:a': '午休铃一响，你就跑向{friend}的教室。分了班又怎样，你想让一些东西保持原样。',
  'middleschool:b': '你在新班级里找人一起吃饭。新的面孔、新的笑话，你很快就融了进去，走得比自己想的还快。',
  'middleschool:c': '你和{friend}郑重地拉了钩：每周五一起走回家。你很早就明白，再好的关系也需要一个固定的约定。',
  'middleschool:d': '教室一下子空了，你没有走。走廊里的喧闹和你无关，你在和自己较劲。',
  'middleschool:e': '你憋了半节课，终于小声问{friend}借一块橡皮。有些关系，就是从一句很小的话开始的。',
  'middleschool:f': '你们各做各的，谁也不打扰谁。你喜欢这种距离：不远不近，彼此都自在。',
  'middleschool:g': '你在{friend}的课本角上偷偷画了一个小人。你不太会直接说"我们做朋友吧"，但你会用自己的方式试探。',
  'middleschool:h': '你弯腰捡起{friend}掉在地上的作业本，拍了拍灰递过去。一个很小的动作，你做得很自然。',

  'subject:a': '你没有摔门，也没有让步。你第一次发现，坚持一件事，需要的不只是倔强，还有说服人的耐心。',
  'subject:b': '你把那个想选的方向咽了回去。你没有放下{hobby}，只是学会了在现实里给喜欢留一块地方。',
  'subject:c': '你没有急着决定，而是去找了外婆。遇到大事，你习惯先找一个信得过的人，听听不一样的声音。',
  'subject:d': '你表面上点了头，心里却没有放下。你给自己留了一条后路。',

  'exam:a': '你没有再碰新题。把熟悉的东西再摸一遍，心才会落地。',
  'exam:b': '你放下书，扶外婆下楼坐了一会儿。晚风吹过来，你忽然觉得，明天的事，明天再说。',
  'exam:c': '你拿起手机，想找个人说说话，第一个想到的就是{friend}。',
  'exam:d': '你早早关了灯。你知道最后一晚多看两页书没什么用，把自己照顾好，才是最要紧的准备。',

  'college:a': '你选了{far}。这是你第一次一个人往远处走，心里又怕又亮。',
  'college:b': '你留在了{home}。你选的不是一所学校，是周末那顿热饭、巷口那盏灯，和一群熟悉的人。',
  'college:c': '你选了专业更好的那一所。你想得很清楚：远一点没关系，先把本事学到手。',
  'college:d': '你和{friend}商量好，一起去了{far}。陌生的城市因为多了一个熟悉的人，变得没那么可怕。',

  'firstjob:a': '你选了那份稳定的工作。别人说你求稳，你心里清楚：先站稳脚跟，才有底气去想以后。',
  'firstjob:b': '你跟着学长去创业。工资减半，你算过这笔账，还是觉得值——年轻的时候，你想赌一把。',
  'firstjob:c': '你没有马上选，而是背上包出去走了一个月。你需要一段空白，好听清自己心里的声音。',
  'firstjob:d': '别人都往外走，你回到了巷口。在最熟悉的地方，你找到了自己能做的事。',
  'firstjob:e': '你白天上班，晚上把{hobby}一点点做成小副业。你不想在工作和喜欢之间二选一。',

  'crossroad:a': '你回了{home}。不是退回来，是你终于想明白，自己要的生活长什么样。',
  'crossroad:b': '你留在了{far}。这座城市不再是"外面"，它慢慢有了你的痕迹。',
  'crossroad:c': '你决定再换一座城市。从头开始这件事，你已经不陌生了。',
  'crossroad:d': '你在地铁上拨通了外婆的电话。很多年过去，遇到岔路口，你还是会先听听她的声音。',
  'crossroad:e': '你收拾行李，去了{far}。走出巷口那一刻，你没有回头——你怕一回头，就舍不得走了。',
  'crossroad:f': '你留在了{home}。熟悉的街、熟悉的人，你选择把根扎深一点。',
  'crossroad:g': '你请了几天假，先去{far}看了看。你不想凭一通电话做决定，要亲眼看见才算数。',
  'crossroad:h': '你劝{friend}回{home}来。你嘴上说的是这边也有机会，心里想的是：我们好久没一起吃饭了。',

  'firsthome:a': '你花了一整个周末，跑了三趟家具市场。在陌生的城市里，你想给自己搭一个窝。',
  'firsthome:b': '你翻开那个跟了你很多年的小本子，做了第一碗番茄鸡蛋面。热气升起来的时候，你好像又站在了外婆的厨房里。',
  'firsthome:c': '你从楼下面馆端回一碗面，坐在窗边慢慢吃。晚霞把屋子染成橘色，你觉得这样也挺好。',
  'firsthome:d': '你对屋子没什么讲究，把钱攒下来去看更大的世界。家对你来说，是一个可以随时出发的地方。',
  'firsthome:e': '你在群里喊了一声，几个同事拎着菜就来了。',

  'sixyears:a': '你决定再拼一年。你知道自己累，但你更怕停下来以后，再也找不回这股劲。',
  'sixyears:b': '你把公司交给合伙人，第一次给自己放了长假。你终于承认：人不是机器，也需要回家。',
  'sixyears:c': '你多招了几个人，把肩上的担子分了出去。放手比硬扛更难，你还是做到了。',
  'sixyears:d': '你给自己定了一条小规矩：每天好好吃午饭。改变一种活法，有时就从一顿饭开始。',
  'sixyears:e': '你递了辞职信，换了一个方向从头学起。三十岁重新当新人，你比二十岁时更清楚自己要什么。',
  'sixyears:f': '你决定往深处走，把手上的事做到最好。别人在换赛道，你在一条路上越走越稳。',
  'sixyears:g': '下班以后，你把{hobby}重新捡了起来。一开始手很生，你也不着急。',
  'sixyears:h': '你主动申请去了一个新部门。你不想等日子把你推着走，宁愿自己先换一个方向。',

  'oldfriend:a': '你没有犹豫，直接说：去吧。你相信{friend}，就像很多年前 TA 相信你一样。',
  'oldfriend:b': '你没有替 TA 做决定，只是陪着 TA 一条条想清楚。',
  'oldfriend:c': '你劝 TA 先稳一稳。你说这话的时候心里也不好受，可你更怕 TA 摔疼了。',
  'oldfriend:d': '你第二天就请假去见了 TA。有些话，隔着电话说不清，你要坐在 TA 对面才放心。',
  'oldfriend:e': '你在小摊边坐了下来，一聊就是一下午。那么多年没见，一开口却好像昨天才分开。',
  'oldfriend:f': '你买下 TA 摊上的一样东西，留了联系方式。你不确定还会不会再见，但你想给这段缘分留一个口子。',
  'oldfriend:g': '你点点头，转身走进人群。有些人适合放在回忆里，你没有打扰。',
  'oldfriend:h': '第二天，你又特意绕到那条街。你嘴上不说，心里一直惦记着。',

  'newyear:a': '你放下筷子，从头讲起。在她面前，你不需要假装过得很好。',
  'newyear:b': '你只挑好的说，难处一个字都没提。你想让她放心——这是你长大以后学会的温柔。',
  'newyear:c': '你拉着外婆一起包饺子。手上忙着，话就不用说太多，你们都懂。',
  'newyear:d': '你提议明年春天带外婆出去走走。你开始意识到，有些事不能总说"以后"。',

  'latenight:a': '你买了一份关东煮，坐在便利店的窗边慢慢吃。这一天总算过去了，你允许自己什么都不想。',
  'latenight:b': '你在街边给外婆回了一个视频。屏幕那头一阵手忙脚乱，你笑得眼角都湿了。',
  'latenight:c': '你回到家，把明天要做的事一条条写下来。把事情排好，你才睡得着。',
  'latenight:d': '你和便利店的店员聊了几句。深夜的城市里，两个陌生人的几句闲话，也能让人暖和一点。',

  'forty:a': '你当晚就把它拿了出来。原来那种快乐一直都在，只是被放得太久了。',
  'forty:b': '你把它好好收了起来，说等闲下来再用。你总把喜欢的事放在"以后"，因为眼下的事总排在前面。',
  'forty:c': '你约{friend}每周一起玩一次。你知道一个人很难坚持，两个人就成了约定。',
  'forty:d': '你用它亲手做了一份回礼。被人记得的感觉太好了，你也想让{friend}尝一尝。',

  'stall:a': '你帮王叔找来一个愿意接手的年轻人。你想让那碗豆浆的味道，在巷口一直飘下去。',
  'stall:b': '你赶回去，吃了最后一碗馄饨，拍下那块旧招牌。有些东西留不住，但你可以好好地道别。',
  'stall:c': '你把王叔的故事写了下来，发给了老街坊。一个摊子要收了，可那些早晨，被你留在了文字里。',
  'stall:d': '你接下了那个摊子。小时候在这里帮忙收碗的你，大概想不到会有这一天。',
  'stall:e': '你什么都没做，只是心里空了一块。有些告别来得太快，人还没反应过来，就已经结束了。',

  'mentor:a': '你走过去，讲起自己当年搞砸的事。你知道那一刻 TA 最需要的，不是道理，是有人说"我也这样过"。',
  'mentor:b': '你在 TA 桌上留了张便条：明天一起复盘。你给了 TA 一个晚上的体面，也给了一个往前走的办法。',
  'mentor:c': '你没有去打扰。你记得自己年轻时也是这样，需要一个人待一会儿，才能重新站起来。',
  'mentor:d': '你拉 TA 下楼吃了一碗热汤面。很多年前，也有人这样拉过你。',

  'grandma:a': '你翻开那个小本子，照着外婆当年教的，一步一步做。本子上的字迹已经发黄，味道却一点没变。',
  'grandma:b': '你请外婆再教你一次。很多年前没学会的，这一次你不想再错过。',
  'grandma:c': '你搬回去，陪她住了一段日子。你小时候是她守着你，现在换你守着她。',
  'grandma:d': '你拿出手机，把她讲的老故事一段段录下来。你想把她的声音，留得久一点。',
  'grandma:e': '你陪着外婆，坐了很久的车，去看她年轻时住过的地方。一路上，她像个孩子一样趴在车窗边。',

  'retire:a': '你背上包，去了年轻时一直想去的地方。闹钟终于不用响了，你想把欠自己的时间补回来。',
  'retire:b': '你报了一个{hobby}班。从头学起，一点也不丢人。',
  'retire:c': '你在巷子里盘下一间小铺面，用的是外婆的方子。你想让更多人尝尝那碗面。',
  'retire:d': '你拿着工具箱，在小区里帮大家修修补补。被人需要，是你闲不下来的理由。',
  'retire:e': '你每天早上去公园，和老朋友们碰头。日子终于慢了下来。',

  'again:a': '你说：会，我想试试另一条。你不是后悔，只是到了这个年纪，依然对没走过的路好奇。',
  'again:b': '你说：不会，每一步都算数。那些走错的路、绕过的弯，都长成了现在的你。',
  'again:c': '你笑着说：你先走你的。你知道，别人的答案，帮不了 TA 走自己的路。',
  'again:d': '你讲起巷口那个早餐摊。你讲的是一碗豆浆，其实是你的大半辈子。',

  'dawn:a': '你拿起笔，想对很多年前那个站在窗边的孩子说点什么。',
  'dawn:b': '你没有写，就让那页空着。有些话不用写下来，你已经活出来了。',
  'dawn:c': '你下楼去买了一碗热豆浆。巷口的灯亮着，就像很多很多年前的那个早晨。',
  'dawn:d': '你拨通了{friend}的电话。走了一辈子，天亮的时候，你最想见的还是那个雨天里认识的人。',
};

/** 每一章的开头和结尾 */
const CHAPTER_OPEN = [
  '故事从{home}的一个清晨开始。那时候的天很亮，日子很长，外婆的风铃挂在窗边。',
  '午后的阳光晒得人发懒，可这几年一点也不懒——你在长个子，也在长主意。',
  '傍晚，城市的灯一盏盏亮起来。你开始自己付房租、自己拿主意，也开始知道，选择是有代价的。',
  '夜深了。年轻时以为很远的事，一件件走到了眼前：告别、交接、照顾和被照顾。',
  '天快亮了。窗外有鸟叫，巷口有早餐摊开张的声音。你走过了很长的一天。',
];

/** 每章结尾:这一段里最突出的倾向 */
/** 每章结尾的引子,按章节换一种说法 */
const CLOSE_PREFIX = ['这一段路，', '这些年，', '这一段日子里，', '那些年，', '走到最后，'];

const CHAPTER_CLOSE: Record<string, string> = {
  冒险: '你总是先迈出脚的那一个。',
  稳妥: '你走得很稳，每一步都踩得很实。',
  独立: '很多决定都是你一个人做的。',
  联结: '你身边一直有人，你也一直在为别人留位置。',
  远谋: '你一直在为以后的自己做准备。',
  当下: '你把眼前的日子过得很认真。',
  行动: '你想到就做，从不让念头在心里放太久。',
  思考: '你走得不快，但每一步都想过。',
  外放: '你的喜怒哀乐，身边的人都看得见。',
  内收: '很多心事，你都自己收着。',
  破格: '你常常不按常理出牌。',
  守序: '你守着该守的东西，没有乱了分寸。',
  平衡: '你不偏不倚，什么都试了一点。',
};

/* ================= 二、四柱逐柱解读 ================= */

const PILLAR_ROLE: Record<Pillar['label'], { name: string; meaning: string; stage: number[] }> = {
  年柱: { name: '来处', meaning: '年柱在游戏里对应你的"来处"：出生时的大环境、家里的底色，也是童年那段清晨的背景。', stage: [0] },
  月柱: { name: '土壤', meaning: '月柱是你成长的"土壤"：少年时被什么样的环境塑造，和社会第一次打交道时的样子。', stage: [1] },
  日柱: { name: '自己', meaning: '日柱就是"你自己"：天干是你的本性，地支是你最放松、最亲近时的那一面。', stage: [2] },
  时柱: { name: '远方', meaning: '时柱是心里的"远方"：一个人走到后半程，想成为的样子和想留下的东西。', stage: [3, 4] },
};

const SHISHEN: Record<string, string> = {
  比肩: '比肩代表"同伴与自我"：习惯靠自己，也看重平起平坐的关系。',
  劫财: '劫财代表"竞争与义气"：敢争取，讲义气，朋友圈对你影响很大。',
  食神: '食神代表"享受与表达"：会过日子，喜欢把心里的东西自然地拿出来分享。',
  伤官: '伤官代表"才华与锋芒"：想法多，不爱被框住，表达起来有棱角。',
  正财: '正财代表"踏实经营"：讲究付出就有回报，愿意一点点积累。',
  偏财: '偏财代表"机会与人脉"：眼光活，交际广，对新机会很敏感。',
  正官: '正官代表"责任与规矩"：重承诺，在乎名声，愿意承担被交付的事。',
  七杀: '七杀代表"压力与魄力"：越有挑战越来劲，关键时刻敢拍板。',
  正印: '正印代表"被照顾与学习"：重情，爱学习，需要一点安全感才出发。',
  偏印: '偏印代表"独特的领悟"：想法偏门，喜欢琢磨别人不注意的东西。',
  日主: '',
};

/* ================= 三、大运:人生章节 ================= */

const RELATION: Record<string, { name: string; text: string }> = {
  same: { name: '同频', text: '这十年的气候和你的本性同一个频率。游戏设定里，这是"顺手"的章节：适合把自己的长处用足。' },
  feed: { name: '滋养', text: '这十年的气候在滋养你。游戏设定里，这是"充电"的章节：适合学习、积累，接住别人递过来的帮助。' },
  give: { name: '输出', text: '这十年里，你在把力气给出去。游戏设定里，这是"输出"的章节：适合创作、表达，把本事拿出来给人看。' },
  press: { name: '磨砺', text: '这十年的气候在磨你的性子。游戏设定里，这是"升级"的章节：压力多一点，规矩多一点，人也在这时候长得最快。' },
  steer: { name: '掌舵', text: '这十年，日子由你来掌舵。游戏设定里，这是"经营"的章节：手里的事情多，怎么安排都由你说了算。' },
};

function relationKey(kernel: Element, env: Element): keyof typeof RELATION {
  if (env === kernel) return 'same';
  if (env === generatedBy(kernel)) return 'feed';
  if (env === generates(kernel)) return 'give';
  if (controls(env) === kernel) return 'press';
  return 'steer';
}

/* ================= 四、模式解读 ================= */

const PATTERN: Record<string, string> = {
  冒险: '你做决定时，更在意"错过"而不是"做错"。没把握的时候，你倾向于先上车再说——这让你经常抢到先机，也让你偶尔需要回头补课。',
  稳妥: '你做决定时，会先问自己"最坏能坏到哪儿"。底线清楚了，你才往前走——所以你很少翻车，代价是有些机会要别人先试过你才放心。',
  行动: '你习惯边做边想。一件事在脑子里放久了你会难受，宁愿先动手，在过程里修正。',
  思考: '你习惯想好了再做。别人看你迟迟不动，其实你心里已经推演过好几遍，只是在等那个最合适的时机。',
  独立: '和人相处时，你更愿意保持一点自己的空间。你很靠得住，但不太习惯麻烦别人，有事常常自己扛。',
  联结: '和人相处时，你会自然地把别人放进自己的计划里。你身边总有人，你也习惯照顾大家的感受，偶尔会忘了照顾自己。',
  外放: '你的情绪是外放的：开心、着急、感动，都写在脸上。身边的人很容易读懂你，也很容易被你感染。',
  内收: '你的情绪是内收的：很多事你选择自己消化，不轻易让人看见。你很稳，但需要有一两个能说心里话的人。',
  破格: '面对压力和规矩，你的第一反应是"能不能换个做法"。你不怕不一样，压力大的时候反而会想出新招。',
  守序: '面对压力和规矩，你的第一反应是"按步骤来"。越乱的时候你越要把事情理清楚，这让你成了团队里的定海针。',
  远谋: '你过日子的节奏偏长线：愿意先吃点苦，为以后的自己存一点。你需要提醒自己，眼前的日子也值得好好过。',
  当下: '你过日子的节奏偏当下：眼前的一碗面、一场雨、一次聊天，你都过得很投入。你需要偶尔抬头，看看三个月后的自己。',
};

const PATTERN_BALANCED: Record<Axis, string> = {
  risk: '在冒险和稳妥之间，你没有固定的偏好，会看情况换打法——有时先冲，有时先等。',
  act: '在行动和思考之间，你很会切换：小事马上做，大事想清楚再动。',
  self: '在独立和联结之间，你保持着不错的平衡：能一个人扛事，也懂得找人帮忙。',
  emo: '你的情绪不算外放也不算内收，在信任的人面前会说，在陌生人面前会收。',
  rule: '面对规矩，你分得清哪些该守、哪些可以改，不会为了不一样而不一样。',
  time: '你的节奏不偏长线也不偏当下：该攒的时候攒，该享受的时候也舍得。',
};

const PATTERN_GROUPS: Array<{ title: string; axes: [Axis, Axis] }> = [
  { title: '做决定的时候', axes: ['risk', 'act'] },
  { title: '和人相处的时候', axes: ['self', 'emo'] },
  { title: '压力和规矩面前', axes: ['rule', 'time'] },
];

/* ================= 五、四周小实验 ================= */

/** 练习某一侧倾向的小实验:标题 + 三个小步骤 */
const PRACTICE: Record<string, { title: string; steps: [string, string, string] }> = {
  冒险: { title: '做一件"没把握"的小事', steps: ['列三件你想做却一直没做的小事，挑最小的一件', '给自己定一个日期，到时候不管准备好没有都去做', '做完写两行：比想象中难在哪，又容易在哪'] },
  稳妥: { title: '给冲动装一个"刹车"', steps: ['下一次想马上答应或马上买的时候，先等 24 小时', '写下这件事最坏的结果，以及你的应对办法', '一周后回看：等过的决定和没等的，哪个更满意'] },
  独立: { title: '一个人完成一件小事', steps: ['挑一件平时会找人商量的小事', '这一次不问任何人，自己查资料、自己决定', '做完后记下：自己拿主意的感觉怎么样'] },
  联结: { title: '主动开口一次', steps: ['想一个你很久没联系、但心里惦记的人', '给 TA 发一条具体的消息，不用寒暄，就聊一件小事', '这周再找一个人帮你一个小忙，然后好好道谢'] },
  远谋: { title: '给三个月后的自己存一点', steps: ['写下三个月后想看到的一个小变化', '把它拆成每天十分钟能做的事', '在日历上打卡，满七天奖励自己一次'] },
  当下: { title: '过一个"没有目的"的下午', steps: ['留出两个小时，不安排任何任务', '去一个想去的地方，或做一件纯粹好玩的事', '晚上写下这个下午最开心的一个瞬间'] },
  行动: { title: '把一个念头变成第一步', steps: ['找出一件想了很久却没开始的事', '花十五分钟做它的第一步，哪怕很小', '做完后决定下一步，写在明天的待办里'] },
  思考: { title: '动手之前先停五分钟', steps: ['下一次想立刻动手时，先停五分钟', '写下三种不同的做法，各写一个优点', '选一种去做，事后对比一下有没有更好的那个'] },
  外放: { title: '把一句心里话说出口', steps: ['想一句你一直想说却没说的话：感谢、在意或抱歉都行', '找一个合适的时间，当面或打电话说出来', '说完记下对方的反应，和你自己的感受'] },
  内收: { title: '情绪上来时先写下来', steps: ['准备一个小本子或备忘录', '这周每次情绪起伏大的时候，先写三行再说话', '周末翻一翻，看看哪些话第二天已经不想说了'] },
  破格: { title: '换一种做法试试', steps: ['挑一件你每天都用同样方式做的小事', '这周换一种完全不同的做法', '对比一下：新做法有没有哪里更好'] },
  守序: { title: '给生活定一条小规矩', steps: ['选一个想养成的小习惯，比如每天好好吃午饭', '把它写成一条具体的规矩：时间、地点、做什么', '坚持七天，每天打个勾'] },
};

const ELEMENT_PRACTICE: Record<Element, { title: string; steps: [string, string, string] }> = {
  木: { title: '给「成长」浇点水', steps: ['挑一项想学的小技能', '每天花十五分钟练习，连续七天', '第七天把成果拍下来，和第一天对比'] },
  火: { title: '给「热情」添把柴', steps: ['想一件小时候很喜欢、后来放下的事', '这周找回它，做一次', '把做的时候的感觉讲给一个朋友听'] },
  土: { title: '给「稳定」打个桩', steps: ['固定一个每天都一样的小仪式，比如睡前整理桌面', '每天同一时间做，连续七天', '留意它有没有让你的一天更踏实'] },
  金: { title: '给「决断」磨磨刀', steps: ['列出三件一直悬着没定的小事', '每件给自己十分钟，必须做出决定', '定了就不再反复，一周后看看结果'] },
  水: { title: '给「洞察」留扇窗', steps: ['每天睡前花五分钟，回想今天印象最深的一件事', '问自己：我当时为什么那样反应', '一周后读一遍，找找有没有重复出现的模式'] },
};

/* ================= 组装 ================= */

export interface DeepChapter {
  title: string;
  subtitle: string;
  paragraphs: string[];
}

export interface DeepReport {
  title: string;
  /** 一句话总结 */
  summary: string;
  novel: DeepChapter[];
  epilogue: string[];
  pillars: Array<{ label: string; ganZhi: string; name: string; naYin: string; text: string[] }>;
  daYun: Array<{ ganZhi: string; ages: string; theme: string; text: string; inGame: string | null }>;
  notes: Array<{ clock: string; agesLabel: string; picked: string; tags: string[]; note: string; others: Array<{ text: string; result: string }> }>;
  patterns: Array<{ title: string; text: string; evidence: string | null }>;
  combo: { name: string; text: string };
  weeks: Array<{ week: number; title: string; why: string; steps: string[] }>;
  letter: string[];
}

/** 把剧情里"你——"结尾的提问句改成叙述句 */
function narrate(text: string): string {
  const t = text.replace(/你(最喜欢)?——$/, '').replace(/——$/, '').replace(/，$/, '');
  return /[。"”]$/.test(t) ? t : t + '。';
}

const STAGE_LABEL = ['童年', '青春', '而立之年', '中年', '晚年'];

function stageLean(effects: Effects[]): string {
  const sums = Object.fromEntries(AXES.map(a => [a, 0])) as Record<Axis, number>;
  for (const e of effects) for (const a of AXES) sums[a] += e[a] ?? 0;
  const top = [...AXES].sort((a, b) => Math.abs(sums[b]) - Math.abs(sums[a]))[0];
  return sums[top] === 0 ? '平衡' : poleOf(top, sums[top]);
}

function effectTags(e: Effects): string[] {
  return AXES.filter(a => e[a]).map(a => AXIS_POLES[a][(e[a] ?? 0) > 0 ? 0 : 1]);
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface DeepInput {
  chart: Chart;
  code: LifeCode;
  ctx: StoryContext;
  /** 每一步所选选项的编号,必须完整 24 步 */
  picks: readonly string[];
  report: Report;
}

/** 生成深度解析。picks 不完整或有误时抛错。 */
export function buildDeepReport({ chart, code, ctx, picks, report }: DeepInput): DeepReport {
  const flags = new Set<string>();
  const steps: Array<{ index: number; text: string; option: ResolvedOption; others: ResolvedOption[]; prose: string }> = [];
  for (let i = 0; i < BEATS.length; i++) {
    const r = resolveBeat(i, ctx, flags);
    const option = r.options.find(x => x.key === picks[i]);
    if (!option) throw new Error(`第 ${i + 1} 步的选择无效`);
    option.set.forEach(f => flags.add(f));
    const prose = fill(PROSE[`${r.beat.id}:${option.key}`] ?? '', ctx, flags);
    const lead = /，你——$/.test(r.text) && prose.startsWith('你') ? r.text.replace(/你——$/, '') : narrate(r.text);
    steps.push({ index: i, text: lead, option, others: r.options.filter(x => x !== option), prose });
  }
  const stepsOf = (stage: number) => steps.filter(s => BEATS[s.index].stage === stage);
  const archetype: Archetype = report.archetype;

  // 一、小说
  const novel: DeepChapter[] = STAGES.map((st, si) => {
    const ss = stepsOf(si);
    const first = BEATS[ss[0].index];
    const last = BEATS[ss[ss.length - 1].index];
    const paragraphs = [fill(CHAPTER_OPEN[si], ctx, flags)];
    for (const s of ss) paragraphs.push(`${s.text}${s.prose}${s.option.result}`);
    paragraphs.push(CLOSE_PREFIX[si] + CHAPTER_CLOSE[stageLean(ss.map(s => s.option.effects))]);
    return {
      title: `第${'一二三四五'[si]}章　${st.timeOfDay}`,
      subtitle: `${clockLabel(first.hour)}—${clockLabel((last.hour + 1) % 24)} · ${st.name} · ${first.ages[0]}–${last.ages[1]} 岁`,
      paragraphs,
    };
  });

  // 尾声:根据一路留下的线索
  const epilogue: string[] = [];
  const memory: string[] = [];
  if (flags.has('recipe')) memory.push('外婆那碗番茄鸡蛋面的做法，你记了一辈子');
  if (flags.has('close')) memory.push(`那个雨天认识的${ctx.friend}，一直走在你身边`);
  if (flags.has('stall')) memory.push('巷口那个早餐摊，有一部分是你撑起来的');
  if (flags.has('startup')) memory.push('你年轻时赌过一把，也扛下了后果');
  if (flags.has('trip')) memory.push('你兑现过一个带外婆出门的约定');
  if (flags.has('back')) memory.push(`你走出过${ctx.home}，又自己选择了回来`);
  else if (flags.has('left')) memory.push(`你从${ctx.home}出发，在${ctx.far}扎下了根`);
  else if (flags.has('stayed')) memory.push(`你一直守在${ctx.home}，守着那些熟悉的人和街`);
  epilogue.push(`很多年以后，如果有人问起你这一生，大概会提到这几件事：${memory.length ? memory.join('；') : '你走过的每一条路，都是自己选的'}。`);
  epilogue.push(`你用 24 个选择走完了一天。在这一局里，你是一个「${archetype.name}」——${archetype.motto}。`);
  epilogue.push('这只是无数种可能里的一种。下一次重来，清晨六点的那串风铃，还会在窗边等你。');

  // 二、四柱
  const pillars = chart.pillars.map(p => {
    const role = PILLAR_ROLE[p.label];
    const k = KERNELS[p.gan];
    const lines = [role.meaning];
    if (p.label === '日柱') {
      lines.push(`你的日主是「${p.gan}${p.ganElement}」，意象是${k.image}：${k.desc}`);
    } else {
      lines.push(`天干「${p.gan}」属${p.ganElement}，意象是${k.image}，在你的盘里是${p.ganShiShen}。${SHISHEN[p.ganShiShen] ?? ''}`);
    }
    const hidden = p.hideShiShen.filter(Boolean);
    if (hidden.length) lines.push(`地支「${p.zhi}」属${p.zhiElement}，里面藏着${[...new Set(hidden)].join('、')}——这是这一柱里不显山露水、却一直在起作用的部分。`);
    const ss = role.stage.flatMap(stepsOf);
    const lean = stageLean(ss.map(s => s.option.effects));
    const stageNames = role.stage.map(i => STAGE_LABEL[i]).join('和');
    lines.push(`在游戏里，对应的是你的${stageNames}。那几个小时，你最常选的是「${lean}」${lean === '平衡' ? '' : `，比如「${ss.find(s => effectTags(s.option.effects).includes(lean))?.option.text ?? ss[0].option.text}」`}。`);
    return { label: p.label, ganZhi: p.gan + p.zhi, name: role.name, naYin: p.naYin, text: lines };
  });

  // 三、大运章节
  const daYun = chart.daYun.slice(0, 8).map(d => {
    const rel = RELATION[relationKey(chart.dayMaster.element, stemElement(d.ganZhi[0]))];
    const hit = steps.find(s => {
      const b = BEATS[s.index];
      const mid = (b.ages[0] + b.ages[1]) / 2;
      return mid >= d.startAge && mid <= d.endAge;
    });
    return {
      ganZhi: d.ganZhi,
      ages: `${d.startAge}–${d.endAge} 岁`,
      theme: rel.name,
      text: rel.text,
      inGame: hit ? `游戏里的这个年纪（${agesLabel(BEATS[hit.index])}），你选了「${hit.option.text}」。` : null,
    };
  });

  // 四、24 个选择逐条批注
  const leans = settingLeans(chart);
  const notes = steps.map(s => {
    const b = BEATS[s.index];
    const tags = effectTags(s.option.effects);
    const verdicts = AXES.filter(a => s.option.effects[a]).map(a => {
      const l = leans.find(x => x.axis === a);
      const pole = AXIS_POLES[a][(s.option.effects[a] ?? 0) > 0 ? 0 : 1];
      if (!l || l.sign === 0) return `「${pole}」这一步是你自由发挥的`;
      return Math.sign(s.option.effects[a] ?? 0) === l.sign ? `「${pole}」顺着出生设定（${l.reason}）` : `「${pole}」改写了出生设定（${l.reason}）`;
    });
    return {
      clock: `${pad(b.hour)}:00`,
      agesLabel: agesLabel(b),
      picked: s.option.text,
      tags,
      note: verdicts.join('；') + '。',
      others: s.others.map(x => ({ text: x.text, result: x.result })),
    };
  });

  // 五、模式
  const patterns = PATTERN_GROUPS.map(g => {
    const text = g.axes
      .map(a => (report.scores[a] === 0 ? PATTERN_BALANCED[a] : PATTERN[poleOf(a, report.scores[a])]))
      .join('');
    const strongest = [...g.axes].sort((a, b) => Math.abs(report.scores[b]) - Math.abs(report.scores[a]))[0];
    const sign = Math.sign(report.scores[strongest]);
    const ev = sign === 0 ? undefined : steps.find(s => Math.sign(s.option.effects[strongest] ?? 0) === sign);
    return { title: g.title, text, evidence: ev ? `比如 ${pad(BEATS[ev.index].hour)}:00，你选了「${ev.option.text}」。` : null };
  });

  // 主副轴组合
  const second = report.axes
    .filter(a => a.axis !== report.mainAxis && a.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const secondType = second ? ARCHETYPES[second.pole] : BALANCED;
  const combo = {
    name: `带着${secondType.name}气质的${archetype.name}`,
    text: `你的主轴是「${report.mainPole}」，副轴是「${second?.pole ?? '平衡'}」。${archetype.desc}你还有另一面：${secondType.desc}在一个团队里，你最自然的位置是：一边${archetype.role}，一边${secondType.role}。`,
  };

  // 六、四周小实验:前三周练主轴、副轴、第三轴的另一侧,第四周补最弱的属性
  const ranked = [...report.axes].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const weeks: DeepReport['weeks'] = ranked.slice(0, 3).map((a, i) => {
    const other = a.score >= 0 ? AXIS_POLES[a.axis][1] : AXIS_POLES[a.axis][0];
    const p = PRACTICE[other];
    return {
      week: i + 1,
      title: p.title,
      why: a.score === 0 ? `你在「${other}」这一侧还有空间，试试看。` : `这一局你更常选「${a.pole}」，这周练练另一侧的「${other}」。`,
      steps: [...p.steps],
    };
  });
  const ep = ELEMENT_PRACTICE[code.patch.element];
  weeks.push({ week: 4, title: ep.title, why: `「${ELEMENT_STAT[code.patch.element]}」是你初始值最低的属性，这周专门给它加点。`, steps: [...ep.steps] });

  // 七、写给现在的你
  const dawn = steps[steps.length - 1];
  const turning = report.moments[0];
  const letter = [
    '写给现在的你：',
    `我是破晓时分的你。我刚刚走完一整天，从${ctx.home}的那个清晨，一直走到现在。`,
    turning ? `回头看，我最记得的是 ${turning.clock} 那一刻，${turning.agesLabel}，我选了「${turning.optionText}」。那时候没想那么多，后来才知道，很多事是从那里开始的。` : '回头看，每一个小时都算数。',
    `我想告诉你，「${code.patch.stat}」是我们起点最低的一项，可它也是这一生长得最多的地方。别急，慢慢来。`,
    flags.has('close') ? `还有，记得给${ctx.friend}打个电话。` : '还有，如果心里惦记着谁，就去联系 TA 吧。',
    dawn.option.key === 'a' ? '最后，我在本子上写下的那句话，现在也送给你：慢慢来，别怕。' : `最后，天亮的时候，我选了「${dawn.option.text}」。希望你也能有一个这样的早晨。`,
  ];

  return {
    title: `${code.kernel} · ${archetype.name}的一天`,
    summary: `${code.kernelImage}一样的本性，走出了一条「${report.mainPole}」的路。24 个选择里，你改写了 ${report.rewriteCount} 处出生设定。`,
    novel,
    epilogue,
    pillars,
    daYun,
    notes,
    patterns,
    combo,
    weeks,
    letter,
  };
}

/** 测试用:所有可能出现在深度解析里的固定文案 */
export const DEEP_TEXTS: readonly string[] = [
  ...Object.values(PROSE),
  ...CHAPTER_OPEN,
  ...CLOSE_PREFIX,
  ...Object.values(CHAPTER_CLOSE),
  ...Object.values(PILLAR_ROLE).map(r => r.meaning),
  ...Object.values(SHISHEN),
  ...Object.values(RELATION).flatMap(r => [r.name, r.text]),
  ...Object.values(PATTERN),
  ...Object.values(PATTERN_BALANCED),
  ...Object.values(PRACTICE).flatMap(p => [p.title, ...p.steps]),
  ...Object.values(ELEMENT_PRACTICE).flatMap(p => [p.title, ...p.steps]),
];

/** 测试用:找出缺少旁白的选项 */
export function missingProse(): string[] {
  return BEATS.flatMap(b => b.options.map(o => `${b.id}:${o.key}`)).filter(k => !PROSE[k]);
}
