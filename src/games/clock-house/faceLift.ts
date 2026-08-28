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

/** 旧钟面的两根细线指针：宽 6 = 时针、宽 4 = 分针（clockSVG 的既定写法，钉死匹配） */
const HAND_LINE_RE =
  /<line x1="50" y1="50" x2="([\d.]+)" y2="([\d.]+)" stroke="#(?:e8590c|1971c2)" stroke-width="(6|4)" stroke-linecap="round"\/>/g;

/** 旧钟面的轴心小圆 */
const OLD_HUB = `<circle cx="50" cy="50" r="3.4" fill="#5c4a7d"/>`;

/**
 * 换装一张旧钟面的**内部** SVG 标记（纯字符串进出，node 环境可直接断言）。
 * 换过一次之后再喂进来是恒等映射——老写法的指针 / 轴心已经不存在了。
 */
export function liftFaceBody(inner: string): string {
  return inner
    .replace(HAND_LINE_RE, (_all, x2: string, y2: string, w: string) => {
      const hour = w === "6";
      const color = hour ? CLK_TOKENS.hourOrange : CLK_TOKENS.minuteTeal;
      const shape = hour ? HOUR_HAND_SHAPE : MINUTE_HAND_SHAPE;
      return (
        `<path class="${hour ? "clk-lift-hour" : "clk-lift-minute"}"` +
        ` d="${arrowHandD(50, 50, Number(x2), Number(y2), shape)}"` +
        ` fill="${color}" stroke="${shade(color, -30)}" stroke-width="1.4" stroke-linejoin="round"/>`
      );
    })
    .replace(OLD_HUB, hubSVG())
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
