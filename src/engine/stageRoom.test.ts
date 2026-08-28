/**
 * 舞台剩余高度(1.3 手机端修复)的回归测试。
 *
 * 手机实拍的病灶:球桌 / 果盆按 `innerHeight - 常数` 猜高度,顶栏与 HUD 一变
 * 就猜错,矮屏上玩法区被 `.game-stage` 裁掉。这里锁死新口径:
 * 真量 `.game-stage`,量不到必须返回 null(调用方退回老估算,不许瞎给数)。
 */
import { describe, expect, it } from "vitest";
import { findStage, measureStageRoom, roomWithin, type StageElementLike } from "./stageRoom";

/** 手搭一个带布局数据的假元素 */
function fakeEl(
  over: Partial<StageElementLike> & { top?: number; bottom?: number }
): StageElementLike {
  const { top, bottom, ...rest } = over;
  const el: StageElementLike = { className: "", parentElement: null, children: [], ...rest };
  if (top !== undefined || bottom !== undefined) {
    el.getBoundingClientRect = () => ({
      top: top ?? 0,
      bottom: bottom ?? 0,
      height: (bottom ?? 0) - (top ?? 0),
    });
  }
  return el;
}

describe("roomWithin(纯函数)", () => {
  it("舞台高减上下占用,负数与 NaN 一律当 0", () => {
    expect(roomWithin(600, 100, 200)).toBe(300);
    expect(roomWithin(600, -50, Number.NaN)).toBe(600);
    expect(roomWithin(Number.NaN, 10, 10)).toBe(0);
  });

  it("挤不下时也不低于 minPx(剩下的靠舞台滚动)", () => {
    expect(roomWithin(300, 200, 200, 180)).toBe(180);
    expect(roomWithin(0, 0, 0, 220)).toBe(220);
  });
});

describe("findStage", () => {
  it("沿 parentElement 找到 .game-stage(类名可以是多个)", () => {
    const stage = fakeEl({ className: "game-stage extra" });
    const mid = fakeEl({ className: "l99-stage", parentElement: stage });
    const leaf = fakeEl({ className: "ps-table", parentElement: mid });
    expect(findStage(leaf)).toBe(stage);
  });

  it("没挂在舞台里返回 null(测试桩没有 parentElement 也一样)", () => {
    expect(findStage(fakeEl({ className: "ps-table" }))).toBeNull();
    expect(findStage(null)).toBeNull();
    // 环形父链不许死循环
    const a = fakeEl({ className: "a" });
    const b = fakeEl({ className: "b", parentElement: a });
    a.parentElement = b;
    expect(findStage(a)).toBeNull();
  });
});

describe("measureStageRoom", () => {
  /** 搭一条壳层真实的链:.game-stage → wrap(带上下 HUD)→ 玩法区 el */
  function chain(opts: { stageTop: number; clientH: number; elTop: number; elBottom: number; wrapBottom: number; scrollTop?: number }) {
    const stage = fakeEl({
      className: "game-stage",
      clientHeight: opts.clientH,
      clientTop: 4,
      scrollTop: opts.scrollTop ?? 0,
      top: opts.stageTop,
      bottom: opts.stageTop + opts.clientH + 8,
    });
    const wrap = fakeEl({ className: "ps-wrap", parentElement: stage, top: opts.elTop - 40, bottom: opts.wrapBottom });
    const el = fakeEl({ className: "ps-table", parentElement: wrap, top: opts.elTop, bottom: opts.elBottom });
    stage.children = [wrap];
    return { stage, wrap, el };
  }

  it("剩余高 = 舞台可视高 − 上方占用 − 下方占用(玩法区自己现在多高不影响结果)", () => {
    // 舞台内容顶 y=104(top 100 + clientTop 4),可视高 500;
    // 玩法区顶 y=200(上方占 96),wrap 一直到 y=760、玩法区底 y=560(下方占 200)
    const { el } = chain({ stageTop: 100, clientH: 500, elTop: 200, elBottom: 560, wrapBottom: 760 });
    expect(measureStageRoom(el)).toBe(500 - 96 - 200);
    // 玩法区变矮(被上一轮 layout 压过)也量出同一个数:下方占用跟着 el 底走
    const short = chain({ stageTop: 100, clientH: 500, elTop: 200, elBottom: 300, wrapBottom: 500 });
    expect(measureStageRoom(short.el)).toBe(500 - 96 - 200);
  });

  it("舞台滚过一截也不算错(scrollTop 补回来)", () => {
    const flat = chain({ stageTop: 100, clientH: 500, elTop: 200, elBottom: 560, wrapBottom: 760 });
    // 同一布局往上滚 80px:所有 rect 上移 80,scrollTop = 80
    const scrolled = chain({ stageTop: 100, clientH: 500, elTop: 120, elBottom: 480, wrapBottom: 680, scrollTop: 80 });
    expect(measureStageRoom(scrolled.el)).toBe(measureStageRoom(flat.el));
  });

  it("挤不下时向 minPx 兜底", () => {
    const { el } = chain({ stageTop: 0, clientH: 300, elTop: 200, elBottom: 260, wrapBottom: 460 });
    expect(measureStageRoom(el, 220)).toBe(220);
  });

  it("量不到一律 null:不在舞台里 / 舞台没高度 / rect 全 0 的测试桩", () => {
    expect(measureStageRoom(fakeEl({ className: "ps-table", top: 10, bottom: 20 }))).toBeNull();

    const stage0 = fakeEl({ className: "game-stage", top: 0, bottom: 0 });
    const el0 = fakeEl({ className: "ps-table", parentElement: stage0, top: 0, bottom: 0 });
    expect(measureStageRoom(el0)).toBeNull();

    const stageFlat = fakeEl({ className: "game-stage", clientHeight: 500, top: 0, bottom: 0 });
    const elFlat = fakeEl({ className: "ps-table", parentElement: stageFlat, top: 0, bottom: 0 });
    expect(measureStageRoom(elFlat)).toBeNull();

    // getBoundingClientRect 会炸的环境(极老的测试桩)也不许把异常漏出去
    const stageBoom = fakeEl({ className: "game-stage", clientHeight: 500, top: 0, bottom: 508 });
    const elBoom: StageElementLike = {
      className: "x",
      parentElement: stageBoom,
      getBoundingClientRect: () => {
        throw new Error("no layout");
      },
    };
    expect(measureStageRoom(elBoom)).toBeNull();
  });
});
