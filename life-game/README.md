# 人生之书

一本写你的书。翻开线装封面，在扉页写下怎么称呼你、小时候是谁带大你、你的生辰和出生地 → 序页排出四柱八字，作为这本书的"初始设定" → 五章、二十四个小时：清晨 06:00 出生，走到第二天破晓。每一页有随钟点变化的动态画面和环境声，有的页要你用手做一个小动作（按住撑伞、轻点吹凉豆浆、上滑拆信、转动钥匙、点亮灯笼），有两页请你亲手写一句话；和你现实年龄对应的那一页会标出"这一页的年纪，就是现在的你" → 跋：问一件现实里在意的事 → 书末附录：人生签（可生成图片分享）、选择报告、《人生说明书》解锁。

**免费部分**(整本书、人生签、选择报告)全部在浏览器里运行。**付费部分**是《人生说明书》:玩家买兑换码,读完后输入兑换码,由服务器根据出生参数、扉页信息和 24 个选择生成——你现在所在的这一页(按真实年龄)、你最近在意的那件事、六行底层代码逐行深读、过去的你 vs 想要的你(回忆与设想的选择分开统计)、三种处境下的你、四柱与大运、24 个选择批注(含没选的路)、四周小实验、"破晓时分的你"写来的信,附赠五章小说《你的这一天》。付费内容只在服务器上生成,不会打包进网页。

**上线**:免费试水看 [docs/deploy-free.md](docs/deploy-free.md)(Render + Upstash,仓库根目录有 `render.yaml`);正式售卖看 [docs/deploy.md](docs/deploy.md)(香港服务器 + 域名 + 一条命令部署)。两种方式都有手机可用的管理页 `/admin`,用来生成兑换码。**场景插画**的完整生图需求见 [docs/image-brief.md](docs/image-brief.md)。

## 本地运行

```bash
cd life-game
npm install
npm run dev        # 终端会显示局域网地址,手机连同一个 Wi-Fi 就能打开
```

## 构建与运行服务器

```bash
npm run build      # 产物在 dist/;另外生成单文件 dist/life-code.html(只能免费游玩,不能兑换)
npm start          # 启动服务器:托管 dist/ 并提供兑换接口,默认 http://127.0.0.1:8080
npm run codes -- make 10 test   # 生成 10 个测试兑换码,保存在 data/codes-test.csv
```

服务器不依赖任何第三方包,需要 Node.js 22.18 以上(可以直接运行 `.ts`)。环境变量:`PORT`、`HOST`、`TRUST_PROXY`(`1`=自己的 Caddy 后面,`first`=Render 等托管平台)、`DATA_FILE`(本机文件存兑换码)或 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`(Upstash 存兑换码)、`ADMIN_TOKEN`(开启 `/admin` 管理页,至少 12 位)、`SITE`(卡密里写的域名)。

- 兑换码只存 SHA-256 摘要;每个码最多绑定 3 台设备,已绑定的设备可以反复解锁;同一 IP 输错 8 次暂停 15 分钟;无效请求不消耗兑换码。
- 字体(霞鹜文楷屏幕版、马善政毛笔楷书,均为 SIL OFL 开源授权)随网页一起部署在自己的服务器上,按需加载切片,大陆网络和 iPhone 上都能显示书法字形。

## 开发命令

| 命令 | 作用 |
|---|---|
| `npm test` | 排盘、剧情、报告、深度解析、兑换服务器与文案红线测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run dev` / `npm run build` | 开发服务器 / 构建 |

## 代码结构

| 路径 | 内容 |
|---|---|
| `src/engine/solar-time.ts` | 夏令时(1986–1991)与真太阳时校正 |
| `src/engine/calendar.ts` | 农历 ↔ 公历换算(含闰月) |
| `src/engine/regions.ts` | 31 个省级行政区、452 个市 / 区县的经度(脚本生成,勿手改) |
| `src/engine/chart.ts` | 排盘:四柱、藏干、十神、五行占比、大运(调用 lunar-typescript) |
| `src/engine/profile.ts` | 把排盘翻译成"底层代码":内核、属性、天赋模块、成长空间 |
| `src/engine/story.ts` | 24 幕连贯剧情:剧情标记(flags)、条件选项、文案占位符(朋友名、家乡、远方城市、爱好);每幕 3–4 个选项 |
| `src/engine/deep.ts` | 付费深度解析(**只在服务器上运行**,前端只引用它的类型):每个选项一段小说旁白、四柱、大运章节、批注、模式、小实验、信 |
| `src/engine/validate.ts` | 出生参数、城市名、选项编号的校验(存档和接口共用) |
| `src/engine/report.ts` | 选择画像报告:原型、六维百分比、人生一日表盘、名场面、设定 vs 选择(改写了几行代码)、前后半天转向、一致性、优势与盲点、搭档、平行人生、小实验 |
| `src/save.ts` | 本机存档(localStorage),只存出生参数和每步选项编号,刷新后可继续 |
| `src/unlock.ts` / `src/deep-view.ts` | 兑换请求与深度解析阅读页 |
| `src/share-image.ts` | 用 Canvas 生成可长按保存的纪念卡图片 |
| `src/config.ts` | **上线前要改**:店铺信息、价格、网址、是否启用场景插画 |
| `src/main.ts` / `src/style.css` | 书的流程与样式 |
| `src/ui/book.ts` | 翻页、逐句显现、手势(长按 / 轻点 / 上滑)、选项 |
| `src/ui/scenes.ts` | 九种地点的 Canvas 动态画面,光线随钟点变化,回应手势 |
| `src/ui/sound.ts` | Web Audio 现场合成的环境声和音效 |
| `src/engine/chart-text.ts` | 序页的免费解说:怎么读四柱、十个日主、五行最旺最弱、季节、十神占比、大运 |
| `src/engine/sources.ts` | "这本书的来历"页:设定与排盘的来源、选择画像的借鉴、做不到的事(只写能核实的) |
| `src/engine/reader.ts` | 扉页信息(称呼、带大你的人、小名、朋友名)、现实困惑、亲手写的话、真实年龄 |
| `server/` | 兑换服务器(`app.ts` 接口、管理接口与静态文件,`codes.ts` 兑换码仓库:本机文件或 Upstash,`admin-page.ts` 管理页) |
| `scripts/make-sample.ts` | 生成《人生说明书》样张节选(`npm run sample`,写入 `src/sample-deep.json`),封面和解锁区的"看样张"用它;改了 `deep.ts` 的文案后要重新运行 |
| `scripts/codes.ts` | 兑换码管理:生成、查询、重置设备、作废、统计 |
| `deploy/install.sh` | Ubuntu / Debian 一键部署(Node + Caddy HTTPS + systemd) |
| `scripts/inline.mjs` | 把构建产物内联成单文件 |
| `scripts/regions.rq` / `scripts/build-regions.mjs` | 从 Wikidata 重新生成省市经度数据 |

## 排盘约定(已用测试固定)

- **晚子时(23:00–24:00)日柱算次日**。lunar-typescript 默认设置在这一时段会给出"日柱算当天、时柱用次日天干"的不自洽结果,所以显式用 `setSect(1)`。
- 年柱、月柱以**节气**(立春等)交接时刻分界。
- 测试里用 **tyme4ts 独立计算 3000 个随机时间**的四柱,与本项目结果逐一比对。
- **夏令时**:1986–1991 年夏季出生的钟表时间先减 1 小时;区间已与 tz 数据库 `Asia/Shanghai` 比对。
- **农历输入**:支持闰月,换算后按公历排盘;测试覆盖已知日期和 2000 个随机日期的往返换算。
- **真太阳时**:可选"省份 → 城市 / 区县",按经度差(每度 4 分钟)加时差方程换算,误差约 ±1 分钟。
- 输入一律按**北京时间**。港澳台和海外出生(不同时区、不同夏令时历史)暂不支持。

## 视觉

- 新中式线装书:夜色书桌、黛青封面、宣纸书页、朱砂印章,从书脊处翻页。
- 不加载任何第三方网站的字体、图片或脚本,国内网络下也不会卡;场景画面和声音都是代码现场生成的。
- 第三方字体:[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)、[马善政](https://fonts.google.com/specimen/Ma+Shan+Zheng),SIL Open Font License 1.1。

## 内容红线

- 定位是**娱乐游戏**:剧情是"平行人生",设定只描述游戏角色,不对现实中的人做预测。
- 不出现改运、化解、吉凶、财运、婚姻、健康等内容;`game.test.ts` 会扫描所有面向玩家的文案,出现红线词测试就失败。
- 建议只给低风险的小行动(比如"换一条路回家")。
- 报告里的百分比只统计玩家自己这一局,不和其他玩家比较,不编造"超过 xx% 用户"这类数据;不做"分享后解锁"。
- 排盘和免费报告只在浏览器里计算。兑换深度解析时,出生参数和选择会发给服务器生成内容,服务器不保存(只记录兑换码绑定了哪些设备编号)。

## 已知限制 / 下一步

- 剧情是一条主线加若干分支,重玩换选法会走到不同的分支,但主线场景是固定的。
- 场景插画共 28 张:原图(1600×1200 JPG)在 `art/scenes-src/`,运行 `python3 scripts/optimize-scenes.py` 生成网页用的 `public/scenes/*.webp`(约 85KB 一张)和 `src/scenes-lqip.json`(模糊占位图,翻页时画面立刻出现、大图再淡入);缺图时自动退回代码画的画面。生图规格见 `docs/image-brief.md`。
- 封面插画是可选的:`art/cover-src/cover.jpg` → `public/cover.webp`(同一个脚本生成),没有就用布面封面。生图规格见 `docs/image-brief-cover.md`。
- 兑换码数据是一个 JSON 文件,适合单台服务器、每天几千次以内的兑换量。

## 第三方

- [lunar-typescript](https://github.com/6tail/lunar-typescript)(MIT):排盘计算
- [tyme4ts](https://github.com/6tail/tyme4ts)(MIT):仅测试中用于交叉验证
- 省市坐标:[Wikidata](https://www.wikidata.org)(CC0)
