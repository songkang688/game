import { describe, expect, it } from "vitest";
import {
  ACCESSORY_MIN_PX,
  BLINK_MS,
  BLINK_PERIOD_MS,
  HEAD_RATIO,
  SHADOW_H_RATIO,
  SHADOW_W_RATIO,
  SQUAT_MS,
  SQUAT_SCALE,
  WALK_FRAME_MS,
  WALK_SWING_PX,
  accessoryMode,
  blinkOn,
  drawChibi,
  walkFrameAt,
  walkSwingPx,
  type ChibiSpec,
  type ChibiState,
} from "./chibi";

/** 记录调用序列的极简 2d 桩:名字 + 关键参数拼成一条条流水 */
function opCtx(): { ctx: CanvasRenderingContext2D; ops: string[]; scales: Array<[number, number]> } {
  const ops: string[] = [];
  const scales: Array<[number, number]> = [];
  const push = (name: string) => (...args: unknown[]) =>
    void ops.push(`${name}(${args.map((a) => (typeof a === "number" ? a.toFixed(1) : String(a))).join(",")})`);
  const rec = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    globalAlpha: 1,
    save: push("save"),
    restore: push("restore"),
    translate: push("translate"),
    scale(x: number, y: number): void {
      scales.push([x, y]);
      ops.push(`scale(${x.toFixed(2)},${y.toFixed(2)})`);
    },
    beginPath: push("beginPath"),
    closePath: push("closePath"),
    moveTo: push("moveTo"),
    lineTo: push("lineTo"),
    quadraticCurveTo: push("quad"),
    arc: push("arc"),
    ellipse: push("ellipse"),
    rect: push("rect"),
    fill: push("fill"),
    stroke: push("stroke"),
    fillRect: push("fillRect"),
    strokeRect: push("strokeRect"),
    createRadialGradient: (...args: number[]) => {
      ops.push(`radial(${args.map((a) => a.toFixed(1)).join(",")})`);
      return { addColorStop: () => {} };
    },
  };
  return { ctx: rec as unknown as CanvasRenderingContext2D, ops, scales };
}

const DUO: ChibiSpec = {
  skin: "#FFE3D2",
  outfit: "#F4859F",
  outfitStyle: "dress",
  accessory: "flower",
  accessoryColor: "#FF9FBE",
};
const STAR: ChibiSpec = {
  skin: "#FFE9D8",
  outfit: "#7FB2F0",
  outfitStyle: "pants",
  accessory: "star",
  accessoryColor: "#FFD678",
};

function draw(spec: ChibiSpec, state: ChibiState): ReturnType<typeof opCtx> {
  const s = opCtx();
  drawChibi(s.ctx, 23, 23, 46, spec, state);
  return s;
}

describe("art/kit chibi · 常量对表", () => {
  it("工序单数值一个不飘:头 0.55 格、影 0.7×0.18、摆 8px、蹲 0.85×120ms、发饰兜底 4px", () => {
    expect(HEAD_RATIO).toBe(0.55);
    expect(SHADOW_W_RATIO).toBe(0.7);
    expect(SHADOW_H_RATIO).toBe(0.18);
    expect(WALK_SWING_PX).toBe(8);
    expect(WALK_FRAME_MS).toBe(160);
    expect(SQUAT_SCALE).toBe(0.85);
    expect(SQUAT_MS).toBe(120);
    expect(ACCESSORY_MIN_PX).toBe(4);
    expect(BLINK_PERIOD_MS).toBe(3000);
    expect(BLINK_MS).toBe(120);
  });
});

describe("art/kit chibi · 两套参数一份函数", () => {
  it("朵朵(花发卡+裙)与星星(星呆毛+裤)走同一个 drawChibi,产出的路径流水不同", () => {
    const a = draw(DUO, { pose: "idle" });
    const b = draw(STAR, { pose: "idle" });
    expect(a.ops.length).toBeGreaterThan(10);
    expect(b.ops.length).toBeGreaterThan(10);
    // 剪影双保险:裙(quad 曲线裙摆)与裤(直筒 lineTo)的流水不可能一样
    expect(a.ops.join("|")).not.toBe(b.ops.join("|"));
  });

  it("圆头走三停径向渐变(radial),两套肤色都画", () => {
    for (const spec of [DUO, STAR]) {
      const s = draw(spec, { pose: "idle" });
      expect(s.ops.some((op) => op.startsWith("radial("))).toBe(true);
    }
  });
});

describe("art/kit chibi · 三态与朝向", () => {
  it("走 / 蹲 / 困 / 常态四种姿势都画得出来,不抛错", () => {
    for (const pose of ["idle", "walk", "squat", "trapped"] as const) {
      expect(() => draw(DUO, { pose, walkFrame: 0 })).not.toThrow();
      expect(() => draw(STAR, { pose, walkFrame: 1 })).not.toThrow();
    }
  });

  it("蹲下是 0.85 倍压扁(scale(1, 0.85)),别的姿势不压", () => {
    const squat = draw(DUO, { pose: "squat" });
    expect(squat.scales.some(([x, y]) => x === 1 && y === SQUAT_SCALE)).toBe(true);
    const idle = draw(DUO, { pose: "idle" });
    expect(idle.scales.some(([, y]) => y === SQUAT_SCALE)).toBe(false);
  });

  it("朝左整体 scaleX(-1) 镜像,朝右不镜像", () => {
    const left = draw(STAR, { pose: "walk", walkFrame: 0, facing: -1 });
    expect(left.scales.some(([x, y]) => x === -1 && y === 1)).toBe(true);
    const right = draw(STAR, { pose: "walk", walkFrame: 0, facing: 1 });
    expect(right.scales.some(([x]) => x === -1)).toBe(false);
  });

  it("被困与埋弹的表情流水和常态不同(哇嘴 / 鼓腮是真的画了别的东西)", () => {
    const idle = draw(DUO, { pose: "idle" }).ops.join("|");
    const trapped = draw(DUO, { pose: "trapped" }).ops.join("|");
    const squat = draw(DUO, { pose: "squat" }).ops.join("|");
    expect(trapped).not.toBe(idle);
    expect(squat).not.toBe(idle);
    expect(squat).not.toBe(trapped);
  });
});

describe("art/kit chibi · 步态与相位", () => {
  it("两帧步态 step 交替:160ms 一帧;摆幅 ±8px,reduced 减半仍保留", () => {
    expect(walkFrameAt(0)).toBe(0);
    expect(walkFrameAt(WALK_FRAME_MS - 1)).toBe(0);
    expect(walkFrameAt(WALK_FRAME_MS)).toBe(1);
    expect(walkFrameAt(WALK_FRAME_MS * 2)).toBe(0);
    expect(walkSwingPx(0)).toBe(WALK_SWING_PX);
    expect(walkSwingPx(1)).toBe(-WALK_SWING_PX);
    expect(walkSwingPx(0, true)).toBe(WALK_SWING_PX / 2);
    expect(walkSwingPx(1, true)).toBe(-WALK_SWING_PX / 2);
  });

  it("发饰缩到 4px 以下换高对比色块兜底;眨眼 3s 一次、一次 120ms、种子错相位", () => {
    expect(accessoryMode(3.9)).toBe("block");
    expect(accessoryMode(4)).toBe("detail");
    expect(accessoryMode(12)).toBe("detail");
    expect(blinkOn(0)).toBe(true);
    expect(blinkOn(BLINK_MS)).toBe(false);
    expect(blinkOn(BLINK_PERIOD_MS)).toBe(true);
    // 两个人的种子错开:同一时刻不同时眨
    expect(blinkOn(0, 0)).not.toBe(blinkOn(0, 1));
  });

  it("兜底色块真的画了 4px 方块(小格子上仍认得出发饰)", () => {
    const s = opCtx();
    // size=20 → 发饰名义尺寸 3.2px < 4px,触发兜底
    drawChibi(s.ctx, 10, 10, 20, DUO, { pose: "idle" });
    expect(s.ops.some((op) => op.startsWith("fillRect"))).toBe(true);
    expect(s.ops.some((op) => op.startsWith("strokeRect"))).toBe(true);
  });
});
