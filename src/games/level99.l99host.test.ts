/**
 * 壳层滚动权契约静态断言(r19 学习笔记第七节的守门建议落地)。
 *
 * 背景:.l99-host / .l99-stage 是 overflow:hidden,l99 关内的 position:sticky 与
 * 「自身 overflow-y:auto」在这条链里一律失效——N-75 → N-98 → N-101 → N-108 同族病
 * 四次复发。合法救济只有两条路径(ux playbook §八军规):
 *   1. 钳内容高(canvasDisplayCapPx / fitPanesToStage 一族);
 *   2. position:fixed 钉视口底(N-75 手牌配方)。
 *
 * 本守门做两件事:
 *   A. 钉死 level99.ts 的滚动权契约字符串——谁改 overflow 归属谁先来改这里;
 *   B. 冻结每款 l99 游戏内联 CSS 的 position:sticky 存量——新增 sticky 的提交
 *      必须在该游戏源码里带「滚动祖先」注释(说明 sticky 相对哪个可滚/裁切盒生效),
 *      否则视为踩 .l99-host 坑打回。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const L99_SRC = readFileSync(join(HERE, "level99.ts"), "utf8");

/** r2(PT 轮)冻结的 sticky 存量:游戏 → position:sticky 出现次数(含 top 用法)。未列出 = 0。 */
const STICKY_BASELINE: Record<string, number> = {
  "adventure-king": 1,
  "alien-seek": 2,
  "block-drop": 1,
  "bomb-buddies": 1,
  "bowling-lane": 2,
  "box-hamster": 1,
  "brave-path": 1,
  "brick-break": 1,
  "bumper-cars": 1,
  "combo-clash": 1,
  "fight-king": 4,
  "flight-chess": 2,
  "fruit-catch": 1,
  "hero-cards": 2,
  "hop-pads": 1,
  "hue-hand": 1,
  "ice-fire-forest": 1,
  "merge-2048": 1,
  "orb-arena": 1,
  "prince-princess": 1,
  "shoot-range": 1,
  "snake-royale": 1,
  "snake-snack": 1,
  "snow-fight": 1,
  "star-estate": 1,
  "sudoku-petal": 1,
  "tank-battle": 3,
  "weiqi-garden": 1,
};

function l99GameIds(): string[] {
  const gamesDir = HERE;
  return readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => {
      const idx = join(gamesDir, id, "index.ts");
      return existsSync(idx) && readFileSync(idx, "utf8").includes("mountLevelGame");
    });
}

describe("壳层 .l99-host 滚动权契约", () => {
  it("level99.ts 滚动权归属原文不动:.l99-host hidden / 舞台 hidden / .l99-view auto", () => {
    expect(L99_SRC).toContain(
      ".l99-host{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;overflow:hidden;}"
    );
    expect(L99_SRC).toContain(".game-stage.game-stage--l99{overflow-y:hidden;display:flex;flex-direction:column;}");
    expect(L99_SRC).toMatch(/\.l99-view\{[^}]*overflow-y:auto/);
    expect(L99_SRC).toMatch(/\.l99-stage\{[^}]*overflow:hidden/);
  });

  it("l99 游戏新增 position:sticky 必须带「滚动祖先」注释(§八军规:钳高或 fixed 才是正路)", () => {
    const offenders: string[] = [];
    for (const id of l99GameIds()) {
      const src = readFileSync(join(HERE, id, "index.ts"), "utf8");
      const count = (src.match(/position:\s*sticky/g) ?? []).length;
      const baseline = STICKY_BASELINE[id] ?? 0;
      if (count > baseline && !src.includes("滚动祖先")) {
        offenders.push(`${id}(${baseline}→${count})`);
      }
    }
    expect(
      offenders,
      `以下 l99 游戏新增了 position:sticky 却没写「滚动祖先」注释——sticky 在 .l99-host/.l99-stage ` +
        `overflow:hidden 链里失效(N-75/98/101/108 四次复发)。要么走钳高/fixed,要么注释说明它钉的是哪个可滚盒,` +
        `并同步更新 STICKY_BASELINE:${offenders.join("、")}`
    ).toEqual([]);
  });

  it("基线不留虚数:存量减少了就把 STICKY_BASELINE 同步改小", () => {
    for (const id of l99GameIds()) {
      const src = readFileSync(join(HERE, id, "index.ts"), "utf8");
      const count = (src.match(/position:\s*sticky/g) ?? []).length;
      const baseline = STICKY_BASELINE[id] ?? 0;
      expect(
        count,
        `${id} 的 sticky 存量 ${count} 低于基线 ${baseline}:好事,但请把 STICKY_BASELINE 改小,免得给后人留放宽余量`
      ).toBeGreaterThanOrEqual(baseline);
    }
  });
});
