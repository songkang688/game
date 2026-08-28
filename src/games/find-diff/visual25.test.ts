/**
 * 找不同 · 1.3 视觉升级验收（第 25 步 C 档，只增不减）。
 *
 * 侦探舞台只动皮肤不动骨头，这里逐条钉死：
 *  ① 题目数据（CellView 六字段）换肤前后逐字段一致（SHA-256 快照）；
 *  ② 命中热区几何与判定半径原样；
 *  ③ 标记层及以上全部 pointer-events:none；
 *  ④ 找到 / 点错走不同视觉分支且互斥；
 *  ⑤ 金圈常显、位置 = 差异坐标；⑥ 收圈终态半径 = 命中判定半径；
 *  ⑦⑧ 徽章点亮数 / 总数与题目数据的映射；⑨ 沙漏流沙比例 = 剩余 / 总时长；
 *  ⑩ 点错不闪红、气泡无批评词；⑪ 窄屏中缝装饰切横挂；
 *  ⑫ reduced 全停但金圈与徽章仍在；⑬ destroy 归零；⑭ 舞台不碰网格盒模型。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LEVELS } from "./levels";
import { buildEndlessScene, buildScene, type CellView, type Scene } from "./scene12";
import { hitRadius } from "./runtime";
import {
  BUBBLE_MS,
  CONFETTI_N,
  FDF_ART,
  HINT_PRESS_MS,
  MAG_MS,
  MISS_BUBBLE_TEXT,
  RIBBON_MS,
  RING_FROM_R,
  RING_MS,
  STAGE_CSS,
  badgeLights,
  badgeRowHTML,
  confettiSpecs,
  hitRingEndRadius,
  hitSparkSpecs,
  hourglassSVG,
  hudTimeHTML,
  sandRatio,
  seamHTML,
  seamMode,
} from "./stage13";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const stageSrc = readFileSync(`${dir}stage13.ts`, "utf8");
const css = shell.slice(shell.indexOf("const CSS = `"), shell.indexOf("\n`;\n"));

/** 从 STAGE_CSS 里抠出一条规则体（找不到就报哪条丢了） */
function stageRule(selector: string): string {
  const at = STAGE_CSS.indexOf(`${selector}{`);
  expect(at, `STAGE_CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = STAGE_CSS.indexOf("{", at) + 1;
  return STAGE_CSS.slice(from, STAGE_CSS.indexOf("}", from)).replace(/\s+/g, "");
}

/** 一格的六个题目字段，顺序钉死（emoji/scale/flip/tint/count/dx/dy） */
function cellRow(c: CellView): unknown[] {
  return [c.emoji, c.scale, c.flip, c.tint, c.count, c.dx, c.dy];
}

/** 一关场景里所有会被画出来的题目数据 */
function sceneRow(s: Scene): unknown[] {
  return [
    s.rows,
    s.cols,
    s.mirrored,
    s.diffIdx,
    s.kinds,
    s.left.map(cellRow),
    s.second ? s.second.map(cellRow) : null,
    s.right.map(cellRow),
  ];
}

describe("找不同 1.3 · ① 题目数据换肤前后逐字段一致", () => {
  /** 换肤前实测的指纹：188 关（连环逐轮）+ 无尽前 12 轮的 CellView 全量 */
  const SKIN_FINGERPRINT = "48b24fb2b3fc438214783e234ae264ddaea2b5021fe7416a26e0b6b95a763c61";

  it("CellView 的 dx/dy/scale/flip/count/emoji（连 tint 一起）整份 SHA-256 与换肤前一致", () => {
    const rows: string[] = [];
    for (let level = 0; level < LEVELS.length; level++) {
      for (let round = 0; round < Math.max(1, LEVELS[level].rounds); round++) {
        rows.push(JSON.stringify(sceneRow(buildScene(level, round))));
      }
    }
    for (let r = 1; r <= 12; r++) rows.push(JSON.stringify(sceneRow(buildEndlessScene(r))));
    expect(createHash("sha256").update(rows.join("\n")).digest("hex")).toBe(SKIN_FINGERPRINT);
  });

  it("paintCell 仍逐字段读题目数据画图：位移/缩放/翻转/个数/emoji 一个都没被皮肤接管", () => {
    const paint = shell.slice(shell.indexOf("function paintCell("), shell.indexOf("interface RunnerOptions"));
    expect(paint).toContain("(view.dx + spread) * px");
    expect(paint).toContain("view.dy * px");
    expect(paint).toContain("scale(${view.scale.toFixed(2)})");
    expect(paint).toContain("scaleX(${view.flip ? -1 : 1})");
    expect(paint).toContain("${view.emoji}");
    expect(paint).toContain("view.count");
    expect(paint).toContain("view.tint");
  });
});

describe("找不同 1.3 · ② 命中热区几何与判定半径原样", () => {
  it("hitRadius 的三个锚点值换肤前后不变", () => {
    expect(hitRadius(26)).toBe(22);
    expect(hitRadius(44)).toBeCloseTo(24.2, 5);
    expect(hitRadius(80)).toBe(44);
  });

  it("hitAt 还是那条判定链：量实际格宽 → hitRadius → pickNearest/pickForgiving", () => {
    const hit = shell.slice(shell.indexOf("function hitAt("), shell.indexOf("const missTimes"));
    expect(hit).toContain("const radius = hitRadius(width);");
    expect(hit).toContain("pickNearest(centers, clientX, clientY, radius)");
    expect(hit).toContain("pickForgiving(centers, clientX, clientY, radius");
  });

  it("格宽、缝隙、网格模板一个字没动", () => {
    expect(shell).toContain("export const PLAY_CELL_PX = 44;");
    expect(shell).toContain("const GAP_PX = 4;");
    expect(shell).toContain("grid.style.gridTemplateColumns = `repeat(${scene.cols},${px}px)`");
    expect(shell).toContain("grid.style.gridAutoRows = `${px}px`");
  });
});

describe("找不同 1.3 · ③ 标记层及以上不挡点击", () => {
  it("动画层 / 暖色滤镜 / 书桌装饰全部 pointer-events:none", () => {
    for (const sel of [".fdf-fxlayer", ".fdf-warmth", ".fdf-deco"]) {
      expect(stageRule(sel), `${sel} 会挡点击`).toContain("pointer-events:none");
    }
  });

  it("放大镜 / 收圈 / 气泡 / 彩纸自己也标了 none（不依赖继承）", () => {
    for (const sel of [".fdf-mag", ".fdf-hitring", ".fdf-bubble", ".fdf-paper"]) {
      expect(stageRule(sel), `${sel} 会挡点击`).toContain("pointer-events:none");
    }
  });

  it("所有命中/点错/彩纸节点只进 fxLayer，不落进棋盘", () => {
    expect(shell).toContain("fxLayer.append(mag, ring, stars)");
    expect(shell).toContain("fxLayer.appendChild(bubble)");
    expect(shell).toContain("fxLayer.appendChild(dot)");
    expect(shell).toContain("fxLayer.appendChild(paper)");
    expect(shell).not.toContain("playGrid.appendChild(mag");
  });
});

describe("找不同 1.3 · ④ 找到与点错走不同视觉分支且互斥", () => {
  const attemptSrc = shell.slice(shell.indexOf("function attempt("), shell.indexOf("function celebrate("));
  const successPart = attemptSrc.slice(attemptSrc.indexOf("if (answers.has(index)) {"), attemptSrc.indexOf("// 点错"));
  const missPart = attemptSrc.slice(attemptSrc.indexOf("// 点错"));

  it("命中分支：金圈 + 命中仪式 + 徽章点亮，绝不冒出问号气泡", () => {
    expect(successPart).toContain("markFound(index)");
    expect(successPart).toContain("hitFx(index)");
    expect(successPart).toContain("renderBadges(true)");
    expect(successPart).not.toContain("missFx(");
  });

  it("点错分支：问号气泡 + 灰涟漪，绝不画金圈也不点徽章", () => {
    expect(missPart).toContain("missFx(clientX, clientY)");
    expect(missPart).not.toContain("hitFx(");
    expect(missPart).not.toContain("markFound(");
    expect(missPart).not.toContain("renderBadges(");
  });
});

describe("找不同 1.3 · ⑤ 金圈常显且位置 = 差异坐标", () => {
  it("markFound 还是打在 playCells[src] 与镜像换算后的参考格上（差异坐标零改动）", () => {
    const mark = shell.slice(shell.indexOf("function markFound("), shell.indexOf("// --- 缩放与平移"));
    expect(mark).toContain('playCells[src]?.classList.add("fdf-found")');
    expect(mark).toContain("sourceIndex(scene, src)");
    expect(mark).toContain('row[mirrorSrc]?.classList.add("fdf-found")');
  });

  it("金圈是 foundGold 常显实线圈：没有动画、reduced 也不藏", () => {
    const found = css.slice(css.indexOf(".fdf-cell.fdf-found::after{"), css.indexOf("}", css.indexOf(".fdf-cell.fdf-found::after{")));
    expect(found).toContain(FDF_ART.foundGold);
    expect(found).toContain("border-radius:50%");
    expect(found).not.toContain("animation");
    const reducedBlock = STAGE_CSS.slice(STAGE_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reducedBlock).not.toContain("fdf-found");
  });
});

describe("找不同 1.3 · ⑥ 收圈终态半径 = 命中判定半径", () => {
  it("hitRingEndRadius 与 hitRadius 是同一支（26/30/44/80 四点逐一对上）", () => {
    for (const w of [26, 30, 44, 80]) expect(hitRingEndRadius(w)).toBe(hitRadius(w));
  });

  it("收圈从 28px 起手，终态直径由 hitRingEndRadius × 2 喂进 CSS 变量", () => {
    expect(RING_FROM_R).toBe(28);
    expect(shell).toContain("hitRingEndRadius(r.width) * 2");
    expect(shell).toContain('ring.style.setProperty("--fdf-ring-d"');
    expect(STAGE_CSS).toContain(`width:${RING_FROM_R * 2}px;height:${RING_FROM_R * 2}px`);
    expect(STAGE_CSS).toContain("to{width:var(--fdf-ring-d);height:var(--fdf-ring-d);}");
  });
});

describe("找不同 1.3 · ⑦⑧ 侦探徽章映射题目数据", () => {
  it("点亮数 = 已找到数：0 / 2 / 全部三点映射", () => {
    expect(badgeLights(0, 5)).toEqual([false, false, false, false, false]);
    expect(badgeLights(2, 5)).toEqual([true, true, false, false, false]);
    expect(badgeLights(5, 5)).toEqual([true, true, true, true, true]);
    expect(badgeLights(9, 5)).toEqual([true, true, true, true, true]);
    expect(badgeLights(-1, 3)).toEqual([false, false, false]);
  });

  it("徽章排 HTML：枚数与点亮 class 数都对，闪光只闪最新那枚", () => {
    const row = badgeRowHTML(2, 5, true);
    expect(row.match(/fdf-medal /g) ?? []).toHaveLength(5);
    expect(row.match(/fdf-medal-lit/g) ?? []).toHaveLength(2);
    expect(row.match(/fdf-medal-dim/g) ?? []).toHaveLength(3);
    expect(row.match(/fdf-medal-flash/g) ?? []).toHaveLength(1);
    expect(badgeRowHTML(2, 5, false)).not.toContain("fdf-medal-flash");
  });

  it("徽章总数 = 该关差异总数（关卡数据只读，抽 4 关 + 无尽）", () => {
    for (const level of [0, 105, 150, 187]) {
      const scene = buildScene(level);
      expect(scene.diffIdx.length).toBe(LEVELS[level].diffs);
      expect(badgeLights(0, scene.diffIdx.length)).toHaveLength(LEVELS[level].diffs);
    }
    expect(badgeLights(0, buildEndlessScene(5).diffIdx.length)).toHaveLength(3);
  });
});

describe("找不同 1.3 · ⑨ 沙漏流沙比例 = 剩余时间 / 总时长", () => {
  it("三点映射：满 / 半 / 空，越界与非法输入都夹住", () => {
    expect(sandRatio(46, 46)).toBe(1);
    expect(sandRatio(23, 46)).toBe(0.5);
    expect(sandRatio(0, 46)).toBe(0);
    expect(sandRatio(-5, 46)).toBe(0);
    expect(sandRatio(99, 46)).toBe(1);
    expect(sandRatio(10, 0)).toBe(0);
    expect(sandRatio(Number.NaN, 46)).toBe(0);
  });

  it("沙漏 SVG 带出夹好的比例；满仓没有沙堆、空仓没有上仓沙，流沙线只在中途出现", () => {
    expect(hourglassSVG(1)).toContain('data-sand="1.000"');
    expect(hourglassSVG(1)).toContain("fdf-sandtop");
    expect(hourglassSVG(1)).not.toContain("fdf-sandline");
    expect(hourglassSVG(0)).toContain("fdf-sandpile");
    expect(hourglassSVG(0)).not.toContain("fdf-sandtop");
    expect(hourglassSVG(0.5)).toContain("fdf-sandline");
  });

  it("HUD 是「沙漏 + 秒数」；闯关与无尽两处都换到了这条映射，计时逻辑没动", () => {
    expect(hudTimeHTML(23, 46)).toContain('data-sand="0.500"');
    expect(hudTimeHTML(23, 46)).toContain(">23s<");
    expect(hudTimeHTML(-3, 46)).toContain(">0s<");
    expect(shell).toContain("bits.push(hudTimeHTML(timeLeft, cfg.timeSec))");
    expect(shell).toContain("runner.hud.innerHTML = hudTimeHTML(timeLeft, scene.timeSec)");
    expect(shell).toContain("timeLeft--;");
  });
});

describe("找不同 1.3 · ⑩ 点错不吓人（分级红线）", () => {
  it("问号气泡文案不含任何批评词", () => {
    expect(MISS_BUBBLE_TEXT).not.toMatch(/错|笨|差|慢|不行|失败|批评/);
    expect(MISS_BUBBLE_TEXT.length).toBeGreaterThan(0);
  });

  it("点错的视觉全是灰调：气泡描边与涟漪都用 missGray，没有一处闪红", () => {
    expect(stageRule(".fdf-bubble")).toContain("rgba(140,140,150,.6)");
    const ripple = css.slice(css.indexOf(".fdf-ripple{"), css.indexOf("}", css.indexOf(".fdf-ripple{")));
    expect(ripple).toContain("rgba(140,140,150,.6)");
    for (const red of ["#f03e3e", "#fa5252", "#e03131", "#ff0000"]) {
      expect(STAGE_CSS).not.toContain(red);
      expect(css).not.toContain(red);
    }
  });
});

describe("找不同 1.3 · ⑪ 中缝装饰随窄屏切横挂", () => {
  it("seamMode：360/320 上下排布走顶部横挂，宽屏走别针连框", () => {
    expect(seamMode(320)).toBe("hang");
    expect(seamMode(360)).toBe("hang");
    expect(seamMode(480)).toBe("hang");
    expect(seamMode(768)).toBe("link");
    expect(seamMode(Number.NaN)).toBe("hang");
  });

  it("两种排法的样式与素材都在：横挂 3 别针、连框 2 别针", () => {
    expect(STAGE_CSS).toContain(".fdf-split.fdf-seam-hang{");
    expect(STAGE_CSS).toContain(".fdf-split.fdf-seam-link{");
    expect(seamHTML("hang").match(/kit-rope-pin/g) ?? []).toHaveLength(3);
    expect(seamHTML("link").match(/kit-rope-pin/g) ?? []).toHaveLength(2);
    expect(shell).toContain("`fdf-seam-${seam}`");
    expect(shell).toContain("split.innerHTML = seamHTML(seam)");
  });
});

describe("找不同 1.3 · ⑫ reduced：动效全停，信息不丢", () => {
  const reducedBlock = STAGE_CSS.slice(STAGE_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));

  it("放大镜 / 收圈 / 彩纸 / 流沙线全停", () => {
    expect(reducedBlock).toContain(".fdf-mag,.fdf-hitring,.fdf-paper,.fdf-sandline{display:none;}");
    expect(reducedBlock).toContain(".fdf-bubble,.fdf-ribbon,.fdf-medal-flash{animation:none;}");
  });

  it("金圈与徽章不受影响：reduced 块里一个字都没提它们", () => {
    expect(reducedBlock).not.toContain("fdf-found");
    expect(reducedBlock).not.toMatch(/\.fdf-medal[,{]/);
    expect(reducedBlock).not.toContain("fdf-badges");
  });

  it("JS 侧同口径：命中仪式整个跳过、徽章不闪但照亮、缎带保留静态", () => {
    const hitFxSrc = shell.slice(shell.indexOf("function hitFx("), shell.indexOf("function missFx("));
    expect(hitFxSrc).toContain("if (reduced) return;");
    expect(shell).toContain("flashNewest && !reduced");
    const cele = shell.slice(shell.indexOf("function celebrate("), shell.indexOf("// --- 两级提示"));
    expect(cele.indexOf("split.replaceWith(ribbon)")).toBeLessThan(cele.indexOf("if (reduced) return;"));
  });
});

describe("找不同 1.3 · ⑬ destroy 归零 & 不新开计时器", () => {
  it("destroy 清空动画层，放大镜与流沙一个节点不剩", () => {
    expect(shell).toContain('fxLayer.textContent = "";');
  });

  it("整份代码仍旧只有原来那 3 个 setInterval：沙漏与放大镜都不开新表", () => {
    expect((shell.match(/setInterval\(/g) ?? []).length).toBe(3);
    expect(stageSrc).not.toContain("setInterval");
    expect(stageSrc).not.toContain("setTimeout");
  });

  it("命中仪式的收尸计时全走 later()（destroy 一把全清）", () => {
    expect(shell).toContain("later(() => mag.remove()");
    expect(shell).toContain("later(() => ring.remove()");
    expect(shell).toContain("later(() => bubble.remove()");
    expect(shell).toContain("later(() => paper.remove()");
  });
});

describe("找不同 1.3 · ⑭ 舞台不碰网格盒模型 & 360px 细则", () => {
  it("STAGE_CSS 对 .fdf-grid / .fdf-cell / .fdf-glyph 的盒模型零规则（软影只用 ::before）", () => {
    expect(STAGE_CSS).not.toContain(".fdf-grid{");
    expect(STAGE_CSS).not.toContain(".fdf-cell{");
    expect(STAGE_CSS).not.toContain(".fdf-glyph");
    expect(STAGE_CSS).toContain(".fdf-cell::before{");
  });

  it("画框与挂牌是加类不换类：原有 fdf-panel / fdf-label 一个不丢", () => {
    expect(shell).toContain('"fdf-panel fdf-framed"');
    expect(shell).toContain('"fdf-label fdf-plaque"');
  });

  it("360px 细则：挂牌与气泡字号 ≥14px，窄屏画框收窄不越界", () => {
    expect(stageRule(".fdf-plaque.fdf-label")).toContain("font-size:14px");
    expect(stageRule(".fdf-bubble")).toContain("font-size:14px");
    expect(STAGE_CSS).toContain("@media (max-width:380px)");
    expect(STAGE_CSS).toContain(".fdf-row .fdf-framed{border-width:5px;}");
  });

  it("动效时序表与规格逐条一致：260/300/350/800/200ms，彩纸 16 粒，星屑 3 颗", () => {
    expect(MAG_MS).toBe(260);
    expect(RING_MS).toBe(300);
    expect(BUBBLE_MS).toBe(350);
    expect(RIBBON_MS).toBe(800);
    expect(HINT_PRESS_MS).toBe(200);
    expect(CONFETTI_N).toBe(16);
    expect(confettiSpecs(() => 0.5)).toHaveLength(16);
    expect(hitSparkSpecs(() => 0.5)).toHaveLength(3);
  });
});
