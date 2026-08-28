import { meta } from "./meta";
export { meta };

// 花开麻将:国标规则的四人麻将。牌墙、吃碰杠、胡牌型判定、81 番计分、四档 AI 全在本目录里,
// 188 关残局战役 + 一人三机对战 + 快棋无尽 + 同屏双人,全程离线,不依赖任何外部规则库。
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { mountLevelGame, mulberry32, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { chooseClaim, chooseDiscard, chooseSelf } from "./ai";
import { canHuWithFloor, scoreFans, type FanHit } from "./fan";
import guide from "./guide";
import { isHu, waitingTiles } from "./hu";
import { kanOptions, meldLabel, type Meld } from "./melds";
import {
  CHAPTERS,
  endlessConfig,
  junkHint,
  levelConfig,
  levelGoal,
  solveLevel,
  starsFor,
  type MahjongLevel
} from "./levels";
import {
  AI_TIER_LABELS,
  applyClaim,
  applyHu,
  applySelfKan,
  claimOptions,
  createTable,
  discard,
  finishDraw,
  fullHand,
  nextTurn,
  resolveClaims,
  resolveRobbing,
  selfOptions,
  windName,
  type AiTier,
  type ClaimOption,
  type SelfOption,
  type TableState
} from "./table";
import { isDragon, isHonor, sortTiles, suitOf, tileFace, tileName } from "./tiles";
import { KIT_PALETTE } from "../../art/kit";
import { backArtSVG, bloomFlowerSVG, compassSVG, leafSVG, petalSVG, tileArtSVG } from "./tileart";

/** 出牌飞到牌河的时长(毫秒);规格要求 ~200ms,不许瞬变 */
export const FLY_MS = 200;
/** 胡牌樱花绽放的时长:开完花再弹番种表 */
export const BLOOM_MS = 800;
/** 开花时飘落的花瓣数 */
export const BLOOM_PETALS = 12;
/** 副露滑入的时长 */
export const MELD_MS = 220;
/** 番种一条一条弹出来的间隔 */
export const FAN_STEP_MS = 140;
/** 同屏最多先露 6 条番,其余滚动看 */
export const FAN_VISIBLE = 6;
/** AI 思考的停顿,让孩子看得清谁在动 */
const AI_THINK_MS = 460;
/** 一场对战打几盘。国标一局是四圈十六盘,小朋友坐不住,这里用「一圈四盘」的快棋 */
export const MATCH_HANDS = 4;

/** 本款全部样式。不动 `src/styles.css`,免得跟同窗并行的档撞车;窄屏红线由 index.test.ts 巡检 */
export const MJ_CSS = `
.mj-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFF4F8,#F3F8FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;overflow:hidden;}
.mj-wrap::before,.mj-wrap::after{content:"";position:absolute;width:110px;height:110px;pointer-events:none;opacity:.42;
  background:radial-gradient(circle at 50% 24%,#ffc9dd 0 9px,transparent 10px),
  radial-gradient(circle at 74% 42%,#ffc9dd 0 9px,transparent 10px),
  radial-gradient(circle at 65% 70%,#ffd7e6 0 9px,transparent 10px),
  radial-gradient(circle at 35% 70%,#ffd7e6 0 9px,transparent 10px),
  radial-gradient(circle at 26% 42%,#ffc9dd 0 9px,transparent 10px),
  radial-gradient(circle at 50% 46%,#ffe9b8 0 5px,transparent 6px);}
.mj-wrap::before{top:-30px;right:-30px;}
.mj-wrap::after{bottom:-30px;left:-30px;transform:rotate(24deg);}
.mj-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:8px;position:relative;}
.mj-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#8a4a70;
  box-shadow:0 2px 6px rgba(190,140,180,.25);overflow-wrap:anywhere;line-height:1.4;}
.mj-compass{display:inline-flex;flex-direction:row-reverse;align-items:center;gap:5px;}
.mj-dial{width:20px;height:20px;flex:0 0 auto;}
.mj-dial svg{display:block;width:100%;height:100%;}
.mj-badge.mj-floor-bud{background:#eaf7ee;color:#1b7a65;}
.mj-badge.mj-floor-rose{background:#ffeff6;color:#c8397a;}
.mj-badge.mj-floor-gold{background:linear-gradient(180deg,#fff3d6,#ffe6a8);color:#96660f;}
.mj-goal{flex:1 1 100%;font-size:16px;font-weight:800;color:#8a4a70;text-align:center;line-height:1.5;
  overflow-wrap:anywhere;}
.mj-pause{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;gap:6px;
  align-items:center;justify-content:center;text-align:center;padding:16px;
  background:rgba(255,244,248,.92);border-radius:16px;}
.mj-pause-t{font-size:20px;font-weight:900;color:#8a4a70;line-height:1.4;}
.mj-pause-k{font-size:var(--mt-body,16px);font-weight:800;color:#7a5a90;line-height:1.6;overflow-wrap:anywhere;}
/* 牌桌:深绿毛毡径向渐变(中心亮边缘暗)+ ≤4% 斜织纹(1.3 r1 P8,眯眼不抢牌面)+ 8px 木纹条纹边框 */
.mj-board{display:flex;flex-direction:column;gap:8px;position:relative;border-radius:16px;padding:8px;
  border:8px solid transparent;
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 6px,transparent 6px 12px) padding-box,
  radial-gradient(130% 95% at 50% 30%,#3f9e72 0%,#2c7c57 55%,#1e5f43 100%) padding-box,
  linear-gradient(135deg,#a87a4c,#6e4a26 28%,#9c7042 50%,#5f3d1f 76%,#8a5f36) border-box;
  box-shadow:0 6px 16px rgba(70,50,70,.28),inset 0 0 24px rgba(0,20,10,.18);}
.mj-foe{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:34px;}
.mj-foe-name{font-size:16px;font-weight:900;color:#e9f6ec;white-space:nowrap;text-shadow:0 1px 2px rgba(15,55,35,.5);}
.mj-foe-name.mj-turn{color:#ffd46a;}
.mj-backs{display:flex;gap:2px;flex-wrap:wrap;align-items:center;}
/* 牌背:真实 3:4 比例,绿渐变 + 四瓣花压纹 */
.mj-back{width:15px;height:20px;border-radius:4px;position:relative;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(165deg,#4aa87d,#2e7d5b 55%,#226349);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 0 rgba(0,0,0,.24),0 1px 2px rgba(20,60,40,.4);}
.mj-back-fl{display:block;width:9px;height:9px;opacity:.85;}
.mj-back-fl svg{display:block;width:100%;height:100%;}
.mj-mid{display:flex;gap:8px;align-items:flex-start;}
.mj-river{flex:1;min-width:0;background:rgba(14,66,45,.5);border-radius:12px;padding:6px;min-height:64px;
  display:flex;flex-wrap:wrap;gap:3px;align-content:flex-start;position:relative;
  box-shadow:inset 0 2px 8px rgba(0,25,12,.35);}
.mj-river.mj-dim{filter:grayscale(.85) opacity(.82);}
.mj-info{width:96px;flex:0 0 auto;display:flex;flex-direction:column;gap:4px;}
.mj-info .mj-badge{font-size:16px;padding:4px 8px;text-align:center;}
.mj-melds{display:flex;gap:6px;flex-wrap:wrap;min-height:4px;}
.mj-meldgrp{display:flex;gap:1px;padding:2px;border-radius:8px;background:#ffffffb0;}
.mj-hand{display:flex;gap:3px;overflow-x:auto;padding:6px 2px 10px;scrollbar-width:thin;}
.mj-hand::-webkit-scrollbar{height:5px;}
.mj-hand::-webkit-scrollbar-thumb{background:#9ec9ae;border-radius:4px;}
/* 手机竖屏一行装不下 14 张,横滚会把后几张藏出屏——换行摆两排,全部看得见 */
@media (max-width:480px){
  .mj-hand{flex-wrap:wrap;overflow-x:visible;row-gap:8px;}
}
.mj-gap{width:10px;flex:0 0 auto;}
/* 牌体三层:象牙渐变顶面 + 右/下 2px 米黄侧墙(inset)+ 2px 传统绿底座 */
.mj-tile{flex:0 0 auto;min-width:44px;min-height:44px;width:44px;height:46px;border-radius:7px;border:none;padding:0;cursor:pointer;position:relative;
  background:linear-gradient(180deg,#FFFEF9,#F4EDDD);
  box-shadow:inset -2px -2px 0 #D8CBAE,0 2px 0 #2E8B6A,0 4px 7px rgba(30,70,50,.35);
  display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;font-family:inherit;}
.mj-tile:active{transform:translateY(2px);box-shadow:inset -2px -2px 0 #D8CBAE,0 1px 0 #2E8B6A,0 2px 3px rgba(30,70,50,.3);}
.mj-tile:focus-visible{outline:3px solid #6b2a52;outline-offset:2px;}
.mj-t-art{position:absolute;inset:2px 3px 4px;pointer-events:none;display:block;}
.mj-t-art svg{display:block;width:100%;height:100%;}
/* 文字层平时藏起,超小屏(<340px)退化成大号文字;读屏走 aria-label */
.mj-t-txt{display:none;flex-direction:column;align-items:center;justify-content:center;}
.mj-t-n{font-size:18px;font-weight:900;}
.mj-t-s{font-size:var(--mt-control,14px);font-weight:800;}
.mj-t-m{color:#B4442F;}
.mj-t-p{color:#2E5FA8;}
.mj-t-s2{color:#28794C;}
.mj-t-z{color:#4A3B6B;}
.mj-t-red{color:#C42B3F;}
.mj-t-green{color:#218454;}
/* 牌河与副露里的小牌只是让人认出打了什么,点数仍旧 13px 起,花色字是陪衬 */
.mj-tile.mj-small{width:26px;height:34px;}
.mj-tile.mj-small .mj-t-n{font-size:var(--mt-control,14px);}
.mj-tile.mj-small .mj-t-s{font-size:var(--mt-control,14px);}
.mj-tile.mj-cur{outline:3px solid #E0609B;outline-offset:1px;transform:translateY(-4px);
  box-shadow:inset -2px -2px 0 #D8CBAE,0 6px 0 #2E8B6A,0 10px 10px rgba(30,70,50,.4);}
.mj-tile.mj-hot{box-shadow:inset -2px -2px 0 #D8CBAE,0 2px 0 #2E8B6A,0 0 0 3px ${KIT_PALETTE.starGold},0 4px 8px rgba(30,70,50,.35);
  animation:mjhot 1.3s ease-in-out infinite alternate;}
.mj-tile.mj-drawn{background:linear-gradient(180deg,#FFF8E6,#F6E7C4);}
.mj-tile[disabled]{cursor:default;}
.mj-drawin{animation:mjdraw 240ms cubic-bezier(.34,1.56,.64,1);}
.mj-fly{animation:mjfly ${FLY_MS}ms cubic-bezier(.3,.6,.4,1);}
.mj-slide{animation:mjslide ${MELD_MS}ms cubic-bezier(.22,1,.36,1);}
@keyframes mjhot{from{box-shadow:inset -2px -2px 0 #D8CBAE,0 2px 0 #2E8B6A,0 0 0 3px ${KIT_PALETTE.starGold},0 4px 8px rgba(30,70,50,.35);}
  to{box-shadow:inset -2px -2px 0 #D8CBAE,0 2px 0 #2E8B6A,0 0 0 5px #ffe8ab,0 4px 12px rgba(255,211,78,.55);}}
@keyframes mjdraw{from{transform:translateX(22px) translateY(-6px) rotate(4deg);opacity:0;}
  60%{transform:translateX(-2px) translateY(2px);opacity:1;}to{transform:none;opacity:1;}}
@keyframes mjfly{0%{transform:translate(-12px,-30px) rotate(-8deg) scale(1.12);opacity:.2;}
  55%{transform:translate(-3px,-10px) rotate(3deg) scale(1.1);opacity:1;}
  100%{transform:none;opacity:1;}}
@keyframes mjslide{from{transform:translateX(26px);opacity:0}to{transform:none;opacity:1}}
/* 胡牌开花:中心一朵五瓣樱花 + 12 片花瓣飘落;soft 只闪金光一次(不加动画类) */
.mj-bloom{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;
  display:flex;align-items:center;justify-content:center;}
.mj-bloom-core{width:96px;height:96px;display:block;filter:drop-shadow(0 2px 6px rgba(200,57,122,.35));}
.mj-bloom-core svg{display:block;width:100%;height:100%;}
.mj-bloom-open{animation:mjbloom ${BLOOM_MS}ms cubic-bezier(.34,1.56,.64,1) both;}
.mj-bloom-flash{filter:drop-shadow(0 0 16px ${KIT_PALETTE.starGold}) drop-shadow(0 0 4px ${KIT_PALETTE.starGold});}
.mj-petal{position:absolute;top:-16px;width:14px;height:14px;display:block;}
.mj-petal svg{display:block;width:100%;height:100%;}
.mj-petal-fall{animation:mjpetal ${BLOOM_MS}ms ease-in both;}
@keyframes mjbloom{from{transform:scale(.12) rotate(-42deg);opacity:0;}55%{transform:scale(1.12) rotate(6deg);opacity:1;}
  to{transform:scale(1) rotate(0deg);opacity:1;}}
@keyframes mjpetal{from{transform:translateY(0) rotate(0deg);opacity:1;}to{transform:translateY(340px) rotate(170deg);opacity:0;}}
/* 流局:牌河灰化 + 一片落叶 */
.mj-leaf{width:18px;height:18px;display:block;margin:2px auto;}
.mj-leaf svg{display:block;width:100%;height:100%;}
.mj-leaf-fall{animation:mjleaf 900ms ease-in-out both;}
@keyframes mjleaf{from{transform:translateY(-36px) rotate(-40deg);opacity:0;}60%{transform:translateY(4px) rotate(10deg);opacity:1;}
  to{transform:none;opacity:1;}}
.mj-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
.mj-btn{min-height:44px;min-width:56px;border:none;border-radius:14px;padding:0 14px;font-family:inherit;
  font-size:16px;font-weight:900;cursor:pointer;background:#F6D3E2;color:#8a2f5c;box-shadow:0 3px 0 #DFAFC6;}
.mj-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #DFAFC6;}
.mj-btn:focus-visible{outline:3px solid #6b2a52;outline-offset:3px;}
.mj-btn.mj-go{background:linear-gradient(180deg,#D9538F,#BC3D75);color:#fff;box-shadow:0 3px 0 #972E5C;}
.mj-btn.mj-ghost{background:#E4E1F2;color:#54487a;box-shadow:0 3px 0 #C6C0DE;}
.mj-msg{text-align:center;min-height:20px;font-size:16px;font-weight:800;color:#7c5a8e;margin-top:6px;
  line-height:1.5;overflow-wrap:anywhere;}
/* 毛毡上的提示字换成浅色,保证对比度(基础 .mj-msg 规则在上面,别挪顺序) */
.mj-board .mj-msg{color:#e2f2e6;}
.mj-river .mj-msg{color:#d9eddc;}
.mj-modebar,.mj-optbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.mj-modebar[hidden]{display:none;}
.mj-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#7c5a8e;text-align:center;overflow-wrap:anywhere;}
.mj-open{border:none;border-radius:999px;padding:10px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#D9538F,#BC3D75);box-shadow:0 4px 0 #972E5C;}
.mj-open:active{transform:translateY(2px);box-shadow:0 2px 0 #972E5C;}
.mj-open:focus-visible{outline:3px solid #6b2a52;outline-offset:3px;}
.mj-mode{max-width:820px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.mj-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.mj-back-btn{border:none;border-radius:999px;padding:9px 14px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffd9;color:#a8407a;box-shadow:0 3px 0 rgba(170,90,140,.3);}
.mj-sheet{position:absolute;inset:0;background:rgba(255,248,252,.97);border-radius:16px;z-index:9;padding:16px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;}
.mj-sheet-t{font-size:21px;font-weight:900;color:#a8407a;}
.mj-sheet-s{font-size:16px;font-weight:700;color:#7c5a8e;line-height:1.6;max-width:340px;overflow-wrap:anywhere;}
.mj-fans{width:100%;max-width:340px;max-height:${FAN_VISIBLE * 34}px;overflow-y:auto;display:flex;
  flex-direction:column;gap:4px;padding:2px;}
.mj-fan{display:flex;justify-content:space-between;gap:10px;background:#fff;border-radius:10px;padding:6px 12px;
  font-size:var(--mt-body,16px);font-weight:800;color:#7c5a8e;box-shadow:0 2px 5px rgba(180,140,180,.2);
  animation:mjpop 220ms cubic-bezier(.34,1.56,.64,1);}
.mj-fan-p{color:#c8397a;white-space:nowrap;}
.mj-fan-total{background:#FFEFF6;color:#a8407a;}
@keyframes mjpop{from{transform:translateY(8px) scale(.92);opacity:0}to{transform:none;opacity:1}}
.mj-sheet-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
@media (max-width:360px){
  .mj-wrap{padding:8px;}
  .mj-t-n{font-size:16px;}
  .mj-badge{padding:4px 8px;}
  /* 16px 的「牌墙 N 张」要地方,78px 装不下 */
  .mj-info{width:92px;}
  .mj-btn{min-width:50px;padding:0 10px;font-size:15px;}
  .mj-back{width:14px;height:19px;}
}
@media (max-width:340px){
  /* 超小屏退化:图案层藏起,换回大号文字层,30px 宽也认得清 */
  .mj-t-art{display:none;}
  .mj-t-txt{display:flex;}
}
/* N-75:矮横屏对局手牌整排线下。牌宽仍 44(N-41 勿回滚),收的是桌高,手牌钉底横滑 */
@media (max-height:500px){
  .mj-wrap{height:100%;max-height:calc(100dvh - 76px);min-height:0;overflow:hidden;
    display:flex;flex-direction:column;box-sizing:border-box;padding:6px;}
  .mj-top{margin-bottom:4px;flex:0 0 auto;}
  .mj-goal{flex:0 0 auto;font-size:14px;line-height:1.3;max-height:1.4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .mj-board{flex:1 1 auto;min-height:0;overflow:hidden;gap:4px;padding:4px;border-width:4px;}
  .mj-river{min-height:28px;max-height:48px;overflow:auto;}
  .mj-foe{min-height:22px;}
  .mj-hand{position:sticky;bottom:0;z-index:5;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;
    flex:0 0 auto;padding:4px 2px 6px;row-gap:0;
    background:linear-gradient(180deg,rgba(30,95,67,0),rgba(30,95,67,.55) 18px,#1e5f43);}
}
@media (prefers-reduced-motion:reduce){
  .mj-fly{animation-duration:60ms;}
  .mj-slide{animation-duration:60ms;}
  .mj-fan{animation-duration:60ms;}
  .mj-drawin{animation-duration:60ms;}
  .mj-tile.mj-hot{animation-duration:60ms;animation-iteration-count:1;}
  .mj-bloom-open{animation-duration:60ms;}
  .mj-petal-fall{animation-duration:60ms;}
  .mj-leaf-fall{animation-duration:60ms;}
}
`;

// ---------------------------------------------------------------------------
// 画一张牌
// ---------------------------------------------------------------------------

function suitClass(id: number): string {
  const s = suitOf(id);
  if (s === "m") return "mj-t-m";
  if (s === "p") return "mj-t-p";
  if (s === "s") return "mj-t-s2";
  if (isDragon(id)) return id === 35 ? "mj-t-red" : id === 36 ? "mj-t-green" : "mj-t-p";
  return "mj-t-z";
}

export interface TileOpts {
  small?: boolean;
  /** 键盘光标停在这张牌上 */
  cursor?: boolean;
  /** 高亮:能吃碰杠胡的牌 */
  hot?: boolean;
  /** 刚摸到的那张,和手牌错开一点 */
  drawn?: boolean;
  fly?: boolean;
  /** 刚从牌墙摸进来:从右侧滑入 + 轻微弹跳 */
  slide?: boolean;
  onClick?: () => void;
}

/**
 * 一张牌的 DOM:图案层(内联 SVG,筒饼 / 竹节 / 万字 / 传统字牌配色)+
 * 文字退化层(<340px 显示)。读屏念的是 aria-label 里的中文牌名。
 */
export function tileEl(id: number, opts: TileOpts = {}): HTMLElement {
  const face = tileFace(id);
  const el = document.createElement(opts.onClick ? "button" : "div");
  if (opts.onClick) (el as HTMLButtonElement).type = "button";
  el.className = `mj-tile ${suitClass(id)}`;
  if (opts.small) el.classList.add("mj-small");
  if (opts.cursor) el.classList.add("mj-cur");
  if (opts.hot) el.classList.add("mj-hot");
  if (opts.drawn) el.classList.add("mj-drawn");
  if (opts.fly) el.classList.add("mj-fly");
  if (opts.slide) el.classList.add("mj-drawin");
  const art = document.createElement("span");
  art.className = "mj-t-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = tileArtSVG(id);
  el.appendChild(art);
  const txt = document.createElement("span");
  txt.className = "mj-t-txt";
  txt.setAttribute("aria-hidden", "true");
  const top = document.createElement("span");
  top.className = "mj-t-n";
  top.textContent = face.top;
  txt.appendChild(top);
  if (face.bottom) {
    const bottom = document.createElement("span");
    bottom.className = "mj-t-s";
    bottom.textContent = face.bottom;
    txt.appendChild(bottom);
  }
  el.appendChild(txt);
  el.setAttribute("aria-label", tileName(id));
  if (opts.onClick) el.addEventListener("click", opts.onClick);
  return el;
}

/** 一列牌背(对家手牌):绿渐变 + 四瓣花压纹,整排排成 1.5° 一档的微弧 */
export function backsEl(n: number): HTMLElement {
  const box = document.createElement("div");
  box.className = "mj-backs";
  const total = Math.max(0, n);
  for (let i = 0; i < total; i++) {
    const b = document.createElement("div");
    b.className = "mj-back";
    b.style.transform = `rotate(${((i - (total - 1) / 2) * 1.5).toFixed(2)}deg)`;
    const fl = document.createElement("span");
    fl.className = "mj-back-fl";
    fl.setAttribute("aria-hidden", "true");
    fl.innerHTML = backArtSVG();
    b.appendChild(fl);
    box.appendChild(b);
  }
  return box;
}

/**
 * 弱动效开关:尊重系统的 prefers-reduced-motion。
 * 拿不到 matchMedia(单测的 node 环境)就当没开,绝不抛异常。
 */
export function prefersSoft(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  return mm ? mm("(prefers-reduced-motion: reduce)").matches === true : false;
}

/**
 * 胡牌的樱花绽放:中心一朵五瓣花 + 12 片花瓣飘落,约 0.8s 收场。
 * `soft` 时不加任何动画类,只留一朵带金光的静态花闪一下就撤。
 */
export function bloomBurst(host: HTMLElement, soft: boolean, timers: Scheduler): HTMLElement {
  const stage = document.createElement("div");
  stage.className = "mj-bloom";
  stage.setAttribute("aria-hidden", "true");
  const core = document.createElement("span");
  core.className = `mj-bloom-core ${soft ? "mj-bloom-flash" : "mj-bloom-open"}`;
  core.innerHTML = bloomFlowerSVG();
  stage.appendChild(core);
  if (!soft) {
    for (let i = 0; i < BLOOM_PETALS; i++) {
      const p = document.createElement("span");
      p.className = "mj-petal mj-petal-fall";
      p.setAttribute("aria-hidden", "true");
      p.style.left = `${6 + ((i * 29) % 88)}%`;
      p.style.animationDelay = `${(i % 4) * 70}ms`;
      p.style.animationDuration = `${BLOOM_MS - 200 + (i % 3) * 120}ms`;
      p.innerHTML = petalSVG(i);
      stage.appendChild(p);
    }
  }
  host.appendChild(stage);
  timers.after(soft ? 420 : BLOOM_MS + 260, () => stage.remove());
  return stage;
}

/** 流局(或差一张没和)时飘在牌河上的那片落叶 */
function leafEl(): HTMLElement {
  const leaf = document.createElement("span");
  leaf.className = `mj-leaf${prefersSoft() ? "" : " mj-leaf-fall"}`;
  leaf.setAttribute("aria-hidden", "true");
  leaf.innerHTML = leafSVG();
  return leaf;
}

/** 圈风徽章升级成小罗盘:东南西北四个方位点,点亮当前圈风 */
export function windCompassEl(active: number, label: string): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "mj-badge mj-compass";
  badge.textContent = label;
  const dial = document.createElement("span");
  dial.className = "mj-dial";
  dial.setAttribute("aria-hidden", "true");
  dial.innerHTML = compassSVG(active);
  badge.appendChild(dial);
  return badge;
}

/** 「N 番起和」按门槛分花苞等级色:低=花苞绿,中=花开粉,高=金 */
export function floorBadgeClass(floor: number): string {
  if (floor <= 2) return "mj-floor-bud";
  if (floor <= 8) return "mj-floor-rose";
  return "mj-floor-gold";
}

// ---------------------------------------------------------------------------
// 定时器袋子:destroy 时一把清干净
// ---------------------------------------------------------------------------

/** 排一件事到将来做;界面与测试都照着这个口子来 */
export interface Scheduler {
  after(ms: number, fn: () => void): void;
}

class Timers implements Scheduler {
  private ids = new Set<ReturnType<typeof setTimeout>>();

  after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.ids.delete(id);
      fn();
    }, ms);
    this.ids.add(id);
  }

  clear(): void {
    for (const id of this.ids) clearTimeout(id);
    this.ids.clear();
  }
}

/** 番种一条条弹出来(同屏最多 6 条,其余滚动),返回停止函数 */
export function popFans(host: HTMLElement, fans: readonly FanHit[], total: number, timers: Scheduler): void {
  host.innerHTML = "";
  const rows = fans.slice();
  rows.forEach((f, i) => {
    timers.after(i * FAN_STEP_MS, () => {
      const row = document.createElement("div");
      row.className = "mj-fan";
      const n = document.createElement("span");
      n.textContent = f.name;
      const p = document.createElement("span");
      p.className = "mj-fan-p";
      p.textContent = `${f.points} 番`;
      row.append(n, p);
      host.appendChild(row);
      host.scrollTop = host.scrollHeight;
    });
  });
  timers.after(rows.length * FAN_STEP_MS + 60, () => {
    const row = document.createElement("div");
    row.className = "mj-fan mj-fan-total";
    const n = document.createElement("span");
    n.textContent = "合计";
    const p = document.createElement("span");
    p.className = "mj-fan-p";
    p.textContent = `${total} 番`;
    row.append(n, p);
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
  });
}

// ---------------------------------------------------------------------------
// 键位:点选为主,键盘是补充
// ---------------------------------------------------------------------------

/** 暂停层上那两行字。抽成纯函数,好让单测直接读文案 */
export function pauseVeilText(): { title: string; keys: string } {
  return {
    title: "⏸️ 先歇一会儿",
    keys: "牌桌先停住啦。点上面的「▶ 继续」,或者再按一次 Esc,就接着摸牌。"
  };
}

/**
 * 暂停的时候在牌桌上盖一层看得见的布。
 *
 * 原来暂停只有右上角那颗按钮从「⏸ 暂停」变成「▶ 继续」,牌桌本身一点变化都没有,
 * 孩子按了 Esc 常常不知道自己已经把牌局按停了。别的 11 款都有明确的一层,这一款补齐。
 */
export function renderPauseVeil(wrap: HTMLElement, paused: boolean): void {
  const old = wrap.querySelector(".mj-pause");
  if (!paused) {
    old?.remove();
    return;
  }
  if (old) return;
  const veil = document.createElement("div");
  veil.className = "mj-pause";
  veil.setAttribute("role", "status");
  const text = pauseVeilText();
  const t = document.createElement("div");
  t.className = "mj-pause-t";
  t.textContent = text.title;
  const k = document.createElement("div");
  k.className = "mj-pause-k";
  k.textContent = text.keys;
  veil.append(t, k);
  wrap.appendChild(veil);
}

export type HumanKind = "duo" | "star";

export interface KeyAction {
  who: HumanKind;
  kind: "left" | "right" | "up" | "down" | "play" | "act";
}

/** 按键 → 谁的什么动作;`Escape` 单独走暂停,不在这里 */
export function keyAction(key: string): KeyAction | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  switch (k) {
    case "a":
      return { who: "duo", kind: "left" };
    case "d":
      return { who: "duo", kind: "right" };
    case "w":
      return { who: "duo", kind: "up" };
    case "s":
      return { who: "duo", kind: "down" };
    case "f":
      return { who: "duo", kind: "play" };
    case "g":
      return { who: "duo", kind: "act" };
    case "ArrowLeft":
      return { who: "star", kind: "left" };
    case "ArrowRight":
      return { who: "star", kind: "right" };
    case "ArrowUp":
      return { who: "star", kind: "up" };
    case "ArrowDown":
      return { who: "star", kind: "down" };
    case "l":
      return { who: "star", kind: "play" };
    case "k":
      return { who: "star", kind: "act" };
    default:
      return null;
  }
}

/** 一排动作按钮里,键盘的「确认」该按哪个:胡 > 杠 > 碰 > 吃 */
export function preferredAction<T extends { kind: string }>(opts: readonly T[]): T | null {
  const order = ["ron", "tsumo", "kan", "ankan", "kakan", "pon", "chi"];
  for (const want of order) {
    const hit = opts.find((o) => o.kind === want);
    if (hit) return hit;
  }
  return opts[0] ?? null;
}

const CLAIM_LABEL: Record<string, string> = {
  chi: "吃",
  pon: "碰",
  kan: "杠",
  ron: "和",
  ankan: "暗杠",
  kakan: "加杠",
  tsumo: "自摸"
};

/** 吃三种搭法要分得开,按钮上写清用哪两张 */
export function claimButtonLabel(opt: ClaimOption | SelfOption): string {
  const base = CLAIM_LABEL[opt.kind] ?? opt.kind;
  if ("pair" in opt && opt.pair && opt.pair.length === 2) {
    return `${base} ${tileName(opt.pair[0])}${tileName(opt.pair[1])}`;
  }
  if (opt.kind === "ankan" || opt.kind === "kakan") return `${base} ${tileName(opt.tile)}`;
  return base;
}

// ---------------------------------------------------------------------------
// 闯关:残局定番题
// ---------------------------------------------------------------------------

export interface PuzzleHandle {
  destroy: () => void;
}

/**
 * 一关残局:手上 13 张 + 已有的副露,小牌墙从头摸。
 * 闲牌打掉、和牌张摸到手就能和 —— 每一关都是先造好胡牌再拆出来的,所以一定过得去。
 */
export function mountPuzzle(
  stage: HTMLElement,
  cfg: MahjongLevel,
  ctx: { win: (s: 1 | 2 | 3, msg?: string) => void; lose: (msg?: string) => void; sfx: PlayCtx["sfx"] }
): PuzzleHandle {
  const timers = new Timers();
  let destroyed = false;
  let settled = false;
  let hand = sortTiles(cfg.hand);
  const melds: Meld[] = cfg.melds.map((m) => ({ ...m, tiles: m.tiles.slice() }));
  const wall = cfg.wall.slice();
  const river: number[] = [];
  const startHand = sortTiles(cfg.hand);
  let drawn = -1;
  let cursor = 0;
  let wasted = 0;
  let flyRiver = false;
  let paused = false;
  /** 刚摸进来那张要滑入弹跳一下,画完一帧就清 */
  let drawnFresh = false;
  /** 牌墙摸空没和:牌河灰化 + 落叶 */
  let lostVeil = false;

  const wrap = document.createElement("div");
  wrap.className = "mj-wrap";
  const style = document.createElement("style");
  style.textContent = MJ_CSS;
  wrap.appendChild(style);
  const top = document.createElement("div");
  top.className = "mj-top";
  const board = document.createElement("div");
  board.className = "mj-board";
  const msg = document.createElement("div");
  msg.className = "mj-msg";
  wrap.append(top, board, msg);
  stage.appendChild(wrap);

  function full(): number[] {
    return drawn >= 0 ? sortTiles([...hand, drawn]) : hand.slice();
  }

  function canHuNow(): boolean {
    if (drawn < 0) return false;
    if (!isHu(full(), null, melds)) return false;
    return canHuWithFloor(scoreOf().points, cfg.floor);
  }

  function scoreOf(): ReturnType<typeof scoreFans> {
    return scoreFans({
      hand: full(),
      melds,
      winTile: drawn,
      selfDraw: true,
      seatWind: cfg.seatWind,
      roundWind: cfg.roundWind,
      afterKan: cfg.afterKan,
      flowers: 0
    });
  }

  function draw(): void {
    if (destroyed || settled) return;
    if (paused) {
      // 暂停时不摸牌,等继续了再接着摸
      timers.after(140, draw);
      return;
    }
    const t = wall.shift();
    if (t === undefined) {
      finish(false);
      return;
    }
    drawn = t;
    cursor = hand.length;
    drawnFresh = true;
    ctx.sfx("tap");
    render();
  }

  function play(tile: number): void {
    if (destroyed || settled || paused || drawn < 0) return;
    if (tile === drawn) {
      drawn = -1;
    } else {
      const i = hand.indexOf(tile);
      if (i < 0) return;
      hand.splice(i, 1);
      hand.push(drawn);
      drawn = -1;
      hand = sortTiles(hand);
    }
    // 打掉起手就有的牌 = 走了弯路,三星要求一步都不浪费
    if (startHand.includes(tile)) wasted++;
    river.push(tile);
    flyRiver = true;
    ctx.sfx("pop");
    render();
    timers.after(FLY_MS + 60, draw);
  }

  function declareHu(): void {
    if (destroyed || settled || !canHuNow()) return;
    finish(true);
  }

  function finish(won: boolean): void {
    if (settled) return;
    settled = true;
    if (!won) {
      lostVeil = true;
      render();
      ctx.lose("这局差一点点,把闲牌打掉、留住要凑的番种,下一次一定行。");
      return;
    }
    const scored = scoreOf();
    const gotRequire = cfg.require.every((n) => scored.names.includes(n));
    const stars = starsFor(scored.points, cfg, gotRequire, wasted);
    ctx.sfx("win");
    render();
    showFanSheet(scored.fans, scored.points, () => {
      ctx.win(stars, `${scored.points} 番开花!${scored.names.slice(0, 3).join("、")}`);
    });
  }

  function showFanSheet(fans: FanHit[], total: number, onNext: () => void): void {
    // 名副其实的「开花」:先在牌面区绽放樱花,再弹番种表
    const soft = prefersSoft();
    bloomBurst(wrap, soft, timers);
    timers.after(soft ? 220 : BLOOM_MS, () => {
      const sheet = document.createElement("div");
      sheet.className = "mj-sheet";
      const t = document.createElement("div");
      t.className = "mj-sheet-t";
      t.textContent = "🌸 开花啦!";
      const list = document.createElement("div");
      list.className = "mj-fans";
      const btns = document.createElement("div");
      btns.className = "mj-sheet-btns";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "mj-open";
      ok.textContent = "收下这些番 ▶";
      ok.addEventListener("click", () => {
        sheet.remove();
        onNext();
      });
      btns.appendChild(ok);
      sheet.append(t, list, btns);
      wrap.appendChild(sheet);
      popFans(list, fans, total, timers);
    });
  }

  function render(): void {
    if (destroyed) return;
    top.innerHTML = "";
    const goal = document.createElement("div");
    goal.className = "mj-goal";
    goal.textContent = `🎯 ${levelGoal(cfg)}`;
    const left = document.createElement("span");
    left.className = "mj-badge";
    left.textContent = `牌墙 ${wall.length} 张`;
    const wind = windCompassEl(cfg.roundWind, `${windName(cfg.roundWind)}圈 · ${windName(cfg.seatWind)}位`);
    const floor = document.createElement("span");
    floor.className = `mj-badge ${floorBadgeClass(cfg.floor)}`;
    floor.textContent = `${cfg.floor} 番起和`;
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "mj-btn mj-ghost";
    pause.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    pause.addEventListener("click", togglePause);
    top.append(goal, left, wind, floor, pause);
    renderPauseVeil(wrap, paused);

    board.innerHTML = "";
    const riverBox = document.createElement("div");
    riverBox.className = "mj-river";
    river.forEach((t, i) => {
      riverBox.appendChild(tileEl(t, { small: true, fly: flyRiver && i === river.length - 1 }));
    });
    if (river.length === 0) {
      const hint = document.createElement("div");
      hint.className = "mj-msg";
      hint.style.margin = "0";
      hint.textContent = "打出去的牌会摆在这里";
      riverBox.appendChild(hint);
    }
    if (lostVeil) {
      riverBox.classList.add("mj-dim");
      riverBox.appendChild(leafEl());
    }
    flyRiver = false;
    board.appendChild(riverBox);

    if (melds.length > 0) {
      const meldBox = document.createElement("div");
      meldBox.className = "mj-melds";
      for (const m of melds) {
        const grp = document.createElement("div");
        grp.className = "mj-meldgrp";
        grp.setAttribute("aria-label", meldLabel(m));
        for (const t of m.tiles) grp.appendChild(tileEl(t, { small: true }));
        meldBox.appendChild(grp);
      }
      board.appendChild(meldBox);
    }

    const handBox = document.createElement("div");
    handBox.className = "mj-hand";
    hand.forEach((t, i) => {
      handBox.appendChild(
        tileEl(t, { cursor: !settled && i === cursor, onClick: settled ? undefined : () => play(t) })
      );
    });
    if (drawn >= 0) {
      const gap = document.createElement("div");
      gap.className = "mj-gap";
      handBox.appendChild(gap);
      handBox.appendChild(
        tileEl(drawn, {
          drawn: true,
          slide: drawnFresh,
          cursor: !settled && cursor >= hand.length,
          hot: canHuNow(),
          onClick: settled ? undefined : () => play(drawn)
        })
      );
    }
    drawnFresh = false;
    board.appendChild(handBox);

    const acts = document.createElement("div");
    acts.className = "mj-acts";
    if (!settled && canHuNow()) {
      const hu = document.createElement("button");
      hu.type = "button";
      hu.className = "mj-btn mj-go";
      hu.textContent = "🌸 和牌";
      hu.addEventListener("click", declareHu);
      acts.appendChild(hu);
    }
    board.appendChild(acts);

    if (paused) {
      if (!wrap.querySelector(".mj-sheet-pause")) {
        const box = document.createElement("div");
        box.className = "mj-sheet mj-sheet-pause";
        const t = document.createElement("div");
        t.className = "mj-sheet-t";
        t.textContent = "☕ 歇一会儿";
        const s = document.createElement("div");
        s.className = "mj-sheet-s";
        s.textContent = "牌都给你留着,想好了再按继续。";
        const go = document.createElement("button");
        go.type = "button";
        go.className = "mj-open";
        go.textContent = "▶ 接着摸牌";
        go.addEventListener("click", togglePause);
        box.append(t, s, go);
        wrap.appendChild(box);
      }
    } else {
      wrap.querySelector(".mj-sheet-pause")?.remove();
    }

    if (settled) {
      msg.textContent = "";
    } else if (paused) {
      msg.textContent = "";
    } else if (canHuNow()) {
      msg.textContent = "番数够啦,按「和牌」就能开花!";
    } else {
      const waits = drawn < 0 ? [] : waitingTiles(hand, melds);
      msg.textContent = waits.length
        ? `听 ${waits.slice(0, 4).map(tileName).join("、")}${waits.length > 4 ? " 等" : ""},${junkHint(cfg)}`
        : junkHint(cfg);
    }
  }

  function togglePause(): void {
    if (destroyed || settled) return;
    paused = !paused;
    ctx.sfx("tap");
    render();
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (destroyed || settled) return;
    if (e.key === "Escape") {
      togglePause();
      e.preventDefault();
      return;
    }
    if (paused) return;
    const act = keyAction(e.key);
    if (!act) return;
    const total = hand.length + (drawn >= 0 ? 1 : 0);
    if (total === 0) return;
    if (act.kind === "left") {
      cursor = (cursor - 1 + total) % total;
    } else if (act.kind === "right") {
      cursor = (cursor + 1) % total;
    } else if (act.kind === "up") {
      cursor = total - 1;
    } else if (act.kind === "down") {
      cursor = 0;
    } else if (act.kind === "play") {
      const tile = cursor >= hand.length ? drawn : hand[cursor];
      if (tile >= 0) play(tile);
      e.preventDefault();
      return;
    } else if (act.kind === "act") {
      declareHu();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    render();
  };
  window.addEventListener("keydown", onKeyDown);

  render();
  timers.after(320, draw);

  return {
    destroy() {
      destroyed = true;
      timers.clear();
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    }
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  return mountPuzzle(stage, cfg, { win: ctx.win, lose: ctx.lose, sfx: ctx.sfx });
}

// ---------------------------------------------------------------------------
// 四人牌桌:对战 / 无尽 / 双人共用
// ---------------------------------------------------------------------------

export interface LiveOptions {
  seed: number;
  floor: number;
  dealer: number;
  roundWind: number;
  seats: Array<{ name: string; tier?: AiTier; human?: HumanKind }>;
  /** 闯关默认开提示,对战可关 */
  hints: boolean;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onOver: (state: TableState) => void;
}

interface Pending {
  seat: number;
  opts: ClaimOption[];
}

/** 一桌四家。所有推进都靠 timers,destroy 时全部撤掉 */
export function createLive(host: HTMLElement, opts: LiveOptions): { destroy: () => void; state: TableState } {
  const timers = new Timers();
  const rand = mulberry32(opts.seed ^ 0x9e37);
  const state = createTable({
    seed: opts.seed,
    dealer: opts.dealer,
    roundWind: opts.roundWind,
    floor: opts.floor,
    seats: opts.seats
  });

  let destroyed = false;
  let paused = false;
  let finished = false;
  /** 听牌提示:默认开着,对战里嫌它剧透可以关掉 */
  let hints = opts.hints;
  /** 等着人类拿主意的鸣牌;先问座位小的那个 */
  let pendingQueue: Pending[] = [];
  const collected: Array<{ seat: number; opt: ClaimOption }> = [];
  const cursors: Record<number, number> = {};
  let animDiscard = -1;
  let animMeldSeat = -1;
  /** 牌墙张数一变说明有人刚摸了牌,给当前行动位的新牌一个滑入弹跳 */
  let lastWallLen = -1;
  let drawSlideSeat = -1;

  const wrap = document.createElement("div");
  wrap.className = "mj-wrap";
  const style = document.createElement("style");
  style.textContent = MJ_CSS;
  wrap.appendChild(style);
  const top = document.createElement("div");
  top.className = "mj-top";
  const board = document.createElement("div");
  board.className = "mj-board";
  const msg = document.createElement("div");
  msg.className = "mj-msg";
  wrap.append(top, board, msg);
  host.appendChild(wrap);

  function humanSeats(): number[] {
    return state.seats.filter((s) => s.human).map((s) => s.seat);
  }

  function mySeat(): number {
    return humanSeats()[0] ?? 0;
  }

  function isHuman(seat: number): boolean {
    return Boolean(state.seats[seat]?.human);
  }

  function later(ms: number, fn: () => void): void {
    timers.after(ms, () => {
      if (destroyed) return;
      if (paused) {
        later(140, fn);
        return;
      }
      fn();
    });
  }

  // -- 推进 -----------------------------------------------------------------

  function step(): void {
    if (destroyed || finished) return;
    if (state.phase === "over") {
      finish();
      return;
    }
    if (state.phase === "discard") {
      stepDiscard();
      return;
    }
    if (state.phase === "claim") {
      stepClaim();
      return;
    }
  }

  function stepDiscard(): void {
    const seat = state.turn;
    if (isHuman(seat)) {
      render();
      return;
    }
    const self = chooseSelf(state, seat, selfOptions(state, seat));
    if (self?.kind === "tsumo") {
      applyHu(state, seat, true);
      opts.sfx("win");
      render();
      finish();
      return;
    }
    if (self) {
      applySelfKan(state, seat, self);
      animMeldSeat = seat;
      opts.sfx("coin");
      render();
      later(AI_THINK_MS, step);
      return;
    }
    const tile = chooseDiscard(state, seat, rand);
    if (tile < 0 || !discard(state, seat, tile)) {
      finishDraw(state);
      render();
      finish();
      return;
    }
    animDiscard = seat;
    opts.sfx("tap");
    render();
    later(AI_THINK_MS, step);
  }

  function stepClaim(): void {
    const from = state.robbing ? state.robbing.seat : state.lastDiscardSeat;
    collected.length = 0;
    pendingQueue = [];
    for (const seat of humanSeats()) {
      if (seat === from) continue;
      const list = claimOptions(state, seat);
      if (list.length > 0) pendingQueue.push({ seat, opts: list });
    }
    if (pendingQueue.length > 0) {
      render();
      return;
    }
    settleClaims();
  }

  function settleClaims(): void {
    const from = state.robbing ? state.robbing.seat : state.lastDiscardSeat;
    const wants: Array<{ seat: number; opt: ClaimOption } | null> = collected.slice();
    for (let s = 0; s < 4; s++) {
      if (s === from || isHuman(s)) continue;
      const pick = chooseClaim(state, s, claimOptions(state, s), rand);
      wants.push(pick ? { seat: s, opt: pick } : null);
    }
    const win = resolveClaims(state, wants);
    if (!win) {
      if (state.robbing) resolveRobbing(state);
      else nextTurn(state);
      render();
      later(state.phase === "over" ? 0 : AI_THINK_MS, step);
      return;
    }
    if (win.opt.kind === "ron") {
      applyHu(state, win.seat, false, from);
      opts.sfx("win");
      render();
      finish();
      return;
    }
    applyClaim(state, win.seat, win.opt);
    animMeldSeat = win.seat;
    opts.sfx("coin");
    render();
    later(AI_THINK_MS, step);
  }

  /** 人类做完选择(选了或者过了),排到下一个人 */
  function humanClaimDone(seat: number, opt: ClaimOption | null): void {
    if (opt) collected.push({ seat, opt });
    pendingQueue = pendingQueue.filter((p) => p.seat !== seat);
    if (pendingQueue.length > 0) {
      render();
      return;
    }
    settleClaims();
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    render();
    const r = state.result;
    if (r && r.kind === "hu" && r.fans.length > 0) {
      showFanSheet(r.fans, r.points, r.line, () => opts.onOver(state));
    } else {
      later(260, () => opts.onOver(state));
    }
  }

  function showFanSheet(fans: FanHit[], total: number, line: string, onNext: () => void): void {
    // 先在牌桌上开一朵樱花,花瓣落定再弹番种表
    const soft = prefersSoft();
    bloomBurst(wrap, soft, timers);
    timers.after(soft ? 220 : BLOOM_MS, () => {
      const sheet = document.createElement("div");
      sheet.className = "mj-sheet";
      const t = document.createElement("div");
      t.className = "mj-sheet-t";
      t.textContent = "🌸 这一手开花了";
      const s = document.createElement("div");
      s.className = "mj-sheet-s";
      s.textContent = line;
      const list = document.createElement("div");
      list.className = "mj-fans";
      const btns = document.createElement("div");
      btns.className = "mj-sheet-btns";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "mj-open";
      ok.textContent = "看结果 ▶";
      ok.addEventListener("click", () => {
        sheet.remove();
        onNext();
      });
      btns.appendChild(ok);
      sheet.append(t, s, list, btns);
      wrap.appendChild(sheet);
      popFans(list, fans, total, timers);
    });
  }

  // -- 人类操作 --------------------------------------------------------------

  function humanPlay(seat: number, tile: number): void {
    if (destroyed || finished || paused) return;
    if (state.phase !== "discard" || state.turn !== seat) return;
    if (!discard(state, seat, tile)) return;
    animDiscard = seat;
    opts.sfx("pop");
    render();
    later(FLY_MS + 80, step);
  }

  function humanSelf(seat: number, opt: SelfOption): void {
    if (destroyed || finished || paused) return;
    if (state.phase !== "discard" || state.turn !== seat) return;
    if (opt.kind === "tsumo") {
      applyHu(state, seat, true);
      opts.sfx("win");
      render();
      finish();
      return;
    }
    applySelfKan(state, seat, opt);
    animMeldSeat = seat;
    opts.sfx("coin");
    render();
    later(AI_THINK_MS, step);
  }

  // -- 画面 ------------------------------------------------------------------

  function seatLabel(seat: number): string {
    const s = state.seats[seat];
    const who = s.human ? "" : ` · ${AI_TIER_LABELS[s.tier]}`;
    return `${s.name}(${windName(s.wind)})${who}`;
  }

  function renderFoe(seat: number): HTMLElement {
    const s = state.seats[seat];
    const row = document.createElement("div");
    row.className = "mj-foe";
    const name = document.createElement("span");
    name.className = `mj-foe-name${state.turn === seat && state.phase === "discard" ? " mj-turn" : ""}`;
    name.textContent = `${seatLabel(seat)} ${s.score >= 0 ? "+" : ""}${s.score}`;
    row.appendChild(name);
    row.appendChild(backsEl(s.hand.length + (s.drawn >= 0 ? 1 : 0)));
    for (const m of s.melds) {
      const grp = document.createElement("div");
      grp.className = `mj-meldgrp${animMeldSeat === seat ? " mj-slide" : ""}`;
      grp.setAttribute("aria-label", meldLabel(m));
      for (const t of m.tiles) grp.appendChild(tileEl(t, { small: true }));
      row.appendChild(grp);
    }
    return row;
  }

  function render(): void {
    if (destroyed) return;
    const me = mySeat();
    drawSlideSeat = state.wall.length !== lastWallLen ? state.turn : -1;
    lastWallLen = state.wall.length;

    top.innerHTML = "";
    const wall = document.createElement("span");
    wall.className = "mj-badge";
    wall.textContent = `牌墙 ${state.wall.length}`;
    const floor = document.createElement("span");
    floor.className = `mj-badge ${floorBadgeClass(state.floor)}`;
    floor.textContent = `${state.floor} 番起和`;
    const round = windCompassEl(state.roundWind, `${windName(state.roundWind)}圈`);
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "mj-btn mj-ghost";
    hint.textContent = hints ? "💡 提示 开" : "💡 提示 关";
    hint.addEventListener("click", () => {
      opts.sfx("tap");
      hints = !hints;
      render();
    });
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "mj-btn mj-ghost";
    pause.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    pause.addEventListener("click", () => {
      opts.sfx("tap");
      paused = !paused;
      render();
    });
    top.append(wall, floor, round, hint, pause);
    renderPauseVeil(wrap, paused);

    board.innerHTML = "";
    // 对家在上,上下家在中间那行的两侧,自己永远在下方
    for (const seat of [(me + 2) % 4, (me + 3) % 4, (me + 1) % 4]) {
      board.appendChild(renderFoe(seat));
    }

    const mid = document.createElement("div");
    mid.className = "mj-mid";
    const river = document.createElement("div");
    river.className = "mj-river";
    let riverEmpty = true;
    for (let s = 0; s < 4; s++) {
      const seat = state.seats[s];
      seat.discards.forEach((t, i) => {
        riverEmpty = false;
        river.appendChild(
          tileEl(t, {
            small: true,
            fly: animDiscard === s && i === seat.discards.length - 1
          })
        );
      });
    }
    if (riverEmpty) {
      const hint = document.createElement("div");
      hint.className = "mj-msg";
      hint.style.margin = "0";
      hint.textContent = "大家打出去的牌都摆这儿";
      river.appendChild(hint);
    }
    if (finished && state.result?.kind === "draw") {
      // 流局:牌河整体灰化,飘下一片落叶
      river.classList.add("mj-dim");
      river.appendChild(leafEl());
    }
    const info = document.createElement("div");
    info.className = "mj-info";
    for (let s = 0; s < 4; s++) {
      const chip = document.createElement("span");
      chip.className = "mj-badge";
      chip.textContent = `${state.seats[s].name} ${state.seats[s].score >= 0 ? "+" : ""}${state.seats[s].score}`;
      info.appendChild(chip);
    }
    mid.append(river, info);
    board.appendChild(mid);
    animDiscard = -1;
    animMeldSeat = -1;

    for (const seat of humanSeats()) board.appendChild(renderMe(seat));

    const acts = document.createElement("div");
    acts.className = "mj-acts";
    renderActions(acts);
    board.appendChild(acts);

    msg.textContent = statusLine();

    if (paused) {
      const sheet = wrap.querySelector(".mj-sheet-pause");
      if (!sheet) {
        const box = document.createElement("div");
        box.className = "mj-sheet mj-sheet-pause";
        box.innerHTML = `<div class="mj-sheet-t">☕ 歇一会儿</div>
          <div class="mj-sheet-s">牌都给你留着,想好了再按继续。</div>`;
        const go = document.createElement("button");
        go.type = "button";
        go.className = "mj-open";
        go.textContent = "▶ 继续打牌";
        go.addEventListener("click", () => {
          opts.sfx("tap");
          paused = false;
          render();
        });
        box.appendChild(go);
        wrap.appendChild(box);
      }
    } else {
      wrap.querySelector(".mj-sheet-pause")?.remove();
    }
  }

  function renderMe(seat: number): HTMLElement {
    const s = state.seats[seat];
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "mj-foe";
    const name = document.createElement("span");
    name.className = `mj-foe-name${state.turn === seat && state.phase === "discard" ? " mj-turn" : ""}`;
    const keys = s.human === "duo" ? "WASD+F/G" : "方向键+L/K";
    name.textContent = `${seatLabel(seat)} ${s.score >= 0 ? "+" : ""}${s.score} · ${keys}`;
    head.appendChild(name);
    for (const m of s.melds) {
      const grp = document.createElement("div");
      grp.className = `mj-meldgrp${animMeldSeat === seat ? " mj-slide" : ""}`;
      grp.setAttribute("aria-label", meldLabel(m));
      for (const t of m.tiles) grp.appendChild(tileEl(t, { small: true }));
      head.appendChild(grp);
    }
    box.appendChild(head);

    const myTurn = !finished && !paused && state.phase === "discard" && state.turn === seat;
    // 听牌提示挺费算力(34 张牌逐一试胡),只在轮到自己时算一次
    const waits = hints && myTurn ? waitingTiles(s.hand, s.melds) : [];
    const cur = cursors[seat] ?? 0;
    const handBox = document.createElement("div");
    handBox.className = "mj-hand";
    s.hand.forEach((t, i) => {
      handBox.appendChild(
        tileEl(t, {
          cursor: myTurn && i === cur,
          onClick: myTurn ? () => humanPlay(seat, t) : undefined
        })
      );
    });
    if (s.drawn >= 0) {
      const gap = document.createElement("div");
      gap.className = "mj-gap";
      handBox.appendChild(gap);
      handBox.appendChild(
        tileEl(s.drawn, {
          drawn: true,
          slide: drawSlideSeat === seat,
          cursor: myTurn && cur >= s.hand.length,
          hot: hints && isHu(fullHand(s), null, s.melds),
          onClick: myTurn ? () => humanPlay(seat, s.drawn) : undefined
        })
      );
    }
    box.appendChild(handBox);
    if (hints && waits.length > 0 && myTurn) {
      const tip = document.createElement("div");
      tip.className = "mj-msg";
      tip.style.margin = "0";
      tip.textContent = `听 ${waits.slice(0, 5).map(tileName).join("、")}${waits.length > 5 ? " 等" : ""}`;
      box.appendChild(tip);
    }
    return box;
  }

  function renderActions(host2: HTMLElement): void {
    if (finished || paused) return;
    const pending = pendingQueue[0];
    if (pending) {
      for (const o of pending.opts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `mj-btn${o.kind === "ron" ? " mj-go" : ""}`;
        b.textContent = claimButtonLabel(o);
        b.addEventListener("click", () => {
          opts.sfx("coin");
          humanClaimDone(pending.seat, o);
        });
        host2.appendChild(b);
      }
      const pass = document.createElement("button");
      pass.type = "button";
      pass.className = "mj-btn mj-ghost";
      pass.textContent = "过";
      pass.addEventListener("click", () => {
        opts.sfx("tap");
        humanClaimDone(pending.seat, null);
      });
      host2.appendChild(pass);
      return;
    }
    if (state.phase !== "discard") return;
    const seat = state.turn;
    if (!isHuman(seat)) return;
    for (const o of selfOptions(state, seat)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mj-btn${o.kind === "tsumo" ? " mj-go" : ""}`;
      b.textContent = claimButtonLabel(o);
      b.addEventListener("click", () => {
        opts.sfx("coin");
        humanSelf(seat, o);
      });
      host2.appendChild(b);
    }
  }

  function statusLine(): string {
    if (paused) return "";
    if (finished) return state.result?.line ?? "";
    const pending = pendingQueue[0];
    if (pending) {
      return `${state.seats[pending.seat].name},要不要这张 ${tileName(state.lastDiscard >= 0 ? state.lastDiscard : state.robbing?.tile ?? 0)}?`;
    }
    if (state.phase === "discard") {
      const s = state.seats[state.turn];
      return s.human ? `轮到 ${s.name} 打牌,点一张打出去` : `${s.name} 在想…`;
    }
    return "看看有没有人要这张牌…";
  }

  // -- 键盘 ------------------------------------------------------------------

  const onKeyDown = (e: KeyboardEvent): void => {
    if (destroyed || finished) return;
    if (e.key === "Escape") {
      paused = !paused;
      render();
      e.preventDefault();
      return;
    }
    if (paused) return;
    const act = keyAction(e.key);
    if (!act) return;
    const seat = state.seats.find((s) => s.human === act.who)?.seat;
    if (seat === undefined) return;

    const pending = pendingQueue[0];
    if (pending && pending.seat === seat) {
      if (act.kind === "act") {
        const pick = preferredAction(pending.opts);
        if (pick) humanClaimDone(seat, pick);
        e.preventDefault();
      } else if (act.kind === "play") {
        humanClaimDone(seat, null);
        e.preventDefault();
      }
      return;
    }
    if (state.phase !== "discard" || state.turn !== seat) return;
    const s = state.seats[seat];
    const total = s.hand.length + (s.drawn >= 0 ? 1 : 0);
    if (total === 0) return;
    const cur = cursors[seat] ?? 0;
    if (act.kind === "left") cursors[seat] = (cur - 1 + total) % total;
    else if (act.kind === "right") cursors[seat] = (cur + 1) % total;
    else if (act.kind === "up") cursors[seat] = total - 1;
    else if (act.kind === "down") cursors[seat] = 0;
    else if (act.kind === "play") {
      const tile = cur >= s.hand.length ? s.drawn : s.hand[cur];
      if (tile >= 0) humanPlay(seat, tile);
      e.preventDefault();
      return;
    } else if (act.kind === "act") {
      const pick = preferredAction(selfOptions(state, seat));
      if (pick) humanSelf(seat, pick);
      e.preventDefault();
      return;
    }
    e.preventDefault();
    render();
  };
  window.addEventListener("keydown", onKeyDown);

  render();
  later(360, step);

  return {
    destroy() {
      destroyed = true;
      timers.clear();
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
    state
  };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 双人的外壳
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🀄 对战一桌",
  endless: "♾️ 快棋无尽",
  duo: "👫 双人同桌"
};

const TIER_TIP: Record<AiTier, string> = {
  rookie: "菜鸟棋友刚学会打牌,几乎不吃不碰。",
  normal: "普通棋友会按向听打,会碰但不拆顺子。",
  pro: "高手棋友有防守意识,危险牌会押着不打。",
  hell: "地狱棋友会规划八番路线,还会算你的点炮风险。"
};

/** 无尽一盘打完加多少分:自己的花分,再给赢家一点鼓励分 */
export function endlessGain(state: TableState, me: number): number {
  const r = state.result;
  if (!r) return 0;
  if (r.kind === "hu" && r.winner === me) return Math.max(1, state.seats[me].score);
  return state.seats[me].score;
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mj-mode";
  const style = document.createElement("style");
  style.textContent = MJ_CSS;
  wrap.appendChild(style);
  const head = document.createElement("div");
  head.className = "mj-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mj-back-btn";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "mj-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let live: { destroy: () => void; state: TableState } | null = null;
  let tier: AiTier = "normal";
  let round = 1;
  let total = 0;
  /** 对战 / 双人是「一圈四盘」的快棋:当前第几盘 + 四家累计花分 */
  let handNo = 1;
  let matchScore = [0, 0, 0, 0];
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function clearLive(): void {
    live?.destroy();
    live = null;
    stage.innerHTML = "";
  }

  function showOver(title: string, sub: string, again: string, onAgain: () => void): void {
    clearLive();
    const box = document.createElement("div");
    box.className = "mj-sheet";
    box.style.position = "relative";
    box.style.inset = "auto";
    const t = document.createElement("div");
    t.className = "mj-sheet-t";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "mj-sheet-s";
    s.textContent = sub;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mj-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      onAgain();
    });
    box.append(t, s, btn);
    stage.appendChild(box);
  }

  function picker(title: string, labels: string[], onPick: (i: number) => void, tip: string): void {
    clearLive();
    const t = document.createElement("div");
    t.className = "mj-goal";
    t.textContent = title;
    const row = document.createElement("div");
    row.className = "mj-optbar";
    labels.forEach((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mj-open";
      b.textContent = label;
      b.addEventListener("click", () => {
        api.play("tap");
        onPick(i);
      });
      row.appendChild(b);
    });
    const note = document.createElement("div");
    note.className = "mj-msg";
    note.textContent = tip;
    stage.append(t, row, note);
  }

  function start(): void {
    if (mode === "versus") {
      picker(
        `挑一位棋友坐下,八番起和,一圈 ${MATCH_HANDS} 盘`,
        ["🐣 菜鸟", "🙂 普通", "😎 高手", "🔥 地狱"],
        (i) => {
          tier = (["rookie", "normal", "pro", "hell"] as AiTier[])[i];
          resetMatch();
          runVersus();
        },
        "朵朵坐下方,另外三家是本机棋友。点手里的牌就能打出去,四盘轮一圈庄。"
      );
      for (const t of ["rookie", "normal", "pro", "hell"] as AiTier[]) {
        const line = document.createElement("div");
        line.className = "mj-msg";
        line.style.margin = "0";
        line.textContent = TIER_TIP[t];
        stage.appendChild(line);
      }
      return;
    }
    if (mode === "endless") {
      round = 1;
      total = 0;
      picker(
        "快棋连庄:一盘接一盘,门槛越来越高",
        ["▶ 开局"],
        () => runEndless(),
        `打赢一盘就接着打,累计花分记最好成绩。目前最好 ${best} 分。`
      );
      return;
    }
    picker(
      `朵朵和星星各坐一家,另外两家是棋友,一圈 ${MATCH_HANDS} 盘`,
      ["▶ 开局"],
      () => {
        resetMatch();
        runDuo();
      },
      "朵朵用 WASD 挑牌、F 打出、G 吃碰杠胡;星星用方向键、L 打出、K 吃碰杠胡。Esc 暂停。"
    );
  }

  /** 一盘打完的标题与那句话:赢了夸,没赢也只鼓励 */
  function handLine(st: TableState, me: number): { title: string; sub: string } {
    const r = st.result;
    const won = r?.kind === "hu" && r.winner === me;
    if (won) return { title: "开花啦!", sub: `${r?.points ?? 0} 番,这盘进账 ${st.seats[me].score} 花分。` };
    if (r?.kind === "draw") return { title: "这一盘平局", sub: "牌墙摸完了,谁都不丢分,下一盘再来。" };
    return { title: "这一盘到此为止", sub: `${r?.line ?? ""} 这局差一点点,下一局把番凑够就好啦。` };
  }

  function runVersus(): void {
    clearLive();
    chip.textContent = `🀄 ${AI_TIER_LABELS[tier]} · 第 ${handNo}/${MATCH_HANDS} 盘`;
    const seed = Math.floor(Math.random() * 1e9);
    live = createLive(stage, {
      seed,
      floor: 8,
      // 四盘轮一圈庄,每人都当一次庄家
      dealer: (handNo - 1) % 4,
      roundWind: 1,
      hints: true,
      seats: [
        { name: "朵朵", human: "duo" },
        { name: "糯糯", tier },
        { name: "星星", tier },
        { name: "云云", tier }
      ],
      sfx: (n) => api.play(n),
      onOver: (st) => {
        for (let i = 0; i < 4; i++) matchScore[i] += st.seats[i].score;
        const { title, sub } = handLine(st, 0);
        if (st.result?.kind === "hu" && st.result.winner === 0) api.addStars(1);
        if (handNo < MATCH_HANDS) {
          handNo++;
          showOver(title, `${sub} 累计 ${matchScore[0]} 花分,还剩 ${MATCH_HANDS - handNo + 1} 盘。`, "▶ 打下一盘", runVersus);
          return;
        }
        showOver("一圈四盘打完啦", matchSummary(0), "🔁 再打一圈", () => {
          resetMatch();
          runVersus();
        });
      }
    });
  }

  /** 一圈打完的成绩单:名次靠花分排,并列按座位 */
  function matchSummary(me: number): string {
    const rank = matchScore.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
    const place = rank.findIndex((x) => x.i === me) + 1;
    if (place === 1) api.addStars(3);
    return place === 1
      ? `朵朵一共 ${matchScore[me]} 花分,四盘下来排第一,今天手气真好!`
      : `朵朵一共 ${matchScore[me]} 花分,排第 ${place}。下一圈把番凑够,名次就上来了。`;
  }

  function resetMatch(): void {
    handNo = 1;
    matchScore = [0, 0, 0, 0];
  }

  function runEndless(): void {
    clearLive();
    const cfg = endlessConfig(round);
    chip.textContent = `♾️ ${cfg.label} · 累计 ${total}`;
    const seed = Math.floor(Math.random() * 1e9);
    live = createLive(stage, {
      seed,
      floor: cfg.floor,
      dealer: (round - 1) % 4,
      roundWind: 1,
      hints: true,
      seats: [
        { name: "朵朵", human: "duo" },
        { name: "糯糯", tier: cfg.tier },
        { name: "星星", tier: cfg.tier },
        { name: "云云", tier: cfg.tier }
      ],
      sfx: (n) => api.play(n),
      onOver: (st) => {
        total += endlessGain(st, 0);
        const r = st.result;
        const won = r?.kind === "hu" && r.winner === 0;
        if (total <= 0 || !won) {
          best = save.recordEndlessBest(meta.id, Math.max(0, total));
          showOver(
            "这一轮到这儿啦",
            `一共打了 ${round} 盘,累计 ${Math.max(0, total)} 花分,最好成绩 ${best}。下一次一定更远!`,
            "🔁 从头再来",
            () => {
              round = 1;
              total = 0;
              runEndless();
            }
          );
          return;
        }
        round++;
        api.addStars(1);
        showOver(
          "连庄!",
          `第 ${round - 1} 盘拿了 ${r?.points ?? 0} 番,累计 ${total} 花分。下一盘门槛 ${endlessConfig(round).floor} 番。`,
          "▶ 接着打",
          runEndless
        );
      }
    });
  }

  function runDuo(): void {
    clearLive();
    chip.textContent = `👫 第 ${handNo}/${MATCH_HANDS} 盘 · 朵朵 WASD+F/G · 星星 方向键+L/K`;
    const seed = Math.floor(Math.random() * 1e9);
    live = createLive(stage, {
      seed,
      floor: 6,
      dealer: (handNo - 1) % 4,
      roundWind: 1,
      hints: true,
      seats: [
        { name: "朵朵", human: "duo" },
        { name: "糯糯", tier: "normal" },
        { name: "星星", human: "star" },
        { name: "云云", tier: "normal" }
      ],
      sfx: (n) => api.play(n),
      onOver: (st) => {
        for (let i = 0; i < 4; i++) matchScore[i] += st.seats[i].score;
        const done = handNo >= MATCH_HANDS;
        const duoScore = matchScore[0];
        const starScore = matchScore[2];
        const line =
          duoScore === starScore
            ? "朵朵和星星打成平手,再来一盘分高下!"
            : duoScore > starScore
              ? `朵朵 ${duoScore} 分,星星 ${starScore} 分,朵朵暂时领先。`
              : `星星 ${starScore} 分,朵朵 ${duoScore} 分,星星暂时领先。`;
        if (!done) {
          handNo++;
          showOver("这一盘结束啦", `${line} 还剩 ${MATCH_HANDS - handNo + 1} 盘。`, "▶ 打下一盘", runDuo);
          return;
        }
        api.addStars(2);
        showOver("一圈四盘打完啦", `${line} 两个人都很厉害,再来一圈吧!`, "🔁 再打一圈", () => {
          resetMatch();
          runDuo();
        });
      }
    });
  }

  start();

  return {
    destroy() {
      clearLive();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = MJ_CSS;
  const bar = document.createElement("div");
  bar.className = "mj-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "mj-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mj-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关内把模式入口收起来:手机上这一条要占约 150px,牌桌能整个抬进首屏
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const h = playLevel(stage, ctx);
        return {
          destroy() {
            h?.destroy?.();
            bar.hidden = false;
          }
        };
      },
      mapHint: "每一关都是先摆好一副胡牌再拆出来的,把闲牌打掉就一定能和。",
      grandMessage: "188 关全部开花,你就是花开麻将的小牌王!",
      guide,
      guideTitle: "花开麻将 · 番种笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量与工具 */
export const MJ_CONSTS = { FLY_MS, MELD_MS, FAN_STEP_MS, FAN_VISIBLE, AI_THINK_MS, BLOOM_MS, BLOOM_PETALS };

/** 测试用:一关残局按既定路线能不能过 */
export function levelSolvable(level: number): boolean {
  return solveLevel(levelConfig(level)).solvable;
}

/** 测试用:某档棋友的一句介绍 */
export function tierTip(t: AiTier): string {
  return TIER_TIP[t];
}

/** 测试用:某张牌该用什么颜色画 */
export function tileColorClass(id: number): string {
  return suitClass(id);
}

/** 测试用:能不能杠(界面按钮亮不亮跟它一致) */
export function kanAvailable(hand: readonly number[], melds: readonly Meld[]): boolean {
  return kanOptions(hand, melds).length > 0;
}

/** 测试用:字牌在牌面上只画一个字 */
export function faceOf(id: number): { top: string; bottom: string } {
  return isHonor(id) ? { top: tileFace(id).top, bottom: "" } : tileFace(id);
}
