/**
 * 豆豆迷宫 · 前端接线回归。
 *
 * 规格第十三节点名要测「`destroy` 干净」，第七节要求四种模式都能玩。
 * 测试环境是 node，所以用自带的 `domStub.ts`：它把 window 监听、rAF、DOM 节点都数得出来，
 * 「拆干净了」这句话才有断言撑着。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import {
  WALL_THEMES,
  dotSprite,
  drawGhostFigure,
  drawPlayerFigure,
  drawWalls,
  fruitSprite,
  powerSprite,
  versusStarSprite,
  wallThemeIndex,
  type GhostFigureMood,
  type PlayerFigureOpts,
} from "./art";
import {
  El,
  clearCtxLog,
  ctx2d,
  ctxLog,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type CtxOp,
  type Dom,
} from "./domStub";
import { GHOST_NAMES } from "./ghosts";
import { configFor } from "./levels";
import { PAD_HIT_PX } from "./layout";
import type { RunConfig } from "./logic";
import type { Maze } from "./maze";
import { meta } from "./meta";

let dom: Dom;

interface Recorder {
  api: GameApi;
  sounds: string[];
  wins: number;
  loses: number;
}

function fakeApi(root: El): Recorder {
  const rec: Recorder = { api: null as unknown as GameApi, sounds: [], wins: 0, loses: 0 };
  rec.api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => rec.sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {
      rec.wins += 1;
    },
    onLose: () => {
      rec.loses += 1;
    },
  } as unknown as GameApi;
  return rec;
}

/** 找到写着这段字的那个按钮（`find` 是先序，直接用会捞到最外层的容器） */
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

function key(k: string): void {
  fireWindow(dom, "keydown", { key: k });
}

beforeEach(() => {
  dom = installDom(420);
});

afterEach(() => {
  restoreDom();
});

/* ------------------------------------------------------------------ */
/* 一、模块契约                                                        */
/* ------------------------------------------------------------------ */

describe("index 契约", () => {
  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("四种模式都写在 meta 里，手游端游都能玩", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.platform).toBe("both");
    expect(meta.levels).toBe(188);
  });
});

describe("变蓝过渡", () => {
  it("两端各给原色和昏昏蓝，中间是插值", async () => {
    const { mixColor } = await import("./index");
    expect(mixColor("#FF9AB0", "#7FA9FF", 0)).toBe("#ff9ab0");
    expect(mixColor("#FF9AB0", "#7FA9FF", 1)).toBe("#7fa9ff");
    expect(mixColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("越界的比例会被夹回 0–1，不会算出非法颜色", async () => {
    const { mixColor } = await import("./index");
    expect(mixColor("#000000", "#FFFFFF", -3)).toBe("#000000");
    expect(mixColor("#000000", "#FFFFFF", 9)).toBe("#ffffff");
    expect(mixColor("#123456", "#654321", 0.37)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

/* ------------------------------------------------------------------ */
/* 二、菜单与四种模式                                                  */
/* ------------------------------------------------------------------ */

describe("模式菜单", () => {
  it("挂上去有四个模式入口，四只小幽灵的名字都写在介绍里", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const modes = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("dmz-mode"));
    expect(modes.map((b) => b.textContent)).toHaveLength(4);
    expect(modes.some((b) => b.textContent.includes("闯关 188"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("无尽"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("抢豆对战"))).toBe(true);
    expect(modes.some((b) => b.textContent.includes("双人追逃"))).toBe(true);
    const blurb = dom.root.find((e) => e.className.includes("dmz-sub"))!.textContent;
    for (const name of Object.values(GHOST_NAMES)) {
      expect(blurb, `介绍里没提到${name}`).toContain(name);
    }
    handle.destroy();
  });

  it("destroy 之后 window 监听、rAF、DOM 节点一样不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const handle = mount(fakeApi(dom.root).api);
    byText("无尽迷宫")!.dispatch("click");
    flushFrames(dom, 5);
    expect(windowListenerCount(dom)).toBeGreaterThan(before);
    const framesBefore = dom.cancelled.length;
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.cancelled.length).toBeGreaterThan(framesBefore);
    expect(dom.root.children).toHaveLength(0);
    // destroy 之后再走帧也不会又把自己排进下一帧
    const left = dom.frames.length;
    flushFrames(dom, left + 2);
    expect(dom.frames).toHaveLength(0);
  });

  it("四种模式来回切，监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    const baseline = windowListenerCount(dom);
    for (const label of ["无尽迷宫", "抢豆对战", "双人追逃", "无尽迷宫"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      expect(windowListenerCount(dom)).toBe(baseline + 1);
      byText("换个玩法")!.dispatch("click");
      expect(windowListenerCount(dom)).toBe(baseline);
    }
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(baseline - 0);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("闯关走的是平台的 188 关框架", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root).api);
    byText("闯关 188")!.dispatch("click");
    expect(dom.root.find((e) => e.className.includes("l99-map"))).not.toBeNull();
    handle.destroy();
    expect(dom.root.children).toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 三、一局迷宫的输入与拆卸                                            */
/* ------------------------------------------------------------------ */

describe("迷宫舞台", () => {
  it("HUD、画布和虚拟方向键都挂出来了，热区够手指点", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: configFor(0),
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    expect(dom.root.querySelector(".dmz-canvas")).not.toBeNull();
    expect(dom.root.querySelector(".dmz-score")).not.toBeNull();
    const pad = dom.root.querySelectorAll(".dmz-key[data-dir]");
    expect(pad.map((b) => b.dataset.dir).sort()).toEqual(["down", "left", "right", "up"]);
    expect(PAD_HIT_PX).toBeGreaterThanOrEqual(44);
    handle.destroy();
  });

  it("画布带读屏文字与列数，暂停也会写进去", async () => {
    const { mountStage } = await import("./index");
    const cfg = { ...configFor(0), ghostCount: 0 };
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg,
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    expect(canvas.getAttribute("data-cols")).toBe(String(cfg.maze.w));
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/朵朵\d+分，小星命\d+，剩\d+颗豆$/);
    key("Escape");
    flushFrames(dom, 1, 60);
    expect(canvas.getAttribute("aria-label")).toContain("已暂停");
    handle.destroy();
  });

  it("画布分辨率按屏宽算，窄屏上格子不会小于 14px", async () => {
    restoreDom();
    dom = installDom(360);
    const { mountStage } = await import("./index");
    const cfg = configFor(187);
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg,
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    expect(canvas.width / cfg.maze.w).toBeGreaterThanOrEqual(14);
    expect(canvas.style.maxWidth).toMatch(/^\d+px$/);
    handle.destroy();
  });

  it("WASD 归朵朵，走一段之后豆子真的少了，也响了吃豆的音", async () => {
    const { mountStage } = await import("./index");
    const sounds: string[] = [];
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      play: (n) => sounds.push(n),
      onEnd: () => undefined,
    });
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    const before = left();
    for (let i = 0; i < 12; i++) {
      key(i % 2 === 0 ? "d" : "w");
      flushFrames(dom, 6, 60);
    }
    expect(left()).not.toBe(before);
    expect(sounds).toContain("coin");
    handle.destroy();
  });

  it("Esc 暂停会停下推进，再按一次继续", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const note = () => dom.root.querySelector(".dmz-note")!.textContent;
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    key("d");
    flushFrames(dom, 4, 60);
    key("Escape");
    flushFrames(dom, 1, 60);
    expect(note()).toContain("已暂停");
    const frozen = left();
    flushFrames(dom, 10, 60);
    expect(left()).toBe(frozen);
    key("Escape");
    flushFrames(dom, 8, 60);
    expect(left()).not.toBe(frozen);
    handle.destroy();
  });

  it("虚拟方向键和滑动都能给朵朵转向", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(0), ghostCount: 0 },
      starRole: "none",
      label: "测试",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    const left = () => dom.root.querySelector(".dmz-left")!.textContent;
    const before = left();
    dom.root.querySelectorAll(".dmz-key[data-dir]").find((b) => b.dataset.dir === "up")!.dispatch("click");
    flushFrames(dom, 6, 60);
    canvas.dispatch("touchstart", { touches: [{ clientX: 10, clientY: 10 }] });
    canvas.dispatch("touchend", { changedTouches: [{ clientX: 80, clientY: 14 }] });
    flushFrames(dom, 6, 60);
    expect(left()).not.toBe(before);
    handle.destroy();
  });

  it("抢豆对战里方向键归星星，两个人各吃各的", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(60), ghostCount: 0 },
      starRole: "eater",
      label: "抢豆",
      onEnd: () => undefined,
    });
    const score = () => dom.root.querySelector(".dmz-score")!.textContent;
    expect(score()).toContain("星星");
    for (let i = 0; i < 12; i++) {
      key(i % 2 === 0 ? "ArrowLeft" : "ArrowDown");
      key(i % 2 === 0 ? "d" : "s");
      flushFrames(dom, 6, 60);
    }
    const [, duo, star] = /朵朵 (\d+) · 星星 (\d+)/.exec(score()) ?? [];
    expect(Number(duo)).toBeGreaterThan(0);
    expect(Number(star)).toBeGreaterThan(0);
    handle.destroy();
  });

  it("双人追逃里方向键接到操纵小幽灵那条线上，不是当成朵朵的转向", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: { ...configFor(150), ghostCount: 4 },
      starRole: "ghost",
      label: "追逃",
      onEnd: () => undefined,
    });
    // 只按方向键也不会崩：它走的是操纵小幽灵那条线（方向真的生效在 logic.test.ts 里精确断言）
    for (let i = 0; i < 8; i++) {
      key("ArrowRight");
      flushFrames(dom, 3, 60);
    }
    expect(dom.root.querySelector(".dmz-canvas")).not.toBeNull();
    handle.destroy();
    expect(dom.root.children).toHaveLength(0);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("同一局反复挂载再拆掉，window 上不会留下任何监听", async () => {
    const { mountStage } = await import("./index");
    for (let i = 0; i < 3; i++) {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: { ...configFor(30), ghostCount: 2 },
        starRole: "none",
        label: "测试",
        onEnd: () => undefined,
      });
      flushFrames(dom, 5, 60);
      handle.destroy();
      expect(windowListenerCount(dom)).toBe(0);
      expect(dom.root.children).toHaveLength(0);
    }
  });
});

/**
 * R3-PA-DM-1：第一次玩无尽，本轮分数就是历史最好，收场话却还在催人去刷新它，
 * 也没有一句「新纪录」。这里钉死两种措辞各走各的路。
 */
describe("无尽收场的措辞", () => {
  it("破了纪录就说新纪录，不再劝你去刷新一个刚创下的成绩", async () => {
    const { endlessLine } = await import("./index");
    const first = endlessLine(30, 0, 30);
    expect(first).toContain("30");
    expect(first).toContain("新纪录");
    expect(first).not.toContain("刷新它");
  });

  it("没破纪录才报历史最好，并鼓励再来一次", async () => {
    const { endlessLine } = await import("./index");
    const line = endlessLine(18, 30, 30);
    expect(line).toContain("18");
    expect(line).toContain("历史最好 30 分");
    expect(line).toContain("刷新它");
    expect(line).not.toContain("新纪录");
  });

  it("打平旧纪录不算破：还是报历史最好", async () => {
    const { endlessLine } = await import("./index");
    expect(endlessLine(30, 30, 30)).toContain("历史最好");
  });

  it("两种措辞都只鼓励，不批评", async () => {
    const { endlessLine } = await import("./index");
    for (const line of [endlessLine(30, 0, 30), endlessLine(5, 40, 40)]) {
      expect(line).not.toMatch(/笨|差劲|失败|你不行|死/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 五、1.3 视觉契约                                                    */
/* ------------------------------------------------------------------ */

/**
 * 1.3 视觉升级的素材契约：豆子 / 能量豆 / 果子必须走预渲染贴图的
 * drawImage 路径，玩家要有眼睛，幽灵三态画法互不相同，墙面连通，
 * 新增光效全部尊重减弱动效。断言全靠 domStub 的绘制流水（ctxLog）。
 */
describe("1.3 视觉契约", () => {
  /** 一条 9×3 的走廊迷宫：第 1 行通路，dots / power 指定放哪几格 */
  function corridor(opts: { dots?: number[]; power?: number[] } = {}): Maze {
    const w = 9;
    const h = 3;
    const wall: boolean[] = [];
    const dot: boolean[] = [];
    const power: boolean[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isWall = y !== 1 || x === 0 || x === w - 1;
        wall.push(isWall);
        dot.push(!isWall && (opts.dots ?? []).includes(x));
        power.push(!isWall && (opts.power ?? []).includes(x));
      }
    }
    return { w, h, wall, dot, power, tunnelRows: [], spawn: { x: 1, y: 1 }, home: { x: w - 2, y: 1 } };
  }

  function cfg(over: Partial<RunConfig> = {}): RunConfig {
    return {
      maze: corridor({ dots: [3, 5, 6] }),
      tier: "rookie",
      ghostCount: 0,
      lives: 3,
      stepMs: 120,
      fruitAt: [],
      fog: false,
      ...over,
    };
  }

  /** 挂一局、清掉流水、走一帧，返回这一帧画了什么 */
  async function frameOps(over: Partial<RunConfig> = {}, extra: { starRole?: "none" | "eater" } = {}): Promise<{
    ops: CtxOp[];
    canvas: El;
    destroy: () => void;
  }> {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: cfg(over),
      starRole: extra.starRole ?? "none",
      label: "视觉",
      onEnd: () => undefined,
    });
    const canvas = dom.root.querySelector(".dmz-canvas")!;
    clearCtxLog();
    flushFrames(dom, 1, 50);
    return { ops: [...ctxLog], canvas, destroy: () => handle.destroy() };
  }

  it("一帧 draw() 绘制非空", async () => {
    const { ops, destroy } = await frameOps();
    expect(ops.length).toBeGreaterThan(0);
    destroy();
  });

  it("豆子不是纯色圆：走的是 dotSprite 的 drawImage 路径，360px 下贴图也不小于 6px", async () => {
    restoreDom();
    dom = installDom(360);
    const { ops, destroy } = await frameOps();
    const dots = ops.filter((o) => o.op === "drawImage" && o.args[0] === dotSprite());
    expect(dots.length, "这一帧没有一颗豆子走贴图").toBeGreaterThanOrEqual(3);
    for (const d of dots) {
      expect(Number(d.args[3]), "豆子贴图画得太小，360px 上要看不见了").toBeGreaterThanOrEqual(6);
    }
    destroy();
  });

  it("能量豆走四芒星贴图，正常动效下带旋转", async () => {
    const { ops, destroy } = await frameOps({ maze: corridor({ dots: [3], power: [6] }) });
    expect(ops.some((o) => o.op === "drawImage" && o.args[0] === powerSprite())).toBe(true);
    expect(ops.filter((o) => o.op === "rotate").length).toBeGreaterThanOrEqual(1);
    destroy();
  });

  /** 直接喂记录用的 2d 上下文，画一个玩家，返回这次画了什么 */
  function playerOps(over: Partial<PlayerFigureOpts> = {}): CtxOp[] {
    clearCtxLog();
    drawPlayerFigure(ctx2d as CanvasRenderingContext2D, {
      x: 20,
      y: 20,
      r: 8,
      dir: "right",
      mouth: 0.3,
      flash: false,
      shield: false,
      sad: false,
      ...over,
    });
    return [...ctxLog];
  }

  it("玩家绘制含眼睛子路径：比旧版的单个扇形 arc 至少多 2 个 arc", () => {
    const arcs = playerOps().filter((o) => o.op === "arc").length;
    expect(arcs, "旧版只有 1 个 arc，眼睛至少再添 2 个").toBeGreaterThanOrEqual(3);
  });

  it("委屈脸和平常脸画法不同，眉毛嘴角还要再多两笔 arc", () => {
    const normal = playerOps();
    const sad = playerOps({ sad: true });
    expect(JSON.stringify(sad)).not.toBe(JSON.stringify(normal));
    const arcCount = (ops: CtxOp[]): number => ops.filter((o) => o.op === "arc").length;
    expect(arcCount(sad)).toBeGreaterThanOrEqual(arcCount(normal) + 2);
  });

  it("护盾光环只在 shield 打开时多画一圈", () => {
    const plain = playerOps().filter((o) => o.op === "arc").length;
    const shielded = playerOps({ shield: true }).filter((o) => o.op === "arc").length;
    expect(shielded).toBe(plain + 1);
  });

  /** 画一只指定状态的幽灵，返回序列化的绘制流水 */
  function ghostTrace(mood: GhostFigureMood, pupilDx = 1.2): string {
    clearCtxLog();
    drawGhostFigure(ctx2d as CanvasRenderingContext2D, {
      x: 20,
      y: 20,
      r: 8,
      color: "#FF9AB0",
      mood,
      pupil: { dx: pupilDx, dy: 0 },
      starMark: false,
      warnRing: false,
    });
    return ctxLog.map((o) => `${o.op}(${JSON.stringify(o.args)})`).join(";");
  }

  it("幽灵 fright / eyes / normal 三态绘制序列互不相同", () => {
    const normal = ghostTrace("normal");
    const fright = ghostTrace("fright");
    const eyes = ghostTrace("eyes");
    expect(normal).not.toBe(fright);
    expect(normal).not.toBe(eyes);
    expect(fright).not.toBe(eyes);
  });

  it("瞳孔跟着移动方向偏：换个方向，画出来就不一样", () => {
    expect(ghostTrace("normal", 1.2)).not.toBe(ghostTrace("normal", -1.2));
  });

  it("果子不再走 fillText 的 emoji 路径，而是 fruitSprite 贴图", async () => {
    const { ops, destroy } = await frameOps({ fruitAt: [0] });
    expect(ops.filter((o) => o.op === "fillText"), "这一帧不该有任何 fillText").toHaveLength(0);
    const sprites = [fruitSprite(0), fruitSprite(1), fruitSprite(2)];
    expect(
      ops.some((o) => o.op === "drawImage" && sprites.includes(o.args[0] as HTMLCanvasElement)),
      "果子没走贴图路径"
    ).toBe(true);
    destroy();
  });

  it("抢豆模式的星星是五角星贴图，不再是蓝圆", async () => {
    const { ops, destroy } = await frameOps({}, { starRole: "eater" });
    expect(ops.some((o) => o.op === "drawImage" && o.args[0] === versusStarSprite())).toBe(true);
    destroy();
  });

  it("fog 模式的径向渐变仍然生效（回归）", async () => {
    const { ops, canvas, destroy } = await frameOps({ fog: true });
    const cell = canvas.width / 9;
    const fogIdx = ops.findIndex((o) => o.op === "createRadialGradient" && Number(o.args[2]) >= cell * 2);
    expect(fogIdx, "没找到迷雾那个大半径的径向渐变").toBeGreaterThanOrEqual(0);
    expect(
      ops.slice(fogIdx).some((o) => o.op === "fillRect" && o.args[0] === 0 && o.args[2] === canvas.width),
      "迷雾渐变之后没有铺满画布"
    ).toBe(true);
    destroy();
  });

  it("墙面连通化：相邻墙格之间补了连接段，拐角走圆弧", () => {
    const trace = (wall: boolean[]): { bridges: number; corners: number } => {
      clearCtxLog();
      drawWalls(ctx2d as CanvasRenderingContext2D, { w: 3, h: 1, wall }, 20, WALL_THEMES[0]);
      return {
        bridges: ctxLog.filter((o) => o.op === "fillRect").length,
        corners: ctxLog.filter((o) => o.op === "arcTo").length,
      };
    };
    const joined = trace([true, true, false]);
    const apart = trace([true, false, true]);
    expect(joined.corners, "圆角没了").toBeGreaterThan(0);
    expect(joined.bridges, "相邻墙格之间没有连接段").toBeGreaterThan(apart.bridges);
  });

  it("四套墙色主题都是合法色值，每 47 关换一套", () => {
    expect(WALL_THEMES).toHaveLength(4);
    for (const t of WALL_THEMES) {
      for (const c of [t.edge, t.fill, t.spark]) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(wallThemeIndex(0)).toBe(0);
    expect(wallThemeIndex(46)).toBe(0);
    expect(wallThemeIndex(47)).toBe(1);
    expect(wallThemeIndex(94)).toBe(2);
    expect(wallThemeIndex(141)).toBe(3);
    expect(wallThemeIndex(188)).toBe(0);
  });

  it("减弱动效下能量豆不旋转（新增光效全部走 soft 开关）", async () => {
    restoreDom();
    dom = installDom(420, true);
    const { ops, destroy } = await frameOps({ maze: corridor({ dots: [3], power: [6] }) });
    expect(ops.filter((o) => o.op === "rotate"), "soft 下不该有任何旋转").toHaveLength(0);
    destroy();
  });

  it("HUD 生命数画成一排小豆豆脸（SVG），数量等于小星命", async () => {
    const { mountStage } = await import("./index");
    const handle = mountStage(dom.root as unknown as HTMLElement, {
      cfg: cfg(),
      starRole: "none",
      label: "视觉",
      onEnd: () => undefined,
    });
    const lives = dom.root.querySelector(".dmz-lives")!;
    expect(lives.querySelectorAll("svg")).toHaveLength(3);
    expect(lives.getAttribute("aria-label")).toContain("3 颗小星命");
    handle.destroy();
  });

  it("贴图是带缓存的纯函数：同一种贴图永远是同一张画布", () => {
    expect(dotSprite()).toBe(dotSprite());
    expect(powerSprite()).toBe(powerSprite());
    expect(versusStarSprite()).toBe(versusStarSprite());
    expect(fruitSprite(1)).toBe(fruitSprite(1));
    expect(fruitSprite(0)).not.toBe(fruitSprite(1));
    for (const c of [dotSprite(), powerSprite(), versusStarSprite(), fruitSprite(2)]) {
      expect(c.width).toBeGreaterThan(0);
    }
  });
});
