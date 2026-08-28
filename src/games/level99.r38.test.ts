/**
 * trio-r38…r45 A：N-176…194、N-196 `.l99-continue` 回归、N-197 `*-continue`。
 * 不回退 CTA 回卷 / 消消乐钳高 / N-119/123 / 平板 wrap 760 / --vv-h。
 * B 热区文件白名单（N-189/190/192/193 等）。N-195 `.shr-back` 不扫、不改文件。
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
const DR = readFileSync(fileURLToPath(new URL("./duo-rush/index.ts", import.meta.url)), "utf8");
const HH = readFileSync(fileURLToPath(new URL("./hue-hand/index.ts", import.meta.url)), "utf8");
const MMC = readFileSync(fileURLToPath(new URL("./memory-cards/index.ts", import.meta.url)), "utf8");
const SNK = readFileSync(fileURLToPath(new URL("./snake-snack/index.ts", import.meta.url)), "utf8");
const SHR = readFileSync(fileURLToPath(new URL("./shoot-range/index.ts", import.meta.url)), "utf8");
const RBT = readFileSync(fileURLToPath(new URL("./red-blue-tap/arena.ts", import.meta.url)), "utf8");
const RTE = readFileSync(fileURLToPath(new URL("./red-blue-tap/index.ts", import.meta.url)), "utf8");
const RBE = readFileSync(fileURLToPath(new URL("./red-blue-race/index.ts", import.meta.url)), "utf8");
const BA = readFileSync(fileURLToPath(new URL("./bubble-aim/index.ts", import.meta.url)), "utf8");
const CS = readFileSync(fileURLToPath(new URL("./candy-swing/index.ts", import.meta.url)), "utf8");

/** N-174…187 + N-189/190 tap overlay、N-192/193 地图格 */
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

function isVsBtnOrRte(sel: string): boolean {
  if (classSuffix(sel, "vs-btn")) return true;
  if (jsSel(sel)) return false;
  if (/:(hover|active|focus)/.test(sel)) return false;
  return /(?:^|,)\s*\.rte-btn(?:\.[\w-]+)?\s*$/.test(sel);
}

describe("已做号不回退", () => {
  it("N-119 金边、N-123 平板档、CTA 回卷、消消乐钳高、平板 wrap 760 仍在", () => {
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toContain("0 0 0 3px #F2C14A");
    expect(L99).toMatch(/@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/);
    expect(STYLES).toMatch(/@media \(min-width: 980px\) and \(min-height: 600px\)/);
    expect(MST).toContain("boardBoxMaxPx");
    expect(MST).toContain("@media (max-height:500px)");
    expect(STYLES).toContain("height: var(--vv-h, 100dvh)");
    expect(STYLES).toContain("max-height: var(--vv-h, 100svh)");
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

describe("N-182 *-softbtn", () => {
  it("族存在于 duo-rush；不扫 .dr-start；不替代 N-87/181", () => {
    expect(DR).toContain(".dr-softbtn {");
    expect(DR).toContain(".dr-start {");
    expect(DR).toContain(".dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start");
    expect(DR).toMatch(/\.dr-menu-cta \{[^}]*position:\s*sticky/);
  });

  it("可点 *-softbtn 须 ≥44 或 TOUCH 插值（B 的 .dr-softbtn 走文件白名单）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.dr-start\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "softbtn")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-185 *-catch", () => {
  it("族存在于 hue-hand；不扫牌面兄弟；不替代 N-148/184", () => {
    expect(HH).toContain(".hh-catch{");
    expect(HH).toContain(".hh-deck{");
    expect(HH).toContain(".hh-card{");
    expect(HH).toContain("btn.className = \"hh-catch\"");
  });

  it("可点 *-catch 须 ≥44 或 TOUCH 插值（B 的 .hh-catch 走文件白名单）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.hh-(deck|back|card|pile|heap|bubble)\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "catch")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-188 *-toggle", () => {
  it("族存在；对照绿 .snk-toggle；.shr-toggle 仍归 N-134；不替代 N-187", () => {
    expect(MMC).toContain(".mmc-toggle {");
    expect(MMC).toContain('back.className = "mmc-toggle"');
    expect(SNK).toMatch(/\.snk-toggle \{[^}]*min-height: 44px/);
    expect(SHR).toContain(".shr-toggle{");
  });

  it("可点 *-toggle 须 ≥44 或 TOGGLE_MIN_H 插值（.mmc-toggle 走 B 白名单，不扫 .shr-toggle）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.shr-toggle\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "toggle")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-191 *-vs-btn / .rte-btn", () => {
  it("族存在；对照绿 over-btn 48；不扫 .rbt-vs-back；不替代 N-189/190", () => {
    expect(RBT).toContain(".rbt-vs-btn {");
    expect(RBT).toContain('again.className = "rbt-vs-btn"');
    expect(RTE).toContain(".rte-btn {");
    expect(RBT).toContain(".rbt-vs-back, .rbt-vs-mode {");
    expect(RBE).toMatch(/\.rbe-over-btn \{[^}]*min-height: 48px/);
    expect(RBE).toMatch(/\.rbv-over-btn \{[^}]*min-height: 48px/);
  });

  it("可点 *-vs-btn 与 .rte-btn 须 ≥44（B 的 rbt/rte 走文件白名单）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.rbt-vs-back\b/.test(r.sel)) continue;
        if (!isVsBtnOrRte(r.sel)) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-194 *-lv", () => {
  it("族存在于 bubble-aim / candy-swing；不替代 N-144/192/193", () => {
    expect(BA).toContain(".ba-lv {");
    expect(CS).toContain(".cs-lv {");
    expect(BA).toContain(".ba-lv-cur");
    expect(CS).toContain(".cs-lv-cur");
  });

  it("可点 *-lv 关卡格须 ≥44（.ba-lv / .cs-lv 走 B 白名单；不扫 card-lv 文案）", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/card-lv\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "lv")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("N-196 .l99-continue 已 ≥44", () => {
  it("壳层继续钮 min-height 44，不改 padding；不抢 N-138 其余钮", () => {
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    expect(STYLES).toMatch(/\.l99-wrap \.l99-continue \{[^}]*min-height: 44px/);
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toMatch(/\.l99-back\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-tool\{[^}]*min-height:44px/);
  });
});

describe("N-197 *-continue", () => {
  it("族即 .l99-continue；不扫 .shr-back（N-195）", () => {
    expect(L99).toContain(".l99-continue{");
    expect(SHR).toContain(".shr-back{");
  });

  it("可点 *-continue 须 ≥44 或 TOUCH 插值", () => {
    const hits: string[] = [];
    for (const file of walkSrc(GAMES)) {
      const rel = file.slice(GAMES.length).replace(/\\/g, "/");
      if (B_ALLOW_FILE.test(rel + "/")) continue;
      if (/\.test\.(ts|css)$/.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const r of rulesOf(src)) {
        if (/\.shr-back\b/.test(r.sel)) continue;
        if (!classSuffix(r.sel, "continue")) continue;
        if (!clickable(r.sel, r.body)) continue;
        if (tallEnough(r.body)) continue;
        hits.push(`${rel} :: ${r.sel.slice(0, 90)}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
