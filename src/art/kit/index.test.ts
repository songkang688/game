import { describe, expect, it } from "vitest";
import * as kit from "./index";

describe("kit 汇总导出", () => {
  it("角色、道具、反馈、调色板、测试桩一个不少", () => {
    expect(typeof kit.drawDuoduo).toBe("function");
    expect(typeof kit.drawXingxing).toBe("function");
    expect(typeof kit.drawCoin).toBe("function");
    expect(typeof kit.drawStar).toBe("function");
    expect(typeof kit.drawHeart).toBe("function");
    expect(typeof kit.drawGem).toBe("function");
    expect(typeof kit.drawSpike).toBe("function");
    expect(typeof kit.drawCrate).toBe("function");
    expect(typeof kit.drawShadow).toBe("function");
    expect(typeof kit.makeCollectBurst).toBe("function");
    expect(typeof kit.drawPlusOne).toBe("function");
    expect(typeof kit.drawSparkle).toBe("function");
    expect(typeof kit.makeStubCtx).toBe("function");
    expect(typeof kit.shade).toBe("function");
    expect(typeof kit.tint).toBe("function");
    expect(kit.KIT_PALETTE).toBeTruthy();
    expect(kit.CHAR_COLORS.duoduo.primary).not.toBe(kit.CHAR_COLORS.xingxing.primary);
  });

  it("从 index 直接画一个场景不抛(游戏侧的最短用法)", () => {
    const stub = kit.makeStubCtx();
    const ctx = stub.ctx;
    kit.drawShadow(ctx, { x: 60, y: 200, w: 40 });
    kit.drawDuoduo(ctx, { x: 60, y: 200, size: 64, pose: "run", t: 0.4 });
    kit.drawXingxing(ctx, { x: 140, y: 200, size: 64, facing: "left", pose: "win" });
    kit.drawCoin(ctx, { x: 220, y: 160, r: 12, t: 0.1 });
    kit.drawPlusOne(ctx, { x: 220, y: 130, t: 0.3 });
    expect(stub.count("fill")).toBeGreaterThan(10);
    expect(stub.nonFiniteArgs).toBe(0);
  });
});
