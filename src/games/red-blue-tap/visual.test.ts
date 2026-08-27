/**
 * 红蓝点点 · 1.3 视觉升级守门（第 23 步 B 档，只增不减）。
 *
 * 判分与回合内核归 `rounds.test.ts` / `logic.test.ts` 管，一条不碰。
 * 这一份只盯「皮」：token 落表、果冻按垫非纯色、squash 不动热区、
 * 波纹分层与对错分支、信号灯三态跟既有时机、领先亮边只读比分、
 * 反应气泡只读既有统计、翻页与比分一致、destroy 归零、玩法常量零改动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  JELLY_RIPPLE_MS,
  JELLY_RIPPLE_SPREAD,
  JELLY_SQUASH_MS,
  jellyStyle
} from "../../art/kit/jellyBtn";
import { SPARK_COUNT, SPARK_MS } from "../../art/kit/sparkle";
import { KEY_MIN_PX, KEY_TIGHT_PX, SIDE_GUTTER_PX, VERSUS_TARGET } from "./arena";
import {
  AI_MIN_REACTION_MS,
  AI_TIERS,
  COLOR_FACE,
  ENDLESS_MISS_LIMIT,
  LIVE_FLOOR_MS,
  PALM_WINDOW_MS,
  READY_MAX_MS,
  READY_MIN_MS,
  TAP_DEBOUNCE_MS,
  type RoundPlan
} from "./rounds";
import {
  CAMPAIGN_VISUAL_CSS,
  COUNTDOWN_BUDGET_MS,
  COUNTDOWN_STEP_MS,
  RBT_TOKEN_DECL,
  SCORE_FLIP_MS,
  SIGNAL_BREATH_MS,
  SIGNAL_FLASH_MS,
  SIGNAL_MIN_VW,
  STREAK_FLOW_MS,
  STREAK_FLOW_NEED,
  VISUAL_CSS,
  leadSide,
  reactionMsOf,
  signalFace
} from "./skin";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const arenaSrc = readFileSync(`${DIR}arena.ts`, "utf8");
const shellSrc = readFileSync(`${DIR}index.ts`, "utf8");
const fxSrc = readFileSync(`${DIR}fx.ts`, "utf8");

/** 对战 / 无尽两个挂载函数各切一段，时机断言分开查 */
const vsSrc = arenaSrc.slice(arenaSrc.indexOf("export function mountVersus"), arenaSrc.indexOf("export function mountEndless"));
const endlessSrc = arenaSrc.slice(arenaSrc.indexOf("export function mountEndless"));

/** 从一段 CSS 里抠出某条规则的声明体 */
function ruleOf(css: string, selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `找不到规则 ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

/** 手搓一份颜色轮计划：测试信号灯剪影用，不碰随机 */
function colorPlan(commandColor: keyof typeof COLOR_FACE, negative: boolean): RoundPlan {
  return {
    kind: "color",
    slots: [commandColor, "green", "green", "green"],
    order: [],
    targets: negative ? [1, 2, 3] : [0],
    forbidden: negative ? [0] : [1, 2, 3],
    need: negative ? 3 : 1,
    commandColor,
    negative,
    readyMs: 500,
    liveMs: 900
  };
}

describe("红蓝点点 1.3 · ① CSS token 全部落表", () => {
  it("规格四·补一的 7 个 --rbt- token 一个不少，全在样式表里", () => {
    for (const token of [
      "--rbt-red:",
      "--rbt-blue:",
      "--rbt-signal-idle:",
      "--rbt-signal-ready:",
      "--rbt-ripple-good:",
      "--rbt-ripple-miss:",
      "--rbt-divider:"
    ]) {
      expect(RBT_TOKEN_DECL).toContain(token);
      expect(VISUAL_CSS).toContain(token);
      expect(CAMPAIGN_VISUAL_CSS).toContain(token);
    }
    // 规格钉的色值也钉住
    expect(RBT_TOKEN_DECL).toContain("--rbt-red: #E85D75");
    expect(RBT_TOKEN_DECL).toContain("--rbt-blue: #4A7FD8");
    expect(RBT_TOKEN_DECL).toContain("--rbt-signal-idle: #C9CFD8");
    expect(RBT_TOKEN_DECL).toContain("--rbt-signal-ready: #F0C25A");
  });

  it("动效时长全部写成自定义属性集中管理（规格四·补三）", () => {
    expect(RBT_TOKEN_DECL).toContain(`--rbt-squash-ms: ${JELLY_SQUASH_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-ripple-ms: ${JELLY_RIPPLE_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-breath-ms: ${SIGNAL_BREATH_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-flash-ms: ${SIGNAL_FLASH_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-flip-ms: ${SCORE_FLIP_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-spark-ms: ${SPARK_MS}ms`);
    expect(RBT_TOKEN_DECL).toContain(`--rbt-flow-ms: ${STREAK_FLOW_MS}ms`);
    expect([JELLY_SQUASH_MS, JELLY_RIPPLE_MS, SIGNAL_BREATH_MS, SIGNAL_FLASH_MS, SCORE_FLIP_MS, SPARK_MS, STREAK_FLOW_MS])
      .toEqual([60, 240, 800, 120, 120, 320, 900]);
  });

  it("场地中线：红蓝渐变相接走 --rbt-divider，中央有小闪电标", () => {
    expect(RBT_TOKEN_DECL).toMatch(/--rbt-divider: linear-gradient\([^;]*#4A7FD8[^;]*#E85D75/);
    expect(ruleOf(VISUAL_CSS, ".rbt-vs-gap::before")).toContain("var(--rbt-divider)");
    expect(ruleOf(VISUAL_CSS, ".rbt-vs-gap::after")).toContain('content: "⚡"');
  });
});

describe("红蓝点点 1.3 · ② 果冻按垫", () => {
  it("jellyBtn 输出含渐变与高光带，不是纯色", () => {
    for (const hex of ["#E85D75", "#4A7FD8", "#EAA82E"]) {
      const st = jellyStyle(hex);
      expect(st.background).toContain("radial-gradient(circle");
      expect(st.background).toContain("rgba(255,255,255,0.3)");
      expect(st.background).not.toBe(hex);
    }
  });

  it("paintPad 用的就是这套果冻样式，且只落自定义属性不写几何", () => {
    expect(arenaSrc).toContain('jellyStyle(lit ? face.hex : "#E7EBF3")');
    expect(arenaSrc).toContain('setProperty("--rbt-key-bg"');
    expect(arenaSrc).toContain('setProperty("--rbt-key-line"');
    expect(arenaSrc).toContain('setProperty("--rbt-key-face"');
    // 老的纯色直写已经退役
    expect(arenaSrc).not.toContain('b.style.background = lit ? face.hex : "#E7EBF3"');
  });

  it("按下 squash 只改 transform（外加立面阴影），按垫热区几何一个属性都不出现", () => {
    const squash = ruleOf(VISUAL_CSS, ".rbt-key:active, .rbt-key-lit:active");
    expect(squash).toContain("transform:");
    expect(squash).toContain("scale(0.94)");
    expect(squash).toContain("scaleY(0.97)");
    for (const banned of ["width", "height", "padding", "margin", "border-width", "inset:"]) {
      expect(squash, `squash 规则不许碰 ${banned}`).not.toContain(banned);
    }
    // 果冻皮那条视觉覆盖同样不许碰几何
    const jelly = ruleOf(VISUAL_CSS, ".rbt-key, .rbt-key-lit {");
    for (const banned of ["min-width", "min-height", "padding", "margin", "border-width"]) {
      expect(jelly, `果冻皮不许碰 ${banned}`).not.toContain(banned);
    }
    // 热区常量原地不动
    expect(KEY_MIN_PX).toBe(72);
    expect(KEY_TIGHT_PX).toBe(56);
    expect(SIDE_GUTTER_PX).toBe(24);
  });
});

describe("红蓝点点 1.3 · ③ 波纹层", () => {
  it("波纹层 pointer-events: none，垫在信号灯（z7）之下", () => {
    const ripple = ruleOf(VISUAL_CSS, ".rbt-ripple {");
    expect(ripple).toContain("pointer-events: none");
    expect(ripple).toContain("z-index: 5");
    expect(ruleOf(VISUAL_CSS, ".rbt-signal {")).toContain("z-index: 7");
    // 闯关那份波纹同样垫底
    expect(ruleOf(CAMPAIGN_VISUAL_CSS, ".rbt-ripple {")).toContain("pointer-events: none");
  });

  it("对 / 错波纹走不同类名：金色星环 vs 灰色淡纹", () => {
    expect(ruleOf(VISUAL_CSS, ".rbt-ripple-good")).toContain("var(--rbt-ripple-good)");
    expect(ruleOf(VISUAL_CSS, ".rbt-ripple-miss")).toContain("var(--rbt-ripple-miss)");
    expect(fxSrc).toContain('good ? "rbt-ripple-good" : "rbt-ripple-miss"');
  });

  it("对战与闯关都接上了：点对 true、点错 false，两条分支都在", () => {
    expect(arenaSrc).toContain("spawnRipple(pad.keys[pos], true, ev)");
    expect(arenaSrc).toContain("spawnRipple(pad.keys[pos], false, ev)");
    expect(shellSrc).toContain('spawnRippleAtDot(arenaEl, d.el, d.kind !== "trap")');
    expect(shellSrc).toContain("spawnRippleAtDot(arenaEl, d.el, false)");
    // 扩散倍数照工序单：1.4 倍按垫宽
    expect(JELLY_RIPPLE_SPREAD).toBe(1.4);
  });
});

describe("红蓝点点 1.3 · ④ 信号灯剧场", () => {
  it("三态类切换齐活：待机灰 / 预备黄呼吸 / 出题爆亮 + 光环一闪", () => {
    expect(ruleOf(VISUAL_CSS, ".rbt-signal {")).toContain("var(--rbt-signal-fill, var(--rbt-signal-idle))");
    expect(ruleOf(VISUAL_CSS, ".rbt-signal-ready")).toContain("rbtLampBreath");
    expect(ruleOf(VISUAL_CSS, ".rbt-signal-live")).toContain("rbtLampLive");
    expect(VISUAL_CSS).toContain("@keyframes rbtLampLive");
  });

  it("三态跟的全是既有时机：预备贴着 rbt-ready、出题在 paintPad(true) 同一个回调里", () => {
    for (const src of [vsSrc, endlessSrc]) {
      const ready = src.indexOf('classList.add("rbt-ready")');
      const readySignal = src.indexOf('setSignal(signalEl, "ready"');
      const litPaint = src.indexOf("plan, true)");
      const liveSignal = src.indexOf('setSignal(signalEl, "live"');
      const readyClock = src.indexOf("}, plan.readyMs);");
      expect(ready).toBeGreaterThan(-1);
      expect(readySignal).toBeGreaterThan(ready);
      expect(liveSignal).toBeGreaterThan(litPaint);
      expect(liveSignal).toBeLessThan(readyClock);
    }
    // 不许为信号灯另设钟：arena.ts 里裸 setTimeout 依旧只有 later() 里那 2 处
    expect([...arenaSrc.matchAll(/setTimeout\(/g)]).toHaveLength(2);
    expect(fxSrc).not.toMatch(/setTimeout\(/);
  });

  it("出题时机与判定窗口常量一个没动（读时机不改时机）", () => {
    expect(READY_MIN_MS).toBe(450);
    expect(READY_MAX_MS).toBe(1400);
    expect(LIVE_FLOOR_MS).toBe(620);
  });

  it("干扰信号形状差异存在：三角 vs 圆双通道，反向指令再叠 🚫", () => {
    const yellow = signalFace(colorPlan("yellow", false));
    const blue = signalFace(colorPlan("blue", false));
    expect(yellow.glyph).toBe("▲");
    expect(blue.glyph).toBe("●");
    expect(yellow.glyph).not.toBe(blue.glyph);
    expect(yellow.hex).not.toBe(blue.hex);
    expect(signalFace(colorPlan("red", true)).glyph).toBe("🚫■");
    // 四种颜色四种剪影，色觉双通道在源头就成立
    expect(new Set(Object.values(COLOR_FACE).map((f) => f.shape)).size).toBe(4);
  });

  it("窄屏信号灯直径 ≥ 22% 视口宽，且是 pointer-events: none 的浮层不占布局", () => {
    expect(SIGNAL_MIN_VW).toBeGreaterThanOrEqual(22);
    expect(VISUAL_CSS).toContain(`max(${SIGNAL_MIN_VW}vw`);
    const lamp = ruleOf(VISUAL_CSS, ".rbt-signal {");
    expect(lamp).toContain("pointer-events: none");
    expect(lamp).toContain("position: absolute");
  });
});

describe("红蓝点点 1.3 · ⑤ 对抗氛围与计分仪式", () => {
  it("领先方那一侧亮 4%，映射只读比分（纯函数 + 类名切换，分数不被写）", () => {
    expect(leadSide(3, 1)).toBe("left");
    expect(leadSide(1, 3)).toBe("right");
    expect(leadSide(2, 2)).toBeNull();
    expect(VISUAL_CSS).toContain("brightness(1.04)");
    expect(arenaSrc).toContain("markLead(bodyEl, score.left, score.right)");
    // fx 里只有 classList 开关，一处比分赋值都没有
    const markLeadBlock = fxSrc.slice(fxSrc.indexOf("export function markLead"), fxSrc.indexOf("export function sparkleBurst"));
    expect(markLeadBlock).toContain("classList.toggle");
    expect(markLeadBlock).not.toMatch(/score\s*[.=[]/);
  });

  it("翻页计分与比分数据一致：textContent 先落地，动画只是皮；reduced 瞬换", () => {
    const flip = fxSrc.slice(fxSrc.indexOf("export function flipScore"), fxSrc.indexOf("export function markLead"));
    expect(flip.indexOf("el.textContent = text")).toBeLessThan(flip.indexOf('classList.add("rbt-flip")'));
    expect(flip).toContain("if (!changed || reducedMotion(el)) return;");
    expect(arenaSrc).toContain("flipScore(leftScoreEl, String(score.left))");
    expect(arenaSrc).toContain("flipScore(rightScoreEl, String(score.right))");
    expect(ruleOf(VISUAL_CSS, ".rbt-flip")).toContain("var(--rbt-flip-ms)");
  });

  it("回合结算得分方按垫放星屑 5 颗，只读这一轮的 delta", () => {
    expect(SPARK_COUNT).toBe(5);
    expect(vsSrc).toContain("if (r.delta.left > 0) sparkleBurst(leftSide);");
    expect(vsSrc).toContain("if (r.delta.right > 0) sparkleBurst(rightSide);");
    const cleared = endlessSrc.slice(endlessSrc.indexOf("if (r.delta.left > 0) {"), endlessSrc.indexOf("} else {"));
    expect(cleared).toContain("sparkleBurst(sideEl)");
  });

  it("连对 3 次流光：视觉账本自己数，判分账本不沾手", () => {
    expect(STREAK_FLOW_NEED).toBe(3);
    expect(arenaSrc).toContain("hotStreak[side] % STREAK_FLOW_NEED === 0");
    expect(arenaSrc).toContain("hotStreak % STREAK_FLOW_NEED === 0");
    expect(VISUAL_CSS).toContain("@keyframes rbtFlow");
    // 下一轮重画时流光翻篇（reduced 的静态亮边也靠这行收）
    expect(arenaSrc).toContain('pad.root.classList.remove("rbt-pad-flow")');
  });
});

describe("红蓝点点 1.3 · ⑥ 反应气泡与倒计时", () => {
  it("反应时间气泡读既有统计值：res.t 与 duel.lightAt，纯函数不碰任何账", () => {
    expect(reactionMsOf(1234.6, 1000)).toBe(235);
    expect(reactionMsOf(900, 1000)).toBe(0);
    expect(reactionMsOf(Number.NaN, 1000)).toBe(0);
    expect(arenaSrc).toContain("reactionMsOf(res.t, d.lightAt)");
    const bubble = fxSrc.slice(fxSrc.indexOf("export function showBubble"), fxSrc.indexOf("export type SignalState"));
    expect(bubble).not.toContain(".tap(");
    expect(bubble).not.toMatch(/score\s*[.=[]/);
    // 手机上气泡字号也不小于 14px
    expect(ruleOf(VISUAL_CSS, ".rbt-bubble {")).toContain("font-size: 14px");
  });

  it("3-2-1 倒计时压进既有 700ms 间隙：出题一毫秒不推迟", () => {
    expect(COUNTDOWN_BUDGET_MS).toBe(700);
    expect(COUNTDOWN_STEP_MS * 3).toBeLessThanOrEqual(COUNTDOWN_BUDGET_MS);
    // 两个 restart 都是先放浮层、紧接着还是原来的 later(nextRound, 700)
    for (const src of [vsSrc, endlessSrc]) {
      const at = src.indexOf("countdown(wrap);");
      expect(at).toBeGreaterThan(-1);
      expect(src.indexOf("later(nextRound, 700)", at) - at).toBeLessThan(120);
    }
    const count = ruleOf(VISUAL_CSS, ".rbt-count {");
    expect(count).toContain("pointer-events: none");
    expect(count).toContain("var(--rbt-count-ms)");
  });
});

describe("红蓝点点 1.3 · ⑦ reduced-motion 与 destroy 归零", () => {
  it("reduced：squash / 波纹 / 流光 / 翻页 / 星屑全停，信号变色保留全强度", () => {
    const reduced = VISUAL_CSS.slice(VISUAL_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".rbt-ripple, .rbt-bubble { display: none; }");
    expect(reduced).toMatch(/\.rbt-key:active, \.rbt-key-lit:active \{ transform: none/);
    expect(reduced).toContain(".rbt-flip { animation: none; }");
    expect(reduced).toMatch(/\.rbt-pad-flow \.rbt-key \{ animation: none/);
    // 信号本体不减弱：预备恒定黄、出题静态变色且全透明度
    expect(reduced).toContain(".rbt-signal-ready { animation: none; }");
    expect(reduced).toMatch(/\.rbt-signal-live \{ animation: none; opacity: 1;/);
    // 生成端也拦：波纹 / 星屑 / 气泡在 reduced 下根本不进 DOM
    for (const fn of ["spawnRipple", "sparkleBurst", "showBubble"]) {
      const block = fxSrc.slice(fxSrc.indexOf(`export function ${fn}`));
      expect(block.slice(0, block.indexOf("}")), `${fn} 少了 reduced 闸`).toContain("reducedMotion(");
    }
  });

  it("destroy 后波纹节点与计时归零：fx 零计时器、粒子全在 wrap 子树、动画自收尸", () => {
    expect(fxSrc).not.toMatch(/set(Timeout|Interval)\(/);
    expect(fxSrc).not.toMatch(/requestAnimationFrame\(/);
    // 每一种会进 DOM 的粒子都登记了 animationend 自删
    expect([...fxSrc.matchAll(/animationend/g)].length).toBeGreaterThanOrEqual(5);
    // 两个 destroy 依旧以 wrap.remove() 收尾，粒子随子树一起走
    const blocks = [...arenaSrc.matchAll(/destroy\(\) \{([\s\S]*?)\n    \}/g)].map((m) => m[1]);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) expect(b).toContain("wrap.remove();");
  });

  it("玩法判定与统计常量零改动（视觉步的铁证）", () => {
    expect(TAP_DEBOUNCE_MS).toBe(60);
    expect(PALM_WINDOW_MS).toBe(80);
    expect(ENDLESS_MISS_LIMIT).toBe(3);
    expect(AI_MIN_REACTION_MS).toBe(140);
    expect(VERSUS_TARGET).toBe(7);
    expect(AI_TIERS.map((t) => t.reactionMs)).toEqual([600, 420, 300, 220]);
    expect(AI_TIERS.map((t) => t.missRate)).toEqual([0.3, 0.2, 0.12, 0.07]);
  });
});
