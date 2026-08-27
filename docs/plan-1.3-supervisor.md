# 一朵一星 1.3 · 主管文档（A 档）—— 前端视觉 / 建模 / 布局 / Q 版人物

> **权威声明：1.3 以 `docs/plan-1.3-*` 为准。** 1.2 的玩法工作已经收官（76 款、`origin/game-1.2` 为权威基线），
> 1.3 **只升级前端视觉**：建模、布局、动效、Q 版人物与共享素材。玩法代码、关卡数值、胜负规则一律不动。
>
> 目录：[`plan-1.3-index.md`](./plan-1.3-index.md) · 登记表：[`plan-1.3-tracker.md`](./plan-1.3-tracker.md) ·
> 视觉宪法：[`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) · skills 说明：[`plan-1.3-skills.md`](./plan-1.3-skills.md)
> 1.2 对照：[`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) · [`plan-1.2-index.md`](./plan-1.2-index.md)

本档作者**只写提示词 Markdown 并 vendoring 审美 skills**：不实现任何游戏或素材代码，不改 `src/**`，
也不再用 Task 派生云端子代理去写代码。

---

## 〇、一句话

1.3 全部工作推 **`game-1.2-kk`**（基线 `origin/game-1.2`），不改 `main`、不合并回 `main`、不 push 到 `game-1.2`。
共 **29 个派发步**、**76 款游戏**（分档与 [`plan-1.2-index.md`](./plan-1.2-index.md) 第 2–26 步**完全同一套 id**）。
派发沿用 1.2 的**三窗口滚动**。执行子代理的模型 slug 只写进提示词正文：`claude-fable-5-thinking-xhigh`（**不带方括号**）。

> ⚠️ 远端另有分支 `origin/1.2-kk`（品牌改名，另一摊活）。**名字很像但不是一回事**，不要往那推、不要从它砍分支。

---

## 一、主管职责

主管只做编排，不写素材实现。逐条照做：

1. **先对齐基线（步 0，本档已做完）。** `game-1.2-kk` 已从 `origin/game-1.2` 砍出并推送，见第三节。
2. **维持三窗口。** 任何时刻保持 3 个子进程在跑；一格验收通过后立刻按登记表补下一格，不空窗、不超编。
3. **派发前先登记，派发后再改状态。** 每次派发前打开 [`plan-1.3-tracker.md`](./plan-1.3-tracker.md)，
   确认那一格是「未派」，写上窗口号与派发时间并提交，再开子代理。**没登记就不许派。**
4. **验收才算完。** 必须确认 `origin/game-1.2-kk` 上真有提交、`npm test` 与 `npm run build` 全绿、
   独占文件没越界、商标扫描 0 命中（命令见宪法第八节）、**素材契约测试新增 ≥ 8 例**、
   实机 360px 截图（或等价描述）过了宪法第七节门槛，才标「已验收」。
5. **审美抽验。** 视觉步特有：每格验收时对照 [`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) 第二节负面清单抽验
   —— 还有火柴人 / 色块金币 / 1px 障碍的直接打回，不论测试多绿。
6. **方案先行。** 执行者必须先交「深度审美评测 + 极高质量改进方案」（宪法第十节）再动手；成品与方案不符的打回。
7. **文件所有权仲裁 / 测试水位只升不降 / 不套娃**：沿用 1.2 主管文档第一节原则，不重复。

---

## 二、三窗口滚动派发

### 2.1 基本规则

沿用 1.2：三窗口 W1 / W2 / W3，一格 =「某一步的某一档」，29 × 3 = **87 格**；
窗口空出来按登记表从上往下取第一格「未派且依赖已满足」；打回占原窗口。

### 2.2 依赖闸门

| 闸门 | 规则 |
| --- | --- |
| 第 1 步（共享视觉基建） | **三格全部验收通过**才允许开第 2 步任何一格。第 2–26 步全都要 import 第 1 步的 kit / 布局 / 跑道套件。 |
| 第 2–26 步（76 款视觉升级） | 一格一款（第 15 步 C 两款），互不相交，**可以跨步流水**。同一款游戏永远只有一个窗口在改。 |
| 涉共享文件的例外 | 凡要动 `src/styles.css`、`src/ui/home.ts`、`src/ui/gameShell.ts` 的格子（原则上只有第 1 步 B），不许与其他动这几个文件的格子并发。第 2–26 步**只改自己游戏目录**，不碰共享文件。 |
| 第 27 / 28 / 29 步（三轮视觉验收） | 必须等第 1–26 步全部 78 格验收通过。**严格串行**：一轮三格全绿才开下一轮；轮内 A/B/C 同跑占满三窗。 |

### 2.3 派发口令（每段执行提示词开头**逐字**这四行）

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-fable-5-thinking-xhigh`。
请在独立功能分支上进行修改，叫 game-1.2-kk。以 origin/game-1.2 为审美对照基线。不要直接修改 main。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

紧跟着必须有这句（防套娃 + 防越界，逐字）：

> 【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生。全部推 `game-1.2-kk`，不回 `main`，禁止 force。本步只改视觉/素材/布局，不改关卡数值与胜负规则。】

slug 不要加方括号。

### 2.4 每个执行子代理的 git 纪律

开工：

```bash
git fetch origin game-1.2 game-1.2-kk
git checkout -B <你的工作分支> origin/game-1.2-kk
# origin/game-1.2 只作审美对照基线（看旧画面长什么样),不在它上面开工
# 先提交一条「1.3 第 N 步 / X 档 · <主题>」的工作计划 commit,再动代码
```

收尾：

```bash
git fetch origin game-1.2-kk
git rebase origin/game-1.2-kk      # 有冲突就解,绝不 force
npm test && npm run build          # rebase 后必须重跑,必须全绿
git push origin HEAD:game-1.2-kk   # 被拒就再 fetch+rebase 重来
```

禁止：`git push --force`（含 `--force-with-lease`）、push 到 `game-1.2`、改 `main`、合并进 `main`、
用 `gh` 开 / 改 / 合 PR（`gh` 只读）。若环境提供 `ManagePullRequest`，PR 的 base 一律 `game-1.2-kk`。

---

## 三、步 0 · 分支基线（本档已做完）

- `game-1.2-kk` 由本档从 `origin/game-1.2` 砍出：`git checkout -B game-1.2-kk origin/game-1.2`，随本批文档一起推送。
- 基线即 1.2 收官态：**76 款游戏**（`src/games/` 下 76 个游戏目录）、`src/engine/view25d.ts` / `playModes.ts` 等 1.2 基建齐备。
- 用例水位（本档在基线 `fe8e382` 上实跑 `npx vitest run`）：**698 测试文件 / 14994 用例全绿**；此后每格只升不降。
- 再次强调：`origin/1.2-kk` 是**另一摊**（品牌改名），与本分支无关。

---

## 四、步号 1→29 连续总表（分档与 1.2 第 2–26 步完全同一套 id）

- 第 1 步：共享视觉基建，A 档（本档）已写三份。
- 第 2–26 步：**id、步号、档位与 [`plan-1.2-index.md`](./plan-1.2-index.md) 第 2–26 步逐格相同**，方便两版对照。
  每格的活从「实现 / 升级玩法」换成「深度审美评测 + 视觉重制」。
- 第 27–29 步：三轮视觉验收（测试员 / 学习优化员 / 监督修复员），提示词由 C 档同事写，本表只留链接位。

| 步 | 主题 | A 位 | B 位 | C 位 | 提示词谁写 |
| --- | --- | --- | --- | --- | --- |
| 1 | 共享视觉基建 | 共享角色与道具素材包 `src/art/kit/` | 首页 / 关卡壳 / 结算布局动效 | 跑酷跑道 2.5D·3D 共享套件 `src/art/runner/` | **A（已写）** |
| 2 | IO 与方块 | `orb-arena` | `snake-royale` | `block-drop` | B |
| 3 | 深度格斗与桌游 | `combo-clash` | `mahjong-bloom` | `star-estate` | B |
| 4 | 策略棋牌 | `hero-cards` | `weiqi-garden` | `flight-chess` | B |
| 5 | 数字益智 | `merge-2048` | `mine-garden` | `sudoku-petal` | B |
| 6 | 手感休闲 | `dot-maze` | `fruit-stack` | `pool-stars` | B |
| 7 | 棋类扩展 | `junqi-camp` | `chess-garden` | `dark-chess` | B |
| 8 | 轻量三款 | `hue-hand` | `hop-pads` | `tap-tiles` | B |
| 9 | 点名一 | `gomoku` | `match-stars` | `rainbow-run`（伪 3D 目标款） | B |
| 10 | 点名二 | `ocean-munch` | `xiangqi` | `fight-king` | B |
| 11 | 双人对战 | `duo-rush`（伪 3D 目标款） | `duo-arena` | `duo-vs-star` | B |
| 12 | 物理弹射 | `sling-birds` | `candy-swing` | `gold-hook` | B |
| 13 | 塔防三连 | `garden-guard` | `sprout-defense` | `monster-crisis` | B |
| 14 | 射击三连 | `shoot-range` | `sky-squad` | `tank-battle` | B |
| 15 | 派对乱斗 + 场地纵深 | `bomb-buddies` | `snow-fight` | `bumper-cars` + `bowling-lane`（唯一两款位；球道 / 场地 2.5D） | C |
| 16 | 双人平台闯关 | `ice-fire-forest` | `puff-bros` | `prince-princess` | C |
| 17 | 冒险线 | `brave-path` | `adventure-king` | `alien-seek` | C |
| 18 | 手感小品 | `brick-break` | `mole-pop` | `box-hamster` | C |
| 19 | 泡泡三连 | `balloon-pop` | `bubble-pop` | `bubble-aim` | C |
| 20 | 水果与蛇 | `fruit-catch` | `fruit-slice` | `snake-snack` | C |
| 21 | 记忆与拼图 | `lianliankan` | `puzzle-tiles` | `memory-cards` | C |
| 22 | 牌桌与钓场 | `landlord-cards` | `fishing-star` | `poop-hero`（俯冲段 2.5D） | C |
| 23 | 红蓝三连 | `red-blue-race`（赛道 2.5D） | `red-blue-tap` | `red-blue-tug` | C |
| 24 | 学习一 | `clock-house` | `math-farm` | `pinyin-train` | C |
| 25 | 学习二 | `word-garden` | `shape-kingdom` | `find-diff` | C |
| 26 | 创作与养成 | `color-fun` | `music-stars` | `kitty-care` | C |
| 27 | 视觉验收 第 1 轮 | 测试员 | 学习优化员 | 监督修复员 | C |
| 28 | 视觉验收 第 2 轮 | 测试员 | 学习优化员 | 监督修复员 | C |
| 29 | 视觉验收 第 3 轮（收官） | 测试员 | 学习优化员 | 监督修复员 | C |

- 提示词写作分工：**A** = 总纲 4 份 + skills 文档 + 第 1 步 3 份；**B 档同事** = 第 2–14 步（39 份）；
  **C 档同事** = 第 15–26 步（36 份，含 15-C 双款一份）+ 第 27–29 步（9 份），合计 87 份。
  文件命名沿用 1.2：`docs/plan-1.3-step<步号>-<档>-<游戏 id 或角色>.md`。
- **2.5D / 伪 3D 必升名单**（宪法第五节口径）：`rainbow-run`、`duo-rush`、`red-blue-race`、
  `bumper-cars`、`bowling-lane`、`poop-hero`（俯冲段）、`hop-pads`（跳台纵深）。
  其余动作 / 跑酷款由执行者在审美评测里给出定级建议，主管拍板。
- 第 15 步 C 仍是全项目唯一「一格两款」。

---

## 五、共享视觉基建契约（第 1 步产出，第 2–26 步消费）

| 模块 | 契约（只在提示词里规定，本档不实现） | 出处 |
| --- | --- | --- |
| `src/art/kit/` | 朵朵 / 星星及皮肤的角色绘制函数、通用金币 / 星星 / 爱心 / 障碍绘制、调色板常量、粒子与阴影工具；纯 Canvas 2D 矢量、可 import、零 DOM 依赖（渲染函数只吃传入的 context） | [`step1-A`](./plan-1.3-step1-A-art-kit.md) |
| `src/ui/**` 布局动效层 + `src/styles.css` | 首页卡片 / 关卡壳 / 结算画面的布局节奏、入场与结算动效、reduced-motion 降级；不改任何游戏逻辑 | [`step1-B`](./plan-1.3-step1-B-layout-motion.md) |
| `src/art/runner/` | 跑酷 / 跑道类 2.5D·3D 共享渲染套件：三车道跑道、分层视差天空、深度精灵、速度线与雾化；基于既有 `src/engine/view25d.ts`，**禁止 three.js** | [`step1-C`](./plan-1.3-step1-C-3d-runner.md) |

规则：第 2–26 步凡画朵朵 / 星星 / 通用金币，**必须 import kit**；凡做纵深跑道，**必须 import runner 套件**；
发现 kit / runner 缺能力，写进回复由主管决定是否加派基建补丁格，**不许在自己游戏目录里复制一份改**。

---

## 六、vendored skills（本档已下载进仓库）

前端审美方法论已 vendoring 到 **`.cursor/skills/1.3-visual/`**（来源、commit、许可证、剔除项见目录内 `README.md`）：
`frontend-design`、`canvas-design`、`algorithmic-art`、`theme-factory`（Apache-2.0，anthropics/skills）
与 `character-sprite-maker`（Apache-2.0，Clad3815）。
每个 skill 干什么、执行者何时读取，见 [`plan-1.3-skills.md`](./plan-1.3-skills.md)。
红线：skills 只在设计期读，**不进 `dist/`、不 import 进 `src/**`、不引入任何运行时依赖**。

---

## 七、法律与分级红线

全部见 [`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) 第二、六、八节：1.2 黑名单原样生效并追加视觉侧红线
（不复刻剪影 / 配色标识 / UI 商标），商标扫描排除 `.cursor/skills/**`，不提交任何位图 / 字体 / 音频二进制。

## 八、必须继承的技术约定（每份执行提示词都要重申）

1. 1.2 主管文档第九节全部约定继续生效（目录结构、存档 key、`level99.ts` / `quiz99.ts`、`api.play` 音效、
   双人键位、`destroy` 清理、`prefers-reduced-motion`、meta 三问）。
2. 1.3 追加：**不改玩法**——`logic.ts` / `levels.ts` / 胜负判定 / 数值调参一律不碰；只改渲染、素材、布局、动效与其测试。
   渲染与逻辑耦合在一个文件里的，允许**只动渲染函数**并在回复里说明拆分范围。
3. 素材全部矢量代码化；**禁止 three.js 与一切外部运行时依赖**；不提交二进制素材。
4. 每个视觉步新增素材契约测试 ≥ 8 例（宪法第九节），第 1 步三份基建各 ≥ 16 例；只增不减。
5. `meta.ts` 保持纯数据，不 import 任何绘制代码。

## 九、监督清单（每一格合入时逐条打勾）

```
步号：____   档：__   施工 id / 主题：____________   窗口：W_   日期：____
[ ] 登记表里这一格是「在跑」状态,没有第二个窗口在做
[ ] 执行者先交了「深度审美评测 + 改进方案」,成品与方案一致
[ ] 子代理回复写了:角色、改了哪些文件、新增用例数、推送 SHA、模型 slug = claude-fable-5-thinking-xhigh
[ ] origin/game-1.2-kk 上确实有这些提交;没人 push 到 game-1.2、没人改 main、没人 force
[ ] npm test 全绿,用例总数 ≥ 上一格水位;npm run build 全绿
[ ] 素材契约测试新增 ≥ 8 例(第 1 步 ≥ 16 例)
[ ] 宪法负面清单抽验:无火柴人、无色块金币、无 1px 障碍、双人款 A/B 可区分
[ ] 360px 视口:热区 ≥ 44px、HUD 字 ≥ 14px、角色不糊成色块;reduced-motion 降级可用
[ ] rg 商标黑名单 0 命中(排除 .cursor/skills/**)
[ ] 没引入运行时依赖、没提交二进制素材、玩法与数值零 diff
[ ] git diff --name-only 与本格独占文件清单一致,无越界
[ ] 登记表改成「已验收」并写上 SHA 与新用例总数
```

冲突处理沿用 1.2 主管文档第十节四条。

## 十、收口（29 步全部做完之后）

1. 把 [`plan-1.3-index.md`](./plan-1.3-index.md) 总表链接补全，确保每格能点到自己那份文档。
2. 补 `docs/plan-1.3-release-notes.md`（1.3 相比 1.2 的视觉变化，按「共享素材 / 布局动效 / 2.5D 升级 / 逐款重制」分节）。
3. `README.md` 视觉章节更新由收官轮（第 29 步 B）负责，必须与代码一致。
4. `game-1.2-kk` 何时合回 `game-1.2` / `main` 由用户决定，主管不合。

**1.3 收官验收门（第 29 步结束时逐条给结论）：**

- 76 款逐款过宪法第二节负面清单：0 火柴人、0 色块金币、0 线稿障碍。
- 共享角色朵朵 / 星星在所有出场游戏里来自同一套 kit；双人款 A/B 一眼可区分。
- 必升名单 7 款全部具备纵深观感（透视跑道 / 深度缩放 / 视差 / 雾化四件套）。
- 360px 抽 10 款 + 首页过第七节门槛；reduced-motion 全量可用。
- `npm test` / `npm run build` 全绿，用例总数为全程最高水位；PWA 离线可玩、包体无二进制素材膨胀。
- 商标扫描（排除 `.cursor/skills/**`）0 命中。

---

## 十一、本档（A 主管）的独占文件

只许新建 / 修改这 8 项 + vendored skills 目录：

- `docs/plan-1.3-supervisor.md`（本文件）
- `docs/plan-1.3-index.md`
- `docs/plan-1.3-tracker.md`
- `docs/plan-1.3-visual-bible.md`
- `docs/plan-1.3-skills.md`
- `docs/plan-1.3-step1-A-art-kit.md`
- `docs/plan-1.3-step1-B-layout-motion.md`
- `docs/plan-1.3-step1-C-3d-runner.md`
- `.cursor/skills/1.3-visual/**`（vendored，含其 `README.md`）

A **不写** `plan-1.3-step2-*` 及以后（B 档同事写第 2–14 步，C 档同事写第 15–29 步）。
A **不改** `src/**`、不改 `README.md`、不动 1.2 的任何文档、不动别人的 `docs/plan-1.3-*`。
