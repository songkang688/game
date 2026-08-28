/**
 * trio-r31…r34 A：N-155 `--k`、N-158 键格行高、N-161 写死宽高、N-164 summary。
 * 不回退 N-117…N-152 A 面。B 热区文件白名单，不抢修。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const STYLES = fileURLToPath(new URL("../styles.css", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const PFB = readFileSync(fileURLToPath(new URL("./puff-bros/index.ts", import.meta.url)), "utf8");

/** B 独占热区：N-153/154 `--k`、N-156 仓鼠格、N-159 花钮、N-162/163 summary 等 */
const B_ALLOW_FILE =
  /(sky-squad|prince-princess|box-hamster|word-garden|color-fun|orb-arena|snake-royale|chess-garden|fruit-catch|balloon-pop|duo-rush|bumper-cars|bowling-lane|fishing-star|fight-king|duo-vs-star|brave-path|mole-pop|fruit-slice|sprout-defense|garden-guard|landlord-cards|red-blue-race)\//;

const B_SUMMARY_SEL = /(oa-board summary|sr-board summary|cg-log-sum)/;
const KIT_TOKEN = /TOUCH_MIN|MIN_HIT_PX|HUD_BTN_MIN_H|MIN_HOT|TOGGLE_MIN_H|MIN_TOUCH_PX/;

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

function px(body: string, prop: string): number | null {
  const m = new RegExp(`(?:^|[^-])${prop}:\\s*(\\d+)px`).exec(body);
  return m ? Number(m[1]) : null;
}

function padY(body: string): number {
  const m = /padding:\s*(\d+)px(?:\s+(\d+)px(?:\s+(\d+)px)?)?/.exec(body);
  if (m) {
    if (m[3] !== undefined) return Number(m[1]) + Number(m[3]);
    return Number(m[1]) * 2;
  }
  const t = /padding-top:\s*(\d+)px/.exec(body);
  const b = /padding-bottom:\s*(\d+)px/.exec(body);
  return (t ? Number(t[1]) : 0) + (b ? Number(b[1]) : 0);
}

function summaryOk(sel: string, body: string): boolean {
  if (/pointer-events:\s*none/.test(body)) return true;
  const mh = px(body, "min-height");
  if (mh !== null && mh >= 44) return true;
  if (/\$\{/.test(body) && KIT_TOKEN.test(body)) return true;
  const font = px(body, "font-size") ?? 16;
  if (padY(body) + font >= 44) return true;
  return false;
}

function isFoldTitle(sel: string, body: string): boolean {
  if (/const |let |return |function |=>/.test(sel)) return false;
  if (/:(hover|active|focus)/.test(sel)) return false;
  if (/(^|,|\s)summary\b/.test(sel)) return true;
  if (/\.[\w-]+-sum(\s|,|$)/.test(sel) && clickable(sel, body)) return true;
  return false;
}

describe("已做号不回退", () => {
  it("N-117/118/138/149 仍在", () => {
    expect(L99).toContain("l99-tab-lockmark");
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    const sks = readFileSync(join(GAMES, "sky-squad/index.ts"), "utf8");
    expect(sks).toMatch(/\.sks-mode\{[^}]*min-height:44px/);
  });
});

describe("N-155 --k 数字地板", () => {
  it("对照：puff-bros 窄屏用 TOUCH_MIN 模板", () => {
    expect(PFB).toMatch(/--k:\$\{TOUCH_MIN\}px/);
  });

  it("src/games 内 --k:Npx 须 ≥44 或模板常量（B 的 N-153/154 豁免）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/--k:\s*(\d+)px/g)) {
        if (Number(m[1]) < 44) hits.push(`${rel} ${m[0]}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-158 键格 grid-auto-rows", () => {
  it("pad/keys 网格数字行高 ≥44；var(--k) 走 N-155；仓鼠矮档走 N-156", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (!/-(pad|pads|keys)\b/.test(r.sel)) continue;
        for (const m of r.body.matchAll(/grid-auto-rows:\s*(\d+)px/g)) {
          if (Number(m[1]) < 44) hits.push(`${rel} ${r.sel} ${m[0]}`);
        }
        for (const m of r.body.matchAll(/repeat\(\s*\d+\s*,\s*(\d+)px\)/g)) {
          if (Number(m[1]) < 44) hits.push(`${rel} ${r.sel} ${m[0]}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-161 写死宽高 <44 的 button", () => {
  it("样例：同规则 cursor+宽高 34 判失败", () => {
    expect(clickable(".x", "cursor:pointer;width:34px;height:34px;")).toBe(true);
    const w = px("width:34px;height:34px;", "width");
    const h = px("width:34px;height:34px;", "height");
    expect(w !== null && h !== null && (w < 44 || h < 44)).toBe(true);
  });

  it("可点规则同时写 width/height 数字则均 ≥44（花钮/摇杆点豁免）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/bc-knob|fk-stick-dot|mj-small/.test(r.sel)) continue;
        if (!clickable(r.sel, r.body)) continue;
        const w = px(r.body, "width");
        const h = px(r.body, "height");
        if (w === null || h === null) continue;
        if (w < 44 || h < 44) hits.push(`${rel} :: ${r.sel.slice(0, 80)} ${w}x${h}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-164 summary / 折叠标题", () => {
  it("扫描器：裸 summary 无高度为红，写 44 则绿", () => {
    expect(isFoldTitle(".oa-board summary", "cursor:pointer;font-size:16px;")).toBe(true);
    expect(summaryOk(".oa-board summary", "cursor:pointer;font-size:16px;")).toBe(false);
    expect(summaryOk(".oa-board summary", "cursor:pointer;min-height:44px;font-size:16px;")).toBe(true);
    expect(isFoldTitle(".cg-log-sum", "cursor:pointer;font-size:13px;")).toBe(true);
    expect(summaryOk(".cg-log-sum", "cursor:pointer;font-size:13px;")).toBe(false);
    expect(isFoldTitle(".tt-sum", "display:flex;")).toBe(false);
  });

  it("ts 内联 CSS 与 styles.css 的可点折叠标题 ≥44（N-162/163 白名单）", () => {
    const hits: string[] = [];
    const files = [...walkSrc(GAMES), STYLES];
    for (const file of files) {
      const rel = file.includes("styles.css")
        ? "src/styles.css"
        : file.slice(GAMES.length).replace(/\\/g, "/");
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (B_SUMMARY_SEL.test(r.sel)) continue;
        if (!isFoldTitle(r.sel, r.body)) continue;
        if (summaryOk(r.sel, r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
