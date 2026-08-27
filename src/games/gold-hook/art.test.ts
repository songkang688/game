/**
 * 1.3 视觉契约:金矿钩钩的核心资产不许再退回「火柴人 + 三笔线钩子 + emoji 芯片」。
 *
 * 做法:给每个绘制函数塞一个**录制型** 2D context,把每一笔指令(带当时的
 * fillStyle / strokeStyle)记成字符串序列,然后对序列做断言 ——
 *  - 序列不同 ⇔ 画面不同(双人可分辨、动作两帧、扫光会动);
 *  - 序列里有 `fill@某色` ⇔ 那一层真的画了(钩子是实心的、金块有高光层);
 *  - calm(弱动效)时序列不随时间变 ⇔ 动画真的停了。
 *
 * 另有一条走 domStub 把整局挂起来,验 HUD 上再也没有 💰/🎯/⏳ 这批 emoji 芯片。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  CREW_SKINS,
  ORE_SKIN,
  drawCrew,
  drawGround,
  drawHook,
  drawIcon,
  drawOre,
  drawParallax,
  drawPickaxe,
  drawRope,
  drawSkyDecor,
  drawWalls,
  drawWinch,
  skyDecorKind,
  type CrewOpts,
  type IconKind,
  type Palette,
} from "./art";
import { ORES, type Ore, type OreKind } from "./logic";
import { ropeSag } from "./depth12";
import { CSS } from "./style";
import { allText, findButton, install, walk, type FakeEl, type Harness } from "./domStub";

/* ---------------- 录制型 2D context ---------------- */

class RecCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;
  readonly ops: string[] = [];

  private log(op: string): void {
    this.ops.push(op);
  }
  private n(v: number): string {
    return Number.isFinite(v) ? v.toFixed(2) : "x";
  }
  save(): void {
    this.log("save");
  }
  restore(): void {
    this.log("restore");
  }
  setTransform(): void {
    this.log("setTransform");
  }
  translate(x: number, y: number): void {
    this.log(`translate:${this.n(x)},${this.n(y)}`);
  }
  rotate(a: number): void {
    this.log(`rotate:${this.n(a)}`);
  }
  clearRect(): void {
    this.log("clearRect");
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.log(`fillRect:${this.n(x)},${this.n(y)},${this.n(w)},${this.n(h)}@${String(this.fillStyle)}`);
  }
  beginPath(): void {
    this.log("beginPath");
  }
  closePath(): void {
    this.log("closePath");
  }
  moveTo(x: number, y: number): void {
    this.log(`moveTo:${this.n(x)},${this.n(y)}`);
  }
  lineTo(x: number, y: number): void {
    this.log(`lineTo:${this.n(x)},${this.n(y)}`);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.log(`quad:${this.n(cx)},${this.n(cy)},${this.n(x)},${this.n(y)}`);
  }
  arc(x: number, y: number, r: number): void {
    this.log(`arc:${this.n(x)},${this.n(y)},${this.n(r)}`);
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.log(`ellipse:${this.n(x)},${this.n(y)},${this.n(rx)},${this.n(ry)}`);
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.log(`roundRect:${this.n(x)},${this.n(y)},${this.n(w)},${this.n(h)}`);
  }
  rect(): void {
    this.log("rect");
  }
  clip(): void {
    this.log("clip");
  }
  fill(): void {
    this.log(`fill@${String(this.fillStyle)}`);
  }
  stroke(): void {
    this.log(`stroke@${String(this.strokeStyle)}`);
  }
  fillText(s: string): void {
    this.log(`text:${s}`);
  }
  setLineDash(seg: number[]): void {
    this.log(`dash:${seg.join(",")}`);
  }
  createLinearGradient(): CanvasGradient {
    this.log("linGrad");
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
  createRadialGradient(): CanvasGradient {
    this.log("radGrad");
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
}

function rec(draw: (c: CanvasRenderingContext2D) => void): string[] {
  const c = new RecCtx();
  draw(c as unknown as CanvasRenderingContext2D);
  return c.ops;
}

const seq = (ops: string[]): string => ops.join("|");
const fills = (ops: string[]): number => ops.filter((o) => o.startsWith("fill@")).length;
const strokes = (ops: string[]): number => ops.filter((o) => o.startsWith("stroke@")).length;

function crew(who: 0 | 1, over: Partial<CrewOpts> = {}): string[] {
  return rec((c) => drawCrew(c, 176, 52, who, { pose: "idle", t: 1.0, calm: false, ...over }));
}

function oreOf(kind: OreKind, over: Partial<Ore> = {}): Ore {
  const p = ORES[kind];
  return {
    id: 3,
    kind,
    x: 230,
    y: 260,
    value: p.value,
    weight: p.weight,
    radius: p.radius,
    runRange: 0,
    runSpeed: 0,
    ...over,
  };
}

const PAL: Palette = {
  sky0: "#FFF6E6",
  sky1: "#F6DEC2",
  wall: "#E4C9A6",
  vein: "#CBA97F",
  ground: "#BFE3A6",
  groundDark: "#93C97A",
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/* ---------------- 一、矿工双人(主管点名的第一优先) ---------------- */

describe("1.3 矿工不再是火柴人", () => {
  it("A 朵朵与 B 星星的绘制序列不同:双人可分辨,不是换个 fillStyle 了事", () => {
    const a = crew(0);
    const b = crew(1);
    expect(seq(a)).not.toBe(seq(b));
    // 名牌上写的也得是各自的名字
    expect(a).toContain("text:朵朵");
    expect(b).toContain("text:星星");
  });

  it("绘制指令数显著多于 1.2 火柴人基线(旧 drawCrew 一共约 16 条指令)", () => {
    // 2 头身 + 工装背带裤 + 短手短脚 + 头盔矿灯 + 名字木牌,指令数翻几倍才对
    expect(crew(0).length).toBeGreaterThan(48);
    expect(crew(1).length).toBeGreaterThan(48);
    expect(fills(crew(0))).toBeGreaterThan(10);
  });

  it("A/B 在主色与配饰两条通道上都不同(色弱也分得开)", () => {
    const [a, b] = CREW_SKINS;
    for (const k of [a, b]) {
      expect(k.helmet).toMatch(HEX);
      expect(k.overalls).toMatch(HEX);
      expect(k.shirt).toMatch(HEX);
    }
    expect(a.helmet).not.toBe(b.helmet);
    expect(a.overalls).not.toBe(b.overalls);
    // 形状通道:圆眼 vs 眯眼笑,再加朵朵的双揪揪剪影
    expect(a.eye).not.toBe(b.eye);
    expect(a.pigtails).not.toBe(b.pigtails);
  });

  it("收绳(back)与待机(idle)画得不一样,而且摇柄是两帧循环", () => {
    const idle = crew(0, { pose: "idle" });
    const back0 = crew(0, { pose: "back", crank: 0 });
    const back1 = crew(0, { pose: "back", crank: 13 });
    expect(seq(back0)).not.toBe(seq(idle));
    // 摇柄两帧:绳长走过半个周期,手臂换了个位置
    expect(seq(back0)).not.toBe(seq(back1));
  });

  it("放绳前倾、钩重物后仰咬牙、入袋欢呼各是一套动作", () => {
    const out = crew(0, { pose: "out" });
    const heavy = crew(0, { pose: "heavy" });
    const cheerUp = crew(0, { pose: "cheer" });
    expect(seq(out)).not.toBe(seq(heavy));
    expect(seq(heavy)).not.toBe(seq(cheerUp));
    expect(seq(out)).not.toBe(seq(cheerUp));
  });

  it("待机会呼吸眨眼(随时间变);calm 时是静止的持镐站姿,一帧都不动", () => {
    expect(seq(crew(0, { t: 0.5 }))).not.toBe(seq(crew(0, { t: 1.7 })));
    const calmA = crew(0, { calm: true, t: 0.5 });
    const calmB = crew(0, { calm: true, t: 42.7, pose: "back", crank: 99 });
    expect(seq(calmA)).toBe(seq(calmB));
    // 持镐站姿和普通待机不是同一张画
    expect(seq(calmA)).not.toBe(seq(crew(0, { t: 0.5 })));
  });
});

/* ---------------- 二、绞盘、钩子与绳 ---------------- */

describe("1.3 绞盘与锚形钩", () => {
  it("钩子是实心填充的锚形双爪(fill 被调用),不再是 3 笔 stroke", () => {
    const open = rec((c) => drawHook(c, { open: true, flash: false }));
    // 柄 + 左右两爪,至少三次实心填充
    expect(fills(open)).toBeGreaterThanOrEqual(3);
    expect(strokes(open)).toBeGreaterThan(0);
  });

  it("空钩张开、钩中咬合是两态,钩中那一下还有白闪", () => {
    const open = rec((c) => drawHook(c, { open: true, flash: false }));
    const closed = rec((c) => drawHook(c, { open: false, flash: false }));
    const flash = rec((c) => drawHook(c, { open: false, flash: true }));
    expect(seq(open)).not.toBe(seq(closed));
    expect(flash.length).toBeGreaterThan(closed.length);
    expect(flash.some((o) => o === "fill@#FFFFFF")).toBe(true);
  });

  it("绞盘有木架、卷筒和摇柄:摇柄随收放绳转,筒上的绳圈随收绳变多", () => {
    const a = rec((c) => drawWinch(c, 230, 50, { spin: 0, wraps: 0 }));
    const b = rec((c) => drawWinch(c, 230, 50, { spin: 1.3, wraps: 0 }));
    const full = rec((c) => drawWinch(c, 230, 50, { spin: 0, wraps: 1 }));
    expect(fills(a)).toBeGreaterThan(0);
    expect(strokes(a)).toBeGreaterThan(0);
    expect(seq(a)).not.toBe(seq(b));
    // 缠满绳的卷筒要多画几圈
    expect(strokes(full)).toBeGreaterThan(strokes(a));
  });

  it("绳子是双线绞纹:主线加错位浅色短划,两种颜色各 stroke 一次", () => {
    const straight = rec((c) => drawRope(c, { x: 300, y: 300 }, 0));
    expect(straight).toContain("stroke@#8A6B45");
    expect(straight).toContain("stroke@#D9BC8C");
    expect(straight.some((o) => o.startsWith("dash:"))).toBe(true);
  });

  it("钩着重物时绳子中段下垂(贝塞尔),空钩绷直(直线)—— ropeSag 逻辑原样", () => {
    const sag = ropeSag(ORES.boulder.weight);
    const heavy = rec((c) => drawRope(c, { x: 300, y: 300 }, sag));
    const empty = rec((c) => drawRope(c, { x: 300, y: 300 }, 0));
    expect(heavy.some((o) => o.startsWith("quad:"))).toBe(true);
    expect(empty.some((o) => o.startsWith("quad:"))).toBe(false);
    // 小镐是真资产不是摆设:单独调用也要有笔画
    expect(fills(rec((c) => drawPickaxe(c, 100, 60, 0.4)))).toBeGreaterThan(0);
  });
});

/* ---------------- 三、矿石家族(11 种) ---------------- */

describe("1.3 矿石精修", () => {
  it("金块含高光层(ORE_SKIN.lit 真的画上去了),且金/石一眼可分", () => {
    const gold = rec((c) => drawOre(c, oreOf("nugget"), 230));
    const rock = rec((c) => drawOre(c, oreOf("pebble"), 230));
    expect(gold).toContain(`fill@${ORE_SKIN.nugget.lit}`);
    expect(seq(gold)).not.toBe(seq(rock));
    // 「金暖黄、石冷灰」的分辨线写死在皮肤表里
    expect(ORE_SKIN.nugget.fill).not.toBe(ORE_SKIN.pebble.fill);
    expect(ORE_SKIN.nugget.fill).toMatch(HEX);
    expect(ORE_SKIN.pebble.fill).toMatch(HEX);
  });

  it("金块的斜向扫光会动:不同时刻画面不同;calm 时停成静态高光", () => {
    const a = rec((c) => drawOre(c, oreOf("nugget"), 230, { t: 0.1 }));
    const b = rec((c) => drawOre(c, oreOf("nugget"), 230, { t: 0.9 }));
    expect(seq(a)).not.toBe(seq(b));
    const calmA = rec((c) => drawOre(c, oreOf("nugget"), 230, { t: 0.1, calm: true }));
    const calmB = rec((c) => drawOre(c, oreOf("nugget"), 230, { t: 0.9, calm: true }));
    expect(seq(calmA)).toBe(seq(calmB));
    // 扫光是被夹在矿石轮廓里的(clip),不会糊到矿洞底色上
    expect(a).toContain("clip");
  });

  it("巨型金块比普通金块多一层身份:分层纹 + 顶上的小星闪", () => {
    const huge = rec((c) => drawOre(c, oreOf("goldHuge", { radius: 15 }), 230, { t: 0.1 }));
    const big = rec((c) => drawOre(c, oreOf("goldBig", { radius: 15 }), 230, { t: 0.1 }));
    expect(huge.length).toBeGreaterThan(big.length);
  });

  it("地鼠待机会眨眼;被钩住时挥着小短肢、头顶冒手绘问号", () => {
    // id=3 时 t=0.5 落在眨眼窗口里,t=1.5 睁着眼
    const blink = rec((c) => drawOre(c, oreOf("mole"), 230, { t: 0.5 }));
    const idle = rec((c) => drawOre(c, oreOf("mole"), 230, { t: 1.5 }));
    const hooked = rec((c) => drawOre(c, oreOf("mole"), 230, { t: 1.5, carried: true }));
    expect(seq(blink)).not.toBe(seq(idle));
    expect(hooked.length).toBeGreaterThan(idle.length);
    expect(seq(hooked)).not.toBe(seq(idle));
  });

  it("宝箱被拉着走时盖子微开漏金光,和埋在土里时不同", () => {
    const rest = rec((c) => drawOre(c, oreOf("chest"), 230, { t: 1 }));
    const carried = rec((c) => drawOre(c, oreOf("chest"), 230, { t: 1, carried: true }));
    expect(seq(carried)).not.toBe(seq(rest));
    expect(carried).toContain("fill@#FFEFA8");
  });

  it("泥泥矿裹着泥、双层晶有两道内部折光,两种新矿互不相像", () => {
    const muddy = rec((c) => drawOre(c, oreOf("muddy"), 230, { t: 1 }));
    const twin = rec((c) => drawOre(c, oreOf("twinCrystal"), 230, { t: 1 }));
    expect(seq(muddy)).not.toBe(seq(twin));
    expect(muddy).toContain("fill@#8A5F35");
    expect(twin.filter((o) => o === "stroke@rgba(255,255,255,.65)").length).toBeGreaterThanOrEqual(2);
  });

  it("石头保持灰调凹坑的「不值钱」长相(1.2 的正确设计不许丢)", () => {
    const rock = rec((c) => drawOre(c, oreOf("boulder"), 230));
    expect(rock).toContain(`fill@${ORE_SKIN.boulder.edge}`);
  });
});

/* ---------------- 四、矿洞场景 ---------------- */

describe("1.3 矿洞三层内容", () => {
  it("视差层有真内容(钟乳石/晶体/岩台),不再是三条矩形色带,且仍跟着绳长错位", () => {
    const shallow = rec((c) => drawParallax(c, PAL, 0));
    const deep = rec((c) => drawParallax(c, PAL, 300));
    // 旧实现一层就一两个 fillRect,三层 10 条指令左右;内容层要远多于它
    expect(shallow.length).toBeGreaterThan(40);
    expect(seq(shallow)).not.toBe(seq(deep));
  });

  it("侧壁是斜向矿脉曲线,还嵌着小金点", () => {
    const walls = rec((c) => drawWalls(c, PAL));
    expect(walls.some((o) => o.startsWith("quad:"))).toBe(true);
    expect(walls).toContain("fill@#FFD264");
  });

  it("地面有草皮边和碎石粒", () => {
    const ground = rec((c) => drawGround(c, PAL));
    expect(ground.some((o) => o.startsWith("quad:"))).toBe(true);
    expect(ground.some((o) => o.startsWith("ellipse:"))).toBe(true);
  });

  it("r2 B档TOP5:8 章各产出非空天空装饰,太阳/月牙/星三分支互不相同", () => {
    const byKind = new Map<string, string>();
    for (let ch = 0; ch < 8; ch++) {
      const ops = rec((c) => drawSkyDecor(c, PAL, ch, 1, false));
      expect(ops.length, `第 ${ch + 1} 章天空空空如也`).toBeGreaterThan(6);
      expect(ops.some((o) => o.startsWith("text:"))).toBe(false);
      byKind.set(skyDecorKind(ch), ops.join("|"));
    }
    // 三种主题物都被用到,且两两画得不同(冷暖分支可区分)
    expect(new Set(["sun", "moon", "stars"]).size).toBe(3);
    expect(byKind.size).toBe(3);
    const all = [...byKind.values()];
    expect(new Set(all).size).toBe(3);
    // 太阳章带径向光晕
    expect(rec((c) => drawSkyDecor(c, PAL, 0, 1, false))).toContain("radGrad");
  });

  it("r2 B档TOP5:云 6px/s 慢漂——两个 t 值画面不同;calm 定格一致", () => {
    const a = rec((c) => drawSkyDecor(c, PAL, 2, 1, false));
    const b = rec((c) => drawSkyDecor(c, PAL, 2, 9, false));
    expect(seq(a)).not.toBe(seq(b));
    const calmA = rec((c) => drawSkyDecor(c, PAL, 2, 1, true));
    const calmB = rec((c) => drawSkyDecor(c, PAL, 2, 9, true));
    expect(seq(calmA)).toBe(seq(calmB));
  });
});

/* ---------------- 五、HUD:emoji 芯片退场 ---------------- */

const ICON_KINDS: IconKind[] = ["coin", "target", "hourglass", "arm", "clover", "bomb", "bag"];

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

function elByClass(root: FakeEl, cls: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (node) => {
    if (!hit && node.className.split(/\s+/).includes(cls)) hit = node;
  });
  return hit;
}

describe("1.3 HUD 手绘图标", () => {
  it("七枚图标都是实心矢量,互不相同,而且一处 fillText 都没有(不是字符冒充的)", () => {
    const seqs = ICON_KINDS.map((kind) => rec((c) => drawIcon(c, kind, 14)));
    for (let i = 0; i < seqs.length; i++) {
      expect(fills(seqs[i]), ICON_KINDS[i]).toBeGreaterThan(0);
      expect(seqs[i].some((o) => o.startsWith("text:")), ICON_KINDS[i]).toBe(false);
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seq(seqs[i]), `${ICON_KINDS[i]} vs ${ICON_KINDS[j]}`).not.toBe(seq(seqs[j]));
      }
    }
  });

  it("顶部 HUD 与底部道具行不再含 💰/🎯/⏳(以及 💪🍀💥)emoji 芯片", async () => {
    const h = install();
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({
      root: h.root as unknown as HTMLElement,
      play: () => {},
    } as never);
    game.openCampaignLevel(2);
    h.flush(4);

    const hud = elByClass(h.root, "gdh-hud");
    const ctrl = elByClass(h.root, "gdh-ctrl");
    expect(hud).not.toBeNull();
    expect(ctrl).not.toBeNull();
    const text = allText(hud as FakeEl) + allText(ctrl as FakeEl);
    for (const emoji of ["💰", "🎯", "⏳", "💪", "🍀", "💥"]) {
      expect(text, emoji).not.toContain(emoji);
    }
    // 数字还在:金币、目标、剩余秒数照样读得到
    expect(text).toMatch(/秒/);
    // 「放绳」主操作文字仍在
    expect(findButton(h.root, "放绳")).not.toBeNull();
    game.destroy();
  });

  it("收工按钮有金光呼吸,且弱动效时动画停掉", () => {
    expect(CSS).toContain("gdh-done-glow");
    const i = CSS.indexOf("@media (prefers-reduced-motion:reduce){");
    expect(i).toBeGreaterThan(-1);
    expect(CSS.slice(i)).toContain(".gdh-done{animation:none;}");
  });
});
