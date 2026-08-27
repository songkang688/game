/**
 * 豆豆迷宫 · 窗口 2 第 1 轮验收 · 测试员包 A 的复现测试。
 *
 * 只记录、不改玩法。既有的 index.test.ts 已经把「挂得上、拆得干净」测透了，
 * 这一份补的是走查铁则里它没覆盖的三块：
 *  - 铁则 1：在**界面上**真的赢一次、真的输一次，再退出、再进来；
 *  - 铁则 3：四种玩法各自的键位归属（朵朵 WASD、星星 方向键、Esc 暂停，互不抢占）；
 *  - 铁则 4 / 5：360px 的热区，以及 meta.blurb 与实现里的叫法对不对得上。
 *
 * 标了「【已知问题】」的用例断言的是**当前行为**，修好之后会红，那时候连断言一起翻面。
 * 记在 `docs/qa/1.2-window2-round1-tester-packA.md` 的问题表里：
 *  - PA-DM-1（一般）：`.dmz-btn`（换个玩法 / 回选关）靠 padding 撑高度，只有 33px 出头；
 *  - PA-DM-2（一般）：`meta.blurb` 把豆子叫「小星星」，可界面上「⭐ 小星命」才是小星星，
 *    HUD 与攻略里一律叫「豆」，卡片和游戏里对不上；
 *  - PA-DM-3（一般）：规格里朵朵的 F / G 与星星的 L / K 四个键都没接。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configFor } from "./levels";
import { El, fireWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./domStub";
import type { RunConfig } from "./logic";
import type { Maze } from "./maze";
import { meta } from "./meta";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

/**
 * 一条七格长的走廊：`#` 是墙，第 1 行是通路。
 * 用它把「真的赢一次 / 真的输一次」压进几十帧里跑完，
 * 走的仍然是 index.ts → logic.ts 的同一套代码，不是把结果硬塞进回调。
 */
function corridor(opts: { dotsAt: number[]; homeX: number }): Maze {
  const w = 7;
  const h = 3;
  const wall: boolean[] = [];
  const dot: boolean[] = [];
  const power: boolean[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isWall = y !== 1 || x === 0 || x === w - 1;
      wall.push(isWall);
      dot.push(!isWall && opts.dotsAt.includes(x));
      power.push(false);
    }
  }
  return { w, h, wall, dot, power, tunnelRows: [], spawn: { x: 1, y: 1 }, home: { x: opts.homeX, y: 1 } };
}

function corridorCfg(over: Partial<RunConfig> = {}): RunConfig {
  return {
    maze: corridor({ dotsAt: [2, 3], homeX: 5 }),
    tier: "rookie",
    ghostCount: 0,
    lives: 3,
    stepMs: 120,
    fruitAt: [],
    fog: false,
    ...over,
  };
}

function fakeApi() {
  const sounds: string[] = [];
  const wins: string[] = [];
  const loses: string[] = [];
  return {
    sounds,
    wins,
    loses,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => sounds.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: (_s: number, m?: string) => wins.push(m ?? ""),
      onLose: (m?: string) => loses.push(m ?? ""),
    } as never,
  };
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function key(k: string): void {
  fireWindow(dom, "keydown", { key: k });
}

function css(): string {
  const style = dom.root.find((e) => e.tagName === "style");
  if (!style) throw new Error("样式没挂出来");
  return style.textContent;
}

/** 一条 CSS 规则算下来能点多高（显式 height 优先，否则按 padding×2 + 字号×1.2 估） */
function hitHeight(sheet: string, selector: string): number {
  const m = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(sheet);
  if (!m) return Number.NaN;
  const body = m[1];
  const explicit = /(?:^|;)\s*(?:min-)?height:\s*([\d.]+)px/.exec(body);
  if (explicit) return Number(explicit[1]);
  const pad = /(?:^|;)\s*padding:\s*([\d.]+)px/.exec(body);
  const font = /(?:^|;)\s*font-size:\s*([\d.]+)px/.exec(body);
  if (!pad || !font) return Number.NaN;
  return Number(pad[1]) * 2 + Number(font[1]) * 1.2;
}

/* ------------------------------------------------------------------ */
/* PA-DM · 铁则 1：界面上真的赢一次、真的输一次                          */
/* ------------------------------------------------------------------ */

describe("PA-DM · 一局迷宫的真实胜负", () => {
  it("把豆子吃光就真的赢了：onEnd 报 won，HUD 也归零", async () => {
    const { mountStage } = await import("./index");
    const ends: Array<{ won: boolean; livesLeft: number }> = [];
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: corridorCfg(),
      starRole: "none",
      label: "走查",
      onEnd: (r) => ends.push({ won: r.won, livesLeft: r.livesLeft }),
    });
    key("d");
    for (let i = 0; i < 20 && ends.length === 0; i++) flushFrames(dom, 1, 130);
    expect(ends, "走到底也没赢").toHaveLength(1);
    expect(ends[0].won).toBe(true);
    expect(ends[0].livesLeft).toBe(3);
    expect(dom.root.querySelector(".dmz-left")!.textContent).toContain("剩 0");
    handle.destroy();
  });

  it("小星命掉光就真的输了：onEnd 报 !won，播报是鼓励不是批评", async () => {
    const { mountStage } = await import("./index");
    const ends: Array<{ won: boolean }> = [];
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      // 只有一条命，小幽灵就守在朵朵右手边第一格，豆子还在它后面，绕不过去
      cfg: corridorCfg({ ghostCount: 1, lives: 1, maze: corridor({ dotsAt: [4, 5], homeX: 2 }) }),
      starRole: "none",
      label: "走查",
      onEnd: (r) => ends.push({ won: r.won }),
    });
    key("d");
    for (let i = 0; i < 80 && ends.length === 0; i++) flushFrames(dom, 1, 130);
    expect(ends, "撞了这么多回还没收场").toHaveLength(1);
    expect(ends[0].won).toBe(false);
    const note = dom.root.querySelector(".dmz-note")!.textContent;
    for (const bad of ["笨", "废", "太差", "活该"]) expect(note.includes(bad)).toBe(false);
    handle.destroy();
  });

  it("赢完拆掉再挂一局，照样能从头玩：状态没有串到下一局", async () => {
    const { mountStage } = await import("./index");
    for (let round = 0; round < 2; round++) {
      const ends: boolean[] = [];
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: corridorCfg(),
        starRole: "none",
        label: "走查",
        onEnd: (r) => ends.push(r.won),
      });
      expect(dom.root.querySelector(".dmz-left")!.textContent, `第 ${round + 1} 局开局豆数不对`).toContain("剩 2");
      key("d");
      for (let i = 0; i < 20 && ends.length === 0; i++) flushFrames(dom, 1, 130);
      expect(ends, `第 ${round + 1} 局没赢`).toEqual([true]);
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${round + 1} 局拆完还留着监听`).toBe(0);
      expect(dom.root.children).toHaveLength(0);
    }
  });

  it("闯关第 1 / 100 / 188 关都摆得出舞台，档位与小幽灵数写在 HUD 上", async () => {
    const { mountStage } = await import("./index");
    for (const level of [0, 99, 187]) {
      const cfg = configFor(level);
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg,
        starRole: "none",
        label: `第 ${level + 1} 关`,
        extraChip: () => `第 ${level + 1} 关 · ${cfg.ghostCount} 只小幽灵`,
        onEnd: () => undefined,
      });
      const canvas = dom.root.querySelector(".dmz-canvas")!;
      expect(Number(canvas.getAttribute("data-cols")), `第 ${level + 1} 关列数不对`).toBe(cfg.maze.w);
      // 360px 上每格还得有 14px，整张图才塞得进屏幕
      expect(canvas.width / cfg.maze.w, `第 ${level + 1} 关格子太小`).toBeGreaterThanOrEqual(14);
      expect(dom.root.querySelector(".dmz-extra")!.textContent).toContain(`第 ${level + 1} 关`);
      flushFrames(dom, 6, 120);
      handle.destroy();
      expect(windowListenerCount(dom)).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* PA-DM · 铁则 3：四种玩法的键位归属                                    */
/* ------------------------------------------------------------------ */

describe("PA-DM · 键位归属", () => {
  it("单人玩时 WASD 与方向键等价，谁都能开朵朵", async () => {
    const { mountStage } = await import("./index");
    for (const k of ["d", "ArrowRight"]) {
      const ends: boolean[] = [];
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: corridorCfg(),
        starRole: "none",
        label: "走查",
        onEnd: (r) => ends.push(r.won),
      });
      key(k);
      for (let i = 0; i < 20 && ends.length === 0; i++) flushFrames(dom, 1, 130);
      expect(ends, `按 ${k} 没能把朵朵开动`).toEqual([true]);
      handle.destroy();
    }
  });

  it("抢豆对战里两个人各管各的：一边的键改不动另一边的分数", async () => {
    const { mountStage } = await import("./index");
    // 朵朵和星星都会自己往前走，所以「谁抢占了谁」得跟一局都不按键的对照局比。
    // 同一份 cfg、同一个内部种子，三局的推进完全可复现。
    function run(keys: string[]): [number, number] {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: { ...configFor(60), ghostCount: 0 },
        starRole: "eater",
        label: "抢豆",
        onEnd: () => undefined,
      });
      for (let i = 0; i < 10; i++) {
        for (const k of keys) key(i % 2 === 0 ? k : k);
        flushFrames(dom, 6, 60);
      }
      const m = /朵朵 (\d+) · 星星 (\d+)/.exec(dom.root.querySelector(".dmz-score")!.textContent)!;
      const out: [number, number] = [Number(m[1]), Number(m[2])];
      handle.destroy();
      return out;
    }
    const [baseDuo, baseStar] = run([]);
    // 两边都用「掉头」这个一定生效的动作：朵朵开局朝右，星星开局朝左
    const [duoKeyed, starUntouched] = run(["a"]);
    const [duoUntouched, starKeyed] = run(["ArrowRight"]);
    expect(duoKeyed, "按了 WASD 朵朵的路线却一点没变").not.toBe(baseDuo);
    expect(starUntouched, "朵朵按 WASD 把星星的分数也带偏了").toBe(baseStar);
    expect(starKeyed, "按了方向键星星的路线却一点没变").not.toBe(baseStar);
    expect(duoUntouched, "星星按方向键把朵朵的分数也带偏了").toBe(baseDuo);
  });

  it("双人追逃里方向键只喂给那只带光圈的小幽灵，朵朵的清豆节奏不受影响", async () => {
    const { mountStage } = await import("./index");
    function run(keys: string[]): string {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: corridorCfg({ ghostCount: 1, lives: 5, maze: corridor({ dotsAt: [3, 4, 5], homeX: 5 }) }),
        starRole: "ghost",
        label: "追逃",
        onEnd: () => undefined,
      });
      for (let i = 0; i < 6; i++) {
        for (const k of keys) key(k);
        flushFrames(dom, 2, 60);
      }
      const out = dom.root.querySelector(".dmz-left")!.textContent;
      handle.destroy();
      return out;
    }
    const quiet = run([]);
    // 只按方向键：朵朵照自己的节奏走，剩余豆数跟对照局一模一样
    expect(run(["ArrowLeft"]), "方向键改动了朵朵的清豆节奏").toBe(quiet);
    // 换成 WASD 掉个头，朵朵的路线就变了
    expect(run(["a"]), "WASD 没能改动朵朵的走向").not.toBe(quiet);
  });

  it("Esc 暂停会冻住整局，虚拟方向键也推不动，再按一次继续", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: corridorCfg({ maze: corridor({ dotsAt: [2, 3, 4, 5], homeX: 5 }) }),
      starRole: "none",
      label: "走查",
      onEnd: () => undefined,
    });
    const left = (): string => dom.root.querySelector(".dmz-left")!.textContent;
    key("d");
    flushFrames(dom, 2, 130);
    key("Escape");
    flushFrames(dom, 1, 130);
    const frozen = left();
    expect(dom.root.querySelector(".dmz-note")!.textContent).toContain("已暂停");
    dom.root.querySelectorAll(".dmz-key[data-dir]").forEach((b) => b.dispatch("click"));
    flushFrames(dom, 12, 130);
    expect(left(), "暂停期间还在推进").toBe(frozen);
    key("Escape");
    flushFrames(dom, 6, 130);
    expect(left(), "解除暂停之后没接着走").not.toBe(frozen);
    handle.destroy();
  });

  it("【已知问题】规格里朵朵的 F / G 与星星的 L / K 都没接上", async () => {
    const { mountStage } = await import("./index");
    function run(keys: string[]): string {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: corridorCfg({ maze: corridor({ dotsAt: [2, 3, 4, 5], homeX: 5 }) }),
        starRole: "eater",
        label: "抢豆",
        onEnd: () => undefined,
      });
      for (let i = 0; i < 4; i++) {
        for (const k of keys) key(k);
        flushFrames(dom, 2, 130);
      }
      const out = dom.root.querySelector(".dmz-score")!.textContent;
      handle.destroy();
      return out;
    }
    // 应有行为：这四个键至少要有一个能落到某个动作上。现状：按不按结果一模一样。
    expect(run(["f", "g", "l", "k"]), "F / G / L / K 里居然有键生效了").toBe(run([]));
  });
});

/* ------------------------------------------------------------------ */
/* PA-DM · 铁则 4 / 5：热区与文案                                        */
/* ------------------------------------------------------------------ */

describe("PA-DM · 360px 热区与卡片文案", () => {
  it("虚拟方向键的热区达标：48px", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: corridorCfg(),
      starRole: "none",
      label: "走查",
      onEnd: () => undefined,
    });
    expect(hitHeight(css(), ".dmz-key")).toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("四个模式入口 .dmz-mode 的热区也够：47px", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi().api);
    expect(hitHeight(css(), ".dmz-mode")).toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("【已知问题】换个玩法用的 .dmz-btn 只有 33px 出头，够不到 44px", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi().api);
    byText("无尽迷宫")!.dispatch("click");
    expect(byText("换个玩法"), "退回菜单的按钮不见了").not.toBeNull();
    const h = hitHeight(css(), ".dmz-btn");
    // 应有行为：≥ 44。现状：padding 8px + 14px 字 ≈ 32.8px。
    expect(h).toBeLessThan(44);
    expect(h).toBeCloseTo(32.8, 1);
    handle.destroy();
  });

  it("360px 上四种玩法的入口都点得到，进去也不炸", async () => {
    const { mount } = await import("./index");
    const rec = fakeApi();
    const handle = mount(rec.api);
    const baseline = windowListenerCount(dom);
    for (const label of ["无尽迷宫", "抢豆对战", "双人追逃"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4, 120);
      const canvas = dom.root.querySelector(".dmz-canvas")!;
      expect(canvas.width, `${label} 的画布在 360px 上撑破了`).toBeLessThanOrEqual(360 - 20);
      byText("换个玩法")!.dispatch("click");
      expect(windowListenerCount(dom), `${label} 退出后监听没回到原位`).toBe(baseline);
    }
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("【已知问题】meta.blurb 把豆子叫「小星星」，界面上却一律叫「豆」", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi().api);
    // 读屏文字与菜单里的叫法：剩 N 颗「豆」、能量「豆」
    byText("无尽迷宫")!.dispatch("click");
    flushFrames(dom, 2, 120);
    expect(dom.root.querySelector(".dmz-canvas")!.getAttribute("aria-label")).toContain("颗豆");
    byText("换个玩法")!.dispatch("click");
    expect(dom.root.find((e) => e.className.includes("dmz-sub"))!.textContent).toContain("能量豆");
    // 而界面上的「小星星」是命数：⭐ 小星命
    byText("无尽迷宫")!.dispatch("click");
    flushFrames(dom, 2, 120);
    expect(dom.root.querySelector(".dmz-canvas")!.getAttribute("aria-label")).toContain("小星命");
    // 应有行为：blurb 也该说「吃光豆子」。
    // 现状：同一句话里既写「吃光小星星」又写「能量豆」，两种叫法混在一起。
    expect(meta.blurb, "blurb 已经不写「吃光小星星」了，这条可以翻面").toContain("吃光小星星");
    expect(meta.blurb).toContain("能量豆");
    handle.destroy();
  });

  it("meta 的模式、关数、平台与实现对得上", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi().api);
    const modes = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("dmz-mode"));
    expect(modes).toHaveLength(meta.modes.length);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    handle.destroy();
  });
});
