/**
 * trio-r26…r28 A：N-138 壳层 44、N-143 写死 40/42、N-146 缺 min-height。
 * 不回退 N-117/118/120/128/99/131/132/137。B 号（N-121…126/129/133/134/135 保龄钓鱼、N-139/141/142/144/145）豁免。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

const A_SCAN = [
  "level99.ts",
  "quiz99.ts",
  "word-garden",
  "pinyin-train",
  "clock-house",
  "find-diff",
  "math-farm",
  "shape-kingdom",
  "sudoku-petal",
  "match-stars"
];

/** B 在途/独占：写死 40/42 留给原号，本巡检不抢修 */
const B_ALLOW_FILE = /(duo-vs-star|mole-pop|landlord-cards|red-blue-race|fight-king|bowling-lane|bumper-cars|fruit-slice|sprout-defense|garden-guard|fishing-star|orb-arena)\//;

const EXEMPT_SEL =
  /(ld-center|shk-kingdom|pyt-view|cg-sq|l99-node|sp-cell|shk-dot|shk-cell|wgd-garden-flower|fdf-cell|mst-cell|aspect-ratio)/;

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walkTs(p, acc);
    } else if (name.name.endsWith(".ts") && !name.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

function rulesOf(src: string): Array<{ sel: string; body: string }> {
  const out: Array<{ sel: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ sel: m[1].replace(/\s+/g, " ").trim(), body: m[2] });
  return out;
}

function clickable(sel: string, body: string): boolean {
  if (/:(hover|active|focus)/.test(sel)) return false;
  if (/pointer-events:\s*none/.test(body)) return false;
  if (/cursor:\s*pointer/i.test(body)) return true;
  if (/(^|,)\s*button\b/.test(sel)) return true;
  return false;
}

function minH(body: string): number | null {
  const m = /min-height:\s*(\d+)px/.exec(body);
  return m ? Number(m[1]) : null;
}

function heightPx(body: string): number | null {
  const m = /(?:^|[^-])height:\s*(\d+)px/.exec(body);
  return m ? Number(m[1]) : null;
}

describe("已做号不回退", () => {
  it("N-117/118/120/128 仍在", () => {
    expect(L99).toContain("l99-tab-lockmark");
    expect(L99).not.toContain(".l99-wrap{max-height:");
    expect(L99).toMatch(/\.l99-view\{[^}]*touch-action:pan-y/);
    expect(L99).toMatch(/\.l99-host\{[^}]*overflow:hidden/);
  });
});

describe("N-138 l99 壳层 min-height:44", () => {
  it(".l99-back / tool / continue / tab / ov-btn 规则内写 44，不改 node", () => {
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-tool\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-back\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-tab\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-ov-btn\{[^}]*min-height:44px/);
    expect(L99).toContain(".l99-tool-skip{padding:6px 10px;font-size:13px;min-height:44px;}");
    expect(L99).not.toMatch(/\.l99-node\{[^}]*min-height:44px/);
  });
});

describe("N-143 可点块禁止写死 40/42", () => {
  it("cursor:pointer 块不得 min-height 40–43（B 原号与非交互豁免）", () => {
    const hits: string[] = [];
    for (const file of walkTs(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.ts$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (!clickable(r.sel, r.body)) continue;
        if (EXEMPT_SEL.test(r.sel) || EXEMPT_SEL.test(r.body)) continue;
        const h = minH(r.body);
        if (h !== null && h >= 40 && h < 44) hits.push(`${rel} ${r.sel} min-height:${h}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-146 A 款可点块须有 min-height≥44（或等价高）", () => {
  it("学习壳层 cursor:pointer 无高度则失败；棋盘格豁免", () => {
    const hits: string[] = [];
    for (const name of A_SCAN) {
      const root = join(GAMES, name);
      const files = name.endsWith(".ts") ? [root] : walkTs(root);
      for (const file of files) {
        if (/\.test\.ts$/.test(file)) continue;
        const rel = file.slice(GAMES.length).replace(/\\/g, "/");
        const src = readFileSync(file, "utf8");
        for (const r of rulesOf(src)) {
          if (!clickable(r.sel, r.body)) continue;
          if (EXEMPT_SEL.test(r.sel) || EXEMPT_SEL.test(r.body)) continue;
          if (/aspect-ratio/.test(r.body)) continue;
          if (/MIN_HIT|TOUCH_MIN|CHIP_MIN|KEY_MIN|PLAY_CELL|TOOL_MIN/.test(r.body) || /\$\{/.test(r.body))
            continue;
          const mh = minH(r.body);
          const ht = heightPx(r.body);
          if (mh !== null && mh >= 44) continue;
          if (ht !== null && ht >= 44) continue;
          hits.push(`${rel} :: ${r.sel.slice(0, 80)}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
