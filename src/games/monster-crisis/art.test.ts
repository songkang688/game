/**
 * 1.3 视觉契约:小怪物危机的画面不许再退回「纯色圆贴脸 + 平涂描边 + ☁️ emoji」。
 *
 * 做法与 gold-hook 同款:给绘制函数塞一个**录制型** 2D context,把每一笔指令
 * (带当时的 fillStyle / strokeStyle / 渐变色标)记成字符串序列,对序列断言 ——
 *  - 序列不同 ⇔ 画面不同(五种怪形状语言互异、双人帽徽可分辨、罐子满空两态);
 *  - 序列里有 radGrad/linGrad ⇔ 真的用了渐变(平涂退休);
 *  - motion=false 时序列不随时间变 ⇔ 弱动效真的停了;
 *  - 粒子序列里查无 "☁️" 与 text 指令 ⇔ emoji 粒子清零。
 *
 * 玩法数值(reach/windup 语义、盾判定、波次罐子规则)不归本文件管,
 * 归 arena.test.ts 管 —— 本文件只看画面。
 */
import { describe, expect, it } from "vitest";
import {
  FAREWELL_TIME,
  HERO_SKINS,
  PAINTS,
  type HeroPose,
  drawBullet,
  drawCrumb,
  drawFarewell,
  drawHero,
  drawHome,
  drawMonster,
  drawParticle,
  drawScenery,
  drawSky,
  type ScenerySpec,
} from "./art";
import type { ArenaBullet, ArenaMonster, ArenaParticle, Behavior } from "./arena";

/* ---------------- 录制型 2D context ---------------- */

class RecCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
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
  rotate(a: number): void {
    this.log(`rotate:${this.n(a)}`);
  }
  clip(): void {
    this.log("clip");
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
  arc(x: number, y: number, r: number, a0 = 0, a1 = 0): void {
    this.log(`arc:${this.n(x)},${this.n(y)},${this.n(r)},${this.n(a0)},${this.n(a1)}`);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot = 0): void {
    this.log(`ellipse:${this.n(x)},${this.n(y)},${this.n(rx)},${this.n(ry)},${this.n(rot)}`);
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.log(`roundRect:${this.n(x)},${this.n(y)},${this.n(w)},${this.n(h)}`);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.log(`fillRect:${this.n(x)},${this.n(y)},${this.n(w)},${this.n(h)}@${String(this.fillStyle)}`);
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
    return { addColorStop: (o: number, col: string) => this.log(`stop:${o},${col}`) } as unknown as CanvasGradient;
  }
  createRadialGradient(): CanvasGradient {
    this.log("radGrad");
    return { addColorStop: (o: number, col: string) => this.log(`stop:${o},${col}`) } as unknown as CanvasGradient;
  }
}

function rec(draw: (c: CanvasRenderingContext2D) => void): string[] {
  const c = new RecCtx();
  draw(c as unknown as CanvasRenderingContext2D);
  return c.ops;
}

const seq = (ops: string[]): string => ops.join("|");
const fills = (ops: string[]): number => ops.filter((o) => o.startsWith("fill@")).length;
const texts = (ops: string[]): number => ops.filter((o) => o.startsWith("text:")).length;
const hasGrad = (ops: string[]): boolean => ops.includes("radGrad") || ops.includes("linGrad");

/* ---------------- 假对象工厂 ---------------- */

const BEHAVIORS: Behavior[] = ["rush", "weave", "spit", "summon", "elite"];

/** 同一个 kind(同色)只换 behavior:序列不同就只能是形状不同,证明形状语言还在。 */
function mon(behavior: Behavior, over: Partial<ArenaMonster> = {}): ArenaMonster {
  return {
    active: true,
    kind: "doodle",
    behavior,
    side: 0,
    x: 180,
    y: 120,
    fx: 1,
    fy: 0,
    hp: 7,
    maxHp: 7,
    shield: 0,
    shieldMax: 0,
    speed: 20,
    r: 11.5,
    phase: 1.2,
    timer: 1,
    summons: behavior === "summon" ? 3 : 0,
    boss: false,
    small: false,
    hitFlash: 0,
    blockFlash: 0,
    stagger: 0,
    ...over,
  };
}

function hero(idx: number, over: Partial<HeroPose> = {}): HeroPose {
  return { x: 200, y: 140, fx: 1, fy: 0, spin: 0, invuln: 0, windup: 0, shields: 0, idx, moving: false, ...over };
}

function particle(kind: ArenaParticle["kind"], over: Partial<ArenaParticle> = {}): ArenaParticle {
  // emoji 字段故意塞一个 ☁️:证明渲染器根本不再读它
  return { active: true, x: 120, y: 90, vx: 0, vy: 0, life: 0.5, maxLife: 1, kind, emoji: "☁️", ...over };
}

function bullet(foe: boolean): ArenaBullet {
  return { active: true, x: 150, y: 100, vx: 80, vy: 0, life: 1, dmg: 1, foe, side: 0, r: 4 };
}

function scenery(over: Partial<ScenerySpec> = {}): ScenerySpec {
  return { ground: "#dcefd0", scene: 0, versus: false, homes: [{ x: 180, y: 120 }], yard: 152, ...over };
}

const HEX = /^#[0-9a-f]{6}$/i;

/* ---------------- 一、五种怪:形状语言互异 + 材质化 ---------------- */

describe("1.3 五种怪物材质化", () => {
  it("五种 behavior 的绘制序列两两不同:同色只换行为,形状语言 1.2 原样保留", () => {
    const seqs = BEHAVIORS.map((b) => seq(rec((c) => drawMonster(c, mon(b), 1, false))));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${BEHAVIORS[i]} vs ${BEHAVIORS[j]}`).not.toBe(seqs[j]);
      }
    }
  });

  it("每种怪都有渐变体积(radGrad/linGrad),且指令数远超 1.2 平涂基线", () => {
    for (const b of BEHAVIORS) {
      const ops = rec((c) => drawMonster(c, mon(b), 1, false));
      expect(hasGrad(ops), b).toBe(true);
      expect(ops.length, b).toBeGreaterThan(30);
    }
  });

  it("弱动效契约:motion=false 时不同时刻画面一模一样,motion=true 时会动", () => {
    for (const b of BEHAVIORS) {
      const a = seq(rec((c) => drawMonster(c, mon(b), 0.4, false)));
      const z = seq(rec((c) => drawMonster(c, mon(b), 7.3, false)));
      expect(a, b).toBe(z);
    }
    const live1 = seq(rec((c) => drawMonster(c, mon("weave"), 0.5, true)));
    const live2 = seq(rec((c) => drawMonster(c, mon("weave"), 1.0, true)));
    expect(live1).not.toBe(live2);
  });

  it("精英盾弧还在:有盾画弧、掉光不画、挡下瞬间白闪并蹦碎盾(判定逻辑不动)", () => {
    const full = rec((c) => drawMonster(c, mon("elite", { shield: 4, shieldMax: 4 }), 1, false));
    const half = rec((c) => drawMonster(c, mon("elite", { shield: 2, shieldMax: 4 }), 1, false));
    const none = rec((c) => drawMonster(c, mon("elite", { shield: 0, shieldMax: 4 }), 1, false));
    expect(full).toContain("stroke@#9fd0ff");
    expect(none).not.toContain("stroke@#9fd0ff");
    // 弧长跟着剩余格走:满盾和半盾画出来的弧不一样
    expect(seq(full)).not.toBe(seq(half));
    const flash = rec((c) => drawMonster(c, mon("elite", { shield: 3, shieldMax: 4, blockFlash: 0.1 }), 1, true));
    expect(flash).toContain("stroke@#ffffff");
  });

  it("上色进度条:没挨过颜料头顶干干净净,被涂过才出彩虹条", () => {
    const clean = rec((c) => drawMonster(c, mon("rush"), 1, false));
    const painted = rec((c) => drawMonster(c, mon("rush", { hp: 3 }), 1, false));
    expect(clean.some((o) => o.startsWith("stop:0.35,#ffe08a"))).toBe(false);
    expect(painted.some((o) => o.startsWith("stop:0.35,#ffe08a"))).toBe(true);
    expect(seq(clean)).not.toBe(seq(painted));
  });

  it("被刷中除了闪一下还溅两粒粉颜料点", () => {
    const calmHit = rec((c) => drawMonster(c, mon("rush", { hitFlash: 0.1 }), 1, true));
    const noHit = rec((c) => drawMonster(c, mon("rush"), 1, true));
    expect(calmHit.filter((o) => o === "fill@#ff7fb4").length).toBeGreaterThanOrEqual(2);
    expect(seq(calmHit)).not.toBe(seq(noHit));
  });

  it("boss 皇冠还在,冠上多了一粒小宝石", () => {
    const boss = rec((c) => drawMonster(c, mon("rush", { boss: true, r: 20 }), 1, false));
    expect(boss).toContain("fill@#ffcf4d");
    expect(boss).toContain("fill@#ff8fb8");
  });
});

/* ---------------- 二、双英雄:小画家装与重画的刷子 ---------------- */

describe("1.3 双英雄小画家", () => {
  it("P1 与 P2 的绘制序列不同:粉帽花徽 vs 金帽星徽,不是换个 fillStyle 了事", () => {
    const a = rec((c) => drawHero(c, hero(0), 1, false));
    const b = rec((c) => drawHero(c, hero(1), 1, false));
    expect(seq(a)).not.toBe(seq(b));
  });

  it("皮肤表双通道可分辨:主色、帽色都不同,帽徽形状也不同(色弱可辨)", () => {
    const [a, b] = HERO_SKINS;
    for (const k of [a, b]) {
      expect(k.body).toMatch(HEX);
      expect(k.hat).toMatch(HEX);
      expect(k.apron).toMatch(HEX);
    }
    expect(a.body).not.toBe(b.body);
    expect(a.hat).not.toBe(b.hat);
    expect(a.badge).not.toBe(b.badge);
  });

  it("英雄有渐变体积,指令数远超 1.2 的「纯色圆贴脸」基线(旧 drawHero 约 25 条)", () => {
    const ops = rec((c) => drawHero(c, hero(0), 1, false));
    expect(hasGrad(ops)).toBe(true);
    expect(ops.length).toBeGreaterThan(40);
  });

  it("刷子是真道具:木柄双色 + 金属箍 + 三撮刷毛,前摇收 / 平时伸两态不同", () => {
    const idle = rec((c) => drawHero(c, hero(0), 1, false));
    expect(idle).toContain("fill@#a97e52");
    expect(idle).toContain("fill@#cfd6e4");
    expect(idle.filter((o) => o === "fill@#fffdf6").length).toBe(3);
    const windup = rec((c) => drawHero(c, hero(0, { windup: 0.2 }), 1, false));
    expect(seq(windup)).not.toBe(seq(idle));
  });

  it("甩出瞬间刷毛炸成 4 撮 + 一道角色色弧痕,0.2 秒后消失", () => {
    const swing = rec((c) => drawHero(c, hero(0), 1, true, 0.05));
    const after = rec((c) => drawHero(c, hero(0), 1, true, 0.5));
    const never = rec((c) => drawHero(c, hero(0), 1, true, 99));
    expect(swing.filter((o) => o === "fill@#fffdf6").length).toBe(4);
    expect(swing.some((o) => o.startsWith(`stroke@${HERO_SKINS[0].body}`))).toBe(true);
    expect(seq(swing)).not.toBe(seq(never));
    expect(seq(after)).toBe(seq(never));
  });

  it("奔跑两帧小脚交替;motion=false 时英雄完全静止", () => {
    const step1 = seq(rec((c) => drawHero(c, hero(0, { moving: true }), 0.06, true)));
    const step2 = seq(rec((c) => drawHero(c, hero(0, { moving: true }), 0.12, true)));
    expect(step1).not.toBe(step2);
    const still1 = seq(rec((c) => drawHero(c, hero(0, { moving: true }), 0.4, false)));
    const still2 = seq(rec((c) => drawHero(c, hero(0, { moving: true }), 9.7, false)));
    expect(still1).toBe(still2);
  });

  it("眩晕的黄点升级成四芒星(quad 曲线),护盾泡带高光点", () => {
    const dizzy = rec((c) => drawHero(c, hero(0, { spin: 1 }), 1, false));
    const sober = rec((c) => drawHero(c, hero(0), 1, false));
    expect(dizzy.filter((o) => o.startsWith("quad:")).length).toBeGreaterThan(sober.filter((o) => o.startsWith("quad:")).length);
    const shielded = rec((c) => drawHero(c, hero(0, { shields: 2 }), 1, false));
    expect(shielded.filter((o) => o === "fill@rgba(255,255,255,.9)").length).toBe(2);
  });

  it("r2 W4R1-02:剪影双通道——P2 尖顶帽高出 P1 贝雷进剪影,围裙 P1 圆摆 / P2 锯齿摆", () => {
    const HERO_R = 11;
    const a = rec((c) => drawHero(c, hero(0), 1, false));
    const b = rec((c) => drawHero(c, hero(1), 1, false));
    // 取全部路径指令的终点 y(局部坐标,身体圆心为原点),看谁的帽子伸得高
    const topY = (ops: string[]): number =>
      Math.min(
        ...ops
          .filter((o) => /^(moveTo|lineTo|quad):/.test(o))
          .map((o) => Number(o.slice(o.indexOf(":") + 1).split(",").pop())),
      );
    // P2 帽尖(含星揪揪)伸到 -1.4R 之上;P1 的路径点全都到不了——帽形本身可辨,不再只靠 2px 帽徽
    expect(topY(b)).toBeLessThan(-HERO_R * 1.4);
    expect(topY(a)).toBeGreaterThan(-HERO_R * 1.4);
    // P1 围裙走 roundRect 圆摆;P2 围裙是锯齿下摆(lineTo 至少多 8 条),重叠区灰度纹理不同
    const rr = (ops: string[]): number => ops.filter((o) => o.startsWith("roundRect:")).length;
    const lt = (ops: string[]): number => ops.filter((o) => o.startsWith("lineTo:")).length;
    expect(rr(a)).toBe(rr(b) + 1);
    expect(lt(b) - lt(a)).toBeGreaterThanOrEqual(8);
  });
});

/* ---------------- 三、家与场地 ---------------- */

describe("1.3 家与场地", () => {
  it("元气罐满 / 空两态不同:满罐粉色带心贴,空罐灰化还倒向一边(15°)", () => {
    const full = rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f"));
    const empty = rec((c) => drawHome(c, 180, 120, 0, 4, "#e6558f"));
    expect(seq(full)).not.toBe(seq(empty));
    expect(full).toContain("fill@#ff9ec4");
    expect(empty).not.toContain("fill@#ff9ec4");
    expect(empty).toContain("rotate:0.26");
    expect(empty.some((o) => o === "fill@#e7e1ee")).toBe(true);
  });

  it("判定圈虚线还在(孩子要看得见底线),房子有了门窗烟囱和渐变屋顶", () => {
    const ops = rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f"));
    expect(ops).toContain("dash:7,6");
    expect(ops).toContain("linGrad");
    // 圆窗:白底 + 窗棂
    expect(ops).toContain("fill@#fff8e6");
  });

  it("炊烟会飘,弱动效时定住", () => {
    const a = seq(rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f", 0.3, true)));
    const b = seq(rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f", 1.1, true)));
    expect(a).not.toBe(b);
    const s1 = seq(rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f", 0.3, false)));
    const s2 = seq(rec((c) => drawHome(c, 180, 120, 4, 4, "#e6558f", 1.1, false)));
    expect(s1).toBe(s2);
  });

  it("场景装饰查表:不同场景摆件不同;对战场地只画中线不摆件", () => {
    const s0 = rec((c) => drawScenery(c, 360, 240, scenery({ scene: 0 }), 1, false));
    const s4 = rec((c) => drawScenery(c, 360, 240, scenery({ scene: 4 }), 1, false));
    expect(seq(s0)).not.toBe(seq(s4));
    // 自家小院有圆树(树干木色);对战模式装饰让位给中线
    expect(s0).toContain("fill@#a97e52");
    const vs = rec((c) =>
      drawScenery(
        c,
        360,
        240,
        scenery({
          versus: true,
          yard: 108,
          homes: [
            { x: 90, y: 120 },
            { x: 270, y: 120 },
          ],
        }),
        1,
        false
      )
    );
    expect(vs).toContain("dash:9,7");
    expect(vs).not.toContain("fill@#a97e52");
  });

  it("天空是渐变加两朵定格白云,不再是一块平色", () => {
    const ops = rec((c) => drawSky(c, 360, 240, "#fff3f8"));
    expect(ops).toContain("linGrad");
    expect(fills(ops)).toBeGreaterThanOrEqual(6);
    expect(texts(ops)).toBe(0);
  });

  it("r2 B档TOP6:motion=true 两个 t 值云的位置不同;motion=false 完全一致", () => {
    const a = rec((c) => drawSky(c, 360, 240, "#fff3f8", 1, true));
    const b = rec((c) => drawSky(c, 360, 240, "#fff3f8", 9, true));
    expect(seq(a)).not.toBe(seq(b));
    const stillA = rec((c) => drawSky(c, 360, 240, "#fff3f8", 1, false));
    const stillB = rec((c) => drawSky(c, 360, 240, "#fff3f8", 9, false));
    expect(seq(stillA)).toBe(seq(stillB));
  });

  it("r2 B档TOP6:暖调天空挂太阳(径向光晕),冷调挂月牙+四粒星,两分支画得不同", () => {
    const warm = rec((c) => drawSky(c, 360, 240, "#fff6ec"));
    const cool = rec((c) => drawSky(c, 360, 240, "#eef7ff"));
    expect(warm).toContain("radGrad");
    expect(cool).not.toContain("radGrad");
    expect(seq(warm)).not.toBe(seq(cool));
    // 冷调的四粒星是 quad 曲线四芒星
    expect(cool.filter((o) => o.startsWith("quad:")).length).toBeGreaterThanOrEqual(16);
  });
});

/* ---------------- 四、子弹与粒子:☁️ 退休 ---------------- */

describe("1.3 子弹与粒子", () => {
  it("敌我子弹画法不同:我方渐变高光加拖尾,敌方冷色波动轮廓", () => {
    const mine = rec((c) => drawBullet(c, bullet(false), 1, true));
    const foe = rec((c) => drawBullet(c, bullet(true), 1, true));
    expect(seq(mine)).not.toBe(seq(foe));
    expect(mine).toContain("radGrad");
    expect(fills(mine)).toBeGreaterThanOrEqual(4);
    expect(foe.filter((o) => o.startsWith("lineTo:")).length).toBeGreaterThanOrEqual(10);
  });

  it("粒子渲染一个 ☁️ 都没有:emoji 字段塞了 ☁️ 也不会被画出来", () => {
    for (const kind of ["cloud", "ring", "spark"] as const) {
      const ops = rec((c) => drawParticle(c, particle(kind)));
      expect(texts(ops), kind).toBe(0);
      expect(seq(ops), kind).not.toContain("☁️");
      expect(ops.length, kind).toBeGreaterThan(0);
    }
  });

  it("蓬蓬云是三圆拼合的手绘云(≥6 次实心圆),随寿命膨胀", () => {
    const young = rec((c) => drawParticle(c, particle("cloud", { life: 0.9 })));
    const old = rec((c) => drawParticle(c, particle("cloud", { life: 0.2 })));
    expect(fills(young)).toBeGreaterThanOrEqual(6);
    expect(seq(young)).not.toBe(seq(old));
  });

  it("颜料溅点从单一粉色升级成五色粉彩盘", () => {
    for (const p of PAINTS) expect(p).toMatch(HEX);
    const ops = rec((c) => drawParticle(c, particle("spark")));
    expect(ops.some((o) => o.startsWith("fill@#"))).toBe(true);
    const used = ops.find((o) => o.startsWith("fill@#"));
    expect(PAINTS).toContain(used?.slice("fill@".length));
  });

  it("元气糖有糖纸小翅膀和渐变糖身", () => {
    const ops = rec((c) => drawCrumb(c, 100, 100, 1, false));
    expect(ops).toContain("radGrad");
    expect(fills(ops)).toBeGreaterThanOrEqual(3);
  });
});

/* ---------------- 五、涂满离场:开心变彩色 ---------------- */

describe("1.3 涂满离场演出", () => {
  it("离场怪是彩虹渐变的开心脸,跳一下随时间变化,演完就收", () => {
    const early = rec((c) => drawFarewell(c, { x: 100, y: 100, start: 0 }, 0.1, true));
    const late = rec((c) => drawFarewell(c, { x: 100, y: 100, start: 0 }, 0.3, true));
    expect(early).toContain("linGrad");
    // 眯眯眼开心笑:嘴是实心的
    expect(early).toContain("fill@#3d3350");
    expect(seq(early)).not.toBe(seq(late));
    const done = rec((c) => drawFarewell(c, { x: 100, y: 100, start: 0 }, FAREWELL_TIME + 0.1, true));
    expect(done.length).toBe(0);
  });

  it("弱动效:不跳不撒花,只淡出(还是开心的)", () => {
    const calm = rec((c) => drawFarewell(c, { x: 100, y: 100, start: 0 }, 0.1, false));
    const live = rec((c) => drawFarewell(c, { x: 100, y: 100, start: 0 }, 0.1, true));
    expect(calm.length).toBeGreaterThan(0);
    expect(calm.length).toBeLessThan(live.length);
    // 三粒颜料花只在有动效时撒
    expect(live.filter((o) => o.startsWith("quad:")).length).toBeGreaterThan(calm.filter((o) => o.startsWith("quad:")).length);
  });
});
