// 寻找外星朋友 · 1.3 视觉升级用例(只增不减):
// 配色板 / 六只差异化 / idle 相位 / peek 只读 / 掀开不动命中区 /
// UFO 仪式时长与 reduced 分支 / 通缉令小卡 / 夜景对比度。
import { describe, expect, it } from "vitest";
import { KINDS, type Spot } from "./logic";
import {
  ALIEN_SPECS,
  ALIEN_TINTS,
  AS_PALETTE,
  HUD_TIMER_MIN_PX,
  IDLE_ANTENNA_MS,
  IDLE_BLINK_MS,
  IDLE_WING_MS,
  LAYER_ORDER,
  MIN_ALIEN_BG_GAP,
  PEEK_REVEAL,
  UFO_BEAM_MS,
  UFO_ENTER_MS,
  UFO_RISE_MS,
  UFO_TOTAL_MS,
  UNCOVER_MS,
  WRONG_SHAKE_MS,
  alienBackdropGap,
  alienPose,
  ceremonyAt,
  featureParts,
  lightenHex,
  luma,
  mixHex,
  silhouetteKey,
  spotUncover,
  uncoverPose,
  wantedCardLayout,
  wrongPose,
  type AlienFeatureKind,
} from "./visual";

describe("配色板与图层序(四·补一)", () => {
  it("八个 token 和规格表一字不差", () => {
    expect(AS_PALETTE.asNebulaA).toBe("#2E2A55");
    expect(AS_PALETTE.asNebulaB).toBe("#4A3E78");
    expect(AS_PALETTE.asStar).toBe("#FFF3C9");
    expect(AS_PALETTE.asHillFar).toBe("#3E3A66");
    expect(AS_PALETTE.asHillNear).toBe("#524A80");
    expect(AS_PALETTE.asBeam).toBe("rgba(180,230,255,.4)");
    expect(AS_PALETTE.asCard).toBe("rgba(255,255,255,.9)");
    expect(AS_PALETTE.asShadow).toBe("rgba(30,26,60,.3)");
  });

  it("六只 tint 沿用既有数组,一个色号没改(存档一致性)", () => {
    expect([...ALIEN_TINTS]).toEqual(["#8fe0c4", "#a9d8ff", "#ffd28f", "#d9bcff", "#b6e89a", "#ffb6c9"]);
  });

  it("图层序从星云到 HUD,藏匿点画在外星人下面、特效在小卡下面", () => {
    expect(LAYER_ORDER[0]).toBe("nebula");
    expect(LAYER_ORDER[LAYER_ORDER.length - 1]).toBe("hud");
    expect(LAYER_ORDER.indexOf("spots")).toBeLessThan(LAYER_ORDER.indexOf("aliens"));
    expect(LAYER_ORDER.indexOf("aliens")).toBeLessThan(LAYER_ORDER.indexOf("effects"));
    expect(LAYER_ORDER.indexOf("effects")).toBeLessThan(LAYER_ORDER.indexOf("wantedCards"));
  });

  it("颜色小工具:mixHex 两端取值正确,lightenHex 单调变亮", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("rgb(0,0,0)");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("rgb(255,255,255)");
    expect(luma("#ffffff")).toBeCloseTo(1, 5);
    expect(lightenHex("#404040", 0.5)).toBe("rgb(160,160,160)");
  });
});

describe("六只外星朋友:剪影级差异", () => {
  it("正好六份 spec,id 互不相同", () => {
    expect(ALIEN_SPECS).toHaveLength(6);
    expect(new Set(ALIEN_SPECS.map((s) => s.id)).size).toBe(6);
  });

  it("16px 下六份剪影两两不相等(6×6 对照,15 对全比)", () => {
    for (let a = 0; a < 6; a++) {
      for (let b = a + 1; b < 6; b++) {
        expect(silhouetteKey(ALIEN_SPECS[a], 16)).not.toBe(silhouetteKey(ALIEN_SPECS[b], 16));
      }
    }
  });

  it("常规尺寸下剪影同样两两可分", () => {
    const keys = ALIEN_SPECS.map((s) => silhouetteKey(s, 30));
    expect(new Set(keys).size).toBe(6);
  });

  const featureCases: Array<[number, AlienFeatureKind]> = [
    [0, "singleAntenna"],
    [1, "twinAntenna"],
    [2, "halo"],
    [3, "twinTail"],
    [4, "tripleAerial"],
    [5, "spiralWing"],
  ];
  it.each(featureCases)("第 %i 只带特征件 %s,且真的画得出来", (idx, feature) => {
    const spec = ALIEN_SPECS[idx];
    expect(spec.feature).toBe(feature);
    const parts = featureParts(spec, 20);
    expect(parts.some((p) => p.kind === feature)).toBe(true);
    for (const p of parts) expect(p.cmds.length).toBeGreaterThan(0);
  });

  it("第六只除了螺旋触角还有一对小翅膀", () => {
    const wings = featureParts(ALIEN_SPECS[5], 20).filter((p) => p.kind === "wing");
    expect(wings).toHaveLength(2);
  });

  it("双触角 / 三天线的数量对得上工序单", () => {
    expect(featureParts(ALIEN_SPECS[1], 20)).toHaveLength(2);
    expect(featureParts(ALIEN_SPECS[4], 20)).toHaveLength(3);
  });

  it("六款眼型互不相同(独眼/三眼/下垂/豆豆/方框/星星)", () => {
    expect(new Set(ALIEN_SPECS.map((s) => s.eyes)).size).toBe(6);
  });
});

describe("idle 小动作:相位错开,reduced 静止", () => {
  it("六只相位常量互不相等", () => {
    expect(new Set(ALIEN_SPECS.map((s) => s.idle.phaseMs)).size).toBe(6);
  });

  it("idle 周期只用规格表的三档(眨眼 3s / 触角 1.4s / 翅膀 600ms)", () => {
    for (const s of ALIEN_SPECS) {
      const want = s.idle.kind === "blink" ? IDLE_BLINK_MS : s.idle.kind === "antenna" ? IDLE_ANTENNA_MS : IDLE_WING_MS;
      expect(s.idle.periodMs).toBe(want);
    }
    expect(IDLE_BLINK_MS).toBe(3000);
    expect(IDLE_ANTENNA_MS).toBe(1400);
    expect(IDLE_WING_MS).toBe(600);
  });

  it("reduced 时姿态全静止,只剩静态层次", () => {
    for (const s of ALIEN_SPECS) {
      const p = alienPose(s, false, 1234, true);
      expect(p.blink).toBe(0);
      expect(p.antennaSwing).toBe(0);
      expect(p.wingAngle).toBe(0);
      expect(p.eyeShift).toBe(0);
      expect(p.reveal).toBe(1);
    }
  });

  it("不 reduced 时每只只动自己那一样(触角只弹触角,翅膀只扇翅膀)", () => {
    const t = 350; // 挑一个不在整周期上的时刻
    for (const s of ALIEN_SPECS) {
      const p = alienPose(s, false, t, false);
      if (s.idle.kind !== "antenna") expect(p.antennaSwing).toBe(0);
      if (s.idle.kind !== "wing") expect(p.wingAngle).toBe(0);
    }
  });
});

describe("peek 探头态:只读参数,不写一个字段", () => {
  it("peek 只露上半身(reveal=PEEK_REVEAL<1),spec 冻结后原样不动", () => {
    for (const raw of ALIEN_SPECS) {
      const snapshot = JSON.parse(JSON.stringify(raw));
      const frozen = Object.freeze({ ...raw, idle: Object.freeze({ ...raw.idle }) });
      const p = alienPose(frozen, true, 777, false);
      expect(p.reveal).toBe(PEEK_REVEAL);
      expect(PEEK_REVEAL).toBeLessThan(1);
      expect(raw).toEqual(snapshot);
    }
  });

  it("peek 时眼睛会左右瞟,reduced 时瞟眼也停", () => {
    const s = ALIEN_SPECS[0];
    const shifts = [150, 400, 650].map((t) => alienPose(s, true, t, false).eyeShift);
    expect(new Set(shifts.map((v) => v.toFixed(4))).size).toBeGreaterThan(1);
    expect(alienPose(s, true, 400, true).eyeShift).toBe(0);
  });
});

describe("藏匿点掀开:纯画法参数,命中区一个像素不动", () => {
  it.each([...KINDS])("%s:冻结的 Spot 掀开前后 x/y/r 完全相等", (kind) => {
    const spot: Spot = Object.freeze({ x: 320, y: 240, r: 52, kind, color: "粉", big: true });
    const before = { x: spot.x, y: spot.y, r: spot.r, kind: spot.kind, color: spot.color, big: spot.big };
    for (const progress of [0, 0.3, 0.5, 1]) {
      const pose = spotUncover(spot, progress);
      expect(pose.gap).toBeGreaterThanOrEqual(0);
      expect(pose.gap).toBeLessThanOrEqual(1);
    }
    expect({ x: spot.x, y: spot.y, r: spot.r, kind: spot.kind, color: spot.color, big: spot.big }).toEqual(before);
  });

  it("掀开进度 0 全关、1 全开,时长常量 240ms", () => {
    for (const kind of KINDS) {
      expect(uncoverPose(kind, 0).gap).toBe(0);
      expect(uncoverPose(kind, 1).gap).toBe(1);
    }
    expect(UNCOVER_MS).toBe(240);
  });
});

describe("点错反馈:轻晃 + 问号云,不批评", () => {
  it("时长 320ms;动画中段真的在晃,到点收工", () => {
    expect(WRONG_SHAKE_MS).toBe(320);
    const mid = wrongPose(120, false);
    expect(Math.abs(mid.shakeX)).toBeGreaterThan(0);
    expect(mid.done).toBe(false);
    expect(wrongPose(WRONG_SHAKE_MS, false).done).toBe(true);
  });

  it("reduced:一点不晃,只出一帧静态问号云", () => {
    const early = wrongPose(50, true);
    expect(early.shakeX).toBe(0);
    expect(early.cloudAlpha).toBe(1);
    expect(early.cloudScale).toBe(1);
    expect(wrongPose(WRONG_SHAKE_MS + 1, true).done).toBe(true);
  });
});

describe("UFO 找到仪式:全链 ≤ 1200ms,reduced 走静态分支", () => {
  it("三段常量求和 = UFO_TOTAL_MS 且不超 1200(飘入 400 / 光束 300 / 上升 500)", () => {
    expect(UFO_ENTER_MS).toBe(400);
    expect(UFO_BEAM_MS).toBe(300);
    expect(UFO_RISE_MS).toBe(500);
    expect(UFO_ENTER_MS + UFO_BEAM_MS + UFO_RISE_MS).toBe(UFO_TOTAL_MS);
    expect(UFO_TOTAL_MS).toBeLessThanOrEqual(1200);
  });

  it("时间轴按 enter → beam → rise → done 分段", () => {
    expect(ceremonyAt(0, false).phase).toBe("enter");
    expect(ceremonyAt(UFO_ENTER_MS + 1, false).phase).toBe("beam");
    expect(ceremonyAt(UFO_ENTER_MS + UFO_BEAM_MS + 1, false).phase).toBe("rise");
    expect(ceremonyAt(UFO_TOTAL_MS, false).phase).toBe("done");
    // 上升段真的在升
    expect(ceremonyAt(UFO_ENTER_MS + UFO_BEAM_MS + UFO_RISE_MS - 1, false).riseK).toBeGreaterThan(0.9);
  });

  it("reduced:任何时刻都是静态光圈 + 挥手一帧,不上升不飘入", () => {
    for (const t of [0, 300, 900, 1199]) {
      const f = ceremonyAt(t, true);
      expect(f.phase).toBe("static");
      expect(f.riseK).toBe(0);
      expect(f.waveK).toBe(1);
      expect(f.beamK).toBe(1);
    }
  });
});

describe("通缉令小卡与 HUD", () => {
  it("小卡排版含别针 / 半身像 / 名字条三件套", () => {
    const card = wantedCardLayout(40, 40);
    expect(card.parts).toContain("pin");
    expect(card.parts).toContain("portrait");
    expect(card.parts).toContain("nameStrip");
  });

  it("名字条贴卡底、半身像在名字条上方、别针在顶部,都不出卡", () => {
    const card = wantedCardLayout(40, 40);
    expect(card.nameStrip.y + card.nameStrip.h).toBeLessThanOrEqual(card.h);
    expect(card.portrait.y).toBeLessThan(card.nameStrip.y);
    expect(card.pin.y).toBeLessThan(card.portrait.y);
    expect(card.nameStrip.x).toBeGreaterThanOrEqual(0);
    expect(card.nameStrip.x + card.nameStrip.w).toBeLessThanOrEqual(card.w);
  });

  it("计时字号下限 ≥ 14px(360px 手机可读)", () => {
    expect(HUD_TIMER_MIN_PX).toBeGreaterThanOrEqual(14);
  });
});

describe("夜景对比度:朋友要在夜空里一眼认出来", () => {
  it.each([...ALIEN_TINTS])("tint %s 与星云底的明度差 ≥ 20%", (tint) => {
    expect(alienBackdropGap(tint)).toBeGreaterThanOrEqual(MIN_ALIEN_BG_GAP);
  });

  it("干扰装饰与藏匿点明度隔离:亮星色比任何 tint 都更亮,丘陵比夜空更暗", () => {
    for (const tint of ALIEN_TINTS) expect(luma(AS_PALETTE.asStar)).toBeGreaterThan(luma(tint) - 0.06);
    expect(luma(AS_PALETTE.asHillFar)).toBeLessThan(luma("#8fe0c4"));
    expect(luma(AS_PALETTE.asHillNear)).toBeLessThan(luma("#8fe0c4"));
  });
});
