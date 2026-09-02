/**
 * 红蓝赛跑 · 1.3 视觉皮肤(纯字符串 SVG 与 CSS token,不碰 DOM、不碰玩法)。
 *
 * 这里只有「怎么画」:障碍 / 道具 / 终点拱门 / 看台彩旗 / 起跑灯的矢量绘制,
 * 以及全部 `--rbr-` 设计 token。判定、结算、速度演算一个字都不在这个文件里。
 * 全部函数输出确定、node 环境可直接断言;同页多实例用 `uid` 隔离渐变 id。
 */
import { shade as mixPct } from "../../art/kit/palette";
import type { ObstacleType } from "./levels";

/** 暗部推导:向黑靠 amount(0..1)。公共 palette 的 shade 是百分比语义,这里包一层 */
function shade(hex: string, amount: number): string {
  return mixPct(hex, -amount * 100);
}

/** 高光推导:向白靠 amount(0..1) */
function tint(hex: string, amount: number): string {
  return mixPct(hex, amount * 100);
}

/** 本款专属的粉彩补充色(公共 PASTEL 没有的集中在这里,不散落) */
const RACE_PASTEL = {
  candyPink: "#F8B7CD",
  lemon: "#FFE28A",
  mint: "#A8E6C3",
  starGold: "#F5C445",
  ink: "#4A4458"
} as const;

/**
 * 设计 token(四·补一):色板 + 动效时长全部集中在这里,
 * 三个壳(闯关 rbr / 无尽 rbe / 对战 rbv)共用一套。
 */
export const RBR_TOKENS_CSS = `
.rbr-wrap, .rbe-wrap, .rbv-wrap {
  --rbr-track: #E8A87A;
  --rbr-track-far: #D8946A;
  --rbr-lane-line: rgba(255,255,255,.7);
  --rbr-sky: #DFF2FF;
  --rbr-stand: #D8CBEA;
  --rbr-red: #E85D75;
  --rbr-blue: #4A7FD8;
  --rbr-puddle: #A8D8F0;
  --rbr-gate: #F0C25A;
  --rbr-dust-ms: 240ms;
  --rbr-slip-ms: 500ms;
  --rbr-fly-ms: 260ms;
}
`;

/**
 * 跑者位置映射(pos 0..100 → left 0..92%)。
 * 和 1.2 的 `setPos` 一字不差:换肤只换画法,位置公式钉死。
 */
export function laneLeftPct(pos: number): number {
  return Math.max(0, Math.min(92, pos * 0.92));
}

function cleanUid(uid: string): string {
  return uid.replace(/[^a-zA-Z0-9_-]/g, "");
}

const INK = RACE_PASTEL.ink;

/** 水坑:椭圆水洼 + 反光高光 + 溅起的两滴水 */
function puddleSvg(): string {
  const deep = shade("#A8D8F0", 0.18);
  return (
    `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-ob="puddle">` +
    `<ellipse cx="20" cy="17" rx="17" ry="6" fill="${deep}"/>` +
    `<ellipse cx="20" cy="16" rx="15.5" ry="5" fill="var(--rbr-puddle, #A8D8F0)"/>` +
    `<path d="M9 15.2 Q15 12.8 24 14.4" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>` +
    `<circle cx="28" cy="16.8" r="1.1" fill="#FFFFFF" opacity=".7"/>` +
    `<path d="M12 8 q1.4-3 2.8 0 a1.5 1.6 0 1 1 -2.8 0 Z" fill="var(--rbr-puddle, #A8D8F0)" stroke="${shade("#A8D8F0", 0.3)}" stroke-width=".8"/>` +
    `<path d="M27 5 q1.2-2.6 2.4 0 a1.3 1.4 0 1 1 -2.4 0 Z" fill="var(--rbr-puddle, #A8D8F0)" stroke="${shade("#A8D8F0", 0.3)}" stroke-width=".8"/>` +
    `</svg>`
  );
}

/** 栏架:双腿小跨栏,条纹横杆 + 落地小脚 */
function hurdleSvg(): string {
  const gold = "#F0C25A";
  const dark = shade(gold, 0.35);
  const stripes = [0, 1, 2, 3, 4]
    .map((i) => `<rect x="${5 + i * 6}" y="6" width="3.2" height="5" rx="1" fill="#FFFFFF" opacity=".9"/>`)
    .join("");
  return (
    `<svg viewBox="0 0 40 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-ob="hurdle">` +
    `<rect x="7" y="12" width="3.4" height="18" rx="1.6" fill="${dark}"/>` +
    `<rect x="29.6" y="12" width="3.4" height="18" rx="1.6" fill="${dark}"/>` +
    `<rect x="4" y="29" width="10" height="3" rx="1.5" fill="${dark}"/>` +
    `<rect x="26" y="29" width="10" height="3" rx="1.5" fill="${dark}"/>` +
    `<rect x="3.5" y="5" width="33" height="7" rx="3" fill="var(--rbr-gate, ${gold})" stroke="${dark}" stroke-width="1.2"/>` +
    stripes +
    `<rect x="3.5" y="9.6" width="33" height="2.4" rx="1.2" fill="${shade(gold, 0.2)}" opacity=".6"/>` +
    `</svg>`
  );
}

/** 冲刺星:渐变 + 描边 + 小闪光 */
function starSvg(uid: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 5.6;
    pts.push(`${(17 + Math.cos(rad) * r).toFixed(1)},${(15 + Math.sin(rad) * r).toFixed(1)}`);
  }
  return (
    `<svg viewBox="0 0 34 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-ob="star">` +
    `<defs><linearGradient id="${uid}-star" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${tint(RACE_PASTEL.starGold, 0.35)}"/><stop offset="1" stop-color="${RACE_PASTEL.starGold}"/>` +
    `</linearGradient></defs>` +
    `<polygon points="${pts.join(" ")}" fill="url(#${uid}-star)" stroke="${shade(RACE_PASTEL.starGold, 0.4)}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="12.6" cy="10.5" r="1.7" fill="#FFFFFF" opacity=".85"/>` +
    `</svg>`
  );
}

/** 礼物箱:渐变箱体 + 缎带蝴蝶结 + 描边 */
function giftSvg(uid: string): string {
  const pink = RACE_PASTEL.candyPink;
  const ribbon = RACE_PASTEL.lemon;
  return (
    `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-ob="item">` +
    `<defs><linearGradient id="${uid}-gift" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${tint(pink, 0.28)}"/><stop offset="1" stop-color="${shade(pink, 0.12)}"/>` +
    `</linearGradient></defs>` +
    `<rect x="4" y="12" width="24" height="17" rx="3" fill="url(#${uid}-gift)" stroke="${shade(pink, 0.42)}" stroke-width="1.4"/>` +
    `<rect x="2.6" y="8" width="26.8" height="6.4" rx="2.6" fill="${tint(pink, 0.16)}" stroke="${shade(pink, 0.42)}" stroke-width="1.4"/>` +
    `<rect x="13.6" y="8" width="4.8" height="21" fill="${ribbon}" stroke="${shade(ribbon, 0.35)}" stroke-width=".9"/>` +
    `<path d="M16 8 C11 2 5.4 4.6 9.4 8 Z" fill="${ribbon}" stroke="${shade(ribbon, 0.35)}" stroke-width=".9"/>` +
    `<path d="M16 8 C21 2 26.6 4.6 22.6 8 Z" fill="${ribbon}" stroke="${shade(ribbon, 0.35)}" stroke-width=".9"/>` +
    `<rect x="6" y="25.4" width="20" height="2.6" rx="1.3" fill="${shade(pink, 0.3)}" opacity=".5"/>` +
    `</svg>`
  );
}

/** 上坡:双峰小土丘 + 草顶高光(配合车道里的坡道色带) */
function hillSvg(): string {
  const sand = "#D8946A";
  return (
    `<svg viewBox="0 0 44 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-ob="hill">` +
    `<path d="M2 22 Q13 4 25 22 Z" fill="${sand}" stroke="${shade(sand, 0.3)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M20 22 Q31 8 42 22 Z" fill="${tint(sand, 0.14)}" stroke="${shade(sand, 0.3)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M8 15 Q13 9 18 15" fill="none" stroke="${RACE_PASTEL.mint}" stroke-width="2" stroke-linecap="round" opacity=".9"/>` +
    `</svg>`
  );
}

/** 五种赛道机关的自绘皮肤,替掉 1.2 的裸 emoji 表 */
export function obstacleSvg(type: ObstacleType, uid: string): string {
  const id = cleanUid(uid) || "rbrOb";
  switch (type) {
    case "puddle":
      return puddleSvg();
    case "hurdle":
      return hurdleSvg();
    case "star":
      return starSvg(id);
    case "item":
      return giftSvg(id);
    case "hill":
      return hillSvg();
  }
}

/** 终点:格纹拱门 + 缎带(缎带两半挂 rbr-ribbon-l / rbr-ribbon-r,冲线后 CSS 荡开) */
export function finishArchSvg(uid: string): string {
  const id = cleanUid(uid) || "rbrArch";
  const gate = "#F0C25A";
  const dark = shade(gate, 0.35);
  let checkers = "";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row + col) % 2 === 0) {
        checkers += `<rect x="${8 + col * 6.3}" y="${6 + row * 6}" width="6.3" height="6" fill="${INK}"/>`;
      }
    }
  }
  return (
    `<svg viewBox="0 0 60 104" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true" data-art="finish-arch">` +
    `<defs><linearGradient id="${id}-post" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${tint(gate, 0.3)}"/><stop offset="1" stop-color="${shade(gate, 0.18)}"/>` +
    `</linearGradient></defs>` +
    `<rect x="4" y="10" width="6.5" height="94" rx="2.6" fill="url(#${id}-post)" stroke="${dark}" stroke-width="1"/>` +
    `<rect x="49.5" y="10" width="6.5" height="94" rx="2.6" fill="url(#${id}-post)" stroke="${dark}" stroke-width="1"/>` +
    `<rect x="6" y="4" width="48" height="15" rx="4" fill="#FFFFFF" stroke="${dark}" stroke-width="1.4"/>` +
    checkers +
    `<rect x="6" y="4" width="48" height="15" rx="4" fill="none" stroke="${dark}" stroke-width="1.4"/>` +
    `<circle cx="7.2" cy="8" r="3" fill="var(--rbr-gate, ${gate})" stroke="${dark}" stroke-width="1"/>` +
    `<circle cx="52.8" cy="8" r="3" fill="var(--rbr-gate, ${gate})" stroke="${dark}" stroke-width="1"/>` +
    `<path class="rbr-ribbon-l" d="M7 62 Q18 65 30 63" fill="none" stroke="#E85D75" stroke-width="3" stroke-linecap="round"/>` +
    `<path class="rbr-ribbon-r" d="M30 63 Q42 65 53 62" fill="none" stroke="#E85D75" stroke-width="3" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** 自绘格纹旗(替掉结算浮层与终点标记的 emoji 旗) */
export function checkerFlagSvg(uid: string): string {
  const id = cleanUid(uid) || "rbrFlag";
  let checkers = "";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 0) {
        checkers += `<rect x="${13 + col * 7}" y="${7 + row * 6.4}" width="7" height="6.4" fill="${INK}"/>`;
      }
    }
  }
  return (
    `<svg viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-art="checker-flag">` +
    `<defs><clipPath id="${id}-wave"><path d="M13 7 Q24 3.6 41 7 L41 26.2 Q30 29.8 13 26.2 Z"/></clipPath></defs>` +
    `<rect x="9" y="4" width="3.4" height="46" rx="1.7" fill="${shade("#F0C25A", 0.3)}"/>` +
    `<circle cx="10.7" cy="4.4" r="2.6" fill="var(--rbr-gate, #F0C25A)" stroke="${shade("#F0C25A", 0.4)}" stroke-width="1"/>` +
    `<g clip-path="url(#${id}-wave)"><rect x="13" y="3" width="28" height="27" fill="#FFFFFF"/>${checkers}</g>` +
    `<path d="M13 7 Q24 3.6 41 7 L41 26.2 Q30 29.8 13 26.2 Z" fill="none" stroke="${INK}" stroke-width="1.6"/>` +
    `</svg>`
  );
}

/** 领先方的小皇冠(HUD 双条用) */
export function crownSvg(): string {
  const gold = RACE_PASTEL.starGold;
  return (
    `<svg viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-art="crown">` +
    `<path d="M2.6 11.4 L1.6 3.4 L6.4 6.6 L10 1.6 L13.6 6.6 L18.4 3.4 L17.4 11.4 Z" fill="${gold}" stroke="${shade(gold, 0.42)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<rect x="2.6" y="11" width="14.8" height="2.2" rx="1.1" fill="${shade(gold, 0.22)}"/>` +
    `<circle cx="10" cy="7.8" r="1.5" fill="#FFFFFF" opacity=".85"/>` +
    `</svg>`
  );
}

/** 远景看台剪影:观众席色带 + 一排小脑袋,`preserveAspectRatio=none` 拉通全宽 */
export function standsSvg(): string {
  const stand = "#D8CBEA";
  const heads = [8, 26, 44, 62, 80, 98, 116, 134, 152, 170, 188, 206, 224, 242, 260, 278]
    .map(
      (x, i) =>
        `<circle cx="${x}" cy="${13 + (i % 3)}" r="4.6" fill="${i % 2 === 0 ? shade(stand, 0.16) : shade(stand, 0.3)}"/>`
    )
    .join("");
  return (
    `<svg viewBox="0 0 300 26" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true" data-art="stands">` +
    `<rect x="0" y="8" width="300" height="18" rx="4" fill="var(--rbr-stand, ${stand})"/>` +
    heads +
    `<rect x="0" y="8" width="300" height="4" fill="${tint(stand, 0.35)}"/>` +
    `</svg>`
  );
}

/** 彩旗串:三色小三角旗,挂在看台前一层(视差第二层) */
export function buntingSvg(): string {
  const colors = [RACE_PASTEL.candyPink, RACE_PASTEL.lemon, RACE_PASTEL.mint];
  let flags = "";
  for (let i = 0; i < 12; i++) {
    const x = 4 + i * 25;
    const c = colors[i % colors.length];
    flags += `<path d="M${x} 4 L${x + 16} 4 L${x + 8} 15 Z" fill="${c}" stroke="${shade(c, 0.25)}" stroke-width=".8"/>`;
  }
  return (
    `<svg viewBox="0 0 300 18" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true" data-art="bunting">` +
    `<path d="M0 4 Q150 8 300 4" fill="none" stroke="${shade("#D8CBEA", 0.2)}" stroke-width="1.4"/>` +
    flags +
    `</svg>`
  );
}

/** 裁判小哨子(抢跑气泡用,画风圆润不凶) */
export function whistleSvg(): string {
  const gold = RACE_PASTEL.starGold;
  return (
    `<svg viewBox="0 0 22 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-art="whistle">` +
    `<path d="M3 5 L14 5 L14 8 A5 5 0 1 1 6.2 8 L3 8 Z" fill="${gold}" stroke="${shade(gold, 0.4)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="10.5" cy="10.2" r="1.8" fill="${shade(gold, 0.35)}"/>` +
    `<path d="M17 3 Q19.5 1.5 21 3.4 M18 6.4 L21 6" fill="none" stroke="${shade(gold, 0.25)}" stroke-width="1.2" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** 起跑指示灯三盏(红红绿),类切换交给 createStartGate 的三个既有节点 */
export function startLightsHtml(): string {
  return (
    `<span class="rbr-lights" aria-hidden="true">` +
    `<i class="rbr-light rbr-light-ready"></i>` +
    `<i class="rbr-light rbr-light-set"></i>` +
    `<i class="rbr-light rbr-light-go"></i>` +
    `</span>`
  );
}
