# 1.4 · 窗口 1 基建工单 · 手感套件 `src/art/kit/feel.ts` + 框架守门（整份粘贴给工人）

> 你是窗口 1 的基建工人（工单 `w1-infra-feel` 或 `w1-infra-frame`）。工作分支 **`game-1.4-window1`**，只推它。你就是执行者，禁止再派生任何子代理。
> 总纲红线：`docs/plan-1.4-supervisor.md` 第五节。这两张工单是全仓其他 71 款工序 D 与工序 E 的前置，**先出一个能用的最小版本并推送，再打磨**。

## 工单 `w1-infra-feel` · 手感套件

### 独占文件（只许新建 / 修改这些）

`src/art/kit/feel.ts`、`src/art/kit/feel.test.ts`、`src/art/kit/index.ts`（只加 re-export）、`src/styles.css`（**只许末尾追加** `.feel-pop` 一组选择器及其 `prefers-reduced-motion` 降级）、`docs/qa/1.4/infra-feel.md`。

### 必读

`.cursor/skills/gamedev/game-feel/SKILL.md` 与 `references/feedback-recipes.md`（trauma² 衰减、hit-stop 真实时间还原、重要度分档、缓动表）；`src/engine/view25d.ts` 的 `prefersReducedMotion` / `respectReducedMotion`；`src/art/kit/fx.ts`、`juice.ts`（已有粒子与汁滴，不重复造）；`src/games/fight-king/`、`rainbow-run/`、`duo-vs-star/` 里现有的 shake 写法（看他们需要什么接口，别闭门造）。

### API 契约（总纲 4.1 的展开；名字与签名不许改，可以加可选参数）

```ts
import type { SoundName } from "../../engine/types";

export type FeelTier = "small" | "medium" | "large";
export interface FeelPreset {
  trauma: number;      // 加到 Trauma 的量，small 0.15 / medium 0.4 / large 0.8 量级
  hitStopMs: number;   // small 0 / medium 50 / large 110
  slow: number;        // hit-stop 期间 timeScale，0.05–0.15
  particles: number;   // 粒子数建议，small 4 / medium 10 / large 28
  flashMs: number;     // 白闪时长，small 0 / medium 0 / large 60
  pop: number;         // squash/stretch 幅度 0.15–0.35
  sound?: SoundName;   // 建议音效名（tap / pop / coin / jump / oops / win / meow）
}
export const FEEL_TIERS: Readonly<Record<FeelTier, FeelPreset>>;

export class Trauma {
  readonly value: number;                       // 0..1
  constructor(opts?: { decayPerSec?: number });  // 默认 1.2
  add(amount: number): void;                    // 累加并钳到 1，不重置
  step(dtSec: number): void;                    // 按真实时间衰减到 0
  /** 位移按 value² 缩放；用 t 采样 sin 混频，禁止每帧 random */
  offset(tSec: number, maxPx?: { x: number; y: number }, maxRot?: number): { dx: number; dy: number; rot: number };
}

export class HitStop {
  readonly active: boolean;
  trigger(durationMs: number, slow?: number): void;   // 新调用覆盖旧调用的还原时刻
  step(realDtMs: number): number;                     // 返回当前 timeScale（1 = 正常）；用真实时间推进
}

export interface FeelIO {
  reduced: boolean;
  trauma?: Trauma;
  hitStop?: HitStop;
  play?: (s: SoundName) => void;
  burst?: (count: number) => void;
  flash?: (ms: number) => void;
  pop?: (amount: number) => void;
}
/** 一个事件只调一次；reduced=true 时：不加 trauma、不触发 hitStop、不 flash、粒子数折半且由调用方做淡出。音效照播。 */
export function feedback(tier: FeelTier, io: FeelIO): void;

/** 只对 ctx 做 translate/rotate（围绕画布中心），不改任何实体坐标；reduced 为真或 trauma=0 时不做任何变换。调用方负责 save/restore。 */
export function applyCameraShake(ctx: CanvasRenderingContext2D, tr: Trauma, tSec: number, opts?: { reduced?: boolean; maxPx?: { x: number; y: number }; maxRot?: number; center?: { x: number; y: number } }): void;

/** phase01 ∈ [0,1]：0 为事件瞬间（横拉竖压），1 回到 1:1；中段带过冲。体积守恒：sx*sy≈1。 */
export function squashStretch(phase01: number, amount?: number): { sx: number; sy: number };

export const ease: {
  outQuad(t: number): number; outCubic(t: number): number; inOutQuad(t: number): number;
  outBack(t: number, s?: number): number;      // 过冲，"弹"
  outElastic(t: number): number;                // 弹性
};

/** 给 DOM 元素加 .feel-pop 类并在动画结束后移除；reduced 为真时只切换一次颜色高亮类 .feel-pop-flat。 */
export function popElement(el: HTMLElement, reduced: boolean): void;

/** 给游戏循环用：把真实 dt 换成游戏 dt（乘 hitStop 的 timeScale），顺手推进 trauma。 */
export function stepFeel(realDtMs: number, parts: { trauma?: Trauma; hitStop?: HitStop }): number;
```

### 测试 `feel.test.ts` ≥ 24 例（示例，必须全部有）

- `FEEL_TIERS` 三档每个数值 small ≤ medium ≤ large，且 medium 必有 hitStop、small 必无 hitStop。
- `Trauma.add` 累加钳 1；`step` 衰减到 0 后 `offset` 全 0；`offset` 幅度随 value² 增长（0.5 的位移 < 1.0 位移的 1/3）；同一 t 两次调用结果相同（确定性，无 random）。
- `HitStop.trigger(100)`：`step(50)` 返回 slow、`step(60)` 后返回 1；两次 trigger 重叠时以后者的结束时刻为准；`step` 用真实时间（timeScale 为 0.05 时依然会结束）。
- `feedback("large", {reduced:true,...})`：trauma 不变、hitStop 不激活、flash 未调用、burst 参数折半、play 仍调用。
- `applyCameraShake` 用记账 ctx（`src/games/__tests__/canvasDom.ts` 的 `FakeCtx2D`）：reduced 时 ops 为空；非 reduced 且 trauma>0 时含 `translate` 与 `rotate`，且没有改传入的任何对象。
- `squashStretch(0)` 的 sx>1、sy<1 且乘积≈1；`squashStretch(1)` ≈ {1,1}；中段存在 >1 的过冲。
- `ease.*` 在 0 和 1 处取 0 和 1；`outBack` 中段存在 >1。
- `popElement` 加类、`animationend` 后移类；reduced 分支不加 `.feel-pop`。
- `stepFeel` 返回的游戏 dt = realDt × timeScale。

### 文档 `docs/qa/1.4/infra-feel.md`

接入指南（≤ 60 行）：事件表怎么填、分档怎么选、循环里怎么 `stepFeel`、画布怎么 `applyCameraShake`、DOM 怎么 `popElement`、reduced 怎么验。各窗口工人靠这份接入。

---

## 工单 `w1-infra-frame` · 框架守门 + 五视口工装

### 独占文件

`src/games/level99.ts`（只改进场锚定与 `.l99-host` 相关）、`src/games/level99.*.test.ts` 新增文件、`src/games/__tests__/l99HostScroll.guard.test.ts`（新建）、`scripts/qa/measure-viewports.mjs`（新建）、`scripts/qa/README.md`（新建）、`docs/qa/1.4/infra-frame.md`。

### 要做的三件事

1. **N-100 进场锚定**（`level99.ts` 一处）：选关地图进场把当前关 `scrollIntoView({block:"center"})` 后，`.l99-continue`「开始冒险 ▶」与工具行不得被卷到视口上方；用 `entryAnchorTop` / `scrollAdjustToRevealCta` 既有纯函数补齐逻辑，验收面 = r19 笔记第四节的 17 款 tab 折行款（puzzle-tiles brick-break red-blue-tap lianliankan dot-maze fishing-star poop-hero puff-bros red-blue-race red-blue-tug mine-garden + r18 六款），915×412 下 `.l99-continue` top ≥ 0。
2. **`.l99-host` 静态守门测试**：扫描全部走 `mountLevelGame` 的游戏目录内联 CSS 与 `level99.ts`，断言：凡声明了自身 `overflow-y:auto` 的根容器类名在 l99 内要么被 `pinL99Host()` 豁免、要么该游戏有 `position:fixed` 底栏或高度反推钳；对已知病号（N-75 / N-98 / N-101 / N-108 四款）作为回归样本。写不出完美规则就写保守规则 + 白名单，并在测试顶部注释判据。
3. **五视口测量工装** `scripts/qa/measure-viewports.mjs`：参数 `--game <id> --state entry|level1|duo --viewports all`，内部 `vite preview` 已起时直接连 4173；输出 JSON（每个可交互元素的 top/bottom/w/h、裁切祖先、`scrollIntoView` 后 reach、HARD-OUT 判定）到 `--out`（默认 `%TEMP%`/`/tmp`）。`puppeteer-core` 若缺则打印一行安装提示（`npm i --no-save puppeteer-core`）而不是崩。**不进 `package.json`、不进 dist**（`vite.config.ts` 不碰；`scripts/` 本就不打包）。`README.md` 写 20 行用法。

### 测试与验收

- 守门测试 ≥ 10 例；锚定回归测试 ≥ 6 例（含 17 款名单里至少 5 款的 DOM 替身用例）。
- `npm test -- --testTimeout=180000 && npm run build` 全绿；`level99.*.test.ts` 旧断言一条不改。
- 回复里给 17 款 915×412 的 `.l99-continue` top 数字（修前 / 修后）。
