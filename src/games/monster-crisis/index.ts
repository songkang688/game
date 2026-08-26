import { meta } from "./meta";
export { meta };

// 小怪物危机 —— 守家 + 波次生存。
//
// 一群圆滚滚的小怪物从右边一波波溜达过来,想把家里的颜料罐搬走。
// 你一边摆棉花墙、架泡泡炮、埋爆米花桶,一边亲自操作主角甩颜料弹;
// 波次之间还能升三条科技线。被颜料糊到的小怪物只会「噗」地冒一团烟,
// 然后变成小花、棉花糖、彩色气球弹回家去 —— 全程没有一点伤害描写。
//
// 四种玩法:188 关八大章节战役、无尽波次、双人合作守家、
// 以及一人守家一人指挥出兵的非对称对战。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import {
  BUILD_COLS,
  CHEW_REACH,
  FROST_SECONDS,
  HERO_BULLET_SPEED,
  HERO_MAX_X,
  HERO_MIN_X,
  HOME_X,
  INTERMISSION_PAINT_BOOST,
  INTERMISSION_SECONDS,
  LANES,
  MONSTER_COLOR,
  MONSTER_EMOJI,
  MONSTER_INFO,
  type MonsterKind,
  POP_EMOJI,
  type ProjectileKind,
  SCENE_H,
  SCENE_W,
  SPAWN_X,
  type TechLine,
  type TechState,
  TECH_INFO,
  TECH_LINES,
  TECH_MAX,
  TOWER_EMOJI,
  TOWER_INFO,
  type TowerKind,
  type WaveDef,
  applyHit,
  blastDamage,
  campaignStars,
  canCommand,
  canHit,
  chewDamage,
  chewInterval,
  clamp,
  clampPaint,
  colX,
  commanderCost,
  commanderDeck,
  commanderRegen,
  COMMANDER_ENERGY_CAP,
  coopLine,
  emptyTech,
  endlessLine,
  fieldSize,
  formatClock,
  heroDamage,
  heroReload,
  heroSpeed,
  jarInterval,
  loseLine,
  monsterArmor,
  monsterHp,
  monsterSpeed,
  paintCap,
  paintInterval,
  techCost,
  towerDamage,
  towerRefund,
  towersUnlockedAt,
  versusLine,
  versusWinner,
  willJump,
  winLine,
} from "./logic";
import {
  COOP_TARGET_WAVES,
  CHAPTERS,
  LEVELS,
  type LevelDef,
  VERSUS_SECONDS,
  buildCoopWave,
  buildEndlessWave,
  endlessLevelIndex,
} from "./levels";

/* ------------------------------------------------------------------ */
/* 画布尺寸与配色                                                       */
/* ------------------------------------------------------------------ */

const PAD_L = 56;
const CELL_W = 68;
const FIELD_TOP = 36;
const LANE_H = 80;

const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_NAME = ["朵朵", "星星"];

function px(gx: number): number {
  return PAD_L + gx * CELL_W;
}

function py(lane: number): number {
  return FIELD_TOP + lane * LANE_H + LANE_H / 2;
}

/** 章节配色:地面 / 天空,让八个章节一眼看出区别。 */
const SCENE_SKY = ["#fff4f8", "#fff6ec", "#f4fbea", "#eef7ff", "#f1eeff", "#fff0fa", "#eef6f6", "#f8f0ff"];
const SCENE_GROUND = ["#dff2d8", "#ffe6c9", "#e3f0cd", "#dcecfa", "#ddd8f2", "#ffd9f0", "#dceaea", "#eddcff"];

const CSS = `
.mc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:7px;position:relative;}
.mc-hud{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;}
.mc-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:900;color:#63528c;
  box-shadow:0 2px 6px rgba(150,140,180,.24);white-space:nowrap;}
.mc-chip-warn{background:#ffe9f1;color:#b8386e;}
.mc-shop{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.mc-item{border:none;border-radius:13px;padding:6px 9px;font-size:12px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#5b4a7a;box-shadow:0 3px 0 rgba(140,120,190,.32);
  display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;line-height:1.25;}
.mc-item:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.32);}
.mc-item[aria-pressed="true"]{background:#ffdcea;color:#a8305f;outline:3px solid #ff9dc2;}
.mc-item[disabled]{opacity:.45;cursor:default;}
.mc-item-cost{font-size:11px;font-weight:800;color:#8a7ba8;}
.mc-field{display:flex;justify-content:center;}
.mc-canvas{display:block;max-width:100%;border-radius:16px;background:#fff6fb;touch-action:none;cursor:pointer;
  box-shadow:0 3px 10px rgba(160,140,200,.22);}
.mc-pads{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:flex-start;}
.mc-pad{display:grid;grid-template-columns:repeat(3,auto);gap:4px;justify-items:center;align-items:center;}
.mc-pad-t{grid-column:1 / -1;font-size:12px;font-weight:900;}
.mc-btn{border:none;border-radius:12px;min-width:44px;min-height:42px;padding:3px 7px;font-size:16px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.mc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.mc-btn-fire{background:#ffdbe8;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.4);}
.mc-btn-build{background:#dcf1e2;color:#2f7a56;box-shadow:0 3px 0 rgba(90,160,120,.4);}
.mc-btn:focus-visible,.mc-item:focus-visible,.mc-open:focus-visible,.mc-back:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:3px;}
.mc-tip{text-align:center;font-size:12px;font-weight:700;color:#6f6390;line-height:1.55;}
.mc-layer{position:absolute;inset:0;background:rgba(255,250,253,.95);border-radius:16px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:14px;}
.mc-layer-t{font-size:19px;font-weight:900;color:#6a4fa8;}
.mc-layer-s{font-size:13px;font-weight:700;color:#6f6390;line-height:1.6;max-width:340px;}
.mc-tech{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.mc-techbtn{border:none;border-radius:14px;padding:8px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#fff;color:#5b4a7a;box-shadow:0 3px 0 rgba(140,120,190,.32);
  display:flex;flex-direction:column;align-items:center;gap:2px;min-width:94px;}
.mc-techbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.32);}
.mc-techbtn[disabled]{opacity:.5;cursor:default;}
.mc-techbar{font-size:11px;letter-spacing:2px;color:#ffb937;}
.mc-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.mc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.mc-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.mc-open-vs:active{box-shadow:0 2px 0 #b04a6c;}
.mc-open-co{background:linear-gradient(180deg,#68c2a0,#48a683);box-shadow:0 4px 0 #35805f;}
.mc-open-co:active{box-shadow:0 2px 0 #35805f;}
.mc-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.mc-bar[hidden]{display:none;}
.mc-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.mc-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.mc-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.mc-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.mc-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
/* 手机竖屏一屏要塞下四层,每层都得收着点,不然方向盘会被顶出舞台 */
@media (max-width:420px){
  .mc-item{min-width:44px;font-size:11px;padding:3px 6px;}
  .mc-item-cost{font-size:10px;}
  .mc-chip{font-size:11px;padding:3px 8px;}
  .mc-hud{gap:4px;}
  .mc-shop{gap:5px;}
  .mc-btn{min-width:40px;min-height:36px;font-size:15px;padding:2px 6px;}
  .mc-hud .mc-btn{min-height:28px;min-width:34px;font-size:13px;}
  .mc-pads{gap:6px;}
  .mc-pad{gap:3px;}
  .mc-pad-t{font-size:10px;}
  .mc-open{font-size:13px;padding:7px 12px;}
  .mc-bar{gap:6px;margin-bottom:4px;}
  .mc-wrap{gap:3px;}
  .mc-tip{font-size:10px;line-height:1.35;}
}
@media (prefers-reduced-motion:reduce){.mc-btn:active,.mc-item:active{transform:none;}}
`;

/* ------------------------------------------------------------------ */
/* 运行时状态                                                          */
/* ------------------------------------------------------------------ */

interface Monster {
  kind: MonsterKind;
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  armor: number;
  base: number;
  frost: number;
  chewCd: number;
  jumped: boolean;
  flying: boolean;
  boss: boolean;
  /** 走路时上下晃一点,看着更有精神 */
  phase: number;
  /** 刚被糊到时抖一下 */
  flash: number;
}

interface Tower {
  kind: TowerKind;
  col: number;
  lane: number;
  hp: number;
  maxHp: number;
  cd: number;
  prod: number;
  born: number;
}

interface Shot {
  x: number;
  lane: number;
  dmg: number;
  proj: ProjectileKind;
  slows: boolean;
  speed: number;
}

interface Puff {
  x: number;
  y: number;
  age: number;
  emoji: string;
}

interface Hero {
  lane: number;
  x: number;
  cd: number;
  /** 甩颜料弹之后手臂前伸的动画计时 */
  swing: number;
}

type Plan =
  | { kind: "fixed"; waves: WaveDef[] }
  | { kind: "endless"; make: (wave: number) => WaveDef }
  | { kind: "versus"; seconds: number };

export interface RunResult {
  win: boolean;
  hearts: number;
  homeHp: number;
  /** 完整清掉的波数 */
  wavesCleared: number;
  waveTotal: number;
  popped: number;
  leaks: number[];
  elapsed: number;
  quit: boolean;
}

interface FieldOptions {
  def: LevelDef;
  levelIdx: number;
  levelIdxFor?: (waveIdx: number) => number;
  plan: Plan;
  /** 有几个人在操作主角(合作是 2) */
  heroes: 1 | 2;
  /** 第二个人当指挥官(非对称对战) */
  commander?: boolean;
  title: string;
  hint: string;
  sfx: (n: SoundName) => void;
  onDone: (res: RunResult) => void;
}

/** 漏怪最多的那条道(结算文案要点名),没漏过返回 -1。 */
export function weakestLane(leaks: readonly number[]): number {
  let best = -1;
  let most = 0;
  for (let i = 0; i < leaks.length; i++) {
    if (leaks[i] > most) {
      most = leaks[i];
      best = i;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 画笔:全部程序化绘制,一张外部图片都不用                              */
/* ------------------------------------------------------------------ */

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** 两只圆眼睛 + 一张笑嘴:所有小怪物都长着这副表情,凶不起来。 */
function drawFace(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, blink: boolean): void {
  const ex = r * 0.34;
  const ey = -r * 0.12;
  c.fillStyle = "#fff";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * ex, cy + ey, r * 0.24, blink ? r * 0.06 : r * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (!blink) {
    c.fillStyle = "#3d3350";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * ex, cy + ey + r * 0.04, r * 0.12, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.strokeStyle = "#3d3350";
  c.lineWidth = Math.max(1.4, r * 0.09);
  c.lineCap = "round";
  c.beginPath();
  c.arc(cx, cy + r * 0.28, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
}

function drawMonster(c: CanvasRenderingContext2D, m: Monster, t: number): void {
  const spec = MONSTER_INFO[m.kind];
  const size = spec.boss ? 40 : 24;
  const bob = Math.sin(t * 4 + m.phase) * (m.flying ? 5 : 2.2);
  const x = px(m.x);
  const y = py(m.lane) + bob - (m.flying ? 16 : 0);
  const fill = MONSTER_COLOR[m.kind];

  // 飞在天上的拖一根小尾巴,一眼看出地面炮台够不着
  if (m.flying) {
    c.strokeStyle = "rgba(120,110,160,.4)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, y + size * 0.7);
    c.lineTo(x + 3, y + size * 1.5);
    c.stroke();
  }

  c.save();
  if (m.flash > 0) c.globalAlpha = 0.65 + 0.35 * Math.cos(m.flash * 40);
  c.lineWidth = 3;
  c.lineJoin = "round";
  c.strokeStyle = shade(fill, 0.62);
  c.fillStyle = fill;

  if (m.kind === "box") {
    roundRect(c, x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2, 5);
  } else if (m.kind === "spinner") {
    c.beginPath();
    c.moveTo(x, y - size * 0.7);
    c.lineTo(x + size * 0.62, y + size * 0.5);
    c.lineTo(x - size * 0.62, y + size * 0.5);
    c.closePath();
  } else if (m.kind === "cotton" || m.kind === "bossCotton" || m.kind === "bossCloud") {
    c.beginPath();
    c.arc(x - size * 0.35, y + size * 0.1, size * 0.42, 0, Math.PI * 2);
    c.arc(x + size * 0.35, y + size * 0.1, size * 0.4, 0, Math.PI * 2);
    c.arc(x, y - size * 0.2, size * 0.55, 0, Math.PI * 2);
  } else {
    roundRect(c, x - size * 0.58, y - size * 0.58, size * 1.16, size * 1.16, size * 0.42);
  }
  c.fill();
  c.stroke();

  // 外壳:南瓜盖、纸箱盖、跳跳怪的小头盔
  if (m.armor > 0) {
    c.fillStyle = "rgba(255,255,255,.55)";
    c.strokeStyle = shade(fill, 0.45);
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(x, y - size * 0.18, size * 0.62, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
  }

  const blink = Math.sin(t * 1.7 + m.phase * 2) > 0.965;
  drawFace(c, x, y, size * 0.6, blink);

  if (spec.boss) {
    c.fillStyle = "#ffcf4d";
    c.strokeStyle = "#d99f18";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - size * 0.5, y - size * 0.62);
    c.lineTo(x - size * 0.28, y - size * 0.98);
    c.lineTo(x, y - size * 0.66);
    c.lineTo(x + size * 0.28, y - size * 0.98);
    c.lineTo(x + size * 0.5, y - size * 0.62);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();

  // 上色进度条:糊到过才显示,没挨过颜料的小怪物头顶干干净净
  if (m.hp < m.maxHp || m.armor > 0) {
    const w = size * 1.2;
    const bx = x - w / 2;
    const by = y - size * (spec.boss ? 1.2 : 0.95);
    c.fillStyle = "rgba(255,255,255,.85)";
    roundRect(c, bx, by, w, 5, 2.5);
    c.fill();
    c.fillStyle = m.armor > 0 ? "#9aa6c4" : "#7fd6a3";
    const ratio = m.armor > 0 ? 1 : Math.max(0, m.hp / m.maxHp);
    roundRect(c, bx, by, w * ratio, 5, 2.5);
    c.fill();
  }
}

function drawTower(c: CanvasRenderingContext2D, tw: Tower, t: number): void {
  const x = px(colX(tw.col));
  const y = py(tw.lane);
  const grow = Math.min(1, (t - tw.born) * 4);
  const s = 26 * (0.6 + 0.4 * grow);
  c.save();
  c.lineWidth = 3;
  c.lineJoin = "round";

  if (tw.kind === "wall") {
    // 一摞缝好的软垫子:故意和三团圆球的棉花怪长得不一样,一眼能分清敌我
    c.fillStyle = "#fffdf7";
    c.strokeStyle = "#c9a7c4";
    roundRect(c, x - s * 0.42, y - s * 0.62, s * 0.84, s * 1.24, 7);
    c.fill();
    c.stroke();
    c.strokeStyle = "#e6cfe0";
    c.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      const ly = y - s * 0.62 + (s * 1.24 * i) / 3;
      c.beginPath();
      c.moveTo(x - s * 0.42, ly);
      c.lineTo(x + s * 0.42, ly);
      c.stroke();
    }
  } else if (tw.kind === "jar") {
    c.fillStyle = "#ffe6a8";
    c.strokeStyle = "#d9a94f";
    roundRect(c, x - s * 0.45, y - s * 0.4, s * 0.9, s * 0.85, 6);
    c.fill();
    c.stroke();
    c.fillStyle = "#ff8fc0";
    c.beginPath();
    c.arc(x, y - s * 0.5, s * 0.26, 0, Math.PI * 2);
    c.fill();
  } else if (tw.kind === "pop") {
    c.fillStyle = "#bfe6ff";
    c.strokeStyle = "#5d9bc4";
    c.beginPath();
    c.arc(x, y, s * 0.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#7fc3e8";
    roundRect(c, x + s * 0.3, y - s * 0.16, s * 0.45, s * 0.32, 4);
    c.fill();
  } else if (tw.kind === "boom") {
    c.fillStyle = "#fff1f1";
    c.strokeStyle = "#e08b8b";
    roundRect(c, x - s * 0.42, y - s * 0.3, s * 0.84, s * 0.8, 4);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff8d8";
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(x - s * 0.28 + i * s * 0.19, y - s * 0.42 + (i % 2) * s * 0.12, s * 0.16, 0, Math.PI * 2);
      c.fill();
    }
  } else if (tw.kind === "frost") {
    c.fillStyle = "#dff4ff";
    c.strokeStyle = "#6fb6d8";
    roundRect(c, x - s * 0.44, y - s * 0.44, s * 0.88, s * 0.88, 7);
    c.fill();
    c.stroke();
    c.strokeStyle = "#9fd9ef";
    c.lineWidth = 2.4;
    for (const a of [0, 1, 2]) {
      const ang = (a / 3) * Math.PI;
      c.beginPath();
      c.moveTo(x - Math.cos(ang) * s * 0.3, y - Math.sin(ang) * s * 0.3);
      c.lineTo(x + Math.cos(ang) * s * 0.3, y + Math.sin(ang) * s * 0.3);
      c.stroke();
    }
  } else {
    c.fillStyle = "#f3e6ff";
    c.strokeStyle = "#a887d6";
    roundRect(c, x - s * 0.3, y - s * 0.15, s * 0.6, s * 0.75, 5);
    c.fill();
    c.stroke();
    const bands = ["#ff9ec4", "#ffd08a", "#9be0a8", "#a9d6ff"];
    c.lineWidth = 3;
    bands.forEach((col, i) => {
      c.strokeStyle = col;
      c.beginPath();
      c.arc(x, y - s * 0.15, s * 0.28 + i * 5, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    });
  }

  // 被啃了才显示耐久条
  if (tw.hp < tw.maxHp) {
    const w = s * 1.1;
    c.fillStyle = "rgba(255,255,255,.85)";
    roundRect(c, x - w / 2, y + s * 0.62, w, 4, 2);
    c.fill();
    c.fillStyle = "#ffb2cf";
    roundRect(c, x - w / 2, y + s * 0.62, (w * tw.hp) / tw.maxHp, 4, 2);
    c.fill();
  }
  c.restore();
}

function drawHero(c: CanvasRenderingContext2D, h: Hero, idx: number, t: number): void {
  const x = px(h.x);
  const y = py(h.lane) + Math.sin(t * 5 + idx) * 1.8;
  const col = P_COLOR[idx];
  c.save();
  c.lineWidth = 3;
  c.strokeStyle = shade(col, 0.7);
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, 15, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // 举着的刷子:甩出去的一瞬间往前伸
  const reach = 16 + h.swing * 40;
  c.strokeStyle = "#8a6a4a";
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x + 6, y);
  c.lineTo(x + reach, y - 4);
  c.stroke();
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(x + reach + 2, y - 5, 4.5, 0, Math.PI * 2);
  c.fill();
  drawFace(c, x, y - 1, 11, false);
  c.restore();
}

function drawShot(c: CanvasRenderingContext2D, s: Shot): void {
  const color =
    s.proj === "paint" ? "#ff7fb4" : s.proj === "ice" ? "#a9e4ff" : s.proj === "beam" ? "#c79bff" : "#bfe6ff";
  c.fillStyle = color;
  c.strokeStyle = shade(color, 0.7);
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(px(s.x), py(s.lane) - 2, s.proj === "beam" ? 7 : 5.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

function drawPuff(c: CanvasRenderingContext2D, p: Puff): void {
  const k = Math.min(1, p.age / 0.7);
  c.save();
  c.globalAlpha = 1 - k;
  c.strokeStyle = "#cfc7e6";
  c.lineWidth = 4 * (1 - k) + 1;
  c.beginPath();
  c.arc(p.x, p.y, 10 + k * 26, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = 1 - k * 0.7;
  c.font = "22px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(p.emoji, p.x, p.y - k * 22);
  c.restore();
}

function drawHome(c: CanvasRenderingContext2D, hearts: number, homeHp: number, shake: number): void {
  const x = px(HOME_X);
  c.save();
  c.translate(Math.sin(shake * 40) * shake * 6, 0);
  c.fillStyle = "#ffe9f3";
  c.fillRect(0, FIELD_TOP, x, LANE_H * LANES);
  c.strokeStyle = "#e6a9c6";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, FIELD_TOP);
  c.lineTo(x, FIELD_TOP + LANE_H * LANES);
  c.stroke();
  // 家门口摆着的颜料罐,少一罐就是被搬走一罐;沿着整块家门竖着排开
  for (let i = 0; i < homeHp; i++) {
    const cy = FIELD_TOP + (LANE_H * LANES * (i + 0.5)) / homeHp;
    const on = i < hearts;
    c.fillStyle = on ? "#ff9ec4" : "#e7e1ee";
    c.strokeStyle = on ? "#d9628a" : "#cfc7dd";
    c.lineWidth = 2.5;
    roundRect(c, x - 40, cy - 13, 28, 26, 6);
    c.fill();
    c.stroke();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 战场:实时引擎 + 渲染 + 输入                                          */
/* ------------------------------------------------------------------ */

function createField(host: HTMLElement, opts: FieldOptions): { destroy: () => void } {
  const { def } = opts;
  const doc = host.ownerDocument ?? document;
  const versus = opts.plan.kind === "versus";
  const idxFor = opts.levelIdxFor ?? (() => opts.levelIdx);
  const unlocked = towersUnlockedAt(def.chapter);
  const blocked = new Set(def.blocked.map((b) => `${b.col},${b.lane}`));
  const sky = SCENE_SKY[def.chapter % SCENE_SKY.length];
  const ground = SCENE_GROUND[def.chapter % SCENE_GROUND.length];

  const wrap = doc.createElement("div");
  wrap.className = "mc-wrap";

  const hud = doc.createElement("div");
  hud.className = "mc-hud";
  const paintChip = doc.createElement("span");
  paintChip.className = "mc-chip";
  const waveChip = doc.createElement("span");
  waveChip.className = "mc-chip";
  const homeChip = doc.createElement("span");
  homeChip.className = "mc-chip";
  const techBtn = doc.createElement("button");
  techBtn.type = "button";
  techBtn.className = "mc-btn";
  techBtn.textContent = "🔧";
  techBtn.setAttribute("aria-label", "打开科技面板");
  const pauseBtn = doc.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "mc-btn";
  pauseBtn.textContent = "⏸";
  pauseBtn.setAttribute("aria-label", "暂停");
  hud.append(paintChip, homeChip, waveChip, techBtn, pauseBtn);

  const shop = doc.createElement("div");
  shop.className = "mc-shop";

  const canvas = doc.createElement("canvas");
  canvas.className = "mc-canvas";
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:五条小路上的守家战场`);

  const field = doc.createElement("div");
  field.className = "mc-field";
  field.appendChild(canvas);

  const pads = doc.createElement("div");
  pads.className = "mc-pads";
  const tip = doc.createElement("div");
  tip.className = "mc-tip";
  tip.textContent = opts.hint;

  wrap.append(hud, shop, field, pads, tip);
  host.appendChild(wrap);

  // 画面缩得越小,画布上那两行字要写得越大,不然手机上糊成一片看不清
  let textScale = 1;

  // 战场按可用宽度和屏幕高度一起缩:手机上宁可画面小一点,也要把方向盘留在屏内
  function layout(): void {
    const view = doc.defaultView ?? window;
    const size = fieldSize(field.clientWidth || wrap.clientWidth, view.innerWidth, view.innerHeight);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    textScale = clamp(SCENE_W / size.w, 1, 2.4);
  }

  const c2d = canvas.getContext("2d");

  /* ---------------- 状态 ---------------- */

  const monsters: Monster[] = [];
  const towers = new Map<string, Tower>();
  const shots: Shot[] = [];
  const puffs: Puff[] = [];
  const tech: TechState = emptyTech();
  const leaks = new Array<number>(LANES).fill(0);
  const heroes: Hero[] = [];
  for (let i = 0; i < opts.heroes; i++) {
    heroes.push({ lane: i === 0 ? 1 : 3, x: 1.2, cd: 0, swing: 0 });
  }

  let paint = def.startPaint;
  let hearts = def.homeHp;
  let popped = 0;
  let elapsed = 0;
  let passive = paintInterval(0);
  let shake = 0;
  // 一开始什么都没选:点画面就是让主角跑过去甩一发,想摆东西再去点上面的建筑按钮
  let selected: TowerKind | null = null;

  let waveIdx = 0;
  let wavesCleared = 0;
  let phase: "prep" | "wave" = "prep";
  let phaseTime = INTERMISSION_SECONDS;
  let waveTime = 0;
  let spawnIdx = 0;
  let currentWave: WaveDef | null = null;
  let versusLeft = opts.plan.kind === "versus" ? opts.plan.seconds : 0;

  // 非对称对战:指挥官的能量、选中的兵与车道
  let energy = 8;
  let cmdLane = 2;
  let cmdPick = 0;

  let paused = false;
  let finished = false;
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let layer: HTMLElement | null = null;
  let lastPopSound = -1;
  let flashMsg = "";
  let flashLeft = 0;

  const waveTotal = opts.plan.kind === "fixed" ? opts.plan.waves.length : 0;

  function key(col: number, lane: number): string {
    return `${col},${lane}`;
  }

  function sfx(name: SoundName): void {
    if (!destroyed) opts.sfx(name);
  }

  /** 同一瞬间糊掉一堆小怪物时只响一次,免得吵。 */
  function popSound(): void {
    if (elapsed - lastPopSound < 0.12) return;
    lastPopSound = elapsed;
    sfx("pop");
  }

  function say(msg: string): void {
    flashMsg = msg;
    flashLeft = 2.4;
  }

  function gain(n: number): void {
    paint = clampPaint(paint + n, paintCap(tech.paint));
  }

  function nextWave(n: number): WaveDef {
    if (opts.plan.kind === "fixed") return opts.plan.waves[Math.min(n - 1, opts.plan.waves.length - 1)];
    if (opts.plan.kind === "endless") return opts.plan.make(n);
    return { spawns: [], tail: 0 };
  }

  function spawn(kind: MonsterKind, lane: number, levelIdx: number): void {
    const spec = MONSTER_INFO[kind];
    const hp = monsterHp(kind, levelIdx);
    monsters.push({
      kind,
      x: SPAWN_X,
      lane,
      hp,
      maxHp: hp,
      armor: monsterArmor(kind, levelIdx),
      base: spec.speed,
      frost: 0,
      chewCd: chewInterval(!!spec.boss),
      jumped: false,
      flying: !!spec.flying,
      boss: !!spec.boss,
      phase: Math.random() * 6.283,
      flash: 0,
    });
    if (spec.boss) {
      sfx("meow");
      say(`${spec.name}来啦!把它糊成${spec.becomes}!`);
    }
  }

  /* ---------------- 建造 ---------------- */

  function buildAt(kind: TowerKind, col: number, lane: number): boolean {
    if (finished || paused) return false;
    if (col < 0 || col >= BUILD_COLS || lane < 0 || lane >= LANES) return false;
    const k = key(col, lane);
    if (blocked.has(k)) {
      say("这里有花坛,换个格子摆吧。");
      return false;
    }
    const there = towers.get(k);
    if (there) {
      // 点自己已经摆好的建筑 = 收起来,退一半颜料
      towers.delete(k);
      gain(towerRefund(there.kind));
      sfx("tap");
      say(`收起${TOWER_INFO[there.kind].name},退回 ${towerRefund(there.kind)} 罐颜料。`);
      return true;
    }
    const cost = TOWER_INFO[kind].cost;
    if (paint < cost) {
      say(`颜料还差一点,${TOWER_INFO[kind].name}要 ${cost} 罐。`);
      sfx("oops");
      return false;
    }
    paint -= cost;
    towers.set(k, {
      kind,
      col,
      lane,
      hp: TOWER_INFO[kind].hp,
      maxHp: TOWER_INFO[kind].hp,
      cd: 0.4,
      prod: jarInterval(tech.paint),
      born: elapsed,
    });
    sfx("tap");
    return true;
  }

  function buyTech(line: TechLine): void {
    if (tech[line] >= TECH_MAX) return;
    const cost = techCost(line, tech[line]);
    if (paint < cost) {
      sfx("oops");
      say(`${TECH_INFO[line].name}要 ${cost} 罐颜料,再攒攒。`);
      return;
    }
    paint -= cost;
    tech[line]++;
    sfx("coin");
    say(`${TECH_INFO[line].emoji} ${TECH_INFO[line].name}升到 ${tech[line]} 级!`);
    renderTech();
  }

  /* ---------------- 商店按钮 ---------------- */

  const shopButtons: Array<{ kind: TowerKind; btn: HTMLButtonElement }> = [];
  for (const kind of unlocked) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "mc-item";
    btn.innerHTML = `<span>${TOWER_EMOJI[kind]} ${TOWER_INFO[kind].name}</span>
      <span class="mc-item-cost">🎨${TOWER_INFO[kind].cost}</span>`;
    btn.title = TOWER_INFO[kind].desc;
    btn.setAttribute("aria-label", `选 ${TOWER_INFO[kind].name},要 ${TOWER_INFO[kind].cost} 罐颜料。${TOWER_INFO[kind].desc}`);
    btn.addEventListener("click", () => {
      sfx("tap");
      selected = selected === kind ? null : kind;
      refreshShop();
    });
    shop.appendChild(btn);
    shopButtons.push({ kind, btn });
  }

  function refreshShop(): void {
    for (const { kind, btn } of shopButtons) {
      btn.setAttribute("aria-pressed", selected === kind ? "true" : "false");
      btn.disabled = paint < TOWER_INFO[kind].cost && selected !== kind;
    }
  }

  /* ---------------- 覆盖层:科技 / 暂停 / 结算 ---------------- */

  function closeLayer(): void {
    layer?.remove();
    layer = null;
  }

  function openLayer(): HTMLElement {
    closeLayer();
    const el = doc.createElement("div");
    el.className = "mc-layer";
    wrap.appendChild(el);
    layer = el;
    return el;
  }

  let techOpen = false;

  function renderTech(): void {
    if (!techOpen || !layer) return;
    const box = layer.querySelector(".mc-tech");
    if (!(box instanceof HTMLElement)) return;
    box.innerHTML = "";
    for (const line of TECH_LINES) {
      const lv = tech[line];
      const cost = techCost(line, lv);
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "mc-techbtn";
      const bar = "★".repeat(lv) + "☆".repeat(TECH_MAX - lv);
      btn.innerHTML = `<span>${TECH_INFO[line].emoji} ${TECH_INFO[line].name}</span>
        <span class="mc-techbar">${bar}</span>
        <span class="mc-item-cost">${lv >= TECH_MAX ? "已满级" : `升级 🎨${cost}`}</span>`;
      btn.title = TECH_INFO[line].desc;
      btn.disabled = lv >= TECH_MAX || paint < cost;
      btn.addEventListener("click", () => buyTech(line));
      box.appendChild(btn);
    }
    const info = layer.querySelector(".mc-layer-s");
    if (info instanceof HTMLElement) {
      info.textContent = `手里有 ${paint} 罐颜料。颜料线攒得更快,炮台线打得更浓,主角线跑得更快甩得更狠。`;
    }
  }

  function openTech(): void {
    if (finished) return;
    techOpen = true;
    paused = true;
    const el = openLayer();
    el.innerHTML = `<div class="mc-layer-t">🔧 波次之间,整理一下</div>
      <div class="mc-layer-s"></div><div class="mc-tech"></div>`;
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "mc-open";
    close.textContent = "准备好啦 ▶";
    close.addEventListener("click", () => {
      sfx("tap");
      techOpen = false;
      paused = false;
      closeLayer();
      // 手动关掉科技面板 = 提前开打,备战时间直接跳过
      if (phase === "prep") phaseTime = Math.min(phaseTime, 0.4);
    });
    el.appendChild(close);
    renderTech();
    close.focus();
  }

  function openPause(): void {
    if (finished) return;
    paused = true;
    techOpen = false;
    const el = openLayer();
    el.innerHTML = `<div class="mc-layer-t">⏸ 先歇一会儿</div>
      <div class="mc-layer-s">小怪物们在原地等你,喝口水再继续。</div>`;
    const go = doc.createElement("button");
    go.type = "button";
    go.className = "mc-open";
    go.textContent = "继续守家 ▶";
    go.addEventListener("click", () => {
      sfx("tap");
      paused = false;
      closeLayer();
    });
    el.appendChild(go);
    go.focus();
  }

  function togglePause(): void {
    if (finished) return;
    if (paused) {
      paused = false;
      techOpen = false;
      closeLayer();
    } else {
      openPause();
    }
  }

  function finish(win: boolean, quit = false): void {
    if (finished) return;
    finished = true;
    paused = true;
    closeLayer();
    opts.onDone({
      win,
      hearts: Math.max(0, hearts),
      homeHp: def.homeHp,
      wavesCleared,
      waveTotal,
      popped,
      leaks: leaks.slice(),
      elapsed,
      quit,
    });
  }

  /* ---------------- 输入 ---------------- */

  const held: Array<Record<string, boolean>> = [
    { up: false, down: false, left: false, right: false },
    { up: false, down: false, left: false, right: false },
  ];

  const KEYS: Array<Record<string, string>> = [
    { w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];
  const FIRE_KEYS = [new Set(["f", "F"]), new Set(["l", "L"])];
  const BUILD_KEYS = [new Set(["g", "G"]), new Set(["k", "K"])];

  function heroFire(i: number): void {
    const h = heroes[i];
    if (!h || paused || finished) return;
    if (h.cd > 0) return;
    h.cd = heroReload(tech.hero);
    h.swing = 0.16;
    shots.push({
      x: h.x + 0.25,
      lane: h.lane,
      dmg: heroDamage(tech.hero),
      proj: "paint",
      slows: false,
      speed: HERO_BULLET_SPEED,
    });
  }

  /** 在主角脚下这一格摆当前选中的建筑(键盘玩家的建造方式)。 */
  function heroBuild(i: number): void {
    const h = heroes[i];
    if (!h || !selected || paused || finished) return;
    const col = Math.round(h.x) - 1 < 0 ? 0 : Math.min(BUILD_COLS - 1, Math.round(h.x) - 1);
    if (buildAt(selected, col, h.lane)) refreshShop();
  }

  function commanderSend(): void {
    if (paused || finished) return;
    const deck = commanderDeck(elapsed);
    const kind = deck[Math.min(cmdPick, deck.length - 1)];
    if (!canCommand(energy, kind)) {
      sfx("oops");
      return;
    }
    energy -= commanderCost(kind);
    spawn(kind, cmdLane, opts.levelIdx);
    sfx("jump");
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused || finished) return;
    for (let p = 0; p < 2; p++) {
      const dir = KEYS[p][e.key];
      const isHero = p < heroes.length;
      const isCommander = p === 1 && !!opts.commander;
      if (dir && (isHero || isCommander)) {
        held[p][dir] = true;
        if (isCommander && !e.repeat) {
          if (dir === "up") cmdLane = clamp(cmdLane - 1, 0, LANES - 1);
          if (dir === "down") cmdLane = clamp(cmdLane + 1, 0, LANES - 1);
          if (dir === "left" || dir === "right") {
            const deck = commanderDeck(elapsed);
            cmdPick = (cmdPick + (dir === "right" ? 1 : deck.length - 1)) % deck.length;
          }
        }
        e.preventDefault();
        return;
      }
      if (FIRE_KEYS[p].has(e.key)) {
        if (!e.repeat) {
          if (isCommander) commanderSend();
          else if (isHero) heroFire(p);
        }
        e.preventDefault();
        return;
      }
      if (BUILD_KEYS[p].has(e.key)) {
        if (!e.repeat && isHero) heroBuild(p);
        e.preventDefault();
        return;
      }
    }
    // 单人时两套方向键都归朵朵用,谁顺手用谁
    if (heroes.length === 1 && !opts.commander) {
      const dir = KEYS[1][e.key];
      if (dir) {
        held[0][dir] = true;
        e.preventDefault();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    for (let p = 0; p < 2; p++) {
      const dir = KEYS[p][e.key];
      if (!dir) continue;
      held[p][dir] = false;
      if (heroes.length === 1 && p === 1) held[0][dir] = false;
    }
  }

  /**
   * 手机上的「半屏摇杆」:手指按在画面左半边就牵着朵朵走,右半边牵着星星走
   * (只有一个人时整块画面都归朵朵)。手指按住不放会一直甩颜料弹,松手就停。
   */
  const dragging = new Map<number, number>();
  const follow: Array<{ x: number; lane: number } | null> = [null, null];

  function scenePoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SCENE_W,
      y: ((e.clientY - rect.top) / rect.height) * SCENE_H,
    };
  }

  function onPointerDown(e: PointerEvent): void {
    if (paused || finished) return;
    e.preventDefault();
    const p = scenePoint(e);
    const lane = clamp(Math.floor((p.y - FIELD_TOP) / LANE_H), 0, LANES - 1);
    const col = Math.round((p.x - PAD_L) / CELL_W) - 1;
    if (selected && col >= 0 && col < BUILD_COLS) {
      if (buildAt(selected, col, lane)) refreshShop();
      return;
    }
    const player = heroes.length > 1 && p.x > SCENE_W / 2 ? 1 : 0;
    const hero = heroes[player];
    if (!hero) return;
    dragging.set(e.pointerId, player);
    follow[player] = { x: clamp(p.x / CELL_W - PAD_L / CELL_W, HERO_MIN_X, HERO_MAX_X), lane };
    canvas.setPointerCapture?.(e.pointerId);
    // 手指一落下就换到那条道:点哪条道就打哪条道,不然点了半天还在原地
    hero.lane = lane;
    heroFire(player);
  }

  function onPointerMove(e: PointerEvent): void {
    const player = dragging.get(e.pointerId);
    if (player === undefined || paused || finished) return;
    e.preventDefault();
    const p = scenePoint(e);
    follow[player] = {
      x: clamp(p.x / CELL_W - PAD_L / CELL_W, HERO_MIN_X, HERO_MAX_X),
      lane: clamp(Math.floor((p.y - FIELD_TOP) / LANE_H), 0, LANES - 1),
    };
  }

  function onPointerUp(e: PointerEvent): void {
    const player = dragging.get(e.pointerId);
    if (player === undefined) return;
    dragging.delete(e.pointerId);
    follow[player] = null;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  const win = doc.defaultView ?? window;
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);

  /* ---------------- 触屏方向盘:左边朵朵,右边星星 ---------------- */

  function buildPad(player: number, commanderPad: boolean): void {
    const pad = doc.createElement("div");
    pad.className = "mc-pad";
    const title = doc.createElement("div");
    title.className = "mc-pad-t";
    title.style.color = P_COLOR[player];
    title.textContent = commanderPad
      ? "星星(指挥) ↑←↓→ / L 出兵"
      : player === 0
        ? "朵朵 W A S D / F 甩 / G 摆"
        : "星星 ↑←↓→ / L 甩 / K 摆";
    pad.appendChild(title);

    const mk = (label: string, aria: string, cls = ""): HTMLButtonElement => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = `mc-btn${cls}`;
      b.textContent = label;
      b.setAttribute("aria-label", `${P_NAME[player]}${aria}`);
      return b;
    };
    const hold = (b: HTMLButtonElement, dir: "up" | "down" | "left" | "right"): void => {
      const on = (ev: Event): void => {
        ev.preventDefault();
        held[player][dir] = true;
        if (commanderPad) {
          if (dir === "up") cmdLane = clamp(cmdLane - 1, 0, LANES - 1);
          if (dir === "down") cmdLane = clamp(cmdLane + 1, 0, LANES - 1);
          if (dir === "left" || dir === "right") {
            const deck = commanderDeck(elapsed);
            cmdPick = (cmdPick + (dir === "right" ? 1 : deck.length - 1)) % deck.length;
          }
        }
      };
      const off = (): void => {
        held[player][dir] = false;
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("pointercancel", off);
    };

    const blank = (): HTMLElement => doc.createElement("span");
    const up = mk("▲", "向上");
    const leftB = mk("◀", "向左");
    const rightB = mk("▶", "向右");
    const down = mk("▼", "向下");
    const fire = mk(commanderPad ? "🚀" : "🎨", commanderPad ? "派一只小怪物" : "甩颜料弹", " mc-btn-fire");
    hold(up, "up");
    hold(leftB, "left");
    hold(rightB, "right");
    hold(down, "down");
    fire.addEventListener("click", () => (commanderPad ? commanderSend() : heroFire(player)));
    // 摆建筑那颗塞进方向盘左下角的空格里,省下一整行高度给手机竖屏
    let corner: HTMLElement = blank();
    if (!commanderPad) {
      const b = mk("🔨", "在脚下摆建筑", " mc-btn-build");
      b.addEventListener("click", () => heroBuild(player));
      corner = b;
    }
    pad.append(blank(), up, blank(), leftB, fire, rightB, corner, down, blank());
    pads.appendChild(pad);
  }

  for (let i = 0; i < heroes.length; i++) buildPad(i, false);
  if (opts.commander) buildPad(1, true);

  /* ---------------- 每帧推进 ---------------- */

  function stepWaves(dt: number): void {
    if (opts.plan.kind === "versus") {
      versusLeft -= dt;
      energy = Math.min(COMMANDER_ENERGY_CAP, energy + commanderRegen(elapsed) * dt);
      const who = versusWinner(hearts, versusLeft);
      if (who) finish(who === "defender");
      return;
    }
    if (phase === "prep") {
      phaseTime -= dt;
      if (phaseTime <= 0) {
        phase = "wave";
        waveTime = 0;
        spawnIdx = 0;
        currentWave = nextWave(waveIdx + 1);
        say(`第 ${waveIdx + 1} 波来啦!`);
      }
      return;
    }
    waveTime += dt;
    const wave = currentWave;
    if (!wave) return;
    while (spawnIdx < wave.spawns.length && wave.spawns[spawnIdx].time <= waveTime) {
      const s = wave.spawns[spawnIdx++];
      spawn(s.kind, s.lane, idxFor(waveIdx));
    }
    if (spawnIdx >= wave.spawns.length && monsters.length === 0) {
      wavesCleared = waveIdx + 1;
      if (opts.plan.kind === "fixed" && wavesCleared >= opts.plan.waves.length) {
        finish(true);
        return;
      }
      waveIdx++;
      phase = "prep";
      phaseTime = INTERMISSION_SECONDS;
      currentWave = null;
      sfx("coin");
      // 备战面板自动弹出来:这就是「波次之间管资源」的时刻
      openTech();
    }
  }

  function stepEconomy(dt: number): void {
    const boost = phase === "prep" && !versus ? INTERMISSION_PAINT_BOOST : 1;
    passive -= dt * boost;
    if (passive <= 0) {
      passive += paintInterval(tech.paint);
      gain(1);
    }
    for (const t of towers.values()) {
      if (t.kind !== "jar") continue;
      t.prod -= dt * boost;
      if (t.prod <= 0) {
        t.prod += jarInterval(tech.paint);
        gain(TOWER_INFO.jar.produce ?? 1);
      }
    }
  }

  function stepTowers(dt: number): void {
    for (const t of [...towers.values()]) {
      const spec = TOWER_INFO[t.kind];
      const blast = spec.blast;
      if (blast) {
        const cx = colX(t.col);
        const hit = monsters.some(
          (m) => !m.flying && m.lane === t.lane && Math.abs(m.x - cx) <= blast.trigger
        );
        if (!hit) continue;
        const dmg = blastDamage(tech.tower);
        for (const m of monsters) {
          if (m.flying || m.lane !== t.lane || Math.abs(m.x - cx) > blast.range) continue;
          const r = applyHit(m, dmg);
          m.hp = r.hp;
          m.armor = r.armor;
          m.flash = 0.18;
        }
        towers.delete(key(t.col, t.lane));
        puffs.push({ x: px(cx), y: py(t.lane), age: 0, emoji: "🍿" });
        sfx("pop");
        continue;
      }
      if (!spec.dmg) continue;
      t.cd -= dt;
      if (t.cd > 0) continue;
      const proj: ProjectileKind = t.kind === "frost" ? "ice" : t.kind === "beam" ? "beam" : "bubble";
      const cx = colX(t.col);
      if (!monsters.some((m) => m.lane === t.lane && m.x >= cx - 0.2 && canHit(proj, m.flying))) continue;
      t.cd = spec.cd ?? 1;
      shots.push({
        x: cx,
        lane: t.lane,
        dmg: towerDamage(t.kind, tech.tower),
        proj,
        slows: !!spec.slows,
        speed: 7,
      });
    }
  }

  function stepHeroes(dt: number): void {
    for (let i = 0; i < heroes.length; i++) {
      const h = heroes[i];
      const k = held[i];
      const sp = heroSpeed(tech.hero);
      if (k.up) h.lane = clamp(h.lane - sp * 0.42 * dt, 0, LANES - 1);
      if (k.down) h.lane = clamp(h.lane + sp * 0.42 * dt, 0, LANES - 1);
      if (k.left) h.x = clamp(h.x - sp * 0.5 * dt, HERO_MIN_X, HERO_MAX_X);
      if (k.right) h.x = clamp(h.x + sp * 0.5 * dt, HERO_MIN_X, HERO_MAX_X);

      // 手指牵着走:主角朝着手指的位置跑,跑到了就一直甩颜料弹
      const target = follow[i];
      if (target) {
        const stepLane = sp * 0.55 * dt;
        const dl = target.lane - h.lane;
        h.lane = Math.abs(dl) <= stepLane ? target.lane : h.lane + Math.sign(dl) * stepLane;
        const stepX = sp * 0.7 * dt;
        const dx = target.x - h.x;
        h.x = Math.abs(dx) <= stepX ? target.x : h.x + Math.sign(dx) * stepX;
      }

      h.cd = Math.max(0, h.cd - dt);
      h.swing = Math.max(0, h.swing - dt);
      if (target && h.cd <= 0) heroFire(i);
    }
  }

  function stepShots(dt: number): void {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.speed * dt;
      if (s.x > SPAWN_X + 0.6) {
        shots.splice(i, 1);
        continue;
      }
      let target: Monster | null = null;
      for (const m of monsters) {
        if (Math.round(m.lane) !== Math.round(s.lane) || !canHit(s.proj, m.flying)) continue;
        if (s.x >= m.x - 0.28 && (!target || m.x < target.x)) target = m;
      }
      if (!target) continue;
      const r = applyHit(target, s.dmg);
      target.hp = r.hp;
      target.armor = r.armor;
      target.flash = 0.16;
      if (s.slows) target.frost = FROST_SECONDS;
      shots.splice(i, 1);
    }
  }

  function stepMonsters(dt: number): void {
    for (const m of monsters) {
      if (m.frost > 0) m.frost -= dt;
      if (m.flash > 0) m.flash -= dt;
      let wallAhead: Tower | null = null;
      if (!m.flying) {
        for (const t of towers.values()) {
          if (t.lane !== Math.round(m.lane)) continue;
          const cx = colX(t.col);
          if (cx <= m.x + CHEW_REACH && (!wallAhead || cx > colX(wallAhead.col))) wallAhead = t;
        }
      }
      if (wallAhead) {
        if (willJump(m.kind, m.jumped)) {
          m.jumped = true;
          m.x = Math.max(HOME_X + 0.2, colX(wallAhead.col) - 0.8);
          sfx("jump");
          continue;
        }
        m.chewCd -= dt;
        if (m.chewCd <= 0) {
          m.chewCd += chewInterval(m.boss);
          wallAhead.hp -= chewDamage(m.boss);
          if (wallAhead.hp <= 0) {
            towers.delete(key(wallAhead.col, wallAhead.lane));
            puffs.push({ x: px(colX(wallAhead.col)), y: py(wallAhead.lane), age: 0, emoji: "💨" });
          }
        }
        continue;
      }
      m.x -= monsterSpeed(m.base, m.frost) * dt;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.hp <= 0) {
        monsters.splice(i, 1);
        popped++;
        gain(MONSTER_INFO[m.kind].reward);
        puffs.push({ x: px(m.x), y: py(m.lane), age: 0, emoji: POP_EMOJI[m.kind] });
        popSound();
        const kids = MONSTER_INFO[m.kind].splits ?? 0;
        for (let k = 0; k < kids; k++) {
          const before = monsters.length;
          spawn("doodle", m.lane, idxFor(waveIdx));
          const baby = monsters[before];
          if (baby) baby.x = Math.min(SPAWN_X, m.x + 0.3 + k * 0.4);
        }
        continue;
      }
      if (m.x <= HOME_X) {
        monsters.splice(i, 1);
        leaks[Math.round(m.lane)]++;
        hearts--;
        shake = 0.4;
        sfx("oops");
        say(`${MONSTER_INFO[m.kind].name}搬走了一罐颜料,还剩 ${Math.max(0, hearts)} 罐!`);
        if (hearts <= 0) {
          finish(false);
          return;
        }
      }
    }
  }

  /* ---------------- 渲染 ---------------- */

  function render(): void {
    if (!c2d) return;
    const t = elapsed;
    c2d.clearRect(0, 0, SCENE_W, SCENE_H);
    c2d.fillStyle = sky;
    c2d.fillRect(0, 0, SCENE_W, SCENE_H);

    // 五条小路
    for (let lane = 0; lane < LANES; lane++) {
      c2d.fillStyle = lane % 2 === 0 ? ground : shade(ground, 0.97);
      c2d.fillRect(0, FIELD_TOP + lane * LANE_H, SCENE_W, LANE_H);
    }
    c2d.strokeStyle = "rgba(255,255,255,.7)";
    c2d.lineWidth = 2;
    for (let lane = 1; lane < LANES; lane++) {
      c2d.beginPath();
      c2d.moveTo(0, FIELD_TOP + lane * LANE_H);
      c2d.lineTo(SCENE_W, FIELD_TOP + lane * LANE_H);
      c2d.stroke();
    }

    // 建造格的虚线,顺便标出摆不了东西的花坛
    c2d.strokeStyle = "rgba(255,255,255,.55)";
    c2d.lineWidth = 1.4;
    for (let lane = 0; lane < LANES; lane++) {
      for (let col = 0; col < BUILD_COLS; col++) {
        const cx = px(colX(col));
        const cy = py(lane);
        if (blocked.has(key(col, lane))) {
          c2d.fillStyle = "rgba(150,190,150,.35)";
          roundRect(c2d, cx - 26, cy - 26, 52, 52, 10);
          c2d.fill();
          c2d.font = "20px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
          c2d.textAlign = "center";
          c2d.textBaseline = "middle";
          c2d.fillStyle = "rgba(80,120,80,.6)";
          c2d.fillText("🌷", cx, cy);
          continue;
        }
        roundRect(c2d, cx - 26, cy - 26, 52, 52, 10);
        c2d.stroke();
      }
    }

    drawHome(c2d, hearts, def.homeHp, shake);
    for (const tw of towers.values()) drawTower(c2d, tw, t);
    for (const s of shots) drawShot(c2d, s);
    for (const m of monsters) drawMonster(c2d, m, t);
    for (let i = 0; i < heroes.length; i++) drawHero(c2d, heroes[i], i, t);
    for (const p of puffs) drawPuff(c2d, p);

    // 指挥官的准星:告诉星星现在会从哪条道派出什么
    if (opts.commander) {
      const deck = commanderDeck(elapsed);
      const kind = deck[Math.min(cmdPick, deck.length - 1)];
      const y = py(cmdLane);
      c2d.strokeStyle = P_COLOR[1];
      c2d.lineWidth = 3;
      c2d.setLineDash([8, 6]);
      c2d.beginPath();
      c2d.moveTo(SCENE_W - 8, y - 26);
      c2d.lineTo(SCENE_W - 8, y + 26);
      c2d.stroke();
      c2d.setLineDash([]);
      c2d.font = `700 ${Math.round(15 * textScale)}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
      c2d.textAlign = "right";
      c2d.textBaseline = "middle";
      c2d.fillStyle = P_COLOR[1];
      c2d.fillText(`${MONSTER_EMOJI[kind]} ${MONSTER_INFO[kind].name} ⚡${commanderCost(kind)}`, SCENE_W - 16, y);
    }

    // 顶上的一句话提示
    if (flashLeft > 0 && flashMsg) {
      const fs = Math.round(16 * textScale);
      const bh = fs + 10;
      c2d.font = `800 ${fs}px 'PingFang SC','Microsoft YaHei',system-ui,sans-serif`;
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";
      c2d.fillStyle = "rgba(255,255,255,.9)";
      const w = c2d.measureText(flashMsg).width + 24;
      roundRect(c2d, SCENE_W / 2 - w / 2, 6, w, bh, bh / 2);
      c2d.fill();
      c2d.fillStyle = "#7a4f9c";
      c2d.fillText(flashMsg, SCENE_W / 2, 6 + bh / 2);
    }
  }

  function refreshHud(): void {
    paintChip.textContent = `🎨 ${paint}/${paintCap(tech.paint)}`;
    homeChip.className = hearts <= 1 ? "mc-chip mc-chip-warn" : "mc-chip";
    homeChip.textContent = `🏠 ${"🫙".repeat(Math.max(0, hearts))}${"·".repeat(Math.max(0, def.homeHp - hearts))}`;
    if (opts.plan.kind === "versus") {
      waveChip.textContent = `⏳ ${formatClock(Math.max(0, versusLeft))} · ⚡${Math.floor(energy)}`;
    } else if (opts.plan.kind === "fixed") {
      waveChip.textContent =
        phase === "prep"
          ? `🛠️ 备战 ${Math.ceil(Math.max(0, phaseTime))} 秒 · 下一波 ${waveIdx + 1}/${waveTotal}`
          : `🌊 第 ${waveIdx + 1}/${waveTotal} 波`;
    } else {
      waveChip.textContent =
        phase === "prep"
          ? `🛠️ 备战 ${Math.ceil(Math.max(0, phaseTime))} 秒 · 下一波 ${waveIdx + 1}`
          : `♾️ 第 ${waveIdx + 1} 波`;
    }
    refreshShop();
  }

  function frame(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused && !finished) {
      elapsed += dt;
      if (shake > 0) shake = Math.max(0, shake - dt);
      if (flashLeft > 0) flashLeft -= dt;
      stepWaves(dt);
      if (!finished) {
        stepEconomy(dt);
        stepTowers(dt);
        stepHeroes(dt);
        stepShots(dt);
        stepMonsters(dt);
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].age += dt;
      if (puffs[i].age > 0.75) puffs.splice(i, 1);
    }
    refreshHud();
    render();
  }

  techBtn.addEventListener("click", () => {
    sfx("tap");
    if (techOpen) {
      techOpen = false;
      paused = false;
      closeLayer();
    } else {
      openTech();
    }
  });
  pauseBtn.addEventListener("click", () => {
    sfx("tap");
    togglePause();
  });

  refreshShop();
  refreshHud();
  layout();
  win.addEventListener("resize", layout);
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(layout);
    ro.observe(field);
  }
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      cancelAnimationFrame(raf);
      closeLayer();
      ro?.disconnect();
      ro = null;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      win.removeEventListener("resize", layout);
      win.removeEventListener("keydown", onKeyDown);
      win.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 战役:188 关                                                        */
/* ------------------------------------------------------------------ */

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = LEVELS[ctx.level];
  const unlock = def.unlock;
  const runner = createField(stage, {
    def,
    levelIdx: ctx.level,
    plan: { kind: "fixed", waves: def.waves },
    heroes: 1,
    title: `${ctx.chapter.emoji} 第 ${ctx.level + 1} 关`,
    hint: unlock
      ? `新建筑解锁:${TOWER_EMOJI[unlock]} ${TOWER_INFO[unlock].name} —— ${TOWER_INFO[unlock].desc}`
      : "手指按住画面就能牵着朵朵跑,按住不放会一直甩颜料弹;想摆东西先点上面的建筑,再点格子。电脑上用 W A S D 走位、F 甩、G 摆。",
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.win) {
        ctx.win(campaignStars(res.hearts, res.homeHp), winLine(res.hearts, res.homeHp, res.popped));
      } else {
        ctx.lose(loseLine(res.wavesCleared + 1, res.waveTotal, weakestLane(res.leaks)));
      }
    },
  });
  return { destroy: () => runner.destroy() };
}

/* ------------------------------------------------------------------ */
/* 三个附加模式共用的外壳                                               */
/* ------------------------------------------------------------------ */

function modeShell(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  chipText: string,
  backClass: string
): { root: HTMLElement; stage: HTMLElement; chip: HTMLElement; destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mc-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "mc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = `mc-back ${backClass}`;
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "mc-chip";
  chip.textContent = chipText;
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return { root: wrap, stage, chip, destroy: () => wrap.remove() };
}

/** 附加模式共用的空场地定义:全部建筑解锁,没有花坛。 */
function openField(startPaint: number, homeHp: number): LevelDef {
  return { chapter: 7, homeHp, startPaint, blocked: [], boss: null, waves: [] };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  label: string,
  cls: string,
  onAgain: () => void
): void {
  stage.innerHTML = "";
  const box = document.createElement("div");
  box.className = "mc-over";
  box.innerHTML = `<div class="mc-layer-t">${title}</div><div class="mc-layer-s">${sub}</div>`;
  const again = document.createElement("button");
  again.type = "button";
  again.className = `mc-open ${cls}`;
  again.textContent = label;
  again.addEventListener("click", onAgain);
  box.appendChild(again);
  stage.appendChild(box);
}

/* ------------------------------------------------------------------ */
/* 无尽                                                                */
/* ------------------------------------------------------------------ */

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, "", "");
  let runner: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 挡到第几波?";
    runner = createField(shell.stage, {
      def: openField(10, 3),
      levelIdx: 0,
      levelIdxFor: (waveIdx) => endlessLevelIndex(waveIdx + 1),
      plan: { kind: "endless", make: (wave) => buildEndlessWave(wave) },
      heroes: 1,
      title: "无尽守家",
      hint: "波次没有尽头,能挡多少算多少。每 8 波会来一只大怪,提前把墙加厚!手指按住画面就能牵着朵朵跑。",
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const reached = res.wavesCleared;
        best = save.recordEndlessBest(meta.id, reached);
        if (reached > 0) api.addStars(Math.min(3, Math.ceil(reached / 4)));
        overBox(
          shell.stage,
          reached >= best && reached > 0 ? "🏅 新纪录!" : "🏠 颜料被搬完啦",
          endlessLine(reached, best),
          "🔁 从第 1 波再来",
          "",
          () => {
            api.play("tap");
            start();
          }
        );
      },
    });
  }

  start();
  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 双人合作                                                            */
/* ------------------------------------------------------------------ */

function mountCoop(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, `🤝 双人合作 · 一起挡满 ${COOP_TARGET_WAVES} 波`, "");
  let runner: { destroy: () => void } | null = null;

  function start(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    const waves: WaveDef[] = [];
    for (let w = 1; w <= COOP_TARGET_WAVES; w++) waves.push(buildCoopWave(w));
    runner = createField(shell.stage, {
      def: openField(12, 4),
      levelIdx: 0,
      levelIdxFor: (waveIdx) => endlessLevelIndex(waveIdx + 1),
      plan: { kind: "fixed", waves },
      heroes: 2,
      title: "双人合作守家",
      hint: "朵朵 W A S D + F 甩 + G 摆;星星 ↑←↓→ + L 甩 + K 摆。手机上按住画面左半边牵着朵朵、右半边牵着星星。颜料是两个人一起花的,商量着来!",
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const done = res.wavesCleared;
        if (res.win) api.addStars(3);
        else if (done >= 5) api.addStars(1);
        overBox(
          shell.stage,
          res.win ? "🎉 一起守住啦!" : "🏠 颜料被搬完啦",
          coopLine(done, COOP_TARGET_WAVES, res.popped),
          "🔁 再来一局",
          "mc-open-co",
          () => {
            api.play("tap");
            start();
          }
        );
      },
    });
  }

  start();
  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 非对称对战:一个守家,一个指挥出兵                                     */
/* ------------------------------------------------------------------ */

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(
    host,
    api,
    onBack,
    `⚔️ 非对称对战 · 朵朵守家 ${VERSUS_SECONDS} 秒,星星指挥出兵`,
    ""
  );
  let runner: { destroy: () => void } | null = null;

  function start(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    runner = createField(shell.stage, {
      def: openField(12, 4),
      levelIdx: 60,
      plan: { kind: "versus", seconds: VERSUS_SECONDS },
      heroes: 1,
      commander: true,
      title: "非对称对战",
      hint: "朵朵:W A S D 走位 + F 甩 + G 摆建筑,手机上按住画面拖着走。星星:↑↓ 选道、←→ 换兵、L 派出去(要攒能量),手机上用下面那套方向盘。",
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const side = res.win ? "defender" : "commander";
        api.addStars(1);
        overBox(
          shell.stage,
          res.win ? "🛡️ 朵朵守住啦!" : "🚀 星星指挥赢啦!",
          versusLine(side, res.hearts, res.win ? VERSUS_SECONDS : res.elapsed),
          "🔁 换边再来",
          "mc-open-vs",
          () => {
            api.play("tap");
            start();
          }
        );
      },
    });
  }

  start();
  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 挂载:模式条 + 188 关地图                                            */
/* ------------------------------------------------------------------ */

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mc-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mc-open";
  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "mc-open mc-open-co";
  coopBtn.textContent = "🤝 双人合作";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "mc-open mc-open-vs";
  vsBtn.textContent = "⚔️ 非对称对战";
  bar.append(endlessBtn, coopBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 点我开始!";
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
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关卡里那一屏得省着用,三颗模式按钮只在选关地图上露面
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            if (!mode) bar.hidden = false;
          },
        };
      },
      mapHint: "先摆两个颜料罐把钱攒起来,再架炮台、立棉花墙;波次之间记得升科技。",
      grandMessage: "188 关全部守住!彩虹总部的小怪物全变成了花花糖果,你是最棒的守家小队长!",
      guide,
      guideTitle: "小怪物危机 · 守家手册",
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
