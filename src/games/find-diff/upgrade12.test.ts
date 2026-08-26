/**
 * 找不同 · 1.2 升级验收（C 档，第 25 步）。
 *
 * 分五块：
 *  1. 公平性校验器跑遍 188 关全量与无尽前 60 轮，并反过来证明校验器自己有牙；
 *  2. 前 99 关一字未改（整份生成结果做 SHA-256 钉死）；
 *  3. 差异类型、命中容差、错点冷却、缩放、两级提示这几件事的数值；
 *  4. 无尽的难度曲线与成绩写入；
 *  5. 外壳巡检：`fdf-` 前缀、destroy 归零、360px 下限、红线。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chapterOf } from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import { meta } from "./meta";
import { CHAPTERS, LEGACY_CHAPTER_COUNT, LEVELS, buildBoards } from "./levels";
import {
  COUNT_OFFSET,
  FLIPPABLE,
  GLYPH_RATIO,
  KIND_MENU,
  LEGACY_LEVEL_COUNT,
  SHIFT_AMOUNT,
  buildEndlessScene,
  buildScene,
  cellExtent,
  endlessKinds,
  endlessLookalikeRatio,
  endlessSize,
  endlessTime,
  hintBudget,
  kindBetween,
  plainCell,
  sameCell,
  sourceIndex,
  validateAllLevels,
  validateScene,
  type CellView,
  type DiffKind,
  type Scene,
} from "./scene12";
import {
  HIT_RADIUS_RATIO,
  MIN_HIT_RADIUS,
  MISS_COOLDOWN_MS,
  SPAM_COOLDOWN_MS,
  ZOOM_MAX,
  ZOOM_MIN,
  clampPan,
  clampZoom,
  hintArea,
  hintStageOf,
  hintsUsed,
  hitRadius,
  miniCellPx,
  missCooldownMs,
  openLevelOnMap,
  panelCellPx,
  parseLevelParam,
  pickNearest,
  pinchZoom,
  resolveInitialLevel,
  shouldSuggestZoom,
} from "./runtime";
import { MIN_GLYPH_PX, PLAY_CELL_PX, endlessLine, starsFor } from "./index";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const sceneSrc = readFileSync(`${dir}scene12.ts`, "utf8");
const runtimeSrc = readFileSync(`${dir}runtime.ts`, "utf8");
const css = shell.slice(shell.indexOf("const CSS = `"), shell.indexOf("\n`;\n"));

/** 每一关（连环挑战按轮拆开）的场景 */
function allScenes(): Scene[] {
  const out: Scene[] = [];
  for (let level = 0; level < LEVELS.length; level++) {
    for (let round = 0; round < Math.max(1, LEVELS[level].rounds); round++) out.push(buildScene(level, round));
  }
  return out;
}

/** 深拷贝一个场景，方便往里注入故障来验校验器 */
function clone(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

// ---------------------------------------------------------------------------
// 1. 公平性校验器
// ---------------------------------------------------------------------------

describe("找不同 1.2 · validateScene 跑全量", () => {
  it("188 关（连环挑战逐轮）一条问题都挑不出来", () => {
    const problems = validateAllLevels();
    expect(problems, problems.slice(0, 5).join("\n")).toEqual([]);
  });

  it("每一关的差异点数量、可视区、格距、唯一性、坐标可逆五条都过", () => {
    for (const scene of allScenes()) {
      const n = scene.rows * scene.cols;
      expect(scene.diffIdx, `第 ${scene.level + 1} 关`).toHaveLength(
        scene.level >= 0 ? LEVELS[scene.level].diffs : 3
      );
      expect(new Set(scene.diffIdx).size).toBe(scene.diffIdx.length);
      for (const j of scene.diffIdx) {
        expect(j).toBeGreaterThanOrEqual(0);
        expect(j).toBeLessThan(n);
        expect(cellExtent(scene.right[j])).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      for (let j = 0; j < n; j++) expect(sourceIndex(scene, sourceIndex(scene, j))).toBe(j);
    }
  });

  it("无尽前 60 轮同样全过", () => {
    const problems: string[] = [];
    for (let r = 1; r <= 60; r++) problems.push(...validateScene(buildEndlessScene(r)));
    expect(problems, problems.slice(0, 5).join("\n")).toEqual([]);
  });

  it("校验器有牙 · 漏标一个差异点会被当成「答案不唯一」抓出来", () => {
    const bad = clone(buildScene(120));
    bad.diffIdx = bad.diffIdx.slice(1);
    bad.kinds = bad.kinds.slice(1);
    expect(validateScene(bad).some((m) => m.includes("答案不唯一"))).toBe(true);
  });

  it("校验器有牙 · 标了一个其实没变的格子也会被抓", () => {
    const scene = buildScene(30);
    const bad = clone(scene);
    const spare = [...Array(scene.rows * scene.cols).keys()].find((i) => !scene.diffIdx.includes(i))!;
    bad.diffIdx = [...bad.diffIdx, spare].sort((a, b) => a - b);
    bad.kinds = [...bad.kinds, "swap"];
    expect(validateScene(bad).some((m) => m.includes("两图看起来一样"))).toBe(true);
  });

  it("校验器有牙 · 图案被推出格子（位移过大 / 两个图案没缩小）会被抓", () => {
    const bad = clone(buildScene(130));
    const j = bad.diffIdx[0];
    bad.right[j] = { ...bad.right[j], dx: 0.45, dy: 0 };
    bad.kinds[0] = "shift";
    expect(validateScene(bad).some((m) => m.includes("推出了格子"))).toBe(true);

    const crowded = clone(buildScene(130));
    const k = crowded.diffIdx[0];
    crowded.right[k] = { ...crowded.right[k], count: 2, scale: 1 };
    crowded.kinds[0] = "count";
    expect(validateScene(crowded).some((m) => m.includes("挤成一团"))).toBe(true);
  });

  it("校验器有牙 · 两个答案挤在同一格会被抓", () => {
    const bad = clone(buildScene(60));
    bad.diffIdx = [bad.diffIdx[0], bad.diffIdx[0], ...bad.diffIdx.slice(2)];
    expect(validateScene(bad).some((m) => m.includes("两个答案"))).toBe(true);
  });

  it("校验器有牙 · 左右翻落在对称图案上（翻了也看不出）会被抓", () => {
    const bad = clone(buildScene(170));
    const j = bad.diffIdx[0];
    bad.right[j] = { ...plainCell("🔔"), flip: true };
    bad.left[sourceIndex(bad, j)] = plainCell("🔔");
    bad.kinds[0] = "flip";
    expect(validateScene(bad).some((m) => m.includes("翻过来看不出区别"))).toBe(true);
  });

  it("校验器有牙 · 镜像关如果按非镜像去对，会立刻炸出一堆不唯一", () => {
    const mirror = buildScene(150);
    expect(mirror.mirrored).toBe(true);
    expect(validateScene(mirror)).toEqual([]);
    const bad = clone(mirror);
    bad.mirrored = false;
    expect(validateScene(bad).length).toBeGreaterThan(0);
  });

  it("校验器有牙 · 三图关的干扰格若在下图也变了（冒出第二个答案）会被抓", () => {
    const triple = buildScene(105);
    expect(triple.second).not.toBeNull();
    expect(triple.decoyIdx.length).toBeGreaterThan(0);
    const bad = clone(triple);
    const i = bad.decoyIdx[0];
    bad.right[i] = { ...bad.right[i], tint: "#ffe3e3" };
    expect(validateScene(bad).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. 前 99 关一字未改
// ---------------------------------------------------------------------------

describe("找不同 1.2 · 前 99 关逐关快照", () => {
  /** 升级前实测的整份生成结果指纹（LEVELS[0..98] + buildBoards(0..98)） */
  const LEGACY_FINGERPRINT = "2c368b63559805942e31d6884f8a9a3a4600d927baf665f18cf00cbf7bbfa621";

  it("生成参数与棋盘整份做 SHA-256，与升级前逐字一致", () => {
    const rows: string[] = [];
    for (let i = 0; i < LEGACY_LEVEL_COUNT; i++) {
      rows.push(JSON.stringify({ cfg: LEVELS[i], boards: buildBoards(i) }));
    }
    expect(createHash("sha256").update(rows.join("\n")).digest("hex")).toBe(LEGACY_FINGERPRINT);
  });

  it("LEGACY_CHAPTER_COUNT 覆盖的正好是前 99 关", () => {
    expect(LEGACY_CHAPTER_COUNT).toBe(6);
    expect(LEGACY_LEVEL_COUNT).toBe(99);
  });

  it("1.2 的场景层在前 99 关只是包了一层默认外观：emoji 一样、六个外观维度全是原值", () => {
    for (let i = 0; i < LEGACY_LEVEL_COUNT; i++) {
      const board = buildBoards(i)[0];
      const scene = buildScene(i);
      expect(scene.left.map((c) => c.emoji), `第 ${i + 1} 关`).toEqual(board.base);
      expect(scene.right.map((c) => c.emoji)).toEqual(board.changed);
      expect(scene.diffIdx).toEqual(board.diffIdx);
      expect(new Set(scene.kinds)).toEqual(new Set(["swap"]));
      for (const cell of scene.left.concat(scene.right)) {
        expect(sameCell(cell, plainCell(cell.emoji)), `第 ${i + 1} 关外观被动过`).toBe(true);
      }
    }
  });

  it("前 99 关的模式、章节主题与关数都还是老样子", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual([17, 17, 17, 16, 16, 16]);
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].mode).toBe("classic");
      expect(LEVELS[i].theme).toBeLessThan(6);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. 差异类型 / 命中 / 冷却 / 缩放 / 提示
// ---------------------------------------------------------------------------

describe("找不同 1.2 · 六种差异类型", () => {
  it("每一章的类型分布正好等于这一章的菜单", () => {
    const perChapter = new Map<number, Set<DiffKind>>();
    for (const scene of allScenes()) {
      const ci = chapterOf(CHAPTERS, scene.level);
      const set = perChapter.get(ci) ?? new Set<DiffKind>();
      for (const k of scene.kinds) set.add(k);
      perChapter.set(ci, set);
    }
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      expect([...(perChapter.get(ci) ?? [])].sort(), `第 ${ci + 1} 章`).toEqual([...KIND_MENU[ci]].sort());
    }
    // 前 6 章永远只有「换 emoji」，后 4 章都是混合
    for (let ci = 0; ci < LEGACY_CHAPTER_COUNT; ci++) expect(KIND_MENU[ci]).toEqual(["swap"]);
    for (let ci = LEGACY_CHAPTER_COUNT; ci < CHAPTERS.length; ci++) {
      expect(KIND_MENU[ci].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("六种类型在 188 关里一种都不缺", () => {
    const seen = new Set<DiffKind>();
    for (const scene of allScenes()) for (const k of scene.kinds) seen.add(k);
    expect([...seen].sort()).toEqual(["count", "flip", "shift", "size", "swap", "tint"]);
  });

  it("声明的类型与实际改动的维度对得上（换 emoji 就真换了、变底色就真上色了）", () => {
    for (const scene of allScenes()) {
      scene.diffIdx.forEach((j, k) => {
        expect(kindBetween(scene.left[sourceIndex(scene, j)], scene.right[j]), `第 ${scene.level + 1} 关`).toBe(
          scene.kinds[k]
        );
      });
    }
  });

  it("「变朝向」只用在左右翻得出来的图案上", () => {
    let flips = 0;
    for (const scene of allScenes()) {
      scene.diffIdx.forEach((j, k) => {
        if (scene.kinds[k] !== "flip") return;
        flips++;
        expect(FLIPPABLE.has(scene.right[j].emoji)).toBe(true);
      });
    }
    expect(flips).toBeGreaterThan(20);
  });

  it("位移与「多一个」的幅度都收在格子里（可视区口径与渲染一致）", () => {
    expect(SHIFT_AMOUNT + GLYPH_RATIO / 2).toBeLessThanOrEqual(0.5);
    expect(COUNT_OFFSET + (GLYPH_RATIO * 0.62) / 2).toBeLessThanOrEqual(0.5);
    const pushed: CellView = { ...plainCell("🐟"), dx: 0.4 };
    expect(cellExtent(pushed)).toBeGreaterThan(0.5);
  });
});

describe("找不同 1.2 · 命中容差与就近命中", () => {
  it("命中半径 = max(格宽 × 0.55, 22px)", () => {
    expect(HIT_RADIUS_RATIO).toBe(0.55);
    expect(MIN_HIT_RADIUS).toBe(22);
    expect(hitRadius(44)).toBeCloseTo(24.2, 5);
    expect(hitRadius(30)).toBe(22);
    expect(hitRadius(0)).toBe(22);
    expect(hitRadius(80)).toBe(44);
  });

  it("再小的格子也留出 ≥ 44px 直径的热区（360px 竖屏红线）", () => {
    for (const px of [20, 28, 32, 44]) expect(hitRadius(px) * 2).toBeGreaterThanOrEqual(44);
    expect(PLAY_CELL_PX).toBeGreaterThanOrEqual(44);
  });

  it("点在两格中间时取更近的那一个", () => {
    const cells = [
      { index: 3, cx: 0, cy: 0 },
      { index: 4, cx: 48, cy: 0 },
    ];
    const r = hitRadius(44);
    expect(pickNearest(cells, 20, 0, r)).toBe(3);
    expect(pickNearest(cells, 30, 0, r)).toBe(4);
    // 缝隙里也算命中（容差 > 半格）
    expect(pickNearest(cells, 24, 0, r)).toBe(3);
  });

  it("半径外一个都够不着就当没点到，什么都不发生", () => {
    const cells = [{ index: 0, cx: 0, cy: 0 }];
    expect(pickNearest(cells, 100, 100, hitRadius(44))).toBeNull();
    expect(pickNearest([], 0, 0, 22)).toBeNull();
  });
});

describe("找不同 1.2 · 点错只冷却，绝不判负", () => {
  it("单次错点冷却 0.6 秒", () => {
    expect(MISS_COOLDOWN_MS).toBe(600);
    expect(missCooldownMs([1000], 1000)).toBe(600);
    expect(missCooldownMs([100, 400, 900], 900)).toBe(600);
  });

  it("1 秒内错点 ≥ 5 次判为乱扫，冷却翻倍到 1.2 秒", () => {
    expect(SPAM_COOLDOWN_MS).toBe(MISS_COOLDOWN_MS * 2);
    expect(missCooldownMs([100, 200, 300, 400, 500], 500)).toBe(1200);
    // 窗口外的旧错点不算数
    expect(missCooldownMs([0, 100, 200, 300, 1600], 1600)).toBe(600);
  });

  it("星级只按点错次数给，最差也保底 1 星（点错不再判负）", () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(3);
    expect(starsFor(4)).toBe(2);
    expect(starsFor(99)).toBe(1);
  });

  it("玩法代码里再没有「点错就失败」这条路：ctx.lose 只挂在时间到上，maxMiss 不再参与判负", () => {
    const loses = shell.match(/ctx\.lose\(/g) ?? [];
    expect(loses).toHaveLength(1);
    const at = shell.indexOf("ctx.lose(");
    expect(shell.slice(at, at + 120)).toContain("时间到");
    expect(shell).not.toContain("maxMiss");
    expect(shell).not.toMatch(/misses\s*>\s*cfg/);
  });
});

describe("找不同 1.2 · 放大镜：1×–2.5× 双图联动", () => {
  it("倍数夹在 1×–2.5×", () => {
    expect(ZOOM_MIN).toBe(1);
    expect(ZOOM_MAX).toBe(2.5);
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(2.5);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(1.8)).toBe(1.8);
  });

  it("双指捏合按两指间距的比例缩放", () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(1, 100, 400)).toBe(2.5);
    expect(pinchZoom(2, 100, 50)).toBe(1);
    expect(pinchZoom(1.5, 0, 200)).toBe(1.5);
  });

  it("平移被夹在边界内，1× 时根本拖不动", () => {
    expect(clampPan(999, 2, 300)).toBe(150);
    expect(clampPan(-999, 2, 300)).toBe(-150);
    expect(clampPan(40, 1, 300)).toBe(0);
    expect(clampPan(Number.NaN, 2, 300)).toBe(0);
  });

  it("1× 下格子偏小就提示可以放大", () => {
    expect(shouldSuggestZoom(30, 1)).toBe(true);
    expect(shouldSuggestZoom(30, 1.5)).toBe(false);
    expect(shouldSuggestZoom(48, 1)).toBe(false);
  });

  it("两图共用同一个 .fdf-zoom 容器，所以放大一定是联动的", () => {
    expect(shell).toContain(`<div class="fdf-viewport"><div class="fdf-zoom"><div class="fdf-panels">`);
    expect((shell.match(/zoomBox\.style\.transform/g) ?? [])).toHaveLength(1);
    // 上下两张图都挂在同一个 panels 里
    expect((shell.match(/panelsEl\.appendChild/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("找不同 1.2 · 提示先圈区域再指点", () => {
  it("奇数次给区域、偶数次才精确指出，一来一回算一次额度", () => {
    expect(hintStageOf(1)).toBe("area");
    expect(hintStageOf(2)).toBe("spot");
    expect(hintStageOf(3)).toBe("area");
    expect(hintsUsed(1)).toBe(1);
    expect(hintsUsed(2)).toBe(1);
    expect(hintsUsed(3)).toBe(2);
  });

  it("区域就是以目标为中心的 3×3，贴边自动收窄且不会绕到隔壁行", () => {
    const mid = hintArea(6, 4, 5);
    expect(mid.sort((a, b) => a - b)).toEqual([0, 1, 2, 5, 6, 7, 10, 11, 12]);
    expect(hintArea(0, 4, 5).sort((a, b) => a - b)).toEqual([0, 1, 5, 6]);
    expect(hintArea(19, 4, 5).sort((a, b) => a - b)).toEqual([13, 14, 18, 19]);
    expect(hintArea(99, 4, 5)).toEqual([]);
    for (const i of hintArea(5, 4, 5)) expect(Math.abs((i % 5) - 0)).toBeLessThanOrEqual(1);
  });

  it("提示次数按章节递减，最少也还有 1 次，且用完不阻塞过关", () => {
    const budgets = CHAPTERS.map((_, ci) => hintBudget(ci));
    expect(budgets[0]).toBeGreaterThan(budgets[budgets.length - 1]);
    for (let i = 1; i < budgets.length; i++) expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1]);
    expect(Math.min(...budgets)).toBeGreaterThanOrEqual(1);
    expect(shell).toContain("提示用完啦（不影响过关）");
  });

  it("第一级提示只圈范围，不会直接把那一格点出来", () => {
    const scene = buildScene(140);
    const target = scene.diffIdx[0];
    const area = hintArea(target, scene.rows, scene.cols);
    expect(area).toContain(target);
    expect(area.length).toBeGreaterThanOrEqual(4);
    expect(shell.indexOf("fdf-hintarea")).toBeLessThan(shell.indexOf("fdf-hintspot"));
  });
});

// ---------------------------------------------------------------------------
// 4. 无尽：找不同马拉松
// ---------------------------------------------------------------------------

describe("找不同 1.2 · 无尽马拉松", () => {
  it("每轮固定 3 处不同，且同一轮重开长得一样", () => {
    for (const r of [1, 5, 12, 30]) {
      const a = buildEndlessScene(r);
      expect(a.diffIdx).toHaveLength(3);
      expect(JSON.stringify(a)).toBe(JSON.stringify(buildEndlessScene(r)));
    }
  });

  it("难度单调上升：网格只大不小、时间只减不增、双胞胎比例只升不降", () => {
    let cells = 0;
    let time = Number.POSITIVE_INFINITY;
    let ratio = -1;
    for (let r = 1; r <= 40; r++) {
      const size = endlessSize(r);
      expect(size.rows * size.cols).toBeGreaterThanOrEqual(cells);
      expect(endlessTime(r)).toBeLessThanOrEqual(time);
      expect(endlessLookalikeRatio(r)).toBeGreaterThanOrEqual(ratio);
      cells = size.rows * size.cols;
      time = endlessTime(r);
      ratio = endlessLookalikeRatio(r);
    }
    expect(endlessSize(1)).toEqual({ rows: 3, cols: 3 });
    expect(endlessSize(40).rows * endlessSize(40).cols).toBeGreaterThan(9);
    expect(endlessTime(99)).toBeGreaterThanOrEqual(20);
    expect(endlessLookalikeRatio(1)).toBe(0);
    expect(endlessLookalikeRatio(50)).toBe(1);
  });

  it("可用的差异类型随轮次只增不减，最后六种全解锁", () => {
    for (let r = 2; r <= 30; r++) {
      const prev = new Set(endlessKinds(r - 1));
      for (const k of prev) expect(endlessKinds(r)).toContain(k);
    }
    expect(endlessKinds(1)).toEqual(["swap"]);
    expect(endlessKinds(30).sort()).toEqual(["count", "flip", "shift", "size", "swap", "tint"]);
  });

  it("成绩走 save.recordEndlessBest，只保留最好的一次", () => {
    expect(save.recordEndlessBest("find-diff", 7)).toBe(7);
    expect(save.recordEndlessBest("find-diff", 3)).toBe(7);
    expect(save.recordEndlessBest("find-diff", 11)).toBe(11);
    expect(save.getGameProgress("find-diff").endlessBest).toBe(11);
    expect(shell).toContain(`save.recordEndlessBest(meta.id`);
  });

  it("无尽的结算话只报成绩、不批评", () => {
    for (const line of [endlessLine(0, 0), endlessLine(3, 9), endlessLine(9, 9)]) {
      expect(line).not.toMatch(/可惜|失误|太差|笨|输了/);
      expect(line.length).toBeGreaterThan(8);
    }
    expect(endlessLine(9, 9)).toContain("最好成绩");
  });
});

// ---------------------------------------------------------------------------
// 5. 外壳巡检
// ---------------------------------------------------------------------------

describe("找不同 1.2 · 外壳与红线", () => {
  it("meta 与章节、模式、关数三头对得上", () => {
    expect(meta.id).toBe("find-diff");
    expect(meta.category).toBe("edu");
    expect(meta.levels).toBe(LEVELS.length);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(meta.levels);
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
  });

  it("blurb 与事实一致：十大主题 188 关 + 无尽，且不再留「归 B 改」的遗留注释", () => {
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toContain("十大主题");
    expect(meta.blurb).toContain("无尽");
    expect(meta.blurb).not.toContain("99");
    const metaSrc = readFileSync(`${dir}meta.ts`, "utf8");
    expect(metaSrc).not.toContain("归 B 改");
  });

  it("CSS 类名一律 fdf- 前缀，没有 1.1 的 fd- 残留", () => {
    const classes = [...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(10);
    for (const name of classes) expect(name, `${name} 没用 fdf- 前缀`).toMatch(/^fdf-/);
    expect(shell).not.toMatch(/"fd-[a-z]/);
  });

  it("destroy 归零：缩放的五个监听、滑块监听、定时器全卸", () => {
    for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"]) {
      expect(shell).toContain(`viewport.addEventListener("${ev}"`);
      expect(shell).toContain(`viewport.removeEventListener("${ev}"`);
    }
    expect(shell).toContain(`zoomer.removeEventListener("input"`);
    expect((shell.match(/clearInterval\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((shell.match(/clearTimeout\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(shell).toContain("pointers.clear()");
  });

  it("360px：主棋盘一格 ≤ 44px 且够大，双胞胎字号 ≥ 22px，两图之间有分隔线", () => {
    expect(PLAY_CELL_PX).toBeGreaterThanOrEqual(44);
    expect(MIN_GLYPH_PX).toBeGreaterThanOrEqual(22);
    expect(shell).toContain("Math.max(MIN_GLYPH_PX");
    expect(css).toContain(".fdf-split");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("竖屏两图同时可见：格子按屏高摊，每张图约占 40% 高度，且再挤也留得住 44px 热区", () => {
    for (const h of [560, 640, 740, 900]) {
      for (const rows of [3, 4, 5]) {
        const px = panelCellPx(rows, h, PLAY_CELL_PX);
        expect(px).toBeLessThanOrEqual(PLAY_CELL_PX);
        expect(px).toBeGreaterThanOrEqual(26);
        // 一张图（含标题与内边距）不超过屏高的一半，两张图加中间的 UI 条才放得下
        expect(px * rows + 28).toBeLessThanOrEqual(h * 0.45);
        expect(hitRadius(px) * 2).toBeGreaterThanOrEqual(44);
      }
    }
    // 屏越高格子越大，但封顶在 44px
    expect(panelCellPx(5, 480, PLAY_CELL_PX)).toBeLessThanOrEqual(panelCellPx(5, 900, PLAY_CELL_PX));
    expect(panelCellPx(3, 2000, PLAY_CELL_PX)).toBe(PLAY_CELL_PX);
  });

  it("三图关上排两张参考图并排也塞得进 360px", () => {
    for (const cols of [4, 5]) {
      const px = miniCellPx(cols, 360);
      expect(px * cols * 2 + 40).toBeLessThanOrEqual(360);
      expect(px).toBeGreaterThanOrEqual(22);
    }
  });

  it("红线：只用 emoji 拼场景，不引入任何图片资源或外部素材", () => {
    const code = [shell, sceneSrc, runtimeSrc].join("\n");
    expect(code).not.toMatch(/\.(png|jpg|jpeg|svg|gif|webp|mp3|wav)/i);
    expect(code).not.toMatch(/<img\b/i);
    expect(code).not.toMatch(/https?:\/\//);
  });

  it("红线：不改公共文件，level99 / save 只调用不修改", () => {
    expect(shell).toContain(`from "../level99"`);
    expect(shell).toContain(`from "../../engine/save"`);
    expect(sceneSrc).not.toContain("level99.ts");
  });

  it("攻略只讲方法：不点名任何一关的第几行第几个，也不再写「点错会扣次数」", () => {
    const lines = [...guide.general, ...guide.entries.flatMap((e) => e.tips)];
    for (const tip of lines) {
      expect(tip).not.toMatch(/第\s*\d+\s*行第\s*\d+/);
      expect(tip).not.toContain("点错会扣次数");
    }
    expect(lines.join("")).toContain("放大镜");
    expect(guide.entries.length).toBeGreaterThanOrEqual(10);
  });

  it("直开第 N 关：?level= 与 initialLevel 都夹回合法范围，锁着的关退回当前进度", () => {
    expect(parseLevelParam("?level=42")).toBe(42);
    expect(parseLevelParam("#level=7&x=1")).toBe(7);
    expect(parseLevelParam("?nope=1")).toBeNull();
    expect(resolveInitialLevel(42, 187)).toBe(41);
    expect(resolveInitialLevel(999, 187)).toBe(187);
    expect(resolveInitialLevel(0, 187)).toBe(0);
    expect(resolveInitialLevel(120, 30)).toBe(30);
    expect(resolveInitialLevel(undefined, 187)).toBeNull();
  });

  it("直开靠替玩家点地图（公共框架没开口子就不硬闯）", () => {
    const clicked: string[] = [];
    const node = (label: string, locked = false) => ({
      classList: { contains: (t: string) => locked && t === "l99-node-lock" },
      getAttribute: () => label,
      click: () => clicked.push(label),
    });
    const host = {
      querySelectorAll: (sel: string) =>
        sel === "button.l99-tab"
          ? [{ classList: { contains: () => false }, getAttribute: () => null, click: () => clicked.push("tab") }]
          : [node("第 3 关，还没通关"), node("第 4 关，还没解锁", true)],
    };
    expect(openLevelOnMap(host, 2, 0)).toBe(true);
    expect(clicked).toEqual(["tab", "第 3 关，还没通关"]);
    expect(openLevelOnMap(host, 3, 0)).toBe(false);
    expect(openLevelOnMap(host, 2, 9)).toBe(false);
  });
});
