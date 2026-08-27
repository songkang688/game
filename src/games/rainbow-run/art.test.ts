/**
 * 彩虹跑跑 · 1.3 视觉契约测试。
 *
 * 用一只「录制型 2D 上下文」把每个绘制函数的调用序列抄下来直接断言:
 *  1. 金币不再是纯色圆——8 帧旋转 sprite,帧间互不相同,播放走 drawImage;
 *  2. 跑者奔跑 / 跳跃 / 滑铲三姿态绘制序列互不相同,双臂摆动分支被走到;
 *  3. 五种障碍绘制互不相同,而且每种都画了统一的接地椭圆影;
 *  4. 道具与障碍图标全部矢量绘制,一次 fillText 都不许出现;
 *  5. view3d 全部导出的公式「改版前后同输入同输出」——逐个钉死数值;
 *  6. 粒子数仍按画质三档缩放(回归)。
 */
import { describe, expect, it } from "vitest";
import {
  COIN_DOT_SCALE,
  COIN_FRAME_COUNT,
  COIN_SWEEP_PERIOD,
  CONTACT_SHADOW,
  HEADBAND_P1,
  HEADBAND_P2,
  INVINCIBLE_BLINK_HZ,
  PARALLAX_THEMES,
  RunnerPose,
  SilhouetteKind,
  blinkHidden,
  coinFrameAt,
  coinFrameRatio,
  coinLOD,
  coinSweepPhase,
  drawBoardArt,
  drawBoardIcon,
  drawBoltIcon,
  drawBubble,
  drawCoin,
  drawCoinDot,
  drawCoinFrame,
  drawCoinSweep,
  drawContactShadow,
  drawJetFlame,
  drawJetIcon,
  drawMagnetIcon,
  drawObstacleArt,
  drawPowerIcon,
  drawRunner,
  drawRunnerAfterimage,
  drawRunnerArms,
  drawSilhouetteUnit,
  drawStarPickup,
  flutterPhase,
  makeCoinSprite,
  pickupFloat,
  worldDotsLit,
} from "./art";
import {
  CAM_DEPTH_RATIO,
  FOG_START_SCALE,
  FPS_DOWNGRADE,
  FPS_UPGRADE,
  HORIZON_RATIO,
  LANE_SPREAD,
  MAX_DT,
  MAX_SCALE,
  MIN_SCALE,
  PARALLAX_LAYERS,
  QUALITY_TIERS,
  SPAWN_TRACK_Y,
  clampDt,
  depthOf,
  edgeOffset,
  fogAlpha,
  groundGridDepths,
  laneOffset,
  makeCamera,
  mixHex,
  nextQualityTier,
  parallaxShift,
  particleCount,
  projectFlatX,
  projectTrack,
  scaleAtDepth,
  screenYAtDepth,
  smoothFps,
  smoothing,
  withAlpha,
} from "./view3d";
import { THEME_ORDER } from "./logic";
import type { ObstacleKind } from "./logic";

/* ------------------------------------------------------------------ */
/* 录制型 2D 上下文:每个调用记一行,数值四舍五入到两位小数              */
/* ------------------------------------------------------------------ */

class Rec {
  ops: string[] = [];
  /** drawImage 收到的图像源(按调用顺序) */
  images: unknown[] = [];
  /** fillText 的文本(有一条就算违约) */
  texts: string[] = [];

  private log(name: string, args: unknown[]): void {
    const fmt = args
      .map((a) => (typeof a === "number" ? String(Math.round(a * 100) / 100) : String(a)))
      .join(",");
    this.ops.push(`${name}(${fmt})`);
  }

  set fillStyle(v: unknown) {
    this.ops.push(`fillStyle:${typeof v === "string" ? v : "<gradient>"}`);
  }
  set strokeStyle(v: unknown) {
    this.ops.push(`strokeStyle:${typeof v === "string" ? v : "<gradient>"}`);
  }
  set lineWidth(v: number) {
    this.log("lineWidth", [v]);
  }
  set lineCap(_v: string) {
    // 端帽不进序列:它不改变形状本身
  }
  set globalAlpha(v: number) {
    this.log("globalAlpha", [v]);
  }
  set font(_v: string) {
    this.ops.push("font");
  }
  set textAlign(_v: string) {}
  set textBaseline(_v: string) {}

  save(): void {
    this.ops.push("save");
  }
  restore(): void {
    this.ops.push("restore");
  }
  beginPath(): void {
    this.ops.push("beginPath");
  }
  closePath(): void {
    this.ops.push("closePath");
  }
  moveTo(...a: number[]): void {
    this.log("moveTo", a);
  }
  lineTo(...a: number[]): void {
    this.log("lineTo", a);
  }
  quadraticCurveTo(...a: number[]): void {
    this.log("quad", a);
  }
  bezierCurveTo(...a: number[]): void {
    this.log("bezier", a);
  }
  arc(...a: number[]): void {
    this.log("arc", a);
  }
  ellipse(...a: number[]): void {
    this.log("ellipse", a);
  }
  roundRect(...a: unknown[]): void {
    this.log("roundRect", a);
  }
  rect(...a: number[]): void {
    this.log("rect", a);
  }
  fill(): void {
    this.ops.push("fill");
  }
  stroke(): void {
    this.ops.push("stroke");
  }
  clip(): void {
    this.ops.push("clip");
  }
  fillRect(...a: number[]): void {
    this.log("fillRect", a);
  }
  strokeRect(...a: number[]): void {
    this.log("strokeRect", a);
  }
  translate(...a: number[]): void {
    this.log("translate", a);
  }
  scale(...a: number[]): void {
    this.log("scale", a);
  }
  rotate(...a: number[]): void {
    this.log("rotate", a);
  }
  setLineDash(_v: number[]): void {
    this.ops.push("setLineDash");
  }
  drawImage(img: unknown, ...a: number[]): void {
    this.images.push(img);
    this.log("drawImage", a);
  }
  fillText(text: string, ...a: number[]): void {
    this.texts.push(text);
    this.log("fillText", a);
  }
  createLinearGradient(...a: number[]): { addColorStop: (o: number, c: string) => void } {
    this.log("linearGradient", a);
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop:${o}:${c}`) };
  }
  createRadialGradient(...a: number[]): { addColorStop: (o: number, c: string) => void } {
    this.log("radialGradient", a);
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop:${o}:${c}`) };
  }
}

type Ctx = CanvasRenderingContext2D;

function record(draw: (ctx: Ctx) => void): Rec {
  const rec = new Rec();
  draw(rec as unknown as Ctx);
  return rec;
}

function seq(draw: (ctx: Ctx) => void): string {
  return record(draw).ops.join("|");
}

/* ------------------------------------------------------------------ */
/* 1. 金币:8 帧旋转 sprite                                             */
/* ------------------------------------------------------------------ */

describe("彩虹跑跑 1.3 · 星币旋转帧", () => {
  it("一圈切成 8 帧,压缩比 1 → 0.25 → 1,每一帧都在 [0.25, 1] 里", () => {
    expect(COIN_FRAME_COUNT).toBe(8);
    expect(coinFrameRatio(0)).toBeCloseTo(1, 10);
    expect(coinFrameRatio(2)).toBeCloseTo(0.25, 10);
    expect(coinFrameRatio(4)).toBeCloseTo(1, 10);
    for (let f = 0; f < COIN_FRAME_COUNT; f++) {
      const r = coinFrameRatio(f);
      expect(r).toBeGreaterThanOrEqual(0.25);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it("8 帧的绘制序列两两不同——不是同一张脸转圈骗人", () => {
    const frames: string[] = [];
    for (let f = 0; f < COIN_FRAME_COUNT; f++) frames.push(seq((c) => drawCoinFrame(c, 10, f)));
    expect(new Set(frames).size).toBe(COIN_FRAME_COUNT);
  });

  it("金币不是纯色圆:币面有径向渐变、内圈凹槽描边和五角星压印", () => {
    const rec = record((c) => drawCoinFrame(c, 10, 0));
    expect(rec.ops.some((op) => op.startsWith("radialGradient"))).toBe(true);
    expect(rec.ops.filter((op) => op === "stroke").length).toBeGreaterThanOrEqual(2);
    // 五角星压印:一条 10 个顶点的路径
    expect(rec.ops.filter((op) => op.startsWith("lineTo")).length).toBeGreaterThanOrEqual(9);
  });

  it("预渲染出 8 张离屏画布,播放时走 drawImage 且取的正是那一帧", () => {
    const madeCtx: Rec[] = [];
    const sprite = makeCoinSprite(10, 4, (cw, chh) => {
      const rc = new Rec();
      madeCtx.push(rc);
      return { width: cw, height: chh, getContext: () => rc };
    });
    expect(sprite.frames.length).toBe(COIN_FRAME_COUNT);
    for (const rc of madeCtx) expect(rc.ops.length).toBeGreaterThan(4);
    const rec = record((c) => drawCoin(c, sprite, 3));
    expect(rec.images).toHaveLength(1);
    expect(rec.images[0]).toBe(sprite.frames[3]);
    // 帧号随时间走,一圈 8 帧都轮得到
    const seen = new Set<number>();
    for (let t = 0; t < 1; t += 1 / 60) seen.add(coinFrameAt(t));
    expect(seen.size).toBe(COIN_FRAME_COUNT);
  });

  it("每 1.2 秒扫一道斜光;投影缩到 MIN_SCALE 附近退化成亮点", () => {
    expect(COIN_SWEEP_PERIOD).toBeCloseTo(1.2, 10);
    expect(coinSweepPhase(0)).toBeGreaterThanOrEqual(0);
    expect(coinSweepPhase(0.6)).toBe(-1);
    expect(coinSweepPhase(1.2)).toBeGreaterThanOrEqual(0);
    // 相位无效时一笔都不画
    expect(record((c) => drawCoinSweep(c, 10, -1)).ops).toHaveLength(0);
    expect(record((c) => drawCoinSweep(c, 10, 0.5)).ops.length).toBeGreaterThan(0);
    // LOD:MIN_SCALE 附近是亮点,正常尺寸是 sprite
    expect(coinLOD(MIN_SCALE)).toBe("dot");
    expect(coinLOD(COIN_DOT_SCALE - 0.01)).toBe("dot");
    expect(coinLOD(0.5)).toBe("sprite");
    expect(record((c) => drawCoinDot(c, 10)).ops.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 2. 彩虹跑者                                                          */
/* ------------------------------------------------------------------ */

function runnerSeq(pose: RunnerPose, step = 4, reduced = false): string {
  return seq((c) =>
    drawRunner(c, { pose, r: 30, step, t: 0.4, squashX: pose === "slide" ? 1.25 : 1, squashY: pose === "slide" ? 0.6 : 1, reduced }),
  );
}

describe("彩虹跑跑 1.3 · 彩虹跑者", () => {
  it("奔跑 / 跳跃 / 滑铲 / 飞行 / 撞击五个姿态的绘制序列两两不同", () => {
    const poses: RunnerPose[] = ["run", "jump", "slide", "fly", "hurt"];
    const seqs = poses.map((p) => runnerSeq(p));
    expect(new Set(seqs).size).toBe(poses.length);
  });

  it("双臂摆动分支被走到:步幅一变,奔跑序列跟着变(臂与同侧脚反相位)", () => {
    expect(runnerSeq("run", 8)).not.toBe(runnerSeq("run", -8));
    // 直接看手臂:左臂 y 随 -step,右臂随 +step
    const up = record((c) => drawRunnerArms(c, 30, 8, "run"));
    const down = record((c) => drawRunnerArms(c, 30, -8, "run"));
    expect(up.ops.join("|")).not.toBe(down.ops.join("|"));
    // 跳跃时双臂举起来,和奔跑摆臂不一样
    expect(seq((c) => drawRunnerArms(c, 30, 8, "jump"))).not.toBe(
      seq((c) => drawRunnerArms(c, 30, 8, "run")),
    );
  });

  it("发带与披风:reduced 恒不飘;正常模式随时间换两帧;P1/P2 发带配色不同", () => {
    for (const t of [0, 0.13, 0.26, 0.9, 2.4]) expect(flutterPhase(t, true)).toBe(0);
    const phases = new Set<number>();
    for (let t = 0; t < 1; t += 0.05) phases.add(flutterPhase(t, false));
    expect(phases).toEqual(new Set([0, 1]));
    expect(HEADBAND_P1.length).toBe(5);
    expect(HEADBAND_P2.length).toBe(5);
    expect(HEADBAND_P1.join()).not.toBe(HEADBAND_P2.join());
    // 滑铲收披风:滑铲序列里不该出现披风的天蓝填充与描边;奔跑序列里有
    expect(runnerSeq("slide")).not.toContain("#9adcf0");
    expect(runnerSeq("slide")).not.toContain("#6ab8d8");
    expect(runnerSeq("run")).toContain("#9adcf0");
  });

  it("无敌闪烁降到 ≤3Hz,隐帧画金色残影而不是消失", () => {
    expect(INVINCIBLE_BLINK_HZ).toBeLessThanOrEqual(3);
    expect(blinkHidden(0)).toBe(false);
    // 1 秒里最多切换 3 次(原来的 8 次超光敏线)
    let flips = 0;
    let prev = blinkHidden(1);
    for (let v = 1; v > 0; v -= 1 / 240) {
      const cur = blinkHidden(v);
      if (cur !== prev) flips++;
      prev = cur;
    }
    expect(flips).toBeLessThanOrEqual(INVINCIBLE_BLINK_HZ);
    const ghost = record((c) => drawRunnerAfterimage(c, 30, 1, 1));
    expect(ghost.ops.filter((op) => op === "fill").length).toBeGreaterThanOrEqual(2);
    expect(ghost.ops.some((op) => op.startsWith("fillStyle:rgba(255,214,104"))).toBe(true);
  });

  it("滑板有会转的轮辐线,火箭尾焰是锥形三层(reduced 静止)", () => {
    expect(seq((c) => drawBoardArt(c, 30, 0.5))).not.toBe(seq((c) => drawBoardArt(c, 30, 2)));
    const flame = record((c) => drawJetFlame(c, 30, 0.3, false));
    // 三层锥:三次「路径 + 填充」
    expect(flame.ops.filter((op) => op === "fill").length).toBe(3);
    expect(flame.ops.filter((op) => op.startsWith("quad")).length).toBe(3);
    // 抖动分支:不同时刻焰长不同;reduced 恒定
    expect(seq((c) => drawJetFlame(c, 30, 0.05, false))).not.toBe(
      seq((c) => drawJetFlame(c, 30, 0.15, false)),
    );
    expect(seq((c) => drawJetFlame(c, 30, 0.05, true))).toBe(
      seq((c) => drawJetFlame(c, 30, 0.15, true)),
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. 障碍:立面 + 接地影                                                */
/* ------------------------------------------------------------------ */

function obstacleRec(kind: ObstacleKind, active = false): Rec {
  return record((c) => drawObstacleArt(c, kind, 100, { time: 0.5, spin: 1.2, active }));
}

describe("彩虹跑跑 1.3 · 障碍立面", () => {
  const FIVE: ObstacleKind[] = ["rock", "hurdle", "bar", "pit", "roller"];

  it("五种障碍的绘制序列两两不同", () => {
    const seqs = FIVE.map((k) => obstacleRec(k).ops.join("|"));
    expect(new Set(seqs).size).toBe(FIVE.length);
  });

  it("每种障碍脚下都有统一规格的接地椭圆影(八种全查)", () => {
    const all: ObstacleKind[] = [...FIVE, "zapper", "crate", "cloudy"];
    for (const k of all) {
      const rec = obstacleRec(k, k === "zapper");
      expect(rec.ops, `${k} 没画接地影`).toContain(`fillStyle:${CONTACT_SHADOW}`);
    }
    // 接地影本身:一笔椭圆填充
    const shadow = record((c) => drawContactShadow(c, 30, 10));
    expect(shadow.ops.some((op) => op.startsWith("ellipse"))).toBe(true);
    expect(shadow.ops).toContain("fill");
  });

  it("坑洞有内壁渐变(上亮下暗)与坑沿碎石;水晶簇有亮暗双面", () => {
    const pit = obstacleRec("pit");
    expect(pit.ops.some((op) => op.startsWith("linearGradient"))).toBe(true);
    expect(pit.ops).toContain("clip");
    expect(pit.ops.filter((op) => op.startsWith("arc")).length).toBeGreaterThanOrEqual(3);
    const rock = obstacleRec("rock");
    expect(rock.ops).toContain("fillStyle:#d8c2ff");
    expect(rock.ops).toContain("fillStyle:#9a78d8");
  });

  it("电光门不再用字符闪电:通电时零 fillText,闪电是矢量路径", () => {
    const on = obstacleRec("zapper", true);
    expect(on.texts).toHaveLength(0);
    expect(on.ops.filter((op) => op.startsWith("lineTo")).length).toBeGreaterThanOrEqual(8);
    const off = obstacleRec("zapper", false);
    expect(off.texts).toHaveLength(0);
    expect(on.ops.join("|")).not.toBe(off.ops.join("|"));
  });
});

/* ------------------------------------------------------------------ */
/* 4. 道具与收集物:全矢量,零 fillText                                  */
/* ------------------------------------------------------------------ */

describe("彩虹跑跑 1.3 · 道具图标", () => {
  it("磁铁 / 火箭 / 滑板全是绘制图标,一次 fillText 都没有,三者互不相同", () => {
    const kinds = ["magnet", "jet", "board"] as const;
    const recs = kinds.map((k) => record((c) => drawPowerIcon(c, k, 18)));
    for (let i = 0; i < recs.length; i++) {
      expect(recs[i].texts, `${kinds[i]} 用了字符占位`).toHaveLength(0);
      expect(recs[i].ops.length).toBeGreaterThan(6);
    }
    expect(new Set(recs.map((r) => r.ops.join("|"))).size).toBe(3);
    // 单个图标本体也各不相同
    expect(seq((c) => drawMagnetIcon(c, 10))).not.toBe(seq((c) => drawJetIcon(c, 10)));
    expect(seq((c) => drawJetIcon(c, 10))).not.toBe(seq((c) => drawBoardIcon(c, 10)));
    // HUD 倒计时的滑轨闪电也是绘制图标,不是 ⚡ 字符
    const bolt = record((c) => drawBoltIcon(c, 8));
    expect(bolt.texts).toHaveLength(0);
    expect(bolt.ops.filter((op) => op.startsWith("lineTo")).length).toBeGreaterThanOrEqual(5);
  });

  it("泡泡球底是渐变球体 + 高光弧;星星带光晕;浮动 ±3px 且 reduced 静止", () => {
    const bubble = record((c) => drawBubble(c, 18));
    expect(bubble.ops.some((op) => op.startsWith("radialGradient"))).toBe(true);
    expect(bubble.ops.filter((op) => op === "stroke").length).toBeGreaterThanOrEqual(2);
    const star = record((c) => drawStarPickup(c, 14, 0.5));
    expect(star.ops.some((op) => op.startsWith("radialGradient"))).toBe(true);
    expect(star.texts).toHaveLength(0);
    for (const t of [0, 0.4, 1.1, 2.9]) {
      expect(Math.abs(pickupFloat(t, false))).toBeLessThanOrEqual(3);
      expect(pickupFloat(t, true)).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. 视差剪影主题表                                                     */
/* ------------------------------------------------------------------ */

describe("彩虹跑跑 1.3 · 视差剪影主题", () => {
  it("12 个世界每个都有远 / 中 / 近三层剪影主题", () => {
    for (const world of THEME_ORDER) {
      const t = PARALLAX_THEMES[world];
      expect(t, `${world} 没配剪影主题`).toBeTruthy();
      expect(t.far.length).toBeGreaterThan(0);
      expect(t.mid.length).toBeGreaterThan(0);
      expect(t.near.length).toBeGreaterThan(0);
    }
  });

  it("规格点名的四组主题:糖果=软糖山+棒棒糖树,海滩=浪线+棕榈,雪原=冰峰+雪杉,星夜=极光带", () => {
    expect(PARALLAX_THEMES.candy.far).toBe("gummy");
    expect(PARALLAX_THEMES.candy.near).toBe("lollipops");
    expect(PARALLAX_THEMES.beach.mid).toBe("waves");
    expect(PARALLAX_THEMES.beach.near).toBe("palms");
    expect(PARALLAX_THEMES.snow.far).toBe("icePeaks");
    expect(PARALLAX_THEMES.snow.near).toBe("firs");
    expect(PARALLAX_THEMES.space.mid).toBe("aurora");
  });

  it("主题表里用到的每一种剪影都画得出来,且形状两两不同", () => {
    const kinds = new Set<SilhouetteKind>();
    for (const world of THEME_ORDER) {
      const t = PARALLAX_THEMES[world];
      kinds.add(t.far);
      kinds.add(t.mid);
      kinds.add(t.near);
    }
    const seqs = new Map<string, string>();
    for (const k of kinds) {
      const s = seq((c) => drawSilhouetteUnit(c, k, 0, 200, 100, 60));
      expect(s.length, `剪影 ${k} 一笔都没画`).toBeGreaterThan(0);
      seqs.set(k, s);
    }
    expect(new Set(seqs.values()).size).toBe(kinds.size);
  });

  it("无尽结算的世界进度带:每 1600 米点亮一颗,封顶 12 颗", () => {
    expect(worldDotsLit(0, 1600, 12)).toBe(1);
    expect(worldDotsLit(1599, 1600, 12)).toBe(1);
    expect(worldDotsLit(1600, 1600, 12)).toBe(2);
    expect(worldDotsLit(1600 * 30, 1600, 12)).toBe(12);
    expect(worldDotsLit(-5, 1600, 12)).toBe(1);
    expect(worldDotsLit(500, 0, 12)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 6. view3d 全量回归:改版前后同输入同输出                              */
/* ------------------------------------------------------------------ */

describe("彩虹跑跑 1.3 · view3d 输出回归(相机 / 雾 / 视差 / 画质,一个数都不许动)", () => {
  const cam = makeCamera(360, 640);

  it("相机常量与 makeCamera:全部钉在 1.1 的原值上", () => {
    expect(HORIZON_RATIO).toBe(0.3);
    expect(CAM_DEPTH_RATIO).toBe(1.35);
    expect(MAX_SCALE).toBe(2.4);
    expect(MIN_SCALE).toBe(0.05);
    expect(LANE_SPREAD).toBe(0.26);
    expect(SPAWN_TRACK_Y).toBe(-680);
    expect(cam.horizonY).toBeCloseTo(192, 10);
    expect(cam.playerY).toBeCloseTo(499.2, 10);
    expect(cam.camDepth).toBeCloseTo(414.72, 10);
  });

  it("透视投影公式逐点回归", () => {
    expect(depthOf(cam, 400)).toBeCloseTo(99.2, 10);
    expect(scaleAtDepth(cam, 414.72)).toBeCloseTo(0.5, 10);
    expect(screenYAtDepth(cam, 414.72)).toBeCloseTo(345.6, 10);
    expect(laneOffset(360, 0)).toBeCloseTo(-93.6, 10);
    expect(edgeOffset(360, 0)).toBeCloseTo(-140.4, 10);
    expect(projectFlatX(cam, 280, 0.5)).toBeCloseTo(230, 10);
    const p = projectTrack(cam, cam.playerY, 2);
    expect(p.x).toBeCloseTo(273.6, 10);
    expect(p.y).toBeCloseTo(499.2, 10);
    expect(p.scale).toBeCloseTo(1, 10);
  });

  it("地面网格 / 雾 / 视差公式逐点回归", () => {
    expect(groundGridDepths(75, 150, 450)).toEqual([75, 225, 375]);
    expect(FOG_START_SCALE).toBe(0.55);
    expect(fogAlpha(0.275)).toBeCloseTo(0.205, 10);
    expect(fogAlpha(0.55)).toBe(0);
    expect(parallaxShift(100, 0.13, 200)).toBeCloseTo(187, 10);
    expect(PARALLAX_LAYERS).toEqual([
      { name: "远山", factor: 0.05, height: 0.66, alpha: 0.28, span: 0.9 },
      { name: "云带", factor: 0.13, height: 0.42, alpha: 0.4, span: 0.62 },
      { name: "近树", factor: 0.29, height: 0.24, alpha: 0.55, span: 0.34 },
    ]);
  });

  it("画质三档 / 帧率迟滞 / delta time / 配色小工具逐点回归", () => {
    expect(QUALITY_TIERS).toEqual([
      { name: "细腻", parallax: 3, particles: 1, gridSpacing: 150, laneDashes: true, glow: true },
      { name: "顺畅", parallax: 2, particles: 0.6, gridSpacing: 230, laneDashes: true, glow: false },
      { name: "省电", parallax: 1, particles: 0.3, gridSpacing: 340, laneDashes: false, glow: false },
    ]);
    expect(FPS_DOWNGRADE).toBe(45);
    expect(FPS_UPGRADE).toBe(55);
    expect(smoothFps(60, 1 / 30)).toBeCloseTo(57.6, 10);
    expect(nextQualityTier(1, 44)).toBe(2);
    expect(nextQualityTier(1, 56)).toBe(0);
    expect(MAX_DT).toBe(1 / 20);
    expect(clampDt(16)).toBeCloseTo(0.016, 10);
    expect(clampDt(200)).toBe(1 / 20);
    expect(smoothing(0.1, 10)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(mixHex("#204060", "#a0c0e0", 0.5)).toBe("#6080a0");
    expect(withAlpha("#ffcc00", 0.25)).toBe("rgba(255,204,0,0.25)");
  });

  it("粒子数按画质三档缩放(回归):星屑那手 3 粒在三档下是 3 / 2 / 1", () => {
    expect(particleCount(3, 0)).toBe(3);
    expect(particleCount(3, 1)).toBe(2);
    expect(particleCount(3, 2)).toBe(1);
    expect(particleCount(8, 0)).toBe(8);
    expect(particleCount(8, 1)).toBe(5);
    expect(particleCount(8, 2)).toBe(2);
    expect(particleCount(1, 2)).toBeGreaterThanOrEqual(1);
  });
});
