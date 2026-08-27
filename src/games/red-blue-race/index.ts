import { meta } from "./meta";
export { meta };

import { mountLevelGame, mulberry32, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, TRACK_LEN, type Obstacle, type ObstacleType, type RaceLevel } from "./levels";
import {
  ENDLESS_MAX_HITS,
  ITEM_BOOST,
  ITEM_SLOW_FACTOR,
  ITEM_SLOW_MS,
  adaptiveAiSpeed,
  comboMultiplier,
  endlessChaserSpeed,
  endlessDensity,
  endlessGapMeters,
  endlessHitsLeft,
  endlessRunOver,
  inZone,
  isNewRecord,
  mechanicsOf,
  nextCombo,
  staminaStepFactor
} from "./logic";
import {
  FIRST_TAP_GAP_MS,
  HUMAN_TAP_CAP_HZ,
  initRhythm,
  tapRhythm,
  type RhythmState,
  type StepKey
} from "./rhythm";
import {
  buildDuelTrack,
  buildMirroredLanes,
  falseStartVerdict,
  handicapBoost,
  handicapLabel,
  lanesMirrored,
  leadHint,
  startDelayMs
} from "./fair";
import { AI_LEVELS, aiMisses, aiPacePerSec, aiStumbleSec, profileOf, respectsHumanCap, type AiLevel } from "./ai";
import { bindRaceKeys, type KeyHost, type RaceKeyHit } from "./keys";
import { fitRaceStage } from "./fit";
import {
  FINISH_SLOWMO_MS,
  confettiCount,
  prefersReducedMotion,
  runCycleMs,
  settleClickAccepted,
  speedRatio
} from "./feel";

const OB_EMOJI: Record<ObstacleType, string> = {
  puddle: "💧",
  hurdle: "🚧",
  hill: "⛰️",
  star: "⭐",
  item: "🎁"
};

/**
 * 让分开关是「这次坐下来玩」的设置:默认关,开了以后本次会话都记着,
 * 但不写任何存档 key(存档 key 只增不改,这种临时偏好不该去占一个)。
 */
let handicapOn = false;

/** 起跑口令的三段话 */
const START_WORDS = { ready: "各就位…", set: "预备…", go: "跑!" };

// ---------------------------------------------------------------------------
// 样式:本款一律 rbr- / rbe- / rbv- 前缀,红蓝三连的另外两款一个选择器都不共用
// ---------------------------------------------------------------------------

const CSS = `
.rbr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F8E0, #FFF7E0); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; overflow: hidden; }
.rbr-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.rbr-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 700; color: #3F6B33; box-shadow: 0 2px 6px rgba(110,170,90,.25); font-size: 14px; }
.rbr-badge.rbr-badge-right { padding: 4px 4px 4px 12px; }
.rbr-ava { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(90,130,80,.3); }
.rbr-meters { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 14px; font-weight: 800; color: #3F6B33; }
.rbr-runner-img { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; box-shadow: 0 3px 8px rgba(90,110,80,.35); background: #fff; display: block; }
.rbr-runner.rbr-me .rbr-runner-img { border-color: #FFB3B3; }
.rbr-runner.rbr-airun .rbr-runner-img { border-color: #A9C6FF; }
.rbr-lane { position: relative; height: 60px; border-radius: 14px; margin-bottom: 8px; overflow: hidden; }
.rbr-lane-red { background: linear-gradient(180deg, #FFE4E4, #FFD4D4); }
.rbr-lane-blue { background: linear-gradient(180deg, #E0EEFF, #D0E4FF); }
.rbr-lane-tag { position: absolute; left: 8px; top: 4px; font-size: 12px; font-weight: 800; color: #5A5A5A; opacity: .75; }
.rbr-finish { position: absolute; right: 4px; top: 0; bottom: 0; display: flex; align-items: center; font-size: 22px; }
.rbr-ground { position: absolute; left: 0; right: 0; bottom: 6px; height: 2px; background: rgba(120,120,120,.22); }
.rbr-speed { position: absolute; height: 2px; border-radius: 2px; background: rgba(90,110,90,.3); opacity: 0; }
.rbr-lane-run .rbr-speed { animation: rbrSpeed .5s linear infinite; }
@keyframes rbrSpeed { 0% { transform: translateX(14px); opacity: 0; } 40% { opacity: .8; } 100% { transform: translateX(-46px); opacity: 0; } }
.rbr-runner { position: absolute; top: 50%; transform: translateY(-50%); font-size: 30px; transition: left .12s linear; }
.rbr-runner-inner { display: block; animation: rbrStride .7s ease-in-out infinite; }
.rbr-runner.rbr-jump .rbr-runner-inner { animation: none; }
.rbr-runner.rbr-jump { animation: rbrJump .45s ease; }
@keyframes rbrJump { 0%,100% { transform: translateY(-50%); } 50% { transform: translateY(-112%); } }
@keyframes rbrStride { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-3px) rotate(4deg); } }
.rbr-ob { position: absolute; top: 4px; font-size: 17px; opacity: .9; transition: opacity .2s ease; }
.rbr-ob-gone { opacity: .22; filter: grayscale(1); }
.rbr-hill { position: absolute; top: 0; bottom: 0; background: rgba(160,130,80,.18); border-radius: 8px; }
.rbr-gear { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; min-height: 22px; }
.rbr-chip { display: inline-flex; align-items: center; gap: 5px; background: #ffffffd9; border-radius: 999px; padding: 4px 11px; font-size: 14px; font-weight: 800; color: #3F6B33; box-shadow: 0 2px 5px rgba(110,150,90,.2); }
/* 让分开关原来只有 30px 高,偏偏是攻略点名推荐、大人最常点的那一颗(窗口5 第1轮 W5-A-03) */
.rbr-chip-btn { border: none; cursor: pointer; font-family: inherit; min-height: 44px; }
.rbr-chip-btn:active { transform: translateY(1px); }
.rbr-chip-btn:focus-visible { outline: 3px solid #2A5B3C; outline-offset: 3px; }
.rbr-chip-on { background: #FFEFC4; color: #7A4E0E; }
.rbr-stam { flex: 1; min-width: 110px; height: 14px; border-radius: 999px; background: #ffffffb8; overflow: hidden; box-shadow: inset 0 1px 3px rgba(90,120,70,.22); }
.rbr-stam-fill { height: 100%; width: 100%; border-radius: 999px; background: linear-gradient(90deg, #8FD98A, #59B96F); transition: width .1s linear; }
.rbr-stam-low .rbr-stam-fill { background: linear-gradient(90deg, #FFC48F, #E0703C); }
.rbr-beat { width: 14px; height: 14px; border-radius: 50%; background: #E48BB4; animation: rbrBeat 1s ease-in-out infinite; }
@keyframes rbrBeat { 0%,100% { transform: scale(.75); opacity: .55; } 50% { transform: scale(1.35); opacity: 1; } }
.rbr-call { text-align: center; font-size: 20px; font-weight: 900; color: #3F6B33; min-height: 26px; margin: 2px 0 6px; letter-spacing: 2px; }
.rbr-call-go { color: #A83232; }
.rbr-pads { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
.rbr-pads-duo { align-items: start; }
.rbr-side { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #ffffff8c; border-radius: 18px; padding: 8px; }
.rbr-side-title { grid-column: 1 / -1; text-align: center; font-size: 14px; font-weight: 900; color: #444; }
.rbr-step { min-height: 72px; border: none; border-radius: 18px; font-size: 19px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; touch-action: manipulation; padding: 6px; }
.rbr-side .rbr-step { min-height: 64px; font-size: 17px; }
.rbr-step-red { background: linear-gradient(180deg, #FF8A8A, #D0403F); box-shadow: 0 5px 0 #9E2F2F; }
.rbr-step-red:active { transform: translateY(3px); box-shadow: 0 2px 0 #9E2F2F; }
.rbr-step-blue { background: linear-gradient(180deg, #7FBFFF, #3873C4); box-shadow: 0 5px 0 #2A5793; }
.rbr-step-blue:active { transform: translateY(3px); box-shadow: 0 2px 0 #2A5793; }
.rbr-step:focus-visible, .rbr-jump-btn:focus-visible { outline: 3px solid #1F2A22; outline-offset: 3px; }
.rbr-jump-btn { grid-column: 1 / -1; min-height: 64px; border: none; border-radius: 18px; font-size: 18px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; touch-action: manipulation; background: linear-gradient(180deg, #7FC48C, #35804F); box-shadow: 0 5px 0 #27653C; }
.rbr-jump-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #27653C; }
.rbr-keyhint { text-align: center; font-size: 13px; font-weight: 700; color: #4F6048; margin-top: 6px; }
.rbr-msg { text-align: center; min-height: 20px; color: #3F6B33; font-weight: 700; margin-top: 8px; font-size: 14px; }
.rbr-confetti { position: absolute; top: -14px; width: 8px; height: 14px; border-radius: 2px; pointer-events: none; animation: rbrFall 1.1s ease-in forwards; }
@keyframes rbrFall { to { transform: translateY(340px) rotate(320deg); opacity: 0; } }
.rbr-slowmo .rbr-runner { transition: left .5s ease-out; }
@media (max-width: 420px) {
  .rbr-step { font-size: 17px; }
  .rbr-side { padding: 6px; gap: 6px; }
  .rbr-side .rbr-step { font-size: 15px; }
  .rbr-pads { gap: 6px; }
}
/* ---------------------------------------------------------------------------
   舞台矮到装不下这一屏时逐档收紧(fit.ts 实测祖先裁切线后挂上来,窗口5 第2轮 W5R2-A-02)。
   收的都是留白 / 字号 / 装饰;跑动键最狠一档仍有 52px、让分开关仍是 44px。
   写不成媒体查询:舞台比视口矮一大截,按 vh 判会判成「够高,不用收」。
   --------------------------------------------------------------------------- */
.rbr-tight { padding: 9px; }
.rbr-tight .rbr-top { gap: 4px; margin-bottom: 5px; }
.rbr-tight .rbr-badge { font-size: 12px; padding: 3px 9px 3px 3px; }
.rbr-tight .rbr-badge.rbr-badge-right { padding: 3px 3px 3px 9px; }
.rbr-tight .rbr-ava { width: 22px; height: 22px; border-width: 1px; }
.rbr-tight .rbr-meters { font-size: 12px; gap: 4px; }
.rbr-tight .rbr-gear { margin-bottom: 5px; gap: 6px; }
.rbr-tight .rbr-chip { font-size: 12px; padding: 3px 9px; }
.rbr-tight .rbr-lane { height: 52px; margin-bottom: 5px; }
.rbr-tight .rbr-runner { font-size: 25px; }
.rbr-tight .rbr-runner-img { width: 34px; height: 34px; border-width: 2px; }
.rbr-tight .rbr-call { font-size: 16px; min-height: 20px; margin: 0 0 4px; letter-spacing: 1px; }
/* 跳键原来独占一整行,是这一屏最下面那 64px;收成三键一排,高度直接省掉一行 */
.rbr-tight .rbr-pads:not(.rbr-pads-duo) { grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 5px; }
.rbr-tight .rbr-pads:not(.rbr-pads-duo) .rbr-jump-btn { grid-column: auto; }
.rbr-tight .rbr-step, .rbr-tight .rbr-jump-btn { min-height: 60px; font-size: 16px; }
.rbr-tight .rbr-side { padding: 5px; gap: 5px; }
.rbr-tight .rbr-side-title { font-size: 12px; }
.rbr-tight .rbr-side .rbr-step { min-height: 52px; font-size: 14px; }
/* 键盘提示对触屏没用,而它正压在跳键下面 */
.rbr-tight .rbr-keyhint { display: none; }
.rbr-tight .rbr-msg, .rbr-tight .rbe-msg { font-size: 12px; margin-top: 5px; min-height: 16px; }
.rbr-tight .rbe-head { margin-bottom: 6px; gap: 6px; }
.rbr-tight .rbe-chip { font-size: 12px; padding: 4px 9px; }
.rbr-tight .rbe-lane { height: 78px; margin-bottom: 5px; }
.rbr-tight .rbe-face { width: 34px; height: 34px; }
.rbr-tight .rbv-head { margin-bottom: 5px; }
.rbr-tight .rbv-foes { padding: 2px 0 5px; }
.rbr-tight .rbv-foe-note { margin-bottom: 4px; min-height: 15px; font-size: 12px; }
.rbr-tighter { padding: 7px; }
/* 名字和头像在赛道条上还各挂着一份,抬头条这一份让位给「点得着」 */
.rbr-tighter .rbr-badge { display: none; }
.rbr-tighter .rbr-top { margin-bottom: 4px; }
.rbr-tighter .rbr-lane { height: 44px; margin-bottom: 4px; }
.rbr-tighter .rbr-runner-img { width: 28px; height: 28px; }
.rbr-tighter .rbr-runner { font-size: 21px; }
.rbr-tighter .rbr-ob { font-size: 15px; top: 2px; }
.rbr-tighter .rbr-finish { font-size: 18px; }
.rbr-tighter .rbr-call { font-size: 15px; min-height: 18px; margin: 0 0 3px; }
.rbr-tighter .rbr-step, .rbr-tighter .rbr-jump-btn { min-height: 52px; font-size: 15px; }
.rbr-tighter .rbr-side .rbr-step { min-height: 46px; font-size: 13px; }
.rbr-tighter .rbr-msg, .rbr-tighter .rbe-msg { font-size: 11px; margin-top: 4px; min-height: 14px; line-height: 1.35; }
.rbr-tighter .rbe-lane { height: 66px; }
.rbr-tighter .rbe-face { width: 28px; height: 28px; }
@media (prefers-reduced-motion: reduce) {
  .rbr-lane-run .rbr-speed { animation: none; opacity: 0; }
  .rbr-runner-inner { animation: none; }
  .rbr-beat { animation: none; }
  .rbr-confetti { display: none; }
}
`;

const ENDLESS_CSS = `
.rbe-bar { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
/* 对战场 / 无尽两个入口原来 40px 高,差 4px 够不到触屏口径(窗口5 第1轮 W5-A-04) */
.rbe-open { border: none; border-radius: 999px; padding: 10px 20px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FC98A, #33845A); box-shadow: 0 4px 0 #276A47; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
.rbe-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #276A47; }
.rbe-open:focus-visible { outline: 3px solid #21402F; outline-offset: 3px; }
.rbe-open-versus { background: linear-gradient(180deg, #F09A9A, #BE4245); box-shadow: 0 4px 0 #953336; }
.rbe-open-versus:active { box-shadow: 0 2px 0 #953336; }
.rbe-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E7F4FF, #FFF1E6); border-radius: 20px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; overflow: hidden; }
.rbe-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.rbe-back { border: none; border-radius: 999px; padding: 8px 14px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #2C6349; box-shadow: 0 3px 0 rgba(60,120,90,.3); min-height: 36px; }
.rbe-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(60,120,90,.3); }
.rbe-back:focus-visible { outline: 3px solid #21402F; outline-offset: 3px; }
.rbe-chip { background: #fff; border-radius: 999px; padding: 5px 12px; font-size: 14px; font-weight: 800; color: #2C6349; box-shadow: 0 2px 6px rgba(110,160,130,.24); }
.rbe-lane { position: relative; height: 104px; border-radius: 16px; overflow: hidden; background: linear-gradient(180deg, #FFF6DE 0 62%, #E6F2CF 62% 100%); margin-bottom: 8px; }
.rbe-ground { position: absolute; left: 0; right: 0; top: 62%; height: 3px; background: rgba(120,140,90,.5); }
.rbe-me, .rbe-pacer { position: absolute; top: 26%; transform: translateY(-26%); transition: left .1s linear; }
.rbe-face { width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; background: #fff; display: block; box-shadow: 0 3px 8px rgba(110,130,90,.32); }
.rbe-me .rbe-face { border-color: #FFB3B3; }
.rbe-pacer .rbe-face { border-color: #A9C6FF; opacity: .85; }
.rbe-me.rbe-jump { animation: rbeJump .42s ease; }
@keyframes rbeJump { 0%,100% { transform: translateY(-26%); } 50% { transform: translateY(-96%); } }
.rbe-ob { position: absolute; top: 40%; font-size: 22px; transition: left .1s linear; }
.rbe-msg { text-align: center; min-height: 20px; font-size: 14px; font-weight: 700; color: #2C6349; margin-top: 8px; }
.rbe-over { position: absolute; inset: 0; border-radius: 20px; background: rgba(255,252,246,.97); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rbe-over-title { font-size: 22px; font-weight: 900; color: #2C6349; }
.rbe-over-sub { font-size: 15px; font-weight: 700; color: #46604F; line-height: 1.6; max-width: 300px; }
.rbe-over-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FC98A, #33845A); box-shadow: 0 5px 0 #276A47; min-height: 48px; }
.rbe-over-btn.rbe-ghost { background: linear-gradient(180deg, #7FA8FF, #3B58BE); box-shadow: 0 5px 0 #2E4595; }
.rbe-over-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #276A47; }
.rbe-over-btn:focus-visible { outline: 3px solid #1F2A22; outline-offset: 3px; }
@media (max-width: 420px) {
  .rbe-lane { height: 92px; }
  .rbe-face { width: 36px; height: 36px; }
}
@media (prefers-reduced-motion: reduce) {
  .rbe-me.rbe-jump { animation: none; }
}
`;

const VERSUS_CSS = `
.rbv-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F0, #EFF4FF); border-radius: 20px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; overflow: hidden; }
.rbv-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.rbv-score { font-size: 16px; font-weight: 900; color: #3E3C52; background: #fff; border-radius: 999px; padding: 5px 14px; box-shadow: 0 2px 6px rgba(120,120,160,.22); }
.rbv-foes { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: none; }
.rbv-foes::-webkit-scrollbar { display: none; }
.rbv-foe { flex: 0 0 auto; border: none; border-radius: 14px; padding: 9px 12px; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; background: #ffffffc4; color: #43435C; box-shadow: 0 2px 5px rgba(120,120,160,.2); white-space: nowrap; min-height: 40px; }
.rbv-foe-on { background: #FFDFDF; color: #86333A; outline: 3px solid #fff; }
.rbv-foe:focus-visible { outline: 3px solid #1F2A22; outline-offset: 3px; }
.rbv-foe-note { font-size: 13px; font-weight: 700; color: #4F4F66; text-align: center; margin-bottom: 6px; min-height: 18px; }
.rbv-over { position: absolute; inset: 0; border-radius: 20px; background: rgba(255,252,253,.97); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rbv-over-title { font-size: 23px; font-weight: 900; color: #6F3459; }
.rbv-over-sub { font-size: 15px; font-weight: 700; color: #514461; line-height: 1.6; max-width: 320px; }
.rbv-over-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #C84483, #972C60); box-shadow: 0 5px 0 #7C234F; min-height: 48px; }
.rbv-over-btn.rbv-ghost { background: linear-gradient(180deg, #5470C0, #364E96); box-shadow: 0 5px 0 #2B3E78; }
.rbv-over-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #7C234F; }
.rbv-over-btn:focus-visible { outline: 3px solid #1F2A22; outline-offset: 3px; }
`;

// ---------------------------------------------------------------------------
// 小工具:定时器 / 监听 / rAF 的登记簿,destroy 一次全收
// ---------------------------------------------------------------------------

interface Runtime {
  later: (fn: () => void, ms: number) => void;
  frame: (cb: FrameRequestCallback) => void;
  stopFrame: () => void;
  own: (off: () => void) => void;
  dead: () => boolean;
  dispose: () => void;
}

function createRuntime(): Runtime {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  let raf = 0;
  let dead = false;
  return {
    later(fn, ms) {
      if (dead) return;
      const t = setTimeout(() => {
        timeouts.delete(t);
        if (!dead) fn();
      }, ms);
      timeouts.add(t);
    },
    frame(cb) {
      if (dead) return;
      raf = requestAnimationFrame(cb);
    },
    stopFrame() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    own(off) {
      offs.push(off);
    },
    dead: () => dead,
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      raf = 0;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      while (offs.length) {
        const off = offs.pop();
        try {
          off?.();
        } catch (err) {
          console.warn("[一朵一星] red-blue-race 清理出错:", err);
        }
      }
    }
  };
}

const CONFETTI_COLORS = ["#FF8A8A", "#7FBFFF", "#FFD37A", "#8FD98A", "#D8A6F0"];

/** 冲线彩带:减弱动效时一条都不撒 */
function spawnConfetti(host: HTMLElement, rt: Runtime, reduced: boolean): void {
  const n = confettiCount(reduced);
  for (let i = 0; i < n; i++) {
    const bit = document.createElement("i");
    bit.className = "rbr-confetti";
    bit.style.left = `${6 + Math.random() * 88}%`;
    bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    bit.style.animationDelay = `${Math.random() * 0.25}s`;
    host.appendChild(bit);
    rt.later(() => bit.remove(), 1400);
  }
}

interface LaneView {
  el: HTMLElement;
  setPos: (pos: number) => void;
  setStride: (ratio: number) => void;
  setRunning: (on: boolean) => void;
  jump: () => void;
  fade: (index: number) => void;
}

/** 一条跑道:机关标记 + 跑者 + 地面速度线。红蓝两条完全一样,只有底色不同 */
function buildLane(
  side: "red" | "blue",
  avatar: string,
  alt: string,
  tag: string,
  obstacles: readonly Obstacle[],
  reduced: boolean,
  rt: Runtime
): LaneView {
  const el = document.createElement("div");
  el.className = `rbr-lane rbr-lane-${side}`;
  const tagEl = document.createElement("div");
  tagEl.className = "rbr-lane-tag";
  tagEl.textContent = tag;
  el.appendChild(tagEl);

  for (let i = 0; i < 4; i++) {
    const line = document.createElement("i");
    line.className = "rbr-speed";
    line.style.left = `${18 + i * 22}%`;
    line.style.bottom = `${9 + (i % 2) * 6}px`;
    line.style.width = `${14 + (i % 3) * 8}px`;
    line.style.animationDelay = `${i * 0.12}s`;
    el.appendChild(line);
  }

  const ground = document.createElement("div");
  ground.className = "rbr-ground";
  el.appendChild(ground);

  const obEls = new Map<number, HTMLElement>();
  obstacles.forEach((ob, i) => {
    if (ob.type === "hill") {
      const zone = document.createElement("div");
      zone.className = "rbr-hill";
      zone.style.left = `${ob.pos}%`;
      zone.style.width = `${ob.len}%`;
      el.appendChild(zone);
    }
    const mark = document.createElement("div");
    mark.className = "rbr-ob";
    mark.style.left = `${ob.pos}%`;
    mark.textContent = OB_EMOJI[ob.type];
    el.appendChild(mark);
    obEls.set(i, mark);
  });

  const finish = document.createElement("div");
  finish.className = "rbr-finish";
  finish.textContent = "🏁";
  el.appendChild(finish);

  const runner = document.createElement("div");
  runner.className = `rbr-runner ${side === "red" ? "rbr-me" : "rbr-airun"}`;
  runner.style.left = "0%";
  const inner = document.createElement("span");
  inner.className = "rbr-runner-inner";
  const img = document.createElement("img");
  img.className = "rbr-runner-img";
  img.src = avatar;
  img.alt = alt;
  inner.appendChild(img);
  runner.appendChild(inner);
  el.appendChild(runner);
  if (reduced) inner.style.animation = "none";

  return {
    el,
    setPos(pos) {
      runner.style.left = `${Math.max(0, Math.min(92, pos * 0.92))}%`;
    },
    setStride(ratio) {
      if (reduced) return;
      // 跑步动画随速度变频:跑得越快腿摆得越快
      inner.style.animationDuration = `${runCycleMs(ratio)}ms`;
    },
    setRunning(on) {
      el.classList.toggle("rbr-lane-run", on && !reduced);
    },
    jump() {
      runner.classList.add("rbr-jump");
      rt.later(() => runner.classList.remove("rbr-jump"), 450);
    },
    fade(index) {
      obEls.get(index)?.classList.add("rbr-ob-gone");
    }
  };
}

/** 让分开关那颗芯片:点一下切换,文字与 aria-pressed 一起更新 */
function buildHandicapChip(onToggle: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  const sync = (): void => {
    btn.className = `rbr-chip rbr-chip-btn${handicapOn ? " rbr-chip-on" : ""}`;
    btn.textContent = handicapLabel(handicapOn);
    btn.setAttribute("aria-pressed", String(handicapOn));
  };
  btn.addEventListener("click", () => {
    handicapOn = !handicapOn;
    sync();
    onToggle();
  });
  sync();
  return btn;
}

interface PadSet {
  left: HTMLButtonElement;
  right: HTMLButtonElement;
  jump: HTMLButtonElement;
}

function stepButton(side: "red" | "blue", label: string, aria: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `rbr-step rbr-step-${side}`;
  b.textContent = label;
  b.setAttribute("aria-label", aria);
  return b;
}

function jumpButton(aria: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rbr-jump-btn";
  b.textContent = "🦘 跳";
  b.setAttribute("aria-label", aria);
  return b;
}

/** 单人:左右半屏各一颗大按钮(左脚 / 右脚),跳横跨整行 */
function buildSoloPads(): { el: HTMLElement; pad: PadSet } {
  const el = document.createElement("div");
  el.className = "rbr-pads";
  const left = stepButton("red", "👟 左脚", "左脚,和右脚交替按");
  const right = stepButton("red", "👟 右脚", "右脚,和左脚交替按");
  const jump = jumpButton("跳跃");
  el.append(left, right, jump);
  return { el, pad: { left, right, jump } };
}

/** 双人:左半屏归朵朵、右半屏归星星,各自一套左右脚 + 跳 */
function buildDuoPads(): { el: HTMLElement; red: PadSet; blue: PadSet } {
  const el = document.createElement("div");
  el.className = "rbr-pads rbr-pads-duo";
  const make = (side: "red" | "blue", who: string, hint: string): PadSet => {
    const box = document.createElement("div");
    box.className = "rbr-side";
    const head = document.createElement("div");
    head.className = "rbr-side-title";
    head.textContent = `${who}　${hint}`;
    const left = stepButton(side, "👟 左", `${who}左脚`);
    const right = stepButton(side, "👟 右", `${who}右脚`);
    const jump = jumpButton(`${who}跳跃`);
    box.append(head, left, right, jump);
    el.appendChild(box);
    return { left, right, jump };
  };
  const red = make("red", "朵朵", "A / D · W");
  const blue = make("blue", "星星", "← / → · ↑");
  return { el, red, blue };
}

/** 按下就响应(不等 click,连点才跟得上手) */
function onPress(btn: HTMLButtonElement, fn: () => void): void {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fn();
  });
}

interface StartGate {
  /** 口令喊过没有 */
  started: () => boolean;
  /** 某一方还要冻结到什么时候(抢跑回退用) */
  frozenUntil: (racer: "red" | "blue") => number;
  /** 抢跑:登记一次,返回给玩家看的提示 */
  falseStart: (racer: "red" | "blue") => string;
}

/**
 * 起跑口令:「各就位 → 预备 →(随机 700–2100ms)→ 跑!」。
 * 口令没响就按算抢跑:那一方回退 0.5 秒(累计封顶 1.5 秒),**不判负**。
 */
function createStartGate(callEl: HTMLElement, rt: Runtime, rand: () => number, onGo: () => void): StartGate {
  let started = false;
  const falseStarts = { red: 0, blue: 0 };
  const setback = { red: 0, blue: 0 };
  const frozenUntil = { red: 0, blue: 0 };

  callEl.textContent = START_WORDS.ready;
  callEl.classList.remove("rbr-call-go");
  rt.later(() => {
    callEl.textContent = START_WORDS.set;
    rt.later(() => {
      started = true;
      callEl.textContent = START_WORDS.go;
      callEl.classList.add("rbr-call-go");
      const now = performance.now();
      frozenUntil.red = setback.red > 0 ? now + setback.red : 0;
      frozenUntil.blue = setback.blue > 0 ? now + setback.blue : 0;
      onGo();
      rt.later(() => {
        callEl.textContent = "";
        callEl.classList.remove("rbr-call-go");
      }, 700);
    }, startDelayMs(rand));
  }, 500);

  return {
    started: () => started,
    frozenUntil: (racer) => frozenUntil[racer],
    falseStart(racer) {
      falseStarts[racer]++;
      const verdict = falseStartVerdict(falseStarts[racer]);
      setback[racer] = verdict.setbackMs;
      return verdict.message;
    }
  };
}

/** 全局键盘:两套键位一起挂,返回的函数一次全卸 */
function bindKeys(duo: boolean, onHit: (hit: RaceKeyHit) => void): () => void {
  return bindRaceKeys(window as unknown as KeyHost, duo, (hit) => onHit(hit));
}

// ---------------------------------------------------------------------------
// 闯关:188 关,单人对小电脑
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: RaceLevel = LEVELS[ctx.level];
  const rt = createRuntime();
  const reduced = prefersReducedMotion();
  let ended = false;
  let lastTime = 0;
  let me = 0;
  let ai = 0;
  let stunnedUntil = 0;
  let jumping = false;
  let rhythm: RhythmState = initRhythm();
  let lastTapAt = 0;
  let tapHz = 0;
  const clearedObs = new Set<number>();
  const aiPassed = new Set<number>();
  let aiPauseUntil = 0;
  // 1.1 的四个机制(体力 / 礼物箱 / 节拍 / 读招)原样留着
  const staminaMax = cfg.stamina ?? 0;
  let stamina = staminaMax;
  let combo = 0;
  let aiSlowUntil = 0;
  let meSlowUntil = 0;

  const gears = mechanicsOf(cfg);
  // 两条道用同一张机关表各拿一份副本:种类、位置、长度完全镜像
  const lanes = buildMirroredLanes(cfg.obstacles);
  if (!lanesMirrored(lanes.red, lanes.blue)) {
    console.error("[一朵一星] red-blue-race 两条赛道不镜像,这一关的公平性有问题");
  }

  const wrap = document.createElement("div");
  wrap.className = "rbr-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  const top = document.createElement("div");
  top.className = "rbr-top";
  top.innerHTML = `
    <span class="rbr-badge"><img class="rbr-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵</span>
    <span class="rbr-meters"><span class="rbr-chip rbr-dist">0 米</span><span class="rbr-chip rbr-lead">并排起跑</span></span>
    <span class="rbr-badge rbr-badge-right">🔵 星星<img class="rbr-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
  `;
  wrap.appendChild(top);

  const gearEl = document.createElement("div");
  gearEl.className = "rbr-gear";
  wrap.appendChild(gearEl);

  const redLane = buildLane("red", AVATAR_URLS.duoduo, "朵朵在奔跑", "朵朵", lanes.red, reduced, rt);
  const blueLane = buildLane("blue", AVATAR_URLS.xingxing, "星星在奔跑", "星星", lanes.blue, reduced, rt);
  wrap.append(redLane.el, blueLane.el);

  const callEl = document.createElement("div");
  callEl.className = "rbr-call";
  callEl.setAttribute("role", "status");
  wrap.appendChild(callEl);

  const { el: padsEl, pad } = buildSoloPads();
  wrap.appendChild(padsEl);

  const keyHint = document.createElement("div");
  keyHint.className = "rbr-keyhint";
  keyHint.textContent = "键盘:A / D 或 ← / → 交替,W / ↑ / 空格 跳";
  wrap.appendChild(keyHint);

  const msgEl = document.createElement("div");
  msgEl.className = "rbr-msg";
  msgEl.textContent = "听到「跑」再出发:左右两颗换着按最快,一直砸同一颗会越按越吃力。";
  wrap.appendChild(msgEl);

  stage.appendChild(wrap);

  const distEl = wrap.querySelector(".rbr-dist") as HTMLElement;
  const leadEl = wrap.querySelector(".rbr-lead") as HTMLElement;

  // 仪表盘:体力条 / 连击 / 礼物箱 / 读招,末尾永远挂着让分开关
  let stamBox: HTMLElement | null = null;
  let stamFill: HTMLElement | null = null;
  let comboChip: HTMLElement | null = null;
  if (staminaMax > 0) {
    const tag = document.createElement("span");
    tag.className = "rbr-chip";
    tag.textContent = "💨 体力";
    stamBox = document.createElement("div");
    stamBox.className = "rbr-stam";
    stamBox.setAttribute("role", "img");
    stamBox.setAttribute("aria-label", "体力条");
    stamFill = document.createElement("div");
    stamFill.className = "rbr-stam-fill";
    stamBox.appendChild(stamFill);
    gearEl.append(tag, stamBox);
  }
  if (cfg.beatMs) {
    const beat = document.createElement("span");
    beat.className = "rbr-beat";
    beat.style.animationDuration = `${cfg.beatMs}ms`;
    comboChip = document.createElement("span");
    comboChip.className = "rbr-chip";
    comboChip.textContent = "🎵 连击 0";
    gearEl.append(beat, comboChip);
  }
  if (cfg.obstacles.some((o) => o.type === "item")) {
    const tag = document.createElement("span");
    tag.className = "rbr-chip";
    tag.textContent = "🎁 礼物箱靠抢";
    gearEl.appendChild(tag);
  }
  if (cfg.aiAdapt) {
    const tag = document.createElement("span");
    tag.className = "rbr-chip";
    tag.textContent = "🧠 小电脑会读招";
    gearEl.appendChild(tag);
  }
  gearEl.appendChild(
    buildHandicapChip(() => {
      ctx.sfx("tap");
      msgEl.textContent = handicapOn
        ? "让分开了:落后的一方会跑快一点点,最多 8%。"
        : "让分关了:两边完全一样快。";
    })
  );

  if (gears.length) {
    msgEl.textContent = `本关新玩法:${gears.join(" + ")},看清楚再冲!`;
  }

  const gate = createStartGate(callEl, rt, Math.random, () => {
    lastTime = performance.now();
    redLane.setRunning(true);
    blueLane.setRunning(true);
    msgEl.textContent = "跑起来了!左右交替按,看到 💧🚧 提前跳。";
  });

  function renderGear(): void {
    if (stamFill && staminaMax > 0) {
      const pct = Math.max(0, Math.min(1, stamina / staminaMax));
      stamFill.style.width = `${pct * 100}%`;
      stamBox?.classList.toggle("rbr-stam-low", pct < 0.35);
    }
    if (comboChip) comboChip.textContent = `🎵 连击 ${combo}`;
  }

  function render(): void {
    redLane.setPos(me);
    blueLane.setPos(ai);
    redLane.setStride(speedRatio(tapHz, HUMAN_TAP_CAP_HZ));
    distEl.textContent = `${Math.round(me)} 米`;
    leadEl.textContent = leadHint(me - ai);
    renderGear();
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    rt.stopFrame();
    redLane.setRunning(false);
    blueLane.setRunning(false);
    // 冲线:彩带 + 300ms 慢镜,让孩子看清自己是怎么撞线的
    wrap.classList.add("rbr-slowmo");
    if (won) spawnConfetti(wrap, rt, reduced);
    const delay = FINISH_SLOWMO_MS + 60;
    if (won) {
      const got = ai <= 70 ? 3 : ai <= 88 ? 2 : 1;
      rt.later(() => ctx.win(got as 1 | 2 | 3, `朵朵先冲线!星星跑到 ${Math.round(ai)} 米,节奏咬得很紧。`), delay);
    } else {
      rt.later(() => ctx.lose("这局星星先到线~交替按稳一点、机关提前起跳,差的这一段很快能追回来!"), delay);
    }
  }

  function onStep(key: StepKey): void {
    if (ended) return;
    const now = performance.now();
    if (!gate.started()) {
      msgEl.textContent = gate.falseStart("red");
      ctx.sfx("pop");
      return;
    }
    if (now < gate.frozenUntil("red") || now < stunnedUntil) return;

    const gap = lastTapAt ? now - lastTapAt : FIRST_TAP_GAP_MS;
    const res = tapRhythm(rhythm, key, gap);
    rhythm = res.state;
    lastTapAt = now;
    tapHz = gap > 0 ? 1000 / gap : 0;
    if (cfg.beatMs) combo = nextCombo(combo, gap, cfg);

    const tired = staminaMax > 0 && stamina < 1;
    let step =
      cfg.tapStep *
      res.multiplier *
      comboMultiplier(combo, cfg.comboMax ?? 0) *
      staminaStepFactor(stamina, cfg) *
      handicapBoost(handicapOn, me, ai);
    if (now < meSlowUntil) step *= ITEM_SLOW_FACTOR;
    for (const ob of cfg.obstacles) {
      if (ob.type === "hill" && inZone(me, ob)) step *= 0.5;
    }
    if (staminaMax > 0) stamina = Math.max(0, stamina - 1);
    if (tired) msgEl.textContent = "💨 体力见底啦,松开手喘两口再冲!";
    else if (res.state.sameStreak >= 3) msgEl.textContent = "换另一只脚!左右交替跑得更快。";

    const before = me;
    me = Math.min(TRACK_LEN, me + step);
    cfg.obstacles.forEach((ob, i) => {
      if (clearedObs.has(i) || !(before < ob.pos && me >= ob.pos)) return;
      if (ob.type === "star") {
        clearedObs.add(i);
        redLane.fade(i);
        me = Math.min(TRACK_LEN, me + 8);
        ctx.sfx("coin");
        msgEl.textContent = "⭐ 踩到星星,咻——冲刺!";
      } else if (ob.type === "item") {
        // 礼物箱是抢的:两条道同一个箱子,谁先冲到谁拿
        clearedObs.add(i);
        redLane.fade(i);
        blueLane.fade(i);
        me = Math.min(TRACK_LEN, me + ITEM_BOOST);
        aiSlowUntil = now + ITEM_SLOW_MS;
        ctx.sfx("coin");
        msgEl.textContent = "🎁 礼物箱抢到手!小电脑要打滑一小会儿。";
      } else if ((ob.type === "puddle" || ob.type === "hurdle") && !jumping) {
        clearedObs.add(i);
        redLane.fade(i);
        if (ob.type === "puddle") {
          me = Math.max(0, ob.pos - 2);
          stunnedUntil = now + 800;
          ctx.sfx("oops");
          msgEl.textContent = "💧 踩进水坑打滑啦,下次提前按「跳」!";
        } else {
          me = Math.max(0, ob.pos - 4);
          stunnedUntil = now + 600;
          ctx.sfx("oops");
          msgEl.textContent = "🚧 撞上栏架弹回来啦,提前按「跳」!";
        }
      }
    });
    ctx.sfx("tap");
    render();
    if (me >= TRACK_LEN) finish(true);
  }

  function onJump(): void {
    if (ended) return;
    const now = performance.now();
    if (!gate.started()) {
      msgEl.textContent = gate.falseStart("red");
      return;
    }
    if (now < gate.frozenUntil("red") || now < stunnedUntil || jumping) return;
    jumping = true;
    redLane.jump();
    ctx.sfx("jump");
    // 前方 8 米内有水坑 / 栏架就跃过去
    const idx = cfg.obstacles.findIndex(
      (ob, i) =>
        (ob.type === "puddle" || ob.type === "hurdle") && !clearedObs.has(i) && ob.pos >= me && ob.pos <= me + 8
    );
    if (idx >= 0) {
      const target = cfg.obstacles[idx];
      clearedObs.add(idx);
      redLane.fade(idx);
      me = Math.min(TRACK_LEN, target.pos + target.len + 1);
      msgEl.textContent = "跳得漂亮!";
    } else {
      me = Math.min(TRACK_LEN, me + 1.5);
    }
    render();
    rt.later(() => {
      jumping = false;
    }, 450);
    if (me >= TRACK_LEN) finish(true);
  }

  function tick(now: number): void {
    if (rt.dead() || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (staminaMax > 0) {
      stamina = Math.min(staminaMax, stamina + (cfg.staminaRegen ?? 0) * dt);
    }
    // 一段时间没点,跑步动画自然慢下来
    if (lastTapAt && now - lastTapAt > 700) tapHz = 0;

    if (gate.started() && now >= gate.frozenUntil("blue") && now >= aiPauseUntil) {
      let speed = adaptiveAiSpeed(cfg, me, ai) * handicapBoost(handicapOn, ai, me);
      if (now < aiSlowUntil) speed *= ITEM_SLOW_FACTOR;
      for (const ob of cfg.obstacles) {
        if (ob.type === "hill" && inZone(ai, ob)) speed *= 0.7;
      }
      const before = ai;
      ai = Math.min(TRACK_LEN, ai + speed * dt);
      cfg.obstacles.forEach((ob, i) => {
        if (!(before < ob.pos && ai >= ob.pos)) return;
        if (ob.type === "item" && !clearedObs.has(i)) {
          clearedObs.add(i);
          redLane.fade(i);
          blueLane.fade(i);
          ai = Math.min(TRACK_LEN, ai + ITEM_BOOST);
          meSlowUntil = now + ITEM_SLOW_MS;
          msgEl.textContent = "🎁 礼物箱被小电脑抢先啦,稳住节奏追回来!";
        } else if ((ob.type === "puddle" || ob.type === "hurdle") && !aiPassed.has(i)) {
          // 小电脑遇到水坑 / 栏架也会停顿一下
          aiPassed.add(i);
          blueLane.fade(i);
          aiPauseUntil = now + 550;
        }
      });
    }
    render();
    if (ai >= TRACK_LEN) {
      finish(false);
      return;
    }
    rt.frame(tick);
  }

  onPress(pad.left, () => onStep("left"));
  onPress(pad.right, () => onStep("right"));
  onPress(pad.jump, onJump);
  rt.own(
    bindKeys(false, (hit) => {
      if (hit.action === "jump") onJump();
      else onStep(hit.action);
    })
  );

  render();
  // 仪表盘的芯片都挂完了才量:量早了会漏掉体力条 / 连击那一行的高度
  const fit = fitRaceStage(wrap);
  rt.frame((t) => {
    lastTime = t;
    rt.frame(tick);
  });

  return {
    destroy() {
      ended = true;
      fit.dispose();
      rt.dispose();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 对战场:本地两人(朵朵 vs 星星)或挑战四档小电脑
// ---------------------------------------------------------------------------

type Foe = "duo" | AiLevel;

interface DuelRunner {
  pos: number;
  rhythm: RhythmState;
  lastTapAt: number;
  tapHz: number;
  stunUntil: number;
  slowUntil: number;
  jumping: boolean;
  cleared: Set<number>;
}

function newRunner(): DuelRunner {
  return {
    pos: 0,
    rhythm: initRhythm(),
    lastTapAt: 0,
    tapHz: 0,
    stunUntil: 0,
    slowUntil: 0,
    jumping: false,
    cleared: new Set<number>()
  };
}

function mountVersus(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const reduced = prefersReducedMotion();
  let foe: Foe = "duo";
  let round = 0;
  let scoreRed = 0;
  let scoreBlue = 0;
  let roundRt: Runtime | null = null;

  const wrap = document.createElement("div");
  wrap.className = "rbv-wrap";
  const style = document.createElement("style");
  style.textContent = `${CSS}\n${VERSUS_CSS}`;
  wrap.appendChild(style);

  const head = document.createElement("div");
  head.className = "rbv-head";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "rbe-back";
  back.textContent = "🗺️ 回关卡";
  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  const scoreEl = document.createElement("span");
  scoreEl.className = "rbv-score";
  const distEl = document.createElement("span");
  distEl.className = "rbr-chip";
  distEl.textContent = "0 : 0 米";
  head.append(back, scoreEl, distEl);
  wrap.appendChild(head);

  const foesEl = document.createElement("div");
  foesEl.className = "rbv-foes";
  wrap.appendChild(foesEl);
  const noteEl = document.createElement("div");
  noteEl.className = "rbv-foe-note";
  wrap.appendChild(noteEl);

  const gearEl = document.createElement("div");
  gearEl.className = "rbr-gear";
  gearEl.appendChild(buildHandicapChip(() => api.play("tap")));
  wrap.appendChild(gearEl);

  const board = document.createElement("div");
  wrap.appendChild(board);
  host.appendChild(wrap);

  function foeLabel(f: Foe): string {
    if (f === "duo") return "🤝 本地两人";
    const p = profileOf(f);
    return `${p.emoji} ${p.label}`;
  }

  function foeNote(f: Foe): string {
    if (f === "duo") return "朵朵 A / D 交替、W 跳;星星 ← / → 交替、↑ 跳。手机各按各的半边屏幕。";
    const p = profileOf(f);
    return `${p.blurb}(目标节奏 ${p.tapsPerSec} 次/秒——你也按得出来的频率)`;
  }

  function renderFoes(): void {
    foesEl.innerHTML = "";
    const all: Foe[] = ["duo", ...AI_LEVELS];
    for (const f of all) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rbv-foe${f === foe ? " rbv-foe-on" : ""}`;
      btn.textContent = foeLabel(f);
      btn.setAttribute("aria-pressed", String(f === foe));
      btn.addEventListener("click", () => {
        if (f === foe) return;
        api.play("tap");
        foe = f;
        scoreRed = 0;
        scoreBlue = 0;
        round = 0;
        renderFoes();
        startRound();
      });
      foesEl.appendChild(btn);
    }
    noteEl.textContent = foeNote(foe);
    scoreEl.textContent = `🔴 ${scoreRed} : ${scoreBlue} 🔵`;
  }

  function startRound(): void {
    roundRt?.dispose();
    board.innerHTML = "";
    const rt = createRuntime();
    roundRt = rt;
    round++;

    const duo = foe === "duo";
    const level = duo ? null : (foe as AiLevel);
    const rand = mulberry32(9173 + round * 61);
    // 两条道用同一张机关表:位置、种类、长度完全镜像
    const track = buildDuelTrack(rand, 4 + (round % 3));
    if (!lanesMirrored(track.red, track.blue)) {
      console.error("[一朵一星] red-blue-race 对战场两条赛道不镜像");
    }
    const table = track.red;
    const tapStep = 1.7;

    const red = newRunner();
    const blue = newRunner();
    const takenItems = new Set<number>();
    let over = false;
    let lastTime = 0;
    let aiStumbleUntil = 0;

    const redLane = buildLane("red", AVATAR_URLS.duoduo, "朵朵在奔跑", "朵朵", track.red, reduced, rt);
    const blueLane = buildLane(
      "blue",
      AVATAR_URLS.xingxing,
      "星星在奔跑",
      duo ? "星星" : `星星 · ${profileOf(level as AiLevel).label}`,
      track.blue,
      reduced,
      rt
    );
    board.append(redLane.el, blueLane.el);

    const callEl = document.createElement("div");
    callEl.className = "rbr-call";
    callEl.setAttribute("role", "status");
    board.appendChild(callEl);

    let redPad: PadSet;
    let bluePad: PadSet | null = null;
    if (duo) {
      const pads = buildDuoPads();
      redPad = pads.red;
      bluePad = pads.blue;
      board.appendChild(pads.el);
    } else {
      const solo = buildSoloPads();
      redPad = solo.pad;
      board.appendChild(solo.el);
    }

    const keyHint = document.createElement("div");
    keyHint.className = "rbr-keyhint";
    keyHint.textContent = duo ? "朵朵 A / D + W　　星星 ← / → + ↑" : "键盘:A / D 或 ← / → 交替,W / ↑ / 空格 跳";
    board.appendChild(keyHint);

    const msgEl = document.createElement("div");
    msgEl.className = "rbr-msg";
    msgEl.textContent = "听到「跑」再出发,抢跑只回退半秒,不算输。";
    board.appendChild(msgEl);

    function render(): void {
      redLane.setPos(red.pos);
      blueLane.setPos(blue.pos);
      redLane.setStride(speedRatio(red.tapHz, HUMAN_TAP_CAP_HZ));
      blueLane.setStride(speedRatio(blue.tapHz, HUMAN_TAP_CAP_HZ));
      distEl.textContent = `${Math.round(red.pos)} : ${Math.round(blue.pos)} 米`;
    }

    function settle(redWon: boolean): void {
      if (over) return;
      over = true;
      rt.stopFrame();
      redLane.setRunning(false);
      blueLane.setRunning(false);
      if (redWon) scoreRed++;
      else scoreBlue++;
      scoreEl.textContent = `🔴 ${scoreRed} : ${scoreBlue} 🔵`;
      spawnConfetti(wrap, rt, reduced);
      api.play("win");

      // 冲线慢镜过后再弹结算,浮层自己还有 400ms 冷静期
      rt.later(() => {
        const ov = document.createElement("div");
        ov.className = "rbv-over";
        const winner = redWon ? "朵朵" : duo ? "星星" : `小电脑(${profileOf(level as AiLevel).label})`;
        const loserPos = Math.round(redWon ? blue.pos : red.pos);
        ov.innerHTML = `
          <div style="font-size:44px;line-height:1">🏁</div>
          <div class="rbv-over-title">${winner} 先冲线!</div>
          <div class="rbv-over-sub">另一边跑到 ${loserPos} 米,差距就在几步之间。左右交替按稳,下一局就能换个结果。</div>
        `;
        const btns = document.createElement("div");
        btns.style.display = "flex";
        btns.style.gap = "10px";
        btns.style.flexWrap = "wrap";
        btns.style.justifyContent = "center";
        const shownAt = performance.now();
        const mk = (label: string, ghost: boolean, fn: () => void): HTMLButtonElement => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = `rbv-over-btn${ghost ? " rbv-ghost" : ""}`;
          b.textContent = label;
          b.addEventListener("click", () => {
            // 冷静期:胜负一出手还在连点,浮层刚弹出的 400ms 不吃点击
            if (!settleClickAccepted(shownAt, performance.now())) return;
            api.play("tap");
            ov.remove();
            fn();
          });
          return b;
        };
        btns.append(
          mk("🔁 再来一局", false, () => startRound()),
          mk("🗺️ 回关卡", true, () => onExit())
        );
        ov.appendChild(btns);
        wrap.appendChild(ov);
      }, FINISH_SLOWMO_MS);
    }

    const gate = createStartGate(callEl, rt, rand, () => {
      lastTime = performance.now();
      redLane.setRunning(true);
      blueLane.setRunning(true);
      msgEl.textContent = "跑!左右交替按最快,💧🚧 提前跳。";
    });

    /** 星星与礼物箱:礼物箱两条道共用一个,谁先冲到谁拿 */
    function takePickups(who: "red" | "blue", runner: DuelRunner, before: number, now: number): void {
      const lane = who === "red" ? redLane : blueLane;
      const other = who === "red" ? blue : red;
      table.forEach((ob, i) => {
        if (!(before < ob.pos && runner.pos >= ob.pos)) return;
        if (ob.type === "star") {
          if (runner.cleared.has(i)) return;
          runner.cleared.add(i);
          lane.fade(i);
          runner.pos = Math.min(TRACK_LEN, runner.pos + 8);
          api.play("coin");
        } else if (ob.type === "item") {
          if (takenItems.has(i)) return;
          takenItems.add(i);
          redLane.fade(i);
          blueLane.fade(i);
          runner.pos = Math.min(TRACK_LEN, runner.pos + ITEM_BOOST);
          other.slowUntil = now + ITEM_SLOW_MS;
          api.play("coin");
          msgEl.textContent = "🎁 礼物箱被抢走一个,另一边稳住节奏追!";
        }
      });
    }

    /** 水坑 / 栏架:没跳过去就打滑一下(真人版) */
    function hitHazards(who: "red" | "blue", runner: DuelRunner, before: number, now: number): void {
      const lane = who === "red" ? redLane : blueLane;
      table.forEach((ob, i) => {
        if (ob.type !== "puddle" && ob.type !== "hurdle") return;
        if (runner.cleared.has(i) || runner.jumping) return;
        if (!(before < ob.pos && runner.pos >= ob.pos)) return;
        runner.cleared.add(i);
        lane.fade(i);
        runner.pos = Math.max(0, ob.pos - (ob.type === "puddle" ? 2 : 3));
        runner.stunUntil = now + (ob.type === "puddle" ? 700 : 550);
        api.play("oops");
      });
    }

    function step(who: "red" | "blue", key: StepKey): void {
      if (over) return;
      const runner = who === "red" ? red : blue;
      const rival = who === "red" ? blue : red;
      const now = performance.now();
      if (!gate.started()) {
        msgEl.textContent = gate.falseStart(who);
        api.play("pop");
        return;
      }
      if (now < gate.frozenUntil(who) || now < runner.stunUntil) return;
      const gap = runner.lastTapAt ? now - runner.lastTapAt : FIRST_TAP_GAP_MS;
      const res = tapRhythm(runner.rhythm, key, gap);
      runner.rhythm = res.state;
      runner.lastTapAt = now;
      runner.tapHz = gap > 0 ? 1000 / gap : 0;
      let move = tapStep * res.multiplier * handicapBoost(handicapOn, runner.pos, rival.pos);
      if (now < runner.slowUntil) move *= ITEM_SLOW_FACTOR;
      const before = runner.pos;
      runner.pos = Math.min(TRACK_LEN, runner.pos + move);
      takePickups(who, runner, before, now);
      hitHazards(who, runner, before, now);
      api.play("tap");
      render();
      if (runner.pos >= TRACK_LEN) settle(who === "red");
    }

    function jump(who: "red" | "blue"): void {
      if (over) return;
      const runner = who === "red" ? red : blue;
      const lane = who === "red" ? redLane : blueLane;
      const now = performance.now();
      if (!gate.started()) {
        msgEl.textContent = gate.falseStart(who);
        return;
      }
      if (now < gate.frozenUntil(who) || now < runner.stunUntil || runner.jumping) return;
      runner.jumping = true;
      lane.jump();
      api.play("jump");
      const idx = table.findIndex(
        (ob, i) =>
          (ob.type === "puddle" || ob.type === "hurdle") &&
          !runner.cleared.has(i) &&
          ob.pos >= runner.pos &&
          ob.pos <= runner.pos + 9
      );
      if (idx >= 0) {
        runner.cleared.add(idx);
        lane.fade(idx);
        runner.pos = Math.min(TRACK_LEN, table[idx].pos + table[idx].len + 1);
      } else {
        runner.pos = Math.min(TRACK_LEN, runner.pos + 1.5);
      }
      rt.later(() => {
        runner.jumping = false;
      }, 430);
      render();
      if (runner.pos >= TRACK_LEN) settle(who === "red");
    }

    function loop(now: number): void {
      if (rt.dead() || over) return;
      const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
      lastTime = now;
      if (red.lastTapAt && now - red.lastTapAt > 700) red.tapHz = 0;
      if (duo && blue.lastTapAt && now - blue.lastTapAt > 700) blue.tapHz = 0;

      if (level && gate.started() && now >= gate.frozenUntil("blue") && now >= aiStumbleUntil) {
        // 小电脑按「目标节奏 + 失误率」跑,速度换算走的是和玩家同一套交替节奏公式
        let pace = aiPacePerSec(level, tapStep) * handicapBoost(handicapOn, blue.pos, red.pos);
        if (now < blue.slowUntil) pace *= ITEM_SLOW_FACTOR;
        blue.tapHz = profileOf(level).tapsPerSec;
        const before = blue.pos;
        blue.pos = Math.min(TRACK_LEN, blue.pos + pace * dt);
        takePickups("blue", blue, before, now);
        table.forEach((ob, i) => {
          if (ob.type !== "puddle" && ob.type !== "hurdle") return;
          if (blue.cleared.has(i) || !(before < ob.pos && blue.pos >= ob.pos)) return;
          blue.cleared.add(i);
          blueLane.fade(i);
          if (aiMisses(level, rand)) {
            aiStumbleUntil = now + aiStumbleSec(level) * 1000;
            blue.pos = Math.max(0, ob.pos - 2);
          } else {
            blue.pos = Math.min(TRACK_LEN, ob.pos + ob.len + 1);
          }
        });
      }
      render();
      if (blue.pos >= TRACK_LEN) {
        settle(false);
        return;
      }
      rt.frame(loop);
    }

    onPress(redPad.left, () => step("red", "left"));
    onPress(redPad.right, () => step("red", "right"));
    onPress(redPad.jump, () => jump("red"));
    if (bluePad) {
      onPress(bluePad.left, () => step("blue", "left"));
      onPress(bluePad.right, () => step("blue", "right"));
      onPress(bluePad.jump, () => jump("blue"));
    }

    rt.own(
      bindKeys(duo, (hit) => {
        if (hit.action === "jump") jump(hit.racer);
        else step(hit.racer, hit.action);
      })
    );

    render();
    rt.frame((t) => {
      lastTime = t;
      rt.frame(loop);
    });
    // 换对手会整块重搭赛台(两人场比单人场多一整排键),每回合重量一次
    fit.relayout();
  }

  renderFoes();
  const fit = fitRaceStage(wrap);
  startRound();

  return {
    destroy() {
      roundRt?.dispose();
      roundRt = null;
      fit.dispose();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 无尽「跑不完的跑道」:机关越跑越密,撞 3 次这一趟收工
// ---------------------------------------------------------------------------

/** 玩家在跑道上的固定站位(百分比),机关与陪跑星星都相对它滚动 */
const VIEW_ME_PCT = 30;
/** 视野里能看到前方多少米 */
const VIEW_AHEAD = 45;
/** 开局领先陪跑星星多少米 */
const START_GAP = 28;

interface EndlessOb {
  type: ObstacleType;
  pos: number;
  el: HTMLElement;
  gone: boolean;
}

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const rt = createRuntime();
  let over = false;
  let lastTime = 0;
  let dist = 0;
  let pacer = -START_GAP;
  let jumping = false;
  let stunnedUntil = 0;
  let pacerSlowUntil = 0;
  let picked = 0;
  let hits = 0;
  let rhythm: RhythmState = initRhythm();
  let lastTapAt = 0;
  const obs: EndlessOb[] = [];
  let best = save.getGameProgress(meta.id).endlessBest;

  const wrap = document.createElement("div");
  wrap.className = "rbe-wrap";
  const style = document.createElement("style");
  style.textContent = `${CSS}\n${ENDLESS_CSS}`;
  wrap.appendChild(style);
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="rbe-head">
      <button class="rbe-back" type="button">🗺️ 回关卡</button>
      <span class="rbe-chip rbe-dist">0 米</span>
      <span class="rbe-chip rbe-hitchip">还能撞 ${ENDLESS_MAX_HITS} 次</span>
      <span class="rbe-chip rbe-dens"></span>
      <span class="rbe-chip rbe-best"></span>
    </div>
    <div class="rbe-lane">
      <div class="rbe-ground"></div>
      <div class="rbe-pacer" style="left:0%"><img class="rbe-face" src="${AVATAR_URLS.xingxing}" alt="星星在陪你跑" /></div>
      <div class="rbe-me" style="left:${VIEW_ME_PCT}%"><img class="rbe-face" src="${AVATAR_URLS.duoduo}" alt="朵朵在长跑" /></div>
    </div>
  `;
  wrap.appendChild(body);

  const { el: padsEl, pad } = buildSoloPads();
  wrap.appendChild(padsEl);
  const keyHint = document.createElement("div");
  keyHint.className = "rbr-keyhint";
  keyHint.textContent = "键盘:A / D 或 ← / → 交替,W / ↑ / 空格 跳";
  wrap.appendChild(keyHint);
  const msgEl = document.createElement("div");
  msgEl.className = "rbe-msg";
  msgEl.textContent = "跑道没有终点:左右交替按,💧🚧 要跳,🎁⭐ 顺手抢。撞 3 次这一趟就收工。";
  wrap.appendChild(msgEl);
  host.appendChild(wrap);

  const laneEl = wrap.querySelector(".rbe-lane") as HTMLElement;
  const meEl = wrap.querySelector(".rbe-me") as HTMLElement;
  const pacerEl = wrap.querySelector(".rbe-pacer") as HTMLElement;
  const distEl = wrap.querySelector(".rbe-dist") as HTMLElement;
  const hitEl = wrap.querySelector(".rbe-hitchip") as HTMLElement;
  const densEl = wrap.querySelector(".rbe-dens") as HTMLElement;
  const bestEl = wrap.querySelector(".rbe-best") as HTMLElement;

  bestEl.textContent = best > 0 ? `🏅 最远 ${best} 米` : "🏅 还没有纪录";

  const KINDS: ObstacleType[] = ["puddle", "hurdle", "item", "star", "hurdle", "puddle", "item"];
  let nextPos = 34;
  let kindCursor = 0;

  function refill(): void {
    while (nextPos < dist + VIEW_AHEAD + 40) {
      const type = KINDS[kindCursor++ % KINDS.length];
      const el = document.createElement("div");
      el.className = "rbe-ob";
      el.textContent = OB_EMOJI[type];
      laneEl.appendChild(el);
      obs.push({ type, pos: nextPos, el, gone: false });
      // 间距随距离收窄,密度就一路往上走
      nextPos += endlessGapMeters(nextPos) * (0.85 + Math.random() * 0.4);
    }
  }

  function dropOb(o: EndlessOb): void {
    o.gone = true;
    o.el.remove();
  }

  function render(): void {
    for (const o of obs) {
      if (o.gone) continue;
      o.el.style.left = `${VIEW_ME_PCT + ((o.pos - dist) / VIEW_AHEAD) * (100 - VIEW_ME_PCT)}%`;
    }
    const gap = dist - pacer;
    pacerEl.style.left = `${Math.max(1, Math.min(96, VIEW_ME_PCT - (gap / VIEW_AHEAD) * (100 - VIEW_ME_PCT)))}%`;
    distEl.textContent = `${Math.floor(dist)} 米`;
    hitEl.textContent = `还能撞 ${endlessHitsLeft(hits)} 次`;
    densEl.textContent = `每百米 ${endlessDensity(dist).toFixed(1)} 个机关`;
  }

  function finish(): void {
    if (over) return;
    over = true;
    rt.stopFrame();
    const score = Math.floor(dist);
    const record = isNewRecord(score, best);
    if (record) best = save.recordEndlessBest(meta.id, score);
    // 长跑奖励:每 100 米一颗小星星,最多 6 颗,别把关卡星星比下去
    const bonus = Math.min(6, Math.floor(score / 100));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rbe-over";
    ov.innerHTML = `
      <div style="font-size:46px;line-height:1">${record ? "🏅" : "☁️"}</div>
      <div class="rbe-over-title">${record ? `新纪录 ${score} 米!` : `这趟跑了 ${score} 米`}</div>
      <div class="rbe-over-sub">${
        record
          ? `抢到 ${picked} 个礼物箱,节奏保持得真好!${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最远纪录 ${best} 米,再跑一趟就有机会追上它。${bonus > 0 ? `这趟也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const shownAt = performance.now();
    const mk = (label: string, ghost: boolean, fn: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `rbe-over-btn${ghost ? " rbe-ghost" : ""}`;
      b.textContent = label;
      b.addEventListener("click", () => {
        // 和平台结算浮层同一把尺:刚弹出的 400ms 不吃点击,免得被连点误触
        if (!settleClickAccepted(shownAt, performance.now())) return;
        api.play("tap");
        ov.remove();
        fn();
      });
      return b;
    };
    btns.append(
      mk("🔁 再跑一趟", false, () => restart()),
      mk("🗺️ 回关卡", true, () => onExit())
    );
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function restart(): void {
    over = false;
    dist = 0;
    pacer = -START_GAP;
    picked = 0;
    hits = 0;
    stunnedUntil = 0;
    pacerSlowUntil = 0;
    nextPos = 34;
    kindCursor = 0;
    rhythm = initRhythm();
    lastTapAt = 0;
    for (const o of obs) o.el.remove();
    obs.length = 0;
    bestEl.textContent = best > 0 ? `🏅 最远 ${best} 米` : "🏅 还没有纪录";
    msgEl.textContent = "跑道没有终点:左右交替按,💧🚧 要跳,🎁⭐ 顺手抢。撞 3 次这一趟就收工。";
    refill();
    render();
    lastTime = 0;
    rt.frame(loop);
  }

  /** 撞一下:坐在地上揉揉膝盖就继续,撞满三次这一趟结束 */
  function takeHit(o: EndlessOb, now: number): void {
    hits++;
    dropOb(o);
    dist = Math.max(0, o.pos - 2);
    stunnedUntil = now + (o.type === "puddle" ? 700 : 550);
    api.play("oops");
    if (endlessRunOver(hits)) {
      render();
      finish();
      return;
    }
    msgEl.textContent =
      o.type === "puddle"
        ? `💧 滑了一下,还能撞 ${endlessHitsLeft(hits)} 次,提前按「跳」。`
        : `🚧 碰到栏架,还能撞 ${endlessHitsLeft(hits)} 次,提前按「跳」。`;
  }

  function onStep(key: StepKey): void {
    if (over || rt.dead()) return;
    const now = performance.now();
    if (now < stunnedUntil) return;
    const gap = lastTapAt ? now - lastTapAt : FIRST_TAP_GAP_MS;
    const res = tapRhythm(rhythm, key, gap);
    rhythm = res.state;
    lastTapAt = now;
    const before = dist;
    dist += 1.8 * res.multiplier;
    for (const o of obs) {
      if (o.gone || !(before < o.pos && dist >= o.pos)) continue;
      if (o.type === "star") {
        dropOb(o);
        dist += 8;
        api.play("coin");
        msgEl.textContent = "⭐ 星星冲刺!";
      } else if (o.type === "item") {
        dropOb(o);
        picked++;
        dist += ITEM_BOOST;
        pacerSlowUntil = now + ITEM_SLOW_MS;
        api.play("coin");
        msgEl.textContent = "🎁 礼物箱到手,星星慢下来啦!";
      } else if (!jumping) {
        takeHit(o, now);
        if (over) return;
      }
    }
    api.play("tap");
    refill();
    render();
  }

  function onJump(): void {
    if (over || rt.dead()) return;
    const now = performance.now();
    if (now < stunnedUntil || jumping) return;
    jumping = true;
    meEl.classList.add("rbe-jump");
    api.play("jump");
    const target = obs.find(
      (o) => !o.gone && (o.type === "puddle" || o.type === "hurdle") && o.pos >= dist && o.pos <= dist + 9
    );
    if (target) {
      dropOb(target);
      dist = target.pos + 5;
      msgEl.textContent = "跳得漂亮!";
    } else {
      dist += 1.5;
    }
    rt.later(() => {
      jumping = false;
      meEl.classList.remove("rbe-jump");
    }, 420);
    refill();
    render();
  }

  function loop(now: number): void {
    if (rt.dead() || over) return;
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
    lastTime = now;
    // 星星只是陪跑员:被它超过只是个提示,不会因此结束
    let speed = endlessChaserSpeed(dist);
    if (now < pacerSlowUntil) speed *= ITEM_SLOW_FACTOR;
    pacer += speed * dt;
    if (lastTapAt && now - lastTapAt > 900) rhythm = initRhythm();
    render();
    rt.frame(loop);
  }

  onPress(pad.left, () => onStep("left"));
  onPress(pad.right, () => onStep("right"));
  onPress(pad.jump, onJump);
  (wrap.querySelector(".rbe-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  rt.own(
    bindKeys(false, (hit) => {
      if (hit.action === "jump") onJump();
      else onStep(hit.action);
    })
  );

  refill();
  render();
  const fit = fitRaceStage(wrap);
  rt.frame(loop);

  return {
    destroy() {
      over = true;
      fit.dispose();
      rt.dispose();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载:关卡地图 + 两个入口(对战场 / 跑不完的跑道)
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  // 自检:小电脑四档不许用玩家做不到的频率
  if (!respectsHumanCap()) {
    console.error("[一朵一星] red-blue-race 的小电脑档位超过了人类手速上限");
  }

  const root = document.createElement("div");
  const bar = document.createElement("div");
  bar.className = "rbe-bar";
  const barStyle = document.createElement("style");
  barStyle.textContent = ENDLESS_CSS;
  const levelHost = document.createElement("div");
  const sideHost = document.createElement("div");
  sideHost.hidden = true;
  root.append(barStyle, bar, levelHost, sideHost);
  api.root.appendChild(root);

  const versusBtn = document.createElement("button");
  versusBtn.type = "button";
  versusBtn.className = "rbe-open rbe-open-versus";
  versusBtn.textContent = "🤝 对战场 · 两个人比一场";
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "rbe-open";
  bar.append(versusBtn, openBtn);

  let side: { destroy: () => void } | null = null;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    openBtn.textContent = best > 0 ? `♾️ 跑不完的跑道 · 最远 ${best} 米` : "♾️ 跑不完的跑道 · 点我开跑!";
  }

  function closeSide(): void {
    side?.destroy();
    side = null;
    sideHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBtn();
  }

  function openSide(make: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    if (side) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    sideHost.hidden = false;
    side = make(sideHost, api, closeSide);
  }

  versusBtn.addEventListener("click", () => openSide(mountVersus));
  openBtn.addEventListener("click", () => openSide(mountEndless));
  refreshBtn();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "左右交替按跑得最快;对战场里可以两个人比,也可以挑四档小电脑。",
      grandMessage: "188 场比赛全部夺冠,你就是赛跑总冠军!"
    }
  );

  return {
    destroy() {
      side?.destroy();
      side = null;
      level.destroy();
      root.remove();
    }
  };
}
