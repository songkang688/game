/**
 * r51 playbook N-215：大厅 `*-open` 巡检。
 * 排除 `.l99-*`；气球 `.blp-open`、砖塔 `.brk-open` 归 B。
 * 不回退 overlay / 安全区 / N-205 大厅 *-back 闸。N-105 无第四版。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const BLP = readFileSync(fileURLToPath(new URL("./balloon-pop/index.ts", import.meta.url)), "utf8");
const BRK = readFileSync(fileURLToPath(new URL("./brick-break/index.ts", import.meta.url)), "utf8");

const B_ALLOW_FILE =
  /(red-blue-tug|puff-bros|duo-vs-star|bumper-cars|duo-rush|brave-path|gold-hook|adventure-king|hue-hand|memory-cards|red-blue-tap|bubble-aim|candy-swing)\//;

const KIT_TOKEN =
  /TOUCH_MIN|MIN_HIT_PX|HUD_BTN_MIN_H|MIN_HOT|TOGGLE_MIN_H|MIN_TOUCH_PX|CHIP_MIN|SWATCH_MIN/;

function walkSrc(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walkSrc(p, acc);
    } else if (/\.(ts|css)$/.test(name.name) && !name.name.endsWith(".d.ts")) acc.push(p);
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
  if (/\bbutton\b/.test(sel)) return true;
  return false;
}

function jsSel(sel: string): boolean {
  return /const |let |return |function |=>/.test(sel);
}

function tallEnough(body: string): boolean {
  if (/\$\{/.test(body) && KIT_TOKEN.test(body)) return true;
  const mh = /min-height:\s*(\d+)px/.exec(body);
  if (mh && Number(mh[1]) >= 44) return true;
  return false;
}

function classSuffix(sel: string, suffix: string): boolean {
  if (jsSel(sel)) return false;
  if (/:(hover|active|focus)/.test(sel)) return false;
  const re = new RegExp(`(?:^|,)\\s*\\.[\\w-]+-${suffix}(?:\\.[\\w-]+)?\\s*$`);
  return re.test(sel) || new RegExp(`^\\.[\\w-]+-${suffix}$`).test(sel);
}

function decorativeOpen(sel: string, body: string): boolean {
  if (/pointer-events:\s*none/.test(body)) return true;
  if (/display:\s*none/.test(body)) return true;
  if (/animation/.test(body) && !/cursor:\s*pointer/i.test(body)) return true;
  if (/\b(eyes|mouth|bloom)-open\b/.test(sel)) return true;
  return false;
}

describe("N-215 大厅 *-open（排除 l99 / blp-open / brk-open）", () => {
  it("可点 *-open 须 ≥44 或 TOUCH 插值", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (rel.startsWith("balloon-pop/")) continue;
      if (rel.startsWith("brick-break/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.l99-/.test(r.sel)) continue;
        if (/\.blp-open\b/.test(r.sel)) continue;
        if (/\.brk-open\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "open")) continue;
        if (decorativeOpen(r.sel, r.body)) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("B 的气球 / 砖塔文件仍在，本闸不改它们", () => {
    expect(BLP).toMatch(/\.blp-open \{/);
    expect(BRK).toMatch(/\.brk-open \{/);
    expect(BLP).not.toMatch(/\.blp-open \{[^}]*min-height: 44px/);
    expect(BRK).not.toMatch(/\.brk-open \{[^}]*min-height: 44px/);
  });

  it("本拍补上的接水果 / 泡泡 / 地鼠入口声明 44", () => {
    const FRC = readFileSync(fileURLToPath(new URL("./fruit-catch/index.ts", import.meta.url)), "utf8");
    const BBP = readFileSync(fileURLToPath(new URL("./bubble-pop/index.ts", import.meta.url)), "utf8");
    const MP = readFileSync(fileURLToPath(new URL("./mole-pop/index.ts", import.meta.url)), "utf8");
    expect(FRC).toMatch(/\.frc-open \{[^}]*min-height: 44px/);
    expect(BBP).toMatch(/\.bbp-open \{[^}]*min-height: 44px/);
    expect(MP).toMatch(/\.mp-open \{[^}]*min-height: 44px/);
  });
});

describe("不回退 overlay / N-205", () => {
  it("N-203/N-204 overlay 仍在；N-205 闸文件仍在", () => {
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overflow-y:auto/);
    expect(L99).toMatch(/\.l99-overlay\{[^}]*touch-action:pan-y/);
    const n205 = readFileSync(fileURLToPath(new URL("./lobbyBack.n205.test.ts", import.meta.url)), "utf8");
    expect(n205).toContain("N-205 大厅 *-back");
  });
});
