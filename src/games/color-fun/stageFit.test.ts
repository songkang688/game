/**
 * 守门：这一屏必须钳进「舞台真正看得见的那一段」（第 2 轮测试员 W5R2-A-01，阻断）。
 *
 * 测试员实测：390×844 就开始出事——舞台只看得见 730px，这一屏能长到 1093px，
 * 多出来的 363px 被平台的 `.game-stage{overflow:hidden}` 直接裁掉，
 * **调色板整排 + 调锅三原色 + 撤销/重做**（8–11 颗）用真实坐标点不着；
 * 真手指上滑 3 次 + 滚轮 3 次 `scrollTop` 一格没动。选不了色 = 涂不了 = 过不了关。
 *
 * 平台那一半（`.game-stage` / `.l99-stage-wrap`）是禁改文件，交窗口1；
 * 本档这一半是「内容太高」，靠三步收：挂 `clf-tight` 收留白 → 收画布框 → 还高就自己滚。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、接线用源码巡检钉住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANVAS_MIN_PX, CANVAS_MIN_VH, CLF_CSS, canvasBoxPx, visibleRoomPx } from "./ui";

const UI = readFileSync(fileURLToPath(new URL("./ui.ts", import.meta.url)), "utf8");
const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 从 CSS 里抠出一条规则的声明块 */
function rule(selector: string): string {
  const i = CLF_CSS.indexOf(`${selector}{`);
  if (i < 0) return "";
  return CLF_CSS.slice(i + selector.length + 1, CLF_CSS.indexOf("}", i));
}

describe("涂色小屋 · 舞台看得见多少", () => {
  it("取最靠里的那一层裁切祖先算下沿（有一层裁，再往下就看不见了）", () => {
    expect(visibleRoomPx(100, [830, 900])).toBe(730);
    expect(visibleRoomPx(270, [626])).toBe(356);
  });

  it("一层裁切祖先都没有（用例里的裸节点）就当不用钳", () => {
    expect(visibleRoomPx(100, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("已经被裁到看不见时返回 0 或负数，调用方据此放弃钳位", () => {
    expect(visibleRoomPx(700, [626])).toBeLessThan(0);
  });
});

describe("涂色小屋 · 画布框给多高", () => {
  it("地方够就照旧给 CSS 想要的那么高，一分不收", () => {
    expect(canvasBoxPx(900, 400, 464)).toBe(464);
    expect(canvasBoxPx(864, 400, 464)).toBe(464);
  });

  it("地方不够就把剩下的都给画布", () => {
    // 测试员量的 390×844 第 40 关：舞台看得见 730、这一屏除画布外 428、CSS 想要 464
    expect(canvasBoxPx(730, 428, 464)).toBe(302);
    expect(canvasBoxPx(529, 348, 464)).toBe(181);
  });

  it("再挤也不许把画收到 180px 以下——线稿里的小块会点不准", () => {
    expect(canvasBoxPx(342, 588, 352)).toBe(CANVAS_MIN_PX);
    expect(canvasBoxPx(100, 400, 464)).toBe(CANVAS_MIN_PX);
    expect(CANVAS_MIN_PX).toBeGreaterThanOrEqual(180);
  });

  it("量不到舞台（Infinity / 0 / 负数）就什么都不改，别把画凭空收小", () => {
    expect(canvasBoxPx(Number.POSITIVE_INFINITY, 400, 464)).toBe(464);
    expect(canvasBoxPx(0, 400, 464)).toBe(464);
    expect(canvasBoxPx(-20, 400, 464)).toBe(464);
  });

  it("反例：老口径（死守 55vh）在同一台机器上真的装不下", () => {
    // 390×844 上 55vh = 464，加上这一屏别的 428，一共 892 > 舞台看得见的 730
    const old = Math.round((844 * CANVAS_MIN_VH) / 100);
    expect(old + 428).toBeGreaterThan(730);
    expect(canvasBoxPx(730, 428, old) + 428).toBeLessThanOrEqual(730);
  });
});

describe("涂色小屋 ·「挤一挤」这一档不许动热区", () => {
  const tight = CLF_CSS.slice(
    CLF_CSS.indexOf(".clf-wrap.clf-tight{"),
    CLF_CSS.indexOf("@media (prefers-reduced-motion")
  );

  it("收的只有留白、字号和装饰行", () => {
    expect(rule(".clf-wrap.clf-tight")).toContain("gap:6px");
    expect(tight).toContain(".clf-wrap.clf-tight .clf-chips{max-height:62px");
    expect(tight).toContain(".clf-wrap.clf-tight .clf-msg{min-height:18px");
  });

  it("这一档里一个热区选择器都不许出现", () => {
    expect(tight).not.toBe("");
    for (const sel of [".clf-tool", ".clf-swatch-dot", ".clf-primary{", ".clf-zoom", ".clf-pick"]) {
      expect(tight.includes(sel), `「挤一挤」这一档动了热区 ${sel}`).toBe(false);
    }
    // 调锅那颗原料只收了看得见的圆点，按得着的那个盒子（.clf-primary 的 44px）没动
    expect(tight).toContain(".clf-primary-dot{width:28px");
    expect(rule(".clf-primary")).toContain("min-height:44px");
  });

  it("字号不许收到基准样式自己的下限（12px）以下", () => {
    const base = CLF_CSS.slice(0, CLF_CSS.indexOf("@media (max-width:400px)"));
    const floor = Math.min(...[...base.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1])));
    expect(floor).toBe(12);
    for (const m of tight.matchAll(/font-size:(\d+)px/g)) {
      expect(Number(m[1]), "「挤一挤」把字收得比基准样式还小了").toBeGreaterThanOrEqual(floor);
    }
  });

  it("基准样式里那几个 44px 的热区原样还在", () => {
    expect(rule(".clf-tool")).toContain("min-height:44px");
    expect(rule(".clf-swatch-dot")).toContain("width:44px");
    expect(rule(".clf-zoom")).toContain("min-height:44px");
    expect(rule(".clf-primary")).toContain("min-height:44px");
  });

  it("这一屏是竖着的弹性盒，子项一律不许被压扁", () => {
    // 少了这一行，钳出天花板之后调色板整排会从 81px 压成 6px、画布框直接归零，
    // 「点不着」会从「在屏幕外」变成「压没了」，比原来还糟
    expect(rule(".clf-wrap>*")).toContain("flex:0 0 auto");
    expect(rule(".clf-sheet>*")).toContain("flex:0 0 auto");
  });
});

describe("涂色小屋 · 钳位怎么接进去的（源码巡检）", () => {
  it("钳位在渲染完之后跑一次，并且排在 pinCanvas 前面", () => {
    expect(INDEX).toContain("fitColoringStage(wrap, stageBox)");
    expect(INDEX.indexOf("fitColoringStage(wrap, stageBox)")).toBeLessThan(INDEX.indexOf("pinCanvas(wrap, stageBox)"));
  });

  it("指令条与调色盘每次重画都重钳（做完一条划掉、开出新色多一颗，高度都会变）", () => {
    for (const fn of ["renderChips", "renderPalette"]) {
      const body = INDEX.slice(INDEX.indexOf(`function ${fn}(): void {`));
      expect(body.slice(0, body.indexOf("\n  }\n")), `${fn} 改完高度没有重钳`).toContain("refit()");
    }
  });

  it("destroy 里把 resize 监听拆干净", () => {
    const destroy = INDEX.slice(INDEX.indexOf("    destroy() {"));
    expect(destroy.slice(0, 900)).toContain("fit.dispose()");
    expect(UI).toContain('view?.removeEventListener("resize", relayout)');
  });

  it("钳之前先把上一次钳出来的都还原，不然越量越小", () => {
    const fit = UI.slice(UI.indexOf("export function fitColoringStage"));
    const head = fit.slice(0, fit.indexOf("const bottoms"));
    expect(head).toContain('wrap.classList.remove("clf-tight")');
    expect(head).toContain('wrap.style.maxHeight = ""');
    expect(head).toContain('stageBox.style.height = ""');
  });

  it("装得下就一个字节都不改（高屏上不许凭空多出一个滚动容器）", () => {
    const fit = UI.slice(UI.indexOf("export function fitColoringStage"));
    expect(fit).toContain("if (wrap.scrollHeight <= room + 1) return;");
  });

  it("钳出来的是像素值不是百分比——百分比在这条壳层链上是空转的", () => {
    const fit = UI.slice(UI.indexOf("export function fitColoringStage"));
    expect(fit).toMatch(/wrap\.style\.maxHeight = `\$\{Math\.floor\(room\)\}px`/);
    expect(fit).not.toContain('maxHeight = "100%"');
  });

  it("pinCanvas 把这一屏自己也算进滚动监听（它才是矮机器上真滑得动的那一层）", () => {
    const pin = UI.slice(UI.indexOf("export function pinCanvas"));
    expect(pin).toContain("[wrap, ...clippersOf(wrap)]");
  });
});
