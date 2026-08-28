/**
 * trio-r38/r39 A：N-176 *-pick、N-179 *-lessonbtn。
 * 不回退 CTA 回卷 / 消消乐钳高 / N-119/123。B 热区文件白名单（N-174/169/94/102/177）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const MST = readFileSync(fileURLToPath(new URL("./match-stars/view.ts", import.meta.url)), "utf8");
const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const PS = readFileSync(fileURLToPath(new URL("./pool-stars/index.ts", import.meta.url)), "utf8");
const BL = readFileSync(fileURLToPath(new URL("./bowling-lane/index.ts", import.meta.url)), "utf8");
const CLF = readFileSync(fileURLToPath(new URL("./color-fun/ui.ts", import.meta.url)), "utf8");
const DVS = readFileSync(fileURLToPath(new URL("./duo-vs-star/index.ts", import.meta.url)), "utf8");

/** N-174 rbg-pick、N-169 pfb-pick、N-94 dvs-pick、N-102 bc-pick、N-177 lessonbtn */
const B_ALLOW_FILE =
  /(red-blue-tug|puff-bros|duo-vs-star|bumper-cars|duo-rush|brave-path|gold-hook|adventure-king)\//;

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

describe("已做号不回退", () => {
  it("N-119 金边、N-123 平板档、CTA 回卷、消消乐钳高仍在", () => {
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toContain("0 0 0 3px #F2C14A");
    expect(STYLES).toMatch(/@media \(min-width: 980px\) and \(min-height: 600px\)/);
    expect(MST).toContain("boardBoxMaxPx");
    expect(MST).toContain("@media (max-height:500px)");
  });
});

describe("N-176 *-pick", () => {
  it("对照绿：台球 .ps-pick、保龄 .bl-pick、涂色 SWATCH", () => {
    expect(PS).toMatch(/\.ps-pick\{[^}]*min-height:44px/);
    expect(BL).toMatch(/\.bl-pick\{[^}]*min-height:44px/);
    expect(CLF).toMatch(/\.clf-pick\{[^}]*min-height:\$\{SWATCH_MIN/);
  });

  it("可点 *-pick 须 ≥44 或 TOUCH/SWATCH 插值；picks/fk/cc 容器豁免", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/picks\b|\.fk-pick|\.cc-pick|pick-note|pick-name|pick-sub|pick-thumb|token-pick|seat-pick/.test(r.sel)) {
          continue;
        }
        if (!classSuffix(r.sel, "pick")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-179 *-lessonbtn", () => {
  it("教案钮族存在；.dvs-mode 不进本闸", () => {
    expect(DVS).toContain(".dvs-lessonbtn{");
    expect(DVS).toContain(".dvs-mode{");
  });

  it("可点 *-lessonbtn 须 ≥44 或 TOUCH 插值（B 教案文件白名单）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.dvs-mode\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "lessonbtn")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
