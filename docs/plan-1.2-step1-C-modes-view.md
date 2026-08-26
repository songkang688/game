# 1.2 第 1 步 · C 档工作计划 —— 闯关 / 对战 / 无尽契约 + 2.5D 共享基建

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 **1.2 版本第 1 步 / 共 30 步** 的 **C 档**。主管总则：`docs/plan-1.2-supervisor.md`。tracker：`docs/plan-1.2-tracker.md` 的 `1-C`。

---

## 分支纪律（先做这一步）

- `git fetch origin game-1.2`，从 `origin/game-1.2` 拉工作分支。
- **开工前先提交一条 git 记录**（「1.2 第 1 步 C · 模式与 2.5D 基建」），再改代码。
- 全部推 **`game-1.2`**，不改 `main`，不 force，不用 `gh` 开/改/合 PR。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` → `git push origin HEAD:game-1.2`。
- 若线上还没有 `origin/game-1.1` @ `8867138` 的 `src/games/rainbow-run/view3d.ts`、`controls.ts`、`src/engine/collection.ts`，先把 1.1 合入再读再写。本档假设 1.1 已经做完。

---

## 本档目标

两件事，都是**给第 2 步起的新游戏用的共享基建**，不是再做一款游戏：

1. **闯关 / 对战 / 无尽（+ 合作 / 双人）模式选择器**：游戏进门后按 `meta.modes` 画出同一套入口，避免每款自己做四个颜色不一样的主菜单。
2. **2.5D 三车道透视 + 跑酷手感常量**：从 1.1 第 6 步已经落地的 `rainbow-run` **抄契约、抽到 engine**，让 IO / 卡丁 / 新跑酷直接 import，而不是再写一套 `scale = camDepth / (camDepth + depth)`。

**不要重复造轮子，也不要本步去改 `rainbow-run` / `duo-rush` / `collection.ts`。** 升级那两款跑酷去接共享模块，是第 10 步 A、第 19 步 A 的事。小屋养成已经在 `src/engine/collection.ts`（key `yiduo-yixing.collection.v1`，满级 ≤ +35%），本步只读，需要时写一个**薄封装**去调 `collectionEffects()`，不要复制图鉴数据。

先通读（`origin/game-1.1` @ `8867138`）：

- `docs/plan-1.1-step6-A-rainbow-run-2.5d.md`
- `src/games/rainbow-run/view3d.ts` —— `makeCamera` / `projectTrack` / `HORIZON_RATIO` / `LANE_SPREAD` / `COYOTE` 不在这里
- `src/games/rainbow-run/controls.ts` —— `COYOTE_TIME = 0.09`、`INPUT_BUFFER = 0.12`、`feelTick` / `feelWantsJump`
- `src/games/rainbow-run/endless.ts` —— 程序化路段、可过性
- `src/games/duo-rush/` —— 2.5D 分屏、对称障碍
- `src/engine/collection.ts` —— `collection` 单例、`collectionEffects()`、`BONUS_CAP_PERMILLE = 350`
- `src/ui/collection.ts` —— `openCollection(scope?)`
- `src/engine/types.ts` —— 已有 `GameMode = campaign | versus | endless | coop | twoPlayer` 和 `GAME_MODES`
- `src/ui/homeFilters.ts` —— 首页芯片已经按 `modes` 筛；你做的是**进游戏之后**的模式菜单，不是首页

---

## 独占文件（只许这些，A/B 的文件一个字别动）

| 文件 | 职责 |
| --- | --- |
| `src/engine/lane25d.ts` | **新建**。透视相机纯函数，API 与 `rainbow-run/view3d.ts` **对齐**（常量名、公式、`Camera` / `Projected`） |
| `src/engine/lane25d.test.ts` | **新建**。投影单调性、scale 夹紧、车道对称 |
| `src/engine/runFeel.ts` | **新建**。土狼时间 + 输入缓冲，常量与 `controls.ts` 一致 |
| `src/engine/runFeel.test.ts` | **新建** |
| `src/engine/runLoadout.ts` | **新建**。从 `collectionEffects()` 读加成，缺 collection 模块时降级为 1.0 倍率 |
| `src/engine/runLoadout.test.ts` | **新建**。满级不超过 +35%（调 `maxBonus`，不要复制一份图鉴） |
| `src/ui/playModes.ts` | **新建**。`mountPlayModes(host, spec)` 模式菜单 |
| `src/ui/playModes.test.ts` | **新建** |

**不要动：** `src/ui/home.ts`、`src/ui/homeFilters.ts`、`src/engine/types.ts`（B 在加 `platform`）、`src/styles.css`、`src/ui/gameShell.ts`（A 在改 `requestSkip`）、`src/games/level99.ts`、`src/ui/parentGate.ts`、`src/games/rainbow-run/**`、`src/games/duo-rush/**`、`src/engine/collection.ts`、`src/ui/collection.ts`。

样式：`playModes.ts` 自己注入带前缀 `.pm-` 的 `<style>`，学 `home.ts` 的 `HOME_EXTRA_CSS`。`prefers-reduced-motion` 下无滑入。

---

## 一、2.5D 共享（`lane25d.ts`）

**不要创新公式。** 1.1 相机模型已经写在 `view3d.ts` 文件头注释里，逐字搬：

```
scale(depth) = camDepth / (camDepth + depth)
y(depth)     = horizonY + (playerY - horizonY) * scale
```

必须导出（名称与数值对齐 1.1，方便第 10 步彩虹跑跑改 re-export）：

```ts
export const HORIZON_RATIO = 0.3;
export const CAM_DEPTH_RATIO = 1.35;
export const MAX_SCALE = 2.4;
export const MIN_SCALE = 0.05;
export const LANE_SPREAD = 0.26;
export const SPAWN_TRACK_Y = -680;

export interface Camera { w: number; h: number; horizonY: number; playerY: number; camDepth: number; }
export function makeCamera(w: number, h: number): Camera;
export function depthOf(cam: Camera, trackY: number): number;
export function scaleAtDepth(cam: Camera, depth: number): number;
export function screenYAtDepth(cam: Camera, depth: number): number;
export interface Projected { x: number; y: number; scale: number; }
export function laneOffset(w: number, laneFloat: number): number;
export function edgeOffset(w: number, j: number): number;
export function projectFlatX(cam: Camera, flatX: number, scale: number): number;
export function projectTrack(cam: Camera, trackY: number, laneFloat: number): Projected;
```

地面网格深度表如果 `view3d.ts` 已有导出函数，一并搬过来，包括函数名。本步可以**不搬绘制**（渐变天空、雾、视差层画到 canvas 的那段留在游戏里），共享层只做数学。若你连 `drawHorizonFog` 都想搬，必须仍是纯函数 `(ctx, cam) => void`，且不 import 游戏目录。

硬规则：

- 纯 Canvas 2D 数学，**不许引入 three.js / 任何依赖**
- 车道 0 / 1 / 2（或 1.1 用的 0..2 与 `laneFloat - 1` 体系）与 `LANE_SPREAD` 保持一致，不要「优化」成四车道
- `MAX_SCALE` / `MIN_SCALE` 夹紧，单测：depth 逼近 `-camDepth` 时 scale 不超过 2.4；极远 scale ≥ 0.05
- 左右车道投影对中线对称（`laneFloat = 0` 与 `2` 的 x 到 `w/2` 距离相等）

### `runFeel.ts`

从 `src/games/rainbow-run/controls.ts` 搬出手感，不要改数字：

```ts
export const COYOTE_TIME = 0.09;
export const INPUT_BUFFER = 0.12;
export type RunInput = "left" | "right" | "jump" | "roll";
export function inputForKey(key: string): RunInput | null; // 含 WASD / 方向键 / 空格
export interface JumpFeel { /* 与 1.1 相同字段 */ }
export function initJumpFeel(): JumpFeel;
export function feelTick(feel: JumpFeel, dt: number, onGround: boolean): JumpFeel;
export function feelPress(feel: JumpFeel): JumpFeel;
export function hasBufferedJump(feel: JumpFeel): boolean;
export function hasCoyote(feel: JumpFeel, onGround: boolean): boolean;
export function feelWantsJump(feel: JumpFeel, onGround: boolean): boolean;
export function feelConsume(feel: JumpFeel): JumpFeel;
```

键位：跳跃 = 上 / `W` / `↑` / 空格；左右 = `A D` / `← →`；下滑 = `S` / `↓`。双人游戏自己把星星映射到方向键，本模块保持一份默认（朵朵侧）。不要在这里做 root 门、不要做首页。

### `runLoadout.ts`

```ts
export interface RunMultipliers {
  speed: number;  // 1 = 无加成
  jump: number;
  magnet: number;
  coin: number;
  luck: number;
  reviveCharges: number;
  startShieldMs: number;
}

export function runMultipliersFromCollection(): RunMultipliers;
```

实现：`import { collectionEffects, BONUS_CAP_PERMILLE } from "./collection"`。千分之一转倍率：`1 + permille / 1000`。断言每个倍率 ≤ `1 + BONUS_CAP_PERMILLE / 1000`。若某个单测环境没有收藏数据，返回全 1 与 0 充能。

**不要**改 `COLLECTION_KEY`，不要新增内购，不要把加成写进 `yiduo-yixing.save.v1`。

---

## 二、模式菜单（`playModes.ts`）

1.1 首页已经能筛 `campaign` / `versus` / `endless` / `duo`。进门之后很多游戏仍各自画一套。本模块提供**可选**的统一菜单，新游戏从第 2 步起应该用它。

```ts
import type { GameMode } from "../engine/types";

export interface PlayModeSpec {
  gameId: string;
  title: string;
  /** 这款游戏真正做出来的模式，照 meta.modes 填 */
  modes: readonly GameMode[];
  /** 点某一模式后由游戏自己 mount 玩法 */
  onPick: (mode: GameMode) => void;
  /** 可选：打开小屋。不要自己实现收藏，调 openCollection 的 glob 探测 */
  onCollection?: () => void;
}

export function mountPlayModes(host: HTMLElement, spec: PlayModeSpec): { destroy: () => void };

export const MODE_LABELS: Record<GameMode, { emoji: string; label: string; blurb: string }> = {
  campaign: { emoji: "🚩", label: "闯关", blurb: "一关一关往下挑战" },
  versus: { emoji: "🤝", label: "对战", blurb: "和星星或小电脑比一局" },
  endless: { emoji: "♾️", label: "无尽", blurb: "能走多远算多远" },
  coop: { emoji: "👫", label: "合作", blurb: "两个人一起过" },
  twoPlayer: { emoji: "🎮", label: "双人同屏", blurb: "朵朵左边，星星右边" }
};
```

行为：

1. 只渲染 `spec.modes` 里有的按钮，缺的模式不画灰按钮。
2. 若 `modes` 只有 1 个，**仍然渲染菜单**（让孩子看见自己在玩哪种），但可以自动 focus 那一颗。不要偷偷跳过导致双人键位说明从未出现。
3. 双人键位小字：朵朵 `WASD`+`F`/`G`，星星 方向键+`L`/`K`，`Esc` 暂停。仅当 modes 含 `versus` / `coop` / `twoPlayer` 时显示。
4. 若 `onCollection` 传入，挂「小屋·收藏」按钮。实现方用 `import.meta.glob("../ui/collection.ts")` 探测，没有文件就不要画（1.1 home 已有同样手法）。本步不要 import 死 `collection.ts` 导致 C 的分支在 collection 被挪走时不能测——探测即可。
5. 键盘：左右/Tab 在按钮间移动，Enter 选中，焦点可见。
6. `destroy` 卸掉监听和注入的 style。
7. 文案约六年级、粉彩萌系、无商标。失败/模式名不要出现「大逃杀」「吃鸡」等。

**不要**在 `types.ts` 里再发明第四套模式枚举。就用现有 `GameMode`。B 同时在改 `types.ts` 加 `platform`：你不改这个文件，rebase 时他们的字段会进来，你的 import 仍然合法。

---

## 测试

| 文件 | 最少用例 | 必须点 |
| --- | --- | --- |
| `lane25d.test.ts` | 15 | 公式与夹紧、左右对称、`makeCamera` 比例、SPAWN 深度为正 |
| `runFeel.test.ts` | 10 | 离地 90ms 内仍可跳；提前 120ms 按下落地能跳；超时不能跳；左右键映射 |
| `runLoadout.test.ts` | 6 | 空收藏全 1；`maxBonus()` 转倍率 ≤ 1.35；不写 localStorage |
| `playModes.test.ts` | 12 | 只画 spec.modes；单模式也画；destroy 后再点不触发；双人键位说明出现条件；无 collection 不画小屋 |

全量：`npm test && npm run build`。只增不删。

建议加一条「与 1.1 彩虹跑跑常量锁定」：`HORIZON_RATIO` 等六个数字等于字面量，防止有人「优化透视」。第 10 步再让 `rainbow-run/view3d.ts` 改成 `export * from "../../engine/lane25d"`——**本步不要做那个 re-export**，否则和还在跑的彩虹跑跑升级抢文件。

---

## 验收

- `npm test` 全绿且用例只增不减；`npm run build` 全绿。
- 本步没有新游戏卡片（你没改 glob 的 meta）。用 `playModes.test.ts` 的 jsdom 挂一次菜单，截逻辑断言即可。
- 在回复里写清：新游戏应该 `import { makeCamera, projectTrack } from "../../engine/lane25d"`、`import { mountPlayModes } from "../../ui/playModes"`、加成走 `runMultipliersFromCollection()`。把这三行抄进你的完成说明，方便 B 写第 2–8 步。
- 不引入 three.js；不加广告内购；不改存档 key。
- 完成后回复：改了哪些文件、新增用例数、推送 SHA、**实际使用的模型 slug**。

---

## 不要做什么

- ❌ 不要再派生云端子代理
- ❌ 不要改 `main`、不要 force
- ❌ 不要改 `rainbow-run` / `duo-rush` / `collection.ts` / `home.ts` / `level99.ts` / `gameShell.ts`
- ❌ 不要自己做家长门或手游筛选
- ❌ 不要把 2.5D 公式改成「更好看」的另一套
- ❌ 不要在共享层加载外部图片或音源
- ❌ 不要写 `docs/plan-1.2-step2-*`（那是提示词作者 B 的活，你是执行本步代码的人时也不要去写那些文档）
