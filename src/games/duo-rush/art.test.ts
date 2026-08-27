/**
 * 1.3 第 11 步 A · 素材契约测试。
 *
 * 视觉宪法（docs/plan-1.3-visual-bible.md 第九节）要求视觉步不许「改了就跑」：
 * 金币必须是旋转帧不是纯色圆、跑者必须是绘制的角色不是 fillText emoji、
 * 障碍要有影有材质、reduced-motion 降级分支可达。
 * 这里用一个「记录每一笔」的 2D context 桩把这些钉死。
 */
import { describe, expect, it } from "vitest";
import {
  COIN_FRAME_COUNT,
  P1_COLORS,
  P2_COLORS,
  SEAT_RING,
  boostArrowPhase,
  coinFrameSpec,
  coinFrames,
  drawAvatarBody,
  drawBoostPad,
  drawCelestial,
  drawCheerHeart,
  drawCloudPuff,
  drawCoin,
  drawCrown,
  drawDecorSilhouette,
  drawDizzyStars,
  drawGhostWisp,
  drawHeart,
  drawMiniFace,
  drawObstacle,
  drawPowerIcon,
  drawRoadsideFlag,
  drawRunnerSprite,
  drawSparkle,
  drawSpeedTrail,
  sparkleCount,
  type CanvasLike,
  type DecorKind,
  type RunnerPose,
} from "./art";
import { laneTiltDeg, fogAlpha, groundY, horizonY, laneWidthAt, project } from "./view25d";

/* ---------------- 记录桩 ---------------- */

const rnd = (n: unknown): string => (typeof n === "number" ? String(Math.round(n * 100) / 100) : String(n));

class RecCtx {
  ops: string[] = [];
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
  globalAlpha = 1;
  font = "";
  textAlign = "";
  textBaseline = "";
  private fill_: unknown = "";
  private stroke_: unknown = "";

  set fillStyle(v: unknown) {
    this.fill_ = v;
    this.ops.push(`fillStyle=${typeof v === "string" ? v : "<gradient>"}`);
  }
  get fillStyle(): unknown {
    return this.fill_;
  }
  set strokeStyle(v: unknown) {
    this.stroke_ = v;
    this.ops.push(`strokeStyle=${typeof v === "string" ? v : "<gradient>"}`);
  }
  get strokeStyle(): unknown {
    return this.stroke_;
  }

  private log(name: string, ...args: unknown[]): void {
    this.ops.push(`${name}(${args.map(rnd).join(",")})`);
  }
  save(): void {
    this.log("save");
  }
  restore(): void {
    this.log("restore");
  }
  translate(x: number, y: number): void {
    this.log("translate", x, y);
  }
  scale(x: number, y: number): void {
    this.log("scale", x, y);
  }
  rotate(a: number): void {
    this.log("rotate", a);
  }
  beginPath(): void {
    this.log("beginPath");
  }
  closePath(): void {
    this.log("closePath");
  }
  moveTo(x: number, y: number): void {
    this.log("moveTo", x, y);
  }
  lineTo(x: number, y: number): void {
    this.log("lineTo", x, y);
  }
  quadraticCurveTo(a: number, b: number, c: number, d: number): void {
    this.log("quadraticCurveTo", a, b, c, d);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.log("bezierCurveTo", a, b, c, d, e, f);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number): void {
    this.log("arc", x, y, r, a0, a1);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number): void {
    this.log("ellipse", x, y, rx, ry, rot);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.log("rect", x, y, w, h);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.log("roundRect", x, y, w, h, r);
  }
  fill(): void {
    this.log("fill");
  }
  stroke(): void {
    this.log("stroke");
  }
  clip(): void {
    this.log("clip");
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.log("fillRect", x, y, w, h);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.log("strokeRect", x, y, w, h);
  }
  drawImage(...args: unknown[]): void {
    this.log("drawImage", ...args.slice(1));
  }
  fillText(text: string, x: number, y: number): void {
    this.log("fillText", text, x, y);
  }
  createLinearGradient(): { addColorStop: (o: number, c: string) => void } {
    this.ops.push("linearGradient");
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop(${rnd(o)},${c})`) };
  }
  createRadialGradient(): { addColorStop: (o: number, c: string) => void } {
    this.ops.push("radialGradient");
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop(${rnd(o)},${c})`) };
  }
}

const ctxOf = (rec: RecCtx): CanvasRenderingContext2D => rec as unknown as CanvasRenderingContext2D;

const count = (rec: RecCtx, name: string): number =>
  rec.ops.filter((op) => op === name || op.startsWith(`${name}(`)).length;

/** 造一批带记录桩的假画布，coinFrames 烘焙时每帧的笔画都能翻出来看 */
function fakeCanvasFactory(): { make: (w: number, h: number) => CanvasLike; recs: RecCtx[] } {
  const recs: RecCtx[] = [];
  return {
    recs,
    make: (w: number, h: number) => {
      const rec = new RecCtx();
      recs.push(rec);
      return { width: w, height: h, getContext: () => ctxOf(rec) };
    },
  };
}

function pose(over: Partial<RunnerPose> = {}): RunnerPose {
  return {
    who: 0,
    x: 100,
    footY: 150,
    unit: 60,
    squash: 1,
    bounce: 2,
    runPhase: 1.2,
    mood: "run",
    time: 3,
    reduced: false,
    ...over,
  };
}

/* ---------------- 1. 金币：8 帧旋转 sprite ---------------- */

describe("金币不是纯色圆", () => {
  it("烘焙出 8 帧，drawCoin 走 drawImage", () => {
    const { make } = fakeCanvasFactory();
    const frames = coinFrames(24, make);
    expect(COIN_FRAME_COUNT).toBe(8);
    expect(frames).toHaveLength(8);
    const rec = new RecCtx();
    drawCoin(ctxOf(rec), 50, 50, 12, frames, 3);
    expect(count(rec, "drawImage")).toBe(1);
    expect(count(rec, "fillText")).toBe(0);
  });

  it("8 帧笔画互不相同（真的在转，不是同一张贴 8 次）", () => {
    const { make, recs } = fakeCanvasFactory();
    coinFrames(24, make);
    const serialized = recs.map((r) => r.ops.join("|"));
    expect(new Set(serialized).size).toBe(8);
  });

  it("正面帧有厚度、内环、五角星压印与高光，不是一个 arc 完事", () => {
    const rec = new RecCtx();
    drawCoin(ctxOf(rec), 0, 0, 20, [], 0); // 空帧走矢量兜底，笔画同烘焙帧
    expect(count(rec, "fill")).toBeGreaterThanOrEqual(4);
    expect(count(rec, "stroke")).toBeGreaterThanOrEqual(1);
    expect(count(rec, "lineTo")).toBeGreaterThanOrEqual(9); // 五角星 10 个顶点
    expect(rec.ops.join("|")).toContain("linearGradient");
  });

  it("侧棱帧画厚度棱线，星印随转角淡出", () => {
    expect(coinFrameSpec(0).w).toBe(1);
    expect(coinFrameSpec(0).star).toBeGreaterThan(0.9);
    expect(coinFrameSpec(4).edgeOn).toBe(true);
    expect(coinFrameSpec(4).star).toBe(0);
    expect(coinFrameSpec(5).flip).toBe(true);
    expect(coinFrameSpec(3).flip).toBe(false);
  });

  it("造不出画布时退回矢量画法，一帧也不丢", () => {
    expect(coinFrames(24, () => null)).toHaveLength(0);
    const rec = new RecCtx();
    drawCoin(ctxOf(rec), 10, 10, 8, [], 5);
    expect(count(rec, "drawImage")).toBe(0);
    expect(count(rec, "fill")).toBeGreaterThan(0);
  });
});

/* ---------------- 2. 跑者：绘制的双主角，不再 fillText emoji ---------------- */

describe("跑者是绘制的角色", () => {
  it("奔跑 / 跳跃 / 下滑 / 被撞 / 幽灵五种状态全走绘制路径，零 fillText", () => {
    for (const mood of ["run", "jump", "slide", "dizzy", "ghost"] as const) {
      const rec = new RecCtx();
      drawRunnerSprite(ctxOf(rec), pose({ mood }));
      expect(count(rec, "fillText"), mood).toBe(0);
      expect(count(rec, "fill"), mood).toBeGreaterThan(5);
    }
  });

  it("P1/P2 绘制序列不同：朵朵有花苞呆毛与裙摆，星星有星呆毛与披风", () => {
    const p1 = new RecCtx();
    const p2 = new RecCtx();
    drawRunnerSprite(ctxOf(p1), pose({ who: 0 }));
    drawRunnerSprite(ctxOf(p2), pose({ who: 1 }));
    expect(p1.ops.join("|")).not.toBe(p2.ops.join("|"));
    // 花苞的茎是绿色描边；星呆毛是金色填充
    expect(p1.ops.some((op) => op.includes("#7FBF6A"))).toBe(true);
    expect(p2.ops.some((op) => op.includes("#F5C542"))).toBe(true);
    expect(p1.ops.some((op) => op.includes("#F5C542"))).toBe(false);
  });

  it("五种状态的表情互不相同（专注 / 张嘴笑 / 眯眼 / ×眼）", () => {
    const draw = (mood: RunnerPose["mood"]): string => {
      const rec = new RecCtx();
      drawRunnerSprite(ctxOf(rec), pose({ mood }));
      return rec.ops.join("|");
    };
    const all = [draw("run"), draw("jump"), draw("slide"), draw("dizzy"), draw("ghost")];
    expect(new Set(all).size).toBe(5);
  });

  it("被撞 = ×眼 + 三颗星绕头，全是笔画、无痛苦表现", () => {
    const rec = new RecCtx();
    drawDizzyStars(ctxOf(rec), 100, 80, 60, 2, false);
    expect(count(rec, "fillText")).toBe(0);
    expect(count(rec, "fill")).toBe(3);
    expect(count(rec, "lineTo")).toBe(27); // 3 颗五角星 × 9 段
  });

  it("幽灵火苗 / 尾焰 / 皇冠 / 加油心全部是绘制资产", () => {
    for (const draw of [
      (rec: RecCtx) => drawGhostWisp(ctxOf(rec), 100, 80, 60, 1, false),
      (rec: RecCtx) => drawSpeedTrail(ctxOf(rec), 100, 120, 60, 1, false),
      (rec: RecCtx) => drawCrown(ctxOf(rec), 100, 60, 24),
      (rec: RecCtx) => drawCheerHeart(ctxOf(rec), 130, 90, 60, 0.4, false),
      (rec: RecCtx) => drawHeart(ctxOf(rec), 0, 0, 10),
      (rec: RecCtx) => drawSparkle(ctxOf(rec), 0, 0, 6),
    ]) {
      const rec = new RecCtx();
      draw(rec);
      expect(count(rec, "fillText")).toBe(0);
      expect(rec.ops.length).toBeGreaterThan(0);
    }
  });

  it("A/B 主色不相等，调色板全是合法 #rrggbb（形状+颜色双通道）", () => {
    expect(P1_COLORS.body).not.toBe(P2_COLORS.body);
    expect(P1_COLORS.trim).not.toBe(P2_COLORS.trim);
    for (const c of [...Object.values(P1_COLORS), ...Object.values(P2_COLORS), ...SEAT_RING]) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

/* ---------------- 3. 障碍：四种含影且互不相同 ---------------- */

describe("障碍材质", () => {
  const kinds = ["pit", "rock", "hurdle", "gate"] as const;

  it("四种障碍都有落地影（ellipse）且零 fillText", () => {
    for (const kind of kinds) {
      const rec = new RecCtx();
      drawObstacle(ctxOf(rec), kind, 100, 150, 80, 0);
      expect(count(rec, "ellipse"), kind).toBeGreaterThanOrEqual(1);
      expect(count(rec, "fillText"), kind).toBe(0);
      expect(rec.ops.length, kind).toBeGreaterThan(4);
    }
  });

  it("四种障碍绘制序列互不相同", () => {
    const all = kinds.map((kind) => {
      const rec = new RecCtx();
      drawObstacle(ctxOf(rec), kind, 100, 150, 80, 0);
      return rec.ops.join("|");
    });
    expect(new Set(all).size).toBe(4);
  });

  it("石头随主题换装：粉主题圆石、蓝主题水晶簇", () => {
    const a = new RecCtx();
    const b = new RecCtx();
    drawObstacle(ctxOf(a), "rock", 100, 150, 80, 0);
    drawObstacle(ctxOf(b), "rock", 100, 150, 80, 1);
    expect(a.ops.join("|")).not.toBe(b.ops.join("|"));
    expect(b.ops.some((op) => op.includes("#C8DCFA"))).toBe(true); // 水晶亮面
  });

  it("木栏与高杆有渐变材质与高光（不再是平涂色块）", () => {
    for (const kind of ["hurdle", "gate"] as const) {
      const rec = new RecCtx();
      drawObstacle(ctxOf(rec), kind, 100, 150, 80, 0);
      expect(rec.ops.join("|"), kind).toContain("linearGradient");
    }
  });

  it("道具四图标 + 加速带全部图标化，互不相同", () => {
    const all = (["speedCloud", "shieldBubble", "confetti", "magnetStar"] as const).map((kind) => {
      const rec = new RecCtx();
      drawPowerIcon(ctxOf(rec), kind, 50, 50, 12);
      expect(count(rec, "fillText"), kind).toBe(0);
      expect(rec.ops.length, kind).toBeGreaterThan(3);
      return rec.ops.join("|");
    });
    expect(new Set(all).size).toBe(4);
    const boost = new RecCtx();
    drawBoostPad(ctxOf(boost), 100, 150, 80, 0.5);
    expect(count(boost, "fillText")).toBe(0);
    expect(boost.ops.join("|")).toContain("radialGradient");
  });
});

/* ---------------- 4. view25d 投影 / 雾：同输入同输出回归 ---------------- */

describe("view25d 输出回归", () => {
  const PANE = { x: 0, y: 0, width: 360, height: 200 };

  it("project 的坐标钉死（视觉底盘不许被顺手动了）", () => {
    expect(horizonY(PANE)).toBeCloseTo(64, 6);
    expect(groundY(PANE)).toBeCloseTo(194, 6);
    const near = project(PANE, 0, 1);
    expect(near.x).toBeCloseTo(180, 6);
    expect(near.y).toBeCloseTo(194, 6);
    expect(near.scale).toBeCloseTo(1, 6);
    const mid = project(PANE, 10, 0);
    expect(mid.scale).toBeCloseTo(34 / 44, 6);
    expect(mid.x).toBeCloseTo(180 - 104.4 * (34 / 44), 4);
    expect(mid.y).toBeCloseTo(64 + 130 * (34 / 44), 4);
  });

  it("fogAlpha 与 laneWidthAt 钉死", () => {
    expect(fogAlpha(95)).toBe(0);
    expect(fogAlpha(120)).toBeCloseTo(25 / 95, 6);
    expect(fogAlpha(190)).toBe(1);
    expect(laneWidthAt(PANE, 0)).toBeCloseTo(104.4, 6);
    expect(laneWidthAt(PANE, 34)).toBeCloseTo(52.2, 6);
  });
});

/* ---------------- 5. 头像模式：drawImage 裁剪回归 ---------------- */

describe("自定义头像模式", () => {
  it("椭圆裁剪一次、drawImage 一次，外加角色色描边环", () => {
    const rec = new RecCtx();
    drawAvatarBody(ctxOf(rec), {} as CanvasImageSource, 100, 90, 60, 60, 0);
    expect(count(rec, "clip")).toBe(1);
    expect(count(rec, "drawImage")).toBe(1);
    expect(count(rec, "ellipse")).toBe(2); // 裁剪 + 描边环
    expect(rec.ops.some((op) => op === `strokeStyle=${SEAT_RING[0]}`)).toBe(true);
  });

  it("P1/P2 的描边环颜色不同", () => {
    const a = new RecCtx();
    const b = new RecCtx();
    drawAvatarBody(ctxOf(a), {} as CanvasImageSource, 0, 0, 40, 40, 0);
    drawAvatarBody(ctxOf(b), {} as CanvasImageSource, 0, 0, 40, 40, 1);
    expect(SEAT_RING[0]).not.toBe(SEAT_RING[1]);
    expect(a.ops.join("|")).not.toBe(b.ops.join("|"));
  });
});

/* ---------------- 6. reduced-motion：侧倾归零扩展到箭头 / 星屑 ---------------- */

describe("reduced-motion 降级", () => {
  it("换道侧倾归零（1.2 口径回归）", () => {
    expect(laneTiltDeg(2, 1.3, true)).toBe(0);
    expect(laneTiltDeg(2, 1.3, false)).not.toBe(0);
  });

  it("加速带箭头恒静止：相位永远是 0", () => {
    expect(boostArrowPhase(3.7, true)).toBe(0);
    expect(boostArrowPhase(9.9, true)).toBe(0);
    expect(boostArrowPhase(0.1, false)).not.toBeCloseTo(boostArrowPhase(0.3, false), 6);
  });

  it("拾取星屑一粒不撒", () => {
    expect(sparkleCount(true)).toBe(0);
    expect(sparkleCount(false)).toBe(3);
  });

  it("眩晕星与尾焰在 reduced 下不随时间动", () => {
    const at = (time: number, reduced: boolean): string => {
      const rec = new RecCtx();
      drawDizzyStars(ctxOf(rec), 100, 80, 60, time, reduced);
      drawSpeedTrail(ctxOf(rec), 100, 120, 60, time, reduced);
      return rec.ops.join("|");
    };
    expect(at(0, true)).toBe(at(1.5, true));
    expect(at(0, false)).not.toBe(at(1.5, false));
  });

  it("尾焰在 reduced 下只留速度线，不撒星屑", () => {
    const rec = new RecCtx();
    drawSpeedTrail(ctxOf(rec), 100, 120, 60, 1, true);
    expect(count(rec, "fill")).toBe(0);
    expect(count(rec, "stroke")).toBe(3);
  });

  it("加油心在 reduced 下不上飘，只淡出", () => {
    const heartAt = (progress: number): string => {
      const rec = new RecCtx();
      drawCheerHeart(ctxOf(rec), 130, 90, 60, progress, true);
      return rec.ops.filter((op) => op.startsWith("bezierCurveTo")).join("|");
    };
    expect(heartAt(0.2)).toBe(heartAt(0.8));
  });
});

/* ---------------- 场景装饰：第三层视差 / 天体 / 路旗 ---------------- */

describe("场景装饰资产", () => {
  it("四种近景剪影（树/糖果柱/冰锥/星塔）互不相同且可画", () => {
    const kinds: DecorKind[] = ["tree", "candy", "ice", "starTower"];
    const all = kinds.map((kind) => {
      const rec = new RecCtx();
      drawDecorSilhouette(ctxOf(rec), kind, 100, 150, 40, "#EDA3C3", "#F6C2D9");
      expect(rec.ops.length, kind).toBeGreaterThan(2);
      return rec.ops.join("|");
    });
    expect(new Set(all).size).toBe(4);
  });

  it("太阳 / 月亮 / 云朵 / 路旗 / 迷你脸都是绘制资产", () => {
    for (const draw of [
      (rec: RecCtx) => drawCelestial(ctxOf(rec), 50, 40, 14, "sun"),
      (rec: RecCtx) => drawCelestial(ctxOf(rec), 50, 40, 14, "moon"),
      (rec: RecCtx) => drawCloudPuff(ctxOf(rec), 80, 30, 10),
      (rec: RecCtx) => drawRoadsideFlag(ctxOf(rec), 20, 150, 24, "#C2497E", 0),
      (rec: RecCtx) => drawRoadsideFlag(ctxOf(rec), 20, 150, 24, "#3A6BB0", 1),
      (rec: RecCtx) => drawMiniFace(ctxOf(rec), 30, 30, 8, 0),
      (rec: RecCtx) => drawMiniFace(ctxOf(rec), 30, 30, 8, 1),
    ]) {
      const rec = new RecCtx();
      draw(rec);
      expect(count(rec, "fillText")).toBe(0);
      expect(rec.ops.length).toBeGreaterThan(1);
    }
  });

  it("太阳月亮不同、两种路旗不同、两张迷你脸不同", () => {
    const run = (draw: (rec: RecCtx) => void): string => {
      const rec = new RecCtx();
      draw(rec);
      return rec.ops.join("|");
    };
    expect(run((r) => drawCelestial(ctxOf(r), 50, 40, 14, "sun"))).not.toBe(
      run((r) => drawCelestial(ctxOf(r), 50, 40, 14, "moon")),
    );
    expect(run((r) => drawRoadsideFlag(ctxOf(r), 20, 150, 24, "#C2497E", 0))).not.toBe(
      run((r) => drawRoadsideFlag(ctxOf(r), 20, 150, 24, "#C2497E", 1)),
    );
    expect(run((r) => drawMiniFace(ctxOf(r), 30, 30, 8, 0))).not.toBe(
      run((r) => drawMiniFace(ctxOf(r), 30, 30, 8, 1)),
    );
  });
});

/* ---------------- r2 · B 档 TOP1:画布 HUD 手绘化 ---------------- */

describe("r2 · 画布 HUD 手绘化(emoji 字符不再进 fillText)", () => {
  it("空心心(filled=false)只描边不填充,与实心序列不同", () => {
    const filled = new RecCtx();
    drawHeart(ctxOf(filled), 0, 0, 10);
    const hollow = new RecCtx();
    drawHeart(ctxOf(hollow), 0, 0, 10, "#FF7EA8", false);
    expect(hollow.ops.join("|")).not.toBe(filled.ops.join("|"));
    expect(count(hollow, "stroke")).toBeGreaterThanOrEqual(1);
    expect(count(hollow, "fill")).toBe(0);
    expect(count(filled, "fill")).toBeGreaterThanOrEqual(2); // 心体 + 高光
  });

  it("index.ts 的 HUD 区段零 emoji:token 渲染走手绘资产", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    // 抠出 HUD 构建与渲染区段(hudTokens 起,到 drawPane 止)
    const start = src.indexOf("function hudTokens(");
    const end = src.indexOf("function drawPane(");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const hudSection = src.slice(start, end);
    expect(/\p{Extended_Pictographic}/u.test(hudSection), "HUD 区段还有 emoji 字符").toBe(false);
    // 图标 token 全部落到 art.ts 的手绘函数
    for (const fn of ["drawMiniFace", "drawGhostWisp", "drawHeart", "drawCoinFrame", "drawPowerIcon"]) {
      expect(hudSection.includes(`${fn}(`), `HUD 没接 ${fn}`).toBe(true);
    }
    // 旧写法不许回潮:❤️/🤍/🪙/✋ 与 POWERUPS[...].emoji 不再进 HUD 拼串
    expect(hudSection.includes(".emoji")).toBe(false);
  });
});
