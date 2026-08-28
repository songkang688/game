/**
 * 星星消消乐 · 会下落的棋盘（DOM + 时间线）。
 *
 * 闯关的 8×8、对战与无尽的 6×6 用的都是这一个组件：
 * 它只管「怎么演」，「消什么、算什么」由调用方通过 `StageOpts` 的回调给。
 *
 * 演的顺序写死在 `beginSwap` 一路排下去的段落里，一段都不能跳：
 *   swap → (revert | boom → fall → land → 连锁回 boom) → belt → settle
 * 每一段的时长来自 `timings(reduced)`。`prefers-reduced-motion` 只是把数字压到 1 帧，
 * 段落一个不少——所以不存在「只在动画模式才复现」的 bug。
 *
 * 下落期间棋子的**视觉坐标**由 `tweenPos` 算，**逻辑坐标**早已是终值：
 * `visualRowOf(i) !== rowOf(i)` 这句话在 `fall` 段里恒成立，单测就是拿它当验收铁则的。
 */
import type { SoundName } from "../level99";
import {
  asSlide,
  planEndMs,
  planGravity,
  planRefill,
  planSwap,
  planBelt,
  prefersReducedMotion,
  timings,
  tweenPos,
  Runner,
  type FallTween,
  type Phase,
  type SlideTween,
  type Step,
  type Timings,
} from "./anim";
import {
  EMPTY,
  RAINBOW,
  refillOn,
  settleOn,
  type Cellset,
  type RoundPlan,
} from "./board";
import { gearSVG, rainbowStarSVG, STAR_STYLES, tokenSVG, type GearKind } from "./art";

export type { RoundPlan };

export interface TokenSkin {
  /** 读屏与 HUD 文案用的名字（棋盘上画的是 art.ts 的 SVG，不再渲染这个字符） */
  emoji: string;
  bg: string;
}

export interface BeltMove {
  slots: number[];
  dir: 1 | -1;
}

/** 一次出手的战果（和引擎的 `CascadeInfo` 同形） */
export interface StageCascade {
  steps: number;
  total: number;
  best: number;
}

export interface StageOpts {
  cell: Cellset;
  tokens: TokenSkin[];
  /** 强制指定「减少动态效果」（不给就读系统偏好） */
  reduced?: boolean;
  sfx?: (n: SoundName) => void;
  /** 这一格点不动（冰块 / 藤蔓 / 挡板） */
  locked?: (i: number) => boolean;
  /** 点这一格的提示语（点不动时说一句） */
  lockedSay?: (i: number) => string;
  /** 能不能试着换（false 就连交换动画都不播） */
  canSwap?: (a: number, b: number) => boolean;
  /** 换过去之后：给出第一轮要清的格子，或者要求原路弹回来 */
  afterSwap: (a: number, b: number) => RoundPlan | "revert";
  /** 连锁：稳定了就返回 null */
  round: () => RoundPlan | null;
  /** 把一轮消除真正落到盘面上（写 EMPTY、结算目标 / 冰块 / 订单…） */
  applyRound: (plan: RoundPlan, chain: number) => void;
  /** 特殊块引爆的下一波；没有就别给（返回 null 表示炸完了） */
  blast?: () => RoundPlan | null;
  /** 补一个新图案 */
  spawn: () => number;
  /** 这一步真的算数了（计步） */
  onMove?: (a: number, b: number) => void;
  /** 换不动，原路弹回来了 */
  onRevert?: (a: number, b: number) => void;
  /** 每一轮消除开始时说一句 */
  onRound?: (plan: RoundPlan, chain: number) => void;
  /** 稳定之后要转的传送带 */
  belts?: () => BeltMove[];
  applyBelt?: (b: BeltMove) => void;
  /** 全稳了：结算订单 / 胜负。整局里这是唯一允许结算的地方 */
  onSettled?: (info: StageCascade) => void;
  /**
   * 结算完了发现一步都消不动：洗一次牌。洗过返回 true，
   * 视图会把整盘重新从顶上落一遍——洗牌也不许瞬间换脸。
   */
  reshuffle?: () => boolean;
  /** 每帧画完调一次（刷新面板） */
  onPaint?: () => void;
}

// ---------------------------------------------------------------------------
// 布局（纯函数，单测直接查）
// ---------------------------------------------------------------------------

/** 每格的像素步距：`gap` 是 0，所以整格都是热区 */
export function cellPitch(boardWidth: number, cols: number): number {
  if (!Number.isFinite(boardWidth) || boardWidth <= 0 || cols <= 0) return 44;
  return boardWidth / cols;
}

/** 窄屏把棋盘往两边撑出去，好让 8 列在 360px 上每格还有 44px 以上 */
export function boardBleed(viewportWidth: number): number {
  return viewportWidth <= 420 ? 16 : 0;
}

/** 360px 上棋盘实际能用到的宽度（壳层 10px + 本游戏 6px 的内边距都撑掉） */
export function boardWidthAt(viewportWidth: number): number {
  const pad = viewportWidth <= 420 ? 6 : 10;
  return viewportWidth - 2 * 10 - 2 * pad + 2 * boardBleed(viewportWidth);
}

export const CSS = `
.mst-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFF0F7,#F3F0FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
/* 背景按关卡段换主题:粉黄晨光 → 青绿森林 → 星夜(themeClassOf 查表) */
/* 每主题再叠 1 层静态剪影饰(纯 background 多层,不加动画):晨光云影/森林树影/星夜星点 */
.mst-wrap.mst-theme-dawn{background:
  radial-gradient(ellipse 88px 30px at 20% 8%,rgba(255,255,255,.20),transparent 70%),
  radial-gradient(ellipse 66px 24px at 76% 15%,rgba(255,255,255,.17),transparent 70%),
  linear-gradient(180deg,#FFF3D6,#FFE1EE 55%,#F3E8FF);}
.mst-wrap.mst-theme-forest{background:
  radial-gradient(circle 44px at 10% 100%,rgba(44,102,70,.12),transparent 70%),
  radial-gradient(circle 58px at 50% 103%,rgba(44,102,70,.10),transparent 70%),
  radial-gradient(circle 40px at 88% 100%,rgba(44,102,70,.12),transparent 70%),
  linear-gradient(180deg,#EAF9E4,#D8F3EA 55%,#E6F3FF);}
.mst-wrap.mst-theme-night{background:
  radial-gradient(circle at 12% 6%,rgba(255,255,255,.20) 0 1px,transparent 2px),
  radial-gradient(circle at 30% 3%,rgba(255,255,255,.20) 0 1px,transparent 2px),
  radial-gradient(circle at 55% 8%,rgba(255,255,255,.20) 0 1px,transparent 2px),
  radial-gradient(circle at 76% 4%,rgba(255,255,255,.20) 0 1px,transparent 2px),
  radial-gradient(circle at 92% 9%,rgba(255,255,255,.20) 0 1px,transparent 2px),
  linear-gradient(180deg,#2E3161,#453C78 60%,#6C4E96);}
.mst-theme-night .mst-msg{color:#F0DCFF;}
.mst-theme-night .mst-seat-name{color:#E6DBFF;}
.mst-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.mst-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;color:#A66BBE;
  box-shadow:0 2px 6px rgba(180,140,220,.25);font-size:16px;white-space:nowrap;}
/* 目标条:一行可横滑的芯片,绝不换行——换行了最底行就要滚动才点得到 */
.mst-goals{display:flex;gap:6px;margin-bottom:6px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;
  scrollbar-width:none;padding-bottom:2px;}
.mst-goals::-webkit-scrollbar{display:none;}
.mst-goal{flex:0 0 auto;background:#fff;border-radius:12px;padding:4px 10px;font-weight:800;color:#8B6BAE;font-size:14px;
  box-shadow:0 2px 5px rgba(180,140,220,.2);white-space:nowrap;}
.mst-goal.mst-done{background:#E4F9E0;color:#57A05B;}
.mst-goal.mst-order{background:#FFF1DC;color:#A8762F;}
.mst-goal.mst-order.mst-done{background:#E4F9E0;color:#57A05B;}
.mst-goal.mst-boss{background:#EDEFE8;color:#6B7360;}
.mst-bar{height:10px;background:#fff;border-radius:8px;overflow:hidden;margin-bottom:6px;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.08);}
.mst-fill{height:100%;width:0%;background:linear-gradient(90deg,#FFB6D9,#C9A7F5);border-radius:8px;transition:width .3s;}
/* 棋盘衬板:星空深蓝渐变 + 内阴影凹槽感;格位淡影由 board 的分格径向渐变画 */
.mst-boardwrap{position:relative;overflow:hidden;border-radius:14px;
  background:linear-gradient(180deg,#3A3F75,#262B58 55%,#1C2148);
  box-shadow:inset 0 2px 10px rgba(8,10,32,.55),0 3px 10px rgba(70,60,130,.22);
  margin-inline:calc(-1 * var(--mst-bleed, 0px));}
.mst-boardwrap::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;
  background-image:radial-gradient(circle,rgba(255,255,255,.9) 1px,transparent 1.7px),
    radial-gradient(circle,rgba(255,255,255,.5) 1px,transparent 1.5px);
  background-size:67px 53px,41px 37px;background-position:9px 7px,27px 21px;}
/* gap 为 0:整格都是热区,360px 上 8 列每格 45px */
.mst-board{display:grid;gap:0;position:relative;}
.mst-cell{position:relative;aspect-ratio:1;border:none;background:transparent;padding:0;margin:0;cursor:pointer;
  display:block;font-family:inherit;-webkit-tap-highlight-color:transparent;}
.mst-tile{position:absolute;inset:2px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  line-height:1;overflow:hidden;box-shadow:inset 0 -2px 0 rgba(24,22,64,.10),inset 0 1px 0 rgba(255,255,255,.45);}
.mst-tile svg{width:88%;height:88%;display:block;pointer-events:none;}
/* 下落残影:一帧前的淡色块,只在 fall 段亮起(reduced 关) */
.mst-ghost{position:absolute;inset:4px;border-radius:10px;opacity:0;pointer-events:none;}
/* 机关罩层(冰晶/藤蔓/霜花/砖缝):绘制 SVG,不再是 emoji 角标 */
.mst-gear{position:absolute;inset:2px;border-radius:11px;overflow:hidden;pointer-events:none;}
.mst-gear svg{position:absolute;left:0;top:0;width:100%;height:100%;}
.mst-cell.mst-sel .mst-tile{box-shadow:0 0 0 3px #FF8FC7;}
.mst-cell.mst-cursor .mst-tile{box-shadow:0 0 0 3px #6FA8DC;}
.mst-cell.mst-ice .mst-tile{background-image:linear-gradient(160deg,rgba(214,242,255,.55),rgba(168,220,246,.45));}
.mst-cell.mst-vine .mst-tile{box-shadow:inset 0 0 0 3px #8FD08A;}
.mst-cell.mst-frost1 .mst-tile{background-image:linear-gradient(135deg,rgba(255,224,240,.66),rgba(255,224,240,.66));}
.mst-cell.mst-frost2 .mst-tile{background-image:linear-gradient(135deg,rgba(255,203,232,.88),rgba(255,203,232,.88));}
.mst-cell.mst-solid .mst-tile{background:repeating-linear-gradient(45deg,#B9A88F,#B9A88F 6px,#A5937A 6px,#A5937A 12px);
  box-shadow:inset 0 0 0 3px #8C7B63;}
/* 传送带:虚线框改流动箭头纹(reduced 静止) */
.mst-cell.mst-belt::after{content:"";position:absolute;left:4px;right:4px;bottom:3px;height:6px;border-radius:3px;
  pointer-events:none;opacity:.9;background-repeat:repeat-x;
  background-image:linear-gradient(135deg,transparent 0 25%,#8FC7E8 25% 50%,transparent 50% 100%),
    linear-gradient(45deg,transparent 0 25%,#8FC7E8 25% 50%,transparent 50% 100%);
  background-size:8px 3px,8px 3px;background-position:0 0,0 3px;
  animation:mst-flow .8s linear infinite;}
.mst-cell.mst-belt-rev::after{animation-direction:reverse;}
@keyframes mst-flow{to{background-position:8px 0,8px 3px;}}
/* 彩虹星缓慢自转(reduced 静止) */
.mst-spin{transform-origin:50% 50%;animation:mst-spin 6s linear infinite;}
@keyframes mst-spin{to{transform:rotate(360deg);}}
/* 粒子层:星屑/微尘/冰片/叶片/冲击波,总池 ≤ 30,reduced 一颗不出 */
.mst-p,.mst-ring{position:absolute;pointer-events:none;z-index:4;}
.mst-p-spark{width:9px;height:9px;margin:-4px 0 0 -4px;
  clip-path:polygon(50% 0,63% 35%,98% 38%,71% 60%,82% 100%,50% 76%,18% 100%,29% 60%,2% 38%,37% 35%);
  animation:mst-spark .55s ease-out forwards;}
@keyframes mst-spark{to{transform:translate(var(--dx,0px),var(--dy,0px)) rotate(220deg) scale(.15);opacity:0;}}
.mst-p-dust{width:7px;height:5px;margin:-2px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,.75);
  animation:mst-dust .4s ease-out forwards;}
@keyframes mst-dust{to{transform:translate(var(--dx,0px),-8px) scale(1.6);opacity:0;}}
.mst-p-shard{width:8px;height:10px;margin:-5px 0 0 -4px;background:rgba(210,240,255,.95);
  clip-path:polygon(50% 0,100% 42%,62% 100%,0 52%);animation:mst-shard .5s ease-in forwards;}
.mst-p-leaf{width:9px;height:6px;margin:-3px 0 0 -4px;border-radius:60% 40% 60% 40%;background:#7CC97F;
  animation:mst-shard .45s ease-in forwards;}
@keyframes mst-shard{20%{transform:none;}to{transform:translate(var(--dx,0px),var(--dy,0px)) rotate(160deg);opacity:0;}}
.mst-ring{border:3px solid rgba(255,255,255,.9);border-radius:50%;width:14px;height:14px;margin:-7px 0 0 -7px;
  animation:mst-ring .5s ease-out forwards;}
@keyframes mst-ring{to{transform:scale(5);opacity:0;}}
/* 连锁 ≥ 3:屏顶花体字 0.6s */
.mst-chainpop{position:absolute;top:4px;left:50%;transform:translateX(-50%);z-index:5;pointer-events:none;
  font-size:22px;font-weight:900;font-style:italic;letter-spacing:1px;color:#FF8FC7;white-space:nowrap;
  text-shadow:0 1px 0 #fff,0 2px 8px rgba(255,143,199,.55);animation:mst-chainpop .6s ease-out forwards;}
@keyframes mst-chainpop{0%{transform:translateX(-50%) scale(.4);opacity:0;}
  30%{transform:translateX(-50%) scale(1.15);opacity:1;}80%{transform:translateX(-50%) scale(1);opacity:1;}
  100%{transform:translateX(-50%) scale(1);opacity:0;}}
/* 过关仪式:三星逐颗砸下(easeOutBack) + 星屑雨;失败棋盘灰化 */
.mst-cheer{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;
  background:rgba(255,250,253,.7);border-radius:16px;pointer-events:none;overflow:hidden;}
.mst-cheer-row{display:flex;gap:8px;}
.mst-cheer-star{width:56px;height:56px;transform:translateY(-150px) scale(.4);opacity:0;
  animation:mst-drop .5s cubic-bezier(.34,1.56,.64,1) forwards;}
.mst-cheer-star svg{width:100%;height:100%;}
.mst-cheer-star.mst-dim{filter:grayscale(1) opacity(.4);}
@keyframes mst-drop{to{transform:none;opacity:1;}}
.mst-rain{position:absolute;top:-12px;width:9px;height:9px;
  clip-path:polygon(50% 0,63% 35%,98% 38%,71% 60%,82% 100%,50% 76%,18% 100%,29% 60%,2% 38%,37% 35%);
  animation:mst-rainfall 1.2s linear forwards;}
@keyframes mst-rainfall{to{transform:translateY(180px) rotate(240deg);opacity:0;}}
.mst-gray{filter:grayscale(.9) opacity(.85);}
.mst-party .mst-goal.mst-done{animation:mst-glowpop .4s ease-out;}
@keyframes mst-glowpop{50%{transform:scale(1.12);}}
/* 弱动效:旋转/流动/仪式动画全部静止(粒子在 JS 里就不出生) */
.mst-reduced .mst-spin,.mst-reduced .mst-cell.mst-belt::after,.mst-reduced .mst-chainpop,
.mst-wrap.mst-reduced .mst-cheer-star{animation:none;}
.mst-reduced .mst-cheer-star{animation:none;transform:none;opacity:1;}
.mst-msg{text-align:center;min-height:22px;color:#B06BC0;font-weight:800;margin-top:6px;font-size:16px;line-height:1.4;}
.mst-btn{border:none;border-radius:16px;min-height:44px;padding:10px 16px;font-size:16px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#D882B6,#BD6497);box-shadow:0 4px 0 #994B79;}
.mst-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #994B79;}
.mst-btn-vs{background:linear-gradient(180deg,#7FA7EA,#5A82C9);box-shadow:0 4px 0 #446299;}
.mst-btn-vs:active{box-shadow:0 2px 0 #446299;}
.mst-btn-duo{background:linear-gradient(180deg,#8AC79C,#65A87A);box-shadow:0 4px 0 #4C8B60;}
.mst-btn-duo:active{box-shadow:0 2px 0 #4C8B60;}
.mst-btn-ghost{background:#ffffffd9;color:#7A5AA0;box-shadow:0 3px 0 rgba(120,90,160,.25);}
.mst-btn-ghost:active{box-shadow:0 1px 0 rgba(120,90,160,.25);}
.mst-bar-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.mst-seats{display:flex;gap:10px;align-items:stretch;justify-content:center;flex-wrap:wrap;}
.mst-seat{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:4px;}
.mst-seat-name{font-size:15px;font-weight:900;color:#7A5AA0;text-align:center;}
.mst-over{position:absolute;inset:0;background:rgba(255,250,253,.95);border-radius:16px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;z-index:6;}
.mst-over-t{font-size:22px;font-weight:900;color:#A24E86;}
.mst-over-s{font-size:16px;font-weight:700;color:#7C6390;line-height:1.6;max-width:300px;}
@media (max-width:420px){
  .mst-wrap{padding:6px;--mst-bleed:16px;}
  .mst-seats{flex-direction:column;}
}
@media (max-height:820px) and (pointer:coarse){
  .mst-btn{min-height:44px;}
  .mst-wrap{padding:8px;}
}
@media (prefers-reduced-motion:reduce){
  .mst-fill{transition:none;}
  .mst-spin,.mst-cell.mst-belt::after,.mst-chainpop,.mst-cheer-star{animation:none;}
  .mst-cheer-star{transform:none;opacity:1;}
}
`;

/** 连锁 ≥ 3 才弹的「连锁 ×N」花体字文案；再小的连锁不打扰 */
export function chainPopText(chain: number): string {
  return chain >= 3 ? `连锁 ×${chain}` : "";
}

export interface Stage {
  root: HTMLElement;
  board: HTMLElement;
  /** 逻辑盘面（调用方和它共享同一份引用） */
  cell: Cellset;
  /** 当前处在时间线的哪一段 */
  phase: () => Phase;
  /** 时间线还在跑吗（跑着的时候不接受输入） */
  busy: () => boolean;
  /** 走过的段落轨迹：单测拿它证明 reduced-motion 走的是同一条路 */
  trace: () => Phase[];
  /** 逻辑行 */
  rowOf: (i: number) => number;
  /** 视觉行（浮点）：下落没走完时它不等于逻辑行 */
  visualRowOf: (i: number) => number;
  visualColOf: (i: number) => number;
  /** 有没有方块此刻正飘在半空 */
  movingCount: () => number;
  /** 模拟点一格（真人点击走的也是这条） */
  tap: (i: number) => void;
  /** 直接发起一次交换（键盘 / 人机用） */
  swap: (a: number, b: number) => void;
  selected: () => number;
  setCursor: (i: number) => void;
  setEnabled: (v: boolean) => void;
  /** 重画一次（面板变了、盘面被外部改了都调它） */
  paint: () => void;
  /** 单帧推进：单测用虚拟时钟一帧一帧走 */
  frame: (now: number) => void;
  timings: Timings;
  destroy: () => void;
}

export function createStage(host: HTMLElement, opts: StageOpts): Stage {
  const cell = opts.cell;
  const { cols, rows } = cell;
  const reduced = opts.reduced ?? prefersReducedMotion();
  const T = timings(reduced);
  const runner = new Runner();

  const root = document.createElement("div");
  root.className = reduced ? "mst-boardwrap mst-reduced" : "mst-boardwrap";
  const board = document.createElement("div");
  board.className = "mst-board";
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  // 格位淡影:按格重复的径向渐变画出凹槽感,跟着列数走,不占额外节点
  board.style.backgroundImage =
    "radial-gradient(circle at 50% 55%, rgba(10,14,40,.16) 58%, rgba(10,14,40,.42) 100%)";
  board.style.backgroundSize = `${(100 / cols).toFixed(3)}% ${(100 / rows).toFixed(3)}%`;
  root.appendChild(board);
  host.appendChild(root);

  const cells: HTMLButtonElement[] = [];
  const tiles: HTMLElement[] = [];
  const ghosts: HTMLElement[] = [];
  const gears: HTMLElement[] = [];
  /** 每格现在画着什么（key 变了才重建 SVG，paint 每帧跑，不能每帧重建节点） */
  const tileKeys: string[] = [];
  const gearKeys: string[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-cell";
    const ghost = document.createElement("span");
    ghost.className = "mst-ghost";
    const tile = document.createElement("span");
    tile.className = "mst-tile";
    const gear = document.createElement("span");
    gear.className = "mst-gear";
    btn.appendChild(ghost);
    btn.appendChild(tile);
    btn.appendChild(gear);
    btn.addEventListener("click", () => tap(i));
    board.appendChild(btn);
    cells.push(btn);
    tiles.push(tile);
    ghosts.push(ghost);
    gears.push(gear);
    tileKeys.push("\u0000");
    gearKeys.push("");
  }

  /** 正飘在半空的方块：key 是它最终落进的格子 */
  let moving = new Map<number, SlideTween>();
  let boomSet = new Set<number>();
  let landSet = new Set<number>();
  let selected = -1;
  let cursor = -1;
  let enabled = true;
  let destroyed = false;
  let raf = 0;
  let acc: StageCascade = { steps: 0, total: 0, best: 0 };
  let beltsDone = false;

  const rowOf = (i: number): number => Math.floor(i / cols);
  const colOf = (i: number): number => i % cols;

  function pitch(): number {
    const w = board.clientWidth || root.clientWidth || 0;
    return cellPitch(w, cols);
  }

  // -------------------------------------------------------------------------
  // 粒子层（纯表现：星屑 / 微尘 / 冰片 / 叶片 / 冲击波 / 连锁字）
  // -------------------------------------------------------------------------

  /** 粒子池上限：全场同时在飞的粒子加起来不超过这个数 */
  const MAX_PARTICLES = 30;
  let liveFx = 0;
  const fxTimers = new Set<ReturnType<typeof setTimeout>>();

  function fxLater(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      fxTimers.delete(t);
      fn();
    }, ms);
    fxTimers.add(t);
  }

  /** 自定义属性在真浏览器上必须走 setProperty，单测桩上直接写下标 */
  function setVar(el: HTMLElement, key: string, val: string): void {
    const st = el.style as CSSStyleDeclaration & Record<string, string>;
    if (typeof st.setProperty === "function") st.setProperty(key, val);
    else st[key] = val;
  }

  /** 在第 i 格出一颗粒子。reduced 一颗都不出；池满了就不出，绝不排队 */
  function fxAt(cls: string, i: number, life: number, dx: number, dy: number, bg?: string, oy = 0.5): void {
    if (reduced || destroyed || liveFx >= MAX_PARTICLES) return;
    const px = pitch();
    const el = document.createElement("span");
    el.className = `mst-p ${cls}`;
    el.style.left = `${((colOf(i) + 0.5) * px).toFixed(1)}px`;
    el.style.top = `${((rowOf(i) + oy) * px).toFixed(1)}px`;
    setVar(el, "--dx", `${dx.toFixed(1)}px`);
    setVar(el, "--dy", `${dy.toFixed(1)}px`);
    if (bg) el.style.background = bg;
    root.appendChild(el);
    liveFx++;
    fxLater(() => {
      liveFx--;
      el.remove();
    }, life);
  }

  /** 爆点星屑：每颗爆点迸 3 颗本色星屑（要在 applyRound 之前读 grid 才有颜色） */
  function boomFx(list: number[]): void {
    if (reduced) return;
    for (const i of list) {
      const v = cell.grid[i];
      const base = v >= 0 ? (STAR_STYLES[v] ?? STAR_STYLES[0]).base : "#FFD34D";
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2 + (i % 5) * 0.7;
        fxAt("mst-p-spark", i, 560, Math.cos(ang) * 22, Math.sin(ang) * 22 - 8, base);
      }
    }
  }

  /** 一次消掉 ≥ 5 颗：在爆点重心放一圈冲击波环 */
  function ringFx(list: number[]): void {
    if (reduced || destroyed || list.length === 0) return;
    const px = pitch();
    let r = 0;
    let c = 0;
    for (const i of list) {
      r += rowOf(i);
      c += colOf(i);
    }
    const el = document.createElement("span");
    el.className = "mst-ring";
    el.style.left = `${((c / list.length + 0.5) * px).toFixed(1)}px`;
    el.style.top = `${((r / list.length + 0.5) * px).toFixed(1)}px`;
    root.appendChild(el);
    fxLater(() => el.remove(), 520);
  }

  /** 连锁 ≥ 3 的「连锁 ×N」花体字（reduced 下 CSS 关动画，字照样报喜） */
  function chainFx(text: string): void {
    if (destroyed) return;
    const el = document.createElement("div");
    el.className = "mst-chainpop";
    el.textContent = text;
    root.appendChild(el);
    fxLater(() => el.remove(), 620);
  }

  function setMoving(list: SlideTween[]): void {
    moving = new Map();
    for (const tw of list) moving.set(tw.cell, tw);
  }

  function visualRowOf(i: number): number {
    const tw = moving.get(i);
    return tw ? tweenPos(tw, runner.elapsed).row : rowOf(i);
  }

  function visualColOf(i: number): number {
    const tw = moving.get(i);
    return tw ? tweenPos(tw, runner.elapsed).col : colOf(i);
  }

  /** 这一格该画哪张 SVG（key 变了才重建节点） */
  function tileKeyOf(i: number): string {
    if (cell.solid[i]) return "solid";
    const v = cell.grid[i];
    if (v === RAINBOW) return "rainbow";
    if (v === EMPTY) return "empty";
    return `t${v}s${cell.special[i] || 0}`;
  }

  /** key 变了：把绘制资产（星星家族 / 彩虹星 / 空格）真正写进 tile */
  function renderTile(i: number, key: string): void {
    const tile = tiles[i];
    if (key === "solid") {
      tile.innerHTML = "";
      tile.style.background = "";
      tile.style.backgroundColor = "";
    } else if (key === "rainbow") {
      tile.innerHTML = rainbowStarSVG();
      tile.style.backgroundColor = "";
      tile.style.background =
        "conic-gradient(from 210deg,#FFE3EC,#FFF3D0,#E1F7DF,#DBEBFF,#EFE1FF,#FFE3EC)";
    } else if (key === "empty") {
      tile.innerHTML = "";
      tile.style.background = "";
      tile.style.backgroundColor = "rgba(255,255,255,.12)";
    } else {
      const v = cell.grid[i];
      const skin = opts.tokens[v] ?? opts.tokens[0];
      tile.innerHTML = tokenSVG(v, cell.special[i] || 0);
      tile.style.background = "";
      // 只写 backgroundColor,免得 shorthand 把糖霜 / 冰面的 background-image 顶掉
      tile.style.backgroundColor = skin.bg;
    }
  }

  /** 这一格现在盖着哪种机关罩 */
  function gearKeyOf(i: number): GearKind | "" {
    if (cell.solid[i]) return "brick";
    if (cell.fixed[i] && (cell as { ice?: boolean[] }).ice?.[i]) return "ice";
    if ((cell as { vine?: boolean[] }).vine?.[i]) return "vine";
    const frost = (cell as { frost?: number[] }).frost?.[i] ?? 0;
    if (frost >= 2) return "frost2";
    if (frost === 1) return "frost1";
    return "";
  }

  function paint(): void {
    const px = pitch();
    const boom = runner.phase === "boom" ? runner.progress : 0;
    const land = runner.phase === "land" ? runner.progress : 0;
    const falling = runner.phase === "fall";
    for (let i = 0; i < cells.length; i++) {
      const btn = cells[i];
      const tile = tiles[i];
      const v = cell.grid[i];
      const key = tileKeyOf(i);
      if (key !== tileKeys[i]) {
        tileKeys[i] = key;
        renderTile(i, key);
      }
      const gearKey = gearKeyOf(i);
      if (gearKey !== gearKeys[i]) {
        const prev = gearKeys[i];
        gearKeys[i] = gearKey;
        gears[i].innerHTML = gearKey ? gearSVG(gearKey) : "";
        if (prev === "ice" && !gearKey) {
          // 破冰:碎成 3 片飞出去
          for (let k = 0; k < 3; k++) fxAt("mst-p-shard", i, 500, (k - 1) * 14, -6 - k * 4);
        } else if (prev === "vine" && !gearKey) {
          // 解藤:两片叶子飘走
          fxAt("mst-p-leaf", i, 450, -10, -8);
          fxAt("mst-p-leaf", i, 450, 10, -6);
        }
      }
      btn.classList.toggle("mst-ice", gearKey === "ice");
      btn.classList.toggle("mst-vine", gearKey === "vine");
      btn.classList.toggle("mst-frost1", gearKey === "frost1");
      btn.classList.toggle("mst-frost2", gearKey === "frost2");
      btn.classList.toggle("mst-solid", !!cell.solid[i]);
      btn.classList.toggle("mst-sel", i === selected);
      btn.classList.toggle("mst-cursor", i === cursor);

      const tw = moving.get(i);
      const ghost = ghosts[i];
      let dx = 0;
      let dy = 0;
      let ghostOn = false;
      if (tw) {
        const pos = tweenPos(tw, runner.elapsed);
        dx = (pos.col - colOf(i)) * px;
        dy = (pos.row - rowOf(i)) * px;
        if (falling && !reduced) {
          // 下落残影:一帧(约 17ms)前的位置放一块极淡的本色影子
          const prev = tweenPos(tw, Math.max(0, runner.elapsed - 17));
          const gx = (prev.col - pos.col) * px;
          const gy = (prev.row - pos.row) * px;
          if (gx || gy) {
            ghostOn = true;
            ghost.style.opacity = "0.22";
            ghost.style.transform = `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px)`;
            ghost.style.background = v >= 0 ? (opts.tokens[v] ?? opts.tokens[0]).bg : "rgba(255,255,255,.4)";
          }
        }
      }
      if (!ghostOn && ghost.style.opacity) {
        ghost.style.opacity = "";
        ghost.style.transform = "";
      }
      let scale = 1;
      let opacity = 1;
      if (boomSet.has(i)) {
        scale = 1 + 0.3 * boom;
        opacity = 1 - boom;
      } else if (landSet.has(i) && !reduced) {
        // 落地压扁 8%,一次回弹。reduced-motion 下这一段照走,只是不形变
        scale = 1 - 0.08 * Math.sin(Math.PI * land);
      }
      btn.style.transform = dx || dy ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` : "";
      tile.style.transform = scale === 1 ? "" : `scale(${scale.toFixed(3)})`;
      tile.style.opacity = opacity === 1 ? "" : opacity.toFixed(3);
      const locked = opts.locked?.(i) ?? false;
      btn.disabled = !enabled;
      btn.setAttribute("aria-label", describe(i, locked));
    }
    opts.onPaint?.();
  }

  function describe(i: number, locked: boolean): string {
    const r = rowOf(i) + 1;
    const c = colOf(i) + 1;
    if (cell.solid[i]) return `第 ${r} 行第 ${c} 列，挡板`;
    const v = cell.grid[i];
    const name = v === RAINBOW ? "彩虹星" : v === EMPTY ? "空格" : (opts.tokens[v] ?? opts.tokens[0]).emoji;
    return `第 ${r} 行第 ${c} 列，${name}${locked ? "，被机关卡住" : ""}`;
  }

  // -------------------------------------------------------------------------
  // 时间线
  // -------------------------------------------------------------------------

  function pushStep(step: Step): void {
    runner.push(step);
  }

  /** 第 3 段：匹配格爆开 */
  function boomStep(plan: RoundPlan, chain: number): void {
    pushStep({
      phase: "boom",
      durMs: T.boomMs,
      enter: () => {
        boomSet = new Set(plan.cells);
        acc = {
          steps: acc.steps + 1,
          total: acc.total + plan.cells.length,
          best: Math.max(acc.best, plan.cells.length),
        };
        opts.sfx?.("pop");
        opts.onRound?.(plan, chain);
        // 纯表现:星屑要趁 applyRound 之前读 grid 才知道本色
        boomFx(plan.cells);
        if (plan.cells.length >= 5) ringFx(plan.cells);
        const pop = chainPopText(chain);
        if (pop) chainFx(pop);
      },
      done: () => {
        boomSet = new Set();
        opts.applyRound(plan, chain);
        // 特殊块引爆:再炸一波,依旧排进同一条时间线,绝不一次清盘
        const wave = opts.blast?.();
        if (wave && wave.cells.length > 0) {
          boomStep(wave, chain);
          return;
        }
        fallStep(chain);
      },
    });
  }

  /** 第 4/5 段：重力 + 补块。逻辑先到位，视觉从旧格滑过来 */
  function fallStep(chain: number): void {
    const step: Step = {
      phase: "fall",
      durMs: 1,
      enter: () => {
        const before = cell.grid.slice();
        settleOn(cell.grid, cols, rows, cell);
        const settled = cell.grid.slice();
        const planOpts = {
          fixed: cell.fixed,
          solid: cell.solid,
          perCellMs: T.perCellMs,
          staggerMs: T.staggerMs,
        };
        const spawns = planRefill(settled, cols, planOpts);
        refillOn(cell.grid, cols, rows, opts.spawn, cell);
        const falls: FallTween[] = planGravity(before, cell.grid, cols, planOpts);
        // 新块的图案要等补完才知道
        for (const sp of spawns) sp.cell = cell.grid[sp.toRow * cols + sp.col];
        const all = [...falls, ...spawns];
        const slides = all.map((f) => asSlide(f, cols));
        setMoving(slides);
        landSet = new Set(slides.map((s) => s.cell));
        step.durMs = Math.max(1, planEndMs(all));
      },
      done: () => {
        setMoving([]);
        landStep(chain);
      },
    };
    pushStep(step);
  }

  /** 第 6 段：落地压扁回弹，稳定之后才检测连锁 */
  function landStep(chain: number): void {
    pushStep({
      phase: "land",
      durMs: T.landMs,
      enter: () => {
        // 纯表现:每颗落地的棋子扬 1 粒微尘(粒子池满了就不扬)
        for (const i of landSet) fxAt("mst-p-dust", i, 420, i % 2 ? 5 : -5, -6, undefined, 0.92);
      },
      done: () => {
        landSet = new Set();
        const next = opts.round();
        if (next && next.cells.length > 0) {
          // 连锁不耗步:这里不再调 onMove
          boomStep(next, chain + 1);
          return;
        }
        beltStep(chain);
      },
    });
  }

  /** 第 7 段：传送带滑移（同样不许瞬跳），转完可能又连锁 */
  function beltStep(chain: number): void {
    const moves = beltsDone ? [] : opts.belts?.() ?? [];
    beltsDone = true;
    for (const b of moves) {
      if (b.slots.length < 2) continue;
      pushStep({
        phase: "belt",
        durMs: T.beltMs,
        enter: () => {
          opts.applyBelt?.(b);
          setMoving(planBelt(b.slots, b.dir, cols, T.beltMs));
        },
        done: () => setMoving([]),
      });
    }
    pushStep({
      phase: "settle",
      durMs: T.settleMs,
      done: () => {
        const next = opts.round();
        if (next && next.cells.length > 0) {
          boomStep(next, chain + 1);
          return;
        }
        const info = acc;
        acc = { steps: 0, total: 0, best: 0 };
        beltsDone = false;
        opts.onSettled?.(info);
        restockStep();
      },
    });
  }

  /**
   * 第 8 段（少见）：盘面死了，洗完牌整盘从棋盘顶外重新落进来。
   * 洗牌保证洗完没有现成的三连，所以这一段走完就直接 idle，不再回连锁。
   */
  function restockStep(): void {
    if (destroyed || !opts.reshuffle?.()) return;
    const step: Step = {
      phase: "fall",
      durMs: 1,
      enter: () => {
        // 能动的格子全当成空的来排队，冰块 / 藤蔓 / 挡板原地不动
        const blank = cell.grid.map((v, i) => (cell.fixed[i] || cell.solid[i] ? v : EMPTY));
        const spawns = planRefill(blank, cols, {
          fixed: cell.fixed,
          solid: cell.solid,
          perCellMs: T.perCellMs,
          staggerMs: T.staggerMs,
        });
        for (const sp of spawns) sp.cell = cell.grid[sp.toRow * cols + sp.col];
        const slides = spawns.map((f) => asSlide(f, cols));
        setMoving(slides);
        landSet = new Set(slides.map((s) => s.cell));
        step.durMs = Math.max(1, planEndMs(spawns));
        opts.sfx?.("pop");
      },
      done: () => {
        setMoving([]);
        pushStep({
          phase: "land",
          durMs: T.landMs,
          done: () => {
            landSet = new Set();
          },
        });
      },
    };
    pushStep(step);
  }

  /** 第 1/2 段：交换 → 没匹配就原路弹回来 */
  /** 发起一次交换。`enabled` 只挡真人的手指，人机与键盘走这条不受影响 */
  function beginSwap(a: number, b: number): void {
    if (runner.busy || destroyed) return;
    if (opts.canSwap && !opts.canSwap(a, b)) {
      opts.sfx?.("oops");
      opts.onRevert?.(a, b);
      paint();
      return;
    }
    selected = -1;
    pushStep({
      phase: "swap",
      durMs: T.swapMs,
      enter: () => {
        [cell.grid[a], cell.grid[b]] = [cell.grid[b], cell.grid[a]];
        [cell.special[a], cell.special[b]] = [cell.special[b], cell.special[a]];
        setMoving(planSwap(a, b, cols, T.swapMs));
        opts.sfx?.("tap");
      },
      done: () => {
        setMoving([]);
        const verdict = opts.afterSwap(a, b);
        if (verdict === "revert") {
          pushStep({
            phase: "revert",
            durMs: T.swapMs,
            enter: () => {
              [cell.grid[a], cell.grid[b]] = [cell.grid[b], cell.grid[a]];
              [cell.special[a], cell.special[b]] = [cell.special[b], cell.special[a]];
              setMoving(planSwap(a, b, cols, T.swapMs));
              opts.sfx?.("oops");
            },
            done: () => {
              setMoving([]);
              opts.onRevert?.(a, b);
            },
          });
          return;
        }
        opts.onMove?.(a, b);
        acc = { steps: 0, total: 0, best: 0 };
        beltsDone = false;
        boomStep(verdict, 1);
      },
    });
  }

  function tap(i: number): void {
    if (!enabled || runner.busy || destroyed) return;
    if (opts.locked?.(i)) {
      opts.sfx?.("oops");
      opts.onRevert?.(i, i);
      paint();
      return;
    }
    if (selected === -1 || selected === i) {
      selected = selected === i ? -1 : i;
      if (selected >= 0) opts.sfx?.("tap");
      paint();
      return;
    }
    const ra = rowOf(selected), ca = colOf(selected);
    const rb = rowOf(i), cb = colOf(i);
    if (Math.abs(ra - rb) + Math.abs(ca - cb) !== 1) {
      selected = i;
      opts.sfx?.("tap");
      paint();
      return;
    }
    const a = selected;
    beginSwap(a, i);
  }

  function frame(now: number): void {
    if (destroyed) return;
    runner.tick(now);
    paint();
  }

  const loop = (now: number): void => {
    if (destroyed) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  paint();

  return {
    root,
    board,
    cell,
    phase: () => runner.phase,
    busy: () => runner.busy,
    trace: () => runner.trace,
    rowOf,
    visualRowOf,
    visualColOf,
    movingCount: () => moving.size,
    tap,
    swap: beginSwap,
    selected: () => selected,
    setCursor: (i: number) => {
      cursor = i;
      paint();
    },
    setEnabled: (v: boolean) => {
      enabled = v;
      paint();
    },
    paint,
    frame,
    timings: T,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      runner.clear();
      for (const t of fxTimers) clearTimeout(t);
      fxTimers.clear();
      root.remove();
    },
  };
}
