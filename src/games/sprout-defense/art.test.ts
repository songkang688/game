/**
 * 1.3 视觉契约:绿芽保卫战的资产不许再退回「emoji 字符 + 一成不变的图标」。
 *
 * 做法与 gold-hook 同款:给绘制函数塞一个**录制型** 2D context,
 * 把每一笔指令(带当时的 fillStyle / strokeStyle)记成字符串序列 ——
 *  - 序列不同 ⇔ 画面不同(坚果三档缺口、地面虫 vs 飞行虫、啃咬两帧);
 *  - 序列里有 `linGrad`/`fill@…` ⇔ 那一层真的画了(结算星是路径 + 渐变);
 *  - calm(弱动效)时序列不随时间/相位变 ⇔ 新增动画真的停了。
 *
 * 另有一条走 DOM 桩把整局挂起来,从主页 → 地图 → 开打 → 失败结算,
 * 把每一帧 fillText 的内容全收下来,断言 🔒👑⭐💗💧⚔❄🕳🌙🚚🌱 等
 * emoji 字符一个都不再出现(计划点名的「清零断言」)。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  BUG_COLORS,
  ICON_KINDS,
  drawBugBody,
  drawClearStar,
  drawFence,
  drawFireflies,
  drawKitIcon,
  drawMoleMound,
  drawPlantIcon,
  type BugArt,
  type PlantArtOpts,
} from "./art";
import { BUG_INFO, BugKind, PLANT_KINDS, themeSize } from "./logic";
import { mapNodePoints } from "./mapFit";

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
  translate(x: number, y: number): void {
    this.log(`translate:${this.n(x)},${this.n(y)}`);
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
  fill(): void {
    this.log(`fill@${String(this.fillStyle)}`);
  }
  stroke(): void {
    this.log(`stroke@${String(this.strokeStyle)}`);
  }
  fillText(s: string): void {
    this.log(`text:${s}`);
  }
  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
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
const texts = (ops: string[]): string[] => ops.filter((o) => o.startsWith("text:"));

function plant(kind: (typeof PLANT_KINDS)[number], opts: PlantArtOpts = {}): string[] {
  return rec((c) => drawPlantIcon(c, 100, 100, 20, kind, opts));
}

const BUG_KINDS = Object.keys(BUG_INFO) as BugKind[];

function bug(kind: BugKind, over: Partial<BugArt> = {}): string[] {
  return rec((c) =>
    drawBugBody(c, {
      kind,
      x: 200,
      y: 120,
      groundY: 124,
      unit: 44,
      wob: 0.8,
      frozen: false,
      raged: false,
      chew: 0,
      armor: BUG_INFO[kind].armor,
      maxArmor: BUG_INFO[kind].armor,
      dots: 4,
      hpFrac: 1,
      calm: false,
      ...over,
    }),
  );
}

/* ---------------- 一、坚果三档缺口(计划点名 ①) ---------------- */

describe("1.3 坚果按 HP 三档换绘制", () => {
  it("满血 / 缺一口 / 双缺口三档的绘制序列两两不同", () => {
    const full = plant("nut", { hpFrac: 1 });
    const mid = plant("nut", { hpFrac: 0.5 });
    const low = plant("nut", { hpFrac: 0.2 });
    expect(seq(full)).not.toBe(seq(mid));
    expect(seq(mid)).not.toBe(seq(low));
    expect(seq(full)).not.toBe(seq(low));
  });

  it("缺口画的是浅色内瓤 + 裂纹,双缺口档笔画更多、表情变担忧", () => {
    const full = plant("nut", { hpFrac: 1 });
    const mid = plant("nut", { hpFrac: 0.5 });
    const low = plant("nut", { hpFrac: 0.2 });
    expect(full).not.toContain("fill@#fff3dd");
    expect(mid).toContain("fill@#fff3dd");
    expect(low.filter((o) => o === "fill@#fff3dd").length).toBe(2);
    expect(low.length).toBeGreaterThan(mid.length);
  });
});

/* ---------------- 二、射手后坐帧与吐泡鼓腮 ---------------- */

describe("1.3 植物战斗反馈帧", () => {
  it("星星芽发射瞬间身体后倾 + 一帧白色枪口闪光", () => {
    const idle = plant("star", { recoil: 0 });
    const firing = plant("star", { recoil: 1 });
    expect(seq(firing)).not.toBe(seq(idle));
    expect(firing).toContain("stroke@rgba(255,255,255,0.95)");
    // 后坐已过大半(recoil 低)就不再闪
    expect(plant("star", { recoil: 0.3 })).not.toContain("stroke@rgba(255,255,255,0.95)");
  });

  it("冰冰花同样有后坐 + 枪口闪;泡泡芽吐泡瞬间腮帮鼓起", () => {
    expect(seq(plant("ice", { recoil: 1 }))).not.toBe(seq(plant("ice", { recoil: 0 })));
    expect(plant("ice", { recoil: 1 })).toContain("stroke@rgba(255,255,255,0.95)");
    const calmMouth = plant("bubble", { anim: 0 });
    const puffing = plant("bubble", { anim: 1 });
    expect(seq(puffing)).not.toBe(seq(calmMouth));
    expect(puffing).toContain("fill@rgba(255,255,255,0.45)");
  });
});

/* ---------------- 三、全 kind 非空且互不相同(计划点名 ⑤) ---------------- */

describe("1.3 drawPlantIcon 全家福", () => {
  it("十二种绿芽个个有笔画(fill+stroke > 0),不抛异常", () => {
    for (const kind of PLANT_KINDS) {
      const ops = plant(kind);
      expect(fills(ops) + strokes(ops), kind).toBeGreaterThan(0);
    }
  });

  it("十二种绿芽两两画得不一样(一屏内剪影互不混淆)", () => {
    const seqs = PLANT_KINDS.map((kind) => seq(plant(kind)));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${PLANT_KINDS[i]} vs ${PLANT_KINDS[j]}`).not.toBe(seqs[j]);
      }
    }
  });
});

/* ---------------- 四、虫子家族(计划点名 ④ + 蠕动/啃咬) ---------------- */

describe("1.3 虫子家族可分辨与动作帧", () => {
  it("地面虫(爬爬虫)与飞行虫(飘飘虫)绘制序列不同:飞的有翅膀、爬的有小短腿", () => {
    const walker = bug("walker");
    const flyer = bug("flyer");
    expect(seq(walker)).not.toBe(seq(flyer));
    // 飞行虫有一对白翅膀
    expect(flyer).toContain("fill@rgba(255,255,255,0.75)");
    // 地面虫的四只小短腿比飞行虫多出好几笔 stroke
    expect(strokes(walker)).toBeGreaterThan(strokes(flyer) - 2);
  });

  it("r2 W4R2-06:飞虫翅膀锚出身体轮廓——calm 静态帧上翅翅尖高过体顶,16px 剪影有翅膀通道", () => {
    const flyingKinds = BUG_KINDS.filter((k) => BUG_INFO[k].flying);
    expect(flyingKinds.length).toBeGreaterThan(0);
    for (const k of flyingKinds) {
      const ops = bug(k, { calm: true });
      // 翅膀是最先画的两枚椭圆(气浪是 arc、影子在翅膀之后)
      const wings = ops.filter((o) => o.startsWith("ellipse:")).slice(0, 2);
      expect(wings, `${k} 没画出一对翅膀`).toHaveLength(2);
      const r = 44 * (BUG_INFO[k].boss ? 0.42 : 0.26);
      const upper = wings[0].slice("ellipse:".length).split(",").map(Number);
      // 上翅中心 y 减纵半径 = 翅尖,必须伸到身体顶(y - r = 120 - r)之上
      expect(upper[1] - upper[3], `${k} 翅尖没伸出轮廓`).toBeLessThan(120 - r);
    }
  });

  it("十四种虫两两画得不一样(护甲件/触角/爪子/王冠各有身份)", () => {
    const seqs = BUG_KINDS.map((kind) => seq(bug(kind)));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${BUG_KINDS[i]} vs ${BUG_KINDS[j]}`).not.toBe(seqs[j]);
      }
    }
    // 主色表本身也得两两不同(色弱之外还有形状通道,但颜色不许偷懒)
    const colors = Object.values(BUG_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("啃咬是 0.3s 循环的动作帧:头部前顶 + 张嘴,相位不同画面不同", () => {
    const idle = bug("walker", { chew: 0 });
    const biteA = bug("walker", { chew: 0.25 });
    const biteB = bug("walker", { chew: 0.5 });
    expect(seq(biteA)).not.toBe(seq(idle));
    expect(seq(biteB)).not.toBe(seq(biteA));
  });

  it("三节身体是波浪蠕动:相位变了画面就变;calm(弱动效)时定格不动", () => {
    expect(seq(bug("walker", { wob: 0.3 }))).not.toBe(seq(bug("walker", { wob: 1.7 })));
    const calmA = bug("walker", { calm: true, wob: 0.3 });
    const calmB = bug("walker", { calm: true, wob: 5.1 });
    expect(seq(calmA)).toBe(seq(calmB));
  });

  it("冻住的虫画绘制雪花(不再是「❄」字符),序列里一处 fillText 都没有", () => {
    const frozen = bug("walker", { frozen: true });
    expect(frozen).toContain("stroke@#8fd0f0");
    expect(texts(frozen)).toEqual([]);
    expect(seq(frozen)).not.toBe(seq(bug("walker")));
  });

  it("地地虫土包:问号是路径画的白气泡,不再 fillText(\"?\")", () => {
    const mound = rec((c) => drawMoleMound(c, 120, 100, 14, 2.2));
    expect(texts(mound)).toEqual([]);
    expect(mound).toContain("fill@rgba(255,255,255,0.92)");
    // 土粒半秒抖一次:相位过半土粒位置变了
    expect(seq(mound)).not.toBe(seq(rec((c) => drawMoleMound(c, 120, 100, 14, 5.4))));
  });
});

/* ---------------- 五、kit 图标(emoji 清零的替身) ---------------- */

describe("1.3 手绘 kit 图标", () => {
  it("十八枚图标全是矢量笔画:非空、互不相同、没有一枚是字符冒充的", () => {
    const seqs = ICON_KINDS.map((kind) => rec((c) => drawKitIcon(c, kind, 50, 50, 12)));
    for (let i = 0; i < seqs.length; i++) {
      expect(fills(seqs[i]) + strokes(seqs[i]), ICON_KINDS[i]).toBeGreaterThan(0);
      expect(texts(seqs[i]), ICON_KINDS[i]).toEqual([]);
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seq(seqs[i]), `${ICON_KINDS[i]} vs ${ICON_KINDS[j]}`).not.toBe(seq(seqs[j]));
      }
    }
  });

  it("金渐变星与灰空星是同一路径的亮/灭两态:亮星带渐变,空星不带", () => {
    const lit = rec((c) => drawKitIcon(c, "star", 50, 50, 12));
    const empty = rec((c) => drawKitIcon(c, "starEmpty", 50, 50, 12));
    expect(lit).toContain("linGrad");
    expect(empty).not.toContain("linGrad");
    expect(seq(lit)).not.toBe(seq(empty));
  });
});

/* ---------------- 六、结算金星(计划点名 ③) ---------------- */

describe("1.3 结算星是路径 + 渐变", () => {
  it("点亮的星:线性渐变 + 十段星形路径 + 实心填充,不再是「⭐/☆」字符", () => {
    const lit = rec((c) => drawClearStar(c, 100, 100, 20, { lit: true, pop: 1 }));
    expect(lit).toContain("linGrad");
    expect(lit.filter((o) => o.startsWith("lineTo:")).length).toBeGreaterThanOrEqual(9);
    expect(fills(lit)).toBeGreaterThan(0);
    expect(texts(lit)).toEqual([]);
  });

  it("没亮的星是灰空星,与亮星画得不同;点亮瞬间(pop<1)带光晕 + 四粒星屑", () => {
    const lit = rec((c) => drawClearStar(c, 100, 100, 20, { lit: true, pop: 1 }));
    const unlit = rec((c) => drawClearStar(c, 100, 100, 20, { lit: false }));
    const popping = rec((c) => drawClearStar(c, 100, 100, 20, { lit: true, pop: 0.3 }));
    expect(seq(unlit)).not.toBe(seq(lit));
    expect(unlit).not.toContain("linGrad");
    expect(popping.length).toBeGreaterThan(lit.length);
  });

  it("r2 B档TOP8:星弹是金渐变+深金描边,花粉弹是三瓣圆云(源码钉住,不许退回平涂)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const start = src.indexOf("for (const s of shots)");
    const end = src.indexOf("for (const bug of bugs)", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const shotSection = src.slice(start, end);
    // 星弹:径向渐变(#ffe9a0→#f0b429)+ 描边 #c9861b,与 drawClearStar 金星三色同族
    expect(shotSection).toContain("createRadialGradient");
    expect(shotSection).toContain("#ffe9a0");
    expect(shotSection).toContain("#f0b429");
    expect(shotSection).toContain("#c9861b");
    expect(shotSection).toContain("ctx.stroke()");
    // 花粉弹:独立分支画三瓣圆云,不再落进星形分支
    expect(shotSection).toContain('s.proj === "puff"');
    expect((shotSection.match(/ctx\.ellipse\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

/* ---------------- 七、氛围层的弱动效降级 ---------------- */

describe("1.3 氛围层接入弱动效", () => {
  it("萤火虫平时慢慢飘(不同时刻画面不同);calm 时一帧都不动", () => {
    const a = rec((c) => drawFireflies(c, 360, 100, 300, 1.0, false));
    const b = rec((c) => drawFireflies(c, 360, 100, 300, 9.0, false));
    expect(seq(a)).not.toBe(seq(b));
    const calmA = rec((c) => drawFireflies(c, 360, 100, 300, 1.0, true));
    const calmB = rec((c) => drawFireflies(c, 360, 100, 300, 9.0, true));
    expect(seq(calmA)).toBe(seq(calmB));
  });

  it("房端栅栏立着与被突破倒下是两帧不同的画", () => {
    const up = rec((c) => drawFence(c, 40, 100, 400, 44, 0));
    const down = rec((c) => drawFence(c, 40, 100, 400, 44, 1));
    expect(seq(up)).not.toBe(seq(down));
  });
});

/* ---------------- 八、整局挂载:emoji 清零(计划点名 ②) ---------------- */

type Handler = (e: unknown) => void;

/** 只记 fillText 的画布桩:整局跑几千帧也不吃内存。 */
class TextCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;
  readonly drawnTexts: string[] = [];
  save(): void {}
  restore(): void {}
  setTransform(): void {}
  translate(): void {}
  clip(): void {}
  fillRect(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  setLineDash(): void {}
  fillText(text: string): void {
    this.drawnTexts.push(text);
  }
  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
}

class FakeEl {
  tagName: string;
  className = "";
  type = "";
  disabled = false;
  textContent = "";
  width = 0;
  height = 0;
  clientWidth = 360;
  clientHeight = 720;
  readonly style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();
  readonly ctx2d: TextCtx | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
    if (tagName === "canvas") (this as { ctx2d: TextCtx | null }).ctx2d = new TextCtx();
  }
  getContext(kind: string): TextCtx | null {
    return kind === "2d" ? this.ctx2d : null;
  }
  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  removeChild(child: FakeEl): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }
  remove(): void {
    this.parent?.removeChild(this);
  }
  getBoundingClientRect(): { left: number; top: number } {
    return { left: 0, top: 0 };
  }
  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type);
    const i = list ? list.indexOf(fn) : -1;
    if (list && i >= 0) list.splice(i, 1);
  }
  tap(x: number, y: number): void {
    for (const fn of [...(this.listeners.get("pointerdown") ?? [])]) {
      fn({ pointerId: 1, clientX: x, clientY: y });
    }
    for (const fn of [...(this.listeners.get("pointerup") ?? [])]) {
      fn({ pointerId: 1, clientX: x, clientY: y });
    }
  }
}

function findCanvas(root: FakeEl): FakeEl | null {
  if (root.tagName === "canvas") return root;
  for (const kid of root.children) {
    const hit = findCanvas(kid);
    if (hit) return hit;
  }
  return null;
}

interface Harness {
  root: FakeEl;
  flush: (times?: number) => void;
  restore: () => void;
}

function install(): Harness {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document,
    window: g.window,
    raf: g.requestAnimationFrame,
    caf: g.cancelAnimationFrame,
    storage: g.localStorage,
    perf: g.performance,
    synth: g.speechSynthesis,
    utter: g.SpeechSynthesisUtterance,
  };
  const frames = new Map<number, (t: number) => void>();
  let nextId = 1;
  let clock = 0;
  g.document = {
    createElement: (tag: string) => new FakeEl(tag),
    body: new FakeEl("body"),
    head: new FakeEl("head"),
    documentElement: new FakeEl("html"),
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  g.window = {
    devicePixelRatio: 2,
    location: { search: "" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.requestAnimationFrame = (fn: (t: number) => void): number => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => void frames.delete(id);
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.performance = { now: () => clock };
  g.speechSynthesis = {
    getVoices: () => [{ lang: "zh-CN" }],
    speak: () => {},
    cancel: () => {},
  };
  g.SpeechSynthesisUtterance = class {
    lang = "";
    rate = 1;
    voice: unknown = null;
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  };
  return {
    root: new FakeEl("div"),
    flush(times = 1) {
      for (let i = 0; i < times; i++) {
        const due = [...frames.entries()];
        frames.clear();
        clock += 16;
        for (const [, fn] of due) fn(clock);
      }
    },
    restore() {
      g.document = saved.document;
      g.window = saved.window;
      g.requestAnimationFrame = saved.raf;
      g.cancelAnimationFrame = saved.caf;
      g.localStorage = saved.storage;
      g.performance = saved.perf;
      g.speechSynthesis = saved.synth;
      g.SpeechSynthesisUtterance = saved.utter;
    },
  };
}

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

/** 计划点名清零的那批字符,外加本步顺手摘掉的 HUD 杂项 emoji。 */
const BANNED = [
  "🔒", "👑", "⭐", "💗", "⚔", "💧", "☆", "▫", "🌙", "🚚", "🕳", "❄", "🌱", "☀",
  "🚩", "🧩", "⏱", "⚠", "💡", "🪏", "➕", "⏭",
];

describe("1.3 整局挂载:主页/地图/战场/结算的 emoji 清零", () => {
  it("从主页点到地图、开打再守到失败结算,所有 fillText 里一个点名 emoji 都没有", async () => {
    const h = install();
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({
      root: h.root as unknown as HTMLElement,
      play: () => {},
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
    } as never);
    h.flush(2);
    const canvas = findCanvas(h.root)!;
    const ctx = canvas.getContext("2d")!;

    // 主页 → 第一章 → 第一关 → 开打(坐标与 runtime.test 同一套版面,
    // 地图节点用 mapNodePoints 反推,别写死行距钳制前的老坐标)
    canvas.tap(60, 100);
    h.flush(2);
    const node1 = mapNodePoints(360, 720, themeSize(0))[0];
    canvas.tap(node1.x, node1.y);
    h.flush(2);
    canvas.tap(180, 360);
    h.flush(240);
    // 一株不种,守到虫虫进屋 → 失败结算面板也要扫到
    h.flush(3800);

    const all = ctx.drawnTexts.join("\n");
    // 先确认这几屏真的画过(不然「没有 emoji」是空断言)
    expect(all).toContain("绿芽保卫战 · 十三大花园");
    expect(all).toContain("第1章 · 阳光小院");
    expect(all).toContain("虫虫溜进小屋啦……");
    for (const emoji of BANNED) {
      expect(all, `渲染文本里仍有 ${emoji}`).not.toContain(emoji);
    }
    game.destroy();
  });
});
