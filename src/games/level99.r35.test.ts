/**
 * trio-r35…r37 A：N-167 rules-close/resume、N-170 *-opt、N-173 *-go。
 * 不回退 N-117…N-164 巡检闸。B 热区文件白名单。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES = fileURLToPath(new URL(".", import.meta.url));
const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const SKS = readFileSync(fileURLToPath(new URL("./sky-squad/index.ts", import.meta.url)), "utf8");
const PK = readFileSync(fileURLToPath(new URL("./pinyin-train/pickAll.ts", import.meta.url)), "utf8");
const PYT = readFileSync(fileURLToPath(new URL("./pinyin-train/spell.ts", import.meta.url)), "utf8");
const XQ = readFileSync(fileURLToPath(new URL("./xiangqi/view.ts", import.meta.url)), "utf8");
const DUA = readFileSync(fileURLToPath(new URL("./duo-arena/index.ts", import.meta.url)), "utf8");

const B_ALLOW_FILE =
  /(duo-rush|brave-path|duo-vs-star|gold-hook|adventure-king|puff-bros)\//;

const KIT_TOKEN = /TOUCH_MIN|MIN_HIT_PX|HUD_BTN_MIN_H|MIN_HOT|TOGGLE_MIN_H|MIN_TOUCH_PX|CHIP_MIN/;
const GO_MODIFIER = /(mj-btn\.mj-go|jq-btn\.jq-go|[\w-]+-btn-go|dummy-go|versus-go|loco-go|light-go)/;

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

function shrinksHit(body: string): boolean {
  const mh = /min-height:\s*(\d+)px/.exec(body);
  if (mh && Number(mh[1]) < 44) return true;
  const h = /(?:^|[^-])height:\s*(\d+)px/.exec(body);
  if (h && Number(h[1]) < 44) return true;
  return false;
}

function classSuffix(sel: string, suffix: string): boolean {
  if (jsSel(sel)) return false;
  if (/:(hover|active|focus)/.test(sel)) return false;
  const re = new RegExp(`(?:^|,)\\s*\\.[\\w-]+-${suffix}(?:\\.[\\w-]+)?\\s*$`);
  return re.test(sel) || new RegExp(`^\\.[\\w-]+-${suffix}$`).test(sel);
}

describe("已做号不回退", () => {
  it("N-117/138/149/164 闸仍在", () => {
    expect(L99).toContain("l99-tab-lockmark");
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    expect(SKS).toMatch(/\.sks-mode\{[^}]*min-height:44px/);
  });
});

describe("N-167 *-rules-close / *-resume", () => {
  it("对照：象棋 / 双人擂台关闭钮已钉高度", () => {
    expect(XQ).toMatch(/\.xq-rules-close\{[^}]*min-height:\$\{MIN_HIT_PX\}/);
    expect(DUA).toMatch(/\.dua-rules-close\{[^}]*min-height:44px/);
    expect(DUA).toMatch(/\.dua-splash \.row button\{[^}]*min-height:44px/);
  });

  it("扫描器：裸 resume 无高度为红", () => {
    expect(tallEnough("padding:13px 28px;font-size:17px;cursor:pointer;")).toBe(false);
    expect(tallEnough("min-height:44px;cursor:pointer;")).toBe(true);
    expect(classSuffix(".dr-rules-close", "rules-close")).toBe(true);
    expect(classSuffix(".dr-resume", "resume")).toBe(true);
  });

  it("可点 rules-close/resume 须 ≥44 或插值（N-165/166 冲刺白名单）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        const close = classSuffix(r.sel, "rules-close");
        const resume = classSuffix(r.sel, "resume");
        if (!close && !resume) continue;
        if (!clickable(r.sel, r.body) && !shrinksHit(r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-170 *-opt", () => {
  it("抽验：飞机小队 .sks-opt 已 44", () => {
    expect(SKS).toMatch(/\.sks-opt\{[^}]*min-height:44px/);
  });

  it("可点 *-opt 须 ≥44；optbar/opt-em 豁免；岔路口走 N-168", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/optbar|opt-em|opts\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "opt")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-173 *-go", () => {
  it("对照：拼音 .pk-go / .pyt-go", () => {
    expect(PK).toMatch(/\.pk-go\{[^}]*min-height:44px/);
    expect(PYT).toMatch(/\.pyt-go\{[^}]*min-height:\$\{CHIP_MIN/);
  });

  it("可点 *-go 须 ≥44 或 CHIP/TOUCH 插值（修饰类与 N-171/172 文件豁免）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (GO_MODIFIER.test(r.sel)) continue;
        if (/lessonbtn/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "go")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
