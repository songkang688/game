import { meta } from "./meta";
export { meta };

// 花色接龙 —— 108 张颜色 / 数字手牌的接龙。
//
// 规则、AI、关卡全在 rules.ts / ai.ts / levels.ts 里,这个文件只负责摆牌桌:
// 顶上的色条一眼看清「现在是什么色」,中间是牌堆与台面,下面是能横着滑的手牌,
// 出牌会飞到中央并轻轻转一下,抽牌从牌堆滑进手里,加牌链上的数字会跳。
// 四种玩法都在这儿:188 关闯关、2–4 人对战、无尽连胜积分赛、双人同屏。
import { save } from "../../engine/save";
import { AVATAR_URLS } from "../../ui/avatars";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { TIER_NAMES, aiCatchesOneCard, aiPlay, type AiTier } from "./ai";
import { actionIconSVG, botFaceSVG, cardBackSVG, colorShapeSVG, lighten } from "./art";
import {
  COLORS,
  COLOR_HEX,
  COLOR_NAMES,
  COLOR_SOFT,
  cardFace,
  cardLabel,
  isWild,
  type Card,
  type Color,
} from "./deck";
import guideBook from "./guide";
import {
  CHAPTERS,
  buildEndlessRound,
  buildLevel,
  buildVersusRound,
  levelBrief,
  levelDeck,
  levelStars,
  loseLine,
  matchStars,
  dealRoundDeck,
  winLine,
  type HueLevel,
  type RoundConfig,
} from "./levels";
import {
  callOneCard,
  chainPending,
  createGame,
  drawFromDeck,
  drawStack,
  isDraw,
  legalPlays,
  mustTakeChain,
  oneCardPenalty,
  passAfterDraw,
  playCard,
  resolveChallenge,
  takeChain,
  topCard,
  wildDraw4Legal,
  type HueState,
} from "./rules";
import { handScore, leftoverLine, roundScore } from "./score";

// ---------------------------------------------------------------------------
// 座位
// ---------------------------------------------------------------------------

export interface SeatCfg {
  kind: "human" | "ai";
  name: string;
  avatar: string;
  isImg: boolean;
  tier: AiTier;
  /** 人类玩家用哪一套键位:0 = 朵朵(WASD + F/G),1 = 星星(方向键 + L/K) */
  keys: 0 | 1;
}

/**
 * 「牌都用完了」那一句。
 *
 * 108 张全在大家手上、谁也接不上时,这一局收成平局(`rules.ts` 的 `noWayForward`)。
 * 正常对局到不了这儿,可到了就得有句话交代,不能让屏幕一直空转。
 */
const DRAW_LINE = "牌都用完啦,谁也接不上,这一局算平局。";

/** 结算浮层的平局标题(对战 / 无尽 / 双人同屏共用一句口径) */
const DRAW_TITLE = "🤝 牌都用完啦,这局算平手";

/**
 * 会点破的对手等这么久才动手 —— 这是「抢按就一张」的窗口。
 *
 * 这个数一毫秒都没动过(动它就是动难度),只是把「还剩多久」摆成钮上的 `CATCH_TICKS` 格倒数:
 * 以前孩子只看得见自己被罚抽了 2 张,根本不知道刚才该按哪儿。
 */
export const CATCH_DELAY_MS = 1800;

/** 倒数分几格走完 */
export const CATCH_TICKS = 3;

/** 三个电脑对手:原创角色(1.3 visual-r1 起头像走画制 SVG,与升级后的卡面同一质感) */
const BOT_FACES = [
  { name: "团团", avatar: botFaceSVG("tuantuan") },
  { name: "圆圆", avatar: botFaceSVG("yuanyuan") },
  { name: "点点", avatar: botFaceSVG("diandian") },
];

/** 对战结算的标题。`winner < 0` 是「牌都用完了」的平局,没有赢家 */
export function versusTitle(winner: number): string {
  if (winner < 0) return DRAW_TITLE;
  return winner === 0 ? "🏆 你先出完啦!" : `🤖 这局被 ${BOT_FACES[(winner - 1) % BOT_FACES.length].name} 拿下`;
}

/** 双人同屏的总比分。平局不算谁赢,单独记一格「平 N」 */
export function duoScoreLine(wins: readonly number[], draws: number): string {
  return `朵朵 ${wins[0]} : ${wins[1]} 星星${draws > 0 ? ` · 平 ${draws}` : ""}`;
}

function humanSeat(name: "朵朵" | "星星", keys: 0 | 1): SeatCfg {
  return {
    kind: "human",
    name,
    avatar: name === "朵朵" ? AVATAR_URLS.duoduo : AVATAR_URLS.xingxing,
    isImg: true,
    tier: "expert",
    keys,
  };
}

function botSeat(i: number, tier: AiTier): SeatCfg {
  const f = BOT_FACES[i % BOT_FACES.length];
  return { kind: "ai", name: f.name, avatar: f.avatar, isImg: false, tier, keys: 0 };
}

/** 一个人 + 若干电脑:缺的人一律 AI 补 */
function soloSeats(players: number, tiers: AiTier[]): SeatCfg[] {
  const seats: SeatCfg[] = [humanSeat("朵朵", 0)];
  for (let i = 1; i < players; i++) seats.push(botSeat(i - 1, tiers[i - 1] ?? "normal"));
  return seats;
}

/** 双人同屏:朵朵 + 星星 */
function duoSeats(): SeatCfg[] {
  return [humanSeat("朵朵", 0), humanSeat("星星", 1)];
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.hh-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;
  background:linear-gradient(180deg,#fff4fa,#eef2ff);border-radius:18px;padding:10px;position:relative;overflow:hidden;}
.hh-banner{text-align:center;font-size:14px;font-weight:900;color:#7a5aa8;line-height:1.5;}
.hh-colorbar{position:relative;overflow:hidden;border-radius:14px;padding:7px 12px;text-align:center;
  font-size:15px;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(80,40,80,.4);
  transition:background .32s ease;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;}
.hh-colorbar-dot{width:20px;height:20px;border-radius:50%;background:#ffffff44;line-height:0;
  display:flex;align-items:center;justify-content:center;animation:hhbreathe 2s ease-in-out infinite;}
.hh-colorbar-dot svg{display:block;}
@keyframes hhbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
.hh-colorwave{position:absolute;left:50%;top:50%;width:14px;height:14px;border-radius:50%;
  transform:translate(-50%,-50%);opacity:.75;pointer-events:none;animation:hhwave .4s ease-out forwards;}
@keyframes hhwave{from{transform:translate(-50%,-50%) scale(1);opacity:.75}
  to{transform:translate(-50%,-50%) scale(30);opacity:0}}
.hh-chain{background:#fff;color:#c33b6d;border-radius:999px;padding:1px 10px;font-size:14px;font-weight:900;
  animation:hhbump .5s ease infinite;}
.hh-turns{background:#ffffffdd;color:#6a4fa8;border-radius:999px;padding:1px 10px;font-size:14px;font-weight:900;}
.hh-turns-low{background:#fff0d6;color:#a35c11;}
@keyframes hhbump{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
.hh-foes{display:flex;gap:6px;justify-content:center;align-items:flex-start;flex-wrap:wrap;}
.hh-foe{flex:1 1 88px;min-width:0;max-width:180px;background:#ffffffcc;border-radius:14px;padding:6px 7px;
  display:flex;flex-direction:column;gap:4px;align-items:center;box-shadow:0 2px 7px rgba(150,140,190,.2);}
.hh-foe-on{outline:3px solid #ff9ec7;}
.hh-face{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#f3ecff;
  display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid #fff;}
.hh-foe-name{font-size:14px;font-weight:900;color:#5f4a86;text-align:center;line-height:1.3;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.hh-count{font-size:14px;font-weight:800;color:#7b6f9a;}
.hh-backs{display:flex;gap:2px;justify-content:center;min-height:20px;flex-wrap:wrap;}
.hh-back-c{width:13px;height:19px;display:block;}
.hh-bubble{font-size:14px;font-weight:900;color:#b8306a;background:#ffe6f0;border-radius:999px;padding:1px 8px;}
.hh-bubble-in{animation:hhbounce .45s cubic-bezier(.34,1.56,.64,1);}
@keyframes hhbounce{0%{transform:scale(.2) translateY(8px)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.hh-catch{border:none;border-radius:999px;padding:4px 9px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#ffd36e,#f0ad33);color:#7a4d0b;box-shadow:0 3px 0 #c9922f;
  min-height:44px;}
.hh-catch:active{transform:translateY(2px);box-shadow:0 1px 0 #c9922f;}
.hh-table{display:flex;align-items:center;justify-content:center;gap:14px;min-height:104px;position:relative;}
.hh-pile{position:relative;width:66px;height:96px;}
.hh-backsvg{display:block;width:100%;height:100%;}
.hh-deck{position:relative;width:66px;height:96px;border:none;cursor:pointer;padding:0;font-family:inherit;background:none;}
.hh-deck-stack{position:absolute;inset:0;transition:transform .12s ease;}
.hh-back{position:absolute;inset:2px;filter:drop-shadow(0 3px 2px rgba(90,70,140,.35));}
.hh-back-2{transform:translate(3px,2px) rotate(3deg);}
.hh-back-1{transform:translate(1px,1px) rotate(-2deg);}
.hh-deck-count{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);z-index:2;white-space:nowrap;
  background:#fffdf6ee;color:#6a52a0;border-radius:999px;padding:1px 8px;font-size:14px;font-weight:900;
  box-shadow:0 1px 3px rgba(90,70,140,.3);}
.hh-deck:active .hh-deck-stack{transform:translateY(2px);}
.hh-deck:disabled{opacity:.55;cursor:default;}
.hh-heap{position:relative;width:66px;height:96px;}
.hh-heap .hh-top{position:absolute;inset:0;}
.hh-heap-c{position:absolute;inset:0;filter:saturate(.85) brightness(.96);}
.hh-say{font-size:14px;font-weight:800;color:#7d6aa6;text-align:center;line-height:1.5;min-height:21px;}
.hh-say-oops{color:#c2557f;}
.hh-card{position:relative;border:none;border-radius:10px;cursor:pointer;padding:0;font-family:inherit;
  background:var(--soft,#fff);box-shadow:0 3px 7px rgba(120,105,160,.32);overflow:hidden;
  display:flex;align-items:center;justify-content:center;flex:0 0 auto;
  transition:transform .16s ease,box-shadow .16s ease;}
.hh-card-frame{position:absolute;inset:2px;border:2px solid rgba(255,255,255,.8);border-radius:7px;pointer-events:none;}
.hh-card-oval{position:absolute;left:9%;top:7%;width:82%;height:86%;border-radius:50%/40%;
  background:#fffffff2;transform:rotate(-20deg);box-shadow:0 1px 3px rgba(90,60,110,.18);}
.hh-card-face{position:relative;font-size:26px;font-weight:900;color:var(--ink,#b8306a);line-height:1;
  text-shadow:0 1px 0 #fff;}
.hh-card-icon{position:relative;display:flex;align-items:center;justify-content:center;line-height:0;}
.hh-card-mark{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);line-height:0;opacity:.95;}
.hh-card-corner{position:absolute;left:4px;top:3px;font-size:13px;font-weight:900;color:#fff;line-height:1;
  text-shadow:0 1px 2px rgba(90,50,110,.45);display:flex;flex-direction:column;align-items:center;gap:1px;}
.hh-card-corner2{position:absolute;right:4px;bottom:3px;font-size:13px;font-weight:900;color:#fff;line-height:1;
  text-shadow:0 1px 2px rgba(90,50,110,.45);display:flex;flex-direction:column;align-items:center;gap:1px;}
.hh-card-corner svg,.hh-card-corner2 svg{display:block;}
.hh-card-wild{background:conic-gradient(from .125turn,#F58FBB 0turn .25turn,#EFB33F .25turn .5turn,#54B584 .5turn .75turn,#5A9BE0 .75turn 1turn);}
.hh-card-on{transform:translateY(-10px);box-shadow:0 8px 14px rgba(200,120,170,.5);}
.hh-card-cur{outline:3px solid #6c4fd0;outline-offset:1px;}
.hh-card-dim{opacity:.5;}
.hh-card:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
.hh-top{width:66px;height:96px;}
.hh-hand{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:12px 4px 8px;scrollbar-width:thin;
  min-height:104px;align-items:flex-end;}
.hh-hand::-webkit-scrollbar{height:6px;}
.hh-hand::-webkit-scrollbar-thumb{background:#e2d6f5;border-radius:3px;}
.hh-hidden{display:flex;align-items:center;justify-content:center;width:100%;min-height:96px;
  font-size:14px;font-weight:800;color:#a99cc4;}
.hh-btns{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}
.hh-btn{border:none;border-radius:14px;min-height:44px;padding:8px 15px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;box-shadow:0 3px 0 rgba(140,120,190,.4);}
.hh-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.hh-btn:disabled{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.hh-btn-go{background:linear-gradient(180deg,#f793b6,#e2648f);color:#fff;box-shadow:0 3px 0 #b8496f;}
.hh-btn-go:active{box-shadow:0 1px 0 #b8496f;}
.hh-btn-ask{background:linear-gradient(180deg,#8fd7f0,#59b6d8);color:#0f4a5e;box-shadow:0 3px 0 #3d8ba8;}
.hh-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.hh-one{position:absolute;right:10px;bottom:10px;z-index:30;min-width:88px;min-height:44px;border:none;
  border-radius:999px;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer;color:#fff;
  background:linear-gradient(180deg,#ff8ab0,#e2557f);box-shadow:0 4px 0 #b23c63;animation:hhcall 1s ease infinite;}
.hh-one:active{transform:translateY(2px);box-shadow:0 2px 0 #b23c63;}
/* 有人正盯着你忘喊:钮上摆倒数,配色再催一档,免得孩子只看见自己被罚抽了 2 张 */
.hh-one.hh-one-hot{background:linear-gradient(180deg,#ffb45e,#ef7d24);box-shadow:0 4px 0 #c15e10;
  animation-duration:.45s;}
@keyframes hhcall{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.hh-keys{font-size:14px;font-weight:700;color:#8b7ead;text-align:center;line-height:1.6;}
.hh-fly{position:absolute;z-index:60;pointer-events:none;transition:transform .3s cubic-bezier(.3,.9,.4,1),opacity .3s ease;}
.hh-fly-arc{animation:hharc .3s ease-out;}
@keyframes hharc{0%,100%{transform:translateY(0)}45%{transform:translateY(-16px)}}
.hh-flyback{display:block;line-height:0;filter:drop-shadow(0 4px 4px rgba(90,70,140,.35));}
.hh-hidden-back{width:26px;height:38px;display:inline-block;margin-right:6px;line-height:0;}
.hh-cover{position:absolute;inset:0;background:rgba(255,246,251,.985);border-radius:18px;z-index:100;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.hh-cover-t{font-size:20px;font-weight:900;color:#7a5aa8;}
.hh-cover-s{font-size:14px;font-weight:700;color:#7d6aa6;line-height:1.6;max-width:320px;}
.hh-wheel{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.hh-swatch{width:74px;height:74px;border:none;border-radius:50%;cursor:pointer;font-family:inherit;
  font-size:14px;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(70,40,70,.45);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  box-shadow:0 4px 10px rgba(120,90,160,.35);animation:hhpop .32s cubic-bezier(.34,1.56,.64,1) both;}
.hh-swatch:nth-child(2){animation-delay:.05s;}
.hh-swatch:nth-child(3){animation-delay:.1s;}
.hh-swatch:nth-child(4){animation-delay:.15s;}
.hh-swatch:active{transform:scale(.93);}
.hh-swatch:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@keyframes hhpop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
.hh-shake{animation:hhshake .3s;}
@keyframes hhshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.hh-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.hh-bar[hidden]{display:none;}
.hh-open{border:none;border-radius:999px;padding:10px 16px;min-height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.hh-open.hh-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.hh-open.hh-open-duo{background:linear-gradient(180deg,#7fc7a4,#4fa37c);box-shadow:0 4px 0 #3b7f60;}
.hh-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.hh-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.hh-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.hh-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.hh-goback{border:none;border-radius:999px;padding:8px 13px;min-height:44px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.hh-goback:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.hh-chip{background:#ffffffdd;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#6a5892;
  box-shadow:0 2px 5px rgba(150,140,190,.18);}
.hh-over{position:relative;overflow:hidden;border-radius:16px;background:#fffdfa;padding:14px;text-align:center;
  display:flex;flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.hh-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.hh-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;}
.hh-ranks{display:flex;flex-direction:column;gap:6px;width:100%;max-width:340px;position:relative;z-index:1;}
.hh-rank{display:flex;align-items:center;gap:8px;background:#f4efff;border-radius:12px;padding:5px 10px;text-align:left;}
.hh-rank-win{background:linear-gradient(90deg,#fff3c9,#ffe9f3);box-shadow:0 2px 6px rgba(210,160,90,.3);}
.hh-rank .hh-face{width:28px;height:28px;font-size:17px;flex:0 0 auto;}
.hh-rank-name{font-size:14px;font-weight:900;color:#5f4a86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hh-rank-note{margin-left:auto;font-size:14px;font-weight:800;color:#7b6f9a;white-space:nowrap;}
.hh-rank-backs{display:flex;gap:2px;}
.hh-mini{width:11px;height:16px;display:block;line-height:0;}
.hh-fan{display:flex;}
.hh-fan-c{width:14px;height:21px;display:block;line-height:0;transform-origin:50% 90%;}
.hh-fan-c+.hh-fan-c{margin-left:-5px;}
.hh-confetti{position:absolute;inset:0;pointer-events:none;z-index:0;}
.hh-confetti-p{position:absolute;top:-14px;width:8px;height:13px;border-radius:3px;opacity:.9;
  animation:hhfall 1.5s ease-in forwards;}
@keyframes hhfall{to{transform:translateY(360px) rotate(230deg);opacity:0}}
@media (max-width:420px){
  .hh-wrap{padding:8px;gap:6px;}
  .hh-foe{flex-direction:row;flex-wrap:wrap;justify-content:flex-start;padding:5px 6px;gap:4px;}
  .hh-face{width:26px;height:26px;font-size:15px;}
  .hh-foe-name{max-width:64px;}
  .hh-backs{flex-basis:100%;justify-content:flex-start;min-height:16px;}
  .hh-btns{gap:5px;}
  .hh-btn{padding:7px 10px;font-size:14px;}
}
@media (max-height:500px){
  .hh-btns{position:sticky;bottom:0;z-index:5;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(246,242,255,.25),#f6f2ff 40%);}
  .hh-hidden{min-height:48px;}
}
@media (prefers-reduced-motion:reduce){
  .hh-fly{display:none;}
  .hh-chain,.hh-one{animation:none;}
  .hh-swatch{animation-duration:.12s;}
  .hh-card{transition:none;}
  .hh-shake{animation:none;}
  .hh-colorbar{transition:none;}
  .hh-colorbar-dot,.hh-bubble-in,.hh-fly-arc,.hh-confetti-p{animation:none;}
  .hh-colorwave{display:none;}
}
`;

// ---------------------------------------------------------------------------
// 牌面
// ---------------------------------------------------------------------------

/**
 * 手牌与台面共用的一张牌面,四层印刷质感:
 *  1. 卡底:主色对角渐变(左上提亮 12%),万能牌交给 .hh-card-wild 的四色花瓣转盘;
 *  2. 中央斜切白椭圆(−20°,样式在 .hh-card-oval)+ 2px 白内框(.hh-card-frame);
 *  3. 中央图案:数字牌是大数字 + 底部花色点缀,功能牌换成原创 SVG 图标;
 *  4. 双角标保留:数字/加二/加四写字,跳过/反转/万能摆缩小图标,
 *     有色牌一律再配一枚四色小符号(圆/方/三角/星)——色弱的第二通道。
 */
export function paintCard(el: HTMLElement, card: Card, w: number, h: number): void {
  const color = card.color;
  const ink = color ? COLOR_HEX[color] : "#6b4f9e";
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.setProperty("--soft", color ? COLOR_SOFT[color] : "#fff");
  el.style.setProperty("--ink", ink);
  el.style.background = color
    ? `linear-gradient(135deg,${lighten(COLOR_HEX[color], 0.12)},${COLOR_HEX[color]})`
    : "";
  el.className = `${el.className.replace(/ hh-card-wild/g, "")}${isWild(card) ? " hh-card-wild" : ""}`;
  const face = cardFace(card);
  const cornerShape = color ? colorShapeSVG(color, Math.max(7, Math.round(w * 0.15)), "#fff") : "";
  const cornerFace =
    card.kind === "num" || card.kind === "draw2" || card.kind === "wild4"
      ? face
      : actionIconSVG(card.kind, "#fff", Math.max(10, Math.round(w * 0.2)));
  const corner = `${cornerFace}${cornerShape}`;
  let center: string;
  let mark = "";
  if (card.kind === "num") {
    center = `<span class="hh-card-face" style="font-size:${Math.round(w * 0.5)}px">${face}</span>`;
    mark = color
      ? `<span class="hh-card-mark">${colorShapeSVG(color, Math.max(8, Math.round(w * 0.18)))}</span>`
      : "";
  } else {
    center = `<span class="hh-card-icon">${actionIconSVG(card.kind, ink, Math.round(w * 0.58))}</span>`;
  }
  el.innerHTML = `<span class="hh-card-oval"></span>
    <span class="hh-card-frame"></span>
    <span class="hh-card-corner">${corner}</span>
    ${center}${mark}
    <span class="hh-card-corner2">${corner}</span>`;
}

/** 出牌飞行时长(规格:0.3s 弧线) */
export const PLAY_FLY_MS = 300;

/** 摸牌飞行时长(规格:0.25s) */
export const DRAW_FLY_MS = 250;

/** 每张牌落定时的微旋转(±5°):用牌的 id 定死,重渲染不会跳 */
export function spinOf(card: Card): number {
  return ((card.id * 47) % 11) - 5;
}

/** 手牌宽度:窄屏也不低于 48px */
export function cardWidthFor(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 56;
  if (width <= 360) return 50;
  if (width <= 480) return 54;
  return 60;
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

function reduceMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches === true : false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 牌桌
// ---------------------------------------------------------------------------

export interface TableDone {
  state: HueState;
  /** 谁赢了这一局;-1 表示玩家手数用光了 */
  winner: number;
  /** 赢家这一局收了多少分 */
  gained: number;
  /** 各家剩下的手牌分 */
  scores: number[];
  /** 各家各动了几手 */
  actions: number[];
}

export interface TableOpts {
  cfg: RoundConfig;
  deck: Card[];
  seats: SeatCfg[];
  banner: string;
  startTurn?: number;
  /** 闯关的「N 手之内出完」:这个座位动满 max 手还没出完就算没过 */
  turnLimit?: { seat: number; max: number };
  sfx: (name: SoundName) => void;
  onDone: (r: TableDone) => void;
}

const KEYS_P1 = { left: "a", right: "d", up: "w", down: "s", play: "f", draw: "g" };
const KEYS_P2 = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", play: "l", draw: "k" };

function keyHint(seat: SeatCfg): string {
  // 提示行要把 KEYS_P1 / KEYS_P2 认的键写全:上下和左右是同一件事(往前挑 / 往后挑)
  const one =
    seat.keys === 0
      ? "W A S D 挑牌 · F 出牌 · G 抽牌"
      : "← → ↑ ↓ 挑牌 · L 出牌 · K 抽牌";
  return `${seat.name}:${one}`;
}

export function createTable(host: HTMLElement, opts: TableOpts): { destroy: () => void } {
  let destroyed = false;
  let paused = false;
  let over = false;
  /** 「就一张」抢按窗口还剩几格(0 = 没人盯着你,钮上不摆倒数) */
  let catchLeft = 0;
  /** 这一轮倒数盯的是哪个座位,免得同一个窗口被重复开成两轮 */
  let catchFor = -1;
  const timers = new Set<number>();

  const state = createGame({
    players: opts.seats.length,
    seed: opts.cfg.seed,
    deck: opts.deck,
    handSize: opts.cfg.handSize,
    startTurn: opts.startTurn ?? 0,
  });

  /**
   * 各家各动了几手。口径和 sim.ts 一致:出牌、抽牌、抽整条链、质疑各算一手,
   * 摸到能出的牌顺手打掉仍然只算摸牌那一手。关卡的「N 手之内出完」照这个数。
   */
  const actions = new Array(opts.seats.length).fill(0) as number[];

  const humans = opts.seats.map((s, i) => (s.kind === "human" ? i : -1)).filter((i) => i >= 0);
  /** 界面下面摊开的是哪一家的手牌 */
  let showSeat = humans[0] ?? 0;
  /** 双人同屏换人时的遮挡幕 */
  let curtainFor = -1;
  let cursor = 0;
  let say = "";
  let sayBad = false;
  /** 色条上一次画的颜色:换色那一下要荡波纹 */
  let shownColor: Color = state.color;
  /** 哪些座位的「就一张!」气泡已经弹过场了,重渲染不再重播弹跳 */
  const bubbleSeen = new Set<number>();
  /** 正在等玩家挑颜色的那张万能牌 */
  let wildPick: number | null = null;
  /** 加四明知违规还要打:第二次点才真的打出去 */
  let riskyConfirm: number | null = null;
  let aiPending = false;

  const wrap = document.createElement("div");
  wrap.className = "hh-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const banner = document.createElement("div");
  banner.className = "hh-banner";
  banner.innerHTML = opts.banner;
  const colorBar = document.createElement("div");
  colorBar.className = "hh-colorbar";
  const foesEl = document.createElement("div");
  foesEl.className = "hh-foes";
  const tableEl = document.createElement("div");
  tableEl.className = "hh-table";
  const sayEl = document.createElement("div");
  sayEl.className = "hh-say";
  const handEl = document.createElement("div");
  handEl.className = "hh-hand";
  handEl.setAttribute("role", "list");
  handEl.setAttribute("aria-label", "我的手牌");
  const btnsEl = document.createElement("div");
  btnsEl.className = "hh-btns";
  const keysEl = document.createElement("div");
  keysEl.className = "hh-keys";
  wrap.append(style, banner, colorBar, foesEl, tableEl, sayEl, handEl, btnsEl, keysEl);
  host.appendChild(wrap);

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

  function tell(text: string, bad = false): void {
    say = text;
    sayBad = bad;
  }

  function bump(seat: number): void {
    actions[seat]++;
  }

  /** 限手数的关卡里还剩几手;不限手数返回 null */
  function turnsLeft(): number | null {
    const lim = opts.turnLimit;
    if (!lim) return null;
    return Math.max(0, lim.max - actions[lim.seat]);
  }

  // -------------------------------------------------------------------------
  // 动画:出牌飞到中央、抽牌从牌堆滑进手里、罚牌连着飞
  // -------------------------------------------------------------------------

  /**
   * 造一个飞行替身:外层走位移(带落定旋转),内层走一段小弧线,到点自己收走。
   * face 给牌就牌面朝上飞,不给就用花背(对手摸牌、罚抽都是背面朝上)。
   * reduceMotion 直接落位:一个替身都不造,牌桌照常重渲染。
   */
  function flyGhost(face: Card | null, from: HTMLElement | null, to: HTMLElement | null, ms: number, deg: number): void {
    if (!from || !to || destroyed || reduceMotion()) return;
    const box = wrap.getBoundingClientRect?.();
    const a = from.getBoundingClientRect?.();
    const b = to.getBoundingClientRect?.();
    if (!box || !a || !b || (a.width === 0 && b.width === 0)) return;
    const inner = document.createElement("div");
    inner.className = face ? "hh-card hh-fly-arc" : "hh-flyback hh-fly-arc";
    if (face) {
      paintCard(inner, face, Math.max(40, a.width || 56), Math.max(58, a.height || 84));
    } else {
      inner.style.width = "44px";
      inner.style.height = "64px";
      inner.innerHTML = cardBackSVG();
    }
    inner.style.animationDuration = `${ms}ms`;
    const ghost = document.createElement("div");
    ghost.className = "hh-fly";
    ghost.style.transition = `transform ${ms}ms cubic-bezier(.3,.9,.4,1),opacity ${ms}ms ease`;
    ghost.style.left = `${a.left - box.left}px`;
    ghost.style.top = `${a.top - box.top}px`;
    ghost.appendChild(inner);
    wrap.appendChild(ghost);
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    later(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(${deg}deg)`;
    }, 16);
    later(() => ghost.remove(), ms + 70);
  }

  /** 出牌:牌面朝上 0.3s 飞向弃牌堆,落定带这张牌自己的 ±5° 微旋转 */
  function flyCard(card: Card, from: HTMLElement | null, to: HTMLElement | null): void {
    flyGhost(card, from, to, PLAY_FLY_MS, spinOf(card));
  }

  /** 自己摸牌:牌面朝上 0.25s 从牌堆滑进手里 */
  function flyDraw(card: Card, from: HTMLElement | null, to: HTMLElement | null): void {
    flyGhost(card, from, to, DRAW_FLY_MS, -4);
  }

  /** 背面朝上飞一张(对手摸牌、罚抽) */
  function flyBack(from: HTMLElement | null, to: HTMLElement | null): void {
    flyGhost(null, from, to, DRAW_FLY_MS, 5);
  }

  /** 一次抽 N 张:N 张花背间隔 60ms 连着飞,最多演 8 张,起点终点到点再查(渲染会换节点) */
  function flyBurst(n: number, from: () => HTMLElement | null, to: () => HTMLElement | null): void {
    const count = Math.min(8, n);
    for (let i = 0; i < count; i++) later(() => flyBack(from(), to()), i * 60);
  }

  function pileEl(): HTMLElement | null {
    return tableEl.querySelector(".hh-top") as HTMLElement | null;
  }

  function deckEl(): HTMLElement | null {
    return tableEl.querySelector(".hh-deck") as HTMLElement | null;
  }

  /** 第 seat 位对手的卡片盒(对手出牌/摸牌的飞行起点与终点) */
  function foeBoxEl(seat: number): HTMLElement | null {
    return foesEl.querySelector(`.hh-foe-p${seat}`) as HTMLElement | null;
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  function renderColorBar(): void {
    const c = state.color;
    colorBar.style.background = COLOR_HEX[c];
    const chain = chainPending(state)
      ? `<span class="hh-chain">叠加中 +${drawStack(state.chain)}</span>`
      : "";
    const left = turnsLeft();
    const turns =
      left === null
        ? ""
        : `<span class="hh-turns${left <= 3 ? " hh-turns-low" : ""}">还剩 ${left} 手</span>`;
    // 呼吸圆点里摆当前色的形状符号(圆/方/三角/星):和卡面角标同一套第二通道
    colorBar.innerHTML = `<span class="hh-colorbar-dot">${colorShapeSVG(c, 13, "#fff")}</span><span>现在是${COLOR_NAMES[c]}</span>${chain}${turns}`;
    colorBar.setAttribute(
      "aria-label",
      left === null ? `现在是${COLOR_NAMES[c]}` : `现在是${COLOR_NAMES[c]},还剩 ${left} 手`
    );
    // 变色仪式:换色那一下从中心荡开一圈新色波纹(reduceMotion 直接切,不荡)
    if (shownColor !== c) {
      shownColor = c;
      if (!reduceMotion()) {
        const wave = document.createElement("span");
        wave.className = "hh-colorwave";
        wave.style.background = COLOR_HEX[c];
        colorBar.appendChild(wave);
        later(() => wave.remove(), 440);
      }
    }
  }

  function renderFoes(): void {
    foesEl.innerHTML = "";
    for (let i = 0; i < opts.seats.length; i++) {
      if (i === showSeat) continue;
      const s = opts.seats[i];
      const p = state.players[i];
      const box = document.createElement("div");
      box.className = `hh-foe hh-foe-p${i}${state.turn === i && !over ? " hh-foe-on" : ""}`;
      const face = s.isImg
        ? `<img class="hh-face" src="${s.avatar}" alt="${s.name}">`
        : `<span class="hh-face">${s.avatar}</span>`;
      const backs = new Array(Math.min(10, p.hand.length))
        .fill(`<span class="hh-back-c">${cardBackSVG()}</span>`)
        .join("");
      // 气泡第一次冒头才弹跳,之后的重渲染不再重播
      const calling = p.hand.length === 1 && p.called;
      const called = calling
        ? `<span class="hh-bubble${bubbleSeen.has(i) ? "" : " hh-bubble-in"}">就一张!</span>`
        : "";
      if (calling) bubbleSeen.add(i);
      else bubbleSeen.delete(i);
      box.innerHTML = `${face}
        <span class="hh-foe-name">${s.name}${s.kind === "ai" ? `·${TIER_NAMES[s.tier]}` : ""}</span>
        <span class="hh-count">${p.hand.length} 张</span>
        <span class="hh-backs">${backs}</span>${called}`;
      // 对手只剩一张又没吭声:可以点破他
      if (!over && p.hand.length === 1 && !p.called && state.oneCard?.player === i) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hh-catch";
        btn.textContent = "点破他!";
        btn.addEventListener("click", () => humanCatch(i));
        box.appendChild(btn);
      }
      foesEl.appendChild(box);
    }
  }

  function renderTable(): void {
    tableEl.innerHTML = "";
    // 牌堆:三张微错位的花背叠出厚度,张数摆在徽章上,不再用字体字符占位
    const deckBtn = document.createElement("button");
    deckBtn.type = "button";
    deckBtn.className = "hh-deck";
    const back = cardBackSVG();
    deckBtn.innerHTML = `<span class="hh-deck-stack" aria-hidden="true"><span class="hh-back hh-back-2">${back}</span><span class="hh-back hh-back-1">${back}</span><span class="hh-back hh-back-0">${back}</span></span><span class="hh-deck-count">${state.deck.length} 张</span>`;
    deckBtn.setAttribute("aria-label", `牌堆还有 ${state.deck.length} 张,点一下摸牌`);
    deckBtn.disabled = !canAct() || chainPending(state) || state.drawnId !== null;
    deckBtn.addEventListener("click", humanDraw);
    tableEl.appendChild(deckBtn);

    // 弃牌堆:顶牌下面垫两张出过的牌,微微旋开(−6°/4°),出过牌才有
    const heap = document.createElement("div");
    heap.className = "hh-heap";
    const history = state.pile.slice(0, -1).slice(-2);
    history.forEach((card, idx) => {
      const under = document.createElement("div");
      under.className = "hh-card hh-heap-c";
      paintCard(under, card, 66, 96);
      under.style.transform = `rotate(${idx === history.length - 1 ? -6 : 4}deg)`;
      under.setAttribute("aria-hidden", "true");
      heap.appendChild(under);
    });
    const top = document.createElement("div");
    top.className = "hh-card hh-top";
    paintCard(top, topCard(state), 66, 96);
    top.style.transform = `rotate(${spinOf(topCard(state))}deg)`;
    top.setAttribute("aria-label", `台面上是${cardLabel(topCard(state))}`);
    heap.appendChild(top);
    tableEl.appendChild(heap);
  }

  function renderHand(): void {
    handEl.innerHTML = "";
    if (curtainFor >= 0) {
      const hidden = document.createElement("div");
      hidden.className = "hh-hidden";
      hidden.innerHTML = `<span class="hh-hidden-back" aria-hidden="true">${cardBackSVG()}</span>牌先收起来啦`;
      handEl.appendChild(hidden);
      return;
    }
    const hand = state.players[showSeat]?.hand ?? [];
    const w = cardWidthFor(viewportWidth());
    const h = Math.round(w * 1.45);
    const playable = new Set(legalPlays(state, showSeat).map((c) => c.id));
    cursor = Math.max(0, Math.min(cursor, hand.length - 1));
    const cards: HTMLElement[] = [];
    hand.forEach((card, i) => {
      const el = document.createElement("button");
      el.type = "button";
      const on = state.drawnId === card.id;
      el.className = `hh-card${on ? " hh-card-on" : ""}${i === cursor ? " hh-card-cur" : ""}${
        canAct() && !playable.has(card.id) ? " hh-card-dim" : ""
      }`;
      paintCard(el, card, w, h);
      el.setAttribute("aria-label", cardLabel(card));
      el.addEventListener("click", () => tapCard(i));
      handEl.appendChild(el);
      cards.push(el);
    });
    // 360px 上七张牌一行摆不下,`.hh-hand` 要横滑。光标挪到看不见的那张时得把它带进视野,
    // 不然孩子按 A / D 会以为键坏了。`nearest` 保证已经看得见的时候一动不动,也不会带着整页乱跳。
    cards[cursor]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function mkBtn(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `hh-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderButtons(): void {
    btnsEl.innerHTML = "";
    const mine = canAct();
    if (mine && chainPending(state)) {
      if (state.pendingW4?.target === showSeat) {
        btnsEl.appendChild(mkBtn("🔍 质疑加四", "hh-btn-ask", humanChallenge));
      }
      btnsEl.appendChild(
        mkBtn(`😮 一次抽 ${drawStack(state.chain)} 张`, "hh-btn-go", () => humanTake())
      );
    } else if (mine && state.drawnId !== null) {
      btnsEl.appendChild(mkBtn("✅ 出这张", "hh-btn-go", () => tapCardById(state.drawnId as number)));
      btnsEl.appendChild(mkBtn("🙅 先不出", "", humanPass));
    } else {
      btnsEl.appendChild(mkBtn("🎴 抽牌", "", humanDraw, !mine || chainPending(state)));
      btnsEl.appendChild(mkBtn("✅ 出牌", "hh-btn-go", () => tapCard(cursor), !mine));
    }
    btnsEl.appendChild(mkBtn(paused ? "▶️ 继续" : "⏸ 暂停", "", togglePause, over));

    // 「就一张」钮:固定右下角,手上剩一张时才亮
    const old = wrap.querySelector(".hh-one");
    old?.remove();
    const me = state.players[showSeat];
    if (!over && me && me.hand.length === 1 && !me.called && opts.seats[showSeat].kind === "human") {
      const one = document.createElement("button");
      one.type = "button";
      // 有人正等着点破你的时候,钮上摆一个看得见的倒数
      const hot = catchLeft > 0 && state.oneCard?.player === showSeat;
      one.className = hot ? "hh-one hh-one-hot" : "hh-one";
      one.textContent = hot ? `☝️ 就一张 ${catchLeft}` : "☝️ 就一张";
      one.setAttribute("data-left", String(hot ? catchLeft : 0));
      one.addEventListener("click", () => {
        if (callOneCard(state, showSeat)) {
          catchLeft = 0;
          catchFor = -1;
          opts.sfx("meow");
          tell("喊得漂亮!这下罚不到你了。");
          render();
        }
      });
      wrap.appendChild(one);
    }
  }

  function renderKeys(): void {
    const lines = humans.map((i) => keyHint(opts.seats[i]));
    lines.push("手机直接点牌就能出 · Esc 暂停");
    keysEl.innerHTML = lines.join("<br>");
  }

  function renderCover(): void {
    wrap.querySelector(".hh-cover")?.remove();
    if (paused) {
      const c = document.createElement("div");
      c.className = "hh-cover";
      c.innerHTML = `<div class="hh-cover-t">⏸ 先歇一会儿</div>
        <div class="hh-cover-s">牌都给你留着,回来接着打。</div>`;
      c.appendChild(mkBtn("▶️ 继续玩", "hh-btn-go", togglePause));
      wrap.appendChild(c);
      return;
    }
    if (wildPick !== null) {
      const card = state.players[showSeat].hand.find((c) => c.id === wildPick);
      const c = document.createElement("div");
      c.className = "hh-cover";
      c.innerHTML = `<div class="hh-cover-t">🌈 想换成什么颜色?</div>
        <div class="hh-cover-s">${card?.kind === "wild4" ? "加四打出去,下一家要抽 4 张。" : "挑一个自己牌最多的颜色。"}</div>`;
      const wheel = document.createElement("div");
      wheel.className = "hh-wheel";
      COLORS.forEach((color, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hh-swatch";
        b.style.background = COLOR_HEX[color];
        // 色块 + 形状符号 + 中文名:三条通道一起上,色弱也挑得准
        b.innerHTML = `${colorShapeSVG(color, 15, "#fff")}<span>${i + 1} ${COLOR_NAMES[color]}</span>`;
        b.addEventListener("click", () => confirmWild(color));
        wheel.appendChild(b);
      });
      c.appendChild(wheel);
      c.appendChild(mkBtn("↩️ 不出了", "", () => {
        wildPick = null;
        render();
      }));
      wrap.appendChild(c);
      return;
    }
    if (curtainFor >= 0) {
      const s = opts.seats[curtainFor];
      const c = document.createElement("div");
      c.className = "hh-cover";
      c.innerHTML = `<div class="hh-cover-t">🙈 轮到 ${s.name} 啦</div>
        <div class="hh-cover-s">另一位先把眼睛捂上,${s.name} 准备好了再点下面的按钮。</div>`;
      c.appendChild(
        mkBtn("我准备好了", "hh-btn-go", () => {
          opts.sfx("tap");
          showSeat = curtainFor;
          curtainFor = -1;
          cursor = 0;
          render();
        })
      );
      wrap.appendChild(c);
    }
  }

  function render(): void {
    if (destroyed) return;
    syncShowSeat();
    renderColorBar();
    renderFoes();
    renderTable();
    sayEl.className = `hh-say${sayBad ? " hh-say-oops" : ""}`;
    sayEl.textContent = say;
    renderHand();
    renderButtons();
    renderKeys();
    renderCover();
  }

  /** 只有一个人玩就永远摊他的牌;两个人玩就靠遮挡幕换人 */
  function syncShowSeat(): void {
    if (humans.length <= 1) {
      showSeat = humans[0] ?? 0;
      curtainFor = -1;
      return;
    }
    const me = state.turn;
    if (!over && opts.seats[me]?.kind === "human" && me !== showSeat) curtainFor = me;
    else if (curtainFor >= 0 && (over || opts.seats[me]?.kind !== "human")) curtainFor = -1;
  }

  function canAct(): boolean {
    return (
      !over &&
      !paused &&
      curtainFor < 0 &&
      wildPick === null &&
      state.turn === showSeat &&
      opts.seats[showSeat]?.kind === "human"
    );
  }

  // -------------------------------------------------------------------------
  // 玩家动作
  // -------------------------------------------------------------------------

  function afterMove(): void {
    if (state.finished) {
      finish();
      return;
    }
    if (turnsLeft() === 0) {
      finish(true);
      return;
    }
    render();
    scheduleCatch();
    pump();
  }

  function doPlay(cardId: number, color?: Color): boolean {
    const from = handEl.children[
      state.players[showSeat].hand.findIndex((c) => c.id === cardId)
    ] as HTMLElement | undefined;
    const card = state.players[showSeat].hand.find((c) => c.id === cardId);
    // 刚摸上来顺手打掉的那张,摸牌时已经记过一手了
    const fromDraw = state.drawnId === cardId;
    const res = playCard(state, showSeat, cardId, color);
    if (!res.ok) {
      tell(res.reason ?? "这张现在出不了。", true);
      opts.sfx("oops");
      wrap.className = "hh-wrap hh-shake";
      later(() => {
        wrap.className = "hh-wrap";
      }, 320);
      render();
      return false;
    }
    if (!fromDraw) bump(showSeat);
    if (card) flyCard(card, from ?? null, pileEl());
    opts.sfx(card && isWild(card) ? "pop" : "tap");
    riskyConfirm = null;
    tell(card ? `打出${cardLabel(card)}。` : "");
    afterMove();
    return true;
  }

  function confirmWild(color: Color): void {
    const id = wildPick;
    wildPick = null;
    if (id === null) return;
    doPlay(id, color);
  }

  function tapCard(index: number): void {
    const hand = state.players[showSeat]?.hand ?? [];
    if (index < 0 || index >= hand.length) return;
    tapCardById(hand[index].id);
  }

  function tapCardById(cardId: number): void {
    if (!canAct()) return;
    const hand = state.players[showSeat].hand;
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return;
    cursor = idx;
    const card = hand[idx];
    if (isWild(card) && !chainPending(state)) {
      // 加四明知手上还有当前色:先提醒一次,再点才真的打
      if (card.kind === "wild4" && !wildDraw4Legal(hand.filter((c) => c.id !== cardId), state.color)) {
        if (riskyConfirm !== cardId) {
          riskyConfirm = cardId;
          tell(`手上还有${COLOR_NAMES[state.color]},现在打加四会被质疑。真要打就再点一下。`, true);
          opts.sfx("oops");
          render();
          return;
        }
      }
      wildPick = cardId;
      opts.sfx("tap");
      render();
      return;
    }
    doPlay(cardId);
  }

  function humanDraw(): void {
    if (!canAct() || chainPending(state) || state.drawnId !== null) return;
    const res = drawFromDeck(state, showSeat);
    bump(showSeat);
    opts.sfx("pop");
    if (res.card) {
      const hand = state.players[showSeat].hand;
      later(() => {
        const el = handEl.children[hand.findIndex((c) => c.id === res.card?.id)] as HTMLElement | undefined;
        if (res.card) flyDraw(res.card, deckEl(), el ?? null);
      }, 0);
    }
    tell(
      res.card
        ? res.playable
          ? "摸到能出的啦,可以马上打出去。"
          : `摸到${cardLabel(res.card)},这张接不上,换下一家。`
        : isDraw(state)
          ? DRAW_LINE
          : "牌堆空了,这一手先过。"
    );
    afterMove();
  }

  function humanPass(): void {
    if (!canAct() || state.drawnId === null) return;
    passAfterDraw(state, showSeat);
    opts.sfx("tap");
    tell("这一手先过。");
    afterMove();
  }

  function humanTake(): void {
    if (!canAct() || !chainPending(state)) return;
    const got = takeChain(state, showSeat);
    bump(showSeat);
    opts.sfx("pop");
    // 叠加惩罚:N 张花背从牌堆连着飞进手里
    flyBurst(got, () => deckEl(), () => handEl);
    tell(`一次抽了 ${got} 张,这条链断在这里。`);
    afterMove();
  }

  function humanChallenge(): void {
    if (!canAct() || state.pendingW4?.target !== showSeat) return;
    const res = resolveChallenge(state, showSeat);
    if (!res) return;
    bump(showSeat);
    opts.sfx(res.bluffed ? "coin" : "oops");
    const who = opts.seats[res.seat].name;
    tell(
      res.bluffed
        ? `质疑成立!${who} 手上确实有${COLOR_NAMES[state.color]},自己抽 ${res.drawn} 张,加四不算数。`
        : `质疑失败,${who} 反而抽了 ${res.drawn} 张。`,
      !res.bluffed
    );
    afterMove();
  }

  function humanCatch(target: number): void {
    if (over || paused) return;
    const res = oneCardPenalty(state, target);
    if (!res.penalized) return;
    opts.sfx("coin");
    tell(`点破 ${opts.seats[target].name} 忘喊「就一张」,他罚抽 ${res.drawn} 张!`);
    render();
    // 点破成功的演出:对手盒子抖一下,罚牌连着飞过去
    const box = foeBoxEl(target);
    if (box && !reduceMotion()) {
      box.className += " hh-shake";
      later(() => {
        box.className = box.className.replace(" hh-shake", "");
      }, 340);
    }
    flyBurst(res.drawn, () => deckEl(), () => foeBoxEl(target));
  }

  function togglePause(): void {
    if (over) return;
    paused = !paused;
    opts.sfx("tap");
    render();
    if (!paused) pump();
  }

  // -------------------------------------------------------------------------
  // AI
  // -------------------------------------------------------------------------

  /** 会点破的 AI 抓忘喊的人:留一点点时间让孩子先按按钮 */
  function scheduleCatch(): void {
    const window0 = state.oneCard;
    if (!window0 || over) {
      catchLeft = 0;
      catchFor = -1;
      return;
    }
    const target = window0.player;
    if (opts.seats[target]?.kind !== "human") return;
    const hunter = opts.seats.findIndex((s, i) => i !== target && s.kind === "ai" && aiCatchesOneCard(s.tier));
    if (hunter < 0) return;
    // 同一个窗口已经在倒数了就别重开一轮:头一个计时器照旧按时到点
    if (catchFor === target && catchLeft > 0) return;
    // 窗口时长一毫秒没动(动它等于动难度),只是把「还剩多久」摆到钮上
    catchFor = target;
    catchLeft = CATCH_TICKS;
    render();
    for (let i = 1; i < CATCH_TICKS; i++) {
      later(() => {
        if (over || paused) return;
        if (state.oneCard?.player !== target) return;
        catchLeft = CATCH_TICKS - i;
        render();
      }, (CATCH_DELAY_MS / CATCH_TICKS) * i);
    }
    later(() => {
      catchLeft = 0;
      catchFor = -1;
      if (over || paused) return;
      if (state.oneCard?.player !== target) return;
      const res = oneCardPenalty(state, target);
      if (res.penalized) {
        opts.sfx("oops");
        tell(`${opts.seats[hunter].name} 点破了你没喊「就一张」,罚抽 ${res.drawn} 张。下次手快一点!`, true);
        render();
        flyBurst(res.drawn, () => deckEl(), () => handEl);
      }
    }, CATCH_DELAY_MS);
  }

  function pump(): void {
    if (destroyed || over || paused) return;
    if (opts.seats[state.turn]?.kind !== "ai" || aiPending) return;
    aiPending = true;
    later(() => {
      aiPending = false;
      if (destroyed || over) return;
      if (paused) {
        pump();
        return;
      }
      aiStep();
    }, 760);
  }

  function aiStep(): void {
    const seat = state.turn;
    const cfg = opts.seats[seat];
    const action = aiPlay(state, cfg.tier);
    if (action.type === "challenge") {
      const res = resolveChallenge(state, seat);
      opts.sfx("jump");
      if (res) {
        tell(
          res.bluffed
            ? `${cfg.name} 质疑成功!打加四的人自己抽了 ${res.drawn} 张。`
            : `${cfg.name} 质疑失败,自己抽了 ${res.drawn} 张。`
        );
      }
    } else if (action.type === "take") {
      const got = takeChain(state, seat);
      opts.sfx("pop");
      flyBurst(got, () => deckEl(), () => foeBoxEl(seat));
      tell(`${cfg.name} 接不上,一次抽了 ${got} 张。`);
    } else if (action.type === "play") {
      const card = state.players[seat].hand.find((c) => c.id === action.cardId);
      const res = playCard(state, seat, action.cardId, action.color);
      if (res.ok && card) {
        flyCard(card, foeBoxEl(seat), pileEl());
        opts.sfx(isWild(card) ? "pop" : "tap");
        tell(`${cfg.name} 打出${cardLabel(card)}。`);
        if (state.players[seat].hand.length === 1 && cfg.tier !== "rookie") {
          callOneCard(state, seat);
          tell(`${cfg.name}:就一张!`);
        }
      }
    } else {
      const res = drawFromDeck(state, seat);
      if (res.playable && res.card) {
        flyBack(deckEl(), foeBoxEl(seat));
        playCard(state, seat, res.card.id, undefined);
        flyCard(res.card, foeBoxEl(seat), pileEl());
        opts.sfx("tap");
        tell(`${cfg.name} 摸了一张,顺手就打出去了。`);
        if (state.players[seat].hand.length === 1 && cfg.tier !== "rookie") callOneCard(state, seat);
      } else if (!res.card) {
        opts.sfx("pop");
        tell(isDraw(state) ? DRAW_LINE : `${cfg.name} 想摸牌,可牌堆空着,这一手先过。`);
      } else {
        passAfterDraw(state, seat);
        opts.sfx("pop");
        flyBack(deckEl(), foeBoxEl(seat));
        tell(`${cfg.name} 摸了一张。`);
      }
    }
    bump(seat);
    // 换手之后先看看有没有人忘喊
    const forgot = state.oneCard;
    if (forgot && opts.seats[forgot.player].kind === "ai") {
      const hunter = opts.seats.findIndex(
        (s, i) => i !== forgot.player && s.kind === "ai" && aiCatchesOneCard(s.tier)
      );
      if (hunter >= 0) oneCardPenalty(state, forgot.player);
    }
    afterMove();
  }

  // -------------------------------------------------------------------------
  // 结束
  // -------------------------------------------------------------------------

  /** timeUp:限手数的关卡里手数先用光了,这一局按没打完算 */
  function finish(timeUp = false): void {
    if (over) return;
    over = true;
    curtainFor = -1;
    if (timeUp) tell("手数用完啦,这一局先到这儿。", true);
    render();
    const scores = state.players.map((p) => handScore(p.hand));
    const winner = timeUp ? -1 : state.winner;
    const gained =
      winner < 0
        ? 0
        : roundScore(
            state.players.map((p) => p.hand),
            winner
          );
    later(() => {
      if (!destroyed) opts.onDone({ state, winner, gained, scores, actions: actions.slice() });
    }, 620);
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
    if (paused || over) return;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

    if (wildPick !== null) {
      const n = Number(key);
      if (n >= 1 && n <= 4) {
        ev.preventDefault();
        confirmWild(COLORS[n - 1]);
      }
      return;
    }
    if (curtainFor >= 0) return;
    const seat = opts.seats[state.turn];
    if (!seat || seat.kind !== "human" || state.turn !== showSeat) return;
    // 只有一个人玩的时候两套键位都认,两个人玩就各按各的
    const sets = humans.length > 1 ? [seat.keys === 0 ? KEYS_P1 : KEYS_P2] : [KEYS_P1, KEYS_P2];
    const hand = state.players[showSeat].hand;
    for (const k of sets) {
      if (key === k.left || key === k.up) {
        ev.preventDefault();
        cursor = (cursor - 1 + hand.length) % Math.max(1, hand.length);
        render();
        return;
      }
      if (key === k.right || key === k.down) {
        ev.preventDefault();
        cursor = (cursor + 1) % Math.max(1, hand.length);
        render();
        return;
      }
      if (key === k.play) {
        ev.preventDefault();
        if (chainPending(state)) humanTake();
        else tapCard(cursor);
        return;
      }
      if (key === k.draw) {
        ev.preventDefault();
        if (state.drawnId !== null) humanPass();
        else humanDraw();
        return;
      }
    }
  }

  const onResize = (): void => {
    if (!destroyed) renderHand();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  tell(mustTakeChain(state, showSeat) ? "接不上就一次抽完这条链。" : "颜色或数字对上就能出,点一张试试。");
  render();
  pump();

  return {
    destroy() {
      destroyed = true;
      clearTimers();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关:188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const level: HueLevel = buildLevel(ctx.level);
  let table: { destroy: () => void } | null = null;
  let round = 0;
  const totals = new Array(level.players).fill(0);

  function cfgOf(): RoundConfig {
    return {
      players: level.players,
      tiers: level.tiers,
      kinds: level.kinds,
      handSize: level.handSize,
      seed: level.seed + round * 7919,
      hint: level.hint,
    };
  }

  function start(): void {
    table?.destroy();
    stage.innerHTML = "";
    const ch = CHAPTERS[level.chapter];
    const scoreLine = level.goalScore ? `<br>比分:你 ${totals[0]} 分 · 目标 ${level.goalScore} 分` : "";
    table = createTable(stage, {
      cfg: cfgOf(),
      deck: levelDeck(level, round),
      seats: soloSeats(level.players, level.tiers),
      startTurn: level.goalScore ? round % level.players : 0,
      turnLimit: level.goalScore ? undefined : { seat: 0, max: level.maxTurns },
      banner: `${ch.emoji} 第 ${ctx.level + 1} 关 · ${levelBrief(level)}<br>${level.hint}${scoreLine}`,
      sfx: ctx.sfx,
      onDone: (r) => {
        if (level.goalScore) {
          if (r.winner >= 0) totals[r.winner] += r.gained;
          round++;
          if (totals[0] >= level.goalScore) {
            ctx.win(matchStars(round), winLine(level, matchStars(round)));
            return;
          }
          const foeBest = Math.max(...totals.filter((_, i) => i !== 0));
          if (foeBest >= level.goalScore) {
            ctx.lose(`这一届接龙杯被对手先端走了。${leftoverLine(state0Left(r))}`);
            return;
          }
          start();
          return;
        }
        if (r.winner === 0) {
          const stars = levelStars(level, r.actions[0]);
          ctx.win(stars, winLine(level, stars));
        } else {
          ctx.lose(loseLine(r.state.players[0].hand.length));
        }
      },
    });
  }

  function state0Left(r: TableDone): number {
    return r.state.players[0].hand.length;
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
// 模式外壳
// ---------------------------------------------------------------------------

interface ModeShell {
  wrap: HTMLElement;
  chip: HTMLElement;
  stage: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void): ModeShell {
  const wrap = document.createElement("div");
  wrap.className = "hh-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "hh-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "hh-goback";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "hh-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);
  return { wrap, chip, stage, destroy: () => wrap.remove() };
}

/**
 * 结算名次列表:赢家排最前,其余按剩牌少到多。
 * 每行头像 + 名字 + 剩余手牌小图;胜者那行摆一把小卡扇,
 * 有人赢的时候全场撒彩带(位置与延迟按序号定死,不引随机;reduceMotion 由 CSS 关掉动画)。
 */
export function resultRanksHTML(seats: readonly SeatCfg[], r: TableDone): string {
  const back = cardBackSVG();
  const order = seats
    .map((_, i) => i)
    .sort((a, b) => {
      if (a === r.winner) return -1;
      if (b === r.winner) return 1;
      return r.state.players[a].hand.length - r.state.players[b].hand.length;
    });
  const rows = order
    .map((i) => {
      const s = seats[i];
      const left = r.state.players[i].hand.length;
      const win = i === r.winner;
      const face = s.isImg
        ? `<img class="hh-face" src="${s.avatar}" alt="${s.name}">`
        : `<span class="hh-face">${s.avatar}</span>`;
      const fan = new Array(5)
        .fill(0)
        .map((_, k) => `<span class="hh-fan-c" style="transform:rotate(${(k - 2) * 14}deg)">${back}</span>`)
        .join("");
      const minis = win
        ? `<span class="hh-fan">${fan}</span>`
        : `<span class="hh-rank-backs">${new Array(Math.min(6, left)).fill(`<span class="hh-mini">${back}</span>`).join("")}</span>`;
      const note = win ? "先出完!" : `剩 ${left} 张 · ${r.scores[i]} 分`;
      return `<div class="hh-rank${win ? " hh-rank-win" : ""}">${face}<span class="hh-rank-name">${s.name}</span>${minis}<span class="hh-rank-note">${note}</span></div>`;
    })
    .join("");
  const confetti =
    r.winner >= 0 && seats[r.winner]?.kind === "human"
      ? `<span class="hh-confetti" aria-hidden="true">${new Array(12)
          .fill(0)
          .map(
            (_, k) =>
              `<span class="hh-confetti-p" style="left:${(k * 83) % 97}%;background:${COLOR_HEX[COLORS[k % COLORS.length]]};animation-delay:${k * 70}ms"></span>`
          )
          .join("")}</span>`
      : "";
  return `${confetti}<div class="hh-ranks">${rows}</div>`;
}

function overPanel(
  stage: HTMLElement,
  title: string,
  sub: string,
  label: string,
  onAgain: () => void,
  ranksHTML = ""
): void {
  stage.innerHTML = "";
  const box = document.createElement("div");
  box.className = "hh-over";
  box.innerHTML = `<div class="hh-over-t">${title}</div><div class="hh-over-s">${sub}</div>${ranksHTML}`;
  const again = document.createElement("button");
  again.type = "button";
  again.className = "hh-open";
  again.textContent = label;
  again.addEventListener("click", onAgain);
  box.appendChild(again);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 无尽:连胜积分赛
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let points = 0;
  /** 这是第几次从头连胜:连胜断了重来就换一批牌,免得每次都在背同样那几副 */
  let sitting = 0;
  let table: { destroy: () => void } | null = null;

  function startRound(): void {
    table?.destroy();
    shell.stage.innerHTML = "";
    const cfg = buildEndlessRound(streak + 1);
    const seats = soloSeats(cfg.players, cfg.tiers);
    shell.chip.textContent = `♾️ 连胜 ${streak} · 最好 ${best} · 累计 ${points} 分`;
    table = createTable(shell.stage, {
      cfg,
      deck: dealRoundDeck(cfg, sitting),
      seats,
      banner: `♾️ ${cfg.hint}<br>赢一局就把别人手上剩的牌折成分收走`,
      sfx: (n) => api.play(n),
      onDone: (r) => {
        if (r.winner === 0) {
          streak++;
          points += r.gained;
          best = save.recordEndlessBest(meta.id, streak);
          api.addStars(1);
          startRound();
        } else {
          best = save.recordEndlessBest(meta.id, streak);
          overPanel(
            shell.stage,
            r.winner < 0 ? DRAW_TITLE : "这一局被对手先出完啦",
            `连胜停在 ${streak} 局,最好成绩 ${best} 连胜,一共收了 ${points} 分。${leftoverLine(
              r.state.players[0].hand.length
            )}`,
            "🔁 从第 1 局再来",
            () => {
              api.play("tap");
              streak = 0;
              points = 0;
              sitting++;
              startRound();
            },
            resultRanksHTML(seats, r)
          );
        }
      },
    });
  }

  startRound();
  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:2–4 人,缺人 AI 补
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let players = 3;
  let tier: AiTier = "normal";
  let round = 1;
  const totals = [0, 0, 0, 0];
  let table: { destroy: () => void } | null = null;

  function pickPanel(): void {
    table?.destroy();
    table = null;
    shell.stage.innerHTML = "";
    shell.chip.textContent = "⚔️ 对战 · 挑人数和对手强度";
    const box = document.createElement("div");
    box.className = "hh-over";
    box.innerHTML = `<div class="hh-over-t">⚔️ 摆一桌</div>
      <div class="hh-over-s">几个人一桌?缺的位置由小牌灵补上。</div>`;
    const row1 = document.createElement("div");
    row1.className = "hh-btns";
    for (const n of [2, 3, 4]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `hh-btn${players === n ? " hh-btn-go" : ""}`;
      b.textContent = `${n} 人`;
      b.addEventListener("click", () => {
        api.play("tap");
        players = n;
        pickPanel();
      });
      row1.appendChild(b);
    }
    const row2 = document.createElement("div");
    row2.className = "hh-btns";
    for (const t of ["rookie", "normal", "expert", "hell"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `hh-btn${tier === t ? " hh-btn-go" : ""}`;
      b.textContent = TIER_NAMES[t];
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      row2.appendChild(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "hh-open hh-open-vs";
    go.textContent = "开打 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    box.append(row1, row2, go);
    shell.stage.appendChild(box);
  }

  function startRound(): void {
    table?.destroy();
    shell.stage.innerHTML = "";
    const cfg = buildVersusRound(round, players, tier);
    const seats = soloSeats(cfg.players, cfg.tiers);
    shell.chip.textContent = `⚔️ 第 ${round} 局 · 你 ${totals[0]} 分`;
    table = createTable(shell.stage, {
      cfg,
      deck: dealRoundDeck(cfg),
      seats,
      startTurn: (round - 1) % cfg.players,
      banner: `⚔️ ${cfg.players} 人桌 · 对手是「${TIER_NAMES[tier]}」档<br>先出完手牌的人赢下这一局`,
      sfx: (n) => api.play(n),
      onDone: (r) => {
        // 牌用完判平局时没有赢家(winner < 0):谁的分都不涨,也不给星
        if (r.winner >= 0) totals[r.winner] += r.gained;
        if (r.winner === 0) api.addStars(1);
        overPanel(
          shell.stage,
          versusTitle(r.winner),
          `这一局收了 ${r.gained} 分。你的总分 ${totals[0]} 分。${
            r.winner === 0 ? "" : leftoverLine(r.state.players[0].hand.length)
          }`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          },
          resultRanksHTML(seats, r)
        );
      },
    });
  }

  pickPanel();
  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:朵朵 + 星星
// ---------------------------------------------------------------------------

function mountTwoPlayer(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let round = 1;
  const wins = [0, 0];
  /** 牌用完判平局的局数:单独记一格,不算谁赢 */
  let draws = 0;
  let table: { destroy: () => void } | null = null;

  function startRound(): void {
    table?.destroy();
    shell.stage.innerHTML = "";
    const cfg = buildVersusRound(round + 100, 2, "normal");
    const seats = duoSeats();
    shell.chip.textContent = `👫 第 ${round} 局 · ${duoScoreLine(wins, draws)}`;
    table = createTable(shell.stage, {
      cfg,
      deck: dealRoundDeck(cfg),
      seats,
      startTurn: (round - 1) % 2,
      banner: "👫 朵朵和星星各拿一手牌,轮到谁就先把另一位的牌盖起来<br>朵朵 A/D + F/G · 星星 ←/→ + L/K",
      sfx: (n) => api.play(n),
      onDone: (r) => {
        // 牌用完判平局:两边的胜场都不涨,和 tap-tiles 打平那一路是同一个口径
        if (r.winner >= 0) wins[r.winner]++;
        else draws++;
        api.addStars(1);
        overPanel(
          shell.stage,
          r.winner < 0 ? DRAW_TITLE : r.winner === 0 ? "🏆 朵朵先出完啦!" : "🏆 星星先出完啦!",
          `这一局收了 ${r.gained} 分。总比分:${duoScoreLine(wins, draws)}。`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          },
          resultRanksHTML(seats, r)
        );
      },
    });
  }

  startRound();
  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
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
  bar.className = "hh-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "hh-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "hh-open hh-open-vs";
  vsBtn.textContent = "⚔️ 对战 2–4 人";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "hh-open hh-open-duo";
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

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
  duoBtn.addEventListener("click", () => openMode(mountTwoPlayer));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关内把模式入口收起来:手机上这一条要占约 96px,牌桌能整个抬进首屏
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
      mapHint: "颜色或数字对上就能出;剩最后一张记得按右下角的「就一张」。",
      grandMessage: "188 关全部接完,你就是牌桌上的接龙小能手!",
      guide: guideBook,
      guideTitle: "花色接龙 · 出牌手记",
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
