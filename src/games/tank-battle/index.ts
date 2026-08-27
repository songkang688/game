import { meta } from "./meta";
export { meta };

// 铁皮坦克大战:俯视格子战场,守住底边的星星老巢。
// 地形五件套:积木砖(打得碎,一小角一小角地碎)、钢板(要彩纸穿甲弹)、水洼(弹丸飞得过)、
// 草丛(半透明藏身)、冰面(会打滑)。弹丸三种:直线弹、弹力球(碰墙弹两次,有预测虚线)、彩纸穿甲弹。
// 铁皮车分三档脾气:乱转 / 追人 / 绕后卡位。
// 四种玩法:188 关战役(可随时拉第二个人进来合作)、双人对战(可选电脑陪练)、无尽守老巢。
// 全程没有血量与淘汰:铁皮车挨够弹丸冒烟变成花,自己人被打中是零件散一地、3 秒后组装回来。
import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  loadStars,
  markSkipped,
  mountLevelGame,
  rateBelow,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { getLevelExtras } from "../../ui/level188Contract";
import { save } from "../../engine/save";
import { speak, stopSpeaking } from "../speech";
import guide from "./guide";
import {
  CHAPTERS,
  CHAPTER_NEW,
  MAP_H,
  MAP_W,
  buildLevel,
  chapterIndexOf,
  endlessRows,
  scaleForPlayers,
} from "./levels";
import { ARENAS, FROST_NEST_MAP, type ArenaMap, type NestMap } from "./maps12";
import {
  ACTION_DIR,
  ENEMY_SPECS,
  KEY_MAP,
  MUZZLE_WINDUP,
  PAUSE_KEY,
  REBUILD_SECONDS,
  SCATTER_SECONDS,
  SHELL_KEY_MAP,
  TANK_HALF,
  aliveEnemies,
  blockedProbe,
  createWorld,
  endlessMaxAlive,
  endlessWave,
  fortGaps,
  isFortBrick,
  loseLine,
  rateRun,
  recoilPixels,
  stepWorld,
  winLine,
  type Dir,
  type EnemyKind,
  type PlayerInput,
  type Tank,
  type World,
} from "./logic";
import { SHELLS, SHELL_ORDER, nextShell, previewPath, shotVelocity, type ShellKind } from "./ballistics12";
import { AI_TIERS, TIER_SPECS, type AiTier } from "./ai12";
import { BRICK_FULL, GRASS_ALPHA, Q_NE, Q_NW, Q_SE, Q_SW } from "./terrain12";
import { mulberry32 } from "../level99";

const P_NAME = ["鸭梨", "康康"];
const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_KEYS = ["WASD 走 · F 发射 · R 换弹 · G 补墙", "方向键 走 · L 发射 · O 换弹 · K 补墙"];

/** 手指热区下限(px):摇杆和发射钮都不许比这个小 */
export const TOUCH_MIN = 46;
/** 双人同屏挤在 360px 里时的热区下限(px) */
export const TOUCH_MIN_TWO = 44;

const CSS = `
/* 平台那层舞台是 overflow:hidden 的:自己这一层留一条竖向滚动做兜底,
   万一哪台机器上算得不准,摇杆也不至于被切在屏幕外面点不到 */
.tkb-root{height:100%;overflow-y:auto;overscroll-behavior:contain;}
.tkb-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;align-items:center;
  width:100%;max-width:100%;min-width:0;}
.tkb-wrap > *{max-width:100%;min-width:0;}
.tkb-hud{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;}
/* display:flex 会把浏览器自带的 [hidden]{display:none} 顶掉,得自己补一条压回去 */
.tkb-wrap[hidden],.tkb-hud[hidden],.tkb-bar[hidden],.tkb-pads[hidden],.tkb-acts[hidden],
.tkb-mode[hidden],.tkb-mini-cv[hidden],.tkb-canvas[hidden]{display:none;}
.tkb-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#5f5280;
  box-shadow:0 2px 6px rgba(150,140,180,.24);white-space:nowrap;}
.tkb-chip-warn{background:#ffe9ef;color:#b8436f;}
.tkb-board{position:relative;line-height:0;}
.tkb-canvas{display:block;border-radius:14px;background:#5f5a52;touch-action:none;
  box-shadow:0 4px 14px rgba(90,80,110,.28);}
.tkb-mini{position:absolute;right:6px;bottom:6px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.tkb-mini-btn{border:none;border-radius:999px;padding:4px 9px;font-size:11.5px;font-weight:900;cursor:pointer;
  font-family:inherit;background:rgba(255,255,255,.88);color:#6a5b90;box-shadow:0 2px 5px rgba(70,60,90,.3);}
.tkb-mini-cv{display:block;border-radius:8px;background:rgba(20,18,26,.55);box-shadow:0 2px 8px rgba(40,32,60,.4);}
.tkb-over{position:absolute;inset:0;border-radius:14px;background:rgba(255,252,250,.94);display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:14px;}
.tkb-over-t{font-size:21px;font-weight:900;color:#7a4f9a;line-height:1.3;}
.tkb-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;max-width:280px;}
.tkb-tip{font-size:12.5px;font-weight:700;color:#6f6390;text-align:center;line-height:1.5;max-width:min(420px,100%);}
.tkb-pads{display:flex;gap:10px;justify-content:center;align-items:flex-start;flex-wrap:wrap;width:100%;}
.tkb-pad{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;}
.tkb-pad-t{font-size:12px;font-weight:900;text-align:center;overflow-wrap:anywhere;}
.tkb-sticks{display:flex;gap:6px;align-items:center;}
/* 摇杆:上面一颗居中,下面 ◀▼▶ 一排。每一颗都写死格子,不靠自动排版猜 */
.tkb-dpad{display:grid;grid-template-columns:repeat(3,auto);grid-template-rows:repeat(2,auto);gap:3px;}
.tkb-dpad-up{grid-area:1/2;}
.tkb-dpad-left{grid-area:2/1;}
.tkb-dpad-down{grid-area:2/2;}
.tkb-dpad-right{grid-area:2/3;}
/* 动作键单独一块:发射钮占满上面一行,换弹与补墙并排在下面。
   和摇杆一样高,一屏就装得下;双人挤在窄屏上时再改回竖着一列(见下面的 media)。 */
.tkb-acts-col{display:grid;grid-template-columns:repeat(2,auto);gap:3px;}
.tkb-acts-col .tkb-fire{grid-column:1 / span 2;width:100%;}
.tkb-key{border:none;border-radius:12px;min-width:${TOUCH_MIN}px;min-height:${TOUCH_MIN}px;padding:0;font-size:17px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#54446f;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.tkb-key:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.tkb-key:disabled{opacity:.45;cursor:default;}
.tkb-fire{background:#ffdbe6;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.42);min-width:${TOUCH_MIN}px;min-height:${TOUCH_MIN}px;}
.tkb-shell{background:#e4f0ff;color:#356098;font-size:15px;}
.tkb-brick{background:#ffeed8;color:#a06a2c;}
.tkb-key:focus-visible,.tkb-act:focus-visible,.tkb-open:focus-visible,.tkb-mini-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.tkb-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.tkb-act{border:none;border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#67529c;box-shadow:0 3px 0 rgba(120,90,160,.26);white-space:nowrap;}
.tkb-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.26);}
.tkb-act-on{background:#e7dcff;color:#4d3a86;}
.tkb-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.tkb-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7f9a5e,#65803f);box-shadow:0 4px 0 #4d6630;}
.tkb-open.tkb-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.tkb-open:active{transform:translateY(2px);box-shadow:0 2px 0 #4d6630;}
/* align-items 用 stretch 而不是 center:居中会让每个孩子按 max-content 撑宽,
   HUD 一长就把整块内容顶出屏幕(左边那一截就再也看不见了) */
.tkb-mode{border-radius:18px;padding:10px;background:linear-gradient(180deg,#f2f6ea,#fff4f8);
  display:flex;flex-direction:column;gap:8px;align-items:stretch;min-width:0;}
.tkb-mode > *{min-width:0;}
.tkb-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.tkb-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a7a52;box-shadow:0 3px 0 rgba(110,130,80,.3);}
.tkb-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,130,80,.3);}
@media (max-width:420px){
  .tkb-pads{gap:4px;justify-content:space-between;}
  /* 双人同屏,左右各一套。360px 上横着摆不下「摇杆 + 动作列」两块,
     所以这一档改成上下摞:摇杆在上、发射/换弹/补墙一排在下,每套正好三颗键宽。 */
  .tkb-pads-two{gap:4px;flex-wrap:nowrap;}
  .tkb-pads-two .tkb-pad{max-width:150px;}
  .tkb-pads-two .tkb-key{min-width:${TOUCH_MIN_TWO}px;min-height:${TOUCH_MIN_TWO}px;font-size:15px;}
  .tkb-pads-two .tkb-fire{min-width:${TOUCH_MIN_TWO}px;min-height:${TOUCH_MIN_TWO}px;}
  .tkb-pads-two .tkb-sticks{flex-direction:column;gap:5px;}
  .tkb-pads-two .tkb-dpad{gap:2px;}
  .tkb-pads-two .tkb-acts-col{grid-template-columns:repeat(3,auto);gap:2px;}
  .tkb-pads-two .tkb-acts-col .tkb-fire{grid-column:1;width:auto;}
  .tkb-pad-t{font-size:10.5px;}
  .tkb-open{padding:7px 11px;font-size:13px;}
  .tkb-bar{gap:6px;margin-bottom:4px;}
  /* 窄屏上高度比什么都金贵:HUD 与「选场地 / 选陪练」都排成一行,
     放不下就横着滑,绝不换行——每换一行,战场就得缩掉一整格 */
  .tkb-hud{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;}
  .tkb-mode > .tkb-acts{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;width:100%;}
  .tkb-mode{padding:6px;gap:5px;}
  .tkb-mhead{flex-wrap:nowrap;overflow-x:auto;}
  /* 装不下就收成两行加省略号,别把句子拦腰切一半留在屏幕上 */
  .tkb-tip{font-size:11.5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
  .tkb-chip{padding:4px 9px;font-size:12px;}
  .tkb-wrap{gap:5px;}
}
/* 屏幕本来就矮(667 那一档):提示只留一行,间距再收一点,免得摇杆被挤出舞台 */
@media (max-height:700px){
  .tkb-tip{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;}
  .tkb-wrap{gap:4px;}
  .tkb-mode{padding:5px;gap:4px;}
  .tkb-pad{gap:2px;}
  .tkb-pads-two .tkb-sticks{gap:3px;}
}
@media (prefers-reduced-motion:reduce){.tkb-key:active{transform:none;}}
`;

// ---------------------------------------------------------------------------
// 画面:全部程序化绘制,一张外部图片都不用
// ---------------------------------------------------------------------------

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/** 积木砖:四个小块各画各的,被崩掉的那一角就是空的(缝里能钻弹丸) */
function drawBrick(c: CanvasRenderingContext2D, x: number, y: number, s: number, mask: number): void {
  const half = s / 2;
  const bits: Array<[number, number, number]> = [
    [Q_NW, 0, 0],
    [Q_NE, half, 0],
    [Q_SW, 0, half],
    [Q_SE, half, half],
  ];
  for (const [bit, dx, dy] of bits) {
    if (!(mask & bit)) continue;
    c.fillStyle = mask === BRICK_FULL ? "#c1714a" : "#cf8358";
    roundRect(c, x + dx + 0.8, y + dy + 0.8, half - 1.6, half - 1.6, 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.45)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + dx + 1.5, y + dy + half / 2);
    c.lineTo(x + dx + half - 1.5, y + dy + half / 2);
    c.stroke();
  }
}

function drawSteel(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.fillStyle = "#b9bfc9";
  roundRect(c, x + 1, y + 1, s - 2, s - 2, 4);
  c.fill();
  c.fillStyle = "#8f97a3";
  const r = Math.max(1.2, s * 0.07);
  for (const [dx, dy] of [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ]) {
    c.beginPath();
    c.arc(x + s * dx, y + s * dy, r, 0, Math.PI * 2);
    c.fill();
  }
}

function drawWater(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  c.fillStyle = "#6fb6dd";
  c.fillRect(x, y, s, s);
  c.strokeStyle = "rgba(255,255,255,.55)";
  c.lineWidth = Math.max(1, s * 0.06);
  for (let k = 0; k < 2; k++) {
    const yy = y + s * (0.34 + k * 0.34) + Math.sin(t * 2 + x + k) * s * 0.05;
    c.beginPath();
    c.moveTo(x + s * 0.14, yy);
    c.quadraticCurveTo(x + s * 0.5, yy - s * 0.12, x + s * 0.86, yy);
    c.stroke();
  }
}

/** 冰面:浅蓝的一格,加两道反光,一看就知道会滑 */
function drawIce(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.fillStyle = "#cfe9f7";
  c.fillRect(x, y, s, s);
  c.strokeStyle = "rgba(255,255,255,.85)";
  c.lineWidth = Math.max(1, s * 0.05);
  c.beginPath();
  c.moveTo(x + s * 0.18, y + s * 0.72);
  c.lineTo(x + s * 0.5, y + s * 0.22);
  c.moveTo(x + s * 0.56, y + s * 0.78);
  c.lineTo(x + s * 0.82, y + s * 0.42);
  c.stroke();
}

/** 草丛:半透明,躲进去只看得见影子,不至于完全瞎 */
function drawGrass(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.globalAlpha = GRASS_ALPHA;
  c.fillStyle = "#5fa658";
  roundRect(c, x, y, s, s, 3);
  c.fill();
  c.fillStyle = "#8cc878";
  for (const [dx, dy] of [
    [0.25, 0.7],
    [0.5, 0.45],
    [0.75, 0.72],
  ]) {
    c.beginPath();
    c.ellipse(x + s * dx, y + s * dy, s * 0.16, s * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function drawBase(c: CanvasRenderingContext2D, x: number, y: number, s: number, shielded: boolean, t: number): void {
  c.fillStyle = "#f7e7b8";
  roundRect(c, x + 1, y + 1, s - 2, s - 2, 5);
  c.fill();
  c.fillStyle = "#ffb937";
  c.beginPath();
  const cx = x + s / 2;
  const cy = y + s / 2;
  const R = s * 0.36;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? R : R * 0.45;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  if (shielded) {
    c.strokeStyle = `rgba(120,200,255,${0.55 + Math.sin(t * 4) * 0.2})`;
    c.lineWidth = Math.max(1.5, s * 0.09);
    c.beginPath();
    c.arc(cx, cy, s * 0.46, 0, Math.PI * 2);
    c.stroke();
  }
}

const KIND_FACE: Record<string, string> = {
  swift: "💨",
  armor: "🛡",
  power: "💥",
  smart: "🕵",
};

/** 一辆铁皮车。后坐、前摇的小顿、以及一点点斜投影的厚度感都在这儿 */
function drawTank(c: CanvasRenderingContext2D, tk: Tank, s: number, t: number): void {
  if (tk.spin > 0) return; // 散架了:这一会儿画的是零件,不是车
  const kick = recoilPixels(tk.recoil, s);
  const px = tk.x * s - [0, 1, 0, -1][tk.dir] * kick;
  const py = tk.y * s - [-1, 0, 1, 0][tk.dir] * kick;
  const half = TANK_HALF * s;
  const body =
    tk.side === "player" ? P_COLOR[tk.player] ?? P_COLOR[0] : ENEMY_SPECS[tk.kind as EnemyKind]?.color ?? "#9a9fb5";
  c.save();
  c.translate(px, py);
  c.rotate((tk.dir * Math.PI) / 2);
  // 底下垫一层深色:俯视图里那一点点厚度感就靠它
  c.fillStyle = "rgba(40,34,52,.25)";
  roundRect(c, -half * 0.66, -half * 0.8, half * 1.32, half * 1.8, half * 0.35);
  c.fill();
  // 轮子
  c.fillStyle = "rgba(60,55,70,.85)";
  roundRect(c, -half, -half * 0.95, half * 0.42, half * 1.9, 2);
  c.fill();
  roundRect(c, half * 0.58, -half * 0.95, half * 0.42, half * 1.9, 2);
  c.fill();
  // 车身
  c.fillStyle = body;
  roundRect(c, -half * 0.62, -half * 0.9, half * 1.24, half * 1.7, half * 0.35);
  c.fill();
  // 发射管
  c.fillStyle = "rgba(50,45,60,.9)";
  roundRect(c, -half * 0.14, -half * 1.25, half * 0.28, half * 0.62, 1.5);
  c.fill();
  if (tk.windup > 0) {
    // 前摇:管口先亮一下,然后弹丸才出膛
    const k = 1 - tk.windup / MUZZLE_WINDUP;
    c.fillStyle = `rgba(255,236,150,${0.35 + k * 0.5})`;
    c.beginPath();
    c.arc(0, -half * 1.3, half * (0.2 + k * 0.16), 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `${Math.round(s * 0.34)}px system-ui`;
  if (tk.side === "player") {
    c.fillStyle = "#fff";
    c.fillText(tk.player === 0 ? "🍐" : "👓", px, py);
  } else {
    c.fillText(KIND_FACE[tk.kind] ?? "🚜", px, py);
  }

  if (tk.armorMax > 1 && tk.armor < tk.armorMax) {
    c.fillStyle = "rgba(230,230,240,.8)";
    c.beginPath();
    c.arc(px + half * 0.6, py - half * 0.7, s * 0.12, 0, Math.PI * 2);
    c.fill();
  }
  if (tk.shield > 0) {
    c.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 12) * 0.25})`;
    c.lineWidth = Math.max(1.5, s * 0.07);
    c.beginPath();
    c.arc(px, py, half * 1.15, 0, Math.PI * 2);
    c.stroke();
  }
}

/** 散架的那 3 秒:零件先飞散,再在出生点一件一件装回来 */
function drawRebuilding(c: CanvasRenderingContext2D, tk: Tank, s: number): void {
  if (tk.spin <= 0) return;
  const gone = REBUILD_SECONDS - tk.spin;
  const parts = ["🔩", "⚙️", "🔧", "🛞", "🧰"];
  if (gone < SCATTER_SECONDS) {
    const k = gone / SCATTER_SECONDS;
    c.font = `${Math.round(s * 0.34)}px system-ui`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.globalAlpha = Math.max(0, 1 - k);
    for (const [i, face] of parts.entries()) {
      const a = (i / parts.length) * Math.PI * 2;
      c.fillText(face, (tk.scatterX + Math.cos(a) * k * 1.1) * s, (tk.scatterY + Math.sin(a) * k * 1.1) * s);
    }
    c.globalAlpha = 1;
    return;
  }
  // 组装:零件从四周收回出生点,收满就回场
  const k = (gone - SCATTER_SECONDS) / Math.max(0.01, REBUILD_SECONDS - SCATTER_SECONDS);
  c.font = `${Math.round(s * 0.3)}px system-ui`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const [i, face] of parts.entries()) {
    const a = (i / parts.length) * Math.PI * 2;
    const r = (1 - k) * 1.0;
    c.fillText(face, (tk.x + Math.cos(a) * r) * s, (tk.y + Math.sin(a) * r) * s);
  }
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = Math.max(1.5, s * 0.07);
  c.beginPath();
  c.arc(tk.x * s, tk.y * s, s * 0.42, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
  c.stroke();
}

/** 弹力球的预测虚线:只画到第一次反射之后一小截 */
function drawPreview(c: CanvasRenderingContext2D, w: World, tk: Tank, s: number): void {
  if (tk.shell !== "bounce" || tk.spin > 0) return;
  const v = shotVelocity(tk.dir, "bounce", tk.tilt);
  const start = { x: tk.x + v.x * (TANK_HALF + 0.08), y: tk.y + v.y * (TANK_HALF + 0.08) };
  const pts = previewPath(start, v, blockedProbe(w));
  if (pts.length < 2) return;
  c.save();
  c.setLineDash([4, 4]);
  c.strokeStyle = tk.player === 0 ? "rgba(255,150,190,.85)" : "rgba(140,190,255,.9)";
  c.lineWidth = Math.max(1.4, s * 0.06);
  c.beginPath();
  c.moveTo(pts[0].x * s, pts[0].y * s);
  for (const p of pts.slice(1)) c.lineTo(p.x * s, p.y * s);
  c.stroke();
  c.setLineDash([]);
  // 拐点上点一颗小星星,告诉小朋友「会在这儿弹一下」
  if (pts.length > 2) {
    c.fillStyle = "rgba(255,255,255,.9)";
    c.beginPath();
    c.arc(pts[1].x * s, pts[1].y * s, Math.max(2, s * 0.09), 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawWorld(c: CanvasRenderingContext2D, w: World, s: number, t: number, showPreview: boolean): void {
  const map = w.map;
  c.clearRect(0, 0, map.w * s, map.h * s);
  c.fillStyle = "#6b675e";
  c.fillRect(0, 0, map.w * s, map.h * s);

  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      const i = cy * map.w + cx;
      const tile = map.tiles[i];
      const x = cx * s;
      const y = cy * s;
      if (tile !== "~" && tile !== "i") {
        c.fillStyle = (cx + cy) % 2 === 0 ? "#75705f" : "#6d6959";
        c.fillRect(x, y, s, s);
      }
      if (tile === "#") {
        drawBrick(c, x, y, s, map.brickMask[i] || BRICK_FULL);
        if (isFortBrick(map, cx, cy)) {
          c.strokeStyle = "rgba(255,208,90,.75)";
          c.lineWidth = 1.5;
          c.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
        }
      } else if (tile === "S") {
        drawSteel(c, x, y, s);
      } else if (tile === "~") {
        drawWater(c, x, y, s, t);
      } else if (tile === "i") {
        drawIce(c, x, y, s);
      } else if (tile === "B") {
        drawBase(c, x, y, s, w.baseShield, t);
      }
    }
  }

  if (showPreview) {
    for (const tk of w.tanks) {
      if (tk.side === "player") drawPreview(c, w, tk, s);
    }
  }

  for (const b of w.bullets) {
    c.fillStyle = SHELLS[b.kind ?? "plain"].color;
    c.beginPath();
    c.arc(b.x * s, b.y * s, Math.max(2, s * 0.1), 0, Math.PI * 2);
    c.fill();
  }

  for (const tk of w.tanks) drawTank(c, tk, s, t);
  for (const tk of w.tanks) drawRebuilding(c, tk, s);

  // 草丛画在车上面:开进去就只剩个影子
  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      if (map.tiles[cy * map.w + cx] === "*") drawGrass(c, cx * s, cy * s, s);
    }
  }

  for (const e of w.effects) {
    const k = 1 - e.t / e.life;
    c.globalAlpha = Math.max(0, Math.min(1, k));
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `${Math.round(s * (e.kind === "flower" ? 0.7 : 0.45))}px system-ui`;
    const face =
      e.kind === "flower"
        ? "🌼"
        : e.kind === "smoke"
          ? "💨"
          : e.kind === "shield"
            ? "✨"
            : e.kind === "crumb"
              ? "🧱"
              : e.kind === "parts" || e.kind === "build"
                ? ""
                : "✳️";
    if (face) c.fillText(face, e.x * s, e.y * s - (1 - k) * s * 0.3);
    c.globalAlpha = 1;
  }
}

/** 角落里的小地图:默认折叠,展开也只有一小块,不遮战场 */
function drawMinimap(c: CanvasRenderingContext2D, w: World, px: number): void {
  const s = px / Math.max(w.map.w, w.map.h);
  c.clearRect(0, 0, px, px);
  for (let cy = 0; cy < w.map.h; cy++) {
    for (let cx = 0; cx < w.map.w; cx++) {
      const tile = w.map.tiles[cy * w.map.w + cx];
      if (tile === ".") continue;
      c.fillStyle =
        tile === "#"
          ? "#c1714a"
          : tile === "S"
            ? "#b9bfc9"
            : tile === "~"
              ? "#6fb6dd"
              : tile === "*"
                ? "#5fa658"
                : tile === "i"
                  ? "#cfe9f7"
                  : "#ffb937";
      c.fillRect(cx * s, cy * s, s, s);
    }
  }
  for (const tk of w.tanks) {
    c.fillStyle = tk.side === "player" ? P_COLOR[tk.player] ?? P_COLOR[0] : "#ff7a7a";
    c.beginPath();
    c.arc(tk.x * s, tk.y * s, Math.max(1.5, s * 0.42), 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------------------------------------------------------------------
// 一局的运行器:画布 + HUD + 键盘 + 摇杆 + 小地图 + 暂停
// ---------------------------------------------------------------------------

interface RunOptions {
  world: World;
  /** 真人有几位(电脑陪练不算) */
  players: 1 | 2;
  hint: string;
  extraChips?: () => string[];
  onEnd: (w: World) => void;
  onWaveClear?: (w: World) => void;
}

interface Runner {
  destroy: () => void;
}

function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

function mountRun(host: HTMLElement, sfx: (n: SoundName) => void, opts: RunOptions): Runner {
  const w = opts.world;
  const wrap = document.createElement("div");
  wrap.className = "tkb-wrap";

  const hud = document.createElement("div");
  hud.className = "tkb-hud";
  const board = document.createElement("div");
  board.className = "tkb-board";
  const canvas = document.createElement("canvas");
  canvas.className = "tkb-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "铁皮坦克战场");
  board.appendChild(canvas);

  const miniBox = document.createElement("div");
  miniBox.className = "tkb-mini";
  const miniBtn = document.createElement("button");
  miniBtn.type = "button";
  miniBtn.className = "tkb-mini-btn";
  const miniCv = document.createElement("canvas");
  miniCv.className = "tkb-mini-cv";
  miniCv.hidden = true;
  miniBox.append(miniBtn, miniCv);
  board.appendChild(miniBox);

  const tip = document.createElement("div");
  tip.className = "tkb-tip";
  tip.textContent = opts.hint;
  const acts = document.createElement("div");
  acts.className = "tkb-acts";
  const pads = document.createElement("div");
  pads.className = `tkb-pads${opts.players === 2 ? " tkb-pads-two" : ""}`;
  wrap.append(hud, board, tip, acts, pads);
  host.appendChild(wrap);

  const held = new Set<string>();
  const tapped = new Set<string>();
  const timers: number[] = [];
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let cell = 26;
  let settled = 0;
  let shake = 0;
  let miniOpen = false;
  const reduced = prefersReducedMotion();

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "tkb-act";
  pauseBtn.textContent = "⏸️ 暂停 (Esc)";
  acts.appendChild(pauseBtn);

  function refreshMini(): void {
    miniBtn.textContent = miniOpen ? "🗺️ 收起小地图" : "🗺️ 小地图";
    miniBtn.setAttribute("aria-expanded", miniOpen ? "true" : "false");
    miniCv.hidden = !miniOpen;
  }

  /**
   * 战场还能占多高。
   *
   * 平台那层舞台(`.game-stage`)是 `overflow:hidden` 的:算多了,摇杆就被切在屏幕外面,
   * 手指再长也点不到。所以这里不猜,直接量——先找到那个会裁剪的祖先,
   * 再拿它的高度减掉「战场以外的东西」(模式条、HUD、提示、暂停条、摇杆)。
   * 量不到(比如跑在没有布局引擎的测试环境里)就退回按窗口高度估的老办法。
   */
  function boardRoom(): number {
    const guess = Math.max(220, Math.min(430, (globalThis.innerHeight || 700) - 300));
    try {
      let clip: HTMLElement | null = wrap.parentElement;
      while (clip) {
        const oy = getComputedStyle(clip).overflowY;
        if (oy !== "visible" && clip.clientHeight > 120) break;
        clip = clip.parentElement;
      }
      if (!clip) return guess;
      const box = clip.getBoundingClientRect();
      const wrapBox = wrap.getBoundingClientRect();
      const boardBox = canvas.getBoundingClientRect();
      // 战场以外的一切:上面挡掉的那一截 + 整个 wrap 里除战场之外的部分
      const chrome = wrapBox.top - box.top + (wrapBox.height - boardBox.height);
      const room = clip.clientHeight - chrome - 10;
      return room > 150 ? room : guess;
    } catch {
      return guess;
    }
  }

  function layout(): void {
    const availW = Math.max(220, (host.clientWidth || 340) - 8);
    const availH = boardRoom();
    cell = Math.max(14, Math.floor(Math.min(availW / MAP_W, availH / MAP_H, 34)));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(MAP_W * cell * dpr);
    canvas.height = Math.round(MAP_H * cell * dpr);
    canvas.style.width = `${MAP_W * cell}px`;
    canvas.style.height = `${MAP_H * cell}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mini = Math.max(52, Math.round(MAP_W * cell * 0.28));
    miniCv.width = Math.round(mini * dpr);
    miniCv.height = Math.round(mini * dpr);
    miniCv.style.width = `${mini}px`;
    miniCv.style.height = `${mini}px`;
    const mc = miniCv.getContext("2d");
    if (mc) mc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function refreshHud(): void {
    const left = w.queue.length + aliveEnemies(w).length;
    const gaps = fortGaps(w).length;
    const chips: string[] = [];
    if (w.mode === "versus") {
      chips.push(`🍐 鸭梨 ${w.scores[0]}`, `👓 康康 ${w.scores[1]}`, `🎯 先打散 ${w.target} 次赢`);
    } else {
      chips.push(`🚜 还剩 ${left} 辆`, `🌼 已变花 ${w.defeated}`);
      if (w.map.base) {
        chips.push(w.baseShield ? "🛡️ 护罩还在" : `⚠️ 护罩充能 ${Math.ceil(w.shieldTimer)} 秒`);
      }
      if (gaps > 0) chips.push(`🧱 护墙缺 ${gaps} 块`);
    }
    chips.push(`⏱️ ${Math.max(0, Math.ceil(w.limit - w.time))} 秒`);
    for (const tk of w.tanks) {
      if (tk.side !== "player") continue;
      const who = tk.player === 0 ? "🍐" : "👓";
      const shell = SHELLS[tk.shell];
      chips.push(`${who} ${shell.emoji}${shell.name} · 砖 ${tk.bricks}`);
    }
    for (const extra of opts.extraChips?.() ?? []) chips.push(extra);
    hud.innerHTML = "";
    for (const [i, text] of chips.entries()) {
      const el = document.createElement("span");
      const warn = text.includes("⚠️") || text.includes("护墙缺");
      el.className = `tkb-chip${warn ? " tkb-chip-warn" : ""}`;
      el.textContent = text;
      el.setAttribute("aria-live", i === 0 ? "polite" : "off");
      hud.appendChild(el);
    }
  }

  function inputFor(player: number): PlayerInput {
    let dir: Dir | -1 = -1;
    for (const action of ["up", "right", "down", "left"] as const) {
      if (held.has(`${player}:${action}`)) dir = ACTION_DIR[action];
    }
    return {
      dir,
      fire: held.has(`${player}:fire`) || tapped.has(`${player}:fire`),
      brick: tapped.has(`${player}:brick`),
    };
  }

  function swapShell(player: number): void {
    const tk = w.tanks.find((t) => t.side === "player" && t.player === player);
    if (!tk) return;
    tk.shell = nextShell(tk.shell);
    sfx("tap");
    refreshHud();
    const btn = shellBtns[player];
    if (btn) btn.textContent = SHELLS[tk.shell].emoji;
  }

  const shellBtns: Array<HTMLButtonElement | null> = [null, null];

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (settled < 2) {
      // 头两帧再各量一次:第一次量的时候文字还没排完,战场高度会偏
      settled += 1;
      layout();
    }
    if (last === 0) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && !finished) {
      clock += dt;
      const before = { defeated: w.defeated, bounced: w.bounced, shield: w.baseShield };
      stepWorld(w, dt, [inputFor(0), inputFor(1)]);
      tapped.clear();
      if (w.defeated > before.defeated) sfx("coin");
      if (w.bounced > before.bounced) {
        sfx("oops");
        if (!reduced) shake = 0.22;
      }
      if (before.shield && !w.baseShield) sfx("oops");
      if (w.status !== "playing") {
        finished = true;
        timers.push(window.setTimeout(() => opts.onEnd(w), 260));
      } else if (opts.onWaveClear && w.queue.length === 0 && aliveEnemies(w).length === 0) {
        opts.onWaveClear(w);
      }
      refreshHud();
    }
    shake = Math.max(0, shake - dt);
    const c = canvas.getContext("2d");
    if (c) {
      const dx = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
      const dy = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
      c.save();
      c.translate(dx, dy);
      drawWorld(c, w, cell, clock, !paused);
      c.restore();
    }
    if (miniOpen) {
      const mc = miniCv.getContext("2d");
      if (mc) drawMinimap(mc, w, Math.max(52, Math.round(MAP_W * cell * 0.28)));
    }
  }

  // ---- 键盘 ---------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === PAUSE_KEY) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const swap = SHELL_KEY_MAP[e.code];
    if (swap !== undefined) {
      if (swap >= opts.players) return;
      e.preventDefault();
      swapShell(swap);
      return;
    }
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    if (bind.player >= opts.players) return;
    e.preventDefault();
    if (bind.action === "brick") {
      tapped.add(`${bind.player}:brick`);
      sfx("tap");
      return;
    }
    if (bind.action === "fire" && !held.has(`${bind.player}:fire`)) sfx("pop");
    held.add(`${bind.player}:${bind.action}`);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    held.delete(`${bind.player}:${bind.action}`);
  }

  function onBlur(): void {
    held.clear();
  }

  // ---- 摇杆(和键盘完全等价) ----------------------------------------------
  function bindHold(btn: HTMLButtonElement, key: string): void {
    const on = (e: Event): void => {
      e.preventDefault();
      held.add(key);
    };
    const off = (): void => {
      held.delete(key);
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        held.add(key);
      }
    });
    btn.addEventListener("keyup", off);
    btn.addEventListener("blur", off);
  }

  function dirWord(a: string): string {
    return a === "up" ? "上" : a === "down" ? "下" : a === "left" ? "左" : "右";
  }

  function makePad(player: 0 | 1): HTMLElement {
    const box = document.createElement("div");
    box.className = "tkb-pad";
    const name = document.createElement("div");
    name.className = "tkb-pad-t";
    name.style.color = P_COLOR[player];
    name.textContent = `${player === 0 ? "🍐" : "👓"} ${P_NAME[player]} · ${P_KEYS[player]}`;

    const sticks = document.createElement("div");
    sticks.className = "tkb-sticks";
    // 摇杆:上面一颗、下面三颗,一共两排,横着只占三格,双人也塞得进 360px
    const grid = document.createElement("div");
    grid.className = "tkb-dpad";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "tkb-key tkb-dpad-up";
    up.textContent = "▲";
    up.setAttribute("aria-label", `${P_NAME[player]}向上开`);
    bindHold(up, `${player}:up`);
    grid.appendChild(up);
    for (const action of ["left", "down", "right"] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tkb-key tkb-dpad-${action}`;
      b.textContent = action === "left" ? "◀" : action === "down" ? "▼" : "▶";
      b.setAttribute("aria-label", `${P_NAME[player]}向${dirWord(action)}开`);
      bindHold(b, `${player}:${action}`);
      grid.appendChild(b);
    }

    // 动作键单独一列,和摇杆分开摆:手指再粗也不会互相压到
    const col = document.createElement("div");
    col.className = "tkb-acts-col";
    const fireBtn = document.createElement("button");
    fireBtn.type = "button";
    fireBtn.className = "tkb-key tkb-fire";
    fireBtn.textContent = "💥";
    fireBtn.setAttribute("aria-label", `${P_NAME[player]}发射`);
    bindHold(fireBtn, `${player}:fire`);
    const shellBtn = document.createElement("button");
    shellBtn.type = "button";
    shellBtn.className = "tkb-key tkb-shell";
    shellBtn.textContent = SHELLS["plain"].emoji;
    shellBtn.setAttribute("aria-label", `${P_NAME[player]}换一种弹丸`);
    shellBtn.addEventListener("click", () => swapShell(player));
    shellBtns[player] = shellBtn;
    const brickBtn = document.createElement("button");
    brickBtn.type = "button";
    brickBtn.className = "tkb-key tkb-brick";
    brickBtn.textContent = "🧱";
    brickBtn.setAttribute("aria-label", `${P_NAME[player]}在车头前面补一块砖`);
    brickBtn.addEventListener("click", () => {
      tapped.add(`${player}:brick`);
      sfx("tap");
    });
    col.append(fireBtn, shellBtn, brickBtn);
    sticks.append(grid, col);
    box.append(name, sticks);
    return box;
  }

  for (let p = 0; p < opts.players; p++) pads.appendChild(makePad(p as 0 | 1));

  function setPaused(next: boolean): void {
    if (finished) return;
    paused = next;
    held.clear();
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    const old = board.querySelector(".tkb-over");
    old?.remove();
    if (paused) {
      const ov = document.createElement("div");
      ov.className = "tkb-over";
      ov.innerHTML = `<div class="tkb-over-t">⏸️ 先歇一会儿</div>
        <div class="tkb-over-s">按 Esc 或点「继续」回到战场。<br>鸭梨:WASD 走、F 发射、R 换弹、G 补墙。<br>康康:方向键走、L 发射、O 换弹、K 补墙。</div>`;
      board.appendChild(ov);
    }
  }

  pauseBtn.addEventListener("click", () => {
    sfx("tap");
    setPaused(!paused);
  });
  miniBtn.addEventListener("click", () => {
    miniOpen = !miniOpen;
    sfx("tap");
    refreshMini();
  });

  const onResize = (): void => layout();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);

  layout();
  refreshMini();
  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      finished = true;
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      held.clear();
      tapped.clear();
      stopSpeaking();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 188 关战役
// ---------------------------------------------------------------------------

function makePlayLevel(getPlayers: () => 1 | 2) {
  return function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const players = getPlayers();
    const lv = buildLevel(ctx.level);
    const ci = chapterIndexOf(ctx.level);
    const world = createWorld({
      rows: lv.rows,
      mode: players === 2 ? "coop" : "campaign",
      queue: lv.waves,
      limit: lv.limit,
      players,
      seed: 1000 + ctx.level,
      ...scaleForPlayers(lv, players),
    });
    let runner: Runner | null = null;
    runner = mountRun(stage, ctx.sfx, {
      world,
      players,
      hint: `${CHAPTER_NEW[ci] ?? ""} 一共 ${lv.waves.length} 辆铁皮车,守住底下的星星老巢。`,
      onEnd(res) {
        if (res.status === "win") {
          const stars = rateRun(res.time, res.limit, res.bounced);
          ctx.win(stars, winLine(stars, res.defeated, res.bounced));
        } else {
          ctx.lose(loseLine(res.reason, res.defeated));
        }
      },
    });
    return {
      destroy() {
        runner?.destroy();
        runner = null;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// 模式外壳:标题 + 回选关
// ---------------------------------------------------------------------------

interface Shell {
  box: HTMLElement;
  stage: HTMLElement;
  head: HTMLElement;
  destroy: () => void;
}

function modeShell(host: HTMLElement, title: string, back: () => void, sfx: (n: SoundName) => void): Shell {
  const box = document.createElement("div");
  box.className = "tkb-mode";
  const head = document.createElement("div");
  head.className = "tkb-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "tkb-back";
  backBtn.textContent = "← 回选关";
  backBtn.addEventListener("click", () => {
    sfx("tap");
    back();
  });
  const label = document.createElement("span");
  label.className = "tkb-chip";
  label.textContent = title;
  head.append(backBtn, label);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);
  return {
    box,
    stage,
    head,
    destroy() {
      box.remove();
    },
  };
}

/** 一排「选一个」的小按钮(选场地、选陪练强度都用它) */
function chooserRow<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  isOn: (item: T) => boolean,
  pick: (item: T) => void
): HTMLElement {
  const row = document.createElement("div");
  row.className = "tkb-acts";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tkb-act${isOn(item) ? " tkb-act-on" : ""}`;
    btn.textContent = labelOf(item);
    btn.setAttribute("aria-pressed", isOn(item) ? "true" : "false");
    btn.addEventListener("click", () => pick(item));
    row.appendChild(btn);
  }
  return row;
}

// ---------------------------------------------------------------------------
// 无尽:守老巢
// ---------------------------------------------------------------------------

const NESTS: readonly NestMap[] = [
  { id: "classic", name: "老场地", emoji: "🏚️", desc: "通路多,方便长时间周旋。", rows: endlessRows() },
  FROST_NEST_MAP,
];

/**
 * 换场地 / 再来一轮都是「拆掉这一局、原地开下一局」。
 * 上层拿着的永远是这个壳,里头换过几茬它不知道也不用知道 ——
 * 少了这一层,换一次场地就会漏一整局在 DOM 里没人收。
 */
function mountEndless(host: HTMLElement, api: GameApi, back: () => void, nestId = NESTS[0].id): { destroy: () => void } {
  let live: { destroy: () => void } | null = null;
  const open = (id: string): void => {
    const old = live;
    live = null;
    old?.destroy();
    live = buildEndless(host, api, back, id, open);
  };
  open(nestId);
  return {
    destroy() {
      const old = live;
      live = null;
      old?.destroy();
    },
  };
}

function buildEndless(
  host: HTMLElement,
  api: GameApi,
  back: () => void,
  nestId: string,
  open: (id: string) => void
): { destroy: () => void } {
  const nest = NESTS.find((n) => n.id === nestId) ?? NESTS[0];
  const shell = modeShell(host, `♾️ 无尽守老巢 · ${nest.emoji}${nest.name}`, back, (n) => api.play(n));

  let runner: Runner | null = null;
  let over = false;

  const picker = chooserRow(
    NESTS,
    (n) => `${n.emoji} ${n.name}`,
    (n) => n.id === nest.id,
    (n) => {
      if (n.id === nest.id) return;
      api.play("tap");
      open(n.id);
    }
  );
  shell.box.insertBefore(picker, shell.stage);

  const rand = mulberry32(Date.now() % 100000);
  const world = createWorld({
    rows: [...nest.rows],
    mode: "endless",
    queue: endlessWave(1, rand),
    maxAlive: endlessMaxAlive(1),
    limit: 99999,
    players: 2,
    bricks: 6,
  });
  world.wave = 1;

  function finish(res: World): void {
    if (over) return;
    over = true;
    const best = save.recordEndlessBest(meta.id, res.wave);
    runner?.destroy();
    runner = null;
    const ov = document.createElement("div");
    ov.className = "tkb-mode";
    const line = `第 ${res.wave} 波结束。这一轮清掉 ${res.defeated} 辆铁皮车,拿到 ${res.score} 分。历史最好成绩:第 ${best} 波。`;
    ov.innerHTML = `<div class="tkb-over-t">🌼 第 ${res.wave} 波结束</div>
      <div class="tkb-over-s">这一轮清掉 ${res.defeated} 辆铁皮车,拿到 ${res.score} 分。<br>
      历史最好成绩:第 ${best} 波。下次记得先补护墙再出门。</div>`;
    speak(line);
    const again = document.createElement("button");
    again.type = "button";
    again.className = "tkb-open";
    again.textContent = "🔁 再来一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      open(nest.id);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "tkb-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "tkb-acts";
    row.append(again, home);
    ov.appendChild(row);
    shell.stage.appendChild(ov);
  }

  runner = mountRun(shell.stage, (n) => api.play(n), {
    world,
    players: 2,
    hint: "老巢被砸中这一轮就结束。两个人分头守,别都挤在一边;冰面上记得提前松手。",
    extraChips: () => [`🌊 第 ${world.wave} 波`, `🏅 ${world.score} 分`],
    onEnd: finish,
    onWaveClear(res) {
      res.wave += 1;
      res.queue = endlessWave(res.wave, rand);
      res.maxAlive = endlessMaxAlive(res.wave);
      res.spawnTimer = 1.2;
      api.play("win");
      for (const tk of res.tanks) {
        if (tk.side === "player") tk.bricks += 1;
      }
    },
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      stopSpeaking();
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战(一个人来的时候可以叫电脑陪练)
// ---------------------------------------------------------------------------

interface VersusSetup {
  arena: ArenaMap;
  /** null = 两个人对着打 */
  ai: AiTier | null;
}

let lastVersus: VersusSetup = { arena: ARENAS[0], ai: null };

/** 和无尽同一套壳:换场地 / 换陪练 / 再来一局都是原地换一茬,外面拿到的句柄不变 */
function mountVersus(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  let live: { destroy: () => void } | null = null;
  const open = (next: Partial<VersusSetup>): void => {
    lastVersus = { ...lastVersus, ...next };
    const old = live;
    live = null;
    old?.destroy();
    live = buildVersus(host, api, back, open);
  };
  open({});
  return {
    destroy() {
      const old = live;
      live = null;
      old?.destroy();
    },
  };
}

function buildVersus(
  host: HTMLElement,
  api: GameApi,
  back: () => void,
  open: (next: Partial<VersusSetup>) => void
): { destroy: () => void } {
  const setup: VersusSetup = { ...lastVersus };
  const shell = modeShell(host, "⚔️ 双人对战 · 先把对手打散 3 次", back, (n) => api.play(n));

  let runner: Runner | null = null;
  let over = false;

  function restart(next: Partial<VersusSetup>): void {
    api.play("tap");
    open(next);
  }

  const arenaRow = chooserRow(
    ARENAS,
    (a) => `${a.emoji} ${a.name}`,
    (a) => a.id === setup.arena.id,
    (a) => {
      if (a.id !== setup.arena.id) restart({ arena: a });
    }
  );
  const aiRow = chooserRow<AiTier | null>(
    [null, ...AI_TIERS],
    (t) => (t === null ? "👫 两个人" : `${TIER_SPECS[t].emoji} 陪练·${TIER_SPECS[t].name}`),
    (t) => t === setup.ai,
    (t) => {
      if (t !== setup.ai) restart({ ai: t });
    }
  );
  shell.box.insertBefore(arenaRow, shell.stage);
  shell.box.insertBefore(aiRow, shell.stage);

  const world = createWorld({
    rows: [...setup.arena.rows],
    mode: "versus",
    players: 2,
    limit: 120,
    target: 3,
    bricks: 5,
    aiTiers: [null, setup.ai],
  });

  function finish(res: World): void {
    if (over) return;
    over = true;
    runner?.destroy();
    runner = null;
    const who = res.winner < 0 ? "两个人打成平手" : `${P_NAME[res.winner]}赢啦`;
    const ov = document.createElement("div");
    ov.className = "tkb-mode";
    ov.innerHTML = `<div class="tkb-over-t">🎉 ${who}</div>
      <div class="tkb-over-s">鸭梨 ${res.scores[0]} : ${res.scores[1]} 康康。<br>
      被打散不疼,零件捡起来就好。下一局换张场地、换个包抄方向试试。</div>`;
    speak(`${who}。鸭梨 ${res.scores[0]} 比 ${res.scores[1]} 康康。`);
    const again = document.createElement("button");
    again.type = "button";
    again.className = "tkb-open tkb-open-vs";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => restart({}));
    const home = document.createElement("button");
    home.type = "button";
    home.className = "tkb-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "tkb-acts";
    row.append(again, home);
    ov.appendChild(row);
    shell.stage.appendChild(ov);
  }

  runner = mountRun(shell.stage, (n) => api.play(n), {
    world,
    // 陪练上场时只留一套摇杆:另一台车是电脑在开
    players: setup.ai ? 1 : 2,
    hint: setup.ai
      ? `${setup.arena.desc} 电脑陪练:${TIER_SPECS[setup.ai].desc}`
      : `${setup.arena.desc} 地图是对称的,谁都不吃亏。`,
    onEnd: finish,
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      stopSpeaking();
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:模式条 + 188 关地图 + 直达第 N 关
// ---------------------------------------------------------------------------

export interface TankBattleHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

/** 地址栏上的 `?level=N`(壳层没给 `initialLevel` 时的兜底) */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function mount(api: GameApi): TankBattleHandle {
  const root = document.createElement("div");
  root.className = "tkb-root";
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "tkb-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let players: 1 | 2 = 1;
  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "tkb-open";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "tkb-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "tkb-open tkb-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  bar.append(coopBtn, endlessBtn, vsBtn);

  function refreshBar(): void {
    coopBtn.textContent = players === 2 ? "👫 双人合作:开(点我关)" : "👤 单人闯关(点我拉康康一起)";
    coopBtn.setAttribute("aria-pressed", players === 2 ? "true" : "false");
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽守老巢 · 最好 第 ${best} 波` : "♾️ 无尽守老巢 · 点我开始!";
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
    closeDirect(false);
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  function closeDirect(showMap: boolean): void {
    direct?.destroy();
    direct = null;
    if (showMap) {
      modeHost.hidden = true;
      levelHost.hidden = false;
      bar.hidden = false;
      refreshBar();
    }
  }

  /**
   * 直达第 N 关:188 关框架只吐一个 `destroy`,没有「从第 N 关开始」的口子,
   * 所以自己开一条通道——星级照样存在框架那套 key 上,也回得去选关地图。
   */
  function openDirectLevel(index: number): void {
    const i = clamp(Math.round(index), 0, TOTAL_LEVELS - 1);
    closeDirect(false);
    mode?.destroy();
    mode = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;

    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    const shell = modeShell(modeHost, `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`, () => closeDirect(true), (n) =>
      api.play(n)
    );
    let handle: PlayHandle | undefined;
    let settled = false;

    // 跳关走平台那道家长门:壳层没注册 requestSkip 就干脆不挂按钮(单测环境保持干净)。
    // 放行 = 本关记 0 星、解锁下一关,战役星数一颗不送。
    const request = getLevelExtras().requestSkip;
    if (request && i < TOTAL_LEVELS - 1) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "tkb-act";
      skipBtn.textContent = `⏭️ 跳过 第 ${i + 1} 关`;
      let asking = false;
      skipBtn.addEventListener("click", () => {
        if (asking || settled) return;
        asking = true;
        skipBtn.disabled = true;
        api.play("tap");
        void Promise.resolve(request(meta.id, i))
          .then((ok) => {
            if (!ok) return;
            settled = true;
            markSkipped(meta.id, i);
            openDirectLevel(i + 1);
          })
          .finally(() => {
            asking = false;
            skipBtn.disabled = false;
          });
      });
      shell.head.appendChild(skipBtn);
    }

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      const over = document.createElement("div");
      over.className = "tkb-mode";
      over.innerHTML = `<div class="tkb-over-t">${title}</div><div class="tkb-over-s">${msg}</div>`;
      const row = document.createElement("div");
      row.className = "tkb-acts";
      for (const b of buttons) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tkb-act";
        btn.textContent = b.label;
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        row.appendChild(btn);
      }
      over.appendChild(row);
      shell.stage.appendChild(over);
    }

    const ctx: PlayCtx = {
      level: i,
      chapter: ch,
      chapterIndex: ci,
      indexInChapter: i - chapterStart(CHAPTERS, ci),
      win: (stars, msg) => {
        if (settled) return;
        settled = true;
        const prev = loadStars(meta.id)[i] ?? 0;
        saveStar(meta.id, i, stars);
        if (stars > prev) api.addStars(stars - prev);
        api.play("win");
        const buttons: Array<{ label: string; go: () => void }> = [];
        if (i + 1 < TOTAL_LEVELS) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeDirect(true) });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "守得漂亮!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        settle("💪 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 选关地图", go: () => closeDirect(true) },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = makePlayLevel(() => players)(shell.stage, ctx);
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        shell.destroy();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = clamp(Math.round(n) - 1, 0, TOTAL_LEVELS - 1);
    openDirectLevel(i);
    return i + 1;
  }

  coopBtn.addEventListener("click", () => {
    api.play("tap");
    players = players === 2 ? 1 : 2;
    refreshBar();
  });
  endlessBtn.addEventListener("click", () => openMode((h, a, b) => mountEndless(h, a, b)));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = makePlayLevel(() => players)(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            if (!mode && !direct) bar.hidden = false;
          },
        };
      },
      mapHint: "先补上老巢周围的砖再出门;钢板要换彩纸穿甲弹才拆得动,弹力球能拐弯。",
      grandMessage: "188 关全部守住,星星老巢一次都没被砸中,你就是铁皮战场的总指挥!",
      guide,
      guideTitle: "铁皮坦克大战 · 阵地手记",
    }
  );

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      mode?.destroy();
      mode = null;
      direct?.destroy();
      direct = null;
      level.destroy();
      stopSpeaking();
      root.remove();
    },
  };
}

/** 给首页玩法说明用:这一款到底有哪几种玩法 */
export const MODE_LABELS: readonly string[] = ["188 关战役", "双人合作", "双人对战", "无尽守老巢"];

/** 三种弹丸的一句话说明,攻略与图鉴都用它 */
export const SHELL_LEGEND: readonly string[] = SHELL_ORDER.map(
  (k: ShellKind) => `${SHELLS[k].emoji} ${SHELLS[k].name}:${SHELLS[k].desc}`
);

/** 评一评无尽成绩(波次越高越好),给结算面板用 */
export function rateEndless(wave: number): 1 | 2 | 3 {
  return rateBelow(-wave, -8, -4);
}
