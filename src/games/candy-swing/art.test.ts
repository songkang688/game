/**
 * 糖果秋千 · 1.3 视觉契约（art.test.ts）。
 *
 * 规格（docs/plan-1.3-step12-B-candy-swing.md 第六节）点名的五条一条不少：
 *  1. 糖果绘制含渐变调用且螺旋纹路径点数 > 10（真螺旋，不是两段弧）；
 *  2. 星星填充含 createRadialGradient（不是纯色星）；
 *  3. 怪物渲染不再含 "💜" 字符（emoji 清零）；
 *  4. drawMonster 三段 eatStage 的绘制调用序列互不相同（演出保留）；
 *  5. 传送门入口 / 出口绘制颜色不同（可分辨）。
 *
 * 验法分三层：纯素材函数直接喂录音桩；index.ts 源码做结构断言；
 * 再把游戏真挂起来（domStub），录一帧真实绘制序列对照。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { FakeCtx, findOne, install, type Harness } from "./domStub";
import {
  BUBBLE_RAINBOW,
  CANDY_BODY_DEEP,
  CANDY_BODY_LIGHT,
  CANDY_WRAP,
  CANDY_WRAP_FOLD,
  MID_PARALLAX,
  MONSTER_DARK,
  MONSTER_EAR_INNER,
  MONSTER_LIGHT,
  PORTAL_IN_COLOR,
  PORTAL_OUT_COLOR,
  RESULT_STAR_POP,
  SNIP_FRAY_SEC,
  STAR_CORE,
  STAR_EDGE,
  STAR_RIM,
  type ArtCtx,
  candySpiralPoints,
  drawGoldStar,
  drawHeart,
  fluffOutline,
  monsterPose,
  starPath,
} from "./art";

const DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(join(DIR, "index.ts"), "utf8");
const ART_SRC = readFileSync(join(DIR, "art.ts"), "utf8");

/** 抠出 mount() 里某个绘制函数的源码体（到下一个同级 function 为止） */
function fnBody(name: string): string {
  const start = INDEX_SRC.indexOf(`function ${name}(`);
  expect(start, `index.ts 里找不到 function ${name}`).toBeGreaterThanOrEqual(0);
  const next = INDEX_SRC.indexOf("\n  function ", start + 1);
  return INDEX_SRC.slice(start, next < 0 ? undefined : next);
}

/** #rrggbb 的粗亮度（通道求和），比较「深一档」够用 */
function lum(hex: string): number {
  return parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
}

/** 录音桩：把 ArtCtx 的每一步都记下来 */
class ArtRecorder implements ArtCtx {
  ops: string[] = [];
  stops: Array<[number, string]> = [];
  lineWidths: number[] = [];
  lineJoin: unknown = "";
  globalAlpha = 1;
  private fillS: unknown = "";
  private strokeS: unknown = "";
  private lw = 0;

  get fillStyle(): unknown {
    return this.fillS;
  }
  set fillStyle(v: unknown) {
    this.fillS = v;
    this.ops.push("fillStyle");
  }
  get strokeStyle(): unknown {
    return this.strokeS;
  }
  set strokeStyle(v: unknown) {
    this.strokeS = v;
    this.ops.push("strokeStyle");
  }
  get lineWidth(): number {
    return this.lw;
  }
  set lineWidth(v: number) {
    this.lw = v;
    this.lineWidths.push(v);
  }
  beginPath(): void {
    this.ops.push("beginPath");
  }
  closePath(): void {
    this.ops.push("closePath");
  }
  moveTo(): void {
    this.ops.push("moveTo");
  }
  lineTo(): void {
    this.ops.push("lineTo");
  }
  quadraticCurveTo(): void {
    this.ops.push("quadraticCurveTo");
  }
  bezierCurveTo(): void {
    this.ops.push("bezierCurveTo");
  }
  arc(): void {
    this.ops.push("arc");
  }
  fill(): void {
    this.ops.push("fill");
  }
  stroke(): void {
    this.ops.push("stroke");
  }
  createLinearGradient(): { addColorStop: (o: number, c: string) => void } {
    this.ops.push("createLinearGradient");
    return { addColorStop: (o: number, c: string) => this.stops.push([o, c]) };
  }
  createRadialGradient(): { addColorStop: (o: number, c: string) => void } {
    this.ops.push("createRadialGradient");
    return { addColorStop: (o: number, c: string) => this.stops.push([o, c]) };
  }
  count(op: string): number {
    return this.ops.filter((o) => o === op).length;
  }
}

/* ================= 一、纯素材函数 ================= */

describe("candy-swing 1.3 视觉 · 纯素材函数", () => {
  it("糖果螺旋是真阿基米德螺线：点数 > 10、半径单调外扩、共 2.5 圈", () => {
    const pts = candySpiralPoints(13);
    expect(pts.length).toBeGreaterThan(10);
    let prev = -1;
    for (const p of pts) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = r;
    }
    // 收尾在最大半径上
    expect(Math.hypot(pts[pts.length - 1].x, pts[pts.length - 1].y)).toBeCloseTo(13);
    // 2.5 圈：终点角度 = 5π，即落在负 x 轴上
    expect(pts[pts.length - 1].x).toBeCloseTo(-13);
    expect(Math.abs(pts[pts.length - 1].y)).toBeLessThan(1e-6);
    // 半圈处（1.25 圈 = 2.5π）落在正 y 轴、半径一半
    const mid = pts[Math.floor(pts.length / 2)];
    expect(Math.abs(mid.x)).toBeLessThan(1e-6);
    expect(mid.y).toBeCloseTo(6.5);
  });

  it("怪物绒毛轮廓：12–16 段微锯齿，落点在椭圆上、绒毛控制点顶在椭圆外", () => {
    const segs = fluffOutline(32, 30, 14);
    expect(segs.length).toBeGreaterThanOrEqual(12);
    expect(segs.length).toBeLessThanOrEqual(16);
    for (const s of segs) {
      const onEllipse = (s.x / 32) ** 2 + (s.y / 30) ** 2;
      expect(onEllipse).toBeCloseTo(1);
      const ctrl = (s.cx / 32) ** 2 + (s.cy / 30) ** 2;
      expect(ctrl, "绒毛控制点要顶到椭圆外").toBeGreaterThan(1.0);
    }
  });

  it("monsterPose：catch / chew / happy 三段姿态互不相同（演出编排保留）", () => {
    const pCatch = monsterPose("catch", 0.1, 0.1);
    const pChew = monsterPose("chew", 0.35, 0.35);
    const pHappy = monsterPose("happy", 0.6, 0.6);
    expect(JSON.stringify(pCatch)).not.toBe(JSON.stringify(pChew));
    expect(JSON.stringify(pChew)).not.toBe(JSON.stringify(pHappy));
    expect(JSON.stringify(pCatch)).not.toBe(JSON.stringify(pHappy));
    // 各段的标志物：接住大张嘴 + 光环，咀嚼鼓腮，满足眯眼 + 爱心
    expect(pCatch.open).toBe(1);
    expect(pCatch.halo).not.toBeNull();
    expect(pCatch.heart).toBeNull();
    expect(pChew.open).toBeGreaterThanOrEqual(0.35);
    expect(pChew.open).toBeLessThanOrEqual(0.75);
    expect(pChew.cheek).toBeGreaterThan(5 - 1e-9);
    expect(pChew.eyes).toBe("round");
    expect(pHappy.open).toBe(0);
    expect(pHappy.eyes).toBe("smile");
    expect(pHappy.heart).not.toBeNull();
  });

  it("monsterPose：平时张嘴跟随实时 mouthOpenAmount（open = null），爱心 1.2s 后收场", () => {
    const idle = monsterPose("", 0, 3);
    expect(idle.open).toBeNull();
    expect(idle.halo).toBeNull();
    expect(idle.heart).toBeNull();
    expect(idle.bounce).toBe(0);
    expect(monsterPose("happy", 2, 1.3).heart).toBeNull();
    // 接住那一下往下沉（bounce 为负），到点归零
    expect(monsterPose("catch", 0, 0).bounce).toBeCloseTo(-4);
    expect(monsterPose("catch", 0.22, 0.22).bounce).toBeCloseTo(0);
  });

  it("drawGoldStar：金径向渐变 + 2px 深金描边 + 中心高光星（三层齐活）", () => {
    const rec = new ArtRecorder();
    drawGoldStar(rec, 100, 100, 13);
    expect(rec.count("createRadialGradient")).toBe(1);
    expect(rec.stops.map(([, c]) => c)).toContain(STAR_CORE);
    expect(rec.stops.map(([, c]) => c)).toContain(STAR_EDGE);
    expect(rec.count("fill"), "主星 + 高光星至少两次填充").toBeGreaterThanOrEqual(2);
    expect(rec.count("stroke"), "描边一次").toBeGreaterThanOrEqual(1);
    expect(rec.lineWidths).toContain(2);
    expect(rec.count("closePath"), "两条五角星路径").toBeGreaterThanOrEqual(2);
  });

  it("starPath：十顶点五角星（1 moveTo + 9 lineTo + closePath）", () => {
    const rec = new ArtRecorder();
    starPath(rec, 0, 0, 10);
    expect(rec.count("moveTo")).toBe(1);
    expect(rec.count("lineTo")).toBe(9);
    expect(rec.count("closePath")).toBe(1);
  });

  it("drawHeart：贝塞尔双瓣心形 + 紫粉渐变，绝无 fillText", () => {
    const rec = new ArtRecorder();
    drawHeart(rec, 50, 50, 8);
    expect(rec.count("bezierCurveTo")).toBe(2);
    expect(rec.count("fill")).toBe(1);
    expect(rec.count("createLinearGradient")).toBe(1);
    expect(rec.stops).toHaveLength(2);
    expect(rec.ops).not.toContain("fillText");
    // 心形是 bezierCurveTo 在本款素材里的唯一用户（真机契约靠它认爱心帧）
    const bezierCalls = [...ART_SRC.matchAll(/ctx\.bezierCurveTo\(/g)].length;
    expect(bezierCalls).toBe(2);
    expect(INDEX_SRC).not.toContain("ctx.bezierCurveTo(");
  });

  it("调色板契约：全部 #rrggbb、入口出口可分辨、糖纸比糖体深一档、金星里亮外深", () => {
    const palette = [
      CANDY_BODY_LIGHT, CANDY_BODY_DEEP, CANDY_WRAP, CANDY_WRAP_FOLD,
      MONSTER_LIGHT, MONSTER_DARK, MONSTER_EAR_INNER,
      STAR_CORE, STAR_EDGE, STAR_RIM,
      PORTAL_IN_COLOR, PORTAL_OUT_COLOR, ...BUBBLE_RAINBOW,
    ];
    for (const c of palette) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
    expect(PORTAL_IN_COLOR).not.toBe(PORTAL_OUT_COLOR);
    expect(lum(CANDY_WRAP), "糖纸要比糖体深一档").toBeLessThan(lum(CANDY_BODY_DEEP));
    expect(lum(CANDY_WRAP_FOLD), "褶皱线再深一档").toBeLessThan(lum(CANDY_WRAP));
    expect(lum(STAR_CORE), "金星中心亮、边缘深").toBeGreaterThan(lum(STAR_EDGE));
    expect(lum(STAR_RIM), "描边最深").toBeLessThan(lum(STAR_EDGE));
    expect(lum(MONSTER_LIGHT)).toBeGreaterThan(lum(MONSTER_DARK));
    expect(new Set(BUBBLE_RAINBOW).size, "彩虹分色不重样").toBe(BUBBLE_RAINBOW.length);
    expect(MID_PARALLAX).toBe(0.15);
    expect(RESULT_STAR_POP).toBe(0.3);
    expect(SNIP_FRAY_SEC).toBe(0.3);
  });
});

/* ================= 二、index.ts 源码结构 ================= */

describe("candy-swing 1.3 视觉 · index.ts 源码契约", () => {
  it("规格 1：drawCandy 含径向渐变 + 真螺旋（旧的两段弧删干净）", () => {
    const body = fnBody("drawCandy");
    expect(body).toContain("createRadialGradient");
    expect(body).toContain("CANDY_SPIRAL");
    expect(INDEX_SRC).toContain("const CANDY_SPIRAL = candySpiralPoints(");
    // 1.2 的假螺旋（两段弧）不许残留
    expect(body).not.toContain("CANDY_R * 0.62, 0.3, Math.PI * 1.2");
    expect(body).not.toContain("CANDY_R * 0.3, Math.PI, Math.PI * 2.1");
    // 糖纸褶皱与彩虹泡膜都接上
    expect(body).toContain("CANDY_WRAP_FOLD");
    expect(body).toContain("BUBBLE_RAINBOW");
  });

  it("规格 2：星星走金渐变素材（drawStar → drawGoldStar，含 createRadialGradient）", () => {
    expect(fnBody("drawStar")).toContain("drawGoldStar");
    const gold = ART_SRC.slice(ART_SRC.indexOf("export function drawGoldStar"));
    expect(gold).toContain("createRadialGradient");
    // 吸入时的 3 粒星屑尾迹（lessMotion 分支保留主星淡出）
    const stars = fnBody("drawStars");
    expect(stars).toContain("STAR_CORE");
    expect(stars).toContain("k <= 3");
    expect(stars).toContain("lessMotion");
  });

  it("规格 3：怪物渲染 emoji 清零——整份 index.ts 不再有 💜，drawMonster 无 fillText", () => {
    expect(INDEX_SRC).not.toContain("💜");
    const body = fnBody("drawMonster");
    expect(body).not.toContain("fillText");
    expect(body).toContain("drawHeart");
    expect(body).toContain("monsterPose");
    expect(body).toContain("MONSTER_FLUFF");
    expect(body).toContain("createRadialGradient");
    expect(body).toContain("MONSTER_EAR_INNER");
    // 爱心的 lessMotion 降级：原地只淡出
    expect(body).toMatch(/rise = lessMotion \? 0/);
  });

  it("规格 5：传送门入口 / 出口用两种颜色常量，lessMotion 有静止分支", () => {
    const body = fnBody("drawPortals");
    expect(body).toContain("PORTAL_IN_COLOR");
    expect(body).toContain("PORTAL_OUT_COLOR");
    expect(body).toContain("lessMotion ? 0");
    expect(body).toContain("createRadialGradient");
  });

  it("机关材质包落位：剪刀金属刃 + 散丝、风扇模糊弧、磁铁 / 尖刺 / 发条盘渐变", () => {
    const scissors = fnBody("drawScissors");
    expect(scissors).toContain("createLinearGradient");
    expect(scissors).toContain("SNIP_FRAY_SEC");
    expect(scissors).toMatch(/rgba\(255, 255, 255, .*sinceSnip/);
    const fans = fnBody("drawFans");
    expect(fans).toContain("const blur");
    expect(fans).toContain("!lessMotion");
    expect(fnBody("drawMagnets")).toContain("createLinearGradient");
    expect(fnBody("drawSpikes")).toContain("createLinearGradient");
    expect(fnBody("drawWinchAnchors")).toContain("createLinearGradient");
    expect(fnBody("drawSprings")).toContain("createLinearGradient");
    expect(fnBody("drawMushrooms")).toContain("createLinearGradient");
  });

  it("四主题中景层齐活，云层漂移按 MID_PARALLAX 打折", () => {
    for (const marker of ["MEADOW_FLOWERS", "NIGHT_RIDGE", "FACTORY_PIPES", "SKY_HAZE"]) {
      expect(INDEX_SRC).toContain(`const ${marker} = `);
      expect(fnBody("drawBackground")).toContain(marker);
    }
    expect(fnBody("drawBackground")).toContain("MID_PARALLAX");
  });

  it("结算仪式感：三星逐颗弹入常量接上，canvas 里 ⭐ / ⏱ emoji 清零，失败有哭脸", () => {
    const overlays = fnBody("drawOverlays");
    expect(overlays).toContain("RESULT_STAR_POP");
    expect(overlays).toContain("drawStar");
    expect(overlays).toContain("starPath");
    expect(INDEX_SRC).not.toContain('"⭐".repeat');
    expect(INDEX_SRC).not.toContain("⏱");
    // 失败哭脸：failLevel 记位置，drawCandy 短暂画一帧
    expect(INDEX_SRC).toContain("sadCandyAt = {");
    expect(fnBody("drawCandy")).toContain("sadCandyAt");
  });
});

/* ================= 三、真机渲染（domStub 挂起来录一帧） ================= */

interface Game {
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

interface FrameOp {
  m: string;
  args: unknown[];
}

interface Rec {
  ops: FrameOp[];
  on: { v: boolean };
}

let harness: Harness | null = null;
let game: Game | null = null;

afterEach(() => {
  game?.destroy();
  game = null;
  harness?.restore();
  harness = null;
});

/** 把挂载后拿到的 FakeCtx 换成会录音的版本（mount 持有的是同一个对象引用） */
function instrument(ctx: FakeCtx): Rec {
  const ops: FrameOp[] = [];
  const on = { v: false };
  const target = ctx as unknown as Record<string, unknown>;
  for (const k of Object.getOwnPropertyNames(FakeCtx.prototype)) {
    if (k === "constructor") continue;
    const orig = (FakeCtx.prototype as unknown as Record<string, unknown>)[k];
    if (typeof orig !== "function") continue;
    target[k] = (...args: unknown[]) => {
      if (on.v) ops.push({ m: k, args });
      return (orig as (...a: unknown[]) => unknown).apply(ctx, args);
    };
  }
  return { ops, on };
}

async function boot(opts: { reduceMotion?: boolean } = {}): Promise<{ h: Harness; g: Game; rec: Rec }> {
  const h = (harness = install(opts));
  const mod = await import("./index");
  const g = (game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    onWin: () => {},
    onLose: () => {},
  } as never) as unknown as Game);
  const canvas = findOne(h.root, "cs-canvas");
  expect(canvas, "挂载后画布该在").not.toBeNull();
  const rec = instrument(canvas!.getContext("2d")!);
  return { h, g, rec };
}

/** 录一帧：flush 之前打开录音，flush 之后关掉，返回序列化好的调用串 */
function captureFrame(h: Harness, rec: Rec): string {
  rec.ops.length = 0;
  rec.on.v = true;
  h.flush(1);
  rec.on.v = false;
  return rec.ops
    .map((o) => `${o.m}(${o.args.map((a) => (typeof a === "number" ? a.toFixed(1) : String(a))).join(",")})`)
    .join(";");
}

const EMOJI = /[⭐☆💜⏱✨🍬]/u;

function fillTexts(rec: Rec): string[] {
  return rec.ops.filter((o) => o.m === "fillText").map((o) => String(o.args[0]));
}

describe("candy-swing 1.3 视觉 · 真机渲染契约", () => {
  it("开局一帧：渐变素材真的在画（径向渐变 ≥ 3 处），canvas 文字无 emoji", async () => {
    const { h, g, rec } = await boot();
    g.openCampaignLevel(1);
    h.flush(3);
    const frame = captureFrame(h, rec);
    expect(frame.length).toBeGreaterThan(0);
    const radials = rec.ops.filter((o) => o.m === "createRadialGradient").length;
    expect(radials, "糖果 + 星星 + 怪物至少各一处径向渐变").toBeGreaterThanOrEqual(3);
    expect(rec.ops.filter((o) => o.m === "fill").length).toBeGreaterThan(40);
    for (const t of fillTexts(rec)) {
      expect(EMOJI.test(t), `canvas 文字里还有 emoji：${t}`).toBe(false);
    }
  });

  it("规格 4：三段 eatStage 的真实绘制序列互不相同，爱心只在满足段出现", async () => {
    const { h, g, rec } = await boot();
    g.openCampaignLevel(21); // 备案的零输入自进嘴关：不点一下就能等到吃糖演出
    const msg = findOne(h.root, "cs-msg")!;
    let won = false;
    for (let f = 0; f < 1400 && !won; f++) {
      h.flush(1);
      won = msg.textContent.includes("啾啾吃到糖果啦");
    }
    expect(won, "第 21 关等 22 秒还没进嘴").toBe(true);
    // 刚赢：eatShowT ≈ 0.03 → catch；+0.29s → chew；再 +0.22s → happy
    const catchFrame = captureFrame(h, rec);
    h.flush(17);
    const chewFrame = captureFrame(h, rec);
    h.flush(13);
    const happyFrame = captureFrame(h, rec);
    expect(catchFrame).not.toBe(chewFrame);
    expect(chewFrame).not.toBe(happyFrame);
    expect(catchFrame).not.toBe(happyFrame);
    // 爱心（bezierCurveTo 的唯一用户）只属于「满足」段
    expect(happyFrame).toContain("bezierCurveTo");
    expect(catchFrame).not.toContain("bezierCurveTo");
    expect(chewFrame).not.toContain("bezierCurveTo");
  });

  it("胜利结算：画的金星弹入代替 ⭐ 文字，结算板文字无 emoji", async () => {
    const { h, g, rec } = await boot();
    g.openCampaignLevel(21);
    const msg = findOne(h.root, "cs-msg")!;
    let won = false;
    for (let f = 0; f < 1400 && !won; f++) {
      h.flush(1);
      won = msg.textContent.includes("啾啾吃到糖果啦");
    }
    expect(won).toBe(true);
    h.flush(80); // 演出结束、结算板已亮、星星开始逐颗弹入
    const frame = captureFrame(h, rec);
    const texts = fillTexts(rec);
    expect(texts.some((t) => t.includes("过关啦"))).toBe(true);
    for (const t of texts) {
      expect(EMOJI.test(t), `结算板还有 emoji：${t}`).toBe(false);
    }
    expect(frame).toContain("createRadialGradient");
  });

  it("reduce-motion 冒烟：弱动效开关下照样一帧不落地画完", async () => {
    const { h, g, rec } = await boot({ reduceMotion: true });
    g.openCampaignLevel(1);
    h.flush(30);
    const frame = captureFrame(h, rec);
    expect(frame.length).toBeGreaterThan(0);
    expect(rec.ops.filter((o) => o.m === "fill").length).toBeGreaterThan(20);
  });
});
