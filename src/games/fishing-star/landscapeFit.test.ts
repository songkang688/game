/**
 * 钓鱼小达人 · 横过来拿的时候「🎣 按住抛竿」不许掉在裁切线以下
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-FB-01` 阻断）。
 *
 * `W5R2-LB-01/02` 与两条残留补丁（`312b6ae` / `e989849`）把**竖屏**那四档收干净了：
 * 我自己连做 12 格 × 6 轮「上鱼 → 再抛竿」、864 帧 `elementFromPoint`，一帧都没漏。
 * 可把手机**横过来**——孩子玩着玩着转个身就是这个姿势——整条就塌了：
 *
 * ```
 * 视口       抛竿键中心   舞台下沿   能起手滚的地方
 * 844×390    y=450        y=382      一处都没有
 * 740×360    y=450        y=382      一处都没有
 * 640×360    y=450        y=382      一处都没有
 * ```
 *
 * 20 帧连采 20 帧全是 `null`，而且**不会自己回来**（竖屏那两档的转屏抖动 1 帧就收回来了）。
 * 真手指也救不回来：`.fs-wrap` 的 `scrollHeight − clientHeight` 是 **0**，
 * 这一屏压根没挂上滚动条，全场找不到一个能起手划的滚动祖先。
 *
 * 根因是**水面收到底了还是装不下**：
 *
 * ```
 * room   = 舞台下沿 382 − .fs-wrap 顶沿 158 = 224
 * chrome = HUD + 风向 + 张力条 + 提示 + 64px 大按钮      = 182
 * 水面能给的最大值 = 224 − 182 − 4 = 38  →  被 MIN_SEA_PX 抬回 132
 * 整屏 132 + 182 = 314，比 224 高出 90px
 * ```
 *
 * `seaHeightPx()` 没算错，它已经收到下限了；缺的是**收无可收之后的第二道**：
 * 这一屏自己钳出一条滚动条。CSS 里写的 `.fs-wrap{max-height:100%}` 是空转的
 * （壳层那条祖先链是 `auto` 高的，百分比没有参照——第 1 轮就是这么栽的），
 * 只能量出真实像素写死，和 `music-stars` / `shape-kingdom` 的 `fitIntoStage()` 同一个做法。
 *
 * **只在收无可收那一档才挂**：竖屏四档水面收得动，`wrapCapPx()` 返回 `null`，
 * 一个字节都不写，「按住蓄力」的手感一分没变。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIT_SLACK_PX, MIN_SEA_PX, overshootPx, seaHeightPx, wrapCapPx } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const fitSource = readFileSync(`${dir}fit.ts`, "utf8");

/** 真机 844×390 那一组（CDP 实测）：舞台下沿 382、`.fs-wrap` 顶沿 158 */
const LAND_ROOM = 382 - 158;
/** 水面以外那几行占的高度（实测 314 − 132） */
const LAND_CHROME = 182;
/** `layout()` 按 innerHeight 猜出来的水面：390 × 0.33 = 128.7 → clamp 到 180 */
const LAND_GUESS = 180;

describe("钓场 · 横屏：水面收到下限仍旧装不下（先把病摆出来）", () => {
  it("844×390 上水面被 MIN_SEA_PX 抬住，收不到装得下的那个值", () => {
    const sea = seaHeightPx(LAND_GUESS, LAND_ROOM, LAND_CHROME);
    expect(sea).toBe(MIN_SEA_PX);
    // 真正装得下的水面高度是 38px——那已经不是水面了，抬回下限是对的
    expect(LAND_ROOM - LAND_CHROME - FIT_SLACK_PX).toBeLessThan(MIN_SEA_PX);
  });

  it("于是整屏超出 90px，44px 高的抛竿键整颗在裁切线以下", () => {
    const sea = seaHeightPx(LAND_GUESS, LAND_ROOM, LAND_CHROME);
    const over = overshootPx(sea, LAND_CHROME, LAND_ROOM);
    expect(over).toBe(90);
    // 键是这一屏最后一行：超出 90px 时它的下沿、上沿、中心全在线外
    expect(over - 44).toBeGreaterThan(0);
  });
});

describe("钓场 · wrapCapPx：收无可收之后这一屏自己钳出滚动条", () => {
  it("横屏那一组算得出 220px 的钳位", () => {
    const content = MIN_SEA_PX + LAND_CHROME;
    expect(content).toBe(314);
    expect(wrapCapPx(LAND_ROOM, content)).toBe(LAND_ROOM - FIT_SLACK_PX);
    expect(wrapCapPx(LAND_ROOM, content)).toBe(220);
    // 钳完之后能滚 94px，抛竿键滑得到
    expect(content - (LAND_ROOM - FIT_SLACK_PX)).toBe(94);
  });

  it("竖屏四档水面收得动，一个字节都不写（返回 null）", () => {
    // 320×640 / 360×640：room 408、chrome 209 → 水面 195，整屏 404 ≤ 420
    const sea = seaHeightPx(230, 408, 209);
    expect(sea).toBe(195);
    expect(wrapCapPx(408, sea + 209)).toBeNull();
    // 390×844：一层都不裁，room 是 Infinity
    expect(wrapCapPx(Number.POSITIVE_INFINITY, 586)).toBeNull();
  });

  it("差一个像素以内不算超——亚像素抖动不值得挂一条滚动条", () => {
    expect(wrapCapPx(224, 220)).toBeNull();
    expect(wrapCapPx(224, 221)).toBeNull();
    expect(wrapCapPx(224, 222)).toBe(220);
  });

  it("量不到的（room ≤ 0 / NaN / 内容为 0）一律不写", () => {
    expect(wrapCapPx(0, 400)).toBeNull();
    expect(wrapCapPx(-10, 400)).toBeNull();
    expect(wrapCapPx(Number.NaN, 400)).toBeNull();
    expect(wrapCapPx(224, 0)).toBeNull();
    expect(wrapCapPx(2, 400)).toBeNull();
  });
});

describe("钓场 · index.ts 真的接上了这一手", () => {
  it("refitNow() 量之前先摘掉上一次钳出来的高度，不然越量越小", () => {
    const at = shell.indexOf("function refitNow(");
    expect(at, "refitNow() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain('wrap.style.maxHeight = ""');
    expect(body).toContain("capWrap()");
  });

  it("refitNow() 摘钳位之前先记下滚到哪儿了，钳完还回去", () => {
    // 摘掉 max-height 的那一瞬间这一屏不再滚得起来，浏览器当场把 scrollTop 夹回 0。
    // 而 refitNow() 每 REFIT_MS（300ms）跑一次：真机 844×390 上把 scrollTop 拨到满行程
    // 94，600ms 后回来量是 **0**——孩子刚滑到抛竿键，0.3 秒后又被弹回水面。
    const at = shell.indexOf("function refitNow(");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("wrap.scrollTop");
  });

  it("capWrap() 用 scrollHeight 量内容（钳完之后 rect 高度已经是钳过的值了）", () => {
    const at = shell.indexOf("function capWrap(");
    expect(at, "capWrap() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("wrapCapPx(");
    expect(body).toContain("wrap.scrollHeight");
    expect(body).toContain("clipWatch.roomPx(wrap)");
    expect(body).toContain('wrap.style.overflowY = "auto"');
  });

  it("钳位那一档孩子不许自己压扁——不然够得着了却什么都看不见", () => {
    // 列向 flex 的孩子默认 flex-shrink:1。只钳 .fs-wrap 的高度，孩子会抢着自己压扁：
    // 真机 740×360 上量到 .fs-sea 被压成 10px（它是 overflow:hidden，min-height:auto
    // 解析成 0），132px 的画布整个被裁掉，而 wrap 的 scrollHeight 等于 clientHeight，
    // 滚动条压根不出现。抛竿键是够得着了，可水面没了，鱼群带和深度尺一起消失。
    expect(shell).toContain(".fs-wrap>*{flex-shrink:0;}");
  });

  it("钳出来的那 94px 得真的划得动——水面不许把这一指吃掉", () => {
    // 钳位只是把滚动条挂上去，滚不滚得动是另一回事。真机 844×390 上从水面正中
    // （422, 268）上划两次 150px，`scrollTop` 纹丝不动 0 → 0，抛竿键照旧点不着。
    // 挡路的是 canvas 的 `pointerdown` 里那句无条件 `preventDefault()`：
    // 它把这一指的默认行为（滚动）连同双击缩放一起吃了。
    //
    // 和 `8c70a3d`（作图板 `touch-action:none` 吃掉手势）是同一个坑，修法照抄：
    // **只在真的滚得起来的那一档**让出去。滚不动的那几档（竖屏四档）一个字没变，
    // 点水面抛竿仍旧是原来的手感。
    const at = shell.indexOf("const onCanvasDown = (");
    expect(at, "onCanvasDown 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  };", at));
    expect(body, "无条件 preventDefault() 会把滚动一起吃掉").not.toMatch(
      /^\s*e\.preventDefault\(\);$/m
    );
    expect(body).toContain("wrapScrolls()");
    expect(body).toContain("press();");
  });

  it("wrapScrolls() 问的是「这一刻真滚得起来吗」，不是「钳过位吗」", () => {
    const at = shell.indexOf("function wrapScrolls(");
    expect(at, "wrapScrolls() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("wrap.scrollHeight");
    expect(body).toContain("wrap.clientHeight");
  });

  it("抛竿键自己照旧吃掉手势——按住蓄力不许变成滚动", () => {
    // 大按钮上 `touch-action:none` 一个字不动：手指落在它上面就是蓄力，
    // 而它本来就是那个要滚过去够的目标，不需要从它身上起手滚。
    expect(shell).toContain("touch-action:none;}");
    const at = shell.indexOf("const onPointerDown = (");
    const body = shell.slice(at, shell.indexOf("\n  };", at));
    expect(body).toContain("e.preventDefault();");
  });

  it("转屏走的是收敛版 refitNow()，不是只量一次的 layout()", () => {
    const at = shell.indexOf("const onResize = (");
    expect(at, "onResize 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("refitNow();");
  });

  it("fit.ts 仍旧是纯的：算高度归它，写 DOM 归 index.ts", () => {
    expect(fitSource).not.toContain("overflowY =");
    expect(fitSource).not.toContain("maxHeight =");
    expect(fitSource).toContain("export function wrapCapPx(");
  });

  it("热区一分没动：大按钮仍旧 64px，其余热区仍旧 ≥44px", () => {
    expect(shell).toContain(".fss-act{min-height:64px");
    for (const m of shell.matchAll(/min-height:(\d+)px/g)) {
      const n = Number(m[1]);
      // 30px 以下的是只读的提示条 / 读数行，本来就不是热区
      expect(n === 64 || n >= 44 || n < 30, `出现了 ${n}px 的 min-height`).toBe(true);
    }
  });
});
