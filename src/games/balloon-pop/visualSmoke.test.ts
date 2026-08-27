/**
 * 气球砰砰 · 1.3 视觉升级运行期冒烟（桩 DOM，和 box-hamster/visualSmoke 一个路数）：
 * 真跑 paintBalloon，把每一种气球都画一遍，断言三层渐变皮肤 / 气球结 / 贝塞尔线 /
 * 特殊件真的挂上了按钮，热区尺寸与 dataset / aria-label 原样。
 * 只断言视觉与「状态没被改」，不断言任何玩法数值。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { splitLayers } from "../../art/kit/balloonSkin";
import { shade } from "../../art/kit/palette";
import { evalMathExpr } from "./levels";
import { FAR_SCALE } from "./logic";

type Fn = (...args: unknown[]) => unknown;

class El {
  tag: string;
  children: El[] = [];
  attrs = new Map<string, string>();
  style: Record<string, unknown>;
  dataset: Record<string, string> = {};
  className = "";
  type = "";
  /** insertAdjacentHTML 塞进来的原始片段（SVG 装饰件都走这儿） */
  rawHtml = "";
  private text = "";
  constructor(tag: string) {
    this.tag = tag;
    const bag: Record<string, unknown> = {};
    bag.setProperty = (k: string, v: string): void => {
      bag[k] = v;
    };
    this.style = bag;
  }
  set textContent(v: string) {
    this.text = v;
    // 和真 DOM 一致：写 textContent 会清空子节点与片段
    this.children = [];
    this.rawHtml = "";
  }
  get textContent(): string {
    return this.text;
  }
  appendChild(c: El): El {
    this.children.push(c);
    return c;
  }
  insertAdjacentHTML(_pos: string, html: string): void {
    this.rawHtml += html;
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  remove(): void {}
  get classList(): { add: (...cs: string[]) => void; remove: (...cs: string[]) => void; contains: (c: string) => boolean } {
    return {
      add: (...cs: string[]) => {
        const cur = this.className.split(/\s+/).filter(Boolean);
        for (const c of cs) if (!cur.includes(c)) cur.push(c);
        this.className = cur.join(" ");
      },
      remove: (...cs: string[]) => {
        this.className = this.className
          .split(/\s+/)
          .filter((c) => c && !cs.includes(c))
          .join(" ");
      },
      contains: (c: string) => this.className.split(/\s+/).includes(c),
    };
  }
}

function installDom(): void {
  const g = globalThis as Record<string, unknown>;
  g.document = { createElement: (tag: string) => new El(tag) };
}

function uninstallDom(): void {
  delete (globalThis as Record<string, unknown>).document;
}

beforeEach(() => installDom());
afterEach(() => uninstallDom());

type PaintFn = typeof import("./index").paintBalloon;
type BalloonArg = Parameters<PaintFn>[0];

async function paint(
  over: Partial<{ kind: string; color: number; num: number; far: boolean }>,
  mode: "free" | "color" | "number" | "math" = "free",
  windDir = 0
): Promise<El> {
  const { paintBalloon } = await import("./index");
  const node = new El("button");
  const b = {
    id: 1,
    el: node as unknown as HTMLButtonElement,
    x0: 40,
    y0: 460,
    born: 0,
    phase: 0,
    x: 40,
    y: 460,
    kind: over.kind ?? "normal",
    color: over.color ?? 0,
    num: over.num ?? 3,
    taps: 0,
    push: 0,
    far: over.far ?? false,
    wave: 0,
    gone: false,
  };
  paintBalloon(b as unknown as BalloonArg, mode, () => 0.4, windDir);
  return node;
}

describe("冒烟 · 皮肤与公共件:三层渐变 / 气球结 / 贝塞尔线", () => {
  it("普通红球:background 恰好三层渐变,不再是 1.2 的单层双色", async () => {
    const node = await paint({ kind: "normal", color: 0 });
    const bg = String(node.style.background);
    expect(splitLayers(bg)).toHaveLength(3);
    expect((bg.match(/radial-gradient\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("每颗球都带 clip-path 气球结,颜色是主色压暗一档", async () => {
    const node = await paint({ kind: "normal", color: 2 });
    const knot = node.children.find((c) => c.className === "blp-knot");
    expect(knot).toBeTruthy();
    expect(knot!.style.background).toBe(shade("#4F94E8", -12));
  });

  it("气球线是内联 SVG 二次贝塞尔,控制点随风向 ±6px 弯", async () => {
    const right = await paint({}, "free", 1);
    const left = await paint({}, "free", -1);
    expect(right.rawHtml).toContain("blp-string");
    expect(right.rawHtml).toContain("Q12 8 6 16");
    expect(left.rawHtml).toContain("Q0 8 6 16");
  });

  it("数字模式:文字进 blp-tag 白底衬牌;算式模式:题面算出来正好是 num", async () => {
    const num = await paint({ num: 4 }, "number");
    const tag = num.children.find((c) => c.className === "blp-tag");
    expect(tag).toBeTruthy();
    expect(tag!.textContent).toBe("4");
    const math = await paint({ num: 5 }, "math");
    expect(math.className).toContain("blp-expr");
    const expr = math.children.find((c) => c.className === "blp-tag")!.textContent;
    expect(evalMathExpr(expr)).toBe(5);
  });
});

describe("冒烟 · 特殊气球:本体差异 + 热区不动", () => {
  it("铁壳近景:纵纹 + 铆钉都在本体上,光圈类照旧", async () => {
    const node = await paint({ kind: "iron" });
    const bg = String(node.style.background);
    expect(bg).toContain("repeating-linear-gradient");
    expect(bg).toContain("#5B6472");
    expect(node.className).toContain("blp-shielded");
  });

  it("铁壳远景:铆钉低于 8px 自动省略,热区按旧 FAR_SCALE 缩", async () => {
    const node = await paint({ kind: "iron", far: true });
    expect(String(node.style.background)).not.toContain("#5B6472");
    expect(node.style.width).toBe(`${Math.round(56 * FAR_SCALE)}px`);
    expect(node.style.height).toBe(`${Math.round(68 * FAR_SCALE)}px`);
    expect(node.className).toContain("blp-far");
  });

  it("双子:82% 副球 + 连结丝带挂上;礼物:礼盒挂在线尾", async () => {
    const twin = await paint({ kind: "twin", color: 1 });
    expect(twin.children.some((c) => c.className === "blp-buddy")).toBe(true);
    expect(twin.rawHtml).toContain("blp-ribbon");
    expect(twin.className).toContain("blp-twin");
    const gift = await paint({ kind: "gift" });
    expect(gift.rawHtml).toContain("blp-giftbox");
    expect(gift.className).toContain("blp-gift");
  });

  it("彩虹:六色转轮保留,顶上叠了主高光那层", async () => {
    const node = await paint({ kind: "rainbow" });
    const bg = String(node.style.background);
    expect(bg).toContain("conic-gradient");
    expect(bg).toContain("rgba(255,255,255,.85)");
  });

  it("dataset 镜像与 aria-label 换肤后原样(冒烟脚本依赖)", async () => {
    const node = await paint({ kind: "iron", color: 3, num: 2 });
    expect(node.dataset).toEqual({ kind: "iron", num: "2", color: "3", shield: "1" });
    expect(node.getAttribute("aria-label")).toBe("绿色护盾铁气球");
  });
});
