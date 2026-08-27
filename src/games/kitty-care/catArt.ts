/**
 * 萌猫小屋 · 猫的画皮（1.2 从 `index.ts` 抽出来）。
 *
 * 一套手画的 SVG 线稿，换毛色就是新室友；表情靠 `data-face` 切换，
 * 呼吸起伏与尾巴摆动是纯 CSS 循环动画（`prefers-reduced-motion` 里全部关掉）。
 * **完全原创的圆脸小猫，不参考任何现成形象，也不出现任何商标。**
 */
import type { CatFace } from "./cat";
import type { CAT_CREW } from "./levels";

export type Crew = (typeof CAT_CREW)[number];

/**
 * 画一只圆滚滚的小猫。
 * 五种表情共用同一张脸：睁眼 / 弯眼 / 半闭眼 / 平耳，外加一个纸箱，
 * 由外层的 `data-face` 决定谁露面（见 `styles.ts`）。
 */
export function catSvg(crew: Crew): string {
  const { coat, line, ear, belly, paw } = crew;
  return `
<svg viewBox="0 0 220 230" class="ktc-cat-svg" role="img" aria-label="圆滚滚的小猫${crew.name}">
  <g class="ktc-tail-wrap">
    <path class="ktc-tail" d="M180 152 q36 -4 32 -40 q-2 -18 -20 -18"
      stroke="${coat}" stroke-width="15" fill="none" stroke-linecap="round"/>
    <path d="M204 122 q4 -10 -4 -20" stroke="${line}" stroke-width="5"
      fill="none" stroke-linecap="round"/>
  </g>
  <g class="ktc-body">
    <ellipse cx="108" cy="148" rx="64" ry="48" fill="${coat}"/>
    <path d="M52 132 q12 8 8 22" stroke="${line}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M166 132 q-12 8 -8 22" stroke="${line}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="108" cy="160" rx="34" ry="26" fill="${belly}"/>
    <ellipse cx="84" cy="192" rx="15" ry="9" fill="${paw}"/>
    <ellipse cx="132" cy="192" rx="15" ry="9" fill="${paw}"/>
  </g>
  <g class="ktc-head">
    <g class="ktc-ears-up">
      <path d="M60 54 L72 14 L96 44 Z" fill="${coat}"/>
      <path d="M68 47 L76 26 L88 41 Z" fill="${ear}"/>
      <path d="M160 54 L148 14 L124 44 Z" fill="${coat}"/>
      <path d="M152 47 L144 26 L132 41 Z" fill="${ear}"/>
    </g>
    <g class="ktc-ears-flat">
      <path d="M58 58 L36 36 L92 46 Z" fill="${coat}"/>
      <path d="M62 54 L48 43 L82 48 Z" fill="${ear}"/>
      <path d="M162 58 L184 36 L128 46 Z" fill="${coat}"/>
      <path d="M158 54 L172 43 L138 48 Z" fill="${ear}"/>
    </g>
    <circle cx="110" cy="74" r="52" fill="${coat}"/>
    <path d="M98 26 q2 10 0 15" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M110 24 q2 11 0 17" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M122 26 q2 10 0 15" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="ktc-eyes-open">
      <circle cx="88" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="90.6" cy="69.4" r="2.6" fill="#fff"/>
      <circle cx="132" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="134.6" cy="69.4" r="2.6" fill="#fff"/>
    </g>
    <g class="ktc-eyes-happy">
      <path d="M79 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M123 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    </g>
    <g class="ktc-eyes-sleepy">
      <path d="M79 74 q9 7 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M123 74 q9 7 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    </g>
    <ellipse cx="72" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <ellipse cx="148" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <path d="M105 84 q5 -4 10 0 l-5 6 z" fill="#e6707f"/>
    <path class="ktc-mouth" d="M102 93 q4 5 8 0 q4 5 8 0"
      stroke="#3d2b1f" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse class="ktc-mouth-open" cx="110" cy="96" rx="7" ry="8" fill="#b3564f"/>
    <g stroke="${line}" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M56 82 q-14 -3 -24 -8"/><path d="M57 92 q-14 1 -25 0"/>
      <path d="M164 82 q14 -3 24 -8"/><path d="M163 92 q14 1 25 0"/>
    </g>
    <g class="ktc-acc ktc-acc-bow">
      <path d="M132 18 l-14 9 l14 9 z" fill="#ff6b81"/>
      <path d="M160 18 l14 9 l-14 9 z" fill="#ff6b81"/>
      <circle cx="146" cy="27" r="6" fill="#ff8fa3"/>
    </g>
    <g class="ktc-acc ktc-acc-hat">
      <path d="M78 34 q32 -34 64 0 q-32 12 -64 0 z" fill="#ffd23f"/>
      <circle cx="110" cy="8" r="8" fill="#ff6b81"/>
      <rect x="74" y="30" width="72" height="10" rx="5" fill="#f4a259"/>
    </g>
    <g class="ktc-acc ktc-acc-tie">
      <path d="M96 118 l-16 10 l16 10 z" fill="#4dabf7"/>
      <path d="M124 118 l16 10 l-16 10 z" fill="#4dabf7"/>
      <circle cx="110" cy="128" r="7" fill="#74c0fc"/>
    </g>
    <g class="ktc-acc ktc-acc-scarf">
      <path d="M72 114 q38 22 76 0 l-3 15 q-35 18 -70 0 z" fill="#69db7c"/>
      <rect x="96" y="122" width="14" height="34" rx="6" fill="#51cf66"/>
      <rect x="96" y="150" width="14" height="8" rx="3" fill="#40c057"/>
    </g>
  </g>
  <g class="ktc-box">
    <path d="M28 150 l182 0 l-12 74 l-158 0 z" fill="#e0b487"/>
    <path d="M28 150 l182 0 l-14 18 l-154 0 z" fill="#f0cba2"/>
    <path d="M74 176 q10 -12 20 0" stroke="#c69463" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M126 176 q10 -12 20 0" stroke="#c69463" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M92 140 L100 116 L114 136 Z" fill="${coat}"/>
    <path d="M132 140 L124 116 L110 136 Z" fill="${coat}"/>
    <circle cx="102" cy="150" r="4" fill="#3d2b1f"/>
    <circle cx="124" cy="150" r="4" fill="#3d2b1f"/>
  </g>
</svg>`;
}

/** 把表情写到元素上（CSS 按 data-face 决定哪一组五官露面） */
export function setFace(el: { setAttribute(name: string, value: string): void }, face: CatFace): void {
  el.setAttribute("data-face", face);
}

/** 飘心：完成一件事时从猫身上冒出来的那几颗（reduced-motion 下调用方不放） */
export const HEARTS = ["💗", "💕", "💖"] as const;
