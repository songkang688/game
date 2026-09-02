/**
 * 1.3 视觉契约:花园守卫不许再退回「草稿塔防」。
 *
 * 做法与 gold-hook 的 art.test 同一路数:给每个绘制函数塞一个**录制型**
 * 2D context,把每一笔指令(带当时的 fillStyle / strokeStyle)记成字符串序列——
 *  - 序列不同 ⇔ 画面不同(八塔互异、1 级 vs 3 级、走路两帧);
 *  - 序列里没有 `text:` ⇔ 这件资产是真的画出来的,不是贴 emoji;
 *  - 同参数两次序列一致 ⇔ 装饰按坐标种子确定,不会每帧乱闪。
 *
 * 任务点名的五条全在这儿:塔升级视觉、💗/🔒/👑/⚔ 清零、
 * 地图星为渐变路径而非 ⭐、战场含草叶装饰、多塔可分辨。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HORIZON_KIND,
  MONSTER_COLORS,
  NODE_DECOR,
  drawBarricade,
  drawBulbIcon,
  drawBullet,
  drawCrownIcon,
  drawFootprintTrail,
  drawGoldStar,
  drawHealHalo,
  drawHeartIcon,
  drawHorizonStrip,
  drawLockIcon,
  drawMapScrollIcon,
  drawMonsterSprite,
  drawNodeDecor,
  drawPetalIcon,
  drawShieldIcon,
  drawSwordsIcon,
  drawThemeBadge,
  drawTileDecor,
  drawTileDoodad,
  drawTileGrass,
  drawTowerIcon,
  drawVineArch,
  goalMood,
  tileHash,
  towerLevelScale,
  bossTrimOf,
  type BulletArtKind,
  type MonsterVisual,
} from "./art";
import { THEME_ORDER, TOWER_KINDS, type MonsterKind } from "./logic";

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
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.log(`ellipse:${this.n(x)},${this.n(y)},${this.n(rx)},${this.n(ry)}`);
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.log(`roundRect:${this.n(x)},${this.n(y)},${this.n(w)},${this.n(h)}`);
  }
  rect(): void {
    this.log("rect");
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
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
  createRadialGradient(): CanvasGradient {
    this.log("radGrad");
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
}

function rec(draw: (ctx: CanvasRenderingContext2D) => void): string[] {
  const ctx = new RecCtx();
  draw(ctx as unknown as CanvasRenderingContext2D);
  return ctx.ops;
}

function baseVisual(kind: MonsterKind, over: Partial<MonsterVisual> = {}): MonsterVisual {
  return {
    kind,
    x: 100,
    y: 100,
    r: 14,
    wob: 1.2,
    hidden: false,
    flying: false,
    dashing: false,
    enraged: false,
    slowed: false,
    armor: 0,
    maxArmor: 0,
    hpRatio: 1,
    hurtFlash: 0,
    healPhase: 0.35,
    walk: 0,
    ...over,
  };
}

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/* ---------------- ① 塔:升级视觉与八塔互异 ---------------- */

describe("garden-guard 1.3 · 塔的升级视觉", () => {
  it("1 级与 3 级的绘制调用序列不同(升级看得见)", () => {
    for (const kind of TOWER_KINDS) {
      const l1 = rec((c) => drawTowerIcon(c, kind, 50, 50, 15, 1));
      const l3 = rec((c) => drawTowerIcon(c, kind, 50, 50, 15, 3));
      expect(l3.join("|"), `${kind} 升到 3 级画面没变化`).not.toBe(l1.join("|"));
    }
  });

  it("体型加成 1 < 1.08 < 1.15,只作用于视觉参数", () => {
    expect(towerLevelScale(1)).toBe(1);
    expect(towerLevelScale(2)).toBeCloseTo(1.08);
    expect(towerLevelScale(3)).toBeCloseTo(1.15);
  });

  it("2 级戴银叶环,3 级换金叶环并顶小金星(金星带渐变)", () => {
    const l1 = rec((c) => drawTowerIcon(c, "bubble", 50, 50, 15, 1));
    const l2 = rec((c) => drawTowerIcon(c, "bubble", 50, 50, 15, 2));
    const l3 = rec((c) => drawTowerIcon(c, "bubble", 50, 50, 15, 3));
    expect(l1.some((op) => op === "fill@#c8ccd8" || op === "fill@#f2c24e")).toBe(false);
    expect(l2).toContain("fill@#c8ccd8");
    expect(l3).toContain("fill@#f2c24e");
    // 3 级头顶小星与地图星同规格:金渐变
    expect(l3.filter((op) => op === "linGrad").length).toBeGreaterThan(l1.filter((op) => op === "linGrad").length);
  });

  it("八种塔(含 1.2 新塔铃兰铃)绘制序列两两互异,可分辨性钉死", () => {
    const seqs = TOWER_KINDS.map((kind) => rec((c) => drawTowerIcon(c, kind, 50, 50, 15)).join("|"));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${TOWER_KINDS[i]} 和 ${TOWER_KINDS[j]} 画得一模一样`).not.toBe(seqs[j]);
      }
    }
  });

  it("发射瞬间有白闪与后坐,弱动效时两样都关", () => {
    const idle = rec((c) => drawTowerIcon(c, "needle", 50, 50, 15, 1, 0));
    const firing = rec((c) => drawTowerIcon(c, "needle", 50, 50, 15, 1, 1));
    const calm = rec((c) => drawTowerIcon(c, "needle", 50, 50, 15, 1, 1, true));
    expect(firing.join("|")).not.toBe(idle.join("|"));
    expect(firing.some((op) => op.includes("rgba(255,255,255,0.550"))).toBe(true);
    expect(calm.some((op) => op.includes("rgba(255,255,255,0.550"))).toBe(false);
    expect(calm.join("|")).not.toBe(firing.join("|"));
  });

  it("泡泡塔吐泡瞬间嘴巴张成 O 形", () => {
    const idle = rec((c) => drawTowerIcon(c, "bubble", 50, 50, 15, 1, 0));
    const firing = rec((c) => drawTowerIcon(c, "bubble", 50, 50, 15, 1, 0.6, true));
    // O 嘴是一个完整圆弧(0..2π),平时的笑是一段弧
    const fullCircleMouth = (ops: string[]) => ops.filter((op) => op.startsWith("arc:") && op.endsWith("0.00,6.28")).length;
    expect(fullCircleMouth(firing)).toBeGreaterThan(fullCircleMouth(idle));
  });
});

/* ---------------- ② 怪物:emoji 清零与新演出 ---------------- */

describe("garden-guard 1.3 · 怪物渲染", () => {
  it("回血怪不再贴 💗:整只怪零 fillText,心形光环是两圆一三角拼出来的", () => {
    const ops = rec((c) => drawMonsterSprite(c, baseVisual("healy")));
    expect(ops.some((op) => op.startsWith("text:"))).toBe(false);
    expect(ops.join("|")).not.toContain("💗");
    // 中心实心小心:粉色填充
    expect(ops).toContain("fill@#ff8aa8");
  });

  it("心形光环相位不同画面不同,同相位两次一致(弱动效可静止)", () => {
    const p1 = rec((c) => drawHealHalo(c, 50, 50, 10, 0.2)).join("|");
    const p2 = rec((c) => drawHealHalo(c, 50, 50, 10, 0.7)).join("|");
    const p1again = rec((c) => drawHealHalo(c, 50, 50, 10, 0.2)).join("|");
    expect(p1).not.toBe(p2);
    expect(p1again).toBe(p1);
  });

  it("地面怪走路两粒脚点交替(相位差 π),飞怪不受走路相位影响", () => {
    const stand = rec((c) => drawMonsterSprite(c, baseVisual("softy", { walk: 0 }))).join("|");
    const step = rec((c) => drawMonsterSprite(c, baseVisual("softy", { walk: Math.PI / 2 }))).join("|");
    expect(step).not.toBe(stand);
    const flyA = rec((c) => drawMonsterSprite(c, baseVisual("flappy", { flying: true, walk: 0 }))).join("|");
    const flyB = rec((c) => drawMonsterSprite(c, baseVisual("flappy", { flying: true, walk: Math.PI / 2 }))).join("|");
    expect(flyB).toBe(flyA);
  });

  it("受击白闪:hurtFlash>0 时整只泛白一层,0 时(弱动效)没有", () => {
    const calm = rec((c) => drawMonsterSprite(c, baseVisual("softy")));
    const hurt = rec((c) => drawMonsterSprite(c, baseVisual("softy", { hurtFlash: 1 })));
    const flashOp = (ops: string[]) => ops.some((op) => op.startsWith("fill@rgba(255,255,255,0.6"));
    expect(flashOp(hurt)).toBe(true);
    expect(flashOp(calm)).toBe(false);
  });

  it("每种怪主色齐全且互不相同的家族仍可分辨(抽查六种小怪序列互异)", () => {
    const kinds: MonsterKind[] = ["softy", "fasty", "tanky", "splity", "sneaky", "healy"];
    const seqs = kinds.map((k) => rec((c) => drawMonsterSprite(c, baseVisual(k))).join("|"));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${kinds[i]} 和 ${kinds[j]} 画得一模一样`).not.toBe(seqs[j]);
      }
    }
    for (const k of kinds) expect(MONSTER_COLORS[k]).toMatch(/^#[0-9a-f]{6}$/);
  });

  // ---- r2 修复 B档TOP10:BOSS 家族剪影配饰 ----
  const ALL_BOSSES: MonsterKind[] = [
    "boss1", "boss2", "boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9",
    "boss10", "boss11", "boss12", "boss13", "bossArmor", "bossSwift", "bossFly", "bossSplit",
  ];
  /** 把颜色从指令里剥掉,只留几何——学习员点的正是「剪影只差颜色」 */
  const geomOf = (k: MonsterKind): string =>
    rec((c) => drawMonsterSprite(c, baseVisual(k)))
      .map((op) => op.replace(/@.*$/, ""))
      .join("|");

  it("BOSS 配饰查表:四位原型各归各家,十三章按最近原型套用,四家都不空;小怪一律 none", () => {
    expect(bossTrimOf("bossArmor")).toBe("plate");
    expect(bossTrimOf("bossSwift")).toBe("feather");
    expect(bossTrimOf("bossFly")).toBe("cloud");
    expect(bossTrimOf("bossSplit")).toBe("ring");
    const fam = new Map<string, number>();
    for (const k of ALL_BOSSES) fam.set(bossTrimOf(k), (fam.get(bossTrimOf(k)) ?? 0) + 1);
    for (const f of ["plate", "feather", "cloud", "ring"]) {
      expect(fam.get(f) ?? 0, `${f} 家没有一位 BOSS`).toBeGreaterThanOrEqual(2);
    }
    // 净版只剩大软软(元祖)与泥泥大王(自带回血光环,已可分辨)
    expect(ALL_BOSSES.filter((k) => bossTrimOf(k) === "none")).toEqual(["boss1", "boss5"]);
    for (const k of ["softy", "fasty", "tanky", "splity", "sneaky", "healy", "mini"] as MonsterKind[]) {
      expect(bossTrimOf(k), `小怪 ${k} 不该有 BOSS 配饰`).toBe("none");
    }
  });

  it("五家代表剥掉颜色后几何序列两两互异(皇冠保留为通用标识)", () => {
    const reps: MonsterKind[] = ["boss1", "bossArmor", "bossSwift", "bossFly", "bossSplit"];
    const seqs = reps.map(geomOf);
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${reps[i]} 与 ${reps[j]} 剥色后剪影一样`).not.toBe(seqs[j]);
      }
    }
    // 皇冠(金色填充)每位 BOSS 都还在
    for (const k of ALL_BOSSES) {
      const ops = rec((c) => drawMonsterSprite(c, baseVisual(k)));
      expect(ops.join("|"), `${k} 的皇冠丢了`).toContain("fill@#ffd868");
    }
  });

  it("配饰真画在轮廓外:护板两块圆角矩形、分裂环带虚线两遍描边、云座在身体渐变之前多三个圆、速度羽三片曲线", () => {
    const plate = rec((c) => drawMonsterSprite(c, baseVisual("bossArmor")));
    expect(plate.filter((op) => op.startsWith("roundRect")).length).toBeGreaterThanOrEqual(2);
    const ring = rec((c) => drawMonsterSprite(c, baseVisual("bossSplit")));
    expect(ring.some((op) => op.startsWith("dash:") && op !== "dash:")).toBe(true);
    expect(ring.filter((op) => op.startsWith("stroke@rgba(255,255,255"))).not.toHaveLength(0);
    const arcsBeforeBody = (ops: string[]): number =>
      ops.slice(0, ops.indexOf("radGrad")).filter((op) => op.startsWith("arc:")).length;
    // 无配饰 BOSS 身体渐变前只有两粒脚点;云座 BOSS 多出三个圆拱
    expect(arcsBeforeBody(rec((c) => drawMonsterSprite(c, baseVisual("bossFly"))))).toBe(
      arcsBeforeBody(rec((c) => drawMonsterSprite(c, baseVisual("boss1")))) + 3,
    );
    const feather = rec((c) => drawMonsterSprite(c, baseVisual("bossSwift")));
    const quadsBeforeBody = feather
      .slice(0, feather.indexOf("radGrad"))
      .filter((op) => op.startsWith("quad:")).length;
    expect(quadsBeforeBody).toBeGreaterThanOrEqual(6);
    // 蟹蟹将军钳子保留,同时穿上铁壳护板
    const crab = rec((c) => drawMonsterSprite(c, baseVisual("boss2")));
    expect(crab.filter((op) => op.startsWith("roundRect")).length).toBeGreaterThanOrEqual(2);
    expect(crab.join("|")).toContain("stroke@#d0885a");
  });
});

/* ---------------- ③ 关卡地图:去 emoji、渐变星、主题装饰 ---------------- */

describe("garden-guard 1.3 · 关卡地图", () => {
  it("index.ts 源码里 💗/🔒/👑/⚔/⭐/☆/▫ 全部清零(HUD 爱心是 hud12 旧契约,不在此列)", () => {
    for (const glyph of ["💗", "🔒", "👑", "⚔", "⭐", "☆", "▫"]) {
      expect(indexSrc.includes(glyph), `index.ts 里还有 ${glyph}`).toBe(false);
    }
  });

  it("挂锁 / 王冠 / 双剑是路径绘制:有填充、零 fillText", () => {
    for (const [name, ops] of [
      ["lock", rec((c) => drawLockIcon(c, 50, 50, 12))],
      ["crown", rec((c) => drawCrownIcon(c, 50, 50, 12))],
      ["swords", rec((c) => drawSwordsIcon(c, 50, 50, 12))],
    ] as const) {
      expect(ops.length, `${name} 什么都没画`).toBeGreaterThan(3);
      expect(ops.some((op) => op.startsWith("fill@")), `${name} 没有填充`).toBe(true);
      expect(ops.some((op) => op.startsWith("text:")), `${name} 还在贴字符`).toBe(false);
    }
    // 王冠是金渐变的
    expect(rec((c) => drawCrownIcon(c, 50, 50, 12))).toContain("linGrad");
  });

  it("地图星级是含渐变的路径绘制,不是 ⭐ 字符;实心星与空星画面不同", () => {
    const filled = rec((c) => drawGoldStar(c, 50, 50, 10, true));
    const hollow = rec((c) => drawGoldStar(c, 50, 50, 10, false));
    expect(filled).toContain("linGrad");
    expect(filled.some((op) => op.startsWith("text:"))).toBe(false);
    expect(filled.filter((op) => op.startsWith("lineTo")).length).toBeGreaterThanOrEqual(9);
    expect(hollow.join("|")).not.toBe(filled.join("|"));
    expect(hollow).not.toContain("linGrad");
  });

  it("连线改小脚印路径:沿线交替左右脚的小椭圆", () => {
    const ops = rec((c) =>
      drawFootprintTrail(c, [{ x: 0, y: 0 }, { x: 100, y: 0 }], 15, "rgba(120,110,90,0.45)"),
    );
    const prints = ops.filter((op) => op.startsWith("ellipse:"));
    expect(prints.length).toBeGreaterThanOrEqual(4);
    // 交替:相邻两枚脚印分别偏在路径两侧
    const ys = prints.map((op) => Number(op.split(":")[1].split(",")[1]));
    expect(ys[0]).not.toBe(ys[1]);
    expect(ys[0]).toBe(ys[2]);
  });

  it("十三章都有地平线剪影与节点装饰查表,剪影真的画得出东西", () => {
    for (const theme of THEME_ORDER) {
      expect(HORIZON_KIND[theme], `${theme} 没配地平线`).toBeTruthy();
      expect(NODE_DECOR[theme] !== undefined, `${theme} 没配节点装饰`).toBe(true);
      const ops = rec((c) => drawHorizonStrip(c, 360, 500, 30, HORIZON_KIND[theme], "#4a9a5a"));
      expect(ops.length, `${theme} 的剪影是空的`).toBeGreaterThan(2);
    }
    // 雪帽、叶环、小星三种装饰画面互不相同
    const leaf = rec((c) => drawNodeDecor(c, 50, 50, 14, "leaf")).join("|");
    const snow = rec((c) => drawNodeDecor(c, 50, 50, 14, "snowcap")).join("|");
    const spark = rec((c) => drawNodeDecor(c, 50, 50, 14, "sparkle")).join("|");
    expect(new Set([leaf, snow, spark]).size).toBe(3);
  });

  it("index.ts 真把这些地图资产接上了(不是画了没人用)", () => {
    for (const fn of ["drawLockIcon(", "drawCrownIcon(", "drawSwordsIcon(", "drawGoldStar(", "drawFootprintTrail(", "drawHorizonStrip(", "drawNodeDecor("]) {
      expect(indexSrc.includes(fn), `index.ts 没调用 ${fn}`).toBe(true);
    }
  });
});

/* ---------------- ④ 战场:草叶装饰与花园地块 ---------------- */

describe("garden-guard 1.3 · 战场地块", () => {
  it("地块装饰含草叶(两笔弧线),不再是纯棋盘格", () => {
    const ops: string[] = [];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 9; c++) {
        ops.push(...rec((ctx) => drawTileDecor(ctx, c, r, c * 48, r * 48, 48, "#4a9a5a")));
      }
    }
    expect(ops.some((op) => op === "stroke@rgba(106,168,94,0.45)")).toBe(true);
    expect(ops.filter((op) => op.startsWith("quad:")).length).toBeGreaterThanOrEqual(4);
  });

  it("约 8% 的格子有小花小石头装饰:有但不喧宾夺主", () => {
    let decorated = 0;
    const total = 40 * 40;
    for (let r = 0; r < 40; r++) {
      for (let c = 0; c < 40; c++) {
        const ops = rec((ctx) => drawTileDoodad(ctx, 0, 0, 48, tileHash(c, r), "#4a9a5a"));
        if (ops.length > 0) decorated++;
      }
    }
    expect(decorated / total).toBeGreaterThan(0.02);
    expect(decorated / total).toBeLessThan(0.2);
  });

  it("装饰按坐标种子确定:同一格两次绘制序列一致,不会每帧乱闪", () => {
    expect(tileHash(3, 4)).toBe(tileHash(3, 4));
    expect(tileHash(3, 4)).not.toBe(tileHash(4, 3));
    const a = rec((c) => drawTileDecor(c, 5, 2, 240, 96, 48, "#4a9a5a")).join("|");
    const b = rec((c) => drawTileDecor(c, 5, 2, 240, 96, 48, "#4a9a5a")).join("|");
    expect(a).toBe(b);
    expect(rec((c) => drawTileGrass(c, 0, 0, 48, 1, "#000")).join("|")).toBe(
      rec((c) => drawTileGrass(c, 0, 0, 48, 1, "#000")).join("|"),
    );
  });

  it("起点是藤蔓拱门(双柱 + 弧顶 + 叶子),终点花芯表情随生命变化", () => {
    const arch = rec((c) => drawVineArch(c, 50, 50, 48));
    expect(arch.filter((op) => op.startsWith("roundRect")).length).toBeGreaterThanOrEqual(2);
    expect(arch.some((op) => op === "stroke@#7ab86a")).toBe(true);
    expect(goalMood(5, 5)).toBe("happy");
    expect(goalMood(3, 5)).toBe("worried");
    expect(goalMood(1, 5)).toBe("sad");
    expect(indexSrc.includes("drawVineArch(")).toBe(true);
    expect(indexSrc.includes("goalMood(")).toBe(true);
  });

  it("路障木箱有木纹层,耐久点数随血量变", () => {
    const hp1 = rec((c) => drawBarricade(c, 50, 50, 48, 1));
    const hp3 = rec((c) => drawBarricade(c, 50, 50, 48, 3));
    expect(hp1.some((op) => op === "stroke@rgba(255,246,222,0.5)")).toBe(true);
    expect(hp3.filter((op) => op.startsWith("arc:")).length).toBeGreaterThan(hp1.filter((op) => op.startsWith("arc:")).length);
  });
});

/* ---------------- ⑤ 子弹与特效 ---------------- */

describe("garden-guard 1.3 · 子弹分型", () => {
  it("泡泡 / 针刺 / 花火 / 冰星四种子弹绘制序列两两互异", () => {
    const kinds: BulletArtKind[] = ["bubble", "needle", "boom", "frost"];
    const seqs = kinds.map((k) => rec((c) => drawBullet(c, k, 50, 50, 48, 0.5, 0.3)).join("|"));
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${kinds[i]} 和 ${kinds[j]} 的子弹一模一样`).not.toBe(seqs[j]);
      }
    }
  });

  it("针刺弹带拖尾,泡泡弹是半透明泡 + 高光", () => {
    const needle = rec((c) => drawBullet(c, "needle", 50, 50, 48, 0.5, 0));
    expect(needle.some((op) => op === "stroke@rgba(122,178,142,0.4)")).toBe(true);
    const bubble = rec((c) => drawBullet(c, "bubble", 50, 50, 48, 0, 0));
    expect(bubble.some((op) => op.startsWith("fill@rgba(191,233,255"))).toBe(true);
    expect(bubble.some((op) => op.startsWith("fill@rgba(255,255,255"))).toBe(true);
  });

  it("冰星弹随时间旋转;弱动效传 0 时静止(序列可复现)", () => {
    const t0 = rec((c) => drawBullet(c, "frost", 50, 50, 48, 0, 0)).join("|");
    const t1 = rec((c) => drawBullet(c, "frost", 50, 50, 48, 0, 0.3)).join("|");
    expect(t0).not.toBe(t1);
    expect(rec((c) => drawBullet(c, "frost", 50, 50, 48, 0, 0)).join("|")).toBe(t0);
  });
});

/* ---------------- ⑤ r1 监督修复:画布层 emoji 直出清零 ---------------- */

describe("garden-guard 1.3 r1 · 画布 emoji 清零(浮字花瓣币/标题徽章/主题徽章)", () => {
  it("index.ts 源码里 🌸/🌼/💡/🛡/🗺/⚡ 与 .emoji 插值全部清零", () => {
    for (const glyph of ["🌸", "🌼", "💡", "🛡", "🗺", "⚡"]) {
      expect(indexSrc.includes(glyph), `index.ts 里还有 ${glyph}`).toBe(false);
    }
    expect(indexSrc).not.toMatch(/\.emoji/);
  });

  it("花瓣币是含径向渐变的路径绘制(五瓣 + 花芯),零 fillText", () => {
    const ops = rec((c) => drawPetalIcon(c, 50, 50, 8));
    expect(ops.length).toBeGreaterThan(10);
    expect(ops).toContain("radGrad");
    expect(ops.filter((op) => op.startsWith("ellipse:")).length, "五片花瓣").toBe(5);
    expect(ops.some((op) => op.startsWith("text:"))).toBe(false);
  });

  it("十三章主题徽章两两互异、全是路径绘制,零 fillText", () => {
    const seqs = THEME_ORDER.map((t) => rec((c) => drawThemeBadge(c, 50, 50, 12, t)));
    for (const [i, ops] of seqs.entries()) {
      expect(ops.length, `${THEME_ORDER[i]} 徽章什么都没画`).toBeGreaterThan(3);
      expect(ops.some((op) => op.startsWith("text:")), `${THEME_ORDER[i]} 还在贴字符`).toBe(false);
    }
    const joined = seqs.map((ops) => ops.join("|"));
    for (let i = 0; i < joined.length; i++) {
      for (let j = i + 1; j < joined.length; j++) {
        expect(joined[i], `${THEME_ORDER[i]} 和 ${THEME_ORDER[j]} 的徽章一模一样`).not.toBe(joined[j]);
      }
    }
  });

  it("灯泡 / 盾牌 / 地图卷轴图标都是绘制资产:有填充有渐变,零 fillText", () => {
    for (const [name, ops] of [
      ["bulb", rec((c) => drawBulbIcon(c, 50, 50, 8))],
      ["shield", rec((c) => drawShieldIcon(c, 50, 50, 12))],
      ["mapScroll", rec((c) => drawMapScrollIcon(c, 50, 50, 12))],
    ] as const) {
      expect(ops.length, `${name} 什么都没画`).toBeGreaterThan(4);
      expect(ops.some((op) => op.startsWith("fill@")), `${name} 没有填充`).toBe(true);
      expect(ops.some((op) => op.startsWith("text:")), `${name} 还在贴字符`).toBe(false);
    }
    expect(rec((c) => drawShieldIcon(c, 50, 50, 12))).toContain("linGrad");
    // 卷轴上的小路是虚线,别退化成实线
    expect(rec((c) => drawMapScrollIcon(c, 50, 50, 12)).some((op) => op.startsWith("dash:"))).toBe(true);
  });

  it("徽章同参数两次序列一致(确定性,不会每帧乱闪)", () => {
    for (const t of THEME_ORDER) {
      const a = rec((c) => drawThemeBadge(c, 50, 50, 12, t)).join("|");
      const b = rec((c) => drawThemeBadge(c, 50, 50, 12, t)).join("|");
      expect(a).toBe(b);
    }
  });
});

/* ---------------- ⑦ r2:hud12 段串的绘制层替换(W4R1-01) ---------------- */

describe("garden-guard 1.3 r2 · 战内 HUD 花瓣/爱心手绘化(hud12 契约不动)", () => {
  it("实心爱心是渐变路径绘制:双弧顶 + 高光,零 fillText", () => {
    const ops = rec((c) => drawHeartIcon(c, 50, 50, 8, true));
    expect(ops).toContain("radGrad");
    expect(ops.filter((op) => op.startsWith("arc:")).length, "两片圆顶").toBeGreaterThanOrEqual(2);
    expect(ops.filter((op) => op.startsWith("quad:")).length, "两侧下摆曲线").toBeGreaterThanOrEqual(2);
    expect(ops.some((op) => op.startsWith("stroke@"))).toBe(true);
    expect(ops.some((op) => op.startsWith("ellipse:")), "左上高光").toBe(true);
    expect(ops.some((op) => op.startsWith("text:"))).toBe(false);
  });

  it("空心爱心与实心序列不同:无渐变无高光,灰粉平涂 + 描边", () => {
    const filled = rec((c) => drawHeartIcon(c, 50, 50, 8, true));
    const empty = rec((c) => drawHeartIcon(c, 50, 50, 8, false));
    expect(empty.join("|")).not.toBe(filled.join("|"));
    expect(empty).not.toContain("radGrad");
    expect(empty.some((op) => op.startsWith("fill@#e"))).toBe(true);
    expect(empty.some((op) => op.startsWith("text:"))).toBe(false);
  });

  it("drawHud 三段与原因句/说明条都走 token 渲染,不再把段串原样 fillText", () => {
    // hud12 的段串契约(💗×N / 🌸 N)一字未动;index.ts 只在绘制层拆 token
    expect(indexSrc).toMatch(/drawHudRichText\(layout\.segments\.left/);
    expect(indexSrc).toMatch(/drawHudRichText\(layout\.segments\.center/);
    expect(indexSrc).toMatch(/drawHudRichText\(layout\.segments\.right/);
    expect(indexSrc).not.toMatch(/fillText\(layout\.segments\./);
    expect(indexSrc).toMatch(/drawHudRichText\(reason/);
    expect(indexSrc).toMatch(/drawHudRichText\(tip/);
  });

  it("token 渲染器:emoji 槽位映射到手绘图标,槽宽系数与 hud12 宽度估算一致", () => {
    // 码点常量对上 hud12 里的 🌸/💗/🤍;槽宽 1.15×字号 = estimateTextWidth 的 emoji 系数
    expect(indexSrc).toMatch(/0x1f338/);
    expect(indexSrc).toMatch(/0x1f497/);
    expect(indexSrc).toMatch(/0x1f90d/);
    expect(indexSrc).toMatch(/fs \* 1\.15/);
    const fnStart = indexSrc.indexOf("function drawHudRichText(");
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnBody = indexSrc.slice(fnStart, indexSrc.indexOf("\n  }", fnStart));
    expect(fnBody).toContain("drawPetalIcon(");
    expect(fnBody).toContain("drawHeartIcon(");
  });
});
