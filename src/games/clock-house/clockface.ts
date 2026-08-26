/**
 * 时钟小屋 1.2：分钟级钟面的 SVG 渲染。
 *
 * 1.0/1.1 那个只画整点与刻的 `clockSVG` 留在 levels.ts 里一个字没动（前 99 关照旧），
 * 这一份是新的：60 根刻度、12 个数字、三根长短粗细都对得上真钟的指针，
 * 时针位置永远带上分针带动的那一点偏移（`hourHandAngleAt`），不许出现「时针死压数字」的错钟面。
 */
import {
  clockMinute,
  formatClockMinute,
  hourHandAngleAt,
  minuteHandAngleAt,
  normClockMinutes,
  secondHandAngleAt,
} from "./logic";

/** 钟面在 100×100 视口里的半径 */
export const FACE_RADIUS = 46;

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

function line(name: HandName, angle: number): string {
  const h = HANDS[name];
  const tip = handTip(angle, h.length);
  return `<line class="clk-hand clk-hand-${name}" data-clk-hand="${name}" x1="50" y1="50" x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(
    2
  )}" stroke="${h.color}" stroke-width="${h.width}" stroke-linecap="round"/>`;
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
    out += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${
      big ? "#5c4a7d" : "#b7abd4"
    }" stroke-width="${big ? 1.8 : 0.8}" stroke-linecap="round"/>`;
  }
  return out;
}

function numbers(): string {
  let out = "";
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const x = 50 + Math.cos(a) * 31;
    const y = 50 + Math.sin(a) * 31;
    out += `<text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(
      1
    )}" font-size="9" font-weight="800" text-anchor="middle" fill="#5c4a7d">${i === 0 ? 12 : i}</text>`;
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
  /** 读屏标签；不传就按时刻自动生成 */
  label?: string;
  /** 这是一个能拖的钟面（`dial.ts` 会认这个标记接管交互） */
  dial?: boolean;
}

/** 画一个分钟级钟面（`data-t` 是钟面分钟数，供测试与判定直接读） */
export function faceSVG(t: number, size: number, opts: FaceOptions = {}): string {
  const time = normClockMinutes(t);
  const label = opts.label ?? formatClockMinute(time);
  const hourAngle = opts.hourAngle ?? hourHandAngleAt(time);
  const cls = ["clk-face-svg", opts.className].filter(Boolean).join(" ");
  const second = typeof opts.second === "number" ? line("second", secondHandAngleAt(opts.second)) : "";
  return `<svg class="${cls}" data-t="${time}" data-m="${clockMinute(time)}"${
    opts.dial ? ' data-clk-dial="1"' : ""
  } width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}">
    <circle cx="50" cy="50" r="${FACE_RADIUS}" fill="#fff" stroke="#845ef7" stroke-width="4"/>
    ${ticks()}
    ${numbers()}
    ${line("hour", hourAngle)}
    ${line("minute", minuteHandAngleAt(time))}
    ${second}
    <circle cx="50" cy="50" r="3" fill="#5c4a7d"/>
  </svg>`;
}
