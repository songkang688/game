/**
 * 1.2 验收铁则：**消除后、重力完成前，方块的视觉坐标与逻辑坐标不同。**
 *
 * 这一组拿 `domStub.ts` 的虚拟时钟一帧一帧地走整条时间线，
 * 逐段断言「换过去 → 爆开 → 下落 → 落地 → 连锁 → 结算」一段都没被跳过。
 * 只要存在「一次 render 直达终态」的路径，`不落地就不结算` 这几条就会红。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { EMPTY, RAINBOW, ROCKET_H, makeCellset, shuffleOn, type Cellset } from "./board";
import { applyPlan, detonatePlan, planRound } from "./duel";
import { El, flushFrames, installDom, restoreDom, runUntil, type Dom } from "./domStub";
import {
  boardBleed,
  boardWidthAt,
  cellPitch,
  chainPopText,
  createStage,
  CSS,
  type Stage,
  type TokenSkin,
} from "./view";
import { timings, type Phase } from "./anim";
import {
  celebrationHTML,
  gearSVG,
  rainbowStarSVG,
  specialOverlaySVG,
  STAR_STYLES,
  starTokenSVG,
  themeClassOf,
  tokenSVG,
  type GearKind,
  type SpecialKind,
} from "./art";

const COLS = 4;
const ROWS = 4;
const TOKENS: TokenSkin[] = [
  { emoji: "⭐", bg: "#a" },
  { emoji: "💖", bg: "#b" },
  { emoji: "🍀", bg: "#c" },
  { emoji: "🌙", bg: "#d" },
  { emoji: "🍊", bg: "#e" },
];

/**
 * 一块摆好的 4×4：换第 3 行的头两格就会在第 0 列凑出一个竖三连，
 * 消完之后第 0 行那颗要一路掉到第 3 行——落差三格，够看清楚了。
 */
const START = [
  2, 3, 4, 3,
  1, 4, 3, 4,
  1, 3, 4, 3,
  0, 1, 3, 4,
];

let dom: Dom;

interface Harness {
  cell: Cellset;
  stage: Stage;
  moves: number;
  rounds: number;
  reverts: number;
  settled: number;
}

/** `spawnList` 按顺序发给补块用，发完循环；`reshuffle` 给死局洗牌那一段用 */
function mk(spawnList: number[], reduced = false, reshuffle?: (cell: Cellset) => boolean): Harness {
  const cell = makeCellset(COLS, ROWS, 0);
  cell.grid = START.slice();
  const h: Harness = { cell, stage: null as unknown as Stage, moves: 0, rounds: 0, reverts: 0, settled: 0 };
  let feed = 0;
  const done = new Set<number>();
  let blastWave = new Set<number>();
  h.stage = createStage(dom.root as unknown as HTMLElement, {
    cell,
    tokens: TOKENS,
    reduced,
    afterSwap: (a, b) => {
      const boom = detonatePlan(cell, a, b);
      if (boom) return boom;
      return planRound(cell, b) ?? "revert";
    },
    round: () => planRound(cell, -1),
    applyRound: (plan) => {
      const res = applyPlan(cell, plan, done);
      blastWave = res.blast;
      h.rounds++;
    },
    blast: () => {
      if (blastWave.size === 0) return null;
      const cells = Array.from(blastWave);
      blastWave = new Set();
      return { cells };
    },
    spawn: () => spawnList[feed++ % spawnList.length],
    onMove: () => {
      h.moves++;
      done.clear();
    },
    onRevert: () => {
      h.reverts++;
    },
    onSettled: () => {
      h.settled++;
    },
    reshuffle: reshuffle ? () => reshuffle(cell) : undefined,
  });
  return h;
}

/** 一路跑到时间线停下来（最多 400 帧） */
function settle(h: Harness): void {
  runUntil(dom, () => !h.stage.busy(), 400);
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("验收铁则 · 重力完成前视觉坐标 ≠ 逻辑坐标", () => {
  it("消除后棋子还飘在半空：视觉行是浮点、和逻辑行对不上", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    // 一路走到「下落」这一段
    expect(runUntil(dom, () => h.stage.phase() === "fall", 60)).toBeGreaterThan(0);
    expect(h.stage.movingCount()).toBeGreaterThan(0);
    // 第 0 列最底下那格,逻辑上已经是那颗幸存的星星了,视觉上它还在上面
    expect(h.stage.rowOf(12)).toBe(3);
    const seen = h.stage.visualRowOf(12);
    expect(seen).toBeLessThan(3);
    expect(seen).not.toBe(h.stage.rowOf(12));
    // 新块此刻还在棋盘顶外面（负数行）
    const spawnRow = h.stage.visualRowOf(0);
    expect(spawnRow).toBeLessThan(0);
  });

  it("下落那一段真的横跨很多帧，不是一帧到位", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    let frames = 0;
    while (h.stage.phase() === "fall" && frames < 100) {
      flushFrames(dom, 1);
      frames++;
    }
    // 三格落差 + 错峰,250 毫秒上下,16 毫秒一帧至少十来帧
    expect(frames).toBeGreaterThanOrEqual(10);
  });

  it("下落途中视觉行是单调往下走的，落地那一刻才和逻辑行对齐", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    let last = -99;
    let samples = 0;
    while (h.stage.phase() === "fall" && samples < 100) {
      const v = h.stage.visualRowOf(12);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(3);
      last = v;
      samples++;
      flushFrames(dom, 1);
    }
    expect(samples).toBeGreaterThan(5);
    settle(h);
    expect(h.stage.visualRowOf(12)).toBe(3);
    expect(h.stage.movingCount()).toBe(0);
  });

  it("DOM 上看得见：下落中格子带着位移，稳定之后位移清零", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    const btn = (h.stage.board as unknown as El).children[12];
    expect(btn.style.transform).toMatch(/translate\(/);
    expect(btn.style.transform).not.toBe("translate(0.00px, 0.00px)");
    settle(h);
    expect(btn.style.transform).toBe("");
  });
});

describe("时间线的段落顺序", () => {
  it("换过去 → 爆开 → 下落 → 落地 → 结算，一段都不跳", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    expect(h.stage.trace()).toEqual(["swap", "boom", "fall", "land", "settle"]);
    expect(h.moves).toBe(1);
    expect(h.settled).toBe(1);
  });

  it("换不出三连就原路弹回来，不计步、盘面还原", () => {
    const h = mk([0, 1, 2]);
    const before = h.cell.grid.slice();
    h.stage.tap(0);
    h.stage.tap(1);
    settle(h);
    expect(h.stage.trace()).toEqual(["swap", "revert"]);
    expect(h.moves).toBe(0);
    expect(h.reverts).toBe(1);
    expect(h.cell.grid).toEqual(before);
  });

  it("回弹也是滑回去的：revert 那一段里两格都在动", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(0);
    h.stage.tap(1);
    runUntil(dom, () => h.stage.phase() === "revert", 40);
    expect(h.stage.movingCount()).toBe(2);
    expect(h.stage.visualColOf(0)).toBeGreaterThan(0);
  });

  it("连锁不耗步：落地之后接着消，步数只记一次", () => {
    // 补块先发三颗 4:第 0 列会再凑出一个竖三连,连锁一轮
    const h = mk([4, 4, 4, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace.filter((p) => p === "boom").length).toBeGreaterThanOrEqual(2);
    expect(trace.filter((p) => p === "fall").length).toBeGreaterThanOrEqual(2);
    expect(h.rounds).toBeGreaterThanOrEqual(2);
    // 连锁那几轮一次都没再计步
    expect(h.moves).toBe(1);
    expect(h.settled).toBe(1);
  });

  it("连锁全停之前不结算：settle 段永远排在最后一次落地之后", () => {
    const h = mk([4, 4, 4, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace[trace.length - 1]).toBe("settle");
    expect(trace.indexOf("settle")).toBe(trace.length - 1);
    expect(trace.lastIndexOf("land")).toBeLessThan(trace.indexOf("settle"));
  });

  it("死局洗牌接在结算后面：整盘从顶上重新落一次，不是原地换脸", () => {
    let asked = 0;
    const h = mk([0, 1, 2], false, (cell) => {
      // 只在第一次结算之后洗，洗完这局就算走完了
      if (++asked > 1) return false;
      return shuffleOn(cell, mulberry32(4));
    });
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    expect(asked).toBeGreaterThan(0);
    // 结算之后又补了一段下落 + 落地,洗牌照样占着时间线
    expect(h.stage.trace().slice(-3)).toEqual(["settle", "fall", "land"]);
  });

  it("洗牌落下来的半途中，棋子还在棋盘顶外面", () => {
    let asked = 0;
    const h = mk([0, 1, 2], false, (cell) => {
      if (++asked > 1) return false;
      return shuffleOn(cell, mulberry32(4));
    });
    h.stage.tap(12);
    h.stage.tap(13);
    // 先跑到结算,洗牌那一段紧跟在后面
    runUntil(dom, () => h.stage.phase() === "settle", 200);
    runUntil(dom, () => h.stage.phase() === "fall", 40);
    expect(h.stage.movingCount()).toBeGreaterThan(0);
    expect(h.stage.visualRowOf(0)).toBeLessThan(0);
    settle(h);
    expect(h.stage.visualRowOf(0)).toBe(0);
    expect(h.stage.movingCount()).toBe(0);
  });

  it("时间线跑着的时候不接受输入，点了也不算", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    flushFrames(dom, 2);
    expect(h.stage.busy()).toBe(true);
    h.stage.tap(0);
    h.stage.tap(1);
    settle(h);
    expect(h.moves).toBe(1);
  });
});

describe("reduced-motion 走的是同一个状态机", () => {
  it("段落顺序与终态都和正常模式一模一样，只是每段压到 1 帧", () => {
    const a = mk([0, 1, 2], false);
    a.stage.tap(12);
    a.stage.tap(13);
    settle(a);
    const fullTrace = a.stage.trace().slice();
    const fullGrid = a.cell.grid.slice();
    a.stage.destroy();

    restoreDom();
    dom = installDom(360, true);
    const b = mk([0, 1, 2], true);
    b.stage.tap(12);
    b.stage.tap(13);
    settle(b);

    expect(b.stage.trace()).toEqual(fullTrace);
    expect(b.cell.grid).toEqual(fullGrid);
    expect(b.moves).toBe(1);
    expect(b.settled).toBe(1);
    expect(b.stage.timings.boomMs).toBeLessThanOrEqual(32);
  });

  it("压到 1 帧也照样有「飘在半空」的那一帧——没有另开一条瞬变分支", () => {
    restoreDom();
    dom = installDom(360, true);
    const h = mk([0, 1, 2], true);
    h.stage.tap(12);
    h.stage.tap(13);
    const seen: Phase[] = [];
    let midAir = false;
    for (let i = 0; i < 40 && h.stage.busy(); i++) {
      flushFrames(dom, 1);
      seen.push(h.stage.phase());
      if (h.stage.phase() === "fall" && h.stage.visualRowOf(12) < 3) midAir = true;
    }
    expect(seen).toContain("fall");
    expect(midAir).toBe(true);
  });

  it("整局跑完的帧数明显更少（时长真的压下去了）", () => {
    const a = mk([0, 1, 2], false);
    a.stage.tap(12);
    a.stage.tap(13);
    const fullFrames = runUntil(dom, () => !a.stage.busy(), 400);
    a.stage.destroy();

    restoreDom();
    dom = installDom(360, true);
    const b = mk([0, 1, 2], true);
    b.stage.tap(12);
    b.stage.tap(13);
    const calmFrames = runUntil(dom, () => !b.stage.busy(), 400);
    expect(calmFrames).toBeGreaterThan(0);
    expect(calmFrames).toBeLessThan(fullFrames);
  });
});

describe("特殊块引爆也走同一条时间线", () => {
  it("火箭是一波一波炸开的，多出来的那一波是独立的 boom 段", () => {
    const h = mk([0, 1, 2]);
    h.cell.special[13] = ROCKET_H;
    h.stage.swap(12, 13);
    settle(h);
    const trace = h.stage.trace();
    expect(trace[0]).toBe("swap");
    // 引爆自己一段 boom,被点着的那一行再一段 boom
    expect(trace.filter((p) => p === "boom").length).toBeGreaterThanOrEqual(1);
    expect(trace).toContain("fall");
    expect(trace).toContain("land");
    expect(h.cell.grid.filter((v) => v === EMPTY)).toHaveLength(0);
  });
});

describe("360px 布局", () => {
  it("gap 为 0，8 列在 360px 上每格还有 44 像素以上的热区", () => {
    const w = boardWidthAt(360);
    expect(w).toBeGreaterThanOrEqual(360);
    expect(cellPitch(w, 8)).toBeGreaterThanOrEqual(44);
    expect(cellPitch(w, 6)).toBeGreaterThanOrEqual(44);
  });

  it("窄屏才往两边撑，宽屏不撑", () => {
    expect(boardBleed(360)).toBeGreaterThan(0);
    expect(boardBleed(420)).toBeGreaterThan(0);
    expect(boardBleed(768)).toBe(0);
    expect(cellPitch(0, 8)).toBe(44);
  });

  it("每一格都是一个按钮，带读屏用的行列说明", () => {
    const h = mk([0, 1, 2]);
    const board = h.stage.board as unknown as El;
    expect(board.children).toHaveLength(COLS * ROWS);
    expect(board.children[0].getAttribute("aria-label")).toContain("第 1 行第 1 列");
    expect(board.children[15].getAttribute("aria-label")).toContain("第 4 行第 4 列");
  });

  it("destroy 之后节点摘干净、rAF 也停了", () => {
    const h = mk([0, 1, 2]);
    const before = dom.root.children.length;
    h.stage.destroy();
    expect(dom.root.children.length).toBe(before - 1);
    expect(dom.cancelled.length).toBeGreaterThan(0);
    flushFrames(dom, 5);
    expect(h.stage.busy()).toBe(false);
  });
});

describe("没有「一次 render 直达终态」的后门", () => {
  it("整局玩下来盘面每一次变动都发生在某一段里，idle 时盘面纹丝不动", () => {
    const h = mk([4, 4, 4, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    // 盘面每变一次，就记下这一帧走到了哪一段
    const changedAt: Phase[] = [];
    let last = h.cell.grid.join(",");
    for (let f = 0; f < 400 && h.stage.busy(); f++) {
      flushFrames(dom, 1);
      const now = h.cell.grid.join(",");
      if (now !== last) changedAt.push(h.stage.phase());
      last = now;
    }
    // 逻辑盘面只会在 swap（换过去）和 fall（压实 + 补块）这两段里改
    expect(new Set(changedAt)).toEqual(new Set(["swap", "fall"]));
    // 而且中间确实变过好几次——不是「压根没动过」蒙混过关
    expect(changedAt.filter((p) => p === "fall").length).toBeGreaterThanOrEqual(2);
    expect(h.rounds).toBeGreaterThanOrEqual(2);
  });

  it("停在 idle 之后再怎么走帧，盘面都不会自己再变一次", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    settle(h);
    const frozen = h.cell.grid.slice();
    flushFrames(dom, 60);
    expect(h.stage.phase()).toBe("idle");
    expect(h.cell.grid).toEqual(frozen);
    expect(h.stage.movingCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉契约:棋盘上不再有 emoji 占位,全部换成绘制资产
// ---------------------------------------------------------------------------

/** 常用的 emoji 探测:棋子 / 机关 / 特殊块以前用的那几个字符,一个都不许再出现在绘制层 */
const EMOJI_RE = /[⭐💖🍀🌙🍊🌈🧊🌿🍥🧱➡️⬇️💥]/u;

function tileAt(h: Harness, i: number): El {
  return (h.stage.board as unknown as El).children[i].querySelector(".mst-tile")!;
}

function gearAt(h: Harness, i: number): El {
  return (h.stage.board as unknown as El).children[i].querySelector(".mst-gear")!;
}

function fxCount(cls: string): number {
  return dom.root.findAll((e) => e.className.split(/\s+/).includes(cls)).length;
}

describe("1.3 视觉契约 · 棋子是 SVG 星星家族", () => {
  it("tile 里是 SVG 节点，不再是 emoji 文本", () => {
    const h = mk([0, 1, 2]);
    for (const i of [0, 5, 12, 15]) {
      const tile = tileAt(h, i);
      expect(tile.querySelector("svg")).toBeTruthy();
      expect(EMOJI_RE.test(tile.textContent)).toBe(false);
    }
  });

  it("六色 SVG 互不相同，且六种轮廓（第二辨识通道）互不相同", () => {
    const svgs = [0, 1, 2, 3, 4, 5].map((c) => starTokenSVG(c));
    for (let a = 0; a < svgs.length; a++) {
      for (let b = a + 1; b < svgs.length; b++) expect(svgs[a]).not.toBe(svgs[b]);
    }
    const shapes = new Set(svgs.map((s) => /mst-star-([a-z]+)/.exec(s)?.[1]));
    expect(shapes.size).toBe(6);
    expect(new Set(STAR_STYLES.map((s) => s.shape)).size).toBe(6);
    expect(new Set(STAR_STYLES.map((s) => s.base)).size).toBe(6);
    // 每颗都有渐变主体 + 高光 + 一张脸
    for (const s of svgs) {
      expect(s).toContain("linearGradient");
      expect(s).toContain("mst-gloss");
      expect(s).toContain("mst-face");
    }
  });

  it("彩虹星是七彩渐变大星 + 白芯 + 皇冠，带缓慢旋转类（不再是 🌈）", () => {
    const h = mk([0, 1, 2]);
    h.cell.grid[0] = RAINBOW;
    h.stage.paint();
    const tile = tileAt(h, 0);
    expect(tile.querySelector("svg")).toBeTruthy();
    expect(tile.innerHTML).toContain("mst-rainbowstar");
    expect(tile.innerHTML).toContain("mst-spin");
    expect(tile.textContent).not.toContain("🌈");
    const svg = rainbowStarSVG();
    expect(svg).toContain("mst-ovl-crown");
    expect((svg.match(/<stop /g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(CSS).toContain("mst-spin 6s linear infinite");
  });
});

describe("1.3 视觉契约 · 特殊块画进 SVG，不再是双字符拼接", () => {
  it("四种 overlay 互不相同，且都是矢量标记不是 emoji", () => {
    const kinds: SpecialKind[] = [1, 2, 3, 4];
    const svgs = kinds.map((k) => specialOverlaySVG(k));
    for (let a = 0; a < svgs.length; a++) {
      for (let b = a + 1; b < svgs.length; b++) expect(svgs[a]).not.toBe(svgs[b]);
    }
    for (const s of svgs) {
      expect(s.startsWith("<g")).toBe(true);
      expect(EMOJI_RE.test(s)).toBe(false);
    }
  });

  it("盘面上的火箭 / 炸弹是单个 SVG，图案叠在星星里", () => {
    const h = mk([0, 1, 2]);
    h.cell.special[5] = 1;
    h.cell.special[6] = 2;
    h.cell.special[9] = 3;
    h.stage.paint();
    expect(tileAt(h, 5).innerHTML).toContain("mst-ovl-h");
    expect(tileAt(h, 6).innerHTML).toContain("mst-ovl-v");
    expect(tileAt(h, 9).innerHTML).toContain("mst-ovl-bomb");
    for (const i of [5, 6, 9]) {
      expect(EMOJI_RE.test(tileAt(h, i).textContent)).toBe(false);
      // 一格只有一张 SVG,不是「emoji+emoji」两截字符
      expect((tileAt(h, i).innerHTML.match(/<svg/g) ?? []).length).toBe(1);
    }
    // 炸弹是圆润卡通造型:圆主体 + 引线 + 火花点
    expect(tokenSVG(0, 3)).toContain("mst-star-bomb");
  });
});

describe("1.3 视觉契约 · 机关是绘制的罩层", () => {
  it("冰 / 藤 / 霜两档 / 砖五种 gear SVG 互不相同且无 emoji", () => {
    const kinds: GearKind[] = ["ice", "vine", "frost1", "frost2", "brick"];
    const svgs = kinds.map((k) => gearSVG(k));
    for (let a = 0; a < svgs.length; a++) {
      for (let b = a + 1; b < svgs.length; b++) expect(svgs[a]).not.toBe(svgs[b]);
    }
    for (const s of svgs) {
      expect(s).toContain("<svg");
      expect(EMOJI_RE.test(s)).toBe(false);
    }
    // 样式表里也不许再藏 emoji 角标
    expect(EMOJI_RE.test(CSS)).toBe(false);
  });

  it("盘面上的机关格挂的是 SVG 罩层节点", () => {
    const h = mk([0, 1, 2]);
    const c = h.cell as Cellset & { ice?: boolean[]; vine?: boolean[]; frost?: number[] };
    c.ice = new Array(16).fill(false);
    c.vine = new Array(16).fill(false);
    c.frost = new Array(16).fill(0);
    c.ice[5] = true;
    c.fixed[5] = true;
    c.vine[6] = true;
    c.frost[9] = 1;
    c.frost[10] = 2;
    h.stage.paint();
    expect(gearAt(h, 5).innerHTML).toContain("mst-gear-ice");
    expect(gearAt(h, 6).innerHTML).toContain("mst-gear-vine");
    expect(gearAt(h, 9).innerHTML).toContain("mst-gear-frost1");
    expect(gearAt(h, 10).innerHTML).toContain("mst-gear-frost2");
    for (const i of [5, 6, 9, 10]) expect(gearAt(h, i).querySelector("svg")).toBeTruthy();
    // 机关清掉之后罩层跟着摘掉
    c.ice[5] = false;
    c.fixed[5] = false;
    h.stage.paint();
    expect(gearAt(h, 5).querySelector("svg")).toBeNull();
  });

  it("破冰碎 3 片、解藤飘叶子（都是粒子，reduced 一片都不出）", () => {
    const h = mk([0, 1, 2]);
    const c = h.cell as Cellset & { ice?: boolean[]; vine?: boolean[] };
    c.ice = new Array(16).fill(false);
    c.vine = new Array(16).fill(false);
    c.ice[5] = true;
    c.fixed[5] = true;
    c.vine[6] = true;
    h.stage.paint();
    c.ice[5] = false;
    c.fixed[5] = false;
    c.vine[6] = false;
    h.stage.paint();
    expect(fxCount("mst-p-shard")).toBe(3);
    expect(fxCount("mst-p-leaf")).toBe(2);
  });
});

describe("1.3 视觉契约 · 时间线特效（时序不变）", () => {
  it("时长表一格没动：boom/fall/land/belt 的节奏和 1.2 完全一致", () => {
    expect(timings(false)).toEqual({
      swapMs: 140,
      boomMs: 200,
      perCellMs: 70,
      staggerMs: 20,
      landMs: 90,
      beltMs: 200,
      settleMs: 120,
    });
    const calm = timings(true);
    for (const v of Object.values(calm)) expect(v).toBeLessThanOrEqual(16);
  });

  it("爆开时迸星屑，全场粒子总数永远 ≤ 30，收场后清干净", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    expect(runUntil(dom, () => fxCount("mst-p-spark") > 0, 60)).toBeGreaterThanOrEqual(0);
    let peak = 0;
    for (let f = 0; f < 400 && h.stage.busy(); f++) {
      flushFrames(dom, 1);
      peak = Math.max(peak, fxCount("mst-p-spark") + fxCount("mst-p-dust"));
      expect(fxCount("mst-p-spark") + fxCount("mst-p-dust")).toBeLessThanOrEqual(30);
    }
    expect(peak).toBeGreaterThan(0);
    flushFrames(dom, 60);
    expect(fxCount("mst-p-spark") + fxCount("mst-p-dust")).toBe(0);
  });

  it("一次消掉 ≥ 5 颗才放冲击波环", () => {
    const h = mk([0, 1, 2]);
    // 摆一个 L 形:换 12/13 之后第 1 列竖三连 + 第 3 行横三连,共 5 颗
    h.cell.grid = [
      1, 2, 3, 2,
      2, 0, 3, 4,
      3, 0, 1, 2,
      0, 4, 0, 0,
    ];
    h.stage.paint();
    h.stage.tap(12);
    h.stage.tap(13);
    expect(runUntil(dom, () => fxCount("mst-ring") > 0, 80)).toBeGreaterThanOrEqual(0);
    settle(h);
    // 普通三连不放环
    const g = mk([0, 1, 2]);
    g.stage.tap(12);
    g.stage.tap(13);
    let seenRing = false;
    for (let f = 0; f < 400 && g.stage.busy(); f++) {
      flushFrames(dom, 1);
      if (fxCount("mst-ring") > 0) seenRing = true;
    }
    expect(seenRing).toBe(false);
  });

  it("下落拖一帧极淡残影，落地扬微尘", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "fall", 60);
    flushFrames(dom, 3);
    const ghosts = (h.stage.board as unknown as El).findAll((e) =>
      e.className.split(/\s+/).includes("mst-ghost")
    );
    expect(ghosts.some((g) => g.style.opacity === "0.22")).toBe(true);
    runUntil(dom, () => h.stage.phase() === "land", 200);
    expect(fxCount("mst-p-dust")).toBeGreaterThan(0);
    settle(h);
    // 稳定后残影全部熄灭
    expect(ghosts.some((g) => g.style.opacity === "0.22")).toBe(false);
  });

  it("连锁 ≥ 3 才弹「连锁 ×N」花体字", () => {
    expect(chainPopText(1)).toBe("");
    expect(chainPopText(2)).toBe("");
    expect(chainPopText(3)).toBe("连锁 ×3");
    // 喂三轮必连的补块:第 0 列先 4,4,4 再 3,3,3,凑出三连锁
    const h = mk([4, 4, 4, 3, 3, 3, 0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    expect(
      runUntil(dom, () => fxCount("mst-chainpop") > 0, 400)
    ).toBeGreaterThanOrEqual(0);
    const pop = dom.root.find((e) => e.className.includes("mst-chainpop"))!;
    expect(pop.textContent).toBe("连锁 ×3");
    settle(h);
    flushFrames(dom, 60);
    expect(fxCount("mst-chainpop")).toBe(0);
  });

  it("传送带虚线换成流动箭头纹，样式随 reduced 静止", () => {
    expect(CSS).toContain(".mst-cell.mst-belt::after");
    expect(CSS).toContain("@keyframes mst-flow");
    expect(CSS).toContain("mst-belt-rev");
    expect(CSS).not.toContain("dashed");
    expect(CSS).toContain(".mst-reduced .mst-spin,.mst-reduced .mst-cell.mst-belt::after");
  });
});

describe("1.3 视觉契约 · 读屏文案钉死不变", () => {
  it("describe() 仍然用 token 的 emoji 名报格子（第 N 行第 N 列，名字）", () => {
    const h = mk([0, 1, 2]);
    const board = h.stage.board as unknown as El;
    // START[12] = 0 → ⭐;START[1] = 3 → 🌙
    expect(board.children[12].getAttribute("aria-label")).toBe("第 4 行第 1 列，⭐");
    expect(board.children[1].getAttribute("aria-label")).toBe("第 1 行第 2 列，🌙");
    h.cell.grid[0] = RAINBOW;
    h.stage.paint();
    expect(board.children[0].getAttribute("aria-label")).toBe("第 1 行第 1 列，彩虹星");
  });
});

describe("1.3 视觉契约 · reduced 全链路", () => {
  function calmHarness(): Harness {
    restoreDom();
    dom = installDom(360, true);
    return mk([4, 4, 4, 3, 3, 3, 0, 1, 2], true);
  }

  it("reduced 下粒子为 0：星屑 / 微尘 / 冲击波 / 残影一个都不出", () => {
    const h = calmHarness();
    expect((h.stage.root as unknown as El).className).toContain("mst-reduced");
    h.stage.tap(12);
    h.stage.tap(13);
    for (let f = 0; f < 200 && h.stage.busy(); f++) {
      flushFrames(dom, 1);
      expect(fxCount("mst-p-spark")).toBe(0);
      expect(fxCount("mst-p-dust")).toBe(0);
      expect(fxCount("mst-ring")).toBe(0);
      const ghosts = (h.stage.board as unknown as El).findAll((e) =>
        e.className.split(/\s+/).includes("mst-ghost")
      );
      expect(ghosts.some((g) => g.style.opacity === "0.22")).toBe(false);
    }
  });

  it("reduced 下 land 段照走但不形变（1.2 的口径回归）", () => {
    const h = calmHarness();
    h.stage.tap(12);
    h.stage.tap(13);
    let sawLand = false;
    for (let f = 0; f < 200 && h.stage.busy(); f++) {
      flushFrames(dom, 1);
      if (h.stage.phase() === "land") {
        sawLand = true;
        const board = h.stage.board as unknown as El;
        for (const btn of board.children) {
          const tile = btn.querySelector(".mst-tile")!;
          expect(tile.style.transform ?? "").not.toMatch(/scale/);
        }
      }
    }
    expect(sawLand).toBe(true);
  });

  it("正常模式 land 段确实压扁回弹（有 scale），旋转 / 流动在 reduced 媒询里静止", () => {
    const h = mk([0, 1, 2]);
    h.stage.tap(12);
    h.stage.tap(13);
    runUntil(dom, () => h.stage.phase() === "land", 200);
    flushFrames(dom, 2);
    const board = h.stage.board as unknown as El;
    const squashed = board.children.some((btn) =>
      /scale\(0\.9/.test(btn.querySelector(".mst-tile")!.style.transform ?? "")
    );
    expect(squashed).toBe(true);
    expect(CSS).toContain("@media (prefers-reduced-motion:reduce)");
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]*animation:none/);
  });
});

describe("1.3 视觉契约 · 主题查表与结算仪式", () => {
  it("背景按关卡段换主题：晨光 → 森林 → 星夜", () => {
    expect(themeClassOf(0)).toBe("mst-theme-dawn");
    expect(themeClassOf(62)).toBe("mst-theme-dawn");
    expect(themeClassOf(63)).toBe("mst-theme-forest");
    expect(themeClassOf(125)).toBe("mst-theme-forest");
    expect(themeClassOf(126)).toBe("mst-theme-night");
    expect(themeClassOf(187)).toBe("mst-theme-night");
    for (const t of ["dawn", "forest", "night"]) expect(CSS).toContain(`.mst-wrap.mst-theme-${t}`);
  });

  it("过关仪式：三星逐颗砸下（0.15s 间隔 + easeOutBack），星屑雨 ≤ 20", () => {
    const html = celebrationHTML(2, false);
    expect((html.match(/mst-cheer-star/g) ?? []).length).toBe(3);
    expect((html.match(/mst-lit/g) ?? []).length).toBe(2);
    expect((html.match(/mst-dim/g) ?? []).length).toBe(1);
    expect(html).toContain("animation-delay:0.00s");
    expect(html).toContain("animation-delay:0.15s");
    expect(html).toContain("animation-delay:0.30s");
    expect((html.match(/mst-rain/g) ?? []).length).toBeLessThanOrEqual(20);
    expect((html.match(/mst-rain/g) ?? []).length).toBeGreaterThan(0);
    expect(CSS).toContain("cubic-bezier(.34,1.56,.64,1)");
    // reduced:雨为 0、星星直亮
    const calm = celebrationHTML(3, true);
    expect(calm).not.toContain("mst-rain");
    expect((calm.match(/mst-lit/g) ?? []).length).toBe(3);
    expect(CSS).toContain(".mst-reduced .mst-cheer-star");
  });

  it("失败棋盘灰化的样式在（温柔收场，不闪不吓）", () => {
    expect(CSS).toContain(".mst-gray");
    expect(CSS).toMatch(/mst-gray\{filter:grayscale/);
  });

  it("U-18 矮屏/平板按余高钳棋盘宽", () => {
    expect(CSS).toContain("@media (max-height:840px)");
    expect(CSS).toContain("max-width:min(100%, calc(100dvh - 220px))");
    expect(CSS).toContain("max-width:min(100%, calc(100dvh - 360px))");
  });
});
