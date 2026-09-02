/**
 * 时钟小屋 · 1.3 A 档视觉升级用例（第九节，只增不减）。
 *
 * 皮肤三件事逐条钉死：
 *  1. 造型层不越权——指针 path 的端点永远是 `handTip` 的输出，角度公式逐例回归；
 *  2. 可测接口零改动——`data-t` / `aria-label` / 端点载体 line / 拖拽热区 / 读数语义原样；
 *  3. 小屋 / 木牌 / 小鸟 / 拨杆 / reduced 的绘制规格与 4.1–4.3 表一一对上。
 * DOM 挂载层在 node 环境跑不了，照本目录惯例用源码巡检钉。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FACE_LABEL,
  HAND_SKIN,
  HANDS,
  NUM_MAIN_SCALE,
  NUM_SIGN_H,
  NUM_SIGN_W,
  faceSVG,
  handDAt,
  handTip,
} from "./clockface";
import { dialReadout, dialTimeAt } from "./dial";
import {
  birdMoodClass,
  baseSVG,
  CHEER_SPARKS,
  CLK_TOKENS,
  CUCKOO_SAY,
  HOUSE_CSS,
  houseHTML,
  ROOF_TILE_ROWS,
  roofSVG,
} from "./house";
import { clockMinutes, formatClockMinute, hourHandAngleAt, minuteHandAngleAt } from "./logic";
import { CLK_CSS, MIN_FACE_PX } from "./runner";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const dialSrc = readFileSync(`${DIR}dial.ts`, "utf8");
const houseSrc = readFileSync(`${DIR}house.ts`, "utf8");
const runnerSrc = readFileSync(`${DIR}runner.ts`, "utf8");

function count(hay: string, needle: string): number {
  return hay.split(needle).length - 1;
}

describe("时钟小屋 · 视觉 1：指针 path 端点 = handTip 输出（0 点 / 3 点 / 7:30 钉死）", () => {
  it("三个基准时刻的时针 / 分针 path 都以 handTip 坐标收尖", () => {
    for (const t of [0, clockMinutes(3, 0), clockMinutes(7, 30)]) {
      const hTip = handTip(hourHandAngleAt(t), HANDS.hour.length);
      const mTip = handTip(minuteHandAngleAt(t), HANDS.minute.length);
      expect(handDAt("hour", hourHandAngleAt(t))).toContain(`L ${hTip.x.toFixed(2)} ${hTip.y.toFixed(2)} `);
      expect(handDAt("minute", minuteHandAngleAt(t))).toContain(`L ${mTip.x.toFixed(2)} ${mTip.y.toFixed(2)} `);
    }
    // 三例的针尖坐标再用独立算出来的定数钉一遍，防止「两边一起错」
    expect(handDAt("hour", hourHandAngleAt(0))).toContain("L 50.00 29.00 ");
    expect(handDAt("hour", hourHandAngleAt(clockMinutes(3, 0)))).toContain("L 71.00 50.00 ");
    expect(handDAt("minute", minuteHandAngleAt(clockMinutes(7, 30)))).toContain("L 50.00 82.00 ");
    expect(handDAt("hour", hourHandAngleAt(clockMinutes(7, 30)))).toContain("L 35.15 64.85 ");
  });

  it("faceSVG 里的端点载体 line 原样：levels.test 的 hourTip 正则照旧命中", () => {
    const svg = faceSVG(clockMinutes(7, 30), 150);
    const m = svg.match(/data-clk-hand="hour" x1="50" y1="50" x2="([-\d.]+)" y2="([-\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(35.15, 1);
    expect(Number(m![2])).toBeCloseTo(64.85, 1);
    expect(svg).toMatch(/data-clk-hand="minute" x1="50" y1="50" x2="[-\d.]+" y2="[-\d.]+"/);
  });
});

describe("时钟小屋 · 视觉 2：角度公式换肤前后逐例相等（回归）", () => {
  it("hourHandAngleAt / minuteHandAngleAt 的输出与 1.2 的定数一致", () => {
    expect(hourHandAngleAt(0)).toBe(0);
    expect(hourHandAngleAt(30)).toBe(15);
    expect(hourHandAngleAt(180)).toBe(90);
    expect(hourHandAngleAt(450)).toBe(225);
    expect(hourHandAngleAt(719)).toBe(359.5);
    expect(minuteHandAngleAt(0)).toBe(0);
    expect(minuteHandAngleAt(15)).toBe(90);
    expect(minuteHandAngleAt(450)).toBe(180);
    expect(minuteHandAngleAt(719)).toBe(354);
    expect(minuteHandAngleAt(30.5)).toBe(183);
  });

  it("拖动判定的行为样例照旧：磁吸 / 联动 / 最短路径一个没变", () => {
    const BOX = { left: 0, top: 0, width: 100, height: 100 };
    expect(dialTimeAt(clockMinutes(3, 0), BOX, 100, 50, false)).toBe(clockMinutes(3, 15));
    expect(dialTimeAt(clockMinutes(3, 0), BOX, 50, 100, false)).toBe(clockMinutes(3, 30));
    expect(dialTimeAt(clockMinutes(11, 55), BOX, 50, 0, false)).toBe(clockMinutes(12, 0));
  });
});

describe("时钟小屋 · 视觉 3–4：两针造型不同、token 不同、铆钉盖顶", () => {
  it("时针胖箭头与分针细箭头是两条不同的 path，主色一个暖橙一个青蓝", () => {
    expect(handDAt("hour", 90)).not.toBe(handDAt("minute", 90));
    expect(HAND_SKIN.hour.fill).toBe(CLK_TOKENS.hourOrange);
    expect(HAND_SKIN.minute.fill).toBe(CLK_TOKENS.minuteTeal);
    const svg = faceSVG(clockMinutes(4, 20), 150);
    expect(svg).toContain(`data-clk-handp="hour" d=`);
    expect(svg).toContain(`fill="${CLK_TOKENS.hourOrange}"`);
    expect(svg).toContain(`fill="${CLK_TOKENS.minuteTeal}"`);
    // 端点载体只当坐标接口，不再自己画针
    expect(svg).toMatch(/data-clk-hand="hour"[^>]*stroke="none"/);
    expect(svg).toMatch(/data-clk-hand="minute"[^>]*stroke="none"/);
  });

  it("图层序：时针 path → 分针 path → 秒针 → 轴心铆钉（DOM 顺序断言）", () => {
    const svg = faceSVG(clockMinutes(4, 20), 150, { second: 30 });
    const hour = svg.indexOf('data-clk-handp="hour"');
    const minute = svg.indexOf('data-clk-handp="minute"');
    const second = svg.indexOf('data-clk-hand="second"');
    const hub = svg.indexOf('class="clk-hub"');
    expect(hour).toBeGreaterThan(-1);
    expect(minute).toBeGreaterThan(hour);
    expect(second).toBeGreaterThan(minute);
    expect(hub).toBeGreaterThan(second);
    // 铆钉是双圆 + 高光点
    const hubChunk = svg.slice(hub);
    expect(hubChunk).toContain('r="7"');
    expect(hubChunk).toContain('r="3.5"');
  });
});

describe("时钟小屋 · 视觉 5：数字木牌", () => {
  it("12 块木牌齐全，12/3/6/9 主位放大 1.25 倍并用 roofRed 描边", () => {
    const svg = faceSVG(0, 150);
    expect(count(svg, 'class="kit-woodsign clk-num')).toBe(12);
    expect(count(svg, "clk-num-main")).toBe(4);
    expect(NUM_MAIN_SCALE).toBe(1.25);
    expect(count(svg, `width="${(NUM_SIGN_W * NUM_MAIN_SCALE).toFixed(2)}"`)).toBe(4);
    const main = svg.slice(svg.indexOf("clk-num-main"));
    expect(main).toContain(`stroke="${CLK_TOKENS.roofRed}"`);
    for (const n of ["12", "3", "6", "9", "1", "11"]) expect(svg).toContain(`>${n}</text>`);
  });

  it("刻度分级：5 分钟刻度 12 根粗、1 分钟刻度 48 根细", () => {
    const svg = faceSVG(0, 150);
    expect(count(svg, 'class="clk-t5"')).toBe(12);
    expect(count(svg, 'class="clk-t1"')).toBe(48);
    expect(svg).toMatch(/class="clk-t5"[^>]*stroke-width="1.8"/);
    expect(svg).toMatch(/class="clk-t1"[^>]*stroke-width="0.8"/);
  });
});

describe("时钟小屋 · 视觉 6–7：可测接口与读数语义零改动", () => {
  it("data-t / aria-label / data-m 原样，默认标签仍不含时刻", () => {
    const svg = faceSVG(205, 150);
    expect(svg).toContain('data-t="205"');
    expect(svg).toContain('data-m="25"');
    expect(svg).toContain(`aria-label="${FACE_LABEL}"`);
    expect(faceSVG(0, 150, { dial: true })).toContain('data-clk-dial="1"');
    // dial.ts 96–98 行那三件事逐字还在
    expect(dialSrc).toContain('svg.setAttribute("data-t", String(Math.round(time)));');
    expect(dialSrc).toContain('svg.setAttribute("aria-label", formatClockMinute(time));');
    expect(dialSrc).toContain("readout.textContent = dialReadout(time, precise);");
  });

  it("formatClockMinute / dialReadout 一字不差", () => {
    expect(formatClockMinute(clockMinutes(3, 25))).toBe("3 点 25 分");
    expect(formatClockMinute(clockMinutes(12, 0))).toBe("12 点");
    expect(dialReadout(clockMinutes(3, 25), false)).toBe("现在拨到 3 点 25 分");
    expect(dialReadout(clockMinutes(3, 25) + 0.4, true)).toBe("现在拨到 3 点 25 分左右");
    expect(dialSrc).toContain('toggle.textContent = precise ? "🎯 精确模式：开" : "🎯 精确模式：关";');
  });
});

describe("时钟小屋 · 视觉 8：答对答错两条视觉分支，答错不批评", () => {
  it("答对咕咕 + 星屑 6 粒，答错只歪头，两个类名不同", () => {
    expect(birdMoodClass(true)).toBe("clk-bird-cheer");
    expect(birdMoodClass(false)).toBe("clk-bird-peek");
    expect(CHEER_SPARKS).toBe(6);
    expect(houseSrc).toContain("sparkleSpecs(rand, CHEER_SPARKS)");
    // 反馈层的话只有一句夸的「咕咕！」：两处赋值一处清空一处咕咕，答错分支一个字都不说
    expect(CUCKOO_SAY).toBe("咕咕！");
    expect(CUCKOO_SAY).not.toMatch(/错|不对|失败|笨|差/);
    expect(count(houseSrc, "say.textContent = ")).toBe(2);
    expect(houseSrc).toContain('say.textContent = ""');
    expect(houseSrc).toContain("say.textContent = CUCKOO_SAY");
  });

  it("反馈映射挂在既有判定上：答对 cheer、答错 oops、壳亮提示那刻才柔光", () => {
    expect(runnerSrc).toContain("fx.cheer();");
    expect(runnerSrc).toContain("fx.oops();");
    expect(runnerSrc).toContain('fx.glowCorrect(stage.querySelector(".qz-choice.qz-hint"));');
    // 判定本身一行没动
    expect(runnerSrc).toContain("if (at === q.correct) {");
    expect(runnerSrc).toContain("wrongHere++;");
  });
});

describe("时钟小屋 · 视觉 9–10：拨杆两态与拖拽热区回归", () => {
  it("拨杆两态类名跟着 precise 走，开关逻辑与 aria-pressed 原样", () => {
    expect(dialSrc).toContain('toggle.classList.toggle("clk-toggle-on", precise);');
    expect(dialSrc).toContain('svg.classList.toggle("clk-precise", precise);');
    expect(dialSrc).toContain('toggle.setAttribute("aria-pressed", precise ? "true" : "false");');
    expect(dialSrc).toContain("precise = !precise;");
    expect(CLK_CSS).toContain(".clk-toggle-on");
    expect(CLK_CSS).toContain(".clk-toggle::before");
    // 精确模式下分针刻度增亮「要看细」
    expect(HOUSE_CSS).toContain(".clk-precise .clk-t1");
  });

  it("拖拽热区尺寸与事件绑定换肤前后一致", () => {
    expect(CLK_CSS).toContain(
      `.clk-face { width: min(62vw, 240px); min-width: ${MIN_FACE_PX}px; height: auto; touch-action: none; }`
    );
    expect(CLK_CSS).toContain(".clk-face { width: min(78vw, 240px); }");
    for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave"]) {
      expect(dialSrc, `${ev} 没绑在钟面上`).toContain(`on<PointerEvent>(svg, "${ev}"`);
    }
    expect(dialSrc).toContain("setPointerCapture?.(ev.pointerId)");
    // 小屋只是把 svg 原样搬进屋身开槽，HOUSE_CSS 不许重写热区尺寸
    expect(dialSrc).toContain(".appendChild(svg)");
    expect(HOUSE_CSS).not.toContain(".clk-face {");
  });
});

describe("时钟小屋 · 视觉 11–12：reduced 与 360px 底线", () => {
  it("reduced 下摆锤 / 弹格 / 小鸟 / 小窗呼吸全停，柔光提示仍在", () => {
    const reduced = HOUSE_CSS.slice(HOUSE_CSS.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".clk-pend { animation: none; }");
    expect(reduced).toContain(".clk-tickpop { animation: none; }");
    expect(reduced).toContain(".clk-bird-cheer .clk-bird-body { animation: none; }");
    expect(reduced).toContain(".clk-bird-peek .clk-bird-body { animation: none; }");
    expect(reduced).toContain(".clk-win-glow { animation: none; }");
    // 柔光是静态 filter，不在 reduced 里被关
    expect(HOUSE_CSS.indexOf(".clk-glow")).toBeGreaterThan(-1);
    expect(HOUSE_CSS.indexOf(".clk-glow")).toBeLessThan(HOUSE_CSS.indexOf("prefers-reduced-motion"));
    expect(reduced).not.toContain(".clk-glow");
    // 星屑走 kit 的 sparkle 前缀隔离，reduced 直接不出
    expect(HOUSE_CSS).toContain(".clk-spark");
    expect(HOUSE_CSS).toContain("@keyframes clkSparkFly");
    expect(reduced.includes(".clk-spark { display: none; }") || HOUSE_CSS.includes(".clk-spark { display: none; }")).toBe(
      true
    );
  });

  it("360px：钟面 ≥ 200px 时木牌 ≥ 12px，读数与按钮字号 ≥ 14px", () => {
    // 钟面 viewBox 100，CSS 底线 MIN_FACE_PX=200 → 实际缩放 ≥ 2 倍
    const scale = MIN_FACE_PX / 100;
    expect(NUM_SIGN_H * scale).toBeGreaterThanOrEqual(12);
    expect(NUM_SIGN_W * scale).toBeGreaterThanOrEqual(12);
    const read = CLK_CSS.match(/\.clk-dial-read \{[^}]*font-size: (\d+)px/);
    expect(Number(read![1])).toBeGreaterThanOrEqual(14);
    const toggle = CLK_CSS.match(/\.clk-toggle \{[^}]*font-size: (\d+)px/);
    expect(Number(toggle![1])).toBeGreaterThanOrEqual(14);
    const say = HOUSE_CSS.match(/\.clk-fx-say \{[^}]*font-size: (\d+)px/);
    expect(Number(say![1])).toBeGreaterThanOrEqual(14);
  });
});

describe("时钟小屋 · 视觉 13：destroy 归零", () => {
  it("dial 的 destroy 连小屋装饰层一起收走，读数与拨杆照旧", () => {
    const body = dialSrc.slice(dialSrc.indexOf("destroy() {"));
    expect(body).toContain("house?.remove();");
    expect(body).toContain("house = null;");
    expect(body).toContain("readout.remove();");
    expect(body).toContain("toggle.remove();");
  });

  it("小鸟层的 destroy 清空全部计时器并摘掉节点；helper 的 destroy 会叫它", () => {
    const fx = houseSrc.slice(houseSrc.indexOf("export function mountClockFx"));
    expect(fx).toContain("timers.forEach((t) => clearTimeout(t));");
    expect(fx).toContain("timers.clear();");
    expect(fx).toContain("root.remove();");
    expect(fx).toContain("dead = true;");
    expect(runnerSrc).toContain("fx.destroy();");
    // 摆锤没有 JS 计时器（纯 CSS 动画），节点随小屋一起走
    expect(houseSrc).not.toContain("setInterval");
  });
});

describe("时钟小屋 · 视觉 14–16：小屋外壳规格与 token 表", () => {
  it("4.1 配色 token 一字不差", () => {
    expect(CLK_TOKENS).toEqual({
      houseWood: "#d9a066",
      houseWoodDark: "#a06b3a",
      roofRed: "#e8735a",
      roofRedDark: "#c25542",
      dialCream: "#fff8ec",
      hourOrange: "#ff9f43",
      minuteTeal: "#2ec4b6",
      windowGlow: "#ffe9a8",
      wallPaper: "#f6eef7",
      floorLine: "#e0d4e4",
    });
    const svg = faceSVG(0, 150);
    expect(svg).toContain(`fill="${CLK_TOKENS.dialCream}"`);
    expect(svg).toContain(`stroke="${CLK_TOKENS.houseWood}"`);
  });

  it("屋顶三排交错瓦 + 烟囱三圈砖线 + 布谷鸟门洞", () => {
    const roof = roofSVG();
    expect(ROOF_TILE_ROWS).toBe(3);
    expect(count(roof, "<rect")).toBeGreaterThanOrEqual(ROOF_TILE_ROWS * 10);
    expect(roof).toContain(`fill="${CLK_TOKENS.roofRed}"`);
    expect(roof).toContain(`fill="${CLK_TOKENS.roofRedDark}"`);
    expect(roof).toContain('class="clk-chimney"');
    expect(count(roof.slice(roof.indexOf("clk-chimney")), "<line")).toBeGreaterThanOrEqual(3);
    expect(roof).toContain('class="clk-bird-door"');
    expect(roof).toContain('aria-hidden="true"');
  });

  it("屋底：摆锤（金锤 + 高光弧）、两扇暖光小窗、左右盆栽", () => {
    const base = baseSVG();
    expect(base).toContain('class="clk-pend"');
    expect(count(base, 'class="clk-window"')).toBe(2);
    expect(count(base, `fill="${CLK_TOKENS.windowGlow}"`)).toBe(2);
    expect(count(base, 'class="clk-plant"')).toBe(2);
    // 摆锤 2s 周期、±14 度，锚点钉在屋底
    expect(HOUSE_CSS).toContain(".clk-pend { animation: clkPendSwing 2s ease-in-out infinite;");
    expect(HOUSE_CSS).toContain("rotate(14deg)");
    expect(HOUSE_CSS).toContain("rotate(-14deg)");
    expect(HOUSE_CSS).toContain("transform-origin: 50% 0;");
  });

  it("小屋图层序：屋顶 → 屋身开槽 → 屋底；dial 把钟面搬进开槽", () => {
    const html = houseHTML();
    const roof = html.indexOf("clk-house-roof");
    const mid = html.indexOf("clk-house-mid");
    const base = html.indexOf("clk-house-base");
    expect(roof).toBeGreaterThan(-1);
    expect(mid).toBeGreaterThan(roof);
    expect(base).toBeGreaterThan(mid);
    expect(dialSrc).toContain('house.className = "clk-house";');
    expect(dialSrc).toContain('house.querySelector(".clk-house-mid")');
    // 房间语义：墙纸底色 + 地板线在 .clk-house 自己的背景里
    expect(HOUSE_CSS).toContain(`background-color: ${CLK_TOKENS.wallPaper};`);
    expect(HOUSE_CSS).toContain(CLK_TOKENS.floorLine);
  });

  it("分针跨分「哒」一格：180ms 规格弹性曲线，animationend 收类名，不开计时器", () => {
    expect(HOUSE_CSS).toContain("animation: clkTickPop 180ms cubic-bezier(.34,1.56,.64,1);");
    expect(dialSrc).toContain('minutePath.classList.add("clk-tickpop");');
    expect(dialSrc).toContain('on<AnimationEvent>(minutePath, "animationend"');
    expect(count(dialSrc, "setTimeout")).toBe(0);
  });

  it("HOUSE_CSS 关键帧全部 clk 前缀，样式走独立 style 节点、destroy 一起收", () => {
    const frames = [...HOUSE_CSS.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    expect(frames.length).toBeGreaterThanOrEqual(5);
    for (const f of frames) expect(f.startsWith("clk"), `关键帧 ${f} 没带 clk 前缀`).toBe(true);
    expect(runnerSrc).toContain("skin.textContent = HOUSE_CSS;");
    expect(runnerSrc).toContain("skin.remove();");
  });
});
