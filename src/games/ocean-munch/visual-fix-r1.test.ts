/**
 * 海底大胃王 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-01：360 视口主页标题「海底大胃王」右侧 ≈34px 被图鉴徽章盖住。
 * 修法：标题走 fitTitle 避让——优先整幅居中，会压到徽章/按钮时在空档内
 * 居中并自动缩字号（titleFitPx，不小于 15px）；海域选择页两钮之间塞不下时
 * 标题块整体下移（stacked 布局）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drawHeartPip, drawMiniStar, titleFitPx } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 线性量宽桩:width = px × 每字符宽系数 */
const measureAt = (perPx: number) => (px: number) => px * perPx;

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

describe("fix(visual-r1) P-01：标题避让图鉴徽章", () => {
  it("titleFitPx:塞得下就保持原字号", () => {
    expect(titleFitPx(measureAt(7), 24, 15, 200)).toBe(24);
  });

  it("titleFitPx:塞不下逐级缩到恰好放下", () => {
    // 24px 时宽 168 > 119,17px 时宽 119 ≤ 119
    expect(titleFitPx(measureAt(7), 24, 15, 119)).toBe(17);
  });

  it("titleFitPx:再窄也不小于 minPx 兜底", () => {
    expect(titleFitPx(measureAt(7), 24, 15, 60)).toBe(15);
  });

  it("主页/海域页/对战选难度的标题都改走 fitTitle,不再裸 fillText 撞按钮", () => {
    expect(indexSrc).toContain('fitTitle("🐟 海底大胃王", 28');
    expect(indexSrc).toContain("fitTitle(themesTitle");
    expect(indexSrc).toContain('fitTitle("⚖️ 限时谁更胖"');
    expect(indexSrc.includes('ctx.fillText("🐟 海底大胃王", w / 2')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("🐟 海底大胃王 · 九大海域", w / 2')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("⚖️ 限时谁更胖", w / 2')).toBe(false);
  });

  it("海域选择页保留窄屏堆叠分支(标题下移,卡片让位)", () => {
    expect(indexSrc).toContain("stacked ? 82 : 52");
    expect(indexSrc).toContain("stacked ? 96 : 70");
  });
});

describe("fix(visual-r1) P-07：局内 HUD / BOSS 血量图标画制化", () => {
  it("drawHeartPip:实心有渐变面+高光点,空心平面灰白,两态都有描边、零 fillText", () => {
    const filled = makeRec();
    drawHeartPip(filled.ctx, 0, 0, 8, true);
    const empty = makeRec();
    drawHeartPip(empty.ctx, 0, 0, 8, false);
    expect(filled.ops).toContain("createRadialGradient");
    expect(empty.ops).not.toContain("createRadialGradient");
    for (const r of [filled, empty]) {
      expect(r.ops).toContain("bezierCurveTo");
      expect(r.ops).toContain("stroke");
      expect(r.texts).toEqual([]);
    }
    const count = (ops: string[]) => ops.filter((o) => o === "ellipse").length;
    expect(count(filled.ops)).toBe(count(empty.ops) + 1);
  });

  it("BOSS 血心与玩家 HUD 心心不再是 💗🤍 emoji,改走 drawHeartPip", () => {
    expect(indexSrc.includes('i < b.hp ? "💗"')).toBe(false);
    expect(indexSrc.includes('"💗".repeat')).toBe(false);
    expect(indexSrc.includes('"🤍".repeat')).toBe(false);
    expect(indexSrc).toContain("drawHeartPip(ctx, b.x - (b.maxHp - 1) * 11 + i * 22");
    expect(indexSrc).toContain("drawHeartPip(ctx, heartsRight - 17 * (HEARTS_PER_LEVEL - 1 - i)");
  });

  it("护盾读秒图标复用场上的护盾泡泡画法(不再 🛡 emoji)", () => {
    expect(indexSrc.includes("🛡 ${Math.ceil(shield)}s")).toBe(false);
    expect(indexSrc).toContain("drawShieldBadge(ctx, w - 12 - ctx.measureText(shieldTxt).width - 13, 70, 9, 1)");
  });

  it("drawMiniStar:满/空两态互异,都有描边,零 fillText", () => {
    const filled = makeRec();
    drawMiniStar(filled.ctx, 0, 0, 6, true);
    const empty = makeRec();
    drawMiniStar(empty.ctx, 0, 0, 6, false);
    for (const r of [filled, empty]) {
      expect(r.ops.filter((o) => o === "lineTo").length).toBeGreaterThanOrEqual(9); // 五角星路径
      expect(r.ops).toContain("stroke");
      expect(r.texts).toEqual([]);
    }
    // 满星金面 vs 空位灰白面:填色不同
    const fillOf = (ops: string[]) => ops.filter((o) => o.startsWith("fillStyle="));
    expect(fillOf(filled.ops)).not.toEqual(fillOf(empty.ops));
  });

  it("关卡地图 👑/⭐▫ 改画制:皇冠复用 drawCrown,星级走 drawMiniStar", () => {
    expect(indexSrc.includes('ctx.fillText("👑"')).toBe(false);
    expect(indexSrc.includes('s < got ? "⭐" : "▫"')).toBe(false);
    expect(indexSrc).toContain("drawCrown(ctx, r * 1.4)");
    expect(indexSrc).toContain("drawMiniStar(ctx, n.x + (s - 1) * r * 0.62");
  });
});
