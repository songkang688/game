import { describe, expect, it } from "vitest";
import { LEVELS, endlessBoard } from "./levels";
import { boardKind, starsFor } from "./logic";
import {
  BOUNCE_MS,
  PREVIEW_KEY,
  PREVIEW_MODES,
  REDUCED_MS,
  RESUME_KEY,
  RESUME_MIN_PIECES,
  SNAP_MS,
  SNAP_RATIO,
  TileBag,
  applyRotate,
  bounceLine,
  cellCenter,
  challengeBadge,
  dropCostsMove,
  dropDistance,
  galleryPeak,
  galleryPieces,
  magnetMs,
  needsResume,
  nearestCell,
  nextPreview,
  parsePreview,
  parseResume,
  parseRotations,
  previewLabel,
  resolveDrop,
  resumeMatches,
  rotateOnce,
  serializeResume,
  serializeRotations,
  snapThreshold,
  undoRotate,
  type GridGeom,
  type ResumeState,
} from "./snap";

const GRID: GridGeom = { left: 100, top: 200, cell: 60, gap: 8, rows: 4, cols: 4 };

describe("拼图乐园 · 吸附与磁性", () => {
  it("吸附阈值就是格宽的 35%", () => {
    expect(SNAP_RATIO).toBeCloseTo(0.35, 5);
    expect(snapThreshold(60)).toBeCloseTo(21, 5);
    expect(snapThreshold(0)).toBe(0);
    expect(SNAP_MS).toBe(120);
    expect(BOUNCE_MS).toBeGreaterThan(0);
  });

  it("最近格判定认得出每一格,拖出画板也夹回最边上那格", () => {
    expect(nearestCell(GRID, 130, 230)).toBe(0);
    const c = cellCenter(GRID, 10);
    expect(nearestCell(GRID, c.x, c.y)).toBe(10);
    expect(nearestCell(GRID, -9999, -9999)).toBe(0);
    expect(nearestCell(GRID, 9999, 9999)).toBe(15);
  });

  it("离格心多远就是多远,格心上就是 0", () => {
    const c = cellCenter(GRID, 5);
    expect(dropDistance(GRID, c.x, c.y)).toBeCloseTo(0, 5);
    expect(dropDistance(GRID, c.x + 12, c.y)).toBeCloseTo(12, 5);
  });

  it("阈值之内吸进去,阈值之外弹回来", () => {
    const c = cellCenter(GRID, 6);
    const opts = { holes: [6, 9], filled: [] as number[], value: 6 };
    expect(resolveDrop(GRID, c.x + 10, c.y, opts)).toEqual({ kind: "snap", pos: 6 });
    const far = resolveDrop(GRID, c.x + 30, c.y, opts);
    expect(far.kind).toBe("bounce");
    if (far.kind === "bounce") expect(far.reason).toBe("far");
  });

  it("放到已经补好的格 / 不是缺口的格,都轻轻弹回,而且不扣步", () => {
    const c = cellCenter(GRID, 9);
    const taken = resolveDrop(GRID, c.x, c.y, { holes: [6, 9], filled: [9], value: 9 });
    expect(taken).toEqual({ kind: "bounce", pos: 9, reason: "taken" });
    expect(dropCostsMove(taken)).toBe(false);
    const notHole = resolveDrop(GRID, c.x, c.y, { holes: [6], filled: [], value: 9 });
    expect(notHole.kind).toBe("bounce");
    expect(dropCostsMove(notHole)).toBe(false);
  });

  it("块放错缺口才算走了一步,吸附成功当然也算", () => {
    const c = cellCenter(GRID, 6);
    const wrong = resolveDrop(GRID, c.x, c.y, { holes: [6, 9], filled: [], value: 9 });
    expect(wrong).toEqual({ kind: "bounce", pos: 6, reason: "wrong" });
    expect(dropCostsMove(wrong)).toBe(true);
    expect(dropCostsMove({ kind: "snap", pos: 6 })).toBe(true);
  });

  it("弹回的每一句话都只解释不责怪", () => {
    for (const reason of ["far", "taken", "wrong"] as const) {
      const line = bounceLine(reason);
      expect(line.length).toBeGreaterThan(4);
      expect(line).not.toContain("错了");
      expect(line).not.toContain("笨");
    }
  });

  it("关掉动效时磁性压到一帧,但位移还在", () => {
    expect(magnetMs(false)).toBe(SNAP_MS);
    expect(magnetMs(true)).toBe(REDUCED_MS);
    expect(magnetMs(true)).toBeGreaterThan(0);
  });
});

describe("拼图乐园 · 预览三档", () => {
  it("三档循环切换,坏存档降级成角落小图", () => {
    expect(PREVIEW_MODES).toEqual(["ghost", "thumb", "none"]);
    expect(parsePreview(null)).toBe("thumb");
    expect(parsePreview("什么都不是")).toBe("thumb");
    expect(parsePreview("none")).toBe("none");
    expect(nextPreview("ghost")).toBe("thumb");
    expect(nextPreview("none")).toBe("ghost");
    expect(PREVIEW_KEY.startsWith("yiduo-yixing.")).toBe(true);
  });

  it("每一档都有看得懂的名字,只有无预览发挑战徽章", () => {
    for (const m of PREVIEW_MODES) expect(previewLabel(m).length).toBeGreaterThan(2);
    expect(challengeBadge("ghost")).toBeNull();
    expect(challengeBadge("thumb")).toBeNull();
    expect(challengeBadge("none")).toContain("徽章");
  });

  it("三档不改三星标准:同样的步数拿同样的星", () => {
    const cfg = LEVELS[0];
    for (const _m of PREVIEW_MODES) {
      expect(starsFor(cfg.three, cfg)).toBe(3);
      expect(starsFor(cfg.two, cfg)).toBe(2);
      expect(starsFor(cfg.two + 1, cfg)).toBe(1);
    }
  });
});

describe("拼图乐园 · 旋转状态与撤销", () => {
  it("点一下转 90°,转四下回到原样", () => {
    expect(rotateOnce(0)).toBe(1);
    expect(rotateOnce(3)).toBe(0);
    expect(rotateOnce(-1)).toBe(0);
    let r = 2;
    for (let i = 0; i < 4; i++) r = rotateOnce(r);
    expect(r).toBe(2);
  });

  it("旋转一步进撤销栈,撤回去和没点过一模一样", () => {
    const rot = [0, 1, 2, 3];
    const { rot: next, step } = applyRotate(rot, 1);
    expect(rot).toEqual([0, 1, 2, 3]);
    expect(next).toEqual([0, 2, 2, 3]);
    expect(step).toEqual({ pos: 1, from: 1, to: 2 });
    expect(undoRotate(next, step)).toEqual(rot);
  });

  it("朝向表存得下也读得回,长度或字符不对就当没存过", () => {
    const rot = [0, 3, 1, 2];
    const raw = serializeRotations(rot);
    expect(raw).toBe("0312");
    expect(parseRotations(raw, 4)).toEqual(rot);
    expect(parseRotations(raw, 5)).toBeNull();
    expect(parseRotations("0319", 4)).toBeNull();
    expect(parseRotations(null, 4)).toBeNull();
  });
});

describe("拼图乐园 · 中途续拼", () => {
  it("只有大画板才存续拼,存档 key 走 yiduo-yixing 前缀", () => {
    expect(RESUME_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(needsResume(3, 3)).toBe(false);
    expect(needsResume(4, 4)).toBe(false);
    expect(needsResume(5, 5)).toBe(true);
    expect(needsResume(6, 6)).toBe(true);
    expect(RESUME_MIN_PIECES).toBe(25);
  });

  it("推格子的续拼存档往返一次不掉字段", () => {
    const s: ResumeState = {
      level: 105,
      kind: "slide",
      total: 25,
      moves: 12,
      board: Array.from({ length: 25 }, (_, i) => (i + 3) % 25),
    };
    const back = parseResume(serializeResume(s));
    expect(back).toEqual(s);
    expect(resumeMatches(back, 105, "slide", 25)).toBe(true);
    expect(resumeMatches(back, 106, "slide", 25)).toBe(false);
    expect(resumeMatches(back, 105, "rotate", 25)).toBe(false);
  });

  it("旋转块与缺块补齐的续拼也存得住", () => {
    const rotState: ResumeState = { level: 130, kind: "rotate", total: 25, moves: 4, rot: new Array(25).fill(0) };
    expect(resumeMatches(parseResume(serializeResume(rotState)), 130, "rotate", 25)).toBe(true);
    const fillState: ResumeState = { level: 150, kind: "fill", total: 25, moves: 2, filled: [3, 7], used: [0, 2] };
    const back = parseResume(serializeResume(fillState));
    expect(back?.filled).toEqual([3, 7]);
    expect(back?.used).toEqual([0, 2]);
    expect(resumeMatches(back, 150, "fill", 25)).toBe(true);
  });

  it("坏数据一律降级成新档,绝不抛异常", () => {
    expect(parseResume(null)).toBeNull();
    expect(parseResume("")).toBeNull();
    expect(parseResume("{ 这不是 json")).toBeNull();
    expect(parseResume("[1,2,3]")).toBeNull();
    expect(parseResume('{"level":-1,"kind":"slide","total":25,"moves":0}')).toBeNull();
    expect(parseResume('{"level":1,"kind":"什么板","total":25,"moves":0}')).toBeNull();
    expect(parseResume('{"level":1,"kind":"slide","total":0,"moves":0}')).toBeNull();
    expect(parseResume('{"level":1,"kind":"slide","total":25,"moves":-3}')).toBeNull();
    // 字段类型不对就丢掉那一项,不影响其它字段
    expect(parseResume('{"level":1,"kind":"slide","total":25,"moves":2,"board":"坏了"}')?.board).toBeUndefined();
    expect(resumeMatches(parseResume('{"level":1,"kind":"slide","total":25,"moves":2}'), 1, "slide", 25)).toBe(false);
  });
});

describe("拼图乐园 · 无尽拼不完的画", () => {
  it("片数随幅数往上走,而且有封顶", () => {
    expect(galleryPieces(1)).toBeGreaterThan(0);
    expect(galleryPeak(30)).toBeGreaterThan(galleryPeak(3));
    expect(galleryPeak(60)).toBe(galleryPeak(200));
    expect(galleryPeak(200)).toBeLessThanOrEqual(36);
  });

  it("三种板式轮着来,每一幅都给得出合法的目标", () => {
    const kinds = new Set<string>();
    for (let i = 1; i <= 24; i++) {
      const cfg = endlessBoard(i);
      kinds.add(boardKind(cfg));
      expect(cfg.three).toBeGreaterThan(0);
      expect(cfg.two).toBeGreaterThanOrEqual(cfg.three);
      expect(cfg.moveLimit).toBeGreaterThan(cfg.two);
    }
    expect(kinds.size).toBe(3);
  });
});

describe("拼图乐园 · 188 关抽样与前 99 关", () => {
  it("抽样各章:板子都拼得完,大画板都进得了续拼名单", () => {
    for (let lv = 0; lv < LEVELS.length; lv += 9) {
      const cfg = LEVELS[lv];
      expect(cfg.rows * cfg.cols, `第 ${lv + 1} 关板子太小`).toBeGreaterThanOrEqual(9);
      expect(cfg.moveLimit).toBeGreaterThan(cfg.three);
      if (cfg.rows * cfg.cols >= RESUME_MIN_PIECES) expect(needsResume(cfg.rows, cfg.cols)).toBe(true);
    }
  });

  it("前 99 关的关卡参数没有被 1.2 动过", () => {
    expect(LEVELS[0]).toEqual({
      rows: 3, cols: 3, shuffleSteps: 8, moveLimit: 50, hints: 3,
      hidePreview: false, theme: 0, three: 16, two: 28,
    });
    for (let lv = 0; lv < 99; lv++) {
      expect(LEVELS[lv].mode).toBeUndefined();
      expect(LEVELS[lv].timeLimit).toBeUndefined();
      expect(LEVELS[lv].seed).toBeUndefined();
    }
  });
});

describe("拼图乐园 · 收摊清理", () => {
  it("指针监听倒干净之后袋子归零,重复倒也不会重复拆", () => {
    const bag = new TileBag();
    let off = 0;
    bag.add(() => off++);
    bag.add(() => off++);
    bag.add(() => off++);
    expect(bag.size).toBe(3);
    bag.clear();
    expect(off).toBe(3);
    expect(bag.size).toBe(0);
    bag.clear();
    expect(off).toBe(3);
  });
});
