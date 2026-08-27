/**
 * 两位主角专属能力的用例:公主滑翔、王子推重物。
 *
 * 前半段测纯函数(不建世界,进什么出什么),
 * 后半段把它们放进真实世界里跑几秒,确认接线也是对的 ——
 * 尤其是「公主推不动但跳得过去,永远卡不死人」这一条。
 */
import { describe, expect, it } from "vitest";

import {
  ABILITIES,
  BLOCK_H,
  BLOCK_W,
  GLIDE_FALL_SPEED,
  GLIDE_MAX_TIME,
  PUSH_SPEED,
  abilityOf,
  blockBox,
  bridgeSpan,
  canGlide,
  canPush,
  fallStep,
  freshGlide,
  glideFraction,
  glideStep,
  needsAlternating,
  pushStep,
} from "./abilities";
import { GRAVITY, createWorld, doubleJumpApex, emptyInput, jumpApex, stepWorld, type Input } from "./logic";
import { allLevels, buildLevel, groundSolidAt, type LevelDef } from "./levels";

function bare(over: Partial<LevelDef> = {}): LevelDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "测试场",
    feature: "测试",
    hint: "测试",
    len: 1600,
    goalX: 1470,
    gaps: [],
    platforms: [],
    enemies: [],
    spikes: [],
    gems: [],
    boss: null,
    slippery: false,
    requiredRatio: 0,
    parSeconds: 40,
    gemGoal: 0,
    timeLimit: 0,
    hearts: 6,
    goalNeedsAll: false,
    blocks: [],
    teach: false,
    noRisk: false,
    alternating: false,
    ...over,
  };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

function run(w: ReturnType<typeof createWorld>, seconds: number, inputs: Input[]): void {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    if (w.status !== "playing") return;
    stepWorld(w, dt, inputs);
  }
}

// ---------------------------------------------------------------------------

describe("公主 · 滑翔", () => {
  it("只有公主会滑,王子按住跳键什么也不会发生", () => {
    expect(canGlide("princess")).toBe(true);
    expect(canGlide("prince")).toBe(false);
    const out = glideStep(freshGlide(), { kind: "prince", onGround: false, holding: true, vy: 500, dt: 1 / 60 });
    expect(out.vy).toBe(500);
    expect(out.glide.active).toBe(false);
    expect(out.glide.left).toBe(GLIDE_MAX_TIME);
  });

  it("下落时按住跳键就降到滑翔速度", () => {
    const out = glideStep(freshGlide(), { kind: "princess", onGround: false, holding: true, vy: 620, dt: 1 / 60 });
    expect(out.vy).toBe(GLIDE_FALL_SPEED);
    expect(out.glide.active).toBe(true);
    expect(out.glide.left).toBeLessThan(GLIDE_MAX_TIME);
  });

  it("松手立刻停,上升段也不算滑", () => {
    const holding = glideStep(freshGlide(), { kind: "princess", onGround: false, holding: false, vy: 400, dt: 1 / 60 });
    expect(holding.glide.active).toBe(false);
    expect(holding.vy).toBe(400);
    const rising = glideStep(freshGlide(), { kind: "princess", onGround: false, holding: true, vy: -300, dt: 1 / 60 });
    expect(rising.glide.active).toBe(false);
    expect(rising.vy).toBe(-300);
  });

  it("一次腾空最多滑 2 秒,额度用光就照常往下掉", () => {
    let state = freshGlide();
    let t = 0;
    const dt = 1 / 60;
    let lastVy = 0;
    for (let i = 0; i < 60 * 4; i++) {
      const out = glideStep(state, { kind: "princess", onGround: false, holding: true, vy: 620, dt });
      state = out.glide;
      lastVy = out.vy;
      if (state.active) t += dt;
    }
    expect(t).toBeGreaterThan(GLIDE_MAX_TIME - 0.05);
    expect(t).toBeLessThanOrEqual(GLIDE_MAX_TIME + 0.02);
    expect(state.left).toBe(0);
    expect(lastVy).toBe(620);
    expect(glideFraction(state)).toBe(0);
  });

  it("落地就把额度加满", () => {
    const spent = { left: 0.2, active: true };
    const out = glideStep(spent, { kind: "princess", onGround: true, holding: true, vy: 0, dt: 1 / 60 });
    expect(out.glide.left).toBe(GLIDE_MAX_TIME);
    expect(glideFraction(out.glide)).toBe(1);
  });

  it("放进真实世界:同样从高处按住跳键,王子直接砸下去,公主飘着慢慢下", () => {
    const drop = (who: 0 | 1): number => {
      const w = createWorld(bare(), 2);
      const h = w.heroes[who];
      h.y = -400;
      h.vy = 60;
      h.onGround = false;
      // 把二段跳先扣掉,单独看滑翔这一件事
      h.airJumps = 0;
      const inputs = [emptyInput(), emptyInput()];
      inputs[who] = press({ right: true, up: true });
      run(w, 0.6, inputs);
      return h.y + 400;
    };
    const princeDrop = drop(0);
    const princessDrop = drop(1);
    expect(princeDrop).toBeGreaterThan(340);
    expect(princessDrop).toBeLessThan(80);
    expect(princessDrop).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("王子 · 推重物", () => {
  const block = () => ({ x: 400, y: 0, vy: 0, bridge: false });

  it("只有王子推得动", () => {
    expect(canPush("prince")).toBe(true);
    expect(canPush("princess")).toBe(false);
    const dt = 1 / 60;
    const byPrince = pushStep(block(), { kind: "prince", x: 360 }, 1, dt);
    expect(byPrince.pushed).toBe(true);
    expect(byPrince.x).toBeCloseTo(400 + PUSH_SPEED * dt, 6);
    expect(byPrince.limit).toBe(PUSH_SPEED);
    const byPrincess = pushStep(block(), { kind: "princess", x: 360 }, 1, dt);
    expect(byPrincess.pushed).toBe(false);
    expect(byPrincess.x).toBe(400);
  });

  it("只能顺着自己站的那一侧往里推,不能隔空往回拽", () => {
    const pullBack = pushStep(block(), { kind: "prince", x: 360 }, -1, 1 / 60);
    expect(pullBack.pushed).toBe(false);
    const fromRight = pushStep(block(), { kind: "prince", x: 440 }, -1, 1 / 60);
    expect(fromRight.pushed).toBe(true);
    expect(fromRight.x).toBeLessThan(400);
  });

  it("架成桥的箱子谁也推不动了", () => {
    const bridged = { x: 400, y: BLOCK_H, vy: 0, bridge: true };
    expect(pushStep(bridged, { kind: "prince", x: 360 }, 1, 1 / 60).pushed).toBe(false);
    expect(bridgeSpan(bridged)).toEqual({ x0: 400 - BLOCK_W / 2, x1: 400 + BLOCK_W / 2 });
    expect(bridgeSpan(block())).toBeNull();
  });

  it("脚下是断口就往下掉,落到底架成一座和地面齐平的桥", () => {
    let b = { x: 400, y: 0, vy: 0, bridge: false };
    for (let i = 0; i < 200 && !b.bridge; i++) b = fallStep(b, null, GRAVITY, 1 / 60);
    expect(b.bridge).toBe(true);
    // 桥面(箱顶)正好落在地面高度上,走上去不会一脚踩空
    expect(b.y - BLOCK_H).toBe(0);
  });

  it("脚下有台面就稳稳停在台面上", () => {
    const rested = fallStep({ x: 400, y: -120, vy: 0, bridge: false }, -80, GRAVITY, 1 / 60);
    expect(rested.y).toBeLessThanOrEqual(-80);
    let b = { x: 400, y: -120, vy: 0, bridge: false };
    for (let i = 0; i < 60; i++) b = fallStep(b, -80, GRAVITY, 1 / 60);
    expect(b.y).toBe(-80);
    expect(b.bridge).toBe(false);
    expect(blockBox(b)).toEqual({ x0: 400 - BLOCK_W / 2, x1: 400 + BLOCK_W / 2, y0: -80 - BLOCK_H, y1: -80 });
  });

  it("放进真实世界:王子顶着走箱子就往前挪,公主顶着走箱子纹丝不动", () => {
    const move = (who: 0 | 1): number => {
      const w = createWorld(bare({ blocks: [{ x: 420, y: 0 }] }), 2);
      w.heroes[who].x = 340;
      const inputs = [emptyInput(), emptyInput()];
      inputs[who] = press({ right: true });
      run(w, 2, inputs);
      return w.blocks[0].x - 420;
    };
    expect(move(0)).toBeGreaterThan(100);
    expect(move(1)).toBe(0);
  });

  it("公主推不动也卡不死:跳一下就能翻过箱子继续往前", () => {
    const w = createWorld(bare({ blocks: [{ x: 420, y: 0 }] }), 2);
    const princess = w.heroes[1];
    princess.x = 330;
    // 一路往右 + 一直点跳:两秒之内必须翻到箱子另一边
    const dt = 1 / 120;
    for (let i = 0; i < 120 * 3; i++) {
      const inputs = [emptyInput(), press({ right: true, up: i % 40 < 12 })];
      stepWorld(w, dt, inputs);
    }
    expect(w.blocks[0].x).toBe(420);
    expect(princess.x).toBeGreaterThan(420 + BLOCK_W / 2);
  });

  it("箱子底下压着的宝石,得等王子把箱子推开才捡得到", () => {
    const def = bare({
      blocks: [{ x: 420, y: 0 }],
      gems: [{ x: 420, y: -BLOCK_H * 0.5, ground: false }],
    });
    const blocked = createWorld(def, 2);
    blocked.heroes[1].x = 420;
    run(blocked, 0.5, [emptyInput(), emptyInput()]);
    expect(blocked.gemsTaken).toBe(0);

    const pushed = createWorld(def, 2);
    pushed.heroes[0].x = 340;
    run(pushed, 2.4, [press({ right: true }), emptyInput()]);
    expect(pushed.blocks[0].x).toBeGreaterThan(460);
    expect(pushed.gemsTaken).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("交替关", () => {
  const LEVELS = allLevels();

  it("两位各有一张能力名片,说明都在 12 个字以内", () => {
    expect(abilityOf("prince")).toBe(ABILITIES.prince);
    expect(abilityOf("princess")).toBe(ABILITIES.princess);
    for (const card of [ABILITIES.prince, ABILITIES.princess]) {
      expect(card.name.length).toBeGreaterThan(1);
      expect(card.howto.length).toBeLessThanOrEqual(12);
      expect(card.icon.length).toBeGreaterThan(0);
    }
    expect(ABILITIES.prince.id).not.toBe(ABILITIES.princess.id);
  });

  it("第 100 关起有一批交替关:既有王子才推得动的箱子,又有公主才够得着的高空宝石", () => {
    const alt = LEVELS.filter((d) => d.alternating);
    expect(alt.length).toBeGreaterThanOrEqual(15);
    for (const def of alt) {
      expect(def.index).toBeGreaterThanOrEqual(99);
      expect(def.blocks.length).toBeGreaterThan(0);
      // 高空那一颗:王子从台上跳起来也够不着,公主二段跳够得着
      const stands = def.platforms.map((p) => p.y);
      const sky = def.gems.filter((g) => !g.ground && stands.some((py) => g.y < py - jumpApex("prince") - 70));
      expect(sky.length, `#${def.index + 1}`).toBeGreaterThan(0);
      for (const gem of sky) {
        const from = Math.max(...stands.filter((py) => py > gem.y));
        expect(gem.y).toBeGreaterThan(from - doubleJumpApex() - 70);
      }
      // 三星要求收齐所有宝石 —— 逼着两位轮流上一次
      expect(def.gemGoal).toBe(def.gems.length);
      expect(needsAlternating({ blocks: def.blocks, glideGems: sky })).toBe(true);
    }
  });

  it("交替关的箱子摆在台子上,不挡主路,推下台也落在实地上", () => {
    for (const def of LEVELS.filter((d) => d.blocks.length > 0)) {
      for (const b of def.blocks) {
        // 箱子在半空的台面上,所以地面主路一点都没被挡住
        expect(b.y).toBeLessThan(0);
        const onPlatform = def.platforms.some((p) => b.x > p.x && b.x < p.x + p.w && p.y === b.y);
        expect(onPlatform, `#${def.index + 1}`).toBe(true);
        // 推下台之后落到的那块地是实的,也没有尖刺
        expect(groundSolidAt(def, b.x), `#${def.index + 1}`).toBe(true);
        expect(def.spikes.some((s) => s.x + s.w > b.x - 40 && s.x < b.x + 40)).toBe(false);
      }
    }
  });

  it("第 100 关之前一个箱子都没有(前 99 关碰撞数据冻结)", () => {
    for (let lv = 0; lv < 99; lv++) {
      expect(buildLevel(lv).blocks).toEqual([]);
      expect(buildLevel(lv).alternating).toBe(false);
    }
  });
});
