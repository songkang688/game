/**
 * 音乐星星 · 共用界面零件（1.2 新增）。
 *
 * 三件事被抽到这里，跟弹关、四种新玩法与自由弹奏沙盒共用：
 *
 *  1. **星星键盘**——按 `pointerdown` / `pointerup` 走多点触控，
 *     每根手指的 `pointerId` 独立记录；音越高星星摆得越靠上，
 *     按下发光并下沉 4px，发声与视觉在同一帧里做完；
 *  2. **声音设置条**——静音、音量（默认 0.35、上限 0.6）、三种音色、慢速练习倍率；
 *  3. **节拍条与星座连线**——`prefers-reduced-motion` 时节拍条改成逐格跳动、星座不做动画。
 *
 * CSS 类名一律 `mst-` 前缀，样式跟着组件走，不进 `src/styles.css`。
 */
import { prefersReducedMotion, keyLayout, layoutFits, KEY_MIN_GAP_PX, type KeyLayout } from "./runtime";
import { SPEEDS, speedLabel } from "./practice";
import { SCORE_MIN_FONT_PX, type ScoreGlyph } from "./notation";
import { TIMBRES, VOLUME_MAX, type StarSynth } from "./synth";
import { pitchOffsetPx } from "./tuning";
import { DUET_MIN_GAP_PX } from "./touch";
import { HALO_RATIO, haloBackground, starClipPolygon, starSvg } from "../../art/kit/glowStar";
import { METEOR_MS, RING_MS } from "./fx";
import {
  METEOR_TAIL,
  NIGHT_BOTTOM,
  NIGHT_TOP,
  WAVE_RING,
  choiceStarGapPx,
  jellyKeyStyle,
  noteColorByMidi,
  parseIntervalChoice,
  skyStageUri,
} from "./starTheme";

/** `.mst-wrap` 左右内边距合计 */
export const WRAP_PADDING_X = 20;
/** `.mst-sky` 的最大宽度（再宽星星就散得看不出高低了） */
export const SKY_MAX_PX = 360;

/** L-1(trio-r7):矮横屏里「音越高摆越上」的抬升量,60 → 28(高低关系与热区不变) */
export const SHORT_RISE_PX = 28;

/**
 * 星星键盘的可用宽度。老写法把 360 直接写死在 `createStarBoard` 里、从不问真实屏宽，
 * 于是 320px 的老机器上算出来的键排比屏幕还宽，两端的键整个滑出去
 * （测试员 W5-B-03）。这里按真实屏宽减掉 `.mst-wrap` 的左右内边距，再按 `.mst-sky`
 * 的上限夹一次。写成纯函数，单测直接喂屏宽。
 */
export function boardWidth(viewportWidth?: number): number {
  const raw =
    typeof viewportWidth === "number" && viewportWidth > 0
      ? viewportWidth
      : (globalThis as { innerWidth?: number }).innerWidth;
  const vw = typeof raw === "number" && raw > 0 ? raw : SKY_MAX_PX + WRAP_PADDING_X;
  return Math.max(200, Math.min(SKY_MAX_PX, Math.floor(vw - WRAP_PADDING_X)));
}

/**
 * 简谱视奏关在 360×720 上实测的内容高度，以及舞台真正看得见的那一段
 * （测试员 W5-B-01：多出来的 123px 被 `.game-stage{overflow:hidden}` 直接切掉，
 * 「哆」键的键心正好压在裁切线上，点不着）。
 */
export const SCORE_LEVEL_CONTENT_PX = 741;
export const STAGE_VISIBLE_AT_720_PX = 618;

/** 「矮屏」的门槛 */
export const SHORT_SCREEN_PX = 720;

/** 触屏可点元素的最小边长 */
export const CHIP_MIN_PX = 44;

/** 各处竖向尺寸的常规值（基准样式与矮屏样式共用这一份，不许各写各的） */
export const BASE_SIZES = {
  wrapPad: 14,
  wrapGap: 10,
  msg: 26,
  dots: 16,
  sky: 150,
  face: 44,
  bar: 56,
  scorePad: 12,
} as const;

/** 矮屏上逐项收一档之后的值 */
export const SHORT_SIZES = {
  wrapPad: 8,
  wrapGap: 5,
  msg: 20,
  dots: 12,
  sky: 104,
  face: 30,
  bar: 44,
  scorePad: 8,
} as const;

/**
 * 每一项在一屏里出现几次。
 *
 * `wrapGap` 原来写的是 6，复审时按真实 DOM 数下来是**最多 3**——`.mst-wrap` 的
 * `gap` 只作用在它自己的直接子节点之间，而 360×720 上各关实测只有 3~4 个可见直接子节点
 * （第 1/100/122/150 关 4 个 = 3 条缝，第 188 关 3 个 = 2 条缝）。多算的那 3 条缝
 * 把这一档的账面收益从 117px 抬到了 132px，正好越过「盖得住 123px」那条线。
 * 按实测数改回 3，这一档就是盖不住——真正兜住的是 `fitIntoStage()` 的运行期钳位。
 * 两边分工写清楚，别再靠一个虚高的数字自我安慰。
 */
const TRIM_TIMES: Record<keyof typeof BASE_SIZES, number> = {
  wrapPad: 2,
  wrapGap: 3,
  msg: 1,
  dots: 1,
  sky: 1,
  face: 1,
  bar: 1,
  scorePad: 2,
};

/**
 * 舞台真正看得见的那一段，从 `selfTop` 往下还剩多少像素。
 *
 * `clipperBottoms` 是所有会裁掉内容的祖先的下沿——取最小的那个，因为只要有一层裁，
 * 再往下就看不见了。一层都没有（比如用例里的裸节点）就返回 `Infinity`，表示不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`（平台文件，禁改），不减这一刀就白多算 4px
 * ——真机 360×720 上多算的量正好等于超出的量，钳是钳了，`canScroll` 还是 0。
 * 量不出宽度（测试桩 / 老浏览器）就当没有，绝不把可视段算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/**
 * 把本款的壳钳进「舞台看得见的那一段」，钳不下就让它自己滚。
 *
 * 为什么不能只靠下面矮屏那一档里的 `max-height:100%`：百分比要有一个**定高**的父级
 * 才算得出来，而壳层这条链上 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的 auto 高
 * ——它们自己先长到内容那么高，`100%` 于是等于内容自己的高度，永远钳不住。
 * 真机实测 360×640 第 188 关：`.mst-wrap` 高 416、舞台只看得见 362，
 * `scrollHeight === clientHeight`（`canScroll` 为 0），声音设置栏那三颗芯片
 * `elementFromPoint` 一律返回 null。真正定高的那一层是 `.game-stage`（平台文件，
 * 交给窗口1），本款够不着它的 CSS，但够得着它的**盒子**——量一次下沿，
 * 把像素值写成自己的 `max-height` 就成了。
 *
 * 只在真的装不下时才写 `max-height` / `overflow-y`，装得下就把两样都还回去。
 * （这段和 `shape-kingdom/draw.ts` 里那份是同一套做法，两款各存一份是有意的：
 * 抽成共用文件得放到 `src/games/` 根上，那是跨窗口的共用目录，本档不许动。）
 */
export function fitIntoStage(el: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = el.ownerDocument?.defaultView ?? null;
  const measurable = typeof el.getBoundingClientRect === "function" && !!view;
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次钳出来的值还原，不然量到的是钳完的高度，越量越小
    el.style.maxHeight = "";
    el.style.overflowY = "";
    const bottoms: number[] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = view.getComputedStyle(p);
      const oy = cs.overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") {
        bottoms.push(clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
      }
    }
    const room = visibleRoomPx(el.getBoundingClientRect().top, bottoms);
    if (!Number.isFinite(room) || room <= 0) return;
    if (el.scrollHeight <= room + 1) return;
    el.style.maxHeight = `${Math.floor(room)}px`;
    el.style.overflowY = "auto";
  };
  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
    },
  };
}

/** 矮屏样式一共替这一屏省下多少竖向像素 */
export function shortScreenSavingPx(): number {
  let sum = 0;
  for (const k of Object.keys(BASE_SIZES) as Array<keyof typeof BASE_SIZES>) {
    sum += (BASE_SIZES[k] - SHORT_SIZES[k]) * TRIM_TIMES[k];
  }
  return sum;
}

export const MST_CSS = `
.mst-wrap{min-height:420px;position:relative;display:flex;flex-direction:column;align-items:center;gap:${BASE_SIZES.wrapGap}px;
  padding:${BASE_SIZES.wrapPad}px 10px;box-sizing:border-box;border-radius:16px;width:100%;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:none;}
.mst-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
/* 1.3：分数 / 连击徽章卡片化——夜空色小卡 + 星轨色内描边（文本与热区一字不动） */
.mst-badge{font-size:14px;font-weight:800;color:#fff;border-radius:999px;padding:5px 12px;
  background:linear-gradient(180deg,#2c3c72,#22305c);
  box-shadow:inset 0 0 0 1px rgba(180,200,255,.28),0 2px 6px rgba(10,16,40,.35);}
.mst-badge-listen{background:#ffe066;color:#3b2a00;animation:mst-listen 1s ease-in-out infinite;}
@keyframes mst-listen{0%,100%{opacity:1}50%{opacity:.55}}
.mst-msg{min-height:${BASE_SIZES.msg}px;font-size:17px;font-weight:800;color:#ffe066;text-align:center;line-height:1.4;}
.mst-dots{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:${BASE_SIZES.dots}px;}
/* 1.3：音符点升级成发光五角星——盒子仍是 14px（360px 上最小可辨），
   星形走 clip-path（几何来自 art-kit 的 glowStar），发光走 drop-shadow（跟着剪影走）。
   颜色走 currentColor：弹对的音由渲染层按音高写彩虹色，没弹到的一律暗金，不泄旋律。 */
.mst-dot{width:14px;height:14px;color:#ffe066;background:currentColor;opacity:.32;
  clip-path:${starClipPolygon()};filter:drop-shadow(0 0 3px currentColor);
  transition:opacity .2s,transform .2s;}
.mst-dot-on{opacity:1;transform:scale(1.25);filter:drop-shadow(0 0 6px currentColor);}
/* 当前拍脉动放大 1.15（时长由渲染层按既有节拍时钟内联；reduced 档改常亮加描边） */
.mst-dot-cur{opacity:.9;animation:mst-dot-pulse .6s ease-in-out infinite alternate;}
@keyframes mst-dot-pulse{from{transform:scale(1)}to{transform:scale(1.15)}}
/* miss 只是轻轻眨眼（缩 0.9 回弹），不批评 */
.mst-dot-blink{animation:mst-dot-blink 260ms ease-out;}
@keyframes mst-dot-blink{0%{transform:scale(1)}45%{transform:scale(.9)}100%{transform:scale(1)}}
.mst-dot-long{width:26px;border-radius:8px;clip-path:none;}
.mst-dot-perfect{background:#8ce99a;color:#8ce99a;opacity:1;}
.mst-dot-good{background:#ffe066;color:#ffe066;opacity:1;}
.mst-dot-ok{background:#ffa94d;color:#ffa94d;opacity:1;}
.mst-dot-miss{background:#ffffff55;color:#fff;opacity:.7;}

/* max-width 要跟容器一起夹：沙盒把键盘装在一个 shrink-to-fit 的空 div 里，
   那种盒子的宽度取自内容的 max-content——键排有多宽它就有多宽，一路撑到
   ${SKY_MAX_PX}px 为止，320px 的机器上整块星空于是探到舞台外面去，
   横向滚动再怎么滚也把两端的键滚不回可视区（测试员 W5-B-03 复现 B）。 */
.mst-sky{position:relative;width:100%;max-width:min(${SKY_MAX_PX}px,100%);min-height:${BASE_SIZES.sky}px;}
/* 1.3：星空舞台——夜空纵向渐变垫底，五线谱星轨 + 星座谱号 + 背景细星是一张程序化
   SVG data-URI（starTheme.skyStageUri，无位图）。走 ::before 伪元素：DOM 一个节点
   不加（星座 SVG 仍是 .mst-sky 的第一个孩子），也天生接不到指针。 */
.mst-sky::before{content:"";position:absolute;inset:0;border-radius:14px;
  background:${skyStageUri()},linear-gradient(${NIGHT_TOP},${NIGHT_BOTTOM});
  background-size:100% 100%;pointer-events:none;}
/* 沙盒的键盘宿主：撑满可用宽度，不许 shrink-to-fit 到内容的 max-content */
.mst-sb-keys{width:100%;min-width:0;display:flex;justify-content:center;}
.mst-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;
  transition:opacity .5s ease;filter:drop-shadow(0 0 4px #fff59b88);}
.mst-lines-on{opacity:1;}
/* 结算星座连线逐段点亮（每段 320ms、错峰 160ms ≈ 整条 1.2s；reduced 一次性全亮） */
.mst-lines-seg{stroke-dasharray:1;stroke-dashoffset:1;animation:mst-seg .32s ease-in-out forwards;}
@keyframes mst-seg{to{stroke-dashoffset:0}}
.mst-keys{position:relative;display:flex;justify-content:center;align-items:flex-end;
  min-height:${BASE_SIZES.sky}px;width:100%;}
/* 键排比可用宽度还宽时（七声音阶 8 个键就是）改成横向可滚 */
.mst-keys-scroll{overflow-x:auto;justify-content:flex-start;touch-action:pan-x;
  scrollbar-width:thin;padding-bottom:4px;}
/* 滚起来的那一档里，键自己也得让出横向手势：键身 44px、缝只有 4px，
   要是键还挂着 touch-action:none，一根手指落哪儿都在键上，这一行就**滚不动**，
   「哆」和「高哆」等于还是按不到。按下去出声照旧走 pointerdown，
   手指真的横着划走时浏览器补一个 pointercancel，音会正常停。 */
.mst-keys-scroll .mst-star{flex:0 0 auto;touch-action:pan-x;}
/* 1.3 果冻键：音色渐变 + 顶光 + 2px 描边全按键内联（jellyKeyStyle，inset box-shadow
   不占盒子）；这里只写共有的圆角与过渡——键的宽高仍由 keyLayout 内联，热区零改动。 */
.mst-star{border:none;background:transparent;padding:0;cursor:pointer;font-family:inherit;
  position:relative;border-radius:16px;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;
  transition:transform .12s ease,filter .12s ease;touch-action:none;}
.mst-face{font-size:${BASE_SIZES.face}px;line-height:1;filter:grayscale(.55) brightness(.75);
  position:relative;display:inline-flex;align-items:center;justify-content:center;
  transition:filter .12s ease,transform .12s ease,text-shadow .12s ease;}
/* 星底的径向光晕：直径 2.2em 随字号缩放，颜色按音色内联；纯装饰不接指针 */
.mst-halo{position:absolute;left:50%;top:50%;width:${HALO_RATIO}em;height:${HALO_RATIO}em;
  transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;}
.mst-name{font-size:18px;font-weight:800;color:#c5cff3;text-shadow:0 1px 2px rgba(16,22,54,.6);}
.mst-star.mst-lit .mst-face{filter:drop-shadow(0 0 10px #fff59b);transform:scale(1.2);}
.mst-star.mst-lit .mst-name{color:#fff;}
.mst-star.mst-down{transform:translateY(3px);}
.mst-star.mst-down .mst-face{filter:drop-shadow(0 0 12px #fff9d6);}
.mst-star.mst-hint .mst-face{filter:none;animation:mst-twinkle 1s infinite;}
.mst-star[disabled]{cursor:default;}
@keyframes mst-twinkle{0%,100%{transform:scale(1)}50%{transform:scale(1.16);filter:drop-shadow(0 0 8px #fff59b)}}
/* 按下从键顶升起的小音符星：400ms 渐隐，纯装饰不接指针（reduced 档整个不生成） */
.mst-rise{position:absolute;left:50%;top:-4px;transform:translate(-50%,0);line-height:0;
  filter:drop-shadow(0 0 6px currentColor);animation:mst-rise .4s ease-out forwards;pointer-events:none;}
@keyframes mst-rise{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,-20px)}}

.mst-bar{position:relative;width:100%;max-width:${SKY_MAX_PX}px;height:${BASE_SIZES.bar}px;border-radius:14px;
  background:#00000033;overflow:hidden;}
.mst-bar-track{position:absolute;top:0;left:0;height:100%;will-change:transform;}
.mst-bar-tick{position:absolute;top:12px;height:32px;border-radius:8px;background:#ffffff55;}
.mst-bar-tick.mst-bar-long{background:#ffffff80;}
.mst-bar-tick.mst-bar-hit{background:#8ce99a;}
.mst-bar-tick.mst-bar-late{background:#ffa94d;}
.mst-bar-line{position:absolute;top:4px;bottom:4px;width:4px;border-radius:2px;background:#ffe066;
  box-shadow:0 0 12px #ffe06699;}

/* 1.3：简谱区搬上星空舞台——夜空渐变垫底 + 同一张星轨/谱号 SVG 当背景；
   字形结构（数字/八度点/时值线）与字号一字不动，乐理零改动。 */
.mst-score{font-size:${SCORE_MIN_FONT_PX + 4}px;font-weight:900;color:#fff;
  background:${skyStageUri()},linear-gradient(180deg,${NIGHT_TOP},${NIGHT_BOTTOM});
  background-size:100% 100%;box-shadow:inset 0 0 0 1px rgba(180,200,255,.3);
  border-radius:14px;padding:${BASE_SIZES.scorePad}px 14px;text-align:center;line-height:1;
  display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.mst-glyph{position:relative;display:inline-flex;flex-direction:column;align-items:center;
  min-width:${SCORE_MIN_FONT_PX}px;}
.mst-glyph-dots{font-size:13px;line-height:8px;height:10px;letter-spacing:2px;}
.mst-glyph-num{font-size:${SCORE_MIN_FONT_PX + 4}px;line-height:1.1;}
.mst-glyph-under{height:4px;width:70%;border-top:3px solid currentColor;}
.mst-glyph.mst-cur .mst-glyph-num{color:#ffe066;text-shadow:0 0 14px #ffe06699;}

.mst-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;}
.mst-btn{min-height:44px;padding:8px 16px;font-size:16px;font-weight:800;color:#1b2a5e;border:none;
  cursor:pointer;border-radius:999px;background:#ffe066;box-shadow:0 4px 0 #d9b800;font-family:inherit;
  transition:transform .1s,opacity .2s;}
.mst-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #d9b800;}
.mst-btn:disabled{opacity:.4;cursor:default;}
/* 触屏底线 44px：这批芯片（自由弹奏入口、静音、音量、音色、练习速度）原来是 38px，
   本档五款里唯一一批不到底线的热区，档A 那边同一条规矩已经在自己五款上落过一遍。
   只抬高不动配色圆角；inline-flex 居中，免得抬高之后文字贴着上边。 */
.mst-chip{min-height:${CHIP_MIN_PX}px;padding:6px 12px;font-size:14px;font-weight:800;border:none;cursor:pointer;
  border-radius:999px;background:#ffffff2b;color:#fff;font-family:inherit;
  display:inline-flex;align-items:center;justify-content:center;}
.mst-chip.mst-chip-on{background:#fff;color:#1b2a5e;}
/* 1.3 果冻鼓：三停渐变 + 顶光 + inset 描边——盒子几何与热区零改动 */
.mst-drum{min-width:120px;min-height:88px;border:none;border-radius:20px;cursor:pointer;font-family:inherit;
  font-size:18px;font-weight:900;color:#3b2a00;
  background:linear-gradient(180deg,rgba(255,255,255,.35) 0%,rgba(255,255,255,0) 35%),
    linear-gradient(180deg,#fff0a8 0%,#ffe066 55%,#eec53d 100%);
  box-shadow:0 5px 0 #d9b800,inset 0 0 0 2px #e3bd25,inset 0 -2px 0 #d9b800;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:none;}
.mst-drum:active{transform:translateY(3px);
  box-shadow:0 2px 0 #d9b800,inset 0 0 0 2px #e3bd25,inset 0 -2px 0 #d9b800;}
.mst-drum-face{font-size:32px;}
.mst-drum.mst-lit{background:#fff3bf;box-shadow:0 5px 0 #d9b800,0 0 18px #ffe06699,
  inset 0 0 0 2px #e3bd25,inset 0 -2px 0 #d9b800;}
.mst-choices{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
/* 1.3 音程选项做成琴键小卡：迷你琴键底 + 上下两颗小星按音程距离摆位（距离由题目
   文案映射，乐理与选项文本零改动）；热区 56px 与字号只增不减。 */
.mst-choice{min-width:108px;min-height:56px;border:none;border-radius:18px;cursor:pointer;font-family:inherit;
  font-size:18px;font-weight:900;color:#1b2a5e;
  background:linear-gradient(180deg,#ffffff 0%,#eef2ff 70%,#dde4fb 100%);
  box-shadow:0 4px 0 #ffffff5c;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:5px 12px;}
.mst-choice:active{transform:translateY(3px);box-shadow:0 1px 0 #ffffff5c;}
.mst-choice.mst-bad{opacity:.45;}
.mst-choice-stars{position:relative;width:22px;height:44px;flex:0 0 auto;border-radius:6px;
  background:linear-gradient(180deg,#f4f7ff,#dfe6ff);box-shadow:inset 0 0 0 1px #b9c6f2;
  pointer-events:none;}
.mst-choice-star{position:absolute;width:10px;height:10px;margin-left:-5px;
  background:#f7b733;clip-path:${starClipPolygon()};filter:drop-shadow(0 0 3px #ffd93d);}
.mst-choice-label{font-size:16px;font-weight:900;}
/* 1.3 节奏特效层：命中音波环两圈（240ms 扩散、第二圈错 80ms）、连击流星（800ms
   一次性）、连击/结算星空渐亮。整层 pointer-events:none，绝不挡按键。 */
.mst-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:16px;
  transition:background .8s ease;}
.mst-fx-bright{background:radial-gradient(circle at 50% 28%,rgba(255,246,214,.16),rgba(255,246,214,0) 72%);}
.mst-ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid ${WAVE_RING};
  border-radius:50%;opacity:.5;animation:mst-ring ${RING_MS}ms ease-out forwards;}
@keyframes mst-ring{from{transform:scale(1);opacity:.5}to{transform:scale(1.8);opacity:0}}
.mst-meteor{position:absolute;top:14%;left:-24%;width:64px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,rgba(255,246,214,0),${METEOR_TAIL});
  animation:mst-meteor ${METEOR_MS}ms linear forwards;}
@keyframes mst-meteor{from{transform:translate(0,0) rotate(-16deg);opacity:1}
  to{transform:translate(620px,180px) rotate(-16deg);opacity:0}}
/* 1.3 录音片段的音符胶带条：夜空色小条 + 波形微缩（从片段音符只读推导）+ 圆钮播放；
   数据结构与按钮行为一字不动，胶带条只是壳。 */
.mst-clip{background:linear-gradient(180deg,#2c3c72,#233158);border-radius:12px;padding:6px 10px;
  box-shadow:inset 0 0 0 1px rgba(180,200,255,.25);}
.mst-clip-wave{display:inline-flex;align-items:flex-end;gap:2px;height:16px;padding:0 4px;
  pointer-events:none;}
.mst-clip-bar{width:3px;border-radius:2px;background:rgba(180,200,255,.8);}
.mst-clip-play{border-radius:999px;background:#ffe066;color:#3b2a00;box-shadow:0 2px 0 #d9b800;}
.mst-star:focus-visible,.mst-btn:focus-visible,.mst-chip:focus-visible,
.mst-drum:focus-visible,.mst-choice:focus-visible{outline:3px solid #fff;outline-offset:3px;}
@media (max-height:${SHORT_SCREEN_PX}px){
  /* 舞台是定高 + overflow:hidden（平台的 styles.css，交给窗口1），
     内容一高就被硬裁掉，而裁掉的那一截里正是过关必须按的键
     ——测试员 W5-B-01 在 360×720 上量到内容 ${SCORE_LEVEL_CONTENT_PX}px、可视只有 ${STAGE_VISIBLE_AT_720_PX}px。
     本款自己能做的两件事这里都做了：① 竖向逐项收一档；② 收完还高就在本款壳里自己滚。
     热区一个都不动：.mst-btn 的 44px、星星键盘的边长（按 keyLayout 内联）都不在这一档里。
     下面这行 max-height:100% 今天是空转的：百分比要有定高父级，而壳层这条链上
     .l99-stage / .l99-stage-wrap 都是内容撑出来的 auto 高。真正把它钳住的是
     fitIntoStage() 量出来的像素值（内联样式，优先级更高）；这行留着是等平台
     哪天给舞台链定了高就自动接上，两边不打架。 */
  .mst-wrap{min-height:0;max-height:100%;overflow-y:auto;touch-action:pan-y;
    gap:${SHORT_SIZES.wrapGap}px;padding:${SHORT_SIZES.wrapPad}px 10px;}
  /* 上面那行让**壳**能竖着滚了，可键自己还挂着 touch-action:none，于是手指落在
     键上就划不动——和第 1 轮那条横向的坑是同一个，只是换了个方向。
     真机 320×640 第 188 关要往下滚 159px 才够得着「⭐哆 / ⭐来 / ⭐咪」和
     声音设置那三颗，而键排几乎铺满这一屏，能起手划的只剩星空那 ${SHORT_SIZES.sky}px。
     所以滚得起来的这一档里，键让出**竖**这一个方向；横向那一档（七声八键的
     .mst-keys-scroll）两个方向都要，写成 pan-x pan-y。
     按下去出声照旧走 pointerdown，手指真的划走时浏览器补 pointercancel，音会正常停。
     热区一个都没动：让的是手势，不是尺寸。 */
  .mst-star{touch-action:pan-y;}
  .mst-keys-scroll .mst-star{touch-action:pan-x pan-y;}
  /* 上面那条给键身让了竖向，可 touch-action 是**沿祖先链取交集**的：
     键头上的 .mst-keys-scroll 还写着 touch-action:pan-x，
     键说「随便划」、容器说「只许横着」，取交集就是「只许横着」——
     双声部那一章（L155，键排横向可滚）于是一分都没让出来。
     真机三档真手指从键身上起手往上推两趟：320×640 / 360×640 / 320×568
     全是 scrollTop 0 → 0 → 0，而壳当时还有 51 / 51 / 123px 没滚出来。
     容器这一层也放行竖向之后，同一批手势 0 → 51 / 51 / 123，一趟推到底。
     只在这一档放：屏够高时壳没有竖向余量，基准那条 pan-x 原样留着。
     横向一分没丢，overflow-x:auto 与 pan-x 都还在（LB-13 剩下那一半）。 */
  .mst-keys-scroll{touch-action:pan-x pan-y;}
  .mst-msg{min-height:${SHORT_SIZES.msg}px;font-size:16px;}
  .mst-dots{min-height:${SHORT_SIZES.dots}px;}
  .mst-sky{min-height:${SHORT_SIZES.sky}px;}
  .mst-keys{min-height:${SHORT_SIZES.sky}px;}
  .mst-face{font-size:${SHORT_SIZES.face}px;}
  .mst-name{font-size:15px;}
  .mst-bar{height:${SHORT_SIZES.bar}px;}
  .mst-bar-tick{top:8px;height:28px;}
  .mst-score{padding:${SHORT_SIZES.scorePad}px 12px;gap:8px;}
}
/* L-1(trio-r7):915×412 一族矮横屏,滚动窗只剩 ~208px,「🔁 再听一遍」半截、
   声音设置四钮(静音/音量/音色/速度)整排折叠线下(r4 原账),孩子得靠上面那档的
   竖滚才够得着。键盘宽有 ${SKY_MAX_PX}px 上限(hostWidth 封顶),所以矮横屏切
   「徽章+键盘左 / 两条工具行右」双栏,左栏恒 ≥${SKY_MAX_PX}px 键排一个像素不裁;
   比 700px 窄的横屏机器仍走上面那档「自己滚 + 手势放行」的老路。
   只挂在关卡壳(mst-level)上:advanced 视奏台与自由弹奏沙盒的 .mst-wrap 不卷入。
   热区、keyLayout 内联尺寸、听记判定零触碰。 */
@media (max-height:500px) and (min-width:700px){
  .mst-wrap.mst-level{display:grid;max-width:none;
    grid-template-columns:minmax(${SKY_MAX_PX}px,1fr) minmax(180px,230px);
    column-gap:12px;row-gap:${SHORT_SIZES.wrapGap}px;align-items:start;justify-items:center;}
  .mst-wrap.mst-level>.mst-head{grid-column:1;grid-row:1;justify-self:stretch;}
  .mst-wrap.mst-level>.mst-sky{grid-column:1;grid-row:2;}
  .mst-wrap.mst-level>.mst-tools{grid-column:2;}
}
@media (prefers-reduced-motion:reduce){
  .mst-lines{transition:none;}
  .mst-badge-listen{animation:none;}
  .mst-star.mst-hint .mst-face{animation:none;filter:drop-shadow(0 0 8px #fff59b);}
  .mst-bar-track{transition:none;}
  /* 1.3：脉动 / 眨眼 / 音波环 / 流星 / 星座逐段动画全停；
     静态发光（drop-shadow）与彩虹映射原样保留。 */
  .mst-dot-cur{animation:none;opacity:1;
    filter:drop-shadow(0 0 5px currentColor) drop-shadow(0 0 1px #fff);}
  .mst-dot-blink{animation:none;}
  .mst-ring,.mst-meteor{display:none;}
  .mst-lines-seg{animation:none;stroke-dashoffset:0;}
  .mst-fx{transition:none;}
}
`;

/** 把本款样式挂到宿主上（每次挂载一份，随宿主一起被移除） */
export function injectCss(host: HTMLElement): void {
  const style = document.createElement("style");
  style.textContent = MST_CSS;
  host.appendChild(style);
}

// ---------------------------------------------------------------------------
// 星星键盘
// ---------------------------------------------------------------------------

export interface StarBoardNote {
  name: string;
  color: string;
}

export interface StarBoardOptions {
  /** 每颗星星的 MIDI 音高，决定发声频率与纵坐标 */
  midis: readonly number[];
  notes: readonly StarBoardNote[];
  /** 双声部关把键拉开，一根手指盖不住两个 */
  wideGap?: boolean;
  /** 可用宽度（像素），不传就量 `host`，再没有才退回按屏宽估 */
  width?: number;
  /**
   * 键盘将要挂进去的那个容器（已经在文档里）。有它就直接量它的 `clientWidth`——
   * 那才是键排真正能占的宽度。`boardWidth()` 只减得掉 `.mst-wrap` 自己的内边距，
   * 减不掉壳层顶栏、`.l99-stage` 的内边距和舞台描边，在 360px 上要多估 40–60px，
   * 于是「算着放得下、实际放不下」，键排照样探到舞台外面（测试员 W5-B-03）。
   */
  host?: HTMLElement | null;
  onDown: (index: number, pointerId: number) => void;
  onUp?: (index: number, pointerId: number) => void;
}

export interface StarBoardHandle {
  el: HTMLElement;
  buttons: HTMLButtonElement[];
  layout: KeyLayout;
  /** 键排放不放得下：放不下时键盘那一行改成横向可滚 */
  fits: boolean;
  /** 范奏播放中要禁用输入，避免误判 */
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  /** 点亮某颗星星一段时间（范奏用） */
  light(index: number, ms: number): void;
  /** 提示某颗星星（终曲一闪一闪） */
  hint(index: number, on: boolean): void;
  clearHints(): void;
  /** 把答对的音连成星座 */
  drawConstellation(seq: readonly number[]): void;
  clearConstellation(): void;
  destroy(): void;
}

/**
 * 量宿主容器的内容宽度。量不到（还没进文档、或者用例里的桩节点没有布局）就返回
 * `null`，让调用方退回 `boardWidth()` 的估算。按 `.mst-sky` 的上限夹一次，
 * 免得桌面上一行键铺得比星空还宽。
 */
export function hostWidth(host?: HTMLElement | null): number | null {
  const w = host?.clientWidth;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) return null;
  return Math.min(SKY_MAX_PX, Math.floor(w));
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createStarBoard(opts: StarBoardOptions): StarBoardHandle {
  const count = opts.midis.length;
  const minGap = opts.wideGap ? DUET_MIN_GAP_PX : KEY_MIN_GAP_PX;
  const available = opts.width ?? hostWidth(opts.host) ?? boardWidth();
  const layout = keyLayout(available, count, minGap);
  const fits = layoutFits(layout, count, available);
  const lowMidi = Math.min(...opts.midis);
  const highMidi = Math.max(...opts.midis);
  // 音越高摆得越上的抬升量:矮横屏(L-1 双栏档)收到 28px——高低关系与热区都不变,
  // 键排总高省下 32px,412px 视口里最低的哆/来两键连名字整个进屏
  // (和 keyLayout 一样只在挂载时量一次;量不到 matchMedia 的桩环境照旧 60)
  const shortViewport =
    typeof matchMedia === "function" && matchMedia("(max-height:500px)").matches;
  const rise = count > 1 ? (shortViewport ? SHORT_RISE_PX : 60) : 0;

  const sky = document.createElement("div");
  sky.className = "mst-sky";

  const lines = document.createElementNS(SVG_NS, "svg");
  lines.setAttribute("class", "mst-lines");
  lines.setAttribute("viewBox", "0 0 100 100");
  lines.setAttribute("preserveAspectRatio", "none");
  sky.appendChild(lines as unknown as Node);

  const keys = document.createElement("div");
  keys.className = fits ? "mst-keys" : "mst-keys mst-keys-scroll";
  keys.style.gap = `${layout.gap}px`;
  sky.appendChild(keys);

  let enabled = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cleanups: Array<() => void> = [];
  // 减少动效：按下不生成升起的小音符星，只保留键顶发光
  const reduced = prefersReducedMotion();

  const buttons: HTMLButtonElement[] = opts.midis.map((midi, i) => {
    const note = opts.notes[i] ?? { name: `${i + 1}`, color: "#fff" };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-star";
    btn.style.width = `${layout.width}px`;
    btn.style.minHeight = `${layout.width}px`;
    // 音越高摆得越上：让孩子看得见「高低」
    btn.style.marginBottom = `${pitchOffsetPx(midi, lowMidi, highMidi, rise)}px`;
    btn.setAttribute("aria-label", note.name);
    // 1.3：键色与音阶彩虹一致（颜色 + 位置双通道），果冻质感全按键内联——
    // 描边走 inset box-shadow，键的宽高（热区）仍由上面 keyLayout 内联，一个像素不动。
    const glow = noteColorByMidi(midi);
    const jelly = jellyKeyStyle(glow);
    btn.style.background = jelly.background;
    btn.style.boxShadow = jelly.boxShadow;
    // emoji ⭐ 升级成发光五角星：星形 SVG（1em 随字号缩放）+ 径向光晕垫底
    btn.innerHTML =
      `<span class="mst-face"><span class="mst-halo"></span>` +
      `${starSvg(BASE_SIZES.face, glow, { cssSize: "1em", className: "mst-face-star" })}</span>` +
      `<span class="mst-name">${note.name}</span>`;
    const nameEl = btn.querySelector(".mst-name") as HTMLElement | null;
    if (nameEl) nameEl.style.color = note.color;
    const haloEl = btn.querySelector(".mst-halo") as HTMLElement | null;
    if (haloEl) haloEl.style.background = haloBackground(glow);

    const down = (ev: Event): void => {
      const pe = ev as PointerEvent;
      pe.preventDefault?.();
      if (!enabled) return;
      // 发声与视觉同一帧：先落下去再回调，回调里立刻出声
      btn.classList.add("mst-down", "mst-lit");
      if (!reduced) {
        // 从键顶升起一颗小音符星，400ms 渐隐（纯装饰，不接指针；计时进 timers 统一清）
        const riseStar = document.createElement("span");
        riseStar.className = "mst-rise";
        riseStar.style.color = glow;
        riseStar.innerHTML = starSvg(14, glow, { className: "mst-rise-star" });
        btn.appendChild(riseStar);
        later(() => riseStar.remove(), 400);
      }
      try {
        btn.setPointerCapture?.(pe.pointerId);
      } catch {
        // 不支持捕获也能玩，只是滑出按钮时抬起事件会丢
      }
      opts.onDown(i, pe.pointerId ?? 0);
    };
    const up = (ev: Event): void => {
      const pe = ev as PointerEvent;
      btn.classList.remove("mst-down");
      if (!btn.classList.contains("mst-lit-hold")) btn.classList.remove("mst-lit");
      opts.onUp?.(i, pe.pointerId ?? 0);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    cleanups.push(() => {
      btn.removeEventListener("pointerdown", down);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
    });

    keys.appendChild(btn);
    return btn;
  });

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }

  return {
    el: sky,
    buttons,
    layout,
    fits,
    setEnabled(on: boolean): void {
      enabled = on;
      for (const b of buttons) b.disabled = !on;
    },
    isEnabled(): boolean {
      return enabled;
    },
    light(index: number, ms: number): void {
      const btn = buttons[index];
      if (!btn) return;
      btn.classList.add("mst-lit", "mst-lit-hold");
      later(() => btn.classList.remove("mst-lit", "mst-lit-hold"), Math.max(80, ms));
    },
    hint(index: number, on: boolean): void {
      buttons[index]?.classList.toggle("mst-hint", on);
    },
    clearHints(): void {
      for (const b of buttons) b.classList.remove("mst-hint");
    },
    drawConstellation(seq: readonly number[]): void {
      while (lines.firstChild) lines.removeChild(lines.firstChild);
      if (seq.length < 2) return;
      const step = 100 / Math.max(1, count);
      const x = (i: number): number => step * (i + 0.5);
      const y = (i: number): number => {
        const midi = opts.midis[i] ?? lowMidi;
        const span = highMidi - lowMidi;
        const t = span > 0 ? (midi - lowMidi) / span : 0.5;
        return 82 - t * 52;
      };
      for (let k = 1; k < seq.length; k++) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", `${x(seq[k - 1])}`);
        line.setAttribute("y1", `${y(seq[k - 1])}`);
        line.setAttribute("x2", `${x(seq[k])}`);
        line.setAttribute("y2", `${y(seq[k])}`);
        line.setAttribute("stroke", "#fff59b");
        line.setAttribute("stroke-width", "0.8");
        line.setAttribute("stroke-linecap", "round");
        // 1.3：结算星座逐段点亮成一笔画（每段 320ms、错峰 160ms；reduced 一次性全亮）
        line.setAttribute("class", "mst-lines-seg");
        line.setAttribute("pathLength", "1");
        (line as unknown as HTMLElement).style.animationDelay = `${(k - 1) * 160}ms`;
        lines.appendChild(line as unknown as Node);
      }
      lines.setAttribute("class", "mst-lines mst-lines-on");
    },
    clearConstellation(): void {
      while (lines.firstChild) lines.removeChild(lines.firstChild);
      lines.setAttribute("class", "mst-lines");
    },
    destroy(): void {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const off of cleanups) off();
      cleanups.length = 0;
      sky.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 声音设置条：静音 / 音量 / 音色 / 慢速练习
// ---------------------------------------------------------------------------

export interface AudioBarOptions {
  synth: StarSynth;
  /** 不给就不显示慢速练习（简谱视奏台不需要） */
  onSpeed?: (speed: number) => void;
  speed?: number;
  onChange?: () => void;
}

export interface AudioBarHandle {
  el: HTMLElement;
  refresh(): void;
  destroy(): void;
}

export function createAudioBar(opts: AudioBarOptions): AudioBarHandle {
  const { synth } = opts;
  const bar = document.createElement("div");
  bar.className = "mst-tools";
  const cleanups: Array<() => void> = [];

  function chip(label: string, onClick: () => void, title?: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-chip";
    btn.textContent = label;
    if (title) btn.setAttribute("aria-label", title);
    const fn = (): void => {
      synth.unlock();
      onClick();
    };
    btn.addEventListener("click", fn);
    cleanups.push(() => btn.removeEventListener("click", fn));
    bar.appendChild(btn);
    return btn;
  }

  const muteBtn = chip("🔊", () => {
    synth.toggleMuted();
    refresh();
    opts.onChange?.();
  }, "静音开关");

  const volBtn = chip("🔉 音量", () => {
    // 三档循环：轻 0.2 → 常 0.35 → 大 0.6（上限，不许再往上）
    const steps = [0.2, 0.35, VOLUME_MAX];
    const cur = steps.findIndex((s) => Math.abs(s - synth.volume) < 0.02);
    synth.setVolume(steps[(cur + 1) % steps.length]);
    refresh();
    opts.onChange?.();
  }, "音量大小");

  const timbreBtn = chip("🔔", () => {
    const i = TIMBRES.findIndex((t) => t.id === synth.timbre.id);
    synth.setTimbre(TIMBRES[(i + 1) % TIMBRES.length].id);
    refresh();
    opts.onChange?.();
  }, "换个音色");

  let speedBtn: HTMLButtonElement | null = null;
  if (opts.onSpeed) {
    speedBtn = chip(speedLabel(opts.speed ?? 1), () => {
      const cur = SPEEDS.indexOf(opts.speed ?? 1);
      const next = SPEEDS[(cur + 1) % SPEEDS.length];
      opts.speed = next;
      opts.onSpeed?.(next);
      refresh();
    }, "练习速度");
  }

  function refresh(): void {
    muteBtn.textContent = synth.muted ? "🔇 已静音" : "🔊 有声音";
    muteBtn.classList.toggle("mst-chip-on", synth.muted);
    const level = synth.volume >= VOLUME_MAX - 0.01 ? "大" : synth.volume <= 0.22 ? "轻" : "常";
    volBtn.textContent = `🔉 音量${level}`;
    timbreBtn.textContent = `🔔 ${synth.timbre.name}`;
    if (speedBtn) speedBtn.textContent = `⏱️ ${speedLabel(opts.speed ?? 1)}`;
  }

  refresh();

  return {
    el: bar,
    refresh,
    destroy(): void {
      for (const off of cleanups) off();
      cleanups.length = 0;
      bar.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 音程选项卡（1.3 视觉升级）：琴键小卡 + 上下两星示意距离
// ---------------------------------------------------------------------------

/** 音程卡示意区的高度与小星边长（`.mst-choice-stars` / `.mst-choice-star` 的同一份数） */
export const CHOICE_DIAGRAM_H = 44;
export const CHOICE_STAR_PX = 10;

/**
 * 把一颗音程选项按钮装成琴键小卡：迷你琴键底上摆两颗小星，
 * 纵向距离由选项文案（题目数据）经 `parseIntervalChoice` → `choiceStarGapPx`
 * 只读映射——选项文本原样进 `.mst-choice-label`，乐理与判定零改动。
 * 先弹的音画在左边（35%），后弹的在右边（65%）；往上/往下决定谁高谁低。
 */
export function buildIntervalChoiceCard(btn: HTMLElement, label: string): void {
  const shape = parseIntervalChoice(label);
  const gap = shape.dir === 0 ? 0 : choiceStarGapPx(shape.steps);
  const mid = CHOICE_DIAGRAM_H / 2 - CHOICE_STAR_PX / 2;
  const stars = document.createElement("span");
  stars.className = "mst-choice-stars";
  const first = document.createElement("span");
  first.className = "mst-choice-star mst-choice-star-a";
  first.style.left = "35%";
  first.style.top = `${mid + (shape.dir * gap) / 2}px`;
  const second = document.createElement("span");
  second.className = "mst-choice-star mst-choice-star-b";
  second.style.left = "65%";
  second.style.top = `${mid - (shape.dir * gap) / 2}px`;
  stars.append(first, second);
  const text = document.createElement("span");
  text.className = "mst-choice-label";
  text.textContent = label;
  btn.append(stars, text);
}

// ---------------------------------------------------------------------------
// 简谱区
// ---------------------------------------------------------------------------

/** 把一行字形渲染成简谱：数字 + 八度点 + 时值线 */
export function renderScore(host: HTMLElement, glyphs: readonly ScoreGlyph[], cursor: number): void {
  host.innerHTML = "";
  glyphs.forEach((g, i) => {
    const cell = document.createElement("div");
    cell.className = `mst-glyph${i === cursor ? " mst-cur" : ""}`;
    const above = document.createElement("div");
    above.className = "mst-glyph-dots";
    above.textContent = "·".repeat(g.dotsAbove);
    const num = document.createElement("div");
    num.className = "mst-glyph-num";
    num.textContent = g.dashes > 0 ? `${g.digit} -` : `${g.digit}`;
    const below = document.createElement("div");
    below.className = "mst-glyph-dots";
    below.textContent = "·".repeat(g.dotsBelow);
    cell.append(above, num, below);
    if (g.underlines > 0) {
      const line = document.createElement("div");
      line.className = "mst-glyph-under";
      cell.appendChild(line);
    }
    host.appendChild(cell);
  });
}

// ---------------------------------------------------------------------------
// 节拍条：横向滚动，判定线固定在中间
// ---------------------------------------------------------------------------

export interface BeatBarOptions {
  /** 每一拍的时刻（秒，音频时钟） */
  beats: readonly number[];
  /** 每一拍是不是长音 */
  longs: readonly boolean[];
  /** 现在几点（秒，音频时钟） */
  now: () => number;
  /** 一秒钟滚过多少像素 */
  pxPerSec?: number;
  width?: number;
}

/** 判定线的宽度（和 `.mst-bar-line` 的 `width` 是同一个数，改一处两处都跟着走） */
export const JUDGE_LINE_W = 4;

/** 拍块的宽度：长音宽一点，看得出「这一下要按久一点」 */
export const TICK_W_SHORT = 16;
export const TICK_W_LONG = 30;

export function tickWidthPx(long: boolean): number {
  return long ? TICK_W_LONG : TICK_W_SHORT;
}

/**
 * 拍块的左沿该摆在哪儿——**以拍点为中心**（1.2 窗口5 · 第 2 轮 · 档B）。
 *
 * 原来写的是 `left = 拍点 × pxPerSec`，也就是把**左沿**压在拍点上。轨道每秒走
 * `pxPerSec` 像素、判定线钉在 `width/2`，于是「该敲的那一刻」拍块的左沿正好压线，
 * 而它的**中心**还在判定线右边 8px（短音）/ 15px（长音）——按 150px/秒 换算就是
 * 晚 53ms / 100ms。而游戏对孩子的原话是「看着黄线走到方块的那一刻再敲」：
 * 孩子照着「方块中心对上黄线」敲，短音还在 perfect（<60ms）里，**长音直接从
 * perfect 掉到 good**。不会判 miss，但稳定吃掉一档评分——测试员 W5-B-07.2 / W5-L-21。
 *
 * **这一条只改画法。** `timing.ts` 的 `judgeTap()`（音频时钟 + 输出延迟补偿 +
 * perfect/good/ok 三档）一个字都没动——它本来就是对的，改它反而会把已经练熟的孩子打乱。
 */
export function tickLeftPx(sinceFirstSec: number, pxPerSec: number, tickWidth: number): number {
  return sinceFirstSec * pxPerSec - tickWidth / 2;
}

/**
 * 「拍块中心」与「判定线中心」在该敲的那一刻差多少像素。
 * 对齐之后必须是 0；用例拿它当守门尺，以后谁把画法改回左沿对齐都会当场红。
 */
export function tickCenterOffsetPx(width: number, tickWidth: number): number {
  const trackShift = Math.round(width / 2);
  const tickLeft = Math.round(tickLeftPx(0, 1, tickWidth));
  const tickCenter = trackShift + tickLeft + tickWidth / 2;
  const lineCenter = Math.round(width / 2 - JUDGE_LINE_W / 2) + JUDGE_LINE_W / 2;
  return tickCenter - lineCenter;
}

export interface BeatBarHandle {
  el: HTMLElement;
  start(): void;
  stop(): void;
  /** 把某一拍标成已命中（档位决定颜色） */
  mark(index: number, grade: "perfect" | "good" | "ok" | "miss"): void;
  destroy(): void;
}

export function createBeatBar(opts: BeatBarOptions): BeatBarHandle {
  const width = opts.width ?? 360;
  const pxPerSec = opts.pxPerSec ?? 150;
  const reduced = prefersReducedMotion();

  const bar = document.createElement("div");
  bar.className = "mst-bar";
  const track = document.createElement("div");
  track.className = "mst-bar-track";
  bar.appendChild(track);
  const judge = document.createElement("div");
  judge.className = "mst-bar-line";
  // 判定线也按中心对齐：`left` 是左沿，宽 JUDGE_LINE_W，中心要落在 width/2
  judge.style.left = `${Math.round(width / 2 - JUDGE_LINE_W / 2)}px`;
  bar.appendChild(judge);

  const first = opts.beats[0] ?? 0;
  const ticks: HTMLElement[] = opts.beats.map((at, i) => {
    const tick = document.createElement("div");
    tick.className = `mst-bar-tick${opts.longs[i] ? " mst-bar-long" : ""}`;
    const w = tickWidthPx(!!opts.longs[i]);
    tick.style.left = `${Math.round(tickLeftPx(at - first, pxPerSec, w))}px`;
    tick.style.width = `${w}px`;
    track.appendChild(tick);
    return tick;
  });

  let raf = 0;
  let stopped = true;
  const half = Math.round(width / 2);

  function frame(): void {
    if (stopped) return;
    const t = opts.now() - first;
    track.style.transform = `translateX(${Math.round(half - t * pxPerSec)}px)`;
    raf = requestAnimationFrame(frame);
  }

  /** 减少动效：不滚动，只把「当前是第几拍」逐格跳过去 */
  let stepTimer: ReturnType<typeof setInterval> | null = null;
  function stepFrame(): void {
    const t = opts.now();
    let idx = 0;
    for (let i = 0; i < opts.beats.length; i++) if (opts.beats[i] <= t) idx = i;
    const at = opts.beats[idx] ?? first;
    track.style.transform = `translateX(${Math.round(half - (at - first) * pxPerSec)}px)`;
  }

  return {
    el: bar,
    start(): void {
      stopped = false;
      if (reduced) {
        stepFrame();
        stepTimer = setInterval(stepFrame, 120);
      } else {
        raf = requestAnimationFrame(frame);
      }
    },
    stop(): void {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (stepTimer) clearInterval(stepTimer);
      stepTimer = null;
    },
    mark(index: number, grade): void {
      const tick = ticks[index];
      if (!tick) return;
      tick.classList.add(grade === "miss" ? "mst-bar-late" : "mst-bar-hit");
    },
    destroy(): void {
      this.stop();
      bar.remove();
    },
  };
}
