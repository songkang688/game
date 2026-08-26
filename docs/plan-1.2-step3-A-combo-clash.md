# 1.2 第 3 步 · A 档 —— `combo-clash`「连招对决」

> 短计划：独占新建 `src/games/combo-clash/`。本步另两档是 `mahjong-bloom`、`star-estate`。
> **必须比 `fight-king` 更深**（取消窗口帧、跳投落地接、超必取消、破防、Clash、起身选择）。**禁止改** `src/games/fight-king/**`。新 id，新的 ≥10 名原创格斗家帧表。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理；必须自己动手把活干完。只推 `game-1.2`，不要改 main、不要 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，**1.2 第 3 步 / 共 7 步新游戏接入 · A 档**：新建 `combo-clash`「连招对决」。假设 1.1 的 55 款（含 `fight-king`）已全部做完。

## 分支纪律
`git fetch origin game-1.2` → 工作分支基于它 → 先提交计划 commit → 只推 game-1.2。收尾 rebase + `npm test` + `npm run build` + 普通 push。禁止 force。不要改 main，不要用 gh 写 PR。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据（不许 import 玩法）+ `index.ts` `export { meta } from "./meta"` + `mount(api): { destroy }` 懒加载。**不要改 `src/ui/home.ts`。**
- 闯关走 `level99.ts` **188** 关。存档 `yiduo-yixing.l99.combo-clash`。
- 键位：朵朵 `WASD` 移动/跳/蹲，`F` 轻击，`G` 重击，`F+G` 或独立钮放特殊技（手机三个钮：轻/重/必杀）；星星方向键 + `L`/`K`。`Esc` 暂停。热区 ≥ 44px。
- `destroy` 清干净。内置音效 only。无外部依赖。
- **收藏只读**：`speedMul` 乘走速、`startShieldMs` 可作开局短暂护盾；禁止改 collection 源文件与 key。暂停可 `openCollection("combo-clash")`。
- 分级：无血无伤口。条子叫「元气」。被打中：星星飞溅、顿帧、轻微击退。元气掉光 = 「坐下休息，换下一回合」。
- **禁止商标**（尤其不要写格斗游戏官方名、角色名，注释也不许）。360px：虚拟摇杆 + 三个大钮，血条在顶部且名字不重叠。验证 360 / 375 / 1280。
- 不要改 supervisor / step1 / step9+ / 1.1 文件。

## 你只做这一款 · 必须比 `fight-king` 更深

`fight-king` 已有：8 角色、起手/命中/收招、格挡、投技、单向取消表（轻→重→必杀→超必）、连段上限 6、三档 AI、格斗塔 188。你 **不要去改它**。新 id 必须额外具备下面「加深清单」——缺一项打回。

### meta
```
id: "combo-clash"
title: "连招对决"
emoji: "💫"
category: "party"
color: "#FFD6EA"
blurb: "跳过来接到一串连招，再取消成超必杀！看血条、看硬直，1 对 1 把对手打到坐下休息。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 加深清单（相对 fight-king）
| 系统 | fight-king | 本款必须多出来的 |
| --- | --- | --- |
| 跳投 / 跳攻 | 有空中轻/重 | **跳入（jump-in）**：空中命中后落地可接地面连；空中下踢是上段，必须站着挡 |
| 取消 | 单向 kind 表 | **取消窗口帧**：只有 active 命中后的 cancelLag 帧内能取消；空取消失败要进收招 |
| 超必取消 | 必杀→超必 | **超级取消**：必杀的命中帧内花槽把必杀取消成超必；另有 LV1/LV2 两档超必（槽 50%/100%） |
| 血条 | 元气一条 | **双槽**：元气（生命）+ 能量；另有 **护盾槽**，被打满则硬直变长（破防） |
| 1v1 回合 | 有 | **Best of 3 回合**，每回合满元气；边角有「贴边」加厚连段（corner） |
| 受身/起身 | 有受身 | **起身选择**：受身落地 / 原地起 / 后跳起；起身前 4 帧投技无敌，超必可逆转 |
| 对拼 | 投技优先 | **Clash**：同帧双方打击框重叠且优先级差 ≤1 则火花互退 |
| 指令 | 槽位按钮 | **简化指令 + 显示**：必杀可用「下→前+重」或一键；训练模式显示输入历史 |
| 连段 | 上限 6、递减 | **空中连（juggle）状态**、落地限制、连段计数 HUD、训练模式 dummy 站立/跳/挡 |

### 完整规则（帧数据驱动，纯函数）
- 60 逻辑帧。每招：`startup / active / recovery`，判定框仅 active。
- 命中：hitstun、blockstun、hitstop（顿帧 3–8 帧，reduced-motion 则 0）。
- 格挡：后方向。上段（跳攻）蹲挡挨打；下段站挡挨打；中段都可挡。投技不能挡，但要贴近且对方不在投无敌。
- **跳投**：空中按投技键，落地前判定；被投中播放抱起转圈（卡通），落地对方坐地上。
- 能量：打中加、挡中加得少；LV1 超必 50，LV2 100。超必有投无敌或全身无敌帧（写在帧表）。
- 元气 ≤ 0：本回合负。BO3 先赢 2 回合者胜。平局双倒：血多者胜，一样则「时间耗尽双方坐下」判负双方（对战重开该回合）。
- 无限连防护：连段 hitstun 递减 + juggle 衰减 + 上限 8 段后强制倒地。单测这条。

角色 ≥ **10 个原创**（不要用 fight-king 那 8 个的招式表，可共用世界观名字朵朵/星星等，但帧数据重做且差异更大：有体术型、有投射型、有抓投型、有蓄力型）。每人至少：5L 5H 2L 2H jL jH 投、2 个必杀、LV1+LV2 超必。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 框 | `worldBox` `rectsOverlap` |
| 高低段 | `guardBeats(height, crouch)` |
| 取消窗口 | `inCancelWindow(move, frame, hasHit)` |
| 超必取消 | `canSuperCancel(from, meter)` |
| 跳入落地接 | `landCancel(airHit, landingFrame)` |
| 破防 | `guardCrush(guardMeter)` |
| Clash | `clashOrHit(a, b)` |
| 起身 | `wakeupOptions` / `throwInvuln` |
| 贴边 | `cornerClamp` |
| 连段衰减 | `juggleScale(hitIndex)` |

### 模式
| 模式 | 做 | 为什么 |
| --- | --- | --- |
| 对战 1v1 | 必须 | 本命 |
| 人机 | 必须 | 四档 AI |
| 闯关 188 挑战塔 | 必须 | 教跳入、取消、破防 |
| 无尽 | 必须 | 连胜，AI 升级，`recordEndlessBest` |
| 训练 | 必须 | 帧数据、输入历史、假人 |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 轻击学堂 | 24 | 只允许 5L 连 5L |
| 2 | 取消入门 | 24 | 必须轻取消重才打得过木桩血量 |
| 3 | 跳入花园 | 24 | 必须跳攻打开再接地面 |
| 4 | 破防工坊 | 24 | 对手狂挡，要下段或投 |
| 5 | 超必剧场 | 24 | 必杀取消超必才能斩杀 |
| 6 | 贴边悬崖 | 22 | 场地窄，教 corner |
| 7 | 起身猜拳 | 22 | 对手会抓投 / 会逆转 |
| 8 | 连招杯 | 24 | 全角色轮换 Boss，BO3 |

24×5 + 22×2 + 24 = 188。

### 前端建模与动画
- Canvas 横版舞台（视差 2 层）+ DOM HUD（双血条、能量、连段数、回合点）。
- 命中：**顿帧 + 命中火花**，禁止只减数字没反馈。超必有 20 帧演出（reduced-motion 跳过演出只结算）。
- 360px：血条简化为短条+心数；摇杆不挡角色。

### AI 档位
菜鸟只会 5L；普通会挡会跳；高手会反跳入、会破防；地狱会抓起身、会存槽超必取消、反应延迟 ≤ 8 帧。地狱 vs 菜鸟 30 局胜率显著高。

### 可参考 GitHub（结构 only，不引入运行时依赖）
- https://github.com/ikemen-engine/Ikemen-GO （角色/招式/取消结构，不要嵌引擎）
- 对照阅读本仓库 `src/games/fight-king/rules.ts` **只许读不许改**，理解后再写更深的一套。

### 独占文件
只许 `src/games/combo-clash/**`，可选 `scripts/smoke-step3-a.mjs`。禁止 `fight-king/**`、`duo-vs-star/**`、本步 B/C、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 40（硬性 ≥ 15）
取消窗口、空取消失败、跳入落地接、超必取消耗槽、破防、Clash、起身投无敌、连段上限强制倒地、BO3、188 章和。

### 不要做什么
- 不要写实拳脚血腥。
- 不要抄 fight-king 帧表交差。
- 不要在可见文案或注释里出现格斗游戏商标。

### 验收 checkbox
- [ ] 加深清单每一行都有代码与测试
- [ ] 188 + 对战 BO3 + 无尽 + 训练
- [ ] 360/375/1280 可打完一轮
- [ ] `npm test` `npm run build` 绿；destroy 干净
- [ ] 未改 fight-king；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 A、加深点对照表、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
