import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeCanvas, type FakeEl, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import { createArena, duoKey, fxBudget, heldToInput, meta, starKey, type Arena } from "./index";
import { HIT_SPARK_RAYS } from "./art";
import { CHARACTER_IDS } from "./frames";
import { versusMatchConfig } from "./levels";
import { GAME_MODES } from "../../engine/types";

function held(patch: Partial<Record<"left" | "right" | "up" | "down" | "light" | "heavy" | "burst", boolean>> = {}) {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    light: false,
    heavy: false,
    burst: false,
    ...patch
  };
}

describe("combo-clash · meta 是纯数据卡片", () => {
  it("按规格落地,一个字段都不缺", () => {
    expect(meta.id).toBe("combo-clash");
    expect(meta.title).toBe("连招对决");
    expect(meta.emoji).toBe("💫");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#FFD6EA");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("desktop");
    expect(meta.blurb.length).toBeGreaterThan(10);
  });

  it("四种模式都是壳认识的模式名", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    for (const m of meta.modes) expect(GAME_MODES as readonly string[]).toContain(m);
  });

  it("介绍里只提元气,不提血", () => {
    expect(meta.blurb).toContain("元气");
    expect(meta.blurb).not.toMatch(/血|伤害|死/);
  });
});

describe("combo-clash · 双人键位", () => {
  it("朵朵是 WASD + F 轻 + G 重", () => {
    expect(duoKey("a")).toBe("left");
    expect(duoKey("d")).toBe("right");
    expect(duoKey("w")).toBe("up");
    expect(duoKey("s")).toBe("down");
    expect(duoKey("f")).toBe("light");
    expect(duoKey("g")).toBe("heavy");
  });

  it("星星是方向键 + L 轻 + K 重", () => {
    expect(starKey("ArrowLeft")).toBe("left");
    expect(starKey("ArrowRight")).toBe("right");
    expect(starKey("ArrowUp")).toBe("up");
    expect(starKey("ArrowDown")).toBe("down");
    expect(starKey("l")).toBe("light");
    expect(starKey("k")).toBe("heavy");
  });

  it("两套键位互不打架,同屏双人不会抢键", () => {
    for (const k of ["a", "d", "w", "s", "f", "g"]) expect(starKey(k)).toBeNull();
    for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "l", "k"]) expect(duoKey(k)).toBeNull();
  });

  it("没绑的键一律不认", () => {
    for (const k of ["z", "Enter", " ", "Escape", "1"]) {
      expect(duoKey(k)).toBeNull();
      expect(starKey(k)).toBeNull();
    }
  });
});

describe("combo-clash · 键位转成引擎输入", () => {
  it("轻重同按就是必杀钮,少一个按钮也玩得转", () => {
    expect(heldToInput(held({ light: true, heavy: true })).burst).toBe(true);
    expect(heldToInput(held({ light: true })).burst).toBe(false);
    expect(heldToInput(held({ heavy: true })).burst).toBe(false);
  });

  it("触屏的独立必杀钮也能直接给出必杀钮", () => {
    expect(heldToInput(held({ burst: true })).burst).toBe(true);
  });

  it("方向原样传过去,不会漏键", () => {
    const f = heldToInput(held({ left: true, down: true }));
    expect(f.left).toBe(true);
    expect(f.down).toBe(true);
    expect(f.right).toBe(false);
    expect(f.up).toBe(false);
  });

  it("什么都不按就是一帧空输入", () => {
    expect(Object.values(heldToInput(held()))).toEqual(Array(7).fill(false));
  });
});

describe("combo-clash · 十位原创小伙伴", () => {
  it("至少十个人,而且 id 不重样", () => {
    expect(CHARACTER_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CHARACTER_IDS).size).toBe(CHARACTER_IDS.length);
  });

  it("朵朵和星星都在名单里", () => {
    expect(CHARACTER_IDS).toContain("duoduo");
    expect(CHARACTER_IDS).toContain("xingxing");
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉契约(整帧级):用 canvasDom 替身把 createArena 整个跑起来
// ---------------------------------------------------------------------------

describe("combo-clash · 命中特效粒子预算(soft 归零)", () => {
  it("正常模式:放射线 6–8 根,星屑 > 0", () => {
    const b = fxBudget(false, 10);
    expect(b.rays).toBe(HIT_SPARK_RAYS);
    expect(b.rays).toBeGreaterThanOrEqual(6);
    expect(b.rays).toBeLessThanOrEqual(8);
    expect(b.stars).toBeGreaterThan(0);
  });

  it("soft(减弱动效)模式:粒子上限为 0", () => {
    expect(fxBudget(true, 10)).toEqual({ rays: 0, stars: 0 });
    expect(fxBudget(true, 40)).toEqual({ rays: 0, stars: 0 });
  });
});

describe("combo-clash · 整帧渲染契约", () => {
  let dom: DomHarness;
  let host: FakeEl;
  let arena: Arena | null = null;
  const results: Array<0 | 1 | -1 | null> = [];

  function makeArena(): { arena: Arena; canvas: FakeCanvas } {
    const a = createArena(host as unknown as HTMLElement, {
      cfg: versusMatchConfig("duoduo", "xingxing"),
      goalText: "测试",
      seats: [
        { kind: "dummy", mode: "stand" },
        { kind: "dummy", mode: "stand" }
      ],
      sfx: () => undefined,
      onEnd: (m) => {
        results.push(m.winner);
      }
    });
    arena = a;
    const canvas = host.querySelector("canvas.cc-canvas") as FakeCanvas;
    return { arena: a, canvas };
  }

  beforeEach(() => {
    dom = installCanvasDom();
    const doc = (globalThis as { document?: { createElement: (t: string) => FakeEl } }).document;
    host = doc!.createElement("div");
    results.length = 0;
  });

  afterEach(() => {
    arena?.destroy();
    arena = null;
    delete (globalThis as Record<string, unknown>).matchMedia;
    dom.restore();
  });

  it("一帧 render() 绘制调用非空,舞台/角色/地面都落了笔", () => {
    const { canvas } = makeArena();
    expect(canvas).toBeTruthy();
    // createArena 末尾同步先画了一帧
    expect(canvas.ctx.painted).toBeGreaterThan(30);
    expect(canvas.ctx.ops.some((o) => o.op === "createLinearGradient")).toBe(true);
    dom.tick(3);
    expect(canvas.ctx.painted).toBeGreaterThan(60);
  });

  it("P1/P2 光环双通道走到了:一帧里既有圆环 arc 也有方环 strokeRect", () => {
    const { canvas } = makeArena();
    expect(canvas.ctx.ops.filter((o) => o.op === "strokeRect").length).toBeGreaterThanOrEqual(2);
    expect(canvas.ctx.ops.filter((o) => o.op === "arc").length).toBeGreaterThan(4);
  });

  it("HUD:两侧 24px 头像与星徽画布都画了东西,元气 aria 同步", () => {
    makeArena();
    const avas = host.byClass("cc-ava") as FakeCanvas[];
    const stars = host.byClass("cc-stars") as FakeCanvas[];
    expect(avas).toHaveLength(2);
    expect(stars).toHaveLength(2);
    for (const c of [...avas, ...stars]) expect(c.ctx.painted).toBeGreaterThan(0);
    const vigor = host.byClass("cc-vigor")[0];
    expect(vigor.getAttribute("aria-label")).toBe("元气 100%");
    expect(stars[0].getAttribute("aria-label")).toBe("元气星 3 / 3");
  });

  it("KO 演出:先放 0.3s 震屏彩带与「获胜」横幅,再回调结算", () => {
    const { arena: a, canvas } = makeArena();
    dom.tick(2);
    a.state().winner = 0;
    dom.tick(2);
    // KO 演出还没播完,不许提前结算
    expect(results).toHaveLength(0);
    expect(canvas.ctx.ops.some((o) => o.op.startsWith("fillText:") && o.op.includes("获胜"))).toBe(true);
    dom.tick(30);
    expect(results).toEqual([0]);
  });

  it("reduced-motion:降级路径可达,照样渲染非空且立刻结算", () => {
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    const { arena: a, canvas } = makeArena();
    expect(canvas.ctx.painted).toBeGreaterThan(0);
    a.state().winner = 1;
    dom.tick(3);
    expect(results).toEqual([1]);
  });

  it("destroy 摘干净全局键盘监听", () => {
    makeArena();
    expect(dom.globalListenerCount("keydown")).toBeGreaterThan(0);
    arena?.destroy();
    arena = null;
    expect(dom.globalListenerCount("keydown")).toBe(0);
    expect(dom.globalListenerCount("keyup")).toBe(0);
  });
});
