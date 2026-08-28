/**
 * trio-r47 playbook（PR #120）标给 A 的大厅 `*-back` 巡检。
 * 学习票写的是 N-203，但本分支 N-203/N-204 已是 overlay，本闸用 N-205，不改 overlay 号语义。
 * 排除 `.l99-*`；钓鱼 `.fs-back`、光球 `.oa-back` 归 B。N-195 `.shr-back` 不扫。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const FS_FISH = readFileSync(fileURLToPath(new URL("./fishing-star/index.ts", import.meta.url)), "utf8");
const OA = readFileSync(fileURLToPath(new URL("./orb-arena/index.ts", import.meta.url)), "utf8");

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

describe("N-205 大厅 *-back（排除 l99 / fs-back / oa-back）", () => {
  it("可点 *-back 须 ≥44 或 TOUCH 插值", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.l99-/.test(r.sel)) continue;
        if (/\.fs-back\b/.test(r.sel)) continue;
        if (/\.oa-back\b/.test(r.sel)) continue;
        if (/\.shr-back\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "back")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("B 的钓鱼 / 光球文件仍在，本闸不改它们", () => {
    expect(FS_FISH).toMatch(/\.fs-back\{/);
    expect(OA).toMatch(/\.oa-back\{/);
    expect(FS_FISH).not.toMatch(/\.fs-back\{[^}]*min-height:44px/);
  });
});

describe("N-203/N-204 overlay 号语义不改", () => {
  it("仍是 overlay 竖滚与 915 收边，不是大厅 *-back", () => {
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overflow-y:auto/);
    expect(L99).toMatch(/\.l99-overlay\{[^}]*touch-action:pan-y/);
    expect(L99).toContain("N-204");
    expect(L99).toMatch(
      /@media \(max-height:500px\)\{[\s\S]*?\.l99-overlay\{padding:10px 12px;gap:8px;justify-content:flex-start;\}/,
    );
  });
});
