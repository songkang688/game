/**
 * 时钟小屋 · 前 99 关旧题面钟的消费端换装（W8R1-07，1.3 窗口8 第 2 轮 C 档新增）。
 *
 * 第 1 轮挂账原因：`clockSVG`（levels.ts）的产物进了 `promptHTML`，前 99 关题面
 * 被 `LEGACY_DIGEST` SHA-256 逐字节钉死——题库字符串一个字节都不能动。
 * 所以走 math-farm countArt / word-garden picArt 同款**渲染后就地装饰**：
 * 壳把题面画完之后，把 `svg[data-h]`（只有旧钟面带这对 data-h/data-q）里的
 *  - 细线时针（宽 6 橙）→ `arrowHandD(HOUR_HAND_SHAPE)` 胖箭头（CLK_TOKENS.hourOrange）；
 *  - 细线分针（宽 4 蓝）→ `arrowHandD(MINUTE_HAND_SHAPE)` 细长箭头（minuteTeal）；
 *  - 轴心小圆 → `hubSVG()` 木色铆钉；
 *  - 刻度数字 9px → 11px（r=36 圈内放得下）。
 * 针尖坐标直接读老 `<line>` 的 x2/y2——角度公式零改动，指的还是原来那个点。
 *
 * 红线：只改 svg 的**内部**节点，svg 元素本身与它的 data-h / data-q /
 * aria-label / role 一字不动；不碰壳的判分（按选项下标）与 helper 的
 * MutationObserver（它只看 .qz-prompt 的 childList，svg 内部换里子它无感）。
 * 新钟面（faceSVG，带 data-t）与可拖钟面（data-clk-dial）不在换装名单里。
 */
import { shade } from "../../art/kit/palette";
import { CLK_TOKENS, HOUR_HAND_SHAPE, MINUTE_HAND_SHAPE, arrowHandD, hubSVG } from "./house";

/** 换装完成的标记（幂等：带它的钟面不再动第二次） */
export const LIFT_ATTR = "data-clk-lift";

/**
 * 旧钟面两根细线指针。真机 `svg.innerHTML` 常把自闭合写成 `></line>`，属性顺序也不稳，
 * 所以按属性袋匹配，不钉死序列化形态。
 */
function attrOf(attrs: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]+)"`).exec(attrs)?.[1];
}

function handLineRe(): RegExp {
  return /<line\b([^>]*?)\/?>(?:<\/line>)?/gi;
}

function hubCircleRe(): RegExp {
  return /<circle\b([^>]*?)\/?>(?:<\/circle>)?/gi;
}

/**
 * 换装一张旧钟面的**内部** SVG 标记（纯字符串进出，node 环境可直接断言）。
 * 换过一次之后再喂进来是恒等映射——老写法的指针 / 轴心已经不存在了。
 */
export function liftFaceBody(inner: string): string {
  return inner
    .replace(handLineRe(), (all, attrs: string) => {
      const x2 = attrOf(attrs, "x2");
      const y2 = attrOf(attrs, "y2");
      const w = attrOf(attrs, "stroke-width");
      const stroke = (attrOf(attrs, "stroke") ?? "").toLowerCase();
      if (!x2 || !y2 || (w !== "6" && w !== "4")) return all;
      if (stroke !== "#e8590c" && stroke !== "#1971c2") return all;
      const hour = w === "6";
      const color = hour ? CLK_TOKENS.hourOrange : CLK_TOKENS.minuteTeal;
      const shape = hour ? HOUR_HAND_SHAPE : MINUTE_HAND_SHAPE;
      return (
        `<path class="${hour ? "clk-lift-hour" : "clk-lift-minute"}"` +
        ` d="${arrowHandD(50, 50, Number(x2), Number(y2), shape)}"` +
        ` fill="${color}" stroke="${shade(color, -30)}" stroke-width="1.4" stroke-linejoin="round"/>`
      );
    })
    .replace(hubCircleRe(), (all, attrs: string) => {
      if (attrOf(attrs, "r") !== "3.4") return all;
      if ((attrOf(attrs, "fill") ?? "").toLowerCase() !== "#5c4a7d") return all;
      return hubSVG();
    })
    .replace(/font-size="9"/g, 'font-size="11"');
}

/**
 * 把宿主里所有还没换装的旧钟面就地换装，返回这一趟换了几面。
 * 只重写 svg 的 innerHTML：svg 节点本身不换，题面容器的 childList 无感。
 */
export function liftFacesIn(host: Element): number {
  let n = 0;
  const faces = host.querySelectorAll("svg[data-h]");
  for (let i = 0; i < faces.length; i++) {
    const svg = faces[i];
    if (svg.getAttribute(LIFT_ATTR)) continue;
    svg.setAttribute(LIFT_ATTR, "1");
    svg.innerHTML = liftFaceBody(svg.innerHTML);
    n++;
  }
  return n;
}

export interface FaceLiftHandle {
  destroy: () => void;
}

/**
 * 首次换装 + 跟着壳换题自动补装（观察 host 子树的 childList）。
 * 没有 MutationObserver 的环境只做首次换装，题面照常可玩。
 */
export function mountFaceLift(host: HTMLElement): FaceLiftHandle {
  liftFacesIn(host);
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver === "function") {
    observer = new MutationObserver(() => liftFacesIn(host));
    observer.observe(host, { childList: true, subtree: true });
  }
  return {
    destroy() {
      observer?.disconnect();
      observer = null;
    },
  };
}
