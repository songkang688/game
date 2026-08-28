/**
 * 萌猫小屋 · 1.3 视觉升级用例（第 26 步 C 档，只增不减）。
 *
 * 钉住的口径：
 *  - 三态立绘只是 `curePlan` 进度的**函数**，一行判定不掺和；
 *  - 步骤卡链 / 爪印章 / 道具图标 / 对错分支全是换皮，`cureHint` / `cureMessage`
 *    的文本与按钮文案（aria-label + 小字）一字不差；
 *  - `drawSlot` / `drawScore` 换肤前后计分数据一致（含 188 关口径，不回退成 99 关）；
 *  - 窗台摆件只读痊愈进度；reduced 下尾摆 / 打滚 / 泡泡 / 彩纸全停但三态照常切换；
 *  - `destroy` 之后泡泡与动画计时器一个不剩。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Arena, type TaskSpec } from "./arena";
import { KTC_CSS } from "./styles";
import { meta } from "./meta";
import { CURE_TOOLS, LEGACY_LEVELS, LEVELS, buildCureRound, buildStyleRound } from "./levels";
import { cureHint, cureMessage, curePick, curePlan, cureStart, scoreOutfit, type CureState } from "./tasks";
import {
  MEOW_TEXT,
  PURR_TEXT,
  ROOM_COLORS,
  bubbleTailX,
  calicoVariantForSeed,
  confettiSpecs,
  furForSeed,
  heartBubbleSpecs,
  kittyStateFor,
  roomScene,
  sillOrnaments,
  splitStepText,
  stepCenterOffset,
  toolIconSvg
} from "./cureScene";
import { KITTY_FURS } from "../../art/kit/kittySvg";
import { Life, type TimerHost } from "./runtime";
import { findAll, findOne, installDom, type InstalledDom, type StubEl } from "./domStub";

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

  runTimers(): void {
    const list = [...this.timers.values()];
    this.timers.clear();
    for (const fn of list) fn();
  }

  get alive(): number {
    return this.timers.size + this.loops.size + this.frames.size;
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

const SPEC: TaskSpec = {
  task: "cure",
  target: 0,
  seed: 5,
  options: 4,
  playTaps: 3,
  notes: 3,
  cureSteps: 2,
  styleSlots: 3
};

/** 跟舞台同参数的那一局（纯函数重算，当对照组） */
const ROUND = buildCureRound(SPEC.seed, SPEC.cureSteps, Math.min(SPEC.options + 1, 6));

describe("萌猫小屋 1.3 · 纯映射函数（三态 / 毛色 / 摆件 / 几何）", () => {
  it("三态立绘与 curePlan 进度三点映射：没动手=sick、做起来=caring、做完=cured", () => {
    expect(kittyStateFor(0, false)).toBe("sick");
    expect(kittyStateFor(1, false)).toBe("caring");
    expect(kittyStateFor(2, true)).toBe("cured");
    // 映射只读进度，不产出任何判定：同一份 CureState 算前算后一个字段没变
    const state: CureState = cureStart(ROUND);
    const before = JSON.stringify(state);
    kittyStateFor(state.step, state.done);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("毛色按局三选一且确定：连续种子把三种毛色都取到，同种子永远同色同斑位", () => {
    expect(new Set([furForSeed(0), furForSeed(1), furForSeed(2)])).toEqual(new Set(KITTY_FURS));
    expect(furForSeed(SPEC.seed)).toBe(furForSeed(SPEC.seed));
    expect(calicoVariantForSeed(SPEC.seed)).toBe(calicoVariantForSeed(SPEC.seed));
    expect([0, 1]).toContain(calicoVariantForSeed(SPEC.seed));
    expect(furForSeed(Number.NaN)).toBe(KITTY_FURS[0]);
  });

  it("窗台摆件 = 痊愈进度映射：0→0、3→2、5→3，单调不减、封顶 4，进度只读", () => {
    expect(sillOrnaments(0)).toBe(0);
    expect(sillOrnaments(3)).toBe(2);
    expect(sillOrnaments(5)).toBe(3);
    for (let n = 1; n < 30; n++) expect(sillOrnaments(n)).toBeGreaterThanOrEqual(sillOrnaments(n - 1));
    expect(sillOrnaments(99)).toBe(4);
    expect(sillOrnaments(-3)).toBe(0);
    expect(sillOrnaments(Number.NaN)).toBe(0);
    // 场景串里的摆件个数就是这个映射
    for (const n of [0, 3, 5]) {
      expect([...roomScene(n).matchAll(/data-ornament/g)].length).toBe(sillOrnaments(n));
    }
  });

  it("对话气泡尾巴几何：指向小猫中心、夹在 8..92%、量不到就居中", () => {
    expect(bubbleTailX({ left: 0, width: 300 }, { left: 100, width: 100 })).toBe(50);
    expect(bubbleTailX({ left: 0, width: 200 }, { left: 30, width: 40 })).toBe(25);
    expect(bubbleTailX({ left: 0, width: 100 }, { left: 900, width: 40 })).toBe(92);
    expect(bubbleTailX({ left: 500, width: 100 }, { left: 0, width: 40 })).toBe(8);
    expect(bubbleTailX(undefined, { left: 0, width: 40 })).toBe(50);
    expect(bubbleTailX({ left: 0, width: 0 }, { left: 0, width: 40 })).toBe(50);
    // CSS 里的尾巴真的吃这个变量
    expect(KTC_CSS).toContain(".ktc-wrap.ktc-caring .ktc-msg::before");
    expect(ruleOf(".ktc-wrap.ktc-caring .ktc-msg::before")).toContain("left:var(--ktc-tail-x,50%)");
  });

  it("步骤卡当前步居中：算出的 scrollLeft 让卡片正好在中间，最左不出负", () => {
    expect(stepCenterOffset(100, 60, 200)).toBe(30);
    expect(stepCenterOffset(0, 60, 200)).toBe(0);
    expect(stepCenterOffset(50, 40, 0)).toBe(0);
  });

  it("curePlan 文本拆图标位不丢字：done / now 拆出打头符号，todo 的「· · ·」整个保留", () => {
    expect(splitStepText("🧻 擦擦小鼻子")).toEqual({ icon: "🧻", label: "擦擦小鼻子" });
    expect(splitStepText("❓ 先看一看")).toEqual({ icon: "❓", label: "先看一看" });
    expect(splitStepText("· · ·")).toEqual({ icon: "", label: "· · ·" });
    expect(splitStepText("纯文字整个当名字")).toEqual({ icon: "", label: "纯文字整个当名字" });
  });

  it("道具图标 ≥ 6 种、两两不同、id 隔离；认不得的名字有兜底不空着", () => {
    const svgs = CURE_TOOLS.map((t) => toolIconSvg(t.name));
    expect(svgs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(svgs).size).toBe(CURE_TOOLS.length);
    const keys = svgs.map((s) => /data-tool="([^"]+)"/.exec(s)?.[1]);
    expect(new Set(keys).size).toBe(CURE_TOOLS.length);
    for (const s of svgs) {
      expect(s).toContain("<linearGradient");
      expect(s).toContain("stroke");
      expect(s.toLowerCase()).not.toContain("<script");
      expect(s).not.toContain("NaN");
      expect(s).not.toContain("url(#G)");
    }
    expect(toolIconSvg("没这样东西")).toContain('data-tool="care"');
  });

  it("爱心泡泡 5 颗与彩纸轨迹确定、颗颗错开；小屋场景串带齐六样陈设", () => {
    const hearts = heartBubbleSpecs();
    expect(hearts).toHaveLength(5);
    expect(new Set(hearts.map((h) => h.leftPct)).size).toBe(5);
    expect(heartBubbleSpecs()).toEqual(hearts);
    const bits = confettiSpecs();
    expect(bits.length).toBeGreaterThanOrEqual(5);
    expect(new Set(bits.map((b) => b.leftPct)).size).toBe(bits.length);
    const scene = roomScene(0);
    for (const cls of ["ktc-scn-beam", "ktc-scn-window", "ktc-scn-frames", "ktc-scn-tree", "ktc-scn-rug", "ktc-scn-bed"]) {
      expect(scene, `场景里少了 ${cls}`).toContain(cls);
    }
    // 地毯配色走规格 token
    expect(ROOM_COLORS.rug).toBe("#f2c6c2");
    expect(KTC_CSS).toContain(ROOM_COLORS.rug);
  });
});

describe("萌猫小屋 1.3 · 看病舞台换皮（判定与文案零改动）", () => {
  let dom: InstalledDom;
  let clock: TinyClock;
  let life: Life;
  let host: StubEl;

  beforeEach(() => {
    dom = installDom();
    clock = new TinyClock();
    life = new Life(clock as unknown as TimerHost);
    host = dom.doc.createElement("div");
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  function makeArena(reduce = true, cured = 0): Arena {
    return new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount: 1,
      moodStart: 0,
      moodMax: 0,
      theme: 6,
      cured,
      reduceMotion: reduce
    });
  }

  /** 护理台上现在摆着的道具按钮 */
  const tools = (): StubEl[] => findAll(host, "ktc-btn");
  const clickTool = (name: string): void => {
    tools().find((b) => b.getAttribute("aria-label") === name)!.fire("click");
  };
  const kittyHtml = (): string => (findOne(host, "ktc-kitty") as StubEl & { innerHTML: string }).innerHTML;

  it("三态立绘随流程走：sick → caring → cured，流程数据与完成回调原样", () => {
    const arena = makeArena();
    let done = 0;
    arena.startTask(SPEC, () => {
      done++;
    });
    expect(kittyHtml()).toContain('data-state="sick"');
    expect(kittyHtml()).toContain(`data-fur="${furForSeed(SPEC.seed)}"`);

    clickTool(ROUND.steps[0].answer.name);
    expect(kittyHtml()).toContain('data-state="caring"');

    clickTool(ROUND.steps[1].answer.name);
    expect(kittyHtml()).toContain('data-state="cured"');
    expect(arena.mistakes).toBe(0);
    clock.runTimers();
    expect(done, "换皮不许碰完成流程").toBe(1);
  });

  it("同一关进两次，立绘逐字节一致（毛色与三花斑位跟种子，不闪变）", () => {
    makeArena().startTask(SPEC, () => {});
    const first = kittyHtml();
    (findOne(host, "ktc-wrap") as StubEl).remove();
    makeArena().startTask(SPEC, () => {});
    expect(kittyHtml()).toBe(first);
  });

  it("步骤卡状态类名与 curePlan 的 step.state 一一对应，卡上文字一字不丢", () => {
    makeArena().startTask(SPEC, () => {});
    let state = cureStart(ROUND);
    const check = (): void => {
      const cards = findAll(host, "ktc-step");
      const plan = curePlan(state);
      expect(cards).toHaveLength(plan.length);
      plan.forEach((step, i) => {
        expect(cards[i].classList.contains(`ktc-step-${step.state}`), `第 ${i + 1} 张卡该是 ${step.state}`).toBe(true);
        const part = splitStepText(step.text);
        expect(cards[i].textContent).toContain(part.label);
        if (part.icon) expect(cards[i].textContent).toContain(part.icon);
      });
      // 卡间箭头描边化：n 张卡 n−1 个箭头
      expect(findAll(host, "ktc-step-arrow")).toHaveLength(plan.length - 1);
    };
    check();
    state = curePick(state, ROUND.steps[0].answer.name).state;
    clickTool(ROUND.steps[0].answer.name);
    check();
  });

  it("爪印章只盖在做完的那张卡上，todo / now 卡上一个都没有", () => {
    makeArena().startTask(SPEC, () => {});
    expect(findAll(host, "ktc-stamp")).toHaveLength(0);
    clickTool(ROUND.steps[0].answer.name);
    const stamps = findAll(host, "ktc-stamp");
    expect(stamps).toHaveLength(1);
    expect(stamps[0].parent!.classList.contains("ktc-step-done")).toBe(true);
    for (const card of findAll(host, "ktc-step")) {
      if (!card.classList.contains("ktc-step-done")) {
        expect(findAll(card, "ktc-stamp")).toHaveLength(0);
      }
    }
  });

  it("道具按钮：图标上身、文案原样（aria-label + 小字 = 工具名，一字不差）", () => {
    makeArena().startTask(SPEC, () => {});
    const row = findAll(host, "ktc-tool");
    expect(row).toHaveLength(ROUND.steps[0].options.length);
    ROUND.steps[0].options.forEach((tool, i) => {
      expect(row[i].getAttribute("aria-label")).toBe(tool.name);
      const small = row[i].children.find((c) => c.tagName === "small")!;
      expect(small.textContent).toBe(tool.name);
      const icon = findOne(row[i], "ktc-toolicon") as (StubEl & { innerHTML: string }) | null;
      expect(icon, `${tool.name} 没配图标`).toBeTruthy();
      expect(icon!.innerHTML).toBe(toolIconSvg(tool.name));
    });
  });

  it("选对 / 选错互斥分支：飞行图标 ↔「喵?」气泡，cureHint / cureMessage 文本原样", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    const state = cureStart(ROUND);
    expect(findOne(host, "ktc-msg")!.textContent).toBe(cureHint(state));

    // 选错：只出「喵?」，没有飞行图标，屏幕留的是那句针对性的话
    const wrong = ROUND.steps[0].options.find((t) => t.name !== ROUND.steps[0].answer.name)!;
    const miss = curePick(state, wrong.name);
    clickTool(wrong.name);
    expect(findOne(host, "ktc-meow")!.textContent).toBe(MEOW_TEXT);
    expect(findOne(host, "ktc-fly")).toBeNull();
    expect(findOne(host, "ktc-msg")!.textContent).toBe(cureMessage(miss.note, cureHint(miss.state), true));
    expect(arena.mistakes).toBe(1);

    // 选对：图标飞向小猫，「喵?」让位，msg 是「做好了 + 下一步提示」的拼接
    const good = curePick(state, ROUND.steps[0].answer.name);
    clickTool(ROUND.steps[0].answer.name);
    expect(findOne(host, "ktc-fly")).toBeTruthy();
    expect(findOne(host, "ktc-meow")).toBeNull();
    expect(findOne(host, "ktc-msg")!.textContent).toBe(cureMessage(good.note, cureHint(good.state), false));
  });

  it("窗台摆件个数 = 痊愈进度映射（0 / 3 / 5 三点），装饰层不接指针", () => {
    for (const n of [0, 3, 5]) {
      const arena = makeArena(true, n);
      const scene = findOne(host, "ktc-scene") as StubEl & { innerHTML: string };
      expect([...scene.innerHTML.matchAll(/data-ornament/g)].length, `进度 ${n}`).toBe(sillOrnaments(n));
      arena.destroy();
    }
    expect(ruleOf(".ktc-scene")).toContain("pointer-events:none");
    expect(ruleOf(".ktc-nook")).toContain("pointer-events:none");
    expect(ruleOf(".ktc-carefx")).toContain("pointer-events:none");
  });

  it("痊愈仪式：咕噜气泡 + 爱心泡泡 5 颗 + 彩纸上台，卡链全部盖章", () => {
    const arena = makeArena(false);
    arena.startTask(SPEC, () => {});
    clickTool(ROUND.steps[0].answer.name);
    clickTool(ROUND.steps[1].answer.name);
    expect(findOne(host, "ktc-purr")!.textContent).toBe(PURR_TEXT);
    expect(findAll(host, "ktc-heartbubble")).toHaveLength(5);
    expect(findAll(host, "ktc-confetti").length).toBeGreaterThanOrEqual(5);
    expect((findOne(host, "ktc-kitty") as StubEl).classList.contains("ktc-kitty-roll")).toBe(true);
    const cards = findAll(host, "ktc-step");
    expect(cards.every((c) => c.classList.contains("ktc-step-done"))).toBe(true);
    expect(findAll(host, "ktc-stamp")).toHaveLength(cards.length);
  });

  it("reduced：泡泡 / 彩纸 / 打滚全不生成、飞行图标瞬贴，三态静止立绘照常切换", () => {
    const arena = makeArena(true);
    arena.startTask(SPEC, () => {});
    expect(kittyHtml()).toContain('data-state="sick"');
    clickTool(ROUND.steps[0].answer.name);
    expect(kittyHtml()).toContain('data-state="caring"');
    expect((findOne(host, "ktc-fly") as StubEl).classList.contains("ktc-fly-still")).toBe(true);
    clickTool(ROUND.steps[1].answer.name);
    expect(kittyHtml()).toContain('data-state="cured"');
    expect(findAll(host, "ktc-heartbubble")).toHaveLength(0);
    expect(findAll(host, "ktc-confetti")).toHaveLength(0);
    expect((findOne(host, "ktc-kitty") as StubEl).classList.contains("ktc-kitty-roll")).toBe(false);
    // 样式里 reduced 把尾摆 / 打滚 / 印章动画全按停，泡泡彩纸直接不显示
    const reduced = KTC_CSS.slice(KTC_CSS.lastIndexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reduced).toContain(".ktc-kitty-sway");
    expect(reduced).toContain(".ktc-kitty-roll .ktc-kitty-svg");
    expect(reduced.replace(/\s+/g, "")).toContain(".ktc-heartbubble,.ktc-confetti{display:none;}");
  });

  it("destroy 之后：泡泡计时器归零、循环归零、舞台从页面上摘掉", () => {
    const arena = makeArena(false);
    arena.startTask(SPEC, () => {});
    clickTool(ROUND.steps[0].answer.name);
    clickTool(ROUND.steps[1].answer.name);
    expect(clock.alive, "仪式的收尸计时器该在场").toBeGreaterThan(0);
    arena.destroy();
    life.destroy();
    expect(clock.alive, "destroy 之后还剩计时器").toBe(0);
    expect(arena.liveLoops).toBe(0);
    expect(host.children).toHaveLength(0);
  });

  it("看病里 say 区披上对话气泡皮，换成别的任务就脱下（文字内容始终没动）", () => {
    const arena = makeArena();
    arena.startTask(SPEC, () => {});
    const wrap = findOne(host, "ktc-wrap")!;
    expect(wrap.classList.contains("ktc-caring")).toBe(true);
    arena.startTask({ ...SPEC, task: "feed" }, () => {});
    expect(wrap.classList.contains("ktc-caring")).toBe(false);
    // 气泡皮只挂在 ktc-caring 下，别的任务的提示行样式一条没动
    expect(KTC_CSS).toContain(".ktc-wrap.ktc-caring .ktc-msg{");
  });
});

describe("萌猫小屋 1.3 · 搭配计分换肤前后一致（drawSlot / drawScore 回归）", () => {
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

  it("槽位穿卡壳、计分牌换木质，但每一行评分与合计一字不差", () => {
    const arena = new Arena(host as unknown as HTMLElement, {
      life,
      sfx: () => {},
      catCount: 1,
      moodStart: 0,
      moodMax: 0,
      theme: 6,
      reduceMotion: true
    });
    const spec: TaskSpec = { ...SPEC, task: "style", seed: 11, options: 3 };
    arena.startTask(spec, () => {});
    const round = buildStyleRound(11, 3, Math.min(3 + 1, 6));
    const picks = [] as Array<(typeof round.slots)[number]["options"][number]>;
    for (let slot = 0; slot < 3; slot++) {
      const buttons = findAll(host, "ktc-btn");
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((b) => b.classList.contains("ktc-slotcard")), "槽位没穿卡壳").toBe(true);
      // 文案回归：aria-label 仍是「名字\n标签」
      const item = round.slots[slot].options[0];
      const tags = item.tags.length > 0 ? item.tags.join("·") : "百搭";
      expect(buttons[0].getAttribute("aria-label")).toBe(`${item.name}\n${tags}`);
      picks.push(item);
      buttons[0].fire("click");
    }
    const panel = findOne(host, "ktc-score")!;
    expect(panel.classList.contains("ktc-wood"), "计分牌没换木质皮").toBe(true);
    const score = scoreOutfit(picks, round.theme);
    const text = panel.textContent;
    expect(text).toContain("评分规则：加分标签 +1，减分标签 −1，百搭 +1");
    for (const line of score.lines) {
      expect(text).toContain(`${line.emoji} ${line.name}：${line.reason}（${line.delta >= 0 ? "+" : ""}${line.delta}）`);
    }
    expect(text).toContain(`合计 ${score.total} / ${score.max} 分 · ${score.label}`);
  });

  it("188 关口径原样：不回退成「99 关」，前 99 关只是里程碑不是总数", () => {
    expect(LEVELS).toHaveLength(188);
    expect(LEGACY_LEVELS).toBe(99);
    expect(meta.levels).toBe(LEVELS.length);
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).not.toContain("99 关");
  });
});
