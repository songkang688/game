/**
 * 朵朵星星象棋 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-04：AI 对手「棋灵象」座位头像走 🐘 emoji 兜底。
 * 修后 art.ts 提供画制的 Q 版小象头像 robotAvatarSVG()，
 * avatarHTML 的 robot 分支不再出现 emoji。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROBOT_BG, ROBOT_BODY, ROBOT_EDGE, robotAvatarSVG } from "./art";

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

  it("头像具备剪影特征与体积三件套：双耳、卷鼻、左上高光、描边", () => {
    const svg = robotAvatarSVG(30);
    // 双耳 + 内耳 + 腮红 + 高光 —— ellipse 至少 6 处
    expect((svg.match(/<ellipse/g) ?? []).length).toBeGreaterThanOrEqual(6);
    // 卷鼻与额星是有填充的 path 实体，不是单线
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("rgba(255,255,255,.38)"); // 左上高光
    expect(svg).toContain(`stroke="${ROBOT_EDGE}"`); // 深紫描边
  });

  it("紫系配色合法且互不相同（底片/头身/描边三阶）", () => {
    for (const c of [ROBOT_BG, ROBOT_BODY, ROBOT_EDGE]) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set([ROBOT_BG, ROBOT_BODY, ROBOT_EDGE]).size).toBe(3);
  });

  it("index.ts 的 avatarHTML 不再有 🐘 emoji 兜底，改走 robotAvatarSVG", () => {
    const fn = indexSrc.match(/function avatarHTML[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toContain("robotAvatarSVG(");
    expect(fn.includes("🐘")).toBe(false);
  });
});
