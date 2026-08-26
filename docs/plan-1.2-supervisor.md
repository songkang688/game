# 一朵一星 1.2 · 主管文档（A 档）

> **权威声明：1.2 以 `docs/plan-1.2-*` 为准。** 旧的 `docs/game-1.2/`（`00-supervisor.md`、`00-index.md`、
> `00-catalog.md`、`00-id-map.md`、`step-01.md`、`new-games/`、`upgrades/`，一步一份、步号跳到 57）**整体作废**，
> 只留作历史参考。旧目录不删（避免大段 diff 掩盖真正的改动），但**不再更新、不再按它派发**；两边冲突时一律听本文件。
>
> 目录：[`plan-1.2-index.md`](./plan-1.2-index.md) · 登记表：[`plan-1.2-tracker.md`](./plan-1.2-tracker.md)
> 1.1 对照：`docs/upgrade-prompts/11-game-1.1-dispatch-prompts.md`、`docs/plan-1.1-step10-A-fight-king.md`（`origin/game-1.1`）

本档作者**只写提示词 Markdown**：不实现任何游戏，不改任何 `src/**`，也不再用 Task 派生云端子代理去写代码。

---

## 〇、一句话

1.2 全部工作推 **`game-1.2`**，不改 `main`、不合并回 `main`。共 **30 个派发步**、**76 款游戏**（库存 55 + 新增 21）。
派发采用**三窗口滚动**：任何时刻都有且只有 **3 个云端子代理在跑**，谁交卷就立刻按登记表补下一格。
执行子代理的模型 slug 只写进提示词正文：`claude-opus-5-thinking-high-fast`（**不带方括号**）。

---

## 一、主管职责

主管只做编排，不写游戏实现。逐条照做：

1. **先对齐基线（步 0，派第 1 步之前必须做完）。** 见第三节。`game-1.2` 目前落后 `origin/game-1.1` 29 个提交，缺 1.1 的成品，直接开工会重复劳动。
2. **维持三窗口。** 任何时刻保持 3 个子进程在跑；一个交卷、验收通过后**立刻**从登记表里取下一格补上，不要空窗，也不要一次开到 4 个。规则见第二节。
3. **派发前先登记，派发后再改状态。** 每次派发前打开 [`plan-1.2-tracker.md`](./plan-1.2-tracker.md)，确认那一格是「未派」，写上窗口号与派发时间并提交，再去开子代理。**没登记就不许派**——这是唯一的防重派机制。
4. **验收才算完。** 子代理回复了不算完；必须确认 `origin/game-1.2` 上真有它的提交、`npm test` 与 `npm run build` 全绿、独占文件没越界、商标扫描 0 命中，才把那一格标「已验收」。
5. **文件所有权仲裁。** 两人改了同一路径：以该步文档里写明的独占者为准，另一方 revert 自己的越界 diff。公共契约文件（内容逐字相同的新文件）rebase 时会自动跳过，不算冲突。
6. **测试水位只升不降。** 只许加测试，不许删测试、不许调低断言。每步合入后把新的用例总数写进登记表备注，作为下一步的水位。
7. **商标扫描。** 每步合入后 `rg` 一遍第六节黑名单（含代码注释）。命中就打回，不准进入下一步。
8. **不套娃。** 主管自己若是被派发的云端子代理，禁止再用 Task 派生执行者；只有真正的派发方才用 Task。

---

## 二、三窗口滚动派发（任何时刻 3 个子进程）

### 2.1 基本规则

- 三个窗口记作 **W1 / W2 / W3**。每个窗口同一时间只跑一个子代理、只认领登记表里的一格。
- 一格 = 「某一步的某一档」（例如「第 12 步 · B 档 `sky-squad`」）。全项目共 30 × 3 = **90 格**。
- 窗口空出来后，按登记表**从上往下**取第一格「未派且依赖已满足」的格子；取之前先登记，避免两个窗口抢同一格。
- 子代理被打回重做时，**占用原窗口继续做**，不算新格。

### 2.2 依赖闸门（什么时候可以跨步流水，什么时候必须等）

| 闸门 | 规则 |
| --- | --- |
| 第 1 步（平台） | **三格全部验收通过**才允许开第 2 步任何一格。全库都要 import 这一步的契约与基建，不能边改边用。 |
| 第 2–8 步（新游戏） | 每格是一款独立新目录，互不相交，**可以跨步流水**。W1 做第 3 步 A、W2 做第 3 步 C、W3 已经跑第 4 步 B，完全允许。 |
| 第 9–26 步（升级） | 同一款游戏**永远只能有一个窗口**在改（登记表一格一款，天然满足）。跨步流水允许。 |
| 新游戏 → 升级 | 第 9 步的第一格必须等到**第 2–8 步全部 21 格验收通过**再开。升级步会碰首页与共享模块，和新目录并发容易撞 `styles.css`。 |
| 第 27 步（冲突 / 接线） | 必须等第 1–26 步**全部 78 格**验收通过。这一步就是收全场的，不许提前。 |
| 第 28 / 29 / 30 步（验收三轮） | **严格串行**：一轮的三格全绿才开下一轮。轮内 A/B/C 三格同时跑（这正好把三个窗口占满）。 |

### 2.3 派发口令（每段执行提示词开头**逐字**这四行）

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

紧跟着必须有这句（防止执行者又去套娃派发）：

> 【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

不要在 slug 上加方括号（1.1 原文带了方括号，1.2 不要）。

### 2.4 每个执行子代理的 git 纪律

开工：

```bash
git fetch origin game-1.2
git checkout -B <你的工作分支> origin/game-1.2
# 先提交一条「工作计划 / 基线」commit，再动代码
```

收尾：

```bash
git fetch origin game-1.2
git rebase origin/game-1.2        # 有冲突就解冲突,绝不 force
npm test && npm run build         # rebase 后必须重跑,必须全绿
git push origin HEAD:game-1.2     # 普通推送;被拒就再 fetch+rebase 重来
```

禁止：`git push --force`、`--force-with-lease`、改 `main`、merge 进 `main`、用 `gh` 开 / 改 / 合 PR（`gh` 只读，只用来看 CI 日志）。
若环境提供 `ManagePullRequest`，PR 的 base 一律 `game-1.2`。

---

## 三、步 0 · 对齐基线（派第 1 步之前主管自己做）

`game-1.2` 是在 1.1 第 6 步中途（`71eb519`）拉出来的，`src/` 内容是 `origin/game-1.1` 的**严格子集**，
双方在 `src/` 下没有互相冲突的改动，缺的都是 1.1 后来做完的成品：

| 缺什么 | 具体文件 |
| --- | --- |
| 碰碰车 | `src/games/bumper-cars/**`（10 个文件） |
| 保龄球小馆 | `src/games/bowling-lane/**`（10 个文件） |
| 彩虹跑跑 2.5D / 三键操作 / 无尽 | `src/games/rainbow-run/view3d.ts`、`controls.ts`、`endless.ts` 及其 `*.test.ts` |
| 朵朵冲冲冲 2.5D / 分屏 / 人机 | `src/games/duo-rush/view25d.ts`、`ai.ts`、`keys.ts`、`match.ts` 及其 `*.test.ts` |

做法（主管一次做完，不派给子代理）：

```bash
git fetch origin game-1.1 game-1.2
git checkout -B align-1.1 origin/game-1.2
git merge origin/game-1.1        # 1.2 这边只多了 docs,冲突面极小
npm ci && npm test && npm run build
git push origin HEAD:game-1.2
```

对齐完成后，`game-1.2` 的库存应当是 **55 款**（见第五节清单），
`npm test` / `npm run build` 全绿，并把当时的**用例总数**记到登记表顶部当水位（对齐前 `origin/game-1.2` @ `71eb519` 是 142 文件 / 3918 用例，合入 1.1 后会更高，以实跑为准）。

---

## 四、步号 1→30 连续总表

**步号连续，不跳号，不留空隙。** 「33 步」只是当初随口举的例子，不套；旧稿的 38 步 / 36 步（步号跳到 57）也作废。

| 步 | 主题 | A 位 | B 位 | C 位 | 提示词文档谁写 |
| --- | --- | --- | --- | --- | --- |
| 1 | 平台基建 | root 管理员门 + 直达第 N 关 | 手游 / 端游筛选 + 手机文字 | 闯关 / 对战 / 无尽口径 + 2.5D 基建 | **A（已写）** |
| 2 | 新游戏 · IO 与方块 | `orb-arena` | `snake-royale` | `block-drop` | B |
| 3 | 新游戏 · 深度格斗与桌游 | `combo-clash` | `mahjong-bloom` | `star-estate` | B |
| 4 | 新游戏 · 策略棋牌 | `hero-cards` | `weiqi-garden` | `flight-chess` | B |
| 5 | 新游戏 · 数字益智 | `merge-2048` | `mine-garden` | `sudoku-petal` | B |
| 6 | 新游戏 · 手感休闲 | `dot-maze` | `fruit-stack` | `pool-stars` | B |
| 7 | 新游戏 · 棋类扩展 | `junqi-camp` | `chess-garden` | `dark-chess` | B |
| 8 | 新游戏 · 轻量三款 | `hue-hand` | `hop-pads` | `tap-tiles` | B |
| 9–26 | 升级 · 55 款精细化，每步 3 款 | 见 4.1 | 见 4.1 | 见 4.1 | C |
| 27 | 冲突 / 串味 / 首页接线 / 全局回归 | 存档与 root API 审计 | 首页接线：76 款 `platform` / `modes` 填准 | CSS / 快捷键 / `destroy` 泄漏审计 | C |
| 28 | 验收三人组 第 1 轮 | 测试员 | 学习优化员 | 监督修复员 | C |
| 29 | 验收三人组 第 2 轮 | 测试员 | 学习优化员 | 监督修复员 | C |
| 30 | 验收三人组 第 3 轮（收官） | 测试员 | 学习优化员 | 监督修复员 | C |

- 阶段切分：平台 **1** 步 + 新游戏 **7** 步（21 款）+ 升级 **18** 步（55 款）+ 收尾 **4** 步 = **30**。
- 第 1 步与第 27 步都会碰 `src/ui/home.ts` 与 `src/styles.css`：两步天然相隔 25 步，**不会并发**。

### 4.1 第 9–26 步的分配规则（主管定不变量，C 档定顺序）

升级阶段的**结构由主管定死，顺序交给 C 档**——C 档在写正文时更清楚哪些游戏该排在前面（用户点名的先做）。
不变量只有四条，违反就打回：

1. **步号 9–26，正好 18 步**，一步 3 格（A/B/C），不许多开一步、不许跳号。
2. 第五节 5.1 那 **55 款每一款出现且只出现一次**，不许漏、不许重。
3. 一格一款；因为 55 不是 3 的倍数，允许**且只允许一格放两款**（建议放在第 26 步 C 位），
   写那一格的提示词时要写明工作量翻倍、用例下限也翻倍。
4. `xiangqi` **只升级，不新建**；`bumper-cars` 与 `bowling-lane` 要排在步 0 对齐基线之后（它们是 1.1 的成品）。

建议的分组思路（不是命令）：用户点名过的老游戏排前面，同类玩法凑一步（塔防、射击、消除、学习各成一组），
同一个共享模块的使用者尽量不同步（例如 `rainbow-run` 与 `duo-rush` 都要换用引擎版 `view25d`，分开两步做）。

**校准动作：** C 档 90 份文档交齐后，主管照 C 的实际文件名把「步号 → 施工 id」抄回
[`plan-1.2-tracker.md`](./plan-1.2-tracker.md) 的阶段三表格，并对着 5.1 的 55 款清单**逐个打勾**确认无漏无重，
然后才允许派第 9 步。C 档已落地的部分（第 9 步 `gomoku` / `match-stars` / `rainbow-run`，
第 10 步 `ocean-munch` / `xiangqi` / `fight-king`，第 11 步 `duo-rush` / `duo-arena` / `duo-vs-star`，
第 12 步 `sling-birds` / `candy-swing` / `gold-hook` …）即按此规则收编，不必回炉重排。

---

## 五、施工 id 定稿（A 档拍板，不再有第二套）

### 5.1 库存 55 款（只升级，不新建目录）

`adventure-king` `alien-seek` `balloon-pop` `bomb-buddies` `bowling-lane` `box-hamster` `brave-path` `brick-break`
`bubble-aim` `bubble-pop` `bumper-cars` `candy-swing` `clock-house` `color-fun` `duo-arena` `duo-rush` `duo-vs-star`
`fight-king` `find-diff` `fishing-star` `fruit-catch` `fruit-slice` `garden-guard` `gold-hook` `gomoku`
`ice-fire-forest` `kitty-care` `landlord-cards` `lianliankan` `match-stars` `math-farm` `memory-cards` `mole-pop`
`monster-crisis` `music-stars` `ocean-munch` `pinyin-train` `poop-hero` `prince-princess` `puff-bros` `puzzle-tiles`
`rainbow-run` `red-blue-race` `red-blue-tap` `red-blue-tug` `shape-kingdom` `shoot-range` `sky-squad` `sling-birds`
`snake-snack` `snow-fight` `sprout-defense` `tank-battle` `word-garden` `xiangqi`

以 `origin/game-1.1` 实际目录点清，共 **55** 个。象棋 `xiangqi` **只做升级，绝不新建第二个象棋目录**。

### 5.2 新建 21 款（施工 id 定稿，一个 id 一个目录）

用户点名的 9 款：

| # | 点名 | 施工 id | 中文名 | 分类 | 一句话定位 |
| --- | --- | --- | --- | --- | --- |
| 1 | 球球 IO | `orb-arena` | 圆圆吞星场 | `party` | 本地人机模拟的吞噬竞技场，越吃越大、越大越慢 |
| 2 | 蛇蛇 IO | `snake-royale` | 长蛇争星场 | `party` | 围堵与卡位，撞到别人身体就散成星星重开 |
| 3 | 方块 | `block-drop` | 方块落落乐 | `casual` | 下落堆叠消行，含 SRS 式旋转与预览、暂存 |
| 4 | 格斗（**要比 `fight-king` 更深**） | `combo-clash` | 连招擂台 | `party` | 帧数据 + 取消表 + 判定框可视化的进阶格斗 |
| 5 | 麻将 | `mahjong-bloom` | 花开麻将 | `party` | 四人立式麻将，含听牌提示与番种计算 |
| 6 | 大富翁 | `star-estate` | 星光地产街 | `party` | 掷骰买地建楼，事件卡与破产判定 |
| 7 | 三国杀类 | `hero-cards` | 英雄牌局 | `party` | 身份局卡牌，原创武将与技能，回合出牌 |
| 8 | 围棋 | `weiqi-garden` | 围棋小院 | `party` | 9/13/19 路，气与提子、打劫、数目 |
| 9 | 飞行棋 | `flight-chess` | 飞行棋小站 | `party` | 四色棋子，起飞、叠子、撞子、跳跃 |

补位 12 款：

| # | 施工 id | 中文名 | 分类 | 一句话定位 |
| --- | --- | --- | --- | --- |
| 10 | `merge-2048` | 翻倍方块 | `casual` | 滑动合并同数，含撤销与目标格 |
| 11 | `mine-garden` | 花园探雷 | `casual` | 数字推理排雷，保证首点安全、可无猜生成 |
| 12 | `sudoku-petal` | 花瓣数独 | `edu` | 唯一解生成 + 分级提示，不直接给答案 |
| 13 | `dot-maze` | 点点迷宫 | `action` | 迷宫吃点躲巡逻，原创卡通追逐者 |
| 14 | `fruit-stack` | 水果叠叠高 | `casual` | 摆放物理堆叠，重心与倒塌判定 |
| 15 | `pool-stars` | 星星桌球 | `casual` | 台球碰撞物理，瞄准线与旋转 |
| 16 | `junqi-camp` | 军棋营地 | `party` | 暗棋式军棋，行营大本营与裁判判子 |
| 17 | `chess-garden` | 国际象棋花园 | `party` | 完整走子规则 + 王车易位 / 吃过路兵 / 升变 |
| 18 | `dark-chess` | 翻翻棋 | `party` | 翻开式暗棋，大小相克与炮吃 |
| 19 | `hop-pads` | 跳跳格子 | `action` | 蓄力跳台，落点判定与连跳加成 |
| 20 | `tap-tiles` | 节拍方块 | `create` | 节奏点击，谱面纯数据生成，无外部音源 |
| 21 | `hue-hand` | 调色小手 | `create` | 配色调和练习，色环与互补色 |

命名红线：以上中文名全是原创，**不许**在代码或文案里出现「大富翁」「三国杀」「俄罗斯方块」「扫雷」等商业商标或原作名（`meta.blurb`、章节名、攻略、注释一律禁止；「数独」「围棋」「军棋」「飞行棋」「麻将」「国际象棋」这类**通用棋类名词**可以用）。

### 5.3 和旧稿的关系

旧 `docs/game-1.2/00-catalog.md` / `00-id-map.md` 里那三套 id（catalog 一套、new-games 一套、upgrades 一套）**全部作废**。
只认本节 5.2 这一套。旧稿里 B 没做的候选（`petal-scout`、`lily-hop`、`reversi-ink`、`klondike-cards`、`beat-tap`、
`kart-dash`、`glow-survivor`、`air-puck`、`star-soccer`、`star-hoops`、`navy-grid`、`run-fast-cards` 等）**1.2 第一波不做**，
想做就等 1.3，不许在 30 步里偷偷加目录。

---

## 六、root 管理员门（产品规定，第 1 步 A 实现）

这是给**家里管理员**用的，不是给孩子闯关用的。1.1 的算术家长门 `parentAuth`（basic / high、5 分钟、只在内存）**原样保留**，
继续负责「跳过当前这一关」；root 门负责「我就是管理员，我要随便玩第 XX 关」。

| 项 | 规定 |
| --- | --- |
| 默认密码 | `kangkang`（写成代码常量，本地全家桶，不联网、不做账号） |
| 要打开请联系 | 管理员 **18438037080**（弹窗上必须原样展示这句话） |
| 打开后能做什么 | 任意跳关；选关地图出现「直达第 N 关」输入框（1–188）；可直接进未解锁的关 |
| 可关闭 | 弹窗与家长面板都要有「关闭管理员权限」按钮，按下立刻失效 |
| 默认过期 | **打开后 1 小时自动关闭**（`expiresAt = Date.now() + 3600000`，每次判定都用当前时间比） |
| 存档 | 只写 `yiduo-yixing.root.v1` = `{ expiresAt: number }`；**密码绝不写进 localStorage / sessionStorage / cookie** |
| 与算术门的关系 | root 开着 → 跳关 / 直达**不必再做算术题**；root 关着 → 继续走 1.1 的 `getLevelExtras().requestSkip` → `requestParentAuth("high")` |
| 防暴力 | 密码连错 3 次锁 120 秒（用可注入的假时钟，测试里不许真 sleep）；输入框 `type="password"`；沿用 `dialog--shake` |
| 孩子界面 | 首页不出现显眼的「root」字样，按钮文案叫「管理员权限」；入口放在已有家长面板旁边的折叠段；关卡地图只在 `isRootOpen()` 为真时渲染直达控件 |

---

## 七、手游 / 端游筛选与手机文字（第 1 步 B）

- `GameMeta` 增加可选字段 `platform?: "mobile" | "desktop" | "both"`，**缺省当 `both`**；第 1 步不去批量改 55 个 `meta.ts`（那是第 27 步 B 的活）。
- 首页芯片文案就三个中文词：**全部 / 手游 / 端游**，可与分类页签、玩法芯片、搜索自由组合。
- 手机文字硬验收视口 **360 × 640**：正文 ≥ 16px、标题在 360 宽不小于 20px、行高 ≥ 1.4、长文案必须换行、
  对比度 ≥ 4.5:1、底部留安全区。详见 [`plan-1.2-step1-B-platform-filter.md`](./plan-1.2-step1-B-platform-filter.md)。

---

## 八、法律与分级红线（违反即打回，全 30 步适用）

- 面向孩子的一切可见文案（`title` / `blurb` / 章节名 / 角色名 / 提示语 / 攻略 / README）**以及代码注释**，禁止出现商业商标与官方角色名。
  黑名单（`rg -i` 至少扫这些，命中即打回）：
  `愤怒的小鸟` `植物大战僵尸` `水果忍者` `地铁跑酷` `森林冰火人` `屁王兄弟` `拳皇` `街霸` `超级玛丽` `马里奥` `割绳子`
  `俄罗斯方块` `Tetris` `贪吃蛇大作战` `球球大作战` `我的世界` `Minecraft` `三国杀` `大富翁` `斗地主`（游戏名可留 `landlord-cards`，中文标题用原创名）
  `Pac-?Man` `吃豆人` `扫雷`（Windows 语境）`宝可梦` `皮卡丘` `奥特曼` `喜羊羊` `蛋仔` `原神` `王者荣耀`。
- 内部研究原作玩法是允许的（用户自用、非商业发行），但**研究结论只许体现为玩法结构**，不许把原作名字、角色、素材、配色标识带进代码或文案。
- 角色只用本作原创：**朵朵**（小花）、**星星**，以及糯糯 / 云云 / 墩墩 / 闪闪 / 绿绿豆 / 啾啾。
- 无血、无伤口、无死亡描写。体力条叫「元气」，招式只写「威力」不写「伤害」。被击中只有星星飞溅 / 眩晕转圈 / 冒烟迫降 / 摊手坐下。
- 失败文案**永远只鼓励、不批评**；年龄定位约小学六年级，不低幼（不写「宝宝」「乖乖」「小笨蛋」），保持中文粉彩萌系。
- 无广告、无内购、无账号、无联网上报。IO 类一律**本地人机模拟**，禁止 Socket 服务器。
- 不引入任何外部运行时依赖（无 CDN 字体、无外链音源、无统计 SDK、**禁止 three.js**）；离线可玩是底线。
- 不把 `dist/`、`release/`、安装包、APK、大图或视频提交进 git。

## 九、必须继承的 1.1 技术约定（每份执行提示词都要重申）

1. 目录结构：`src/games/<id>/meta.ts`（纯数据，首页 eager 收集，**不许 import 玩法代码**）+ `index.ts`（顶部 `export { meta } from "./meta"`，导出 `mount(api): { destroy }`，懒加载）。
2. 存档 key 只增不改语义：`yiduo-yixing.save.v1`、`yiduo-yixing.l99.<id>`（188 长）、`yiduo-yixing.l99skip.<id>`、
   `yiduo-yixing.collection.v1`、`yiduo-yixing.fav.v1`、`yiduo-yixing.recent.v1`，1.2 只新增 `yiduo-yixing.root.v1`。
3. 闯关类走通用框架 `src/games/level99.ts`（`TOTAL_LEVELS = 188`、`mountLevelGame`）；学习答题走 `src/games/quiz99.ts`；朗读走 `src/games/speech.ts`。
4. 音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。
5. 双人键位：**朵朵 = `WASD` + `F`（动作）+ `G`（副动作）**；**星星 = `↑←↓→` + `L` + `K`**；`Esc` 暂停。手机 / 平板必须有等价触屏控件（这是 PWA，不能只支持键盘）。
6. `destroy` 必须清干净：`window` / `document` 监听、`setInterval` / `setTimeout`、`requestAnimationFrame`、`AudioContext` 节点。
7. `prefers-reduced-motion` 下关闭抖动与闪烁。
8. 每款游戏都要能回答三个问题：**能闯关吗？能对战吗？能无尽吗？** 不适用的写明理由，并把 `meta.modes` 填准。
9. 新游戏每款 ≥ 15 个单测；升级步每款**新增** ≥ 8 个单测。只增不减。

---

## 十、监督清单（每一格合入时逐条打勾）

```
步号：____   档：__   施工 id / 主题：____________   窗口：W_   日期：____
[ ] 登记表里这一格是「在跑」状态,没有第二个窗口在做
[ ] 子代理回复写了:角色、改了哪些文件、新增用例数、推送 SHA、模型 slug = claude-opus-5-thinking-high-fast
[ ] origin/game-1.2 上确实有这些提交(git log --oneline origin/game-1.2 | head)
[ ] npm test 全绿,用例总数 ≥ 上一格水位
[ ] npm run build 全绿
[ ] 没人 force push、没人改 main、没人用 gh 开/合 PR
[ ] rg 商标黑名单 0 命中(含注释)
[ ] 存档 key 语义没变,没引入外部运行时依赖
[ ] git diff --name-only 与本格独占文件清单一致,无越界
[ ] 新游戏:meta.ts 不 import 玩法;index.ts 懒加载;≥15 用例
[ ] root 门若涉及:1 小时过期、可手动关、电话文案在、密码不落盘
[ ] 登记表改成「已验收」并写上 SHA 与新用例总数
```

冲突处理：

1. 同一格两人都改了同一文件 → 非独占者 revert 自己的 hunk。
2. 公共契约内容不一致 → 以 [`plan-1.2-step1-A-root-gate.md`](./plan-1.2-step1-A-root-gate.md) 里的逐字版本为准，其余人改成一样。
3. rebase 冲突 → 先保独占者的 hunk，再跑全量测试。
4. 测试红在别人的文件里 → 写进回复交给主管，本格不许越界去改（除非是自己引入的类型错误波及别人）。

---

## 十一、收口（30 步全部做完之后）

1. **不做巨型总脚本。** 1.1 把 15 步塞进一个 1000 行的文件还行，1.2 是 90 格，塞一个文件没法读。
   收口只做一件事：把 [`plan-1.2-index.md`](./plan-1.2-index.md) 的总表链接补全，确保每一格都能点到自己那份文档。
2. 补一份发布说明 `docs/plan-1.2-release-notes.md`（1.2 相比 1.1 的全部变化，按「新增 21 款 / 55 款精细化 / 平台能力 / 修复」分节）。
3. 更新 `README.md`：合集款数（76）、分类表、188 关体系、对战 / 无尽 / 双人说明、键位表、
   家长功能（算术门 + 管理员门）、手游 / 端游筛选、离线与隐私声明。**必须与代码一致，不许写虚。**
4. 是否把 `game-1.2` 合回 `main` 由用户自己决定，主管不合。

**1.2 收官验收门（第 30 步结束时逐条给结论）：**

- 76 款每一款都能进、能玩到真实胜负、`destroy` 后再进不报错。
- 首页手游 / 端游筛选可用；76 款的 `platform` 与 `modes` 都填准了。
- root 门：密码对 → 能直达第 N 关；1 小时后自动关；能手动关；电话文案在；密码不落盘。
- 360px 宽抽 10 款 + 首页：文字不溢出、对比度 ≥ 4.5:1、安全区留白。
- `npm test` / `npm run build` 全绿，用例总数为全程最高水位；PWA 离线可玩。
- 商标黑名单 0 命中；三轮 QA 的阻断 / 严重 / 一般问题全部清零。

---

## 十二、本档（A 主管）的独占文件

只许新建 / 修改这 6 个：

- `docs/plan-1.2-supervisor.md`（本文件）
- `docs/plan-1.2-tracker.md`
- `docs/plan-1.2-index.md`
- `docs/plan-1.2-step1-A-root-gate.md`
- `docs/plan-1.2-step1-B-platform-filter.md`
- `docs/plan-1.2-step1-C-modes-view.md`

A **不写** `plan-1.2-step2-*` 及以后（B 从第 2 步写新游戏，C 从第 9 步写升级到第 30 步）。
A **不改** `src/**`、不改 `README.md`、不大段删 `docs/game-1.2/`（旧目录留着，只在本文件声明作废即可）。
