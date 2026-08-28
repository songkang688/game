/**
 * 记忆翻翻乐 · 1.3 第 21 步视觉用例(只增不减)。
 *
 * 只测视觉层:配色板 / 卡背纹样 / 图标后处理 / 3D 翻转时序 / 波浪时差 / 配对反馈 / reduced。
 * 玩法逻辑(logic.ts / levels.ts)的既有断言一个没动;这里反过来把
 * 「记忆窗口时长、判定时序、既有图标 shape 数据」全部钉死,谁动谁红。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BONUS_ICONS, THEME_PACKS, drawIcon, type IconCtx } from "./art";
import { LEVELS } from "./levels";
import {
  ASSIST_HINT_MS,
  FLIP_FADE_MS,
  FLIP_MS,
  SWAP_WARN_MS,
  coverDelayMs,
} from "./logic";
import {
  MC_ANIM,
  MC_BACK_BASES,
  MC_BACK_GOLD_PX,
  MC_BACK_RING_RATIOS,
  MC_COLORS,
  MC_CORNER_MIN_PX,
  MC_HIGHLIGHT,
  MC_ICON_FILL_RATIO,
  MC_OUTLINE_PX,
  MC_WAVE_MAX_TOTAL_MS,
  backBaseForTheme,
  cardBackSpec,
  drawIconDeluxe,
  iconBounds,
  iconLayout,
  paintCardBack,
  paintMatchBurst,
  shade,
  traceHeart,
  waveDelayMs,
  type McCtx,
} from "./visual";

const indexSrc = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const artSrc = readFileSync(new URL("./art.ts", import.meta.url), "utf8");

/** 记录式画布桩:数调用、攒 fill / stroke 用色 */
function fakeCtx(): McCtx & { calls: string[]; fills: string[]; strokes: string[] } {
  const calls: string[] = [];
  const fills: string[] = [];
  const strokes: string[] = [];
  const obj: Record<string, unknown> = {
    calls,
    fills,
    strokes,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: () => calls.push("translate"),
    scale: (x: number) => calls.push(`scale:${x}`),
    rotate: () => calls.push("rotate"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    arc: () => calls.push("arc"),
    ellipse: () => calls.push("ellipse"),
    roundRect: () => calls.push("roundRect"),
    rect: () => calls.push("rect"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    quadraticCurveTo: () => calls.push("quadraticCurveTo"),
    lineWidth: 1,
    lineJoin: "round",
    lineCap: "round",
  };
  Object.defineProperty(obj, "fillStyle", {
    set: (v: string) => {
      fills.push(v);
      calls.push("fillStyle");
    },
    get: () => fills[fills.length - 1] ?? "",
  });
  Object.defineProperty(obj, "strokeStyle", {
    set: (v: string) => {
      strokes.push(v);
      calls.push("strokeStyle");
    },
    get: () => strokes[strokes.length - 1] ?? "",
  });
  return obj as unknown as McCtx & { calls: string[]; fills: string[]; strokes: string[] };
}

const isColor = (v: string): boolean =>
  /^#[0-9A-Fa-f]{6}$/.test(v) || /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/.test(v);

/** #rrggbb → [h, s, l](只给「六主题同饱和同明度」的结构断言用) */
function hsl(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

/** 数据指纹:djb2-xor,足够钉「一个数值都没动」 */
function fingerprint(v: unknown): string {
  const s = JSON.stringify(v);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/* ------------------------------------------------------------------ */
/* 一、配色板(四·补一规格表)                                            */
/* ------------------------------------------------------------------ */

describe("memory-cards 1.3 · 配色板", () => {
  it("palette token 与四·补一规格表逐色一致", () => {
    expect(MC_COLORS.mcBackBase).toBe("#4A3E78");
    expect(MC_COLORS.mcBackLine).toBe("rgba(255,255,255,.35)");
    expect(MC_COLORS.mcBackGold).toBe("#F0C25A");
    expect(MC_COLORS.mcFace).toBe("#FFFDF6");
    expect(MC_COLORS.mcMatchGlow).toBe("rgba(255,214,120,.4)");
    expect(MC_COLORS.mcAssist).toBe("rgba(159,217,139,.3)");
    expect(MC_COLORS.mcShadow).toBe("rgba(60,50,90,.18)");
    for (const [name, v] of Object.entries(MC_COLORS)) {
      expect(
        isColor(v) || /^rgba\(\d+,\d+,\d+,\.\d+\)$/.test(v.replace(/\s/g, "")),
        `${name}=${v}`
      ).toBe(true);
    }
  });

  it("六主题卡背底色只换色相:同饱和同明度,含 mcBackBase,取模不越界", () => {
    expect(MC_BACK_BASES.length).toBe(6);
    expect(new Set(MC_BACK_BASES).size).toBe(6);
    expect(MC_BACK_BASES).toContain(MC_COLORS.mcBackBase);
    const [, s0, l0] = hsl(MC_COLORS.mcBackBase);
    for (const base of MC_BACK_BASES) {
      expect(base).toMatch(/^#[0-9A-F]{6}$/i);
      const [, s, l] = hsl(base);
      expect(Math.abs(s - s0), `${base} 饱和度跑了`).toBeLessThan(0.03);
      expect(Math.abs(l - l0), `${base} 明度跑了`).toBeLessThan(0.03);
    }
    expect(backBaseForTheme(0)).toBe(MC_BACK_BASES[0]);
    expect(backBaseForTheme(6)).toBe(MC_BACK_BASES[0]);
    expect(backBaseForTheme(9)).toBe(MC_BACK_BASES[3]);
    expect(backBaseForTheme(-1)).toBe(MC_BACK_BASES[5]);
  });
});

/* ------------------------------------------------------------------ */
/* 二、卡背纹样                                                          */
/* ------------------------------------------------------------------ */

describe("memory-cards 1.3 · 卡背", () => {
  it("按主题输出不同底色但同一纹样结构(两主题对照:笔顺全同、只差底色)", () => {
    const a = fakeCtx();
    const b = fakeCtx();
    paintCardBack(a, 90, 120, cardBackSpec(0, 64, 1));
    paintCardBack(b, 90, 120, cardBackSpec(5, 64, 1));
    // 调用序一模一样:结构零变化
    expect(a.calls).toEqual(b.calls);
    // 用色序列里只有「底色」那几笔不同(底、月牙咬边、徽章分层描边)
    expect(a.fills.length).toBe(b.fills.length);
    a.fills.forEach((v, i) => {
      if (v === backBaseForTheme(0)) expect(b.fills[i]).toBe(backBaseForTheme(5));
      else expect(b.fills[i]).toBe(v);
    });
    a.strokes.forEach((v, i) => {
      if (v === backBaseForTheme(0)) expect(b.strokes[i]).toBe(backBaseForTheme(5));
      else expect(b.strokes[i]).toBe(v);
    });
  });

  it("卡 < 48px 角饰省略、双星徽章保留(分支断言)", () => {
    expect(cardBackSpec(0, MC_CORNER_MIN_PX).corners).toBe(true);
    expect(cardBackSpec(0, MC_CORNER_MIN_PX - 1).corners).toBe(false);
    const big = fakeCtx();
    const small = fakeCtx();
    paintCardBack(big, 90, 120, cardBackSpec(2, 64, 0));
    paintCardBack(small, 90, 120, cardBackSpec(2, 40, 0));
    const fillsOf = (c: { calls: string[] }): number => c.calls.filter((x) => x === "fill").length;
    // 四角圆花 = 4 朵 ×(5 瓣 + 1 心)= 24 笔填充,小卡整块省掉
    expect(fillsOf(big) - fillsOf(small)).toBe(24);
    // 中心「朵朵星星」双星徽章两边都在:大星填 + 小星填 + 小星分层描 = 3 次闭合
    for (const c of [big, small]) {
      expect(c.calls.filter((x) => x === "closePath").length).toBe(3);
      expect(c.fills).toContain(MC_COLORS.mcBackGold);
    }
  });

  it("环纹直径 62% / 78% 卡宽;金描边 1.5px 走 CSS 不跟画布拉伸", () => {
    expect([...MC_BACK_RING_RATIOS]).toEqual([0.62, 0.78]);
    expect(MC_BACK_GOLD_PX).toBe(1.5);
    expect(indexSrc).toContain("inset 0 0 0 1.5px var(--mc-gold)");
    // 主题底色由 JS 变量注入,不再用 1.2 的 --mmc-back 渐变拼贴
    expect(indexSrc).toContain("--mc-back-base");
    expect(indexSrc).not.toContain("repeating-linear-gradient");
  });
});

/* ------------------------------------------------------------------ */
/* 三、图标:既有 shape 钉死 + 新增只增不改 + 后处理独立层                  */
/* ------------------------------------------------------------------ */

describe("memory-cards 1.3 · 图标库", () => {
  it("既有六套主题的 shape 数据一个数值都没动(指纹钉死——改了等于改题目)", () => {
    // 六套 × 12 枚的全部 shape / 名字 / 卡背粉彩 / id 的指纹,1.2 基线算出后钉死
    expect(
      fingerprint(THEME_PACKS.map((p) => ({ id: p.id, name: p.name, back: p.back, icons: p.icons })))
    ).toBe("c65151a9");
    for (const p of THEME_PACKS) expect(p.icons.length).toBe(12);
  });

  it("新增图标 ≥ 4、不重名、追加在文件末尾、且不混进任何主题包", () => {
    expect(BONUS_ICONS.length).toBeGreaterThanOrEqual(4);
    const names = BONUS_ICONS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(4);
    // 只增文件末尾:BONUS_ICONS 的声明在 THEME_PACKS 之后
    expect(artSrc.indexOf("export const BONUS_ICONS")).toBeGreaterThan(
      artSrc.indexOf("export const THEME_PACKS")
    );
    // 不进牌面:iconIndexOf 按 pack.icons.length 取模,长度一变独苗卡伪装就改题
    for (const p of THEME_PACKS) {
      for (const n of names) {
        expect(p.icons.some((i) => i.name === n), `「${n}」混进了 ${p.name}`).toBe(false);
      }
    }
    // 新图标画得出、不越 0..100 的框(和既有图标同一标准)
    for (const icon of BONUS_ICONS) {
      expect(icon.shapes.length).toBeGreaterThan(0);
      const b = iconBounds(icon);
      expect(b.minX).toBeGreaterThanOrEqual(-8);
      expect(b.minY).toBeGreaterThanOrEqual(-8);
      expect(b.maxX).toBeLessThanOrEqual(108);
      expect(b.maxY).toBeLessThanOrEqual(108);
      const ctx = fakeCtx();
      drawIcon(ctx as unknown as IconCtx, icon, 56);
      expect(ctx.calls.filter((c) => c === "beginPath").length).toBe(icon.shapes.length);
    }
  });

  it("后处理是独立层:软影先落笔、描边在填充下面、原 drawIcon 调用序原样出现、高光收笔", () => {
    const icon = THEME_PACKS[0].icons[0];
    const plain = fakeCtx();
    drawIcon(plain as unknown as IconCtx, icon, iconLayout(icon, 72).effSize);
    const deluxe = fakeCtx();
    drawIconDeluxe(deluxe as unknown as IconCtx, icon, 72);
    // 原 shape 绘制调用一笔不变:plain 的完整调用序是 deluxe 的连续子串
    expect(deluxe.calls.join("|")).toContain(plain.calls.join("|"));
    // 第一笔填充是软影,最后一笔是高光
    expect(deluxe.fills[0]).toBe(MC_COLORS.mcShadow);
    expect(deluxe.fills[deluxe.fills.length - 1]).toBe(MC_HIGHLIGHT);
    // 描边层逐 shape 一笔:deluxe 比 plain 恰好多 shapes.length 次 stroke(高光软影都是 fill)
    const strokes = (c: { calls: string[] }): number => c.calls.filter((x) => x === "stroke").length;
    expect(strokes(deluxe) - strokes(plain)).toBe(icon.shapes.length);
    // 描边色 = 本 shape 用色压深 20%
    expect(MC_OUTLINE_PX).toBe(1.5);
    expect(shade("#F6C36B", -0.2)).toBe("#C59C56");
    expect(shade("#3B3B4F", 0.2)).toBe("#626272");
    expect(shade("rgba(1,2,3,.4)", -0.2)).toBe("rgba(1,2,3,.4)");
  });

  it("包围盒归一化:任何图标的绘制区统一为卡面 64% 并居中", () => {
    expect(MC_ICON_FILL_RATIO).toBe(0.64);
    for (const icon of [THEME_PACKS[0].icons[0], THEME_PACKS[3].icons[2], BONUS_ICONS[0]]) {
      const size = 72;
      const layout = iconLayout(icon, size);
      const k = layout.effSize / 100;
      const bw = (layout.box.maxX - layout.box.minX) * k;
      const bh = (layout.box.maxY - layout.box.minY) * k;
      expect(Math.max(bw, bh)).toBeCloseTo(size * MC_ICON_FILL_RATIO, 6);
      expect(layout.dx + layout.box.minX * k).toBeCloseTo((size - bw) / 2, 6);
      expect(layout.dy + layout.box.minY * k).toBeCloseTo((size - bh) / 2, 6);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、3D 翻转与时序红线                                                  */
/* ------------------------------------------------------------------ */

describe("memory-cards 1.3 · 翻转与时序", () => {
  it("翻转只用 transform / opacity,时长走自定义属性且与常量块同源", () => {
    // 正常档:transform 一种属性做 3D 翻转 + 上抬
    expect(indexSrc).toContain(
      ".mmc-inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform var(--mc-flip-ms) ease-in-out; }"
    );
    expect(indexSrc).toContain("translateY(calc(-1 * var(--mc-lift-px))) rotateY(180deg)");
    expect(indexSrc).toContain("backface-visibility: hidden");
    expect(indexSrc).toContain("perspective: 600px");
    // 自定义属性直接从常量块插值,一处定义两处同步
    expect(indexSrc).toContain("--mc-flip-ms: ${MC_ANIM.flipMs}ms");
    expect(indexSrc).toContain("--mc-fade-ms: ${MC_ANIM.fadeMs}ms");
    expect(MC_ANIM.flipMs).toBe(180);
    expect(MC_ANIM.fadeMs).toBe(120);
    expect(MC_ANIM.liftPx).toBe(2);
    expect(MC_ANIM.bumpMs).toBe(200);
    expect(MC_ANIM.bumpPx).toBe(3);
    expect(MC_ANIM.sparkleMs).toBe(320);
    expect(MC_ANIM.shakeMs).toBe(240);
    expect(MC_ANIM.shakeDeg).toBe(3);
    expect(MC_ANIM.breathMs).toBe(1200);
    expect(MC_ANIM.waveStepMs).toBe(30);
  });

  it("记忆窗口时长与判定时序一毫秒不动(常量对照)", () => {
    // logic 层的时序常量原封不动
    expect(coverDelayMs(2, false)).toBe(750);
    expect(coverDelayMs(3, false)).toBe(950);
    expect(coverDelayMs(2, true)).toBe(750 + ASSIST_HINT_MS);
    expect(ASSIST_HINT_MS).toBe(700);
    expect(FLIP_MS).toBe(200);
    expect(FLIP_FADE_MS).toBe(140);
    expect(SWAP_WARN_MS).toBe(1500);
    // 关卡数据的记忆窗口没被碰:水果集市首关 3200ms、魔法城堡偷看关 1600ms
    expect(LEVELS[17].peekMs).toBe(3200);
    expect(LEVELS[83].peekMs).toBe(1600);
    // 双人局偷看仍是 1200ms;解锁翻牌(startPlay)仍在 peekMs 回调那一拍
    expect(indexSrc).toContain("peekMs: 1200");
    expect(indexSrc).toContain("}, cfg.peekMs);");
    expect(indexSrc.split("flip = startPlay(flip);").length - 1).toBe(2);
  });

  it("翻回波浪:每卡 ≤30ms 交错、总时长 ≤ 既有窗口收尾、reduced 同步翻回", () => {
    expect(MC_WAVE_MAX_TOTAL_MS).toBeLessThanOrEqual(coverDelayMs(2, false));
    for (const total of [4, 8, 12, 20, 23, 26]) {
      let prev = 0;
      for (let s = 0; s < total; s++) {
        const d = waveDelayMs(s, total, false);
        expect(d).toBeGreaterThanOrEqual(prev);
        expect(d - prev).toBeLessThanOrEqual(MC_ANIM.waveStepMs);
        expect(d).toBeLessThanOrEqual(MC_WAVE_MAX_TOTAL_MS);
        prev = d;
        expect(waveDelayMs(s, total, true)).toBe(0);
      }
    }
    // 接线在集体翻回那一拍,且玩家亲手翻牌立刻清零时差
    expect(indexSrc).toContain("waveDelayMs(s, totalCards, reduced)");
    expect(indexSrc).toContain('slots[s].inner.style.transitionDelay = ""');
  });
});

/* ------------------------------------------------------------------ */
/* 五、配对反馈 / 辅助 / reduced / 清理                                    */
/* ------------------------------------------------------------------ */

describe("memory-cards 1.3 · 反馈与降级", () => {
  it("配对成功 / 失败走不同视觉分支(类名断言两条)", () => {
    // 成功:轻碰回弹 + 爱心星屑;失败:±3° 摇头(无惩罚色)
    expect(indexSrc).toContain('flashSlots(slotList, "mmc-bump", 430)');
    expect(indexSrc).toContain('flashSlots(slotsOf(group), "mmc-shake", 380)');
    expect(indexSrc).not.toContain("mmc-hit");
    expect(indexSrc).toContain("@keyframes mmcBump");
    expect(indexSrc).toMatch(/@keyframes mmcShake.*rotate\(-3deg\)/);
    // 收纳态:配掉的卡定格成亮色印花,不是凭空消失
    expect(indexSrc).toContain(".mmc-card.mmc-gone::after");
    expect(indexSrc).toContain("background: var(--mc-glow)");
  });

  it("爱心星屑:正常档画一颗心 + 四颗金星,reduced 一笔不画", () => {
    const on = fakeCtx();
    paintMatchBurst(on, 64, false);
    expect(on.calls.filter((c) => c === "quadraticCurveTo").length).toBeGreaterThanOrEqual(4);
    expect(on.calls.filter((c) => c === "fill").length).toBe(5);
    expect(on.fills).toContain(MC_COLORS.mcBackGold);
    const off = fakeCtx();
    paintMatchBurst(off, 64, true);
    expect(off.calls.length).toBe(0);
    // 爱心是一条闭合路径
    const heart = fakeCtx();
    traceHeart(heart, 10, 10, 6);
    expect(heart.calls[heart.calls.length - 1]).toBe("closePath");
  });

  it("renderAssist 辅助语义保留,只换柔光样式", () => {
    expect(indexSrc).toContain("assistBtn.textContent = assistLabel(assist)");
    expect(indexSrc).toContain("assistTip(assist)");
    // 翻错多亮一会儿的时长仍由 logic.coverDelayMs 决定,类名没换
    expect(indexSrc).toContain('flashSlots(slotsOf(group), "mmc-assist", coverDelayMs(cfg.matchSize, true))');
    // 柔光走 mcAssist token
    expect(indexSrc).toMatch(/\.mmc-card\.mmc-assist \.mmc-face::after[^}]*var\(--mc-assist\)/);
  });

  it("reduced:3D / 波浪 / 星屑全停,淡入换面生效,收纳态保留", () => {
    const reducedBlock = indexSrc.slice(indexSrc.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reducedBlock).toContain(".mmc-inner { transition: none; }");
    expect(reducedBlock).toContain(".mmc-card.mmc-up .mmc-inner { transform: none; }");
    expect(reducedBlock).toContain("transition: opacity var(--mc-fade-ms) linear");
    expect(reducedBlock).toContain(".mmc-burst { display: none; }");
    // 呼吸微光降级成恒定微光,不是整块删掉
    expect(reducedBlock).toMatch(/\.mmc-peek[^}]*animation: none; opacity: \.55/);
    // JS 侧:星屑与轻碰在 reduced 下根本不生成
    expect(indexSrc).toContain("if (prefersReduced() || slotList.length === 0) return;");
  });

  it("destroy 归零:计时器全走 later/interval 清理,没有裸 rAF", () => {
    expect(indexSrc).toContain("timeouts.forEach((t) => clearTimeout(t))");
    expect(indexSrc).toContain("clearInterval");
    expect(indexSrc).not.toContain("requestAnimationFrame(");
    // 星屑画布的自清也走 later(destroy 时随 timeouts 一起清)
    expect(indexSrc).toContain("later(() => cv.remove(), MC_ANIM.sparkleMs + 80);");
  });
});
