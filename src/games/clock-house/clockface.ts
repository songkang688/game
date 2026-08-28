/**
 * 时钟小屋 1.2：分钟级钟面的 SVG 渲染。
 *
 * 1.0/1.1 那个只画整点与刻的 `clockSVG` 留在 levels.ts 里一个字没动（前 99 关照旧），
 * 这一份是新的：60 根刻度、12 个数字、三根长短粗细都对得上真钟的指针，
 * 时针位置永远带上分针带动的那一点偏移（`hourHandAngleAt`），不许出现「时针死压数字」的错钟面。
 *
 * 1.3 A 档只换了皮：奶油表盘 + 双色木圈、数字换小木牌（12/3/6/9 主位放大）、
 * 时针分针叠了一层箭头 path 造型（`handDAt`，端点仍由 `handTip` 算出）、轴心加铆钉。
 * 原来的 `<line data-clk-hand>` 一根没删——它是端点载体与回归测试的可测接口，
 * 只是描边改成 none，把「画出来的针」交给上面的 path 层。
 */
import { shade } from "../../art/kit/palette";
import { woodSignSVG } from "../../art/kit/woodSign";
import { CLK_TOKENS, HOUR_HAND_SHAPE, MINUTE_HAND_SHAPE, arrowHandD, hubSVG } from "./house";
import {
  clockMinute,
  hourHandAngleAt,
  minuteHandAngleAt,
  normClockMinutes,
  secondHandAngleAt,
} from "./logic";

/** 钟面在 100×100 视口里的半径 */
export const FACE_RADIUS = 46;

/**
 * 钟面默认的读屏标签。
 *
 * 钟面本身就是要读的那道题，标签一旦写成时刻，读屏的孩子和随手看一眼 DOM 的人
 * 都不用读钟就拿到答案了。所以默认一律给这句不含时刻的说明，
 * 真要把时刻念出来的地方（拨一拨那个练手钟面的实时读数）自己显式传 `label`。
 */
export const FACE_LABEL = "钟面，自己读一读";

/**
 * 三根针的长度与粗细（视口坐标）。
 * 教学要求：时针短而粗、分针长而细、秒针最长最细且是红的，一眼分得出谁是谁。
 */
export const HANDS = {
  hour: { length: 21, width: 6.4, color: "#d9480f" },
  minute: { length: 32, width: 4, color: "#1971c2" },
  second: { length: 37, width: 1.6, color: "#e03131" },
} as const;

export type HandName = keyof typeof HANDS;

/** 极坐标 → 视口坐标（角度以 12 点为 0，顺时针） */
export function handTip(angle: number, length: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: 50 + Math.cos(rad) * length, y: 50 + Math.sin(rad) * length };
}

function line(name: HandName, angle: number, stroke?: string): string {
  const h = HANDS[name];
  const tip = handTip(angle, h.length);
  return `<line class="clk-hand clk-hand-${name}" data-clk-hand="${name}" x1="50" y1="50" x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(
    2
  )}" stroke="${stroke ?? h.color}" stroke-width="${h.width}" stroke-linecap="round"/>`;
}

/** 时针 / 分针的造型皮肤：主色不同色相 + 深一档的描边（4.1 token 表） */
export const HAND_SKIN = {
  hour: { fill: CLK_TOKENS.hourOrange, edge: shade(CLK_TOKENS.hourOrange, -46) },
  minute: { fill: CLK_TOKENS.minuteTeal, edge: shade(CLK_TOKENS.minuteTeal, -46) },
} as const;

/**
 * 某根针在某个角度的箭头 path d。
 * 端点坐标就是 `handTip(angle, HANDS[name].length)`——造型层只做打扮，绝不自己算角度。
 */
export function handDAt(name: "hour" | "minute", angle: number): string {
  const tip = handTip(angle, HANDS[name].length);
  return arrowHandD(50, 50, tip.x, tip.y, name === "hour" ? HOUR_HAND_SHAPE : MINUTE_HAND_SHAPE);
}

/**
 * 一根针的完整图层：端点载体 `<line data-clk-hand>`（描边 none，坐标接口原样）
 * + 箭头造型 `<path data-clk-handp>`（拖动时 `dial.ts` 同步重算 d）。
 */
function handLayer(name: "hour" | "minute", angle: number): string {
  const skin = HAND_SKIN[name];
  return `${line(name, angle, "none")}<path class="clk-handp clk-handp-${name}" data-clk-handp="${name}" d="${handDAt(
    name,
    angle
  )}" fill="${skin.fill}" stroke="${skin.edge}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

function ticks(): string {
  let out = "";
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const a = ((i * 6 - 90) * Math.PI) / 180;
    const outer = FACE_RADIUS - 2;
    const inner = outer - (big ? 6 : 3);
    const x1 = 50 + Math.cos(a) * inner;
    const y1 = 50 + Math.sin(a) * inner;
    const x2 = 50 + Math.cos(a) * outer;
    const y2 = 50 + Math.sin(a) * outer;
    out += `<line class="${big ? "clk-t5" : "clk-t1"}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(
      2
    )}" y2="${y2.toFixed(2)}" stroke="${big ? "#5c4a7d" : "#b7abd4"}" stroke-width="${
      big ? 1.8 : 0.8
    }" stroke-linecap="round"/>`;
  }
  return out;
}

/** 数字木牌的基础宽高与主位（12/3/6/9）放大倍数（第九节用例 5/12 的可测常量） */
export const NUM_SIGN_W = 9.6;
export const NUM_SIGN_H = 11;
export const NUM_MAIN_SCALE = 1.25;

function numbers(): string {
  let out = "";
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const x = 50 + Math.cos(a) * 30;
    const y = 50 + Math.sin(a) * 30;
    const main = i % 3 === 0;
    const s = main ? NUM_MAIN_SCALE : 1;
    out += woodSignSVG({
      cx: x,
      cy: y,
      w: NUM_SIGN_W * s,
      h: NUM_SIGN_H * s,
      text: String(i === 0 ? 12 : i),
      fontSize: 6.8 * s,
      fill: shade(CLK_TOKENS.houseWood, 42),
      edge: main ? CLK_TOKENS.roofRed : CLK_TOKENS.houseWoodDark,
      nail: CLK_TOKENS.houseWoodDark,
      ink: "#5c4a7d",
      strokeWidth: main ? 1 : 0.7,
      className: main ? "clk-num clk-num-main" : "clk-num",
    });
  }
  return out;
}

export interface FaceOptions {
  /** 附加 class（`clk-face` 自适应大钟面 / `clk-face-mini` 选项小钟面） */
  className?: string;
  /**
   * 故意把时针摆到别的角度：只给「时针死死压在数字上」这类错误钟面当干扰项用，
   * 正确钟面永远不传这个参数。
   */
  hourAngle?: number;
  /** 画秒针（读到一分的关卡用它帮孩子建立「细红针走得最快」的印象） */
  second?: number;
  /** 读屏标签；不传就用不含时刻的 `FACE_LABEL`，免得标签自己把答案说了 */
  label?: string;
  /** 这是一个能拖的钟面（`dial.ts` 会认这个标记接管交互） */
  dial?: boolean;
}

/** 画一个分钟级钟面（`data-t` 是钟面分钟数，供测试与判定直接读） */
export function faceSVG(t: number, size: number, opts: FaceOptions = {}): string {
  const time = normClockMinutes(t);
  const label = opts.label ?? FACE_LABEL;
  const hourAngle = opts.hourAngle ?? hourHandAngleAt(time);
  const cls = ["clk-face-svg", opts.className].filter(Boolean).join(" ");
  const second = typeof opts.second === "number" ? line("second", secondHandAngleAt(opts.second)) : "";
  return `<svg class="${cls}" data-t="${time}" data-m="${clockMinute(time)}"${
    opts.dial ? ' data-clk-dial="1"' : ""
  } width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}">
    <circle cx="50" cy="50" r="${FACE_RADIUS}" fill="${CLK_TOKENS.dialCream}" stroke="${CLK_TOKENS.houseWoodDark}" stroke-width="2.2"/>
    <circle class="clk-ring" cx="50" cy="50" r="${FACE_RADIUS - 2.4}" fill="none" stroke="${CLK_TOKENS.houseWood}" stroke-width="2.4"/>
    ${ticks()}
    ${numbers()}
    ${handLayer("hour", hourAngle)}
    ${handLayer("minute", minuteHandAngleAt(time))}
    ${second}
    ${hubSVG()}
  </svg>`;
}
