/**
 * 花色接龙 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-06：对手头像 🐰🐼🦊 是 DOM emoji，与升级后的卡面质感有代差。
 * 修后 art.ts 提供三张画制 Q 版头像 botFaceSVG()（团团=长耳兔 / 圆圆=熊猫 / 点点=尖耳狐），
 * BOT_FACES 不再出现 emoji。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { botFaceSVG, type BotFace } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** BMP 符号区 + 代理对兜住补充平面的全部 emoji */
const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

const FACES: BotFace[] = ["tuantuan", "yuanyuan", "diandian"];

describe("fix(visual-r1) P-06：电脑对手头像画制化", () => {
  it("三张头像都是合法 SVG、零 emoji、结果缓存稳定", () => {
    for (const f of FACES) {
      const svg = botFaceSVG(f);
      expect(svg.startsWith("<svg"), `${f} 应以 <svg 开头`).toBe(true);
      expect(svg.endsWith("</svg>"), `${f} 应以 </svg> 收尾`).toBe(true);
      expect(EMOJI_RE.test(svg), `${f} 不许含 emoji`).toBe(false);
      expect(botFaceSVG(f)).toBe(svg); // 缓存:同一张脸只拼一次
    }
  });

  it("每张脸都有三阶:底色填充 + 描边暗部 + 左上高光", () => {
    for (const f of FACES) {
      const svg = botFaceSVG(f);
      expect(svg, `${f} 要有描边`).toContain("stroke=");
      expect(svg, `${f} 要有左上高光`).toContain("rgba(255,255,255,.4)");
      expect((svg.match(/fill="#/g) ?? []).length, `${f} 底色层数`).toBeGreaterThanOrEqual(4);
    }
  });

  it("三张脸靠耳形剪影两两可分(兔长耳/熊猫圆耳/狐尖耳)", () => {
    const [tu, yu, di] = FACES.map((f) => botFaceSVG(f));
    expect(tu).not.toBe(yu);
    expect(yu).not.toBe(di);
    expect(tu).not.toBe(di);
    // 剪影通道:团团是旋转长耳椭圆,圆圆是圆耳,点点是三角尖耳
    expect(tu).toContain('ry="9"');
    expect(yu).toContain('r="5.4"');
    expect(di).toMatch(/<path d="M11\.2 20\.5/);
  });

  it("index.ts 的 BOT_FACES 不再出现 emoji,改走 botFaceSVG", () => {
    const block = indexSrc.match(/const BOT_FACES = \[[\s\S]*?\];/)?.[0] ?? "";
    expect(block.length).toBeGreaterThan(0);
    expect(EMOJI_RE.test(block)).toBe(false);
    expect(block).toContain("botFaceSVG(");
  });
});
