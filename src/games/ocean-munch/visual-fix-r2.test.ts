/**
 * 海底大胃王 · 1.3 窗口3 第 2 轮监督修复员 · 修后钉子。
 *
 * 对应本轮 A 档 N-03 + 第 1 轮 fixer 遗留 #3:
 * - 竞技场 HUD 深度计 ⬇ / 读秒 ⏱ / 图鉴 📖 与对手名牌 rivalProfile.emoji 画制化;
 * - 电电草 ⚡、地图/海域卡 🔒、对战节点 ⚔、图鉴标题 📖、未收录 ❓、
 *   结算 ⭐☆、BOSS 失败提示 💡 全部换画制小图标;
 * - 对手小徽章 drawRivalChip 直接复用局内 drawFishBody(紫身银星带),零代差。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  drawPadlock,
  drawClockBadge,
  drawDownChevron,
  drawBoltGlyph,
  drawVsBadge,
  drawBookBadge,
  drawQuestBadge,
  drawBulbBadge,
  drawRivalChip,
} from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 极简录制桩:记方法名/样式赋值,截获 fillText 文本 */
function makeRec(): { ctx: CanvasRenderingContext2D; ops: string[]; texts: string[] } {
  const ops: string[] = [];
  const texts: string[] = [];
  const gradient = { addColorStop: (_o: number, c: string) => ops.push(`stop:${c}`) };
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string | symbol) => {
        const name = String(prop);
        if (name === "fillText")
          return (t: string) => {
            texts.push(t);
            ops.push("fillText");
          };
        if (name === "createRadialGradient" || name === "createLinearGradient")
          return () => {
            ops.push(name);
            return gradient;
          };
        return () => {
          ops.push(name);
        };
      },
      set: (_t, prop: string | symbol, v: unknown) => {
        ops.push(`${String(prop)}=${typeof v === "string" ? v : "*"}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, texts };
}

describe("fix(visual-r2) N-03:对手名牌与档位卡画制化", () => {
  it("drawRivalChip:复用 drawFishBody(有渐变身体+描边),定格静态,零 fillText", () => {
    const r = makeRec();
    drawRivalChip(r.ctx, 0, 0, 8);
    expect(r.ops).toContain("createLinearGradient"); // 鱼身双色渐变
    expect(r.ops).toContain("ellipse"); // 身体/眼睛
    expect(r.ops).toContain("stroke"); // 银星带描边
    expect(r.texts).toEqual([]);
    // save/restore 自净,不污染调用方状态
    expect(r.ops.filter((o) => o === "save").length).toBe(r.ops.filter((o) => o === "restore").length);
  });

  it("竞技场 HUD 与场上名牌不再直出 rivalProfile.emoji,改走 drawRivalChip", () => {
    expect(indexSrc.includes("rivalProfile.emoji")).toBe(false);
    expect(indexSrc).toContain("drawRivalChip(ctx, 31 + leadW + 8, 20, 7.5)");
    expect(indexSrc).toContain("drawRivalChip(ctx, rival.x - plateW / 2 - 3, plateY, 6)");
  });

  it("对战选难度档位卡不再直出 p.emoji,小头像画制且档位越高越大", () => {
    expect(indexSrc.includes("ctx.fillText(p.emoji")).toBe(false);
    expect(indexSrc).toContain("drawRivalChip(ctx, rect.x + 16 + rect.h * 0.2, rect.y + rect.h * 0.5, rect.h * (0.17 + i * 0.03))");
  });
});

describe("fix(visual-r2) 遗留#3:竞技场 HUD 图标画制化", () => {
  it("drawClockBadge:表面+双针+顶钮+弧光,零 fillText", () => {
    const r = makeRec();
    drawClockBadge(r.ctx, 0, 0, 8);
    expect(r.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(3); // 表面/中心点/弧光
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(3);
    expect(r.texts).toEqual([]);
  });

  it("drawDownChevron:闭合下箭路径(fill+stroke),零 fillText", () => {
    const r = makeRec();
    drawDownChevron(r.ctx, 0, 0, 7);
    expect(r.ops.filter((o) => o === "lineTo").length).toBeGreaterThanOrEqual(6);
    expect(r.ops).toContain("closePath");
    expect(r.ops).toContain("fill");
    expect(r.ops).toContain("stroke");
    expect(r.texts).toEqual([]);
  });

  it("drawBookBadge:封底+左右两页+中缝+行线,零 fillText", () => {
    const r = makeRec();
    drawBookBadge(r.ctx, 0, 0, 10);
    expect(r.ops).toContain("createLinearGradient"); // 页面上亮下暗
    expect(r.ops.filter((o) => o === "quadraticCurveTo").length).toBeGreaterThanOrEqual(4);
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(3);
    expect(r.texts).toEqual([]);
  });

  it("HUD 三处不再拼 ⬇/⏱/📖 emoji 字符串", () => {
    expect(indexSrc.includes("⬇ ${Math.floor(depth)}")).toBe(false);
    expect(indexSrc.includes("⏱ ${left} 秒")).toBe(false);
    expect(indexSrc.includes("📖 ${dexSeen.size}")).toBe(false);
    expect(indexSrc).toContain("drawDownChevron(ctx, 18, 20, 7)");
    expect(indexSrc).toContain("drawClockBadge(ctx, 19, 20, 7.5)");
    expect(indexSrc).toContain("drawBookBadge(ctx, w - 12 - ctx.measureText(dexLine).width - 10, 41, 6.5)");
  });
});

describe("fix(visual-r2) 遗留#3:地图 / 海域卡 / 图鉴图标画制化", () => {
  it("drawPadlock:锁梁+金身渐变+锁孔+左上高光,零 fillText", () => {
    const r = makeRec();
    drawPadlock(r.ctx, 0, 0, 10);
    expect(r.ops).toContain("createLinearGradient");
    expect(r.ops.filter((o) => o === "roundRect").length).toBeGreaterThanOrEqual(2); // 锁身+锁孔柄
    expect(r.ops).toContain("ellipse"); // 左上高光
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(2);
    expect(r.texts).toEqual([]);
  });

  it("drawVsBadge:白圆牌里两条相向小鱼(两种填色、朝向相反),不用兵器语义", () => {
    const r = makeRec();
    drawVsBadge(r.ctx, 0, 0, 10);
    const fills = r.ops.filter((o) => o.startsWith("fillStyle="));
    expect(fills).toContain("fillStyle=#ff9eb5");
    expect(fills).toContain("fillStyle=#b8a9f5");
    expect(r.ops.filter((o) => o === "ellipse").length).toBeGreaterThanOrEqual(2);
    expect(r.texts).toEqual([]);
  });

  it("drawQuestBadge:问号是画出来的弧+竖+点,零字符", () => {
    const r = makeRec();
    drawQuestBadge(r.ctx, 0, 0, 10);
    expect(r.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(3); // 底圆/问号弧/问号点
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(3);
    expect(r.texts).toEqual([]);
  });

  it("地图锁/海域卡锁/对战节点/图鉴标题/未收录格全部换画制", () => {
    expect(indexSrc.includes('ctx.fillText("🔒"')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("⚔"')).toBe(false);
    expect(indexSrc.includes("📖 生物图鉴")).toBe(false);
    expect(indexSrc.includes('seen ? d.emoji : "❓"')).toBe(false);
    expect(indexSrc.includes('unlocked ? st.emoji : "🔒"')).toBe(false);
    expect(indexSrc).toContain("drawPadlock(ctx, n.x, n.y, r * 0.52)");
    expect(indexSrc).toContain("drawPadlock(ctx, rect.x + 10 + ch * 0.16, rect.y + ch * 0.3, ch * 0.15)");
    expect(indexSrc).toContain("drawVsBadge(ctx, n.x, n.y - r * 0.95, r * 0.34)");
    expect(indexSrc).toContain("drawQuestBadge(ctx, cx, cy - ch * 0.15, ch * 0.18)");
  });

  it("章节地图页行首 ⭐ 换 drawMiniStar,量宽后仍整体居中", () => {
    expect(indexSrc.includes("`⭐ ${themeStars(progress, chapterIdx)}")).toBe(false);
    expect(indexSrc).toContain("drawMiniStar(ctx, w / 2 - starLineW / 2 - 3, 54, 7, true)");
  });
});

describe("fix(visual-r2) 遗留#3:战斗内 ⚡ 与结算面板画制化", () => {
  it("drawBoltGlyph:闭合折线面+描边+白芒,零 fillText", () => {
    const r = makeRec();
    drawBoltGlyph(r.ctx, 0, 0, 9);
    expect(r.ops.filter((o) => o === "lineTo").length).toBeGreaterThanOrEqual(6);
    expect(r.ops).toContain("closePath");
    expect(r.ops).toContain("stroke");
    const fills = r.ops.filter((o) => o.startsWith("fillStyle="));
    expect(fills).toContain("fillStyle=#ffe14a");
    expect(r.texts).toEqual([]);
  });

  it("drawBulbBadge:光线+渐变玻璃球+灯座,零 fillText", () => {
    const r = makeRec();
    drawBulbBadge(r.ctx, 0, 0, 8);
    expect(r.ops).toContain("createRadialGradient");
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(4); // 三道光线+球边+座边
    expect(r.texts).toEqual([]);
  });

  it("电电草提示不再 fillText ⚡,浮动节奏沿用原 sin", () => {
    expect(indexSrc.includes('ctx.fillText("⚡"')).toBe(false);
    expect(indexSrc).toContain("drawBoltGlyph(ctx, ex, 40 + Math.sin(time * 8) * 6, 9)");
  });

  it("通关结算三星与 BOSS 失败 💡 提示全部画制", () => {
    expect(indexSrc.includes('s < earnedStars ? "⭐" : "☆"')).toBe(false);
    expect(indexSrc.includes("💡 ${hint}")).toBe(false);
    expect(indexSrc).toContain("drawMiniStar(ctx, w / 2 + (s - 1) * 42, y + 78, 16, s < earnedStars)");
    expect(indexSrc).toContain("drawBulbBadge(ctx, w / 2 - hintW / 2 - 4, y + 112, 8)");
  });
});
