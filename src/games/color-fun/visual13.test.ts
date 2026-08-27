/**
 * 涂色小屋 · 1.3 视觉升级用例（第 26 步 A 档，只增不减）。
 *
 * 铁律就一条：**只动皮肤不动骨头**。这一份把骨头逐块钉死——
 * 题目数据（线稿 / 符号）快照、涂色热区几何、按号判定口径、沙盒保存与画廊结构、
 * 最终填充色 = 逻辑色；再验皮肤本身：颜料坨、选中三要素、涟漪、角标双通道、
 * 展墙相框、动画层不接指针、360px 降级、reduced 全停、destroy 计时归零。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、接线用源码巡检钉住
 * （与本款既有 stageFit / sandboxA11y 用例一个路数）。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BLOB_MIN_PX,
  BLOB_SINK_PX,
  RIPPLE_MS,
  STUDIO_TOKENS,
  blobLayers,
  brushDipSVG,
} from "../../art/kit/paintBlob";
import { ALL_PAINTS, PICTURES, paintSymbol } from "./levels";
import { PIGMENTS, PIGMENT_HEX } from "./mix";
import { MAX_WORKS, SANDBOX_KEY } from "./sandbox";
import { CLF_CSS, SWATCH_MIN_PX, makePrimary, makeSwatch, pictureSvgBody } from "./ui";
import {
  GLOW_MS,
  HIT_CLASSES,
  MARK_FONT_PX,
  SHAKE_MS,
  SHINE_MS,
  STUDIO_CSS,
  dropBadgeMarkup,
  hitClassOf,
  nextPendingColor,
  rippleGhostMarkup,
  studioSceneMarkup,
  svgPointOf,
} from "./studio";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const INDEX_SRC = readFileSync(`${DIR}index.ts`, "utf8");
const SANDBOX_UI_SRC = readFileSync(`${DIR}sandboxUi.ts`, "utf8");
const STUDIO_SRC = readFileSync(`${DIR}studio.ts`, "utf8");

/** 跟 upgrade12 的桩同款：够 ui.ts 用的极简元素 */
function stubDoc(): Document {
  class El {
    className = "";
    textContent = "";
    title = "";
    type = "";
    readonly children: El[] = [];
    readonly attrs = new Map<string, string>();
    readonly dataset: Record<string, string> = {};
    readonly style: Record<string, string> = {};
    constructor(readonly tagName: string) {}
    setAttribute(k: string, v: string): void {
      this.attrs.set(k, v);
    }
    getAttribute(k: string): string | null {
      return this.attrs.get(k) ?? null;
    }
    appendChild(c: El): El {
      this.children.push(c);
      return c;
    }
    append(...cs: El[]): void {
      this.children.push(...cs);
    }
  }
  return { createElement: (tag: string) => new El(tag) } as unknown as Document;
}

describe("1.3 视觉 ① 题目钉死：levels 图案与符号换肤前后一致（快照）", () => {
  it("十六幅线稿（含 lx/ly 与区域 SVG 原文）的 SHA-256 与升级前完全一致", () => {
    const digest = createHash("sha256").update(JSON.stringify(PICTURES)).digest("hex");
    expect(digest).toBe("cf3e54ebd96bb2db8c15698b0a5861a939a0f565ef94e22b1a286bd905db5070");
  });

  it("每种颜料的 paintSymbol 映射一个都没换（快照）", () => {
    const digest = createHash("sha256")
      .update(JSON.stringify(Object.keys(ALL_PAINTS).sort().map((n) => [n, paintSymbol(n)])))
      .digest("hex");
    expect(digest).toBe("116aa59fe3a3c5974756b7b2cb0c0f9dcf62092d71d9c3cb4fe56acad74dd8d3");
  });
});

describe("1.3 视觉 ② 涂色热区几何回归", () => {
  it("pictureSvgBody 十六幅输出与升级前逐字节一致（热区一个像素没动）", () => {
    const digest = createHash("sha256")
      .update(PICTURES.map((p) => pictureSvgBody(p)).join("|"))
      .digest("hex");
    expect(digest).toBe("8d6f7fb4bc80bb84f1ed2f3e422560abae00f6f403df120571e106fdd9a7c581");
  });

  it("新皮肤不给 .clf-region 常态写位移 / 缩放 / 边距；抖动只挂在互斥类上", () => {
    // STUDIO_CSS 里唯一能动区域的选择器是 clf-hit-*（±2px 抖动，300ms 后弹回原位）
    expect(STUDIO_CSS).not.toMatch(/\.clf-region\s*\{/);
    const wrong = STUDIO_CSS.slice(STUDIO_CSS.indexOf(".clf-canvas .clf-hit-wrong"));
    expect(wrong.slice(0, 300)).toContain("translateX(-2px)");
    // 涂对那一支只动描边色与光晕，不动几何
    const glow = STUDIO_CSS.slice(STUDIO_CSS.indexOf("@keyframes clfEdgeGlow"), STUDIO_CSS.indexOf("@keyframes clfShakeXY"));
    expect(glow).not.toContain("transform");
    expect(glow).not.toContain("stroke-width");
  });
});

describe("1.3 视觉 ③ 颜料坨：径向渐变非平涂", () => {
  it("遍历全部 27 支颜料：底色仍是纯 hex，叠层带三重 radial-gradient", () => {
    const doc = stubDoc();
    for (const p of PIGMENTS) {
      const dot = (makeSwatch(doc, p.name) as unknown as { children: Array<{ style: Record<string, string> }> })
        .children[0];
      expect(dot.style.background, `${p.name} 的底色被换掉了`).toBe(p.hex);
      const layers = dot.style.backgroundImage;
      expect([...layers.matchAll(/radial-gradient\(/g)], `${p.name} 还是平涂`).toHaveLength(3);
      expect(layers).toContain(STUDIO_TOKENS.blobHighlight);
      expect(layers).toContain(STUDIO_TOKENS.blobShadow);
    }
  });

  it("调色锅的原料坨同款叠层；坨径热区 44px ≥ 规格下限 36px", () => {
    const doc = stubDoc();
    const dot = (makePrimary(doc, "红色") as unknown as { children: Array<{ style: Record<string, string> }> })
      .children[0];
    expect(dot.style.backgroundImage).toContain("radial-gradient");
    expect(SWATCH_MIN_PX).toBeGreaterThanOrEqual(BLOB_MIN_PX);
  });
});

describe("1.3 视觉 ④ 选中态三要素：下沉 + 亮环 + 笔尖蘸色", () => {
  it("STUDIO_CSS 的选中规则同时有 translateY(2px) 与 pickRing 亮环", () => {
    const at = STUDIO_CSS.indexOf(".clf-swatch.clf-picked .clf-swatch-dot{");
    expect(at).toBeGreaterThanOrEqual(0);
    const rule = STUDIO_CSS.slice(at, STUDIO_CSS.indexOf("}", at));
    expect(rule).toContain(`translateY(${BLOB_SINK_PX}px)`);
    expect(rule).toContain(STUDIO_TOKENS.pickRing);
  });

  it("画笔笔尖 = 当前色：关卡与画室的 renderPalette 都把当前色喂给画笔", () => {
    expect(INDEX_SRC).toContain("paletteBrushHTML(picked ? ALL_PAINTS[picked] :");
    expect(SANDBOX_UI_SRC).toContain("paletteBrushHTML(PIGMENT_HEX[picked] ??");
    expect(brushDipSVG("#4263eb")).toContain('fill="#4263eb"');
  });

  it("两边的调色盘都挂上了木板皮肤（class 只加壳，热区尺寸零改动）", () => {
    expect(INDEX_SRC).toContain('paletteEl.classList.add("clf-board")');
    expect(SANDBOX_UI_SRC).toContain('paletteEl.classList.add("clf-board")');
    expect(STUDIO_CSS).toContain(".clf-board{");
  });
});

describe("1.3 视觉 ⑤ 涟漪只是过渡：最终填充色 = 逻辑色（三色抽样）", () => {
  it("残影铺的是旧色、mask 圆从 0 长到给定半径、180ms 后冻结", () => {
    for (const old of ["#ff6b6b", "#74c0fc", "#ffe066"]) {
      const m = rippleGhostMarkup(`<circle cx="100" cy="160" r="17"/>`, old, "m1", 100, 160, 42);
      expect(m).toContain(`fill="${old}"`);
      expect(m).toContain('mask="url(#m1)"');
      expect(m).toContain('from="0" to="42"');
      expect(m).toContain(`dur="${RIPPLE_MS}ms"`);
      expect(m).toContain('fill="freeze"');
    }
  });

  it("真正的最终色仍由 repaint 一处说了算（逻辑原文一字未动）", () => {
    expect(INDEX_SRC).toContain('el.setAttribute("fill", color ? ALL_PAINTS[color] : "#ffffff")');
    expect(INDEX_SRC).toContain("history.push({ region: id, from: before, to: color });");
    // 残影不带 class 也不带 data-id，天生不在热区名单里
    const ghost = rippleGhostMarkup(`<rect x="0" y="230" width="400" height="70" rx="6"/>`, "#ffffff", "m2", 10, 240, 30);
    expect(ghost).not.toContain("class=");
    expect(ghost).not.toContain("data-id");
  });

  it("点击坐标换算认得缩放：矩形铺开多大都折回 400×300，量不到回 null", () => {
    expect(svgPointOf({ left: 0, top: 0, width: 400, height: 300 }, 100, 160)).toEqual({ x: 100, y: 160 });
    // 双指放大 2 倍：同一屏幕点折回原坐标的一半
    expect(svgPointOf({ left: 0, top: 0, width: 800, height: 600 }, 100, 160)).toEqual({ x: 50, y: 80 });
    expect(svgPointOf({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toBeNull();
  });
});

describe("1.3 视觉 ⑥ 按号角标双通道：滴内数字 + 目标色描边", () => {
  it("描边色 = 目标色、数字原样、位置仍在 levels 给的 (lx, ly)", () => {
    for (const [mark, hex] of [
      ["1", ALL_PAINTS["红色"]],
      ["2", ALL_PAINTS["蓝色"]],
      ["★", ALL_PAINTS["橙色"]],
    ] as const) {
      const m = dropBadgeMarkup(mark, hex, 145, 112);
      expect(m).toContain(`stroke="${hex}"`);
      expect(m).toContain(`>${mark}</text>`);
      expect(m).toContain('x="145" y="112"');
    }
  });

  it("接线：角标描边真的取 ALL_PAINTS[task.color]，字号 360px 缩放后仍 ≥ 12px", () => {
    expect(INDEX_SRC).toContain("dropBadgeMarkup(markOf.get(task.color) ?? \"?\", ALL_PAINTS[task.color], r.lx, r.ly)");
    // 360px 手机上画布约缩到 0.86 倍：14 × 0.86 ≈ 12.04，仍可读
    expect(MARK_FONT_PX * 0.86).toBeGreaterThanOrEqual(12);
    // 呼吸提示只认「当前该涂的号」，全涂对就熄掉
    const tasks = [
      { region: "roof", color: "红色" },
      { region: "wall", color: "蓝色" },
    ];
    expect(nextPendingColor(tasks, {})).toBe("红色");
    expect(nextPendingColor(tasks, { roof: "红色" })).toBe("蓝色");
    expect(nextPendingColor(tasks, { roof: "红色", wall: "蓝色" })).toBeNull();
  });
});

describe("1.3 视觉 ⑦ 涂对 / 涂错走互斥视觉分支", () => {
  it("hitClassOf 两分支各归各的类，类名就是 HIT_CLASSES 那两个", () => {
    expect(hitClassOf(true)).toBe("clf-hit-right");
    expect(hitClassOf(false)).toBe("clf-hit-wrong");
    expect(HIT_CLASSES).toEqual(["clf-hit-right", "clf-hit-wrong"]);
  });

  it("flashRegion 先把两个类都摘干净再挂本次那个（源码巡检）", () => {
    const body = INDEX_SRC.slice(INDEX_SRC.indexOf("function flashRegion("), INDEX_SRC.indexOf("function onRegion("));
    expect(body).toContain("for (const c of HIT_CLASSES) el.classList.remove(c)");
    expect(body).toContain("el.classList.add(hitClassOf(right))");
    expect(body.indexOf("classList.remove")).toBeLessThan(body.indexOf("classList.add"));
    // 两个分支在 CSS 里各有自己的动画，时长照时序表
    expect(STUDIO_CSS).toContain(`.clf-canvas .clf-hit-right{animation:clfEdgeGlow ${GLOW_MS}ms`);
    expect(STUDIO_CSS).toContain(`.clf-canvas .clf-hit-wrong{animation:clfShakeXY ${SHAKE_MS}ms`);
  });
});

describe("1.3 视觉 ⑧ 画廊数据结构与保存逻辑不变（相框只是壳）", () => {
  it("存档 key、上限、currentWork 的字段一字未动", () => {
    expect(SANDBOX_KEY).toBe("yiduo-yixing.clf.sandbox.v1");
    expect(MAX_WORKS).toBe(12);
    expect(SANDBOX_UI_SRC).toContain("return { pic: picIndex, fills: history.replay(), at: Date.now() };");
  });

  it("保存 / 换掉 / 删除 / 点开的接线原样：相框没有伸手进数据层", () => {
    for (const line of [
      "const res = saveWork(store, currentWork());",
      "works = replaceWork(store, at, currentWork()).works;",
      "works = removeWork(store, at);",
      "picIndex = safePicIndex(work.pic);",
      'btn.addEventListener("click", () => onWork(i));',
    ]) {
      expect(SANDBOX_UI_SRC, `画廊逻辑被动了：${line}`).toContain(line);
    }
  });
});

describe("1.3 视觉 ⑨ 展墙：每幅有相框 + 铭牌且序号连续", () => {
  it("renderGallery 给每一幅都套 clf-framed 相框、配「第 N 幅」铭牌（N = i + 1 连续）", () => {
    const gallery = SANDBOX_UI_SRC.slice(
      SANDBOX_UI_SRC.indexOf("function renderGallery("),
      SANDBOX_UI_SRC.indexOf("function onWork(")
    );
    expect(gallery).toContain("clf-work clf-framed");
    expect(gallery).toContain('<span class="clf-work-plaque">第 ${i + 1} 幅</span>');
  });

  it("相框壳与射灯：woodFrameCss 落进 STUDIO_CSS，展墙有顶部光晕，hover 轻微抬起", () => {
    expect(STUDIO_CSS).toContain(".clf-framed{");
    expect(STUDIO_CSS).toContain(STUDIO_TOKENS.galleryLight);
    expect(STUDIO_CSS).toContain(".clf-work.clf-framed:hover");
    expect(STUDIO_CSS).toContain(".clf-work-plaque{");
  });
});

describe("1.3 视觉 ⑩ 过渡与动画层一律 pointer-events:none", () => {
  it("画室背景 / 涟漪层 / 闪光 / 飞入 / 画笔 / 铭牌全都不接指针", () => {
    for (const sel of [".clf-studio{", ".clf-ripple-layer{", ".clf-shine{", ".clf-fly{", ".clf-brush{", ".clf-work-plaque{"]) {
      const at = STUDIO_CSS.indexOf(sel);
      expect(at, `${sel} 不见了`).toBeGreaterThanOrEqual(0);
      expect(STUDIO_CSS.slice(at, STUDIO_CSS.indexOf("}", at))).toContain("pointer-events:none");
    }
  });

  it("场景层与画笔都是 aria-hidden 的装饰件，涟漪层排在角标前面（角标压在上面）", () => {
    expect(studioSceneMarkup()).toContain('aria-hidden="true"');
    expect(INDEX_SRC).toContain('<div class="clf-studio" aria-hidden="true">');
    expect(INDEX_SRC.indexOf('rippleLayer.setAttribute("class", "clf-ripple-layer")')).toBeLessThan(
      INDEX_SRC.indexOf('g.setAttribute("class", "clf-mark")')
    );
  });
});

describe("1.3 视觉 ⑪ 360px：横滑降级仍在、坨径不缩、氛围让位", () => {
  it("调色盘横滑那一条还在 CLF_CSS（放不下就滑，坨径 44 ≥ 36 一个不缩）", () => {
    expect(CLF_CSS).toMatch(/\.clf-palette\{[^}]*overflow-x:auto/);
    expect(CLF_CSS).toContain(`width:${SWATCH_MIN_PX}px;height:${SWATCH_MIN_PX}px`);
    expect(SWATCH_MIN_PX).toBeGreaterThanOrEqual(BLOB_MIN_PX);
  });

  it("STUDIO_CSS 的 360px 档只收氛围（窗户 / 留白），一个热区选择器都不碰", () => {
    const at = STUDIO_CSS.indexOf("@media (max-width:400px)");
    expect(at).toBeGreaterThanOrEqual(0);
    const narrow = STUDIO_CSS.slice(at, STUDIO_CSS.indexOf("@media (prefers-reduced-motion", at));
    for (const sel of [".clf-swatch-dot", ".clf-tool", ".clf-zoom", ".clf-primary{", ".clf-region"]) {
      expect(narrow.includes(sel), `360px 档动了 ${sel}`).toBe(false);
    }
    expect(narrow).toContain(".clf-studio-window{display:none;}");
  });
});

describe("1.3 视觉 ⑫ reduced：涟漪 / 呼吸 / 闪光 / 飞入全停，静态质感仍在", () => {
  it("CSS 一侧：呼吸换常亮描边，亮圈 / 抖动 / 闪光 / 飞入全 animation:none", () => {
    const soft = STUDIO_CSS.slice(STUDIO_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(soft).toContain(".clf-swatch.clf-breathe .clf-swatch-dot{animation:none;box-shadow:");
    expect(soft).toContain(".clf-canvas .clf-hit-right{animation:none;}");
    expect(soft).toContain(".clf-canvas .clf-hit-wrong{animation:none;}");
    expect(soft).toContain(".clf-shine::after{animation:none;");
    expect(soft).toContain(".clf-fly{animation:none;display:none;}");
  });

  it("JS 一侧：涟漪与飞入直接跳过、完成仪式跳过闪光直接装裱（静态质感保留）", () => {
    const ripple = INDEX_SRC.slice(INDEX_SRC.indexOf("function spawnRipple("));
    expect(ripple.slice(0, 120)).toContain("if (softMotion) return;");
    const sbRipple = SANDBOX_UI_SRC.slice(SANDBOX_UI_SRC.indexOf("function spawnRipple("));
    expect(sbRipple.slice(0, 140)).toContain("if (prefersReducedMotion()) return;");
    const fly = SANDBOX_UI_SRC.slice(SANDBOX_UI_SRC.indexOf("function flyToGallery("));
    expect(fly.slice(0, 140)).toContain("if (prefersReducedMotion()) return;");
    const finish = INDEX_SRC.slice(INDEX_SRC.indexOf("function finish("), INDEX_SRC.indexOf("function applyPaint("));
    expect(finish).toContain('if (softMotion) {\n      stageBox.classList.add("clf-mounted");');
  });
});

describe("1.3 视觉 ⑬ destroy 归零：涟漪与飞入计时全走托管的 later / anytime", () => {
  it("index.ts 里 setTimeout 仍只有 2 处（later + anytime），全进 timeouts 名单", () => {
    expect([...INDEX_SRC.matchAll(/setTimeout\(/g)]).toHaveLength(2);
    expect(INDEX_SRC).not.toContain("setInterval");
    // 涟漪的移除、亮圈 / 抖动的收尾、装裱的接力全托给受管计时器
    expect(INDEX_SRC).toContain("later(() => g.remove(), RIPPLE_MS + 40)");
    expect(INDEX_SRC).toContain("confetti(wrap, anytime)");
  });

  it("sandboxUi.ts 里 setTimeout 仍只有 1 处（later），涟漪与飞入的收尾都挂它", () => {
    expect([...SANDBOX_UI_SRC.matchAll(/setTimeout\(/g)]).toHaveLength(1);
    expect(SANDBOX_UI_SRC).toContain("later(() => g.remove(), RIPPLE_MS + 40)");
    expect(SANDBOX_UI_SRC).toContain("later(() => ghost.remove(), FLY_MS + 60)");
    // studio.ts 是纯字符串工厂：一个计时器、一个 DOM 调用都没有
    expect(STUDIO_SRC).not.toContain("setTimeout");
    expect(STUDIO_SRC).not.toContain("document.");
  });
});

describe("1.3 视觉 ⑭ 判定与保存口径钉死 + 前缀纪律", () => {
  it("按号判定原文一字未动：涂上去的是 picked，对错只看 picked === target", () => {
    expect(INDEX_SRC).toContain("applyPaint(id, picked);");
    expect(INDEX_SRC).toContain("if (picked === target) {");
    expect(INDEX_SRC).toContain("if (!wasRight) slips++;");
    expect(INDEX_SRC).toContain("rateBelow(slips + refills * 2, 0, 2)");
  });

  it("STUDIO_CSS 里的类一律 clf- 前缀，闪光时长照时序表 400ms", () => {
    for (const m of STUDIO_CSS.matchAll(/\.([a-z][\w-]*)/g)) {
      expect(m[1].startsWith("clf-"), `新样式类名要 clf- 前缀：${m[1]}`).toBe(true);
    }
    expect(SHINE_MS).toBe(400);
    expect(blobLayers("#ff6b6b")).toContain("#ff6b6b 72%");
  });
});
