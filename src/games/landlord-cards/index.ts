import { meta } from "./meta";
export { meta };

// 朵朵抢地主 —— 完整规则的三人抢地主纸牌。
//
// 54 张牌、叫分抢地主、三张底牌、单张对子三带顺子连对飞机四带二炸弹王炸、
// 春天与反春天、翻倍,全套规则都在 logic.ts / sim.ts 里,这里只负责摆牌桌:
// 扇形手牌、点选与横划框选、三档牌力提示、飞牌动画、温和的非法提示,以及四种玩法——
// 对战(朵朵 vs 星星 vs 小牌灵)、188 层地主塔、无尽连胜、本地两人。
//
// 这是一款纸牌策略游戏:全程没有货币、没有真实价值的输赢,倍数只是这一局的分数放大器。
import { save } from "../../engine/save";
import { AVATAR_URLS } from "../../ui/avatars";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { AI_LEVEL_NAMES, type AiLevel } from "./ai";
import {
  FLY_SPIN_DEG,
  REARRANGE_MS,
  flyDuration,
  flyFrame,
  startFly,
  stepFly,
  type FlyState,
} from "./anim";
import {
  HINT_MODE_NAMES,
  PASS_BUTTON_LABEL,
  PASS_WORD,
  groupsSummary,
  nextHintMode,
  playableGroups,
  searchHint,
  type HintMode,
} from "./hint";
import {
  boxHits,
  cardHeightFor,
  cardWidthFor,
  fanHeightFor,
  fanLayout,
  hitIndex,
  isDragBox,
  moveCursor,
  normBox,
  type FanSlot,
} from "./fan";
import { fitTableStage } from "./fit";
import {
  CHAPTERS,
  LEVELS,
  battleHighlight,
  buildEndlessRound,
  dealForLevel,
  endlessDealSeed,
  endlessLine,
  goalLabel,
  goalMet,
  goalWinLine,
  levelDealSeed,
  mercyRedeal,
  towerLoseLine,
  towerStarsWithGoal,
  towerWinLine,
  type TowerLevel,
} from "./levels";
import {
  RANK_BIG_JOKER,
  cardRank,
  cardSuit,
  dealCards,
  describePlay,
  gentleHint,
  isJoker,
  multiplierLine,
  parsePlay,
  rankLabel,
  sortDesc,
  suggestBid,
  type Play,
  type SettleResult,
} from "./logic";
import { aiDecide, createGame, settleGame, tryMove, type GameState } from "./sim";
import {
  LDV_CSS,
  LD_LAYERS,
  LD_TIMING,
  bombFxPlan,
  botFaceSvg,
  canLiftIds,
  cardFaceArtHTML,
  curtainDecorHtml,
  roleBadgeSvg,
  starRingHtml,
  type BotFaceKind,
} from "./visual";

// ---------------------------------------------------------------------------
// 座位
// ---------------------------------------------------------------------------

interface SeatCfg {
  kind: "human" | "ai";
  name: string;
  /** 头像:人类用 PNG 路径,小牌灵用自绘头像键(BotFaceKind,渲染走 botFaceSvg) */
  avatar: string;
  isImg: boolean;
  level: AiLevel;
  /** 人类玩家用哪一套键位:0 = 朵朵(WASD+F/G),1 = 星星(方向键+L/K) */
  keys: 0 | 1;
}

/** 两位电脑对手:原创角色,不用任何现成形象;头像由 visual.ts botFaceSvg 自绘 */
const BOT_FACES: readonly { name: string; face: BotFaceKind }[] = [
  { name: "团团", face: "tuantuan" },
  { name: "圆圆", face: "yuanyuan" },
];

function humanSeat(name: "朵朵" | "星星", keys: 0 | 1): SeatCfg {
  return {
    kind: "human",
    name,
    avatar: name === "朵朵" ? AVATAR_URLS.duoduo : AVATAR_URLS.xingxing,
    isImg: true,
    level: "hard",
    keys,
  };
}

function botSeat(i: number, level: AiLevel): SeatCfg {
  const f = BOT_FACES[i % BOT_FACES.length];
  return { kind: "ai", name: f.name, avatar: f.face, isImg: false, level, keys: 0 };
}

/** 一个人类 + 两个小牌灵:人类坐 playerSeat */
function soloSeats(playerSeat: number, level: AiLevel): SeatCfg[] {
  const seats: SeatCfg[] = [];
  let bot = 0;
  for (let i = 0; i < 3; i++) {
    seats.push(i === playerSeat ? humanSeat("朵朵", 0) : botSeat(bot++, level));
  }
  return seats;
}

/** 朵朵 + 星星 + 一个小牌灵 */
function duoSeats(level: AiLevel): SeatCfg[] {
  return [humanSeat("朵朵", 0), humanSeat("星星", 1), botSeat(0, level)];
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.ld-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;
  border-radius:18px;padding:10px;position:relative;
  border:3px solid var(--ld-wood);
  background:
    radial-gradient(circle at 0 0,var(--ld-wood) 0 12px,transparent 13px),
    radial-gradient(circle at 100% 0,var(--ld-wood) 0 12px,transparent 13px),
    radial-gradient(circle at 0 100%,var(--ld-wood) 0 12px,transparent 13px),
    radial-gradient(circle at 100% 100%,var(--ld-wood) 0 12px,transparent 13px),
    radial-gradient(circle at 50% 34%,transparent 0 86px,rgba(255,255,255,.07) 87px 95px,transparent 96px),
    linear-gradient(180deg,var(--ld-felt),var(--ld-felt-deep));
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.2),inset 0 0 42px rgba(0,0,0,.24);}
.ld-banner{text-align:center;font-size:13px;font-weight:900;color:#ffefd3;line-height:1.5;
  text-shadow:0 1px 2px rgba(0,0,0,.3);}
.ld-foes{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;}
.ld-foe{flex:1 1 0;min-width:0;max-width:250px;background:#ffffffcc;border-radius:14px;padding:7px 8px;
  display:flex;flex-direction:column;gap:5px;align-items:center;box-shadow:0 2px 7px rgba(150,140,190,.2);}
.ld-foe-on{outline:3px solid #ff9ec7;}
.ld-face{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#f3ecff;
  display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid #fff;}
.ld-foe-name{font-size:12px;font-weight:900;color:#5f4a86;text-align:center;line-height:1.3;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.ld-role{display:inline-block;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:900;}
.ld-role-l{background:#ffe0b3;color:#9a5b12;}
.ld-role-f{background:#dcefd6;color:#3f7433;}
.ld-count{font-size:12px;font-weight:800;color:#7b6f9a;}
.ld-mini{display:flex;gap:2px;flex-wrap:wrap;justify-content:center;min-height:26px;}
.ld-mini-c{width:18px;height:26px;border-radius:4px;background:#fff;border:1px solid #d8cfe8;
  font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;}
.ld-mini-r{color:#d1436a;}
.ld-mini-b{color:#3d3a52;}
.ld-bubble{font-size:12px;font-weight:900;color:#8a7ab0;background:#f4efff;border-radius:999px;padding:2px 9px;}
.ld-center{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:40px;justify-content:center;}
.ld-info{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;}
.ld-row{display:inline-flex;gap:2px;vertical-align:middle;}
.ld-chip{background:#ffffffdd;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#6a5892;
  box-shadow:0 2px 5px rgba(150,140,190,.18);}
.ld-say{font-size:13px;font-weight:800;color:#efe8fa;text-align:center;line-height:1.5;min-height:19px;
  text-shadow:0 1px 2px rgba(0,0,0,.28);}
.ld-say-oops{color:#ffb8ce;}
.ld-mehead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center;}
/* 手牌全是 position:absolute,这一格的 min-content 高度是 0;它又是 .ld-wrap 这根弹性列的
   一员,壳层一钳出天花板(第三档兜底)它就被压成 0 高,而牌还照着 JS 写死的偏移画出去,
   整扇手牌直接盖在出牌那一排上——真机 844×390 量到 fanbox 0px、牌却铺到 y=404,
   elementFromPoint 打中的全是 .ld-card(W5R3-TA-01)。inline height 是量出来的,不许压。 */
.ld-fanbox{position:relative;width:100%;touch-action:none;flex:0 0 auto;}
/* 牌面的点数与花色一律缩在左上角:扇形手牌只露出左边窄窄一条,角标必须待在那一条里 */
.ld-card{position:absolute;border-radius:8px;background:var(--ld-card);border:1px solid rgba(90,70,110,.28);
  overflow:hidden;box-shadow:1px 0 0 rgba(90,74,110,.14),0 2px 5px rgba(15,25,20,.35);
  transform-origin:50% 88%;transition:transform var(--ldv-lift-ms) ease-out;}
.ld-card-red{color:var(--ld-warm);}
.ld-card-black{color:var(--ld-cool);}
.ld-card-on{border-color:var(--ld-select);box-shadow:0 0 0 1.5px var(--ld-select),0 6px 12px rgba(244,133,159,.5);}
.ld-card-cur{outline:3px solid #6c4fd0;outline-offset:1px;}
.ld-c-i{position:absolute;left:2px;top:2px;display:flex;flex-direction:column;align-items:center;
  line-height:1.05;font-weight:900;}
.ld-c-r{line-height:1;white-space:nowrap;}
.ld-c-s{line-height:1;}
.ld-marquee{position:absolute;border:2px dashed #ffd980;background:rgba(255,217,128,.14);
  border-radius:8px;pointer-events:none;z-index:${LD_LAYERS.marquee};}
.ld-hidden{display:flex;align-items:center;justify-content:center;height:100%;
  font-size:14px;font-weight:800;color:#d9d0ec;}
.ld-btns{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}
.ld-btn{border:none;border-radius:999px;min-height:44px;padding:8px 15px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#5b4a7a;background:linear-gradient(180deg,#fbf8ff,#e9e1fb);
  box-shadow:0 3px 0 rgba(80,60,110,.55);}
.ld-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(80,60,110,.55);}
.ld-btn:disabled{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.ld-btn-go{background:linear-gradient(180deg,#f793b6,#e2648f);color:#fff;box-shadow:0 3px 0 #b8496f;}
.ld-btn-go:active{box-shadow:0 1px 0 #b8496f;}
.ld-btn-bid{background:linear-gradient(180deg,#ffd98a,#f5bd53);color:#7a4d0b;box-shadow:0 3px 0 #c9922f;}
.ld-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ld-keys{font-size:11px;font-weight:700;color:#e3d9f2;text-align:center;line-height:1.6;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:5px 8px;}
.ld-cover{position:absolute;inset:0;background:linear-gradient(180deg,#fdeff7,#f7dfec);border-radius:18px;
  z-index:${LD_LAYERS.cover};
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.ld-cover-t{font-size:20px;font-weight:900;color:#7a5aa8;}
.ld-cover-s{font-size:14px;font-weight:700;color:#7d6aa6;line-height:1.6;max-width:300px;}
.ld-shake{animation:ldshake .3s;}
@keyframes ldshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ld-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.ld-bar[hidden]{display:none;}
/* 模式入口原来只有 38px 高,360px 手机上最容易点歪(窗口5 第1轮 W5-A-04);
   撑到 44px 并居中,视觉上还是同一颗圆角胶囊 */
.ld-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;
  min-height:44px;display:inline-flex;align-items:center;justify-content:center;}
.ld-open.ld-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.ld-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.ld-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ld-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.ld-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ld-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  /* N-104:开局 + 出牌两态共用这一颗「◀ 回选关」,热区从 33px 抬到 44px 底线 */
  min-height:44px;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.ld-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.ld-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.ld-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.ld-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;}
@media (max-width:420px){
  /* 手机竖屏寸土寸金:对手面板改成横排,省下来的高度全留给手牌和按钮 */
  .ld-wrap{padding:8px;gap:6px;}
  .ld-banner{font-size:12px;}
  .ld-foe{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start;padding:5px 6px;gap:4px;}
  .ld-face{width:28px;height:28px;font-size:16px;}
  .ld-foe-name{font-size:11px;max-width:60px;}
  .ld-mini{flex-basis:100%;min-height:20px;justify-content:flex-start;}
  /* 出牌阶段一排有 5 个按钮,挤瘦一点才不会折行掉到屏幕外头去 */
  .ld-btns{gap:4px;}
  .ld-btn{padding:6px 5px;font-size:13px;min-height:44px;border-radius:12px;}
  .ld-keys{font-size:10px;}
}
@media (prefers-reduced-motion:reduce){
  .ld-card{transition:none;}
  .ld-shake{animation:none;}
}
${LDV_CSS}
/* --- 1.2 新增:出牌区、飞牌层、三档牌力提示、底部三钮 ------------------- */
.ldc-table{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;
  background:#ffffffcc;border-radius:12px;padding:4px 10px;min-height:34px;
  box-shadow:0 2px 6px rgba(150,140,190,.18);}
.ldc-table-who{font-size:12px;font-weight:900;color:#6a5892;}
.ldc-table-pass{font-size:13px;font-weight:900;color:#9a8dbb;}
.ldc-goal{font-size:12px;font-weight:800;color:#8a6a34;background:#fff2d8;border-radius:999px;padding:2px 10px;}
.ldc-fly-layer{position:absolute;inset:0;pointer-events:none;z-index:${LD_LAYERS.fly};overflow:visible;}
.ldc-fly{position:absolute;left:0;top:0;border-radius:8px;background:var(--ld-card);border:1px solid rgba(90,70,110,.28);
  overflow:hidden;box-shadow:0 6px 14px rgba(10,30,20,.45);will-change:transform;}
.ldc-card-move{transition:transform ${REARRANGE_MS}ms cubic-bezier(.22,.7,.3,1);}
.ldc-card-hint{outline:3px dashed #f0a03c;outline-offset:2px;}
.ldc-mainbar{display:flex;gap:8px;justify-content:center;align-items:stretch;flex-wrap:nowrap;}
.ldc-mainbar .ld-btn{flex:1 1 0;min-width:0;min-height:48px;padding:8px 6px;}
.ldc-subbar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.ldc-subbar .ld-btn{min-height:44px;font-size:13px;padding:6px 11px;}
/* 提示线做成气泡框:圆角奶油卡 + 顶部小尾巴,字号 ≥ 14px */
.ldc-hintline{font-size:14px;font-weight:700;color:#6f5f95;text-align:center;line-height:1.5;
  background:#fff8e9;border:1.5px solid #f0ddba;border-radius:12px;padding:5px 11px;
  position:relative;z-index:${LD_LAYERS.hud};}
.ldc-hintline::before{content:"";position:absolute;top:-6px;left:50%;transform:translateX(-50%) rotate(45deg);
  width:9px;height:9px;background:#fff8e9;border-left:1.5px solid #f0ddba;border-top:1.5px solid #f0ddba;}
@media (max-width:420px){
  .ldc-mainbar .ld-btn{font-size:14px;min-height:46px;}
  .ldc-subbar .ld-btn{min-height:44px;font-size:12px;padding:5px 8px;}
  .ldc-hintline{font-size:14px;}
}
/* --- 舞台矮到装不下这一桌时逐档收紧(fit.ts 实测祖先裁切线后挂上来,窗口5 第2轮 W5R2-A-05) ---
   收的是留白、字号与对家面板上的装饰;出牌那一排 48px、底下那一排 44px、
   以及手牌本身一分不动——为了装得下把热区收到 44 以下,等于换一种点不着。 */
.ldc-tight{padding:7px;gap:4px;}
.ldc-tight .ld-banner{font-size:11px;line-height:1.35;}
.ldc-tight .ld-foe{padding:3px 5px;gap:3px;}
.ldc-tight .ld-face{width:24px;height:24px;font-size:14px;border-width:1px;}
.ldc-tight .ld-foe-name{font-size:10px;}
.ldc-tight .ld-role{font-size:10px;padding:0 6px;}
.ldc-tight .ld-count{font-size:11px;}
.ldc-tight .ld-mini{min-height:16px;gap:1px;}
.ldc-tight .ld-mini-c{width:12px;height:16px;font-size:8px;border-radius:3px;}
.ldc-tight .ld-bubble{font-size:11px;padding:1px 7px;}
.ldc-tight .ld-center{min-height:28px;gap:2px;}
.ldc-tight .ldc-table{min-height:28px;padding:3px 8px;gap:4px;}
.ldc-tight .ld-chip{font-size:11px;padding:2px 8px;}
.ldc-tight .ld-say{font-size:12px;min-height:16px;line-height:1.35;}
.ldc-tight .ld-mehead{gap:5px;}
.ldc-tight .ldc-hintline{font-size:10px;padding:3px 7px;line-height:1.35;}
/* 键盘那一行对触屏没用,而它正压在底下那一排按钮下面 */
.ldc-tight .ld-keys{display:none;}
.ldc-tighter{padding:6px;gap:3px;}
.ldc-tighter .ld-banner{font-size:10px;line-height:1.3;}
/* 小牌背只是好看,「还剩几张」那行字说的是同一件事 */
.ldc-tighter .ld-mini{display:none;}
.ldc-tighter .ld-face{width:20px;height:20px;font-size:12px;}
.ldc-tighter .ld-foe{padding:2px 4px;}
.ldc-tighter .ld-center{min-height:22px;}
.ldc-tighter .ldc-table{min-height:24px;padding:2px 7px;}
.ldc-tighter .ld-say{font-size:11px;min-height:14px;}
.ldc-tighter .ldc-hintline{font-size:10px;padding:2px 6px;}
/* 第三档兜底（fit.ts 两档收紧全用尽之后才挂，W5R3-TA-01）：这一桌自己滚。
   横屏 640×360 / 844×390 上叫地主那一排四颗 + 「⏸ 暂停」原本 5/5 全压在裁切线以下，
   而且一个可滚祖先都没有——真手指慢拖一趟纹丝不动。
   手牌扇自己写着 touch-action:none，落在牌上的手指只框选、不带着壳滚，
   「横着划一道选好几张」那一手一分没变。天花板与 overflow 由 fit.ts 按实测像素写内联。 */
.ldc-scroll{overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
@media (prefers-reduced-motion:reduce){
  .ldc-card-move{transition:none;}
}
`;

// ---------------------------------------------------------------------------
// 牌面
// ---------------------------------------------------------------------------

/** 红桃与方块是红的,大王也画成红的 */
function isRedCard(id: number): boolean {
  if (isJoker(id)) return cardRank(id) === RANK_BIG_JOKER;
  return id % 4 === 1 || id % 4 === 3;
}

/** 牌面七道工序在 visual.ts(角标 + 花色 SVG + 中心浮雕 + 朵朵 / 星星王牌立绘) */
function cardFaceHTML(id: number, cardW: number): string {
  return cardFaceArtHTML(id, cardW);
}

/** 出牌区 / 对手气泡里的小牌 */
function miniCardsHTML(ids: readonly number[]): string {
  return sortDesc(ids)
    .map((id) => `<span class="ld-mini-c ${isRedCard(id) ? "ld-mini-r" : "ld-mini-b"}">${
      isJoker(id) ? (cardRank(id) === RANK_BIG_JOKER ? "大" : "小") : `${rankLabel(cardRank(id))}${cardSuit(id)}`
    }</span>`)
    .join("");
}

// ---------------------------------------------------------------------------
// 牌桌
// ---------------------------------------------------------------------------

export interface TableDone {
  state: GameState;
  settle: SettleResult;
  landlord: number;
  winner: number;
}

interface TableOpts {
  hands: number[][];
  bottom: number[];
  seats: SeatCfg[];
  /** 从谁开始叫分 */
  bidStart: number;
  /** 本桌底分下限:地主塔越高层「桌费」越高,叫分没到这个数也按这个数算 */
  minBase?: number;
  banner: string;
  /** 关卡的加分目标那一行(没有就不显示) */
  goalLine?: string;
  sfx: (name: SoundName) => void;
  onDone: (r: TableDone) => void;
  /** 三家都不叫,请上层换一副牌 */
  onRedeal: () => void;
}

type Phase = "bid" | "play" | "over";

interface Bubble {
  cards: number[];
  passed: boolean;
}

/** 牌力提示档位在同一次游玩里记住,换一局不用重新调 */
let hintMode: HintMode = "coach";

/** 系统里勾了「减弱动效」就把飞牌换成短淡入(仍走同一个状态机) */
function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return Boolean(mm?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

const KEYS_P1 = { left: "a", right: "d", pick: "w", clear: "s", play: "f", pass: "g" };
const KEYS_P2 = { left: "ArrowLeft", right: "ArrowRight", pick: "ArrowUp", clear: "ArrowDown", play: "l", pass: "k" };

function keySetOf(keys: 0 | 1): typeof KEYS_P1 {
  return keys === 0 ? KEYS_P1 : KEYS_P2;
}

/**
 * 键位提示。最后那一格印的必须是牌桌底下那颗键上的字（`PASS_WORD`＝「不出」）——
 * 这一行是**在教孩子这颗键叫什么**，写「不要」就等于教了一个屏幕上不存在的名字
 * （W5R3-A-01 只改了 `hint.ts`，这里是补上的那一半，W5R3-TA-04）。
 */
function keyHint(seat: SeatCfg): string {
  const k = keySetOf(seat.keys);
  const dirs = seat.keys === 0 ? "A / D" : "← / →";
  const pick = seat.keys === 0 ? "W" : "↑";
  const clear = seat.keys === 0 ? "S" : "↓";
  return `${seat.name}:${dirs} 挑牌 · ${pick} 选中 · ${clear} 清空 · ${k.play.toUpperCase()} 出牌 · ${k.pass.toUpperCase()} ${PASS_WORD}`;
}

function createTable(host: HTMLElement, opts: TableOpts): { destroy: () => void } {
  let destroyed = false;
  let paused = false;
  let phase: Phase = "bid";
  let aiPending = false;
  const timers = new Set<number>();

  // 叫分
  let bidSeat = opts.bidStart;
  let bidsLeft = 3;
  let bidBest = 0;
  let bidWinner = -1;

  // 对局
  let state: GameState | null = null;
  let bubbles: Array<Bubble | null> = [null, null, null];
  const selected = new Set<number>();
  let cursor = 0;
  let hintIdx = 0;
  let hintKey = "";
  let say = "";
  let sayBad = false;
  /** 牌力提示的那一行说明(高亮档写「第几组」,教练档写理由) */
  let hintLine = "";
  /** 高亮档圈出来的那一组牌 */
  const hinted = new Set<number>();
  /**
   * 桌面上正在展示的那一手。
   * 它不是直接读 `state.prev`:牌要先飞过去,飞到了才摆上桌,不许瞬间出现。
   */
  let tableShown: { seat: number; cards: number[]; passed: boolean } | null = null;
  /** 还有几张牌在半空中(飞的时候不许再点牌) */
  let flying = 0;
  /** 这一次 render 是不是刚落桌:出牌区补一帧落桌软影(纯展示) */
  let justLanded = false;
  /** 叫分翻牌小卡上一次亮的分数:变了才翻面(纯展示) */
  let bidShown = 0;

  const humans = opts.seats.map((s, i) => (s.kind === "human" ? i : -1)).filter((i) => i >= 0);
  /** 界面下方摊开的是哪一家的手牌 */
  let showSeat = humans[0] ?? 0;
  /** 双人同屏换人时的遮挡幕:等这一家按下「准备好了」再摊牌 */
  let curtainFor = -1;

  const wrap = document.createElement("div");
  wrap.className = "ld-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const banner = document.createElement("div");
  banner.className = "ld-banner";
  const foesEl = document.createElement("div");
  foesEl.className = "ld-foes";
  const centerEl = document.createElement("div");
  centerEl.className = "ld-center";
  const meHead = document.createElement("div");
  meHead.className = "ld-mehead";
  const fanBox = document.createElement("div");
  fanBox.className = "ld-fanbox";
  const hintEl = document.createElement("div");
  hintEl.className = "ldc-hintline";
  const btnsEl = document.createElement("div");
  btnsEl.className = "ldc-mainbar";
  const subEl = document.createElement("div");
  subEl.className = "ldc-subbar";
  const keysEl = document.createElement("div");
  keysEl.className = "ld-keys";
  const flyLayer = document.createElement("div");
  flyLayer.className = "ldc-fly-layer";
  // 星屑环 / 上一手渐隐的展示层:盖在飞牌之上、按钮与遮挡幕之下,pointer-events:none
  const fxLayer = document.createElement("div");
  fxLayer.className = "ldv-fx-layer";
  wrap.append(style, banner, foesEl, centerEl, meHead, fanBox, hintEl, btnsEl, subEl, keysEl, flyLayer, fxLayer);
  host.appendChild(wrap);

  /** 舞台太矮时的收紧器,整桌摆完才装得上(render 里会回头叫它重量) */
  let fit: { relayout: () => void; dispose: () => void } | null = null;

  /** 手牌里每张牌对应的那个 div:留着复用才有「重排滑动」,每次重建就只会瞬移 */
  const cardEls = new Map<number, HTMLElement>();
  /** 每一家的面板,飞牌要拿它当起点 */
  const foeEls = new Map<number, HTMLElement>();
  let tableEl: HTMLElement | null = null;

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  function clearTimers(): void {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  function fanWidth(): number {
    const w = fanBox.clientWidth;
    return w > 40 ? w : 340;
  }

  // -------------------------------------------------------------------------
  // 飞牌:每一手都从牌的原位飞到出牌区,180–240ms(减弱动效时改短淡入)
  // -------------------------------------------------------------------------

  interface Flight {
    el: HTMLElement;
    from: { x: number; y: number };
    to: { x: number; y: number };
    rot: number;
    st: FlyState;
  }

  const flights = new Set<Flight>();
  let raf = 0;
  let lastTick = 0;

  function localRect(el: Element): { x: number; y: number; w: number; h: number } {
    const r = el.getBoundingClientRect();
    const base = wrap.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  }

  function tick(now: number): void {
    raf = 0;
    if (destroyed) return;
    const dt = lastTick > 0 ? now - lastTick : 16;
    lastTick = now;
    for (const f of [...flights]) {
      f.st = stepFly(f.st, dt);
      const fr = flyFrame(f.from, f.to, f.rot, f.st);
      f.el.style.transform = `translate(${fr.x}px, ${fr.y}px) rotate(${fr.rot}deg) scale(${fr.scale})`;
      f.el.style.opacity = String(fr.opacity);
      if (f.st.phase === "landed") {
        f.el.remove();
        flights.delete(f);
      }
    }
    if (flights.size > 0) raf = window.requestAnimationFrame(tick);
    else lastTick = 0;
  }

  /** 把这几张牌从起点飞到出牌区;`onLand` 在飞完之后一定会被调用一次 */
  function flyCards(seat: number, cards: readonly number[], onLand: () => void): void {
    const reduced = prefersReducedMotion();
    const ms = flyDuration(reduced);
    const cardW = Number(fanBox.dataset.cardw ?? 44);
    const cardH = Number(fanBox.dataset.cardh ?? 62);
    const dest = tableEl ?? centerEl;
    const to = localRect(dest);
    const spread = Math.min(18, Math.max(8, cardW * 0.35));
    const x0 = to.x + to.w / 2 - ((cards.length - 1) * spread + cardW) / 2;

    cards.forEach((id, i) => {
      const src = cardEls.get(id) ?? foeEls.get(seat) ?? meHead;
      const from = localRect(src);
      const el = document.createElement("div");
      el.className = `ldc-fly ${isRedCard(id) ? "ld-card-red" : "ld-card-black"}`;
      el.style.width = `${cardW}px`;
      el.style.height = `${cardH}px`;
      el.innerHTML = cardFaceHTML(id, cardW);
      flyLayer.appendChild(el);
      const f: Flight = {
        el,
        from: { x: from.x, y: from.y },
        to: { x: x0 + i * spread, y: to.y + Math.max(0, (to.h - cardH) / 2) },
        rot: (i % 2 === 0 ? 1 : -1) * FLY_SPIN_DEG,
        st: startFly(reduced),
      };
      el.style.transform = `translate(${f.from.x}px, ${f.from.y}px) rotate(${f.rot}deg)`;
      flights.add(f);
    });

    flying++;
    if (flights.size > 0 && raf === 0) raf = window.requestAnimationFrame(tick);
    // 落桌的时序由定时器兜底:即使没有 rAF(后台标签页)状态机也照样往前走
    later(() => {
      flying = Math.max(0, flying - 1);
      onLand();
    }, ms);
  }

  function clearFlights(): void {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    lastTick = 0;
    for (const f of flights) f.el.remove();
    flights.clear();
    flying = 0;
  }

  /**
   * 上一手渐隐让位(纯展示):把还摆在出牌区的那一手拓一份进 fx 层,
   * 240ms 淡出后收走;reduced 瞬时替换,一张影子都不留。
   */
  function ghostPrevHand(): void {
    if (prefersReducedMotion()) return;
    if (!tableEl || !tableShown || tableShown.passed) return;
    const r = localRect(tableEl);
    const g = document.createElement("div");
    g.className = "ldc-table ldv-ghost";
    g.innerHTML = tableEl.innerHTML;
    g.style.left = `${r.x}px`;
    g.style.top = `${r.y}px`;
    g.style.width = `${r.w}px`;
    fxLayer.appendChild(g);
    later(() => g.remove(), LD_TIMING.fadeMs + 40);
  }

  /** 炸弹 / 王炸落桌:桌面震一下 + 星屑环(reduced 不震,只出静态星屑环) */
  function tableBoom(): void {
    const plan = bombFxPlan(prefersReducedMotion());
    if (plan.shake) {
      wrap.classList.add("ldv-shakeboom");
      later(() => wrap.classList.remove("ldv-shakeboom"), LD_TIMING.shakeMs + 40);
    }
    const r = localRect(tableEl ?? centerEl);
    const ring = document.createElement("div");
    ring.className = "ldv-ring";
    ring.style.left = `${r.x + r.w / 2}px`;
    ring.style.top = `${r.y + r.h / 2}px`;
    ring.innerHTML = starRingHtml();
    fxLayer.appendChild(ring);
    later(() => ring.remove(), LD_TIMING.ringMs);
  }

  /** 当前该谁动:叫分阶段是 bidSeat,出牌阶段是 state.turn */
  function actor(): number {
    return phase === "bid" ? bidSeat : state ? state.turn : 0;
  }

  function myHand(): number[] {
    if (phase === "bid") return sortDesc(opts.hands[showSeat]);
    return state ? sortDesc(state.hands[showSeat]) : [];
  }

  function roleTag(seat: number): string {
    if (phase === "bid" || !state) return "";
    return state.landlord === seat
      ? `<span class="ld-role ld-role-l">地主</span>`
      : `<span class="ld-role ld-role-f">农民</span>`;
  }

  /** 头像 + 身份徽章:地主戴小皇冠、农民戴小草帽(跟着 state.landlord 走,纯展示) */
  function faceHTML(seat: number): string {
    const s = opts.seats[seat];
    const img = s.isImg
      ? `<img class="ld-face" src="${s.avatar}" alt="${s.name}">`
      : `<span class="ld-face ldv-botface" role="img" aria-label="${s.name}">${botFaceSvg(s.avatar as BotFaceKind)}</span>`;
    const badge =
      phase !== "bid" && state
        ? `<span class="ldv-badge">${roleBadgeSvg(state.landlord === seat ? "landlord" : "farmer")}</span>`
        : "";
    return `<span class="ldv-avatar">${img}${badge}</span>`;
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  function renderFoes(): void {
    foesEl.innerHTML = "";
    foeEls.clear();
    for (let i = 0; i < 3; i++) {
      if (i === showSeat) continue;
      const s = opts.seats[i];
      const box = document.createElement("div");
      box.className = `ld-foe${actor() === i ? " ld-foe-on" : ""}`;
      const n = state ? state.hands[i].length : opts.hands[i].length;
      const b = bubbles[i];
      const bubbleHTML = b
        ? b.passed
          ? `<span class="ld-bubble">${PASS_WORD}～</span>`
          : `<span class="ld-mini">${miniCardsHTML(b.cards)}</span>`
        : `<span class="ld-mini" aria-hidden="true"></span>`;
      box.innerHTML = `${faceHTML(i)}
        <span class="ld-foe-name">${s.name}${s.kind === "ai" ? `·${AI_LEVEL_NAMES[s.level]}` : ""}</span>
        <span class="ld-count">${roleTag(i)} 🂠 ${n} 张</span>
        ${bubbleHTML}`;
      foesEl.appendChild(box);
      foeEls.set(i, box);
    }
  }

  function renderCenter(): void {
    centerEl.innerHTML = "";
    tableEl = null;
    const info = document.createElement("div");
    info.className = "ld-info";
    if (phase === "bid") {
      // 倍数牌做成翻牌小卡:分数变了才翻一面(reduced 瞬时换面,由 CSS 停掉动画)
      const flip = bidShown !== bidBest;
      bidShown = bidBest;
      info.innerHTML = `<span class="ld-chip">🎲 叫分中</span>
        <span class="ld-chip ldv-bid${flip ? " ldv-flip" : ""}">当前 ${bidBest} 分</span>
        <span class="ld-chip">底牌 3 张等着地主</span>`;
    } else if (state) {
      info.innerHTML = `<span class="ld-chip">底分 ${state.base}</span>
        <span class="ld-chip">倍数 ×${2 ** state.bombs}</span>
        <span class="ld-chip">底牌 <span class="ld-row">${miniCardsHTML(state.bottom)}</span></span>`;
    }
    centerEl.appendChild(info);
    if (opts.goalLine) {
      const goal = document.createElement("div");
      goal.className = "ldc-goal";
      goal.textContent = opts.goalLine;
      centerEl.appendChild(goal);
    }

    // 出牌区:牌飞到这儿才摆上来,所以读的是 tableShown 而不是 state.prev
    if (phase !== "bid") {
      const table = document.createElement("div");
      table.className = "ldc-table";
      if (tableShown) {
        const who = opts.seats[tableShown.seat].name;
        table.innerHTML = tableShown.passed
          ? `<span class="ldc-table-who">${who}</span><span class="ldc-table-pass">${PASS_WORD}～</span>`
          : `<span class="ldc-table-who">${who} 出</span><span class="ld-row">${miniCardsHTML(tableShown.cards)}</span>`;
      } else {
        table.innerHTML = `<span class="ldc-table-pass">牌桌空着,等这一手落下来…</span>`;
      }
      // 刚落桌的那一次 render 补一帧落桌软影(1 帧 step,reduced 也保留:功能反馈)
      if (justLanded) {
        table.classList.add("ldv-land");
        justLanded = false;
      }
      centerEl.appendChild(table);
      tableEl = table;
    }

    if (state && state.prev && tableShown && !tableShown.passed) {
      const line = document.createElement("div");
      line.className = "ld-say";
      line.innerHTML = `要压住的是 <b>${describePlay(state.prev)}</b>`;
      centerEl.appendChild(line);
    }

    const sayEl = document.createElement("div");
    sayEl.className = `ld-say${sayBad ? " ld-say-oops" : ""}`;
    sayEl.textContent = say;
    centerEl.appendChild(sayEl);
  }

  function dropAllCardEls(): void {
    for (const el of cardEls.values()) el.remove();
    cardEls.clear();
  }

  function renderHand(): void {
    const hand = myHand();
    const width = fanWidth();
    const cardW = cardWidthFor(width);
    const cardH = cardHeightFor(cardW);
    const slots = fanLayout(hand.length, width, cardW);
    fanBox.style.height = `${fanHeightFor(cardW)}px`;
    fanBox.dataset.cardw = String(cardW);
    fanBox.dataset.cardh = String(cardH);

    // 轮到自己:整扇手牌呼吸微光(reduced 由 CSS 换成常亮)
    const myTurnNow =
      !paused && curtainFor < 0 && phase !== "over" && actor() === showSeat && opts.seats[showSeat]?.kind === "human";
    fanBox.classList.toggle("ldv-myturn", myTurnNow);

    // 换人遮挡幕升起来的时候手牌一张都不画:光靠盖一层不保险,干脆不渲染
    if (curtainFor >= 0) {
      dropAllCardEls();
      fanBox.innerHTML = `<div class="ld-hidden">🂠 牌先收起来啦</div>`;
      return;
    }
    const placeholder = fanBox.querySelector(".ld-hidden");
    placeholder?.remove();

    // 现在能出的牌抬 6px + 底光:只读 playableGroups 的合法性结论,不改判定;
    // 热区计算(hitIndex / boxHits)照旧只认选中抬升,一个像素不动
    const reduced = prefersReducedMotion();
    const liftable =
      myTurnNow && phase === "play" && state ? canLiftIds(hand, state.prev) : new Set<number>();

    // 出掉的牌把 div 一起收走,剩下的牌复用原来的 div —— 复用才滑得动
    const alive = new Set(hand);
    for (const [id, el] of [...cardEls]) {
      if (alive.has(id)) continue;
      el.remove();
      cardEls.delete(id);
    }

    const lift = Math.round(cardW * 0.42);
    hand.forEach((id, i) => {
      const s: FanSlot = slots[i];
      const on = selected.has(id);
      let el = cardEls.get(id);
      if (!el) {
        el = document.createElement("div");
        el.style.left = "0px";
        el.style.top = "0px";
        fanBox.appendChild(el);
        cardEls.set(id, el);
      }
      // 牌面尺寸只在窗口变化时重画,平时复用,免得每帧都把牌面重排一遍
      if (el.dataset.cw !== String(cardW)) {
        el.innerHTML = cardFaceHTML(id, cardW);
        el.dataset.cw = String(cardW);
      }
      const can = liftable.has(id);
      el.className = `ld-card ldc-card-move ${isRedCard(id) ? "ld-card-red" : "ld-card-black"}${
        on ? " ld-card-on" : ""
      }${can ? " ldv-can" : ""}${hinted.has(id) ? " ldc-card-hint" : ""}${i === cursor && humans.length > 0 ? " ld-card-cur" : ""}`;
      el.style.width = `${cardW}px`;
      el.style.height = `${cardH}px`;
      el.style.zIndex = String(1 + i);
      // 可出牌的 6px 抬升是纯展示(reduced 只留底光);热区仍按选中抬升算
      const liftY = (on ? lift : 0) + (can && !reduced ? LD_TIMING.liftPx : 0);
      el.style.transform = `translate(${s.x}px, ${s.y - liftY}px) rotate(${s.rot}deg)`;
    });
  }

  function renderMeHead(): void {
    const s = opts.seats[showSeat];
    const hand = myHand();
    const turn = actor() === showSeat ? "该你啦!" : `等 ${opts.seats[actor()].name}…`;
    meHead.innerHTML = `${faceHTML(showSeat)}
      <span class="ld-foe-name">${s.name}</span>
      <span class="ld-count">${roleTag(showSeat)} 🂠 ${hand.length} 张</span>
      <span class="ld-chip">${turn}</span>`;
  }

  function mkBtn(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `ld-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderButtons(): void {
    btnsEl.innerHTML = "";
    subEl.innerHTML = "";
    const me = actor();
    const iAct =
      opts.seats[me]?.kind === "human" && me === showSeat && !paused && phase !== "over" && flying === 0;

    if (phase === "bid") {
      for (const v of [0, 1, 2, 3] as const) {
        const label = v === 0 ? "🙅 不叫" : `${v} 分`;
        btnsEl.appendChild(
          mkBtn(label, v === 0 ? "" : "ld-btn-bid", () => humanBid(v), !iAct || (v !== 0 && v <= bidBest))
        );
      }
    } else if (phase === "play") {
      // 底部固定一行三钮:不出 / 提示 / 出牌,热区都在 48px 以上
      btnsEl.appendChild(mkBtn(PASS_BUTTON_LABEL, "", doPass, !iAct || !state?.prev));
      btnsEl.appendChild(mkBtn("💡 提示", "", doHint, !iAct));
      btnsEl.appendChild(mkBtn("✅ 出牌", "ld-btn-go", doPlay, !iAct || selected.size === 0));
      subEl.appendChild(mkBtn(HINT_MODE_NAMES[hintMode], "", cycleHintMode, paused));
      subEl.appendChild(mkBtn("↩️ 重选", "", doClear, !iAct || selected.size === 0));
    }
    subEl.appendChild(mkBtn(paused ? "▶️ 继续" : "⏸ 暂停", "", togglePause, phase === "over"));
  }

  function renderHintLine(): void {
    hintEl.hidden = phase !== "play" || hintLine.length === 0;
    hintEl.textContent = hintLine;
  }

  function renderKeys(): void {
    keysEl.innerHTML = humans
      .map((i) => keyHint(opts.seats[i]))
      .concat("Esc 暂停 · 手机直接点牌,横着划一道可以一次选好几张")
      .join("<br>");
  }

  function renderCover(): void {
    const old = wrap.querySelector(".ld-cover");
    old?.remove();
    if (paused) {
      const c = document.createElement("div");
      c.className = "ld-cover";
      c.innerHTML = `<div class="ld-cover-t">⏸ 先歇一会儿</div>
        <div class="ld-cover-s">牌都给你留着,回来接着打。</div>`;
      c.appendChild(mkBtn("▶️ 继续玩", "ld-btn-go", togglePause));
      wrap.appendChild(c);
      return;
    }
    if (curtainFor >= 0) {
      const s = opts.seats[curtainFor];
      const c = document.createElement("div");
      // 可爱幕布只是换皮:手牌照旧一张不渲染(见 renderHand 的遮挡幕分支)
      c.className = "ld-cover ldv-curtain";
      c.innerHTML = `${curtainDecorHtml()}
        <div class="ld-cover-t">🙈 轮到 ${s.name} 啦</div>
        <div class="ldv-ribbon">请交给 ${s.name}</div>
        <div class="ld-cover-s">另一位先把眼睛捂上,${s.name} 准备好了再点下面的按钮。</div>`;
      c.appendChild(
        mkBtn("我准备好了", "ld-btn-go", () => {
          opts.sfx("tap");
          showSeat = curtainFor;
          curtainFor = -1;
          cursor = 0;
          selected.clear();
          render();
        })
      );
      wrap.appendChild(c);
    }
  }

  function render(): void {
    if (destroyed) return;
    syncShowSeat();
    renderFoes();
    renderCenter();
    renderMeHead();
    renderHand();
    renderHintLine();
    renderButtons();
    renderKeys();
    renderCover();
    // 叫分那一排换成出牌那一排、对家喊话冒出来,这一桌就长高一截,得重新量
    fit?.relayout();
  }

  /** 只有一个人玩就永远摊他的牌;两个人玩就靠遮挡幕换人 */
  function syncShowSeat(): void {
    if (humans.length <= 1) {
      showSeat = humans[0] ?? 0;
      curtainFor = -1;
      return;
    }
    const me = actor();
    if (phase !== "over" && opts.seats[me]?.kind === "human" && me !== showSeat) curtainFor = me;
    else if (curtainFor >= 0 && (phase === "over" || opts.seats[me]?.kind !== "human")) curtainFor = -1;
  }

  // -------------------------------------------------------------------------
  // 叫分
  // -------------------------------------------------------------------------

  function bidStep(): void {
    if (destroyed || phase !== "bid") return;
    if (bidsLeft <= 0 || bidBest === 3) {
      finishBidding();
      return;
    }
    const s = opts.seats[bidSeat];
    if (s.kind === "ai") {
      if (paused) return;
      later(() => {
        if (destroyed || phase !== "bid") return;
        if (paused) {
          bidStep();
          return;
        }
        applyBid(suggestBid(opts.hands[bidSeat], bidBest));
      }, 620);
    }
    render();
  }

  function applyBid(value: number): void {
    const who = opts.seats[bidSeat].name;
    if (value > bidBest) {
      bidBest = value;
      bidWinner = bidSeat;
      say = `${who} 叫了 ${value} 分!`;
      opts.sfx("coin");
    } else {
      say = `${who} 说:这把不叫～`;
      opts.sfx("tap");
    }
    sayBad = false;
    bidsLeft--;
    bidSeat = (bidSeat + 1) % 3;
    bidStep();
  }

  function humanBid(value: 0 | 1 | 2 | 3): void {
    if (phase !== "bid" || opts.seats[bidSeat].kind !== "human") return;
    applyBid(value);
  }

  function finishBidding(): void {
    if (bidWinner < 0) {
      say = "三家都不叫,那就重新洗牌发过!";
      render();
      later(() => opts.onRedeal(), 900);
      return;
    }
    phase = "play";
    const base = Math.max(bidBest, opts.minBase ?? 1);
    state = createGame({ hands: opts.hands, bottom: opts.bottom, landlord: bidWinner, base });
    say = `${opts.seats[bidWinner].name} 当地主,拿走 3 张底牌,先出牌!`;
    sayBad = false;
    selected.clear();
    cursor = 0;
    render();
    pump();
  }

  // -------------------------------------------------------------------------
  // 出牌
  // -------------------------------------------------------------------------

  function pump(): void {
    if (destroyed || paused || phase !== "play" || !state || state.finished) return;
    if (opts.seats[state.turn].kind !== "ai" || aiPending) return;
    aiPending = true;
    later(() => {
      aiPending = false;
      if (destroyed || phase !== "play" || !state) return;
      if (paused) {
        pump();
        return;
      }
      const seat = state.turn;
      const cards = aiDecide(state, opts.seats[seat].level, Math.random);
      commit(seat, cards);
    }, 780);
  }

  /** 真正落子:出的牌先飞过去,飞到了才摆上桌,再决定下一步 */
  function commit(seat: number, cards: readonly number[]): boolean {
    if (!state) return false;
    const leading = !state.prev && cards.length > 0;
    const res = tryMove(state, cards);
    if (!res.ok) return false;

    // 新的一轮开始:先把上一轮留在桌上的牌收掉,再摆这一手
    if (leading) {
      bubbles = [null, null, null];
      tableShown = null;
    }
    // 出了什么牌看桌面就够了(出牌区那行 + 各家气泡),这里不再重复播报
    let boom = false;
    if (cards.length === 0) {
      say = "";
      opts.sfx("tap");
    } else {
      const p = res.play!;
      boom = p.type === "bomb" || p.type === "rocket";
      say = p.type === "bomb" ? "💥 炸弹!这一局的倍数翻一倍" : p.type === "rocket" ? "🚀 王炸!这一轮谁也压不住" : "";
      opts.sfx(boom ? "pop" : "tap");
    }
    sayBad = false;
    selected.clear();
    hinted.clear();
    hintLine = "";
    hintIdx = 0;
    cursor = 0;

    const finished = state.finished;
    const landed = (): void => {
      if (destroyed || !state) return;
      // 纯展示:上一手渐隐让位,新一手落桌补一帧软影(出牌数据与时序在上面早就定了)
      if (cards.length > 0) {
        ghostPrevHand();
        justLanded = true;
      }
      bubbles[seat] = { cards: cards.slice(), passed: cards.length === 0 };
      tableShown = { seat, cards: cards.slice(), passed: cards.length === 0 };
      if (finished) {
        phase = "over";
        render();
        if (boom) tableBoom();
        const settle = settleGame(state);
        later(() => {
          if (!destroyed && state) opts.onDone({ state, settle, landlord: state.landlord, winner: state.winner ?? 0 });
        }, 700);
        return;
      }
      render();
      if (boom) tableBoom();
      pump();
    };

    // 手牌先少掉这几张(它们已经在飞了),桌上这一手要等落地才出现
    render();
    if (cards.length === 0) landed();
    else flyCards(seat, cards, landed);
    return true;
  }

  function canAct(): boolean {
    return (
      !paused &&
      curtainFor < 0 &&
      flying === 0 &&
      phase === "play" &&
      !!state &&
      state.turn === showSeat &&
      opts.seats[showSeat].kind === "human"
    );
  }

  function doPlay(): void {
    if (!canAct() || !state) return;
    const cards = myHand().filter((id) => selected.has(id));
    const play = parsePlay(cards);
    if (!play || !commit(showSeat, cards)) {
      say = gentleHint(cards, state.prev);
      sayBad = true;
      opts.sfx("oops");
      wrap.classList.add("ld-shake");
      later(() => wrap.classList.remove("ld-shake"), 320);
      render();
    }
  }

  function doPass(): void {
    if (!canAct() || !state || !state.prev) return;
    commit(showSeat, []);
  }

  function doClear(): void {
    if (!canAct()) return;
    selected.clear();
    hinted.clear();
    hintIdx = 0;
    opts.sfx("tap");
    render();
  }

  /** 换一档牌力提示:关 → 高亮牌组 → 推荐一手 → 关 */
  function cycleHintMode(): void {
    hintMode = nextHintMode(hintMode);
    hinted.clear();
    hintIdx = 0;
    hintLine = HINT_MODE_NAMES[hintMode];
    opts.sfx("tap");
    render();
  }

  function doHint(): void {
    if (!canAct() || !state) return;
    const hand = state.hands[showSeat];
    const key = `${state.prev ? describePlay(state.prev) : "lead"}|${hand.length}|${hintMode}`;
    if (key !== hintKey) {
      hintKey = key;
      hintIdx = 0;
    }
    hinted.clear();

    if (hintMode === "off") {
      hintLine = "提示这一档是关着的,自己想想看!想开的话点左下角那颗按钮换一档。";
      opts.sfx("tap");
      render();
      return;
    }

    if (hintMode === "groups") {
      // 高亮档只告诉你「哪些牌组能出」,出哪一组你自己挑
      const groups = playableGroups(hand, state.prev);
      if (groups.length === 0) {
        hintLine = groupsSummary(groups);
        opts.sfx("oops");
        render();
        return;
      }
      const pick = groups[hintIdx % groups.length];
      hintIdx++;
      for (const id of pick.cards) hinted.add(id);
      hintLine = `${groupsSummary(groups)} 现在圈出来的是第 ${((hintIdx - 1) % groups.length) + 1} 组:${describePlay(pick)}(再点换一组)。`;
      opts.sfx("pop");
      render();
      return;
    }

    // 教练档:真的搜一遍,推荐一手并把理由说清楚
    const res = searchHint(
      {
        hand,
        prev: state.prev,
        seat: showSeat,
        landlord: state.landlord,
        counts: state.hands.map((h) => h.length),
      },
      "coach"
    );
    hintLine = res.reason;
    if (res.play) {
      selected.clear();
      for (const id of res.play.cards) selected.add(id);
      opts.sfx("pop");
    } else {
      opts.sfx("tap");
    }
    sayBad = false;
    render();
  }

  function toggleAt(index: number): void {
    const hand = myHand();
    if (index < 0 || index >= hand.length) return;
    const id = hand[index];
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    cursor = index;
    opts.sfx("tap");
    render();
  }

  function togglePause(): void {
    if (phase === "over") return;
    paused = !paused;
    opts.sfx("tap");
    render();
    if (!paused) {
      if (phase === "bid") bidStep();
      else pump();
    }
  }

  // -------------------------------------------------------------------------
  // 触屏:点选 + 横划框选
  // -------------------------------------------------------------------------

  let dragFrom: { x: number; y: number } | null = null;
  let marquee: HTMLElement | null = null;

  function localXY(ev: PointerEvent): { x: number; y: number } {
    const r = fanBox.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function slotsNow(): { slots: FanSlot[]; cardW: number; cardH: number; lifts: number[] } {
    const hand = myHand();
    const cardW = Number(fanBox.dataset.cardw ?? 44);
    const cardH = Number(fanBox.dataset.cardh ?? 62);
    const slots = fanLayout(hand.length, fanWidth(), cardW);
    const lift = Math.round(cardW * 0.42);
    return { slots, cardW, cardH, lifts: hand.map((id) => (selected.has(id) ? lift : 0)) };
  }

  function onPointerDown(ev: PointerEvent): void {
    if (!canAct()) return;
    ev.preventDefault();
    dragFrom = localXY(ev);
    fanBox.setPointerCapture?.(ev.pointerId);
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!dragFrom) return;
    const p = localXY(ev);
    const box = normBox(dragFrom.x, dragFrom.y, p.x, p.y);
    if (!isDragBox(box)) return;
    if (!marquee) {
      marquee = document.createElement("div");
      marquee.className = "ld-marquee";
      fanBox.appendChild(marquee);
    }
    marquee.style.left = `${box.x1}px`;
    marquee.style.top = `${box.y1}px`;
    marquee.style.width = `${box.x2 - box.x1}px`;
    marquee.style.height = `${box.y2 - box.y1}px`;
  }

  function onPointerUp(ev: PointerEvent): void {
    if (!dragFrom) return;
    const p = localXY(ev);
    const box = normBox(dragFrom.x, dragFrom.y, p.x, p.y);
    const started = dragFrom;
    dragFrom = null;
    marquee?.remove();
    marquee = null;
    if (!canAct()) return;

    const { slots, cardW, cardH, lifts } = slotsNow();
    const hand = myHand();
    if (isDragBox(box)) {
      const hits = boxHits(slots, cardW, cardH, box);
      if (hits.length === 0) return;
      // 划过的这一片:全没选中就整片选上,否则整片取消,来回划一道就能改主意
      const allOn = hits.every((i) => selected.has(hand[i]));
      for (const i of hits) {
        if (allOn) selected.delete(hand[i]);
        else selected.add(hand[i]);
      }
      cursor = hits[hits.length - 1];
      opts.sfx("pop");
      render();
      return;
    }
    toggleAt(hitIndex(slots, cardW, cardH, started.x, started.y, lifts));
  }

  // -------------------------------------------------------------------------
  // 键盘
  // -------------------------------------------------------------------------

  function onKeyDown(ev: KeyboardEvent): void {
    if (destroyed) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;

    const me = actor();
    const seat = opts.seats[me];
    if (!seat || seat.kind !== "human") return;
    // 遮挡幕还没掀开时,键盘先不生效,免得偷看
    if (curtainFor >= 0) return;
    if (me !== showSeat) return;

    const k = keySetOf(seat.keys);
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

    if (phase === "bid") {
      if (key === k.play) {
        ev.preventDefault();
        humanBid(Math.min(3, bidBest + 1) as 1 | 2 | 3);
      } else if (key === k.pass) {
        ev.preventDefault();
        humanBid(0);
      }
      return;
    }
    if (phase !== "play") return;

    const hand = myHand();
    if (key === k.left) {
      ev.preventDefault();
      cursor = moveCursor(cursor, -1, hand.length);
      render();
    } else if (key === k.right) {
      ev.preventDefault();
      cursor = moveCursor(cursor, 1, hand.length);
      render();
    } else if (key === k.pick) {
      ev.preventDefault();
      toggleAt(cursor);
    } else if (key === k.clear) {
      ev.preventDefault();
      doClear();
    } else if (key === k.play) {
      ev.preventDefault();
      doPlay();
    } else if (key === k.pass) {
      ev.preventDefault();
      doPass();
    }
  }

  const onResize = (): void => {
    if (!destroyed) renderHand();
  };

  fanBox.addEventListener("pointerdown", onPointerDown);
  fanBox.addEventListener("pointermove", onPointerMove);
  fanBox.addEventListener("pointerup", onPointerUp);
  fanBox.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  banner.innerHTML = opts.banner;
  say = "先叫分抢地主:手上大牌多就多叫几分!";
  hintLine = HINT_MODE_NAMES[hintMode];
  render();
  // 整桌都摆好了才量:量早了对家面板和手牌扇都还是空的,会量出一个假的矮个子
  fit = fitTableStage(wrap, () => {
    if (!destroyed) renderHand();
  });
  bidStep();

  return {
    destroy() {
      destroyed = true;
      fit?.dispose();
      clearTimers();
      clearFlights();
      dropAllCardEls();
      foeEls.clear();
      tableEl = null;
      fanBox.removeEventListener("pointerdown", onPointerDown);
      fanBox.removeEventListener("pointermove", onPointerMove);
      fanBox.removeEventListener("pointerup", onPointerUp);
      fanBox.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 结算小工具
// ---------------------------------------------------------------------------

/** 我这一方赢了没有 */
function mySideWon(r: TableDone, mySeat: number): boolean {
  const iAmLandlord = r.landlord === mySeat;
  const landlordWon = r.winner === r.landlord;
  return iAmLandlord === landlordWon;
}

/** 这一局玩家自己的战绩:出了几手、用了几个炸、最长的一手多少张 */
function mySideStats(r: TableDone, mySeat: number): { plays: number; bombs: number; longest: number; bombsHeld: number } {
  let plays = 0;
  let bombs = 0;
  let longest = 0;
  for (const h of r.state.history) {
    if (h.seat !== mySeat || !h.play) continue;
    plays++;
    if (h.play.type === "bomb" || h.play.type === "rocket") bombs++;
    longest = Math.max(longest, h.play.cards.length);
  }
  // 手上没打出去的炸弹与王炸
  const left = r.state.hands[mySeat];
  const byRank = new Map<number, number>();
  for (const id of left) byRank.set(cardRank(id), (byRank.get(cardRank(id)) ?? 0) + 1);
  let bombsHeld = 0;
  for (const [, n] of byRank) if (n === 4) bombsHeld++;
  if ((byRank.get(16) ?? 0) > 0 && (byRank.get(RANK_BIG_JOKER) ?? 0) > 0) bombsHeld++;
  return { plays, bombs, longest, bombsHeld };
}

/** 对手阵营手上还剩多少张 */
function foeCardsLeft(r: TableDone, mySeat: number): number {
  const iAmLandlord = r.landlord === mySeat;
  let n = 0;
  for (let i = 0; i < 3; i++) {
    const isFoe = iAmLandlord ? i !== r.landlord : i === r.landlord;
    if (isFoe) n += r.state.hands[i].length;
  }
  return n;
}

/** 结算面板上的那句「春天!倍数翻到 8 分」 */
function settleLine(settle: SettleResult): string {
  const extra = settle.spring ? " 打出春天!" : settle.antiSpring ? " 农民打出反春天!" : "";
  return `${multiplierLine(settle)}。${extra}`.trim();
}

// ---------------------------------------------------------------------------
// 闯关:188 层地主塔
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv: TowerLevel = LEVELS[ctx.level];
  let table: { destroy: () => void } | null = null;
  let bump = 0;

  function start(): void {
    table?.destroy();
    stage.innerHTML = "";
    // 连输两次之后开始帮着挑牌:往后试几副,端一副「照着教练提示打能赢」的上来(W5R2-A-08)
    const cfg: TowerLevel = { ...lv, seed: levelDealSeed(lv, mercyRedeal(lv, bump)) };
    const d = dealForLevel(cfg);
    const mySeat = d.playerSeat;
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: soloSeats(mySeat, lv.aiLevel),
      bidStart: mySeat,
      minBase: lv.base,
      banner: `${CHAPTERS[lv.chapter].emoji} 第 ${ctx.level + 1} 关 · 小牌灵是「${AI_LEVEL_NAMES[lv.aiLevel]}」档 · 本层底分至少 ${lv.base} 分<br>${lv.hint}`,
      goalLine: goalLabel(lv.goal),
      sfx: ctx.sfx,
      onRedeal: () => {
        bump++;
        start();
      },
      onDone: (r) => {
        const iAmLandlord = r.landlord === mySeat;
        const won = mySideWon(r, mySeat);
        const stats = mySideStats(r, mySeat);
        const left = foeCardsLeft(r, mySeat);
        const met = goalMet(lv.goal, { won, plays: stats.plays, bombs: stats.bombs });
        const spark = battleHighlight({ won, ...stats, foeLeft: left });
        if (won) {
          const stars = towerStarsWithGoal(left, iAmLandlord, met);
          const bonus = goalWinLine(lv.goal, met);
          ctx.win(stars, `${towerWinLine(stars, left, iAmLandlord)} ${bonus} ${spark} ${settleLine(r.settle)}`.replace(/\s+/g, " ").trim());
        } else {
          ctx.lose(
            `${towerLoseLine(r.state.hands[mySeat].length, iAmLandlord)} ${spark} ${settleLine(r.settle)}`
              .replace(/\s+/g, " ")
              .trim()
          );
        }
      },
    });
  }

  start();
  return {
    destroy() {
      table?.destroy();
      table = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽连胜
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ld-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "ld-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ld-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ld-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let streak = 0;
  let bump = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let table: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ld-over";
    box.innerHTML = `<div class="ld-over-t">${title}</div><div class="ld-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ld-open";
    again.textContent = "🔁 从第 1 局再来";
    again.addEventListener("click", () => {
      api.play("tap");
      streak = 0;
      // bump 只增不减:清成 0 的话第 1 局会永远发同一副牌,卡住的孩子就一直卡着(W5R2-A-04)
      bump++;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    table?.destroy();
    stage.innerHTML = "";
    const round = buildEndlessRound(streak + 1);
    chip.textContent = `♾️ 无尽连胜 · 第 ${round.round} 局 · 最好 ${best} 连胜`;
    const d = dealCards(endlessDealSeed(round.round, bump));
    const mySeat = round.playerIsLandlord ? 0 : 1;
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: soloSeats(mySeat, round.aiLevel),
      bidStart: mySeat,
      minBase: round.base,
      banner: `♾️ 第 ${round.round} 局 · 小牌灵是「${AI_LEVEL_NAMES[round.aiLevel]}」档 · 底分至少 ${round.base} 分<br>输一局就从头再来`,
      sfx: (n) => api.play(n),
      onRedeal: () => {
        bump++;
        startRound();
      },
      onDone: (r) => {
        if (mySideWon(r, mySeat)) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.addStars(1);
          startRound();
        } else {
          best = save.recordEndlessBest(meta.id, streak);
          const spark = battleHighlight({
            won: false,
            ...mySideStats(r, mySeat),
            foeLeft: foeCardsLeft(r, mySeat),
          });
          showOver("这一局被拦下来啦", `${endlessLine(streak, best)} ${spark} ${settleLine(r.settle)}`);
        }
      },
    });
  }

  startRound();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战:朵朵 + 星星 + 一个小牌灵
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ld-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "ld-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ld-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ld-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let round = 1;
  let bump = 0;
  const score = [0, 0];
  let table: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showResult(r: TableDone): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const duoWon = mySideWon(r, 0);
    const xingWon = mySideWon(r, 1);
    if (duoWon) score[0]++;
    if (xingWon) score[1]++;
    const title = duoWon && xingWon ? "🤝 朵朵和星星是一伙的,一起赢啦!" : duoWon ? "🏆 朵朵赢啦!" : xingWon ? "🏆 星星赢啦!" : "🤖 这局被小牌灵拿下啦!";
    const spark = battleHighlight({
      won: duoWon || xingWon,
      ...mySideStats(r, duoWon ? 0 : 1),
      foeLeft: foeCardsLeft(r, duoWon ? 0 : 1),
    });
    const box = document.createElement("div");
    box.className = "ld-over";
    box.innerHTML = `<div class="ld-over-t">${title}</div>
      <div class="ld-over-s">${spark}<br>${settleLine(r.settle)}<br>总比分:朵朵 ${score[0]} · 星星 ${score[1]}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ld-open ld-open-vs";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      round++;
      bump = 0;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
    if (duoWon || xingWon) api.addStars(1);
  }

  function startRound(): void {
    table?.destroy();
    stage.innerHTML = "";
    chip.textContent = `⚔️ 第 ${round} 局 · 朵朵 ${score[0]} : ${score[1]} 星星`;
    const d = dealCards(920000 + round * 4523 + bump * 65537);
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: duoSeats("normal"),
      bidStart: (round - 1) % 2,
      banner: "⚔️ 朵朵 vs 星星 vs 小牌灵 —— 谁抢到地主谁一个人打两个!<br>换人时会先盖住牌,另一位记得捂眼睛哦",
      sfx: (n) => api.play(n),
      onRedeal: () => {
        bump++;
        startRound();
      },
      onDone: showResult,
    });
  }

  startRound();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "ld-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "ld-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "ld-open ld-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  bar.append(endlessBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽连胜 · 最好 ${best} 连胜` : "♾️ 无尽连胜 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 真下到某一关里就把这两个入口收起来:320px 宽上它俩排不下、要折成两行,
      // 连同外边距占掉 104px。舞台一共才看得见 458px,这一桌被挤到只剩 232px——
      // 叫地主那一排四颗和「⏸ 暂停」全掉在裁切线以下,真实坐标点不着(W5R2-L-14)。
      // 回选关地图就放回去,那儿地方够。
      // 先收再摆:收紧器是在 playLevel 里量的,量的时候这一条已经不占地方了
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            handle?.destroy?.();
            // 侧模式开着的时候这一条本来就该收着,别替它放回来
            if (!mode) bar.hidden = false;
          },
        };
      },
      mapHint: "先叫分抢地主,再一手一手把牌走完;拿不准就点「提示」。",
      grandMessage: "188 层地主塔全部登顶,你就是牌桌上的小王者!",
      guideTitle: "朵朵抢地主 · 出牌手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
