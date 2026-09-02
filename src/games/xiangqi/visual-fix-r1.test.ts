/**
 * 朵朵星星象棋 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-04（B 档 TOP10 之 4）：AI 对手「棋灵象」座位头像走 🐘 emoji 兜底。
 * 修后 art.ts 提供画制小象头像 robotAvatarSVG()——复用棋子 sprite 的
 * 面（PIECE_FACE）/ 侧壁（PIECE_WALL）/ 描边（BLACK_INK）规格，
 * 象头「圆头 + 大耳 + 卷鼻」，耳内 RED_INK 10% 淡红；
 * avatarHTML 的 robot 分支不再出现 emoji。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BLACK_INK, PIECE_FACE, PIECE_WALL, robotAvatarSVG } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** BMP 符号区 + 代理对兜住补充平面的全部 emoji */
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

describe("fix(visual-r1) P-04：棋灵象头像画制化", () => {
  it("robotAvatarSVG 产出合法 SVG，零 emoji，尺寸随参数注入", () => {
    const svg = robotAvatarSVG(30);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(EMOJI_RE.test(svg)).toBe(false);
    expect(svg).toContain('width="30"');
    expect(svg).toContain('height="30"');
  });

  it("头像与棋子 sprite 同一套材质：面 / 侧壁 / 墨色描边 / 投影", () => {
    const svg = robotAvatarSVG(30);
    expect(svg).toContain(`fill="${PIECE_FACE}"`); // 棋子面色
    expect(svg).toContain(`fill="${PIECE_WALL}"`); // 侧壁月牙
    expect(svg).toContain(`stroke="${BLACK_INK}"`); // 墨色描边
    expect(svg).toContain("rgba(110,75,35,.25)"); // 与 pieceIconSVG 同款投影
  });

  it("象头具备剪影特征：大耳(淡红耳窝)、圆头、有体积的卷鼻", () => {
    const svg = robotAvatarSVG(30);
    expect(svg).toContain("rgba(194,59,46,.1)"); // RED_INK 10% 耳内
    expect((svg.match(/<ellipse/g) ?? []).length).toBeGreaterThanOrEqual(3); // 投影+双耳
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(1); // 卷鼻是闭合填充路径
    expect(svg).toContain("stroke-linejoin");
  });

  it("index.ts 的 avatarHTML 不再有 🐘 emoji 兜底，改走 robotAvatarSVG", () => {
    const fn = indexSrc.match(/function avatarHTML[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toContain("robotAvatarSVG(");
    expect(fn.includes("🐘")).toBe(false);
  });
});
