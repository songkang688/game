/**
 * 萌猫小屋 · 逗猫 / 打扮的场地必须真的点得着（窗口5 第1轮 档C 监督修复员）。
 *
 * 本轮真机复审抓到的一条阻断（W5-F-14）：`.ktc-field` **一条样式都没有**。
 * 390×844 上量到的样子是——
 *
 * - `.ktc-field` 盒子 313×**0**，`position:static`、`z-index:auto`；
 *   `document.elementFromPoint(场地中心)` 拿回来的是 `.ktc-wrap`，
 *   于是场地上那两个监听（`pointerdown` / `pointermove`，逗猫唯一的操作方式、
 *   打扮松手吸附的判定入口）真手指一辈子收不到。
 * - 场地里 `position:absolute` 的孩子（`.ktc-toy` / `.ktc-chaser` / 两个吸附圈）
 *   于是拿 `.ktc-wrap` 当定位祖先，`left/top` 的百分比算到整间屋子上；
 *   又因为自己没有 `z-index`，被 `.ktc-cats`（`z-index:2`）压在下面——
 *   真实坐标点逗猫棒 6 下，棒子收到的 `click` 是 **0 次**。
 * - 两个吸附圈都没有偏移，会叠在同一个点上，「头顶」和「脖子」分不开。
 *
 * 闯关没有倒计时，逗猫做不完就永远卡在那儿，所以按**阻断**记。
 * 这里守的是「样式与结构」这一层：CSS 里必须有这几条，舞台必须在摆场地时给
 * `.ktc-wrap` 挂上 `ktc-hasfield`（猫收一档，省出来的高度给场地）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Arena, type TaskSpec } from "./arena";
import { FIELD_CAT_H, FIELD_H, FIELD_STACK_PX, KTC_CSS } from "./styles";
import { Life, type TimerHost } from "./runtime";
import { findOne, installDom, type InstalledDom, type StubEl } from "./domStub";

/** 假时钟：一条真的 timer / rAF 都不许溜进来 */
class TinyClock {
  private seq = 1;
  readonly timers = new Map<number, () => void>();
  readonly loops = new Map<number, () => void>();
  readonly frames = new Map<number, (t: number) => void>();

  setTimeout(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.timers.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timers.delete(id as unknown as number);
  }

  setInterval(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.loops.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearInterval(id: ReturnType<typeof setTimeout>): void {
    this.loops.delete(id as unknown as number);
  }

  requestAnimationFrame(fn: (t: number) => void): number {
    const id = this.seq++;
    this.frames.set(id, fn);
    return id;
  }

  cancelAnimationFrame(id: number): void {
    this.frames.delete(id);
  }
}

/** 从 CSS 文本里抠出某个选择器的声明块（只找第一处） */
function ruleOf(selector: string): string {
  const at = KTC_CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = KTC_CSS.indexOf("{", at) + 1;
  const to = KTC_CSS.indexOf("}", from);
  return KTC_CSS.slice(from, to).replace(/\s+/g, "");
}

const SPEC = (task: TaskSpec["task"]): TaskSpec => ({
  task,
  target: 0,
  seed: 11,
  options: 3,
  playTaps: 3,
  notes: 3,
  cureSteps: 2,
  styleSlots: 3
});

describe("萌猫小屋 · 逗猫 / 打扮的场地点得着（W5-F-14 阻断）", () => {
  let dom: InstalledDom;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    life = new Life(new TinyClock() as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  function makeArena(catCount = 1): Arena {
    return new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount,
      moodStart: 0,
      moodMax: 0,
      theme: 6,
      reduceMotion: true
    });
  }

  it("`.ktc-field` 得有真实高度、自己当定位祖先、并且和别的交互层同一层", () => {
    const rule = ruleOf(".ktc-field");
    expect(rule, "场地必须自己是定位祖先，孩子的百分比才算在场地上").toContain("position:relative");
    expect(rule, "不抬到 z-index:3 就会被 .ktc-cats(z-index:2) 压住").toContain("z-index:3");
    expect(rule, `场地高度塌成 0 就收不到真手指`).toContain(`height:${FIELD_H}px`);
    expect(rule, "画圈逗猫要吃掉浏览器的默认手势").toContain("touch-action:none");
    expect(FIELD_H).toBeGreaterThanOrEqual(120);
  });

  it("其余交互层是什么规格，场地就得是什么规格（口径一致，不是特例）", () => {
    for (const sel of [".ktc-tray", ".ktc-btns", ".ktc-beats", ".ktc-washwrap", ".ktc-field"]) {
      const rule = ruleOf(sel);
      expect(rule, `${sel} 少了 position:relative`).toContain("position:relative");
      expect(rule, `${sel} 少了 z-index:3`).toContain("z-index:3");
    }
  });

  it("两个吸附圈得错开——不然「头顶」和「脖子」叠在同一个点上", () => {
    const head = ruleOf(".ktc-spot-head");
    const neck = ruleOf(".ktc-spot-neck");
    const topOf = (rule: string): number => Number(/top:(-?\d+)px/.exec(rule)?.[1] ?? Number.NaN);
    expect(Number.isFinite(topOf(head)), "头顶的圈没有 top 偏移").toBe(true);
    expect(Number.isFinite(topOf(neck)), "脖子的圈没有 top 偏移").toBe(true);
    // 圈是 64px，两个圈之间至少要拉开一个圈的距离才点得开
    expect(Math.abs(topOf(neck) - topOf(head)), "两个吸附圈离得太近，手指分不开").toBeGreaterThanOrEqual(64);
    // 两个圈都得留在场地里（场地 overflow:hidden，露到外面就等于点不着）
    expect(topOf(head)).toBeGreaterThanOrEqual(0);
    expect(topOf(neck) + 64).toBeLessThanOrEqual(FIELD_H);
  });

  it("棒子与爪印按中心点定位，贴着场地边也不会有一半落在场地外", () => {
    expect(ruleOf(".ktc-toy")).toContain("transform:translate(-50%,-50%)");
    expect(ruleOf(".ktc-chaser")).toContain("transform:translate(-50%,-50%)");
    expect(ruleOf(".ktc-chaser")).toContain("position:absolute");
  });

  it("摆场地的两种任务都要给 `.ktc-wrap` 挂 `ktc-hasfield`，别的任务不许挂", () => {
    const arena = makeArena();
    const wrap = findOne(host, "ktc-wrap")!;

    arena.startTask(SPEC("play"), () => {});
    expect(findOne(host, "ktc-field"), "逗猫得摆出场地").toBeTruthy();
    expect(wrap.classList.contains("ktc-hasfield"), "逗猫没给 .ktc-wrap 挂 ktc-hasfield").toBe(true);

    arena.startTask(SPEC("dress"), () => {});
    expect(findOne(host, "ktc-field"), "打扮得摆出场地").toBeTruthy();
    expect(wrap.classList.contains("ktc-hasfield")).toBe(true);

    for (const task of ["feed", "wash", "sleep", "cure", "style"] as const) {
      arena.startTask(SPEC(task), () => {});
      expect(findOne(host, "ktc-field"), `${task} 不该摆场地`).toBeNull();
      expect(wrap.classList.contains("ktc-hasfield"), `${task} 不该留着 ktc-hasfield`).toBe(false);
    }
  });

  it("场地在场时猫收一档，猫 + 场地不许比原来的猫更高（不然底下的提示行会被舞台裁掉）", () => {
    const rule = ruleOf(".ktc-wrap.ktc-hasfield .ktc-cat-svg");
    expect(rule).toContain(`height:${FIELD_CAT_H}px`);
    expect(rule, "只改高度不改宽度会把猫压扁").toContain("width:auto");
    // 真机量到的原始猫区高度是 313px（390×844，`.ktc-cats`）
    expect(FIELD_STACK_PX, "猫收一档省出来的高度不够摆场地").toBeLessThanOrEqual(300);
  });

  it("场地的两个监听还在（这是逗猫唯一的操作方式，别改着改着改没了）", () => {
    makeArena().startTask(SPEC("play"), () => {});
    const field = findOne(host, "ktc-field")!;
    expect(field.listeners.has("pointerdown"), "场地上没有 pointerdown").toBe(true);
    expect(field.listeners.has("pointermove"), "场地上没有 pointermove").toBe(true);
  });

  it("多猫关：场地摆出来了，猫还得点得中（场地不许糊在猫身上）", () => {
    const arena = makeArena(2);
    arena.startTask(SPEC("play"), () => {});
    const cats = findOne(host, "ktc-cats")!;
    expect(cats.children.length).toBe(2);
    // 场地是 .ktc-play 的孩子，跟 .ktc-cats 是兄弟——两者不重叠，猫照样点得中
    const field = findOne(host, "ktc-field")!;
    expect(field.parent?.classList.contains("ktc-play")).toBe(true);
    cats.children[1].fire("click");
    expect(arena.selected).toBe(1);
  });
});
