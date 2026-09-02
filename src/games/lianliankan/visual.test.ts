/**
 * 连连看 · 1.3 第 21 步 A 档视觉用例(只增不减)。
 *
 * 覆盖 step 文档第九节的 12 条:--llk- token 逐字核对、图标组 ≥12 且两两互异、
 * 牌面 <svg 替换裸 emoji、流星坐标与判定拐点逐点钉死、覆盖层 pointer-events none、
 * 选中/hover/消除三态、凹槽只加不挡点击、提示柔光对得上真求解、洗牌 180ms 与
 * reduced 瞬换、hurry reduced 只变色、destroy 收干净、玩法判定只读。
 * 全部跑在 node:源码字符串断言 + art.ts 纯函数,不引 jsdom。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { ICONS, iconById, iconSvg } from "../../art/kit/icons";
import { anyMove, createBoard, findPath, type BoardSpec } from "./board";
import { THEME_EMOJIS } from "./levels";
import {
  CLEAR_MS,
  HINT_MAX,
  LINK_HOLD_MS,
  SHAKE_MS,
  clearMs,
  linkHoldMs,
  linkInit,
  tapCell
} from "./logic";
import {
  DUST_COUNT,
  DUST_STAGGER_MS,
  HINT_GLOW_MS,
  METEOR_MS,
  SHUFFLE_FX_MS,
  SLIM_TILE_PX,
  TILE_ICON_FRAC,
  hudGlyphSvg,
  maskFaceSvg,
  meteorPoints,
  meteorSvg,
  slimTile,
  themeOffset,
  tileFaceSvg,
  tileIcon,
  tileIconName,
  type Px
} from "./art";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const ART_SRC = readFileSync(fileURLToPath(new URL("./art.ts", import.meta.url)), "utf8");
/** 样式表段(const CSS = `...`) */
const CSS = SRC.slice(SRC.indexOf("const CSS = `"), SRC.indexOf("`;\n\nfunction el<"));
/** reduced 动效段 */
const REDUCED = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
/** 牌面上不许出现的表情字符(含 ⭐/❓ 这些 BMP 符号区) */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2753}]/u;

describe("视觉① 配色板与动效时序 token(step 文档四·补一 / 四·补三逐字核对)", () => {
  it("八个颜色 token 全部落在样式表,色值与表一致", () => {
    expect(CSS).toContain("--llk-desk: #E8D5BC;");
    expect(CSS).toContain("--llk-tile-top: #FFFDF6;");
    expect(CSS).toContain("--llk-tile-top2: #F4EDE0;");
    expect(CSS).toContain("--llk-tile-side: #D8CBB4;");
    expect(CSS).toContain("--llk-select: #F4859F;");
    expect(CSS).toContain("--llk-trail: #FFD678;");
    expect(CSS).toContain("--llk-hint: rgba(255,214,120,.28);");
    expect(CSS).toContain("--llk-hurry: #F0955A;");
  });

  it("六个时长 token 在样式表,art.ts 常量与 token 数值一致", () => {
    expect(CSS).toContain("--llk-ms-hover: 120ms;");
    expect(CSS).toContain("--llk-ms-trail: 240ms;");
    expect(CSS).toContain("--llk-ms-clear: 200ms;");
    expect(CSS).toContain("--llk-ms-hint: 2s;");
    expect(CSS).toContain("--llk-ms-shuffle: 180ms;");
    expect(CSS).toContain("--llk-ms-heart: 900ms;");
    expect(METEOR_MS).toBe(240);
    expect(SHUFFLE_FX_MS).toBe(180);
    expect(HINT_GLOW_MS).toBe(2000);
    // 状态机的撑线 / 消散时长跟流星、翻转对齐,且都在规格区间里
    expect(LINK_HOLD_MS).toBe(METEOR_MS);
    expect(CLEAR_MS).toBe(200);
  });
});

describe("视觉② 牌面图标(≥12 种、两两互异、告别裸 emoji)", () => {
  it("图标组 ≥ 12 种;抽三对整张 SVG 互不相同", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(12);
    expect(iconSvg(iconById("flower"))).not.toBe(iconSvg(iconById("star")));
    expect(iconSvg(iconById("cup"))).not.toBe(iconSvg(iconById("moon")));
    expect(iconSvg(iconById("fish"))).not.toBe(iconSvg(iconById("leaf")));
  });

  it("牌面与面具都是 <svg,一个表情字符都不剩;index.ts 里 emoji 直出已拆", () => {
    for (const theme of THEME_EMOJIS) {
      for (let v = 0; v < theme.length; v++) {
        const svg = tileFaceSvg(theme[0], v);
        expect(svg.startsWith("<svg"), `主题 ${theme[0]} 第 ${v} 号`).toBe(true);
        expect(EMOJI_RE.test(svg), `主题 ${theme[0]} 第 ${v} 号混进了表情字符`).toBe(false);
      }
    }
    expect(maskFaceSvg().startsWith("<svg")).toBe(true);
    expect(EMOJI_RE.test(maskFaceSvg())).toBe(false);
    expect(SRC).not.toContain("span.textContent = this.emojis[v]");
    expect(SRC).not.toContain("MASK_FACE");
    expect(SRC).toContain("tileFaceSvg(this.themeKey, v)");
    expect(SRC).toContain("maskFaceSvg()");
    // aria 念的是图标中文名,不再是 emoji 字符
    expect(SRC).toContain("`图案 ${tileIconName(this.themeKey, v)}`");
  });

  it("十套主题里 v 相同必同款、v 不同必不同款;主题之间起点确实转开了", () => {
    const starters = new Set<string>();
    for (const theme of THEME_EMOJIS) {
      const key = theme[0];
      const off = themeOffset(key);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThan(ICONS.length);
      const ids = theme.map((_, v) => tileIcon(key, v).id);
      expect(new Set(ids).size, `主题 ${key} 里有两款撞了图标`).toBe(theme.length);
      // 同 v 再取一次还是同款(缓存与映射都稳定)
      expect(tileFaceSvg(key, 3)).toBe(tileFaceSvg(key, 3));
      expect(tileIconName(key, 3)).toBe(tileIcon(key, 3).name);
      starters.add(ids[0]);
    }
    expect(starters.size, "十套主题的 0 号图标全一样,主题就白换了").toBeGreaterThan(1);
  });
});

describe("视觉③ 流星光带(灵魂:坐标钉死在判定拐点上)", () => {
  const centerOf = (r: number, c: number): Px => [c * 40 + 20, r * 40 + 20];

  it("meteorPoints 与判定拐点逐点一致:不加点、不减点、不换序", () => {
    const spec: BoardSpec = { rows: 6, cols: 6, kinds: 6, gravity: "none", maxTurns: 2 };
    for (const seed of [7, 21, 20260827]) {
      const board = createBoard(spec, mulberry32(seed));
      const pair = anyMove(board, 2);
      expect(pair, `seed ${seed} 开局就没得连`).not.toBeNull();
      const path = findPath(board, pair![0], pair![1], 2)!;
      const pts = meteorPoints(path, centerOf);
      expect(pts.length).toBe(path.length);
      for (let i = 0; i < path.length; i++) {
        expect(pts[i], `seed ${seed} 第 ${i} 个点`).toEqual(centerOf(path[i][0], path[i][1]));
      }
    }
  });

  it("polyline 与 animateMotion 的路径都是这些点的逐字拼接;渐变头亮尾淡;星尘 3 颗交错", () => {
    const pts: Px[] = [[20, 20], [180, 20], [180, 140]];
    const svg = meteorSvg(pts, 240, 240, { uid: 9 });
    expect(svg).toContain(`points="20,20 180,20 180,140"`);
    expect(svg).toContain(`path="M20 20 L180 20 L180 140"`);
    expect(svg).toContain(`stop-color="rgba(255,214,120,0)"`);
    expect(svg).toContain(`stop-color="#FFD678"`);
    // 渐变沿「尾 → 头」摆:x1y1 是第一个点,x2y2 是最后一个点
    expect(svg).toContain(`x1="20" y1="20" x2="180" y2="140"`);
    expect((svg.match(/<animateMotion/g) ?? []).length).toBe(DUST_COUNT);
    expect(svg).toContain(`dur="${METEOR_MS / 1000}s" begin="0s"`);
    expect(svg).toContain(`begin="${DUST_STAGGER_MS / 1000}s"`);
    expect(svg).toContain(`begin="${(2 * DUST_STAGGER_MS) / 1000}s"`);
    expect(svg).toContain("stroke-linejoin=\"round\"");
  });

  it("安静模式只画静态线:没有星尘、没有滑动;点不够或画布非法时返回空串", () => {
    const pts: Px[] = [[10, 10], [50, 10]];
    const calm = meteorSvg(pts, 100, 100, { calm: true });
    expect(calm).toContain("llk-line-calm");
    expect(calm).not.toContain("<animateMotion");
    expect(calm).not.toContain("llk-dust");
    expect(meteorSvg([[1, 1]], 100, 100)).toBe("");
    expect(meteorSvg(pts, 0, 100)).toBe("");
  });

  it("覆盖层绝不挡点击:llk-fx / llk-line 都是 pointer-events none,SVG 挂在盘面容器最后", () => {
    expect(/\.llk-fx\s*\{[^}]*pointer-events:\s*none/.test(CSS)).toBe(true);
    expect(/\.llk-line\s*\{[^}]*pointer-events:\s*none/.test(CSS)).toBe(true);
    expect(SRC).toContain("this.root.append(this.boardEl, this.fx);");
    // 路径坐标必须来自判定:drawPath 只做 meteorPoints 映射,art.ts 里没有半个求解函数
    expect(SRC).toContain("meteorPoints(path, (r, c) => {");
    for (const solver of ["findPath", "tapCell", "anyMove", "removePair"]) {
      expect(ART_SRC, `art.ts 不许自己算判定:${solver}`).not.toContain(solver);
    }
  });
});

describe("视觉④ 麻将砖三态与凹槽", () => {
  it("选中态:抬 4px + 主题色描边 + 底光;render 只在 picked 时挂 llk-sel", () => {
    expect(/\.llk-cell\.llk-sel\s*\{[^}]*translateY\(-4px\)[^}]*var\(--llk-select\)/.test(CSS)).toBe(true);
    expect(SRC).toContain('if (picked) node.classList.add("llk-sel");');
    // 菱形(shape3)选中时先抬再转,不丢 45° 姿态
    expect(CSS).toContain(".llk-cell.llk-shape3.llk-sel { transform: translateY(-4px) rotate(45deg); }");
  });

  it("hover 态:抬 2px;reduced 下无位移、改描边", () => {
    expect(/:hover\s*\{\s*transform:\s*translateY\(-2px\)/.test(CSS)).toBe(true);
    expect(REDUCED).toContain(".llk-cell:hover, .llk-cell.llk-sel { transform: none; }");
    expect(/:hover\s*\{\s*box-shadow:\s*0 0 0 2px var\(--llk-select\)/.test(REDUCED)).toBe(true);
  });

  it("消除态:先摘 llk-linking 再挂 llk-clear,翻转消散走 var(--llk-ms-clear),reduced 改淡出", () => {
    const off = SRC.indexOf('node.classList.remove("llk-linking");');
    const on = SRC.indexOf('node.classList.add("llk-clear");');
    expect(off).toBeGreaterThan(-1);
    expect(on).toBeGreaterThan(off);
    expect(CSS).toContain(".llk-cell.llk-clear { animation: llkClear var(--llk-ms-clear) ease-in forwards; }");
    expect(/@keyframes llkClear[^}]*rotateY/.test(CSS)).toBe(true);
    expect(REDUCED).toContain(".llk-cell.llk-clear { animation: llkFadeOut");
  });

  it("已消除格位的凹槽:伪元素画、pointer-events none、不改按钮几何(热区一个像素不动)", () => {
    const groove = /\.llk-cell\.llk-gone:not\(\.llk-edge\)::after\s*\{([^}]*)\}/.exec(CSS);
    expect(groove, "找不到凹槽伪元素").not.toBeNull();
    expect(groove![1]).toContain("pointer-events: none");
    expect(groove![1]).toContain("inset: 8%");
    // llk-gone 本体不许写死宽高,格子几何仍由 gridTemplate 说了算
    const gone = /\.llk-cell\.llk-gone\s*\{([^}]*)\}/.exec(CSS);
    expect(gone).not.toBeNull();
    expect(/(?<!-)\bwidth:|(?<!-)\bheight:/.test(gone![1])).toBe(false);
    expect(SRC).toContain("gridTemplate(cols)");
    expect(SRC).toContain("aspect-ratio: 1");
  });
});

describe("视觉⑤ 提示柔光与洗牌腾空", () => {
  it("柔光高亮的就是判定真求解那一对;2s 呼吸两次;reduced 恒定柔光", () => {
    expect(SRC).toContain("const pair = hintPair(board, maxTurns);");
    expect(SRC).toContain("view.highlight(pair);");
    expect(SRC).toContain("this.jan.after(HINT_GLOW_MS, () => node.classList.remove(\"llk-hint\"));");
    expect(CSS).toContain("animation: llkHintBreath calc(var(--llk-ms-hint) / 2) ease-in-out 2;");
    expect(/\.llk-cell\.llk-hint\s*\{[^}]*var\(--llk-hint\)/.test(CSS)).toBe(true);
    expect(REDUCED).toContain(".llk-cell.llk-hint { animation: none; }");
    // 提示经济一个字没动:hintsUsed 只在真提示那条路上加,用完仍是「指个方向」
    expect([...SRC.matchAll(/hintsUsed\+\+/g)].length).toBe(1);
    expect(SRC).toContain("指个方向");
    expect(HINT_MAX).toBe(3);
  });

  it("洗牌腾空 180ms 交错;安静模式第一行就瞬换返回;三处洗牌路径都接了线", () => {
    expect(CSS).toContain(".llk-cell.llk-shuf { animation: llkShufHop var(--llk-ms-shuffle) ease-in-out both; }");
    const fx = SRC.slice(SRC.indexOf("shuffleFx(): void {"), SRC.indexOf("private onCell"));
    expect(fx).toContain("if (this.calm) return;");
    expect(fx).toContain("animationDelay");
    expect(REDUCED).toContain(".llk-badge.llk-hurry, .llk-cell.llk-shuf, .llk-line { animation: none; }");
    // 闯关洗牌、无尽手动重排、无尽死局自动重排:三处都有腾空反馈
    expect([...SRC.matchAll(/view\.shuffleFx\(\);/g)].length).toBe(3);
  });
});

describe("视觉⑥ hurry 心跳与 destroy 收摊", () => {
  it("hurry:暖橙卡片 + 900ms ±3% 心跳;reduced 只变色不缩放", () => {
    expect(/\.llk-badge\.llk-hurry\s*\{[^}]*var\(--llk-hurry\)[^}]*llkHeart var\(--llk-ms-heart\)/.test(CSS)).toBe(true);
    expect(CSS).toContain("@keyframes llkHeart { 50% { transform: scale(1.03); } }");
    // reduced 块里心跳停了,但没有任何一条把 hurry 的底色改回去——变色保留
    expect(REDUCED).toContain(".llk-badge.llk-hurry, .llk-cell.llk-shuf, .llk-line { animation: none; }");
    expect(REDUCED).not.toContain("llk-hurry {");
  });

  it("destroy:闯关与无尽都先 view.dispose() 拆流星,再 jan.destroy() 清计时,最后整树移除", () => {
    expect([...SRC.matchAll(/view\.dispose\(\);/g)].length).toBe(2);
    const spots = [...SRC.matchAll(/view\.dispose\(\);\s*\n\s*jan\.destroy\(\);\s*\n\s*wrap\.remove\(\);/g)];
    expect(spots.length).toBe(2);
    const disposeBody = SRC.slice(SRC.indexOf("dispose(): void {"), SRC.indexOf("get state()"));
    expect(disposeBody).toContain("this.clearLine();");
    expect(SRC).toContain('this.fx.innerHTML = "";');
  });

  it("玩法判定只读:连线相位拦截、时长区间、抖动常量、救场路径全部原样", () => {
    const board = createBoard({ rows: 4, cols: 4, kinds: 4, gravity: "none", maxTurns: 2 }, mulberry32(5));
    expect(tapCell(board, { ...linkInit(), phase: "linking" }, 1, 1).kind).toBe("ignore");
    expect(linkHoldMs(false)).toBeGreaterThanOrEqual(180);
    expect(linkHoldMs(false)).toBeLessThanOrEqual(260);
    expect(clearMs(true)).toBe(1);
    expect(SHAKE_MS).toBe(120);
    expect([...SRC.matchAll(/^\s+(?:else )?rescue\(\);$/gm)].length).toBe(2);
    expect([...SRC.matchAll(/\bfail\(/g)].length).toBe(2);
  });
});

describe("视觉⑦ 360px 布局与图标绘制区", () => {
  it("34px 兜底:slimTile 阈值分明,fit() 接线,llk-slim 有整套轻量规则", () => {
    expect(SLIM_TILE_PX).toBe(34);
    expect(slimTile(33.9)).toBe(true);
    expect(slimTile(34)).toBe(false);
    const fit = SRC.slice(SRC.indexOf("fit(): void {"), SRC.indexOf("render(): void {"));
    expect(fit).toContain("slimTile(px)");
    expect(CSS).toContain(".llk-board.llk-slim .llk-cell { box-shadow: 0 0 0 1px var(--llk-tile-side); }");
    expect(CSS).toContain(".llk-board.llk-slim .llk-cell.llk-sel");
    // 挂载后与窗口变化时各校一次
    expect([...SRC.matchAll(/view\.fit\(\)/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("顶栏四卡一行:剩对/计时/洗牌/提示按序进 llk-top,字号 14px,可换行兜底", () => {
    const a = SRC.indexOf('<b class="llk-btext">剩0对</b>');
    const b = SRC.indexOf('<b class="llk-btext">0秒</b>');
    const c = SRC.indexOf("洗牌×${cfg.shuffles}");
    const d = SRC.indexOf("提示×${HINT_MAX}");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(d).toBeGreaterThan(c);
    expect(/\.llk-badge\s*\{[^}]*font-size:\s*14px/.test(CSS)).toBe(true);
    expect(/\.llk-tool\s*\{[^}]*font-size:\s*14px/.test(CSS)).toBe(true);
    expect(/\.llk-top\s*\{[^}]*flex-wrap:\s*wrap/.test(CSS)).toBe(true);
    // 顶栏小徽记是 currentColor 描边的原创小图形,不是 emoji
    for (const kind of ["pairs", "clock", "shuffle", "bulb", "compass"] as const) {
      const glyph = hudGlyphSvg(kind);
      expect(glyph.startsWith("<svg")).toBe(true);
      expect(glyph).toContain('stroke="currentColor"');
      expect(EMOJI_RE.test(glyph)).toBe(false);
    }
  });

  it("图标绘制区 = 牌面 68%,样式表与常量对得上", () => {
    expect(TILE_ICON_FRAC).toBe(0.68);
    expect(CSS).toContain(".llk-cell > span { width: 68%; height: 68%;");
  });
});
