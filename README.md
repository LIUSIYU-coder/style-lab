# HSK Prep（暂定名）

> **当前在做的是 [`life-game/`](life-game/README.md):「二十四时」网页小游戏 demo。** 下面是此前搁置的 HSK 备考 App 原型,代码保留,暂不推进。

面向外国学习者的 **新版 HSK 3.0 备考 App**（Expo / React Native，TypeScript）。

当前状态：**原型**。有间隔复习核心、词表数据管线、一个用示例词跑的闪卡界面；还不是可上架的产品。

## 在 iPhone 上试用（不需要 Mac）

1. 电脑装好 Node.js，在本目录运行 `npm install`
2. `npx expo start`
3. iPhone 装 **Expo Go**，扫终端里的二维码（手机和电脑在同一个 Wi-Fi）

## 开发命令

| 命令 | 作用 |
|---|---|
| `npm test` | 运行核心逻辑和数据管线测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build:wordlist -- <参数>` | 由词表 + 词典生成带拼音/释义的 JSON（见下） |
| `npx expo export --platform ios` | 验证 iOS 能否打包（不需要设备） |

## 代码结构

- `src/core/`：间隔复习（SM-2 变体）、学习队列、词表结构与校验、进度存取格式（`storage.ts`）、选择题测验（`quiz.ts`）
- `src/data/`：CC-CEDICT 解析、拼音声调转换、词表构建（纯函数，有测试）
- `scripts/build-wordlist.mts`：命令行入口（读文件、写 `data/private/`）
- `data/fixtures/sample-words.json`：**仅供开发的示例词，不是官方词表**
- `data/private/`：**被 git 忽略**，放生成的词表和第三方数据（授权未确认前不得提交）
- `App.tsx`：原型界面（进度只存在内存里；存取格式已写好并有测试，还没有接上设备端存储）
- `docs/authorization-request.md`：向汉考国际申请授权的材料清单和邮件草稿

## 词表数据管线

输入（自己下载，脚本不联网）：

1. 词表：每行一个词，可带义项数字（如 `点1`），官方写法里的括号（`没（有）`）会自动展开查词
2. CC-CEDICT：`cedict_1_0_ts_utf-8_mdbg.txt.gz`（当前文件头部写明 **CC BY-SA 4.0**）

```bash
npm run build:wordlist -- --cedict cedict.gz \
  --level 1=L1.txt --level 2=L2.txt --level 3=L3.txt \
  [--overrides fixes.json] --out data/private/words.json
```

输出 `words.json` 和 `words.review.json`（需要人工确认的条目）。

**自动选择不可靠，必须人工复核：** 一个词有多个读音时脚本只会取第一个候选（例如"吧"会取 bā，实际应为 ba）。
review 文件里有四类条目：`several readings`（多读音）、`sense marker in list`（词表标了义项）、
`same word and reading already in an earlier level`（高级别的另一个义项，目前未收录）、`missing in dictionary`。

人工修正用 `--overrides`，格式：

```json
{ "吧": { "pinyin": "ba", "meaningEn": "sentence-final particle" }, "好@2": { "pinyin": "hào" } }
```

键是词，或 `词@级别`（后者优先）。

## 已核实的事实

- **HSK 3.0 全球正式开考日：2026-12-13。** 汉考国际官网新闻页（2026-09-09 发布）：纸笔考报名至 11-16，机考报名至 12-03。
- 用户提供：HSK 2.0 最后一场为 2026-11-07。（某孔子学院页面曾写 2.0 在 12-05 仍有场次，与此不一致，以官网为准。）
- 竞品调研（美区 App Store，2026-10）：HSK 专项 App 最高约 1,000 条评分，针对 3.0 的几乎空白；
  差评集中在强制订阅、词表过时、发音错误（多音字）、广告遮挡。
- 3.0 词表条数：一级 300，二级 204 行（202 个不同词），三级 507 行（506 个不同词）；
  合计 1,011 行 vs 官方累计 300/500/1000，差异来自一词多义项/OCR，**尚未与官方 PDF 逐条核对**。

## 上架前必须解决（关卡）

1. **词表授权（未解决）。** 使用的词表来自第三方仓库 krmanik/HSK-3.0，它声明自己的整理工作为 CC BY-SA 4.0，
   但内容是官方《新版 HSK 考试大纲》PDF 的 OCR，原词表权利属于出题方/教育部。需联系汉考国际或咨询知识产权律师。
   授权确认前：**不要把官方 PDF、第三方词表或生成的数据提交进仓库**。
2. **CC BY-SA 4.0 的传染性。** 由 CC-CEDICT 派生的数据（拼音、释义）必须署名并以相同协议发布；
   这对 App 本身的影响需要律师确认。
3. **逐条核对词表**与官方 PDF，并完成 review 文件里的人工确认。
4. **发音**：多音字不能用系统语音直接读，需要按拼音校正或使用录音。
5. **Apple 开发者账号（99 美元/年）**：以上确认后再购买。

## 下一步

- **向汉考国际申请授权**（见 `docs/authorization-request.md`），回复前不买开发者账号
- 人工复核 review 文件（约 135 条），生成最终词表
- 把进度存取接到设备存储（按 AGENTS.md，需先读 SDK 57 对应的 Expo 文档再选模块）并在界面里接上测验
- 听力、价格方案（倾向 3 个月/12 个月通行证，而不是长期订阅）
- 订阅/内购、隐私政策、App Store 素材
