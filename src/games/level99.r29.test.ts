/**
 * trio-r29/r30 A：N-149 `*-open`/模式胶囊、N-152 `*-veil-btn`。
 * 不回退 N-117…N-146 A 面。B 号文件白名单，不抢修。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const SKS = readFileSync(fileURLToPath(new URL("./sky-squad/index.ts", import.meta.url)), "utf8");

/** N-121 三款 + B 独占/在途，本巡检不改文件 */
const B_ALLOW_FILE =
  /(fruit-catch|balloon-pop|duo-rush|bumper-cars|bowling-lane|fishing-star|fight-king|duo-vs-star|brave-path|mole-pop|fruit-slice|sprout-defense|garden-guard|orb-arena|landlord-cards|red-blue-race)\//;

const OPEN_SKIP = /(mj-bloom-open|ktc-eyes-open|ktc-mouth-open|eyes-open|mouth-open)/;
const KIT_TOKEN = /TOUCH_MIN|MIN_HIT_PX|HUD_BTN_MIN_H|MIN_HOT|TOGGLE_MIN_H|MIN_TOUCH_PX|CHIP_MIN|KEY_MIN/;

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

function minH(body: string): number | null {
  const m = /min-height:\s*(\d+)px/.exec(body);
  return m ? Number(m[1]) : null;
}

function clickable(sel: string, body: string): boolean {
  if (/:(hover|active|focus)/.test(sel)) return false;
  if (/pointer-events:\s*none/.test(body)) return false;
  if (/cursor:\s*pointer/i.test(body)) return true;
  if (/(^|,)\s*button\b/.test(sel)) return true;
  return false;
}

function kitCovers(gameDir: string, sel: string): boolean {
  const files = walkTs(gameDir);
  const needle = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`touchUpliftCss\\([\\s\\S]{0,400}${needle}`);
  for (const file of files) {
    if (/\.test\.ts$/.test(file)) continue;
    const src = readFileSync(file, "utf8");
    if (re.test(src)) return true;
  }
  return false;
}

function gameRoot(file: string): string {
  const rel = file.slice(GAMES.length).replace(/\\/g, "/");
  const top = rel.split("/")[0];
  return join(GAMES, top);
}

function tallEnough(body: string): boolean {
  if (/\$\{/.test(body) && KIT_TOKEN.test(body)) return true;
  const h = minH(body);
  return h !== null && h >= 44;
}

function primaryOpen(sel: string): boolean {
  if (OPEN_SKIP.test(sel)) return false;
  if (/modebar|-open-/.test(sel)) return false;
  return /(^|,)\s*\.[\w-]+-open\s*$/.test(sel) || /^\.[\w-]+-open$/.test(sel);
}

function primaryModeChip(sel: string, body: string): boolean {
  if (/modebar|modes\b/.test(sel)) return false;
  if (!/(^|,)\s*\.[\w-]+-mode(\.[\w-]+)?\s*$/.test(sel) && !/^\.[\w-]+-mode$/.test(sel)) return false;
  if (/max-width\s*:/.test(body)) return false;
  if (!clickable(sel, body) && !/border\s*:\s*none/.test(body)) return false;
  if (!clickable(sel, body)) return false;
  return true;
}

function primaryVeilBtn(sel: string): boolean {
  if (/veil-btns/.test(sel)) return false;
  if (/:(hover|active|focus)/.test(sel)) return false;
  return /^\.[\w-]+-veil-btn$/.test(sel);
}

describe("已做号不回退", () => {
  it("N-117/118/120/128/138 仍在", () => {
    expect(L99).toContain("l99-tab-lockmark");
    expect(L99).not.toContain(".l99-wrap{max-height:");
    expect(L99).toMatch(/\.l99-view\{[^}]*touch-action:pan-y/);
    expect(L99).toMatch(/\.l99-host\{[^}]*overflow:hidden/);
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
  });
});

describe("N-149 抽验 sky-squad 模式胶囊", () => {
  it(".sks-mode 规则内 min-height:44", () => {
    expect(SKS).toMatch(/\.sks-mode\{[^}]*min-height:44px/);
  });
});

describe("N-149 *-open 与按钮型 *-mode ≥44 或 kit", () => {
  it("可点 open/mode 须有高度（B 与动画类豁免）", () => {
    const hits: string[] = [];
    for (const file of walkTs(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.ts$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      const root = gameRoot(file);
      for (const r of rulesOf(src)) {
        const isOpen = primaryOpen(r.sel) && clickable(r.sel, r.body);
        const isMode = primaryModeChip(r.sel, r.body);
        if (!isOpen && !isMode) continue;
        if (tallEnough(r.body)) continue;
        const klass = (r.sel.match(/\.[\w-]+-(?:open|mode)/) || [""])[0];
        if (klass && kitCovers(root, klass)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-152 结算 veil 钮", () => {
  it(".sks-veil-btn 抽验 44", () => {
    expect(SKS).toMatch(/\.sks-veil-btn\{[^}]*min-height:44px/);
  });

  it("cursor:pointer 的 *-veil-btn 须 ≥44；仓鼠走 N-47 白名单", () => {
    const hits: string[] = [];
    for (const file of walkTs(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (/\.test\.ts$/.test(rel)) continue;
      if (/box-hamster\//.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (!primaryVeilBtn(r.sel)) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
