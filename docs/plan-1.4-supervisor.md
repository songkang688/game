# 一朵一星 1.4 · 主管总纲 —— 玩法体验 / 关卡 / 建模 / 纵深 全幅度优化

> **权威声明：1.4 以 `docs/plan-1.4-*` 为准。** 1.3 收官态 = `origin/game-1.3` @ `3ebc4228`（1.3.4，76 款、188 关、存档保险箱）。
> 1.4 与 1.3 的根本区别：**1.3 只许改视觉，1.4 允许改玩法数值与关卡表**——但只为了「可通关、合理、好玩」，并且每一处改动都要有审计测试证明。
>
> 配套：登记表 [`plan-1.4-tracker.md`](./plan-1.4-tracker.md) · 单款工序规格 [`plan-1.4-worker-game.md`](./plan-1.4-worker-game.md) ·
> 手感套件规格 [`plan-1.4-worker-feel-kit.md`](./plan-1.4-worker-feel-kit.md) · 跑道统一规格 [`plan-1.4-worker-runner-kit.md`](./plan-1.4-worker-runner-kit.md) ·
> 单款纵深规格 [`plan-1.4-worker-depth.md`](./plan-1.4-worker-depth.md) · 三轮验收规格 [`plan-1.4-worker-qa.md`](./plan-1.4-worker-qa.md) · 五窗口提示词 `plan-1.4-window1…5.md` ·
> 仍然生效的 1.3 文件：[视觉宪法](./plan-1.3-visual-bible.md) · [UX 迭代 Playbook](./ux-iteration-playbook.md)（第八、十四节军规）· skills 说明 [`.cursor/skills/gamedev/README.md`](../.cursor/skills/gamedev/README.md)。

---

## 〇、一句话

**5 个窗口 × 每窗 6 个并发工人**，按游戏目录切分所有权，对 76 款游戏逐款做「体检 → 188 关可通关审计 → Bug 修复 → 手感 → UI/UX → 建模 → 纵深」七道工序，
两件共享基建（手感套件、跑道统一）先行。集成分支 **`game-1.4`**（从 `origin/game-1.3` 砍出），窗口分支 `game-1.4-window1…5`，工人模型 slug **`claude-opus-5-5-xhigh-fast`**（不带方括号）。

---

## 一、现状问题（主管本机实测 + 读代码 + 读 313 份 QA 台账得出；派发前每个窗口都要知道）

| # | 问题 | 证据 | 归谁 |
| --- | --- | --- | --- |
| P-1 | **72 款战役游戏没有 188 关可通关性审计**。`src/games/__tests__/campaignSim.ts` 框架早就有，但只有 `rainbow-run`、`fishing-star` 两款在用 `runCampaign` | `rg runCampaign\( src/games` 只中 2 款；各游戏「有解」类测试多数只有 1–3 例且只盖前几关 | 全部窗口，每款必做（工序 B） |
| P-2 | **共享 2.5D 跑道套件 `src/art/runner/` 零消费者**。彩虹跑跑用私有 `view3d.ts`、双人冲刺用私有 `view25d.ts`、金钩 / 弹弓各有 `depth12.ts`——宪法第五节明令「禁止再造第二套透视数学」，现实是四套 | `rg "art/runner" src` 只有套件自己；`engine/view25d.ts` 的消费者是 block-drop / flight-chess / gomoku / merge-2048 / orb-arena 这些**棋盘类**（用的是 reduced-motion 工具函数），不是跑酷 | 窗口 5（工序 G） |
| P-3 | **必升纵深 7 款里 5 款基本没纵深**：red-blue-race 透视相关代码 6 处、poop-hero 2 处、bumper-cars / bowling-lane / hop-pads 只有零散深度缩放 | `rg -c "horizon|scaleAtDepth|fogAlpha|depth"` 逐款统计 | 窗口 5 |
| P-4 | **手感没有统一契约**。92 个文件各写各的 shake，`art/kit/juice.ts` 只是切水果的汁滴池，没有 hit-stop、没有 trauma 衰减、没有 small / medium / large 分档、reduced-motion 各自判断 | `rg -l "shake|hitStop" src/games` = 92 文件，无共享实现 | 窗口 1 先建套件（工序 D 的前置），各窗口接入 |
| P-5 | **UX 降级台账仍在册**：lianliankan 密格、mine-garden 末排、duo-rush 让分芯片、match-stars 末行、balloon-pop 飞行气球（禁改 `SKY_H`）、weiqi-garden N-10 残余、root 密码门 N-109 矮横屏、brick-break L1 画布底切 | `docs/qa/trio-r19-learn-notes.md` 第六节、`trio-r19-tester-B-r11.md` | 对应游戏所属窗口（工序 E）；root 门归窗口 1 |
| P-6 | **`.l99-host{overflow:hidden}` 同族病复发 4 次**（N-75 → N-98 → N-101 → N-108），说明框架缺静态守门；N-100 选关进场锚定卷顶已扩到 17 款 | `ux-iteration-playbook.md` 第八节、r19 笔记第四 / 七节 | 窗口 1（框架守门测试 + `level99.ts` 锚定） |
| P-7 | **画布内菜单是 QA 盲区**：fruit-slice / rainbow-run / sprout-defense / ocean-munch 的开始菜单画在 canvas 里，DOM 量法量不到热区 | r19 笔记第五节 | 各所属窗口：工序 E 要求这类游戏暴露「可测的菜单状态」或改成 DOM 覆盖层 |
| P-8 | **宪法负面清单未逐款复核过**（1.3 验收只在窗口内抽验），且 1.3 禁改玩法导致「渲染与逻辑耦合」的游戏只动了渲染函数，角色动画底线（呼吸 / 眨眼 / 受伤 / 胜利）落实情况不一 | 1.3 各窗 fixer 报告口径 | 各窗口（工序 F） |
| P-9 | **关卡曲线没人看过整体**：66 款有 `levels.ts`，前 99 关是 1.0 参数、后 89 关是 1.1 追加，两段拼接处（第 99 → 100 关）与各章首尾的难度跳变无人审 | 读 `mole-pop/levels.ts` 等头注 | 各窗口（工序 B 的曲线部分） |
| P-10 | **测试体量与脆弱性**：1255 个测试文件、约 19.5k 用例、全量 200 秒；大量守门测试直接断言 CSS 源码字符串（`toContain`），改布局前必须先 `rg` 守门 | r19 水位；playbook 第〇节 | 全部（纪律） |
| P-11 | CI 只在 push 到 main / game-1.1 / 1.2 / 1.3 与 PR 时跑 | `.github/workflows/ci.yml` | 本档已加 `game-1.4`；窗口分支靠工人本地全绿 + 主管合并前再跑 |

---

## 二、七道工序（每一款游戏都要走完；细则在 [`plan-1.4-worker-game.md`](./plan-1.4-worker-game.md)）

| 工序 | 名称 | 产出 | 对应 skill（设计期读，不进 dist） |
| --- | --- | --- | --- |
| **A** | 全科体检 | `docs/qa/1.4/<id>-audit.md`：bug / 跳不过去 / 不合理 / 手感 / UI / 曲线 / 建模 / 纵深定级，带优先级 | 全部五个 + 视觉宪法 |
| **B** | 188 关可通关审计 | `src/games/<id>/levels.audit.test.ts`：`runCampaign` 固定策略机器人 ×≥3 种子跑全 188 关，或参数可行域静态校验；失败清单清零 | `procedural-gen`（seed 确定性、先验证再交付）、`level-design`（玩家度量、锯齿曲线） |
| **C** | Bug 与不合理修复 | 崩溃 / 卡死 / 不可达 / 规则不合理 / 双人键位 / destroy 泄漏 / 暂停恢复 / resize | `game-design-theory`（玩家期待：不卡死、公平、一致） |
| **D** | 手感 | 接入 `src/art/kit/feel.ts`：事件 → 分档反馈（音 + 粒子 + 抖 + 停 + 闪 + 弹）；reduced-motion 全降级 | `game-feel` |
| **E** | UI/UX | 屏幕栈、初始焦点、五视口适配（军规：高度反推钳 / l99 内 fixed / `min-height:501`）、HUD 事件驱动、热区 44、正文 16 | `game-ui-ux` + playbook |
| **F** | 建模 / 视觉 | 宪法负面清单清零、三阶光影、呼吸 + 眨眼 + 受伤 + 胜利、BOSS 仪式、画面密度 | 1.3 五个视觉 skill + 视觉宪法 |
| **G** | 纵深（窗口 5 专属；其他窗口只给定级建议） | 接 `src/art/runner/` + `engine/view25d.ts`，四件套 + 伪 3D 观感 | `game-feel`（镜头）、宪法第五节 |

**工单打包**：每款 = 工单 1（A+B+C）→ 工单 2（D+E+F）；LOC > 6000 的款工单 2 可拆 2a（D+E）/ 2b（F）串行；窗口 5 的纵深款再加工单 3（G）。
**同一款游戏任何时刻只有一个工人在改。**

---

## 三、关于「3D」的裁定

视觉宪法第五节继续生效：**真 3D（three.js / Babylon / 任何 WebGL 库）禁止**——离线 PWA 零运行时依赖、包体不膨胀、安卓低端机可玩是产品底线。
1.4 里「升 3D」= 升到宪法的**「伪 3D 观感」档**：`view25d` 透视投影 + 分层视差 + 深度缩放精灵 + 雾化（四件套）+ 地面网格滚动 + 镜头微倾 / 落地抖（reduced-motion 降级）。
判据不变：**纵深会改变玩家判断的**（躲障碍、变道、投掷落点、球道）→ 必须 2.5D 及以上；不会的（棋牌、消除、答题）→ 精 2D，不硬上透视。
窗口 5 的 10 款是本轮纵深名单；其他窗口在工序 A 里给每款一个定级建议（精 2D / 2.5D / 伪 3D），主管拍板后由窗口 5 或该窗自己（只 import 套件、不改套件）接。

---

## 四、共享基建契约（先行件；其他窗口只 import，不改）

### 4.1 手感套件 `src/art/kit/feel.ts`（窗口 1 第一波必派；规格见 [`plan-1.4-worker-feel-kit.md`](./plan-1.4-worker-feel-kit.md)）

```ts
export type FeelTier = "small" | "medium" | "large";
export interface FeelPreset { trauma: number; hitStopMs: number; slow: number; particles: number; flashMs: number; pop: number; sound?: SoundName }
export const FEEL_TIERS: Record<FeelTier, FeelPreset>;          // small < medium < large 单调
export class Trauma { add(n: number): void; step(dt: number): void; value: number; offset(t: number, maxPx: {x:number;y:number}, maxRot: number): {dx:number;dy:number;rot:number} }
export class HitStop { trigger(ms: number, slow?: number): void; step(realDtMs: number): number /* 当前 timeScale */; active: boolean }
export function feedback(tier: FeelTier, io: { trauma?: Trauma; hitStop?: HitStop; reduced: boolean; play?: (s: SoundName) => void; burst?: (n: number) => void; flash?: (ms: number) => void }): void;
export function applyCameraShake(ctx: CanvasRenderingContext2D, tr: Trauma, t: number, opts?): void;   // 只动相机变换，不动实体坐标
export function squashStretch(phase01: number, amount?: number): { sx: number; sy: number };
export const ease: { outBack; outElastic; outCubic; inOutQuad; outQuad };
export function popElement(el: HTMLElement, reduced: boolean): void;   // DOM 按钮 / 计分弹一下（CSS class 驱动）
```

铁律：shake 只改相机 / 视觉变换，不改实体坐标；hit-stop 用真实时间还原、新调用覆盖旧调用；`reduced=true` 时 trauma 不产生位移、hit-stop 不触发、粒子退化为淡出；每个事件只触发一次；分档由事件重要度决定（脚步 ≠ BOSS 倒下）。

### 4.2 跑道统一 `src/art/runner/` + `src/engine/view25d.ts`（窗口 5 第一波必派；规格见 [`plan-1.4-worker-runner-kit.md`](./plan-1.4-worker-runner-kit.md)）

目标：全仓只剩一套透视数学。彩虹跑跑 `view3d.ts`、双人冲刺 `view25d.ts`、金钩 / 弹弓 `depth12.ts` 全部改为 **薄适配层 → 调用共享套件**；玩法坐标系一个数不动（「透视只发生在绘制那一刻」原则），`rainbow-run/logic.test.ts` 的 `runCampaign` 必须保持全绿作为「可通关性没漂移」的证据。

### 4.3 框架守门（窗口 1，与 4.1 同波）

- `level99.ts`：N-100 进场锚定修一处、全库验收；`.l99-host` 直系内容 `scrollHeight > clientHeight` 时必须有可滚层或 fixed 底栏的**静态断言测试**（扫全部 l99 游戏内联 CSS）。
- 五视口测量工装固化为可复用脚本（放 `scripts/qa/measure-viewports.mjs`，仅开发期用，不进 dist），各窗口工人直接调。

---

## 五、全局红线（每份工人提示词逐字重申）

1. **不改**：存档 key（`yiduo-yixing.l99.<id>`、各游戏 `PROGRESS_KEY`、无尽纪录 key）、`meta.id`、战役总关数 188、章节数与章节边界、星级数组长度、`parentAuth.ts` / `parentGate.ts` / `rootGate.ts` 的语义、家长门口令逻辑。
2. **允许改关卡数值与规则，但必须**：(a) 工序 B 的审计测试先红后绿，提交里带失败清单前后对比；(b) 只为「可通关 / 合理 / 曲线平滑」，不许整体削成没挑战（三星门槛可以调，一星通关不能变成白给）；(c) 第 1–99 关若改参数，在 audit 报告里单列说明。
3. **禁止**：three.js 与一切运行时依赖、新增 npm 依赖（`puppeteer-core` 只许 `--no-save` 临时装）、提交位图 / 字体 / 音频二进制、`perspective/rotate3d/matrix3d/translateZ` CSS（窗口 2 B27 机器闸）。
4. **测试只增不减**：不删旧测试、不调低断言；守门测试断言的 CSS 原文（500 档、`SKY_H=420`、`*_PANE_H=200` 等）不动，加档不改档；`npm test` 与 `npm run build` 全绿才许 push。
5. **孩子文案**：失败只鼓励不批评；攻略只讲方法不给答案；商标黑名单扫描 0 命中：`rg -i "<黑名单>" src/ README.md --glob '!.cursor/skills/**'`（黑名单见 `plan-1.2-supervisor.md` 第八节）。
6. **所有权**：只改本窗口清单里的目录（第七节）；需要动共享文件 → 写需求单给窗口 1 / 窗口 5，不自己动；`src/styles.css` 只许末尾追加且只有窗口 1 能动；其他窗口在 `src/art/kit/` 只许**新增**带游戏前缀的文件。
   - **汇总导出文件** `src/art/kit/index.ts`、`src/engine/index.ts` 只有窗口 1 能改：窗口 2–5 新增的 kit 文件、窗口 5 给 `view25d.ts` 新加的导出，一律按文件路径直接 import，不经 index。
   - **`src/games/` 顶层跨游戏守门测试**（`copy.test.ts`、`hotspot.*.test.ts`、`window*-*.test.ts`、`trioR19FixB.test.ts` 等非 `__tests__/` 的顶层 `*.test.ts`）名义上归窗口 1。其他窗口若因本窗游戏的**合法改动**把它弄红，只许改**引用本窗游戏 id 的那几行**（更新期望值；不删断言、不调低阈值、不重排文件），并在回复里逐条写明；两窗同改一文件由主管合并时保留双方。
7. **git**：工人只推自己窗口分支；禁止 `--force`（含 `--force-with-lease`）、禁止推 `game-1.3` / `main`、禁止 `gh` 开 / 改 / 合 PR（只读可用）；rebase 冲突保留「该文件所属窗口」的版本。
8. **工装不进库**：测量脚本、截图、结果 JSON 一律 `/tmp`（Windows 为 `%TEMP%`）；唯一例外是窗口 1 固化的 `scripts/qa/measure-viewports.mjs`。
9. **不套娃**：工人禁止再 Task；窗口禁止自己写实现代码。

---

## 六、分支与派发纪律

### 6.1 分支

| 分支 | 作用 | 谁推 |
| --- | --- | --- |
| `game-1.3` | 1.3 收官线，**只读** | 无 |
| `game-1.4` | 1.4 集成线（本档从 `origin/game-1.3` @ `3ebc4228` 砍出） | 只有主管合并窗口分支进来 |
| `game-1.4-window1…5` | 五个窗口的工作分支 | 该窗口的工人与窗口自己 |

合并节奏：**共享基建优先**——窗口 1 的 `feel.ts` + 框架守门、窗口 5 的跑道统一一旦全绿即由主管合进 `game-1.4`，其余窗口 `git rebase origin/game-1.4` 后才开工序 D / G。之后每完成一批工单（建议每窗每 6 个工单）由主管合一次；合并前主管在 `game-1.4` 上 `npm test && npm run build`。

### 6.2 工人 Task 参数（窗口每次派工都用）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选，工人独立工作区） |
| `cloud_base_branch` | `game-1.4-window<N>` |
| `run_in_background` | `true`（一波 6 个并发） |
| `description` | `w<N>-<id>-t1` / `-t2` / `-t3`、`w<N>-infra-feel`、`w<N>-r<轮>-tester` 这类短名 |
| `prompt` | 本窗口文件里的「工人 prompt 头」+ 对应规格文件**全文**（替换占位符），禁止摘要 |

**云端不可用时的本地并发规则**：每个工人必须有独立工作区——窗口执行 `git worktree add <仓库旁目录>/yd-w<N>-<id> -b game-1.4-window<N>-<id> origin/game-1.4-window<N>`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window<N>-<id>`；窗口收到 IDLE 后把该分支合进 `game-1.4-window<N>` 并 `git worktree remove`。**禁止两个工人共用同一个工作目录。** 本地并发时工人开发中只跑定向测试（`npx vitest run src/games/<id>`），合并前窗口统一跑全量。

### 6.3 工人回复格式（窗口据此验收）

```
角色 / 工单：w<N>-<id>-t1
改了哪些文件：
新增测试文件与用例数：
审计结论：188 关失败清单（前 → 后）/ 五视口数字 / 宪法负面清单逐条
推送分支与 SHA：
实际使用的模型 slug：claude-opus-5-5-xhigh-fast
未做 / 需要共享文件改动的需求单：
```

---

## 七、五窗口所有权与游戏清单

| 窗口 | 主题 | 独占共享路径 | 游戏（数） |
| --- | --- | --- | --- |
| **1** | 壳层 + 框架 + 手感套件 + 学习 / 动手 | `src/ui/**`、`src/styles.css`、`src/games/level99.ts`、`quiz99.ts`、`speech.ts`、`src/games/__tests__/**`、`src/engine/**`（**不含** `view25d.ts`）、`src/art/kit/**`（含新建 `feel.ts`）、`scripts/qa/**`、`README.md`、`docs/release-notes/1.4.0.md` | clock-house find-diff math-farm pinyin-train shape-kingdom sudoku-petal word-garden color-fun music-stars（9） |
| **2** | 闯关动作 | 无（只改本窗游戏目录） | adventure-king bomb-buddies box-hamster brave-path candy-swing dot-maze fruit-slice garden-guard ice-fire-forest monster-crisis ocean-munch orb-arena prince-princess sky-squad snake-royale sprout-defense tank-battle（17） |
| **3** | 休闲益智 | 无 | alien-seek balloon-pop block-drop brick-break bubble-aim bubble-pop fishing-star fruit-catch fruit-stack kitty-care lianliankan match-stars memory-cards merge-2048 mine-garden mole-pop pool-stars puzzle-tiles shoot-range snake-snack tap-tiles（21） |
| **4** | 对战棋牌 | 无 | chess-garden combo-clash dark-chess duo-arena duo-vs-star fight-king flight-chess gomoku hero-cards hue-hand junqi-camp landlord-cards mahjong-bloom puff-bros red-blue-tap red-blue-tug star-estate weiqi-garden xiangqi（19） |
| **5** | 纵深 / 伪 3D + 跑道套件 | `src/art/runner/**`、`src/engine/view25d.ts` | rainbow-run duo-rush red-blue-race bumper-cars bowling-lane poop-hero hop-pads gold-hook sling-birds snow-fight（10） |

9 + 17 + 21 + 19 + 10 = **76**。窗口 1 游戏少是因为它背全部共享基建与框架需求单；窗口 5 游戏少是因为每款纵深升级都是重活。
本窗做完**必须去帮最落后的窗口**（规则同 1.3：只帮没人在跑的格子、推到被帮窗口的分支、仍然 Task 转发）。
**帮别人的锁**：帮忙窗口先回复主管「申请代派 w<K>-<id>-t<k>」→ 主管在 [`plan-1.4-tracker.md`](./plan-1.4-tracker.md) 把该格标「在跑（窗口 N 代）」并提交 → 帮忙窗口才许派。没登记就派 = 重派事故，后推者 revert。

---

## 八、验收门

### 8.1 每张工单（窗口验收）

```
[ ] 工人回复齐全（第 6.3 节格式），模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test 全绿且用例总数 ≥ 上一张工单水位；npm run build 全绿
[ ] 工单 1：audit.md 存在且 ≥ 12 条有编号的发现；levels.audit.test.ts 存在、覆盖全 188 关 × ≥3 种子（或静态可行域全覆盖）、失败清单为空；P0/P1 已修或写明为何不修
[ ] 工单 2：feel 接入有契约测试（reduced=true 无位移 / 无 hit-stop）；五视口数字写在回复里且 bottom ≤ 可视底、热区 ≥44、正文 ≥16；宪法负面清单逐条「无」；素材契约测试新增 ≥ 8 例
[ ] 工单 3（窗口 5）：四件套齐、伪 3D 降级可用、玩法模拟测试零 diff
[ ] git diff --name-only 不越界；商标扫描 0 命中；无新依赖、无二进制
```

### 8.2 1.4 收官门（五窗三轮验收后，主管逐条给结论）

- 76 款 × 188 关审计测试全绿（无尽 / 对战款做对应模式的「可开局、可结束、不卡死」模拟）。
- 76 款 feel 接入率 100%，reduced-motion 契约测试 100%。
- 五视口（390×844 / 768×1024 / 1024×768 / 1180×820 / 915×412）全库 HARD-OUT = 0；降级台账只剩「滚得到」的观感项。
- 纵深 10 款四件套齐，全仓透视实现只剩 `engine/view25d.ts` + `art/runner/`。
- 宪法负面清单 76 款逐款「无」；商标 0 命中；无新依赖；包体对比 1.3.4 增量 < 5%。
- `npm test` / `npm run build` 全绿，用例总数为全程最高水位。
- `docs/release-notes/1.4.0.md` 与 `README.md` 「各版本加了什么」已写，`package.json` / `android/app/build.gradle` 版本由主管对齐后打 tag（见 `RELEASE.md`）。

---

## 九、主管（本档）的独占文件

`docs/plan-1.4-*.md`、`docs/plan-1.4-tracker.md`、`.github/workflows/ci.yml`（只加 `game-1.4`）、`.cursor/skills/gamedev/**`。主管不改 `src/**`。
