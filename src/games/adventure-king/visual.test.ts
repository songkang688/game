/**
 * 1.3 视觉升级 · 第 17 步 B 档 —— 冒险小王的视觉用例(只增不减)。
 *
 * 全部围绕「只动皮肤不动骨头」:配色 token 与规格表一致、四姿态与荡绳倾角
 * 只读不写、无敌不再整帧消失、reduced 下动效全停但提示保留、
 * destroy 后残影与计时归零。玩法测试文件一个都没改。
 */
import { describe, expect, it } from "vitest";
import {
  AK_CARD,
  AK_HAT_MIN_PX,
  AK_INVINCIBLE_ALPHA,
  AK_LAND_SQUASH,
  AK_LAYER_ORDER,
  AK_PALETTE,
  AK_RUN_LEAN_RAD,
  AK_SCARF_DROOP_RAD,
  AK_SCARF_RUN_RAD,
  AK_TIMING,
  VisualFx,
  anchorGlow,
  artifactSpinPhase,
  boomTrailSegments,
  drawAnchorSprite,
  drawArtifactSprite,
  drawBoomerangSprite,
  drawEnemySprite,
  drawFlagProgress,
  drawHudCard,
  drawPlayerSprite,
  drawRope,
  drawStunFx,
  drawTrail,
  easeOutBack,
  hatDegraded,
  invincibleStyle,
  landSquash,
  playerPose,
  runLean,
  scarfAngle,
  shadeHex,
  shadowGroundY,
  swingLean,
  type AkBrush,
} from "./visual";
import { albumCells, albumSummary, caseGlyph } from "./albumView";
import { STICKER_SETS, stickerId } from "./explore";
import { LEVELS } from "./levels";
import { PLAYER_H, botInput, createBotMemory, createRun, emptyInput, stepRun } from "./sim";
import { inlineCss, readGameFile, readGameSources } from "./qaAudit";

/** 测试用 2D 画笔桩:数笔画、记颜色,别的什么都不做 */
class Brush2D {
  lineWidth = 0;
  lineCap: unknown = "";
  globalAlpha = 1;
  font = "";
  textAlign: unknown = "";
  textBaseline: unknown = "";
  /** 真正落到画布上的笔画数 */
  ops = 0;
  /** 用过的填充色 / 描边色(字符串的才记,渐变记成 "gradient") */
  colors: string[] = [];
  private fillV: unknown = "";
  private strokeV: unknown = "";
  get fillStyle(): unknown {
    return this.fillV;
  }
  set fillStyle(v: unknown) {
    this.fillV = v;
    this.colors.push(typeof v === "string" ? v : "gradient");
  }
  get strokeStyle(): unknown {
    return this.strokeV;
  }
  set strokeStyle(v: unknown) {
    this.strokeV = v;
    this.colors.push(typeof v === "string" ? v : "gradient");
  }
  save(): void {}
  restore(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {
    this.ops++;
  }
  stroke(): void {
    this.ops++;
  }
  fillRect(): void {
    this.ops++;
  }
  fillText(): void {
    this.ops++;
  }
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
}

function brush(): Brush2D & AkBrush {
  return new Brush2D() as Brush2D & AkBrush;
}

const INDEX_SRC = readGameFile("adventure-king", "index.ts");

describe("B 档视觉 · 1. 配色板与规格表一字不差", () => {
  it("八个 token 与四·补一表逐一相等", () => {
    expect(AK_PALETTE).toEqual({
      akHat: "#C89B6C",
      akScarf: "#F4859F",
      akGrass: "#9FD98B",
      akSoil: "#D8B48F",
      akStone: "#B9AFA4",
      akGold: "#F0C25A",
      akRope: "#A87B4F",
      akShadow: "rgba(90,74,60,.16)",
    });
  });

  it("token 格式合法:七个 hex + 一个 rgba 落影", () => {
    for (const [name, value] of Object.entries(AK_PALETTE)) {
      if (name === "akShadow") expect(value).toMatch(/^rgba\(\d+,\d+,\d+,\.\d+\)$/);
      else expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("动效时序表与四·补三一致:90/400/2400/1600ms 与 3(reduced 1)段", () => {
    expect(AK_TIMING.landBounceMs).toBe(90);
    expect(AK_TIMING.invincibleBreathMs).toBe(400);
    expect(AK_TIMING.artifactSpinMs).toBe(2400);
    expect(AK_TIMING.anchorGlowMs).toBe(1600);
    expect(AK_TIMING.boomTrailSegments).toBe(3);
    expect(AK_TIMING.boomTrailSegmentsReduced).toBe(1);
    expect(AK_RUN_LEAN_RAD).toBeCloseTo((8 * Math.PI) / 180, 10);
    expect(AK_SCARF_RUN_RAD).toBeCloseTo((25 * Math.PI) / 180, 10);
    expect(AK_LAND_SQUASH).toBe(0.1);
    expect(AK_INVINCIBLE_ALPHA).toBe(0.55);
  });
});

describe("B 档视觉 · 2. 主角四姿态切换阈值(状态只读不写)", () => {
  it("荡 > 空中 > 落地 90ms 窗口 > 跑,输入冻结也不炸", () => {
    const frozen = Object.freeze({ onGround: true, hasHook: true, sinceLandMs: Infinity });
    expect(playerPose(frozen, false)).toBe("swing");
    expect(playerPose({ onGround: false, hasHook: false, sinceLandMs: Infinity }, false)).toBe("jump");
    expect(playerPose({ onGround: true, hasHook: false, sinceLandMs: 0 }, false)).toBe("land");
    expect(playerPose({ onGround: true, hasHook: false, sinceLandMs: AK_TIMING.landBounceMs - 1 }, false)).toBe("land");
    expect(playerPose({ onGround: true, hasHook: false, sinceLandMs: AK_TIMING.landBounceMs }, false)).toBe("run");
    expect(playerPose({ onGround: true, hasHook: false, sinceLandMs: Infinity }, false)).toBe("run");
  });

  it("reduced 下没有落地姿态(回弹关),其余姿态照常", () => {
    expect(playerPose({ onGround: true, hasHook: false, sinceLandMs: 10 }, true)).toBe("run");
    expect(playerPose({ onGround: false, hasHook: false, sinceLandMs: 10 }, true)).toBe("jump");
    expect(playerPose({ onGround: true, hasHook: true, sinceLandMs: 10 }, true)).toBe("swing");
  });

  it("跑姿前倾封顶 8° 且跟速度、跟朝向", () => {
    expect(runLean(250, 1)).toBeCloseTo(AK_RUN_LEAN_RAD, 10);
    expect(runLean(125, 1)).toBeCloseTo(AK_RUN_LEAN_RAD / 2, 10);
    expect(runLean(250, -1)).toBeCloseTo(-AK_RUN_LEAN_RAD, 10);
    expect(runLean(0, 1)).toBe(0);
  });
});

describe("B 档视觉 · 3. 荡绳倾角只做映射,玩法状态一个数不动", () => {
  it("真挂上绳后调用全部视觉映射,px/py/锚点/绳角原样", () => {
    const lv = LEVELS.find((l) => l.anchors.length > 0)!;
    expect(lv).toBeTruthy();
    const s = createRun(lv);
    const mem = createBotMemory();
    let guard = 0;
    while (!s.hook && s.outcome === "run" && guard < 60 * 120) {
      stepRun(lv, s, botInput(lv, s, mem, 1 / 60), 1 / 60);
      guard++;
    }
    expect(s.hook, "机器人在这关居然没用到抓钩").toBeTruthy();
    const before = {
      px: s.px,
      py: s.py,
      anchor: s.hook!.anchor,
      angle: s.hook!.angle,
      len: s.hook!.len,
      angVel: s.hook!.angVel,
    };
    const lean = swingLean(s.hook!.angle);
    scarfAngle("swing", s.vx, s.hook!.angle, false);
    playerPose({ onGround: s.onGround, hasHook: !!s.hook, sinceLandMs: Infinity }, false);
    invincibleStyle(s.invincible, false);
    expect(lean).toBeCloseTo(Math.max(-1.5, Math.min(1.5, before.angle)), 10);
    expect(s.px).toBe(before.px);
    expect(s.py).toBe(before.py);
    expect(s.hook!.anchor).toBe(before.anchor);
    expect(s.hook!.angle).toBe(before.angle);
    expect(s.hook!.len).toBe(before.len);
    expect(s.hook!.angVel).toBe(before.angVel);
  });

  it("倾角映射对绳角是恒等(±1.5 之外才夹),不产生新数值", () => {
    expect(swingLean(0.6)).toBe(0.6);
    expect(swingLean(-0.9)).toBe(-0.9);
    expect(swingLean(2)).toBe(1.5);
    expect(swingLean(-2)).toBe(-1.5);
  });
});

describe("B 档视觉 · 4. 无敌:半透明分支,每一帧都真的在画", () => {
  it("无敌中 alpha 恒为 0.55,不再有 0 透明的整帧", () => {
    for (let t = 1.5; t > 0; t -= 0.05) {
      const s = invincibleStyle(t, false);
      expect(s.alpha).toBe(AK_INVINCIBLE_ALPHA);
      expect(s.ring).toBeGreaterThanOrEqual(0);
      expect(s.ring).toBeLessThanOrEqual(1);
    }
    expect(invincibleStyle(0, false)).toEqual({ alpha: 1, ring: 0 });
  });

  it("无敌态的主角照样落笔(桩上笔画数 > 0)", () => {
    const b = brush();
    drawPlayerSprite(b, {
      x: 100,
      y: 200,
      scale: 0.6,
      facing: 1,
      pose: "run",
      lean: 0.1,
      scarf: 0.2,
      squash: 0,
      inv: invincibleStyle(0.8, false),
      flutterMs: 0,
      hatBlock: false,
      playerH: PLAYER_H,
    });
    expect(b.ops).toBeGreaterThan(10);
  });

  it("index.ts 里整帧跳过绘制的老闪烁写法已经不存在", () => {
    expect(INDEX_SRC).not.toMatch(/invincible\s*\*\s*10\)\s*%\s*2/);
    expect(INDEX_SRC).toContain("invincibleStyle(run.invincible");
  });
});

describe("B 档视觉 · 5. 无敌时序沿用 sim 的 invincible 计数", () => {
  it("受伤瞬间 invincible 仍是 1.5 秒(玩法常量没被视觉动过)", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    let hurt = false;
    let guard = 0;
    while (!hurt && s.outcome === "run" && guard < 60 * 60) {
      const evs = stepRun(lv, s, { ...emptyInput(), right: true }, 1 / 60);
      hurt = evs.some((e) => e.kind === "hurt");
      guard++;
    }
    expect(hurt).toBe(true);
    expect(s.invincible).toBe(1.5);
    // 呼吸相位随计数变化 —— 视觉只读这个数,不自己开表
    const a = invincibleStyle(1.5, false).ring;
    const b2 = invincibleStyle(1.5 - 0.1, false).ring;
    expect(a).not.toBeCloseTo(b2, 5);
  });
});

describe("B 档视觉 · 6. 平台剖面与锚点微光分支(2D 桩可调用不抛错)", () => {
  it("锚点:可钩(微光)与不可钩(素环)两个分支都能画", () => {
    const b1 = brush();
    drawAnchorSprite(b1, 80, 60, 0.6, anchorGlow(1234, false));
    const b2 = brush();
    drawAnchorSprite(b2, 80, 60, 0.6, null);
    expect(b1.ops).toBeGreaterThan(b2.ops);
    expect(b1.colors).toContain(AK_PALETTE.akGold);
    expect(b2.colors).not.toContain(AK_PALETTE.akGold);
  });

  it("主角四姿态 + 帽子退化分支全部落笔不抛错", () => {
    for (const pose of ["run", "jump", "swing", "land"] as const) {
      for (const hatBlock of [false, true]) {
        const b = brush();
        drawPlayerSprite(b, {
          x: 50,
          y: 100,
          scale: 0.5,
          facing: -1,
          pose,
          lean: pose === "swing" ? swingLean(0.7) : 0,
          scarf: scarfAngle(pose, 200, 0.7, false),
          squash: pose === "land" ? landSquash(30, false) : 0,
          inv: invincibleStyle(0, false),
          flutterMs: 500,
          hatBlock,
          playerH: PLAYER_H,
        });
        expect(b.ops, `${pose}/hatBlock=${hatBlock} 没落笔`).toBeGreaterThan(8);
      }
    }
  });

  it("敌人两种剪影、晕圈星星、双叶镖、绳、HUD 卡、小旗都能画", () => {
    const b = brush();
    drawEnemySprite(b, 60, 120, 0.6, "ground", 1, 300);
    drawEnemySprite(b, 90, 120, 0.6, "flyer", -1, 0);
    drawStunFx(b, 60, 120, 0.6, 0.4, false);
    drawBoomerangSprite(b, 70, 80, 0.6, 2.4, true);
    drawRope(b, 10, 0, 40, 60, 0.6);
    drawHudCard(b, 6, 6, 300, 40);
    drawFlagProgress(b, 16, 37, 280, 0.4);
    drawFlagProgress(b, 16, 37, 280, 7);
    expect(b.ops).toBeGreaterThan(30);
  });
});

describe("B 档视觉 · 7. 回旋镖残影:常态 3 段,reduced 1 段", () => {
  it("段数常量与开关一致", () => {
    expect(boomTrailSegments(false)).toBe(AK_TIMING.boomTrailSegments);
    expect(boomTrailSegments(true)).toBe(AK_TIMING.boomTrailSegmentsReduced);
  });

  it("轨迹画出来的描边笔数不少于段数,reduced 只有一段", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({ x: i * 8, y: 100 - i * 2 }));
    const b3 = brush();
    drawTrail(b3, pts, boomTrailSegments(false), 0.6);
    expect(b3.ops).toBe(3);
    const b1 = brush();
    drawTrail(b1, pts, boomTrailSegments(true), 0.6);
    expect(b1.ops).toBe(1);
    const b0 = brush();
    drawTrail(b0, [{ x: 0, y: 0 }], 3, 0.6);
    expect(b0.ops).toBe(0);
  });
});

describe("B 档视觉 · 8. 文物:金描边 + 底座光柱分支", () => {
  it("有台面时画光柱(渐变),没有台面只画金环,金描边两种都在", () => {
    const withPillar = brush();
    drawArtifactSprite(withPillar, 100, 80, 0.6, "🔶", 0.3, 200);
    const noPillar = brush();
    drawArtifactSprite(noPillar, 100, 80, 0.6, "🔶", 0.3, null);
    expect(withPillar.colors).toContain(AK_PALETTE.akGold);
    expect(noPillar.colors).toContain(AK_PALETTE.akGold);
    expect(withPillar.colors).toContain("gradient");
    expect(withPillar.ops).toBeGreaterThan(noPillar.ops);
  });

  it("自转闪点:常态相位随时间走,一圈正好 2400ms", () => {
    expect(artifactSpinPhase(0, false)).toBe(0);
    expect(artifactSpinPhase(600, false)).toBeCloseTo(0.25, 10);
    expect(artifactSpinPhase(2400, false)).toBe(0);
  });
});

describe("B 档视觉 · 9. 展柜收藏册:只读收藏数据", () => {
  it("未收集 = 剪影问号 + 上锁展柜,已收集 = 展台 + 贴纸名", () => {
    const first = stickerId(0, 0);
    const album = Object.freeze([first]);
    const cells = albumCells(album);
    const total = STICKER_SETS.reduce((n, s) => n + s.items.length, 0);
    expect(cells).toHaveLength(total);
    const got = cells.find((c) => c.id === first)!;
    expect(got.got).toBe(true);
    const gGot = caseGlyph(got);
    expect(gGot.cls).toBe("");
    expect(gGot.label).toBe(STICKER_SETS[0].items[0]);
    const missing = cells.find((c) => c.id === stickerId(0, 1))!;
    expect(missing.got).toBe(false);
    const gMiss = caseGlyph(missing);
    expect(gMiss.text).toBe("❓");
    expect(gMiss.cls).toBe("advk-case-lock");
    // 只读:冻结的入参原样,一张贴纸都没被写
    expect(album).toEqual([first]);
  });

  it("汇总行数字来自入参,不在视图层重算规则", () => {
    expect(albumSummary(3, 32, 1)).toContain("3/32");
    expect(albumSummary(3, 32, 1)).toContain("1 章");
  });

  it("index.ts 的收藏册网格用了展柜类名(2 列起排见 CSS 断言)", () => {
    expect(INDEX_SRC).toContain("advk-museum");
    expect(INDEX_SRC).toContain("advk-case-stand");
  });
});

describe("B 档视觉 · 10. reduced:回弹/闪点/呼吸为 0,提示恒定保留", () => {
  it("落地回弹 reduced 恒 0;常态落地瞬间压扁 10% 再回弹", () => {
    expect(landSquash(0, true)).toBe(0);
    expect(landSquash(45, true)).toBe(0);
    expect(landSquash(0, false)).toBeCloseTo(AK_LAND_SQUASH, 10);
    expect(landSquash(45, false)).toBeLessThan(AK_LAND_SQUASH);
    expect(landSquash(AK_TIMING.landBounceMs, false)).toBe(0);
    expect(easeOutBack(1)).toBeCloseTo(1, 10);
  });

  it("围巾静止微垂、闪点定格左上 45°、锚点恒定亮描边、无敌恒定半透明", () => {
    expect(scarfAngle("run", 250, 0, true)).toBe(AK_SCARF_DROOP_RAD);
    expect(scarfAngle("swing", 0, 1.2, true)).toBe(AK_SCARF_DROOP_RAD);
    expect(artifactSpinPhase(0, true)).toBe(0.125);
    expect(artifactSpinPhase(99999, true)).toBe(0.125);
    expect(anchorGlow(0, true)).toBe(1);
    expect(anchorGlow(12345, true)).toBe(1);
    expect(invincibleStyle(0.7, true)).toEqual({ alpha: AK_INVINCIBLE_ALPHA, ring: 1 });
  });

  it("常态下这些动效真的在动(和 reduced 形成对照)", () => {
    expect(anchorGlow(0, false)).not.toBeCloseTo(anchorGlow(400, false), 5);
    expect(scarfAngle("run", 250, 0, false)).toBeCloseTo(AK_SCARF_RUN_RAD, 10);
    expect(scarfAngle("run", 0, 0, false)).toBeCloseTo(AK_SCARF_DROOP_RAD, 10);
  });
});

describe("B 档视觉 · 11. destroy 后残影与计时归零", () => {
  it("VisualFx.reset 一次清空残影 / 晕圈 / 落地时间戳", () => {
    const fx = new VisualFx();
    for (let i = 0; i < 30; i++) fx.pushTrail(i, i * 2);
    fx.spawnStun(10, 20);
    fx.spawnStun(30, 40);
    fx.markLand(1234);
    expect(fx.trail.length).toBeGreaterThan(0);
    expect(fx.trail.length).toBeLessThanOrEqual(16);
    expect(fx.stuns).toHaveLength(2);
    expect(fx.sinceLand(1300)).toBe(66);
    fx.reset();
    expect(fx.trail).toEqual([]);
    expect(fx.stuns).toEqual([]);
    expect(fx.landAtMs).toBe(-1);
    expect(fx.sinceLand(9999)).toBe(Infinity);
  });

  it("晕圈到点自己退场;index 的 destroy 里真的调了 fx.reset()", () => {
    const fx = new VisualFx();
    fx.spawnStun(0, 0);
    fx.step(AK_TIMING.stunFadeMs + 1);
    expect(fx.stuns).toEqual([]);
    expect(INDEX_SRC).toMatch(/destroy\(\)\s*\{[^}]*fx\.reset\(\)/);
  });
});

describe("B 档视觉 · 12. 图层序 / HUD 双轨统一 / 360px 兜底", () => {
  it("draw() 从底到顶的调用顺序与 AK_LAYER_ORDER 一致", () => {
    const body = INDEX_SRC.slice(INDEX_SRC.indexOf("function draw(): void"), INDEX_SRC.indexOf("function frame("));
    const calls = [
      "drawBackground()",
      "drawMidBushes()",
      "drawPlatforms()",
      "drawAnchors()",
      "drawDoor()",
      "drawArtifacts()",
      "drawEnemies()",
      "drawBoomerang()",
      "drawPlayer()",
      "drawParticles()",
      "drawHud()",
    ];
    expect(AK_LAYER_ORDER).toHaveLength(calls.length);
    let at = -1;
    for (const call of calls) {
      const next = body.indexOf(call);
      expect(next, `draw() 里找不到 ${call} 或顺序不对`).toBeGreaterThan(at);
      at = next;
    }
  });

  it("drawHud 与 renderHud 用同一套卡片规格(12px 圆角 / 白 72% / 1.5px 描边)", () => {
    const sources = readGameSources("adventure-king");
    const css = sources.map(inlineCss).join("\n");
    expect(css).toContain(`border-radius:${AK_CARD.radius}px`);
    expect(css).toContain(AK_CARD.bg);
    expect(css).toContain(`border:${AK_CARD.strokeW}px solid ${AK_CARD.stroke}`);
    expect(INDEX_SRC).toContain("drawHudCard(c2d");
    expect(INDEX_SRC).toContain("AK_CARD.fontMin");
  });

  it("收藏册 2 列起排、宽屏 4 列;帽子 5px 兜底在常见窄屏不触发", () => {
    const css = inlineCss({ name: "index.ts", text: INDEX_SRC });
    expect(css).toMatch(/\.advk-museum\{[^}]*grid-template-columns:repeat\(2,1fr\)/);
    expect(css).toMatch(/@media \(min-width:560px\)\{\.advk-museum\{grid-template-columns:repeat\(4,1fr\)/);
    expect(hatDegraded(AK_HAT_MIN_PX - 0.1)).toBe(true);
    expect(hatDegraded(AK_HAT_MIN_PX)).toBe(false);
    // 360px 手机:cssH = clamp(324, 250, 430) = 324,scale = 324/520,帽檐 27*scale ≈ 16.8px,不退化
    const scale360 = Math.min(430, Math.max(250, Math.round(360 * 0.9))) / 520;
    expect(hatDegraded(27 * scale360)).toBe(false);
    // 最窄 240px 也不退化(兜底只保护极端缩放)
    const scale240 = Math.min(430, Math.max(250, Math.round(240 * 0.9))) / 520;
    expect(hatDegraded(27 * scale240)).toBe(false);
  });

  it("落影投影:荡绳飞在空中时影子落在正下方台面;没有台面就不画", () => {
    const platforms = [
      { x: 0, y: 400, w: 200 },
      { x: 260, y: 360, w: 120 },
    ];
    expect(shadowGroundY(platforms, 100, 300)).toBe(400);
    expect(shadowGroundY(platforms, 300, 200)).toBe(360);
    expect(shadowGroundY(platforms, 230, 300)).toBe(null);
    // 脚已经比台面低就不投(影子不会飘到头顶上)
    expect(shadowGroundY(platforms, 100, 480)).toBe(null);
  });

  it("shadeHex 提亮压暗都在合法 hex 里(渐变三停的原料)", () => {
    expect(shadeHex("#808080", 0)).toBe("#808080");
    expect(shadeHex("#808080", 1)).toBe("#ffffff");
    expect(shadeHex("#808080", -1)).toBe("#000000");
    expect(shadeHex(AK_PALETTE.akGrass, -0.22)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
