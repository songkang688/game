/**
 * 冒险小国王 · 窗口 6 第 2 轮监督修复员(C 档)· 古堡机关小图标清偿钉子。
 *
 * 第 1 轮登记「机关小图标(🚪🔑🔒💡🌀🎟️ 等)可留但登记」,本轮清偿:
 * cellGlyph 的 12 个机关态全部换成与 castleHeroSvg / castleBoxSvg 同族的
 * 参数化 SVG(castleGlyphSvg):64 视窗 + 落影椭圆(压板除外,它嵌在地里)
 * + 1.5px 墨描边 + 左上高光。钉住:
 *  1) 12 态全 SVG、无 emoji、同一支墨(#4B3A6E);
 *  2) 两两 16px 灰度 diffPct ≥8%(实测最小 9.8% 在 exit vs cgate;
 *     开关亮/灭靠光芒剪影 + 深浅罩拉开);
 *  3) index.ts cellGlyph 里机关 emoji 清零(主角/箱子 SVG 断言在 r1 用例);
 *  4) explore.ts 判定层一个字不碰(格常量仍在,只换渲染)。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { castleGlyphSvg, type CastleGlyphKind } from "./visual";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const KINDS: CastleGlyphKind[] = [
  "exit",
  "key",
  "lock",
  "plate",
  "pgate",
  "lamp-on",
  "lamp-off",
  "cgate",
  "plank",
  "wedge",
  "portal",
  "sticker"
];

const sized = (svg: string, px = 64): string =>
  svg.replace(/width="100%"/, `width="${px}"`).replace(/height="100%"/, `height="${px}"`);

async function gray16(svg: string): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(sized(svg)))
    .flatten({ background: "#FFFFFF" })
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = data[i * info.channels];
  return out;
}

function diffPct(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
  return (n / a.length) * 100;
}

describe("古堡机关小图标 · 本体规格", () => {
  it("12 态全 SVG、无 emoji、同族墨描边", () => {
    for (const k of KINDS) {
      const svg = castleGlyphSvg(k);
      expect(svg, k).toContain("<svg");
      expect(svg, k).toContain(`advk-glyph-${k}`);
      expect(EMOJI_RE.test(svg), `${k} 不许有 emoji`).toBe(false);
      expect(svg, `${k} 要有同族墨`).toContain("#4B3A6E");
    }
  });

  it("落影约定:通用图标带落影椭圆,嵌地压板不带", () => {
    expect(castleGlyphSvg("key")).toContain("<ellipse");
    expect(castleGlyphSvg("plate")).not.toContain("<ellipse");
  });

  it("开关两态可辨:亮灯带八向光芒,灭灯无光芒无高光", () => {
    const on = castleGlyphSvg("lamp-on");
    const off = castleGlyphSvg("lamp-off");
    expect(on).toContain("#F0C25A");
    expect(off).not.toContain("#F0C25A");
    expect(off).not.toContain("rgba(255,255,255");
  });
});

describe("古堡机关小图标 · 16px 灰度两两可分(A 档同款量尺)", () => {
  it("12 态两两 diffPct ≥8%(实测最小 9.8%)", async () => {
    const grays: [string, Uint8Array][] = [];
    for (const k of KINDS) grays.push([k, await gray16(castleGlyphSvg(k))]);
    for (let i = 0; i < grays.length; i++) {
      for (let j = i + 1; j < grays.length; j++) {
        expect(
          diffPct(grays[i][1], grays[j][1]),
          `${grays[i][0]} vs ${grays[j][0]}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe("古堡机关小图标 · index.ts 接线(判定不动)", () => {
  const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");
  const cellGlyphBody = SRC.slice(SRC.indexOf("function cellGlyph"), SRC.indexOf("function mountCastle"));

  it("cellGlyph 里机关 emoji 清零,全部走 castleGlyphSvg", () => {
    expect(EMOJI_RE.test(cellGlyphBody)).toBe(false);
    for (const k of ["exit", "key", "lock", "plate", "pgate", "cgate", "portal", "sticker"]) {
      expect(cellGlyphBody).toContain(`castleGlyphSvg("${k}")`);
    }
    expect(cellGlyphBody).toContain('state.switchOn ? "lamp-on" : "lamp-off"');
    expect(cellGlyphBody).toContain('? "plank" : "wedge"');
  });

  it("判定层不动:cellAt / isPlateDown / colorGateOpen / seesawWalkable 仍是唯一裁判", () => {
    expect(cellGlyphBody).toContain("cellAt(state, x, y)");
    expect(cellGlyphBody).toContain("isPlateDown(state)");
    expect(cellGlyphBody).toContain("colorGateOpen(state.switchOn)");
    expect(cellGlyphBody).toContain('seesawWalkable("left", seesawOf(state))');
  });
});
