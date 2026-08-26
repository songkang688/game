import { meta } from "./meta";
export { meta };

import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import GUIDE from "./guide";
import { CHAPTERS, endlessLayer, levelAt, type EndlessLayer } from "./levels";
import {
  EMPTY_RETRACT,
  EXTEND_SPEED,
  FIELD_H,
  FIELD_W,
  ORES,
  PIVOT_X,
  PIVOT_Y,
  SHOP,
  SHOP_KINDS,
  WALL,
  buyItem,
  canBuy,
  emptyWallet,
  haulValue,
  hookAngle,
  hookTip,
  hookedOre,
  loseLine,
  oreX,
  ownedOf,
  retractSpeed,
  ropeExhausted,
  shopPrice,
  starsForCoins,
  useBomb,
  winLine,
  type MineField,
  type Ore,
  type ShopKind,
  type Wallet,
} from "./logic";
import {
  PARALLAX,
  applySupply,
  createTwin,
  extendRamp,
  grabHitch,
  isSupplyDepth,
  lightRadius,
  makeHookRng,
  muddySlips,
  parallaxOffset,
  priceAt,
  supplyChoices,
  twinGrab,
  type SupplyOption,
  type TwinState,
} from "./depth12";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩矿洞
// ---------------------------------------------------------------------------

interface Palette {
  /** 洞顶的天光 */
  sky0: string;
  /** 洞底的暗处(仍旧是浅色,不要大片深色压着眼睛) */
  sky1: string;
  /** 两侧石壁 */
  wall: string;
  /** 石壁上的矿脉纹路 */
  vein: string;
  /** 地面草皮 */
  ground: string;
  groundDark: string;
}

const PALETTES: Palette[] = [
  { sky0: "#FFF6E6", sky1: "#F6DEC2", wall: "#E4C9A6", vein: "#CBA97F", ground: "#BFE3A6", groundDark: "#93C97A" },
  { sky0: "#EFFAFC", sky1: "#CFE9F2", wall: "#B9DCE8", vein: "#93C4D6", ground: "#A9DFD6", groundDark: "#7BC4B8" },
  { sky0: "#EEF4FE", sky1: "#CBDDF6", wall: "#B4CCEC", vein: "#8FAFDD", ground: "#A8CBEF", groundDark: "#7BA8D9" },
  { sky0: "#FFF1E8", sky1: "#FBD8C4", wall: "#F0C3A8", vein: "#DA9E7C", ground: "#F5B896", groundDark: "#DD9268" },
  { sky0: "#F2FBFC", sky1: "#D8EFF4", wall: "#C6E5EC", vein: "#9FCDD9", ground: "#CFEAF2", groundDark: "#A3D2E0" },
  { sky0: "#F7F1FE", sky1: "#E1D3F6", wall: "#D4C2EE", vein: "#B198DD", ground: "#CDB9EE", groundDark: "#A98FD7" },
  { sky0: "#F4F8FF", sky1: "#DCE7FB", wall: "#CEDDF7", vein: "#A8C0E9", ground: "#D5E6FF", groundDark: "#AFC8EC" },
  { sky0: "#F1EFFB", sky1: "#D6D1EE", wall: "#C7C0E6", vein: "#A096D2", ground: "#BFB6E4", groundDark: "#978CCB" },
];

/** 朵朵 / 星星:一粉一蓝,两个人轮流转绞盘 */
const CREW = [
  { name: "朵朵", body: "#FF9EC4", dark: "#E2749F", helmet: "#FFD166", face: "#FFE7D6" },
  { name: "星星", body: "#8FBEF5", dark: "#6693CE", helmet: "#9AD07C", face: "#FFE7D6" },
];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.gh-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.gh-run{display:flex;flex-direction:column;gap:6px;}
.gh-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;}
.gh-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#7A5A2E;
  box-shadow:0 2px 6px rgba(170,140,90,.24);white-space:nowrap;}
.gh-chip-goal{background:#FFF0D4;color:#9A6A16;}
.gh-chip-bag{background:#F1EAFB;color:#6B4E9A;}
.gh-bar{position:relative;flex:1;min-width:96px;height:18px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(160,130,90,.3);}
.gh-bar-fill{height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#FFD98A,#FF9E5E);
  transition:width .2s linear;}
.gh-bar-fill.gh-low{background:linear-gradient(90deg,#FFB3A7,#F0776A);}
.gh-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:#6E4A18;}
.gh-box{position:relative;display:flex;justify-content:center;}
.gh-cv{display:block;border-radius:16px;box-shadow:0 4px 12px rgba(150,120,80,.26);max-width:100%;
  touch-action:manipulation;cursor:pointer;}
.gh-ctrl{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.gh-btn{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe6;color:#7A5A2E;box-shadow:0 3px 0 rgba(170,140,90,.34);white-space:nowrap;}
.gh-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,140,90,.34);}
.gh-btn[disabled]{opacity:.45;cursor:default;}
.gh-btn-fire{background:linear-gradient(180deg,#FFC96B,#EEA23A);color:#fff;box-shadow:0 4px 0 #C67F22;
  padding:10px 26px;font-size:17px;}
.gh-btn-bomb{background:linear-gradient(180deg,#FFA9A0,#EE7A6E);color:#fff;box-shadow:0 4px 0 #C75648;}
.gh-btn-shop{background:linear-gradient(180deg,#B8A2EA,#9077D2);color:#fff;box-shadow:0 4px 0 #6F58AB;}
.gh-tip{text-align:center;font-size:12px;font-weight:700;color:#8A6C42;line-height:1.5;margin:0;}
.gh-toast{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#7A5A2E;box-shadow:0 3px 8px rgba(160,130,90,.32);
  pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:92%;text-align:center;}
.gh-toast.gh-on{opacity:1;}
/* 首尾的 auto 外边距代替 justify-content:center:内容装得下时照样居中,
   装不下时 auto 收成 0,从顶上开始往下排,标题不会被剪掉,滚动条也够得着 */
.gh-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  gap:10px;text-align:center;padding:16px;background:rgba(255,251,244,.95);border-radius:16px;overflow:auto;}
.gh-veil>:first-child{margin-top:auto;}
.gh-veil>:last-child{margin-bottom:auto;}
.gh-veil[hidden]{display:none;}
.gh-veil-title{font-size:19px;font-weight:900;color:#8A5A22;}
.gh-veil-sub{font-size:14px;font-weight:700;color:#7A6242;line-height:1.6;max-width:320px;}
.gh-shoplist{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;}
.gh-shopitem{display:flex;align-items:center;gap:8px;background:#fff;border-radius:16px;padding:8px 10px;
  box-shadow:0 3px 8px rgba(170,140,90,.22);text-align:left;}
.gh-shopemoji{font-size:24px;line-height:1;}
.gh-shoptext{flex:1;min-width:0;}
.gh-shopname{font-size:14px;font-weight:900;color:#7A5A2E;}
.gh-shopdesc{font-size:11px;font-weight:700;color:#93795A;line-height:1.4;}
.gh-buy{border:none;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#FFC96B,#EEA23A);color:#fff;box-shadow:0 3px 0 #C67F22;
  white-space:nowrap;}
.gh-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #C67F22;}
.gh-buy[disabled]{opacity:.42;cursor:default;}
.gh-modes{display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 10px;}
.gh-modes-title{font-size:19px;font-weight:900;color:#8A5A22;text-align:center;}
.gh-modes-sub{font-size:13px;font-weight:700;color:#8A6C42;text-align:center;line-height:1.6;max-width:340px;}
.gh-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.gh-card{border:none;border-radius:20px;padding:14px 16px;min-width:150px;max-width:220px;cursor:pointer;
  font-family:inherit;background:#fff;box-shadow:0 5px 0 rgba(170,140,90,.28);text-align:center;}
.gh-card:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(170,140,90,.28);}
.gh-card-emoji{font-size:30px;line-height:1.2;}
.gh-card-name{font-size:16px;font-weight:900;color:#7A5A2E;}
.gh-card-sub{margin-top:4px;font-size:12px;font-weight:700;color:#93795A;line-height:1.5;}
.gh-topbar{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.gh-topbar[hidden]{display:none;}
.gh-topbar-title{flex:1;text-align:center;font-size:14px;font-weight:900;color:#7A5A2E;}
.gh-btn:focus-visible,.gh-buy:focus-visible,.gh-card:focus-visible,.gh-cv:focus-visible{
  outline:3px solid #6B4A16;outline-offset:3px;}
@media (max-width:420px){
  .gh-chip{font-size:12px;padding:3px 8px;}
  .gh-btn{padding:8px 12px;font-size:14px;}
  .gh-btn-fire{padding:9px 20px;font-size:16px;}
  .gh-tip{font-size:11px;}
  /* 商店那三行在窄屏上得瘦一圈,不然浮层比画面还高,得滚动才看得全 */
  .gh-veil{padding:10px;gap:7px;}
  .gh-veil-title{font-size:17px;}
  .gh-veil-sub{font-size:12px;line-height:1.5;}
  .gh-shoplist{gap:6px;}
  .gh-shopitem{padding:6px 8px;border-radius:13px;}
  .gh-shopemoji{font-size:20px;}
  .gh-shopname{font-size:13px;}
  .gh-shopdesc{font-size:10px;}
  .gh-buy{padding:6px 10px;font-size:12px;}
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  return b;
}

// ---------------------------------------------------------------------------
// 一趟矿洞:闯关和无尽共用同一套画面与操作
// ---------------------------------------------------------------------------

interface RunResult {
  /** 收工时钱包里剩多少(买过东西就是扣完的净额) */
  coins: number;
  /** 这一趟净赚多少(= coins - 开局本金) */
  gained: number;
  wallet: Wallet;
  /** 矿洞是不是被掏空了 */
  cleared: boolean;
  timeLeft: number;
}

interface RunOpts {
  field: MineField;
  /** 目标 / 配额(只用来显示与判定,不影响玩法) */
  goal: number;
  /** 开局钱包(无尽模式会把上一层的道具带下来) */
  wallet: Wallet;
  palette: Palette;
  hint: string;
  sfx: (name: SoundName) => void;
  onFinish: (r: RunResult) => void;
  /** 无尽模式传当前层深:越深照明圈越小(有下限)。闯关不传,不画照明圈 */
  depth?: number;
  /** 关内商店的价钱按第几章算(无尽按层深折算) */
  priceChapter?: number;
}

function runField(host: HTMLElement, o: RunOpts): { destroy: () => void } {
  const pal = o.palette;
  const ores: Ore[] = o.field.ores.map((x) => ({ ...x }));
  const startCoins = o.wallet.coins;
  let wallet: Wallet = { ...o.wallet };

  let phase: "swing" | "out" | "back" | "done" = "swing";
  /** 摆动自己的钟:绳子放出去以后就不走了,收回来接着从原角度摆 */
  let swingClock = 0;
  /** 世界时钟:地鼠靠它左右跑,暂停时不走 */
  let worldClock = 0;
  let timeLeft = o.field.time;
  let ropeLen = 24;
  let fireAngle = 0;
  let carrying: Ore | null = null;
  let paused = false;
  let raf = 0;
  let last = 0;
  let toastLeft = 0;
  let shake = 0;
  /** 放绳到现在多少秒:下钩是加速起步的,不是一按就满速 */
  let extendT = 0;
  /** 抓到那一下的顿感倒计时 */
  let hitch = 0;
  /** 泥泥矿打滑用的随机数,按矿洞种子起,重玩同一关手感一致 */
  const slipRng = makeHookRng(Math.round(o.field.phase * 1000 + o.field.time * 7 + o.goal));
  /** 被炸药固定过的泥泥矿 id */
  const pinned = new Set<number>();
  /** 双层晶剥壳进度：ore.id → 还剩几层 */
  const twin = new Map<number, TwinState>();

  const wrap = el("div", "gh-run");
  const hud = el("div", "gh-hud");
  const coinChip = el("span", "gh-chip");
  const goalChip = el("span", "gh-chip gh-chip-goal");
  const bar = el("div", "gh-bar");
  const barFill = el("div", "gh-bar-fill");
  const barTxt = el("span", "gh-bar-txt");
  bar.append(barFill, barTxt);
  const bagChip = el("span", "gh-chip gh-chip-bag");
  hud.append(coinChip, goalChip, bar, bagChip);

  const box = el("div", "gh-box");
  const canvas = el("canvas", "gh-cv");
  canvas.width = FIELD_W * 2;
  canvas.height = FIELD_H * 2;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "button");
  canvas.setAttribute("aria-label", "矿洞画面,点一下放绳");
  const toast = el("div", "gh-toast");
  const veil = el("div", "gh-veil");
  veil.hidden = true;
  box.append(canvas, toast, veil);

  const ctrl = el("div", "gh-ctrl");
  const fireBtn = button("gh-btn gh-btn-fire", "⬇️ 放绳");
  const bombBtn = button("gh-btn gh-btn-bomb", "💥 炸药");
  const shopBtn = button("gh-btn gh-btn-shop", "🛒 商店");
  const pauseBtn = button("gh-btn", "⏸️ 暂停");
  const doneBtn = button("gh-btn", "✅ 收工");
  doneBtn.hidden = true;
  ctrl.append(fireBtn, bombBtn, shopBtn, doneBtn, pauseBtn);

  const tip = el("p", "gh-tip", o.hint);
  wrap.append(hud, box, ctrl, tip);
  host.appendChild(wrap);

  const c2d = canvas.getContext("2d");
  c2d?.setTransform(2, 0, 0, 2, 0, 0);

  // ------------------------------------------------------------------
  // 版面:按剩下的空间算画布多大,375×667 和 1280×800 都得一屏放下
  // ------------------------------------------------------------------

  /**
   * 画面到底能画到多低。
   *
   * 外壳(`.game-screen` / `.game-stage`)是不滚动的,超出去的部分直接看不见,
   * 所以拦住我们的往往不是窗口下沿,而是上面某一层 overflow 不为 visible 的容器。
   * 挨个往上问一遍,取最靠上的那条线。
   */
  function limitBottom(): number {
    let limit = window.innerHeight || 640;
    for (let node = wrap.parentElement; node; node = node.parentElement) {
      const style = window.getComputedStyle?.(node);
      if (style && style.overflowY !== "visible") {
        limit = Math.min(limit, node.getBoundingClientRect().bottom);
      }
    }
    return limit;
  }

  function relayout(): void {
    const top = box.getBoundingClientRect().top;
    // 按钮行和提示行是写死在画面下面的,先把它们的高度让出来,再留 10px 呼吸
    const below = ctrl.offsetHeight + tip.offsetHeight + 22;
    const availH = Math.max(170, limitBottom() - top - below);
    // 上限 520:画布后备位图是 800×944,放到 520 还在缩小,不会糊
    const availW = Math.max(150, Math.min(wrap.clientWidth || 320, 520));
    const w = Math.min(availW, (availH * FIELD_W) / FIELD_H);
    canvas.style.width = `${Math.round(w)}px`;
    canvas.style.height = `${Math.round((w * FIELD_H) / FIELD_W)}px`;
  }

  const onResize = (): void => relayout();
  window.addEventListener("resize", onResize);

  // ------------------------------------------------------------------
  // 画面
  // ------------------------------------------------------------------

  function drawCrew(c: CanvasRenderingContext2D, x: number, y: number, who: 0 | 1): void {
    const k = CREW[who];
    c.fillStyle = k.body;
    c.beginPath();
    c.roundRect(x - 9, y - 2, 18, 22, 8);
    c.fill();
    c.fillStyle = k.face;
    c.beginPath();
    c.arc(x, y - 8, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = k.helmet;
    c.beginPath();
    c.arc(x, y - 10, 9.5, Math.PI, 0);
    c.fill();
    c.fillRect(x - 12, y - 11, 24, 3);
    c.fillStyle = "#5A3350";
    c.beginPath();
    c.arc(x - 3.2, y - 6, 1.5, 0, Math.PI * 2);
    c.arc(x + 3.2, y - 6, 1.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#C9736F";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(x, y - 4, 3.2, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
    c.fillStyle = k.dark;
    c.font = "bold 9px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(k.name, x, y + 30);
  }

  /**
   * 矿石的皮肤。
   *
   * 全都手画成矢量而不是直接甩 emoji:矿洞底色是浅米黄,emoji 在上面又小又糊,
   * 而且换个设备字体一变就认不出来了。自己画能保证「金的是暖黄、石头是冷灰」这条
   * 最要紧的分辨线一直在。
   */
  const ORE_SKIN: Record<Ore["kind"], { fill: string; lit: string; edge: string }> = {
    nugget: { fill: "#FFD264", lit: "#FFF0BC", edge: "#CF9A20" },
    goldSmall: { fill: "#FFC441", lit: "#FFE79A", edge: "#C1880F" },
    goldBig: { fill: "#FFB22C", lit: "#FFDD8C", edge: "#AE7305" },
    goldHuge: { fill: "#FF9F14", lit: "#FFD07A", edge: "#9C6100" },
    pebble: { fill: "#C6BFB4", lit: "#E6E1D9", edge: "#8F887E" },
    boulder: { fill: "#A9A299", lit: "#CFC9C1", edge: "#77716A" },
    gem: { fill: "#7DDDF0", lit: "#D6F7FF", edge: "#2F97AF" },
    chest: { fill: "#C98C58", lit: "#E7B98C", edge: "#8A5A31" },
    mole: { fill: "#D8A87A", lit: "#F0CFAC", edge: "#A57A4E" },
    // 1.2 新矿:泥泥矿一眼看出「裹着泥」,双层晶用冷紫和钻石区分开
    muddy: { fill: "#A8794F", lit: "#D0A87C", edge: "#6E4A28" },
    twinCrystal: { fill: "#9FA8F0", lit: "#DCE0FF", edge: "#5B63B8" },
  };

  /** 金块 / 石头共用的圆角块 */
  function nuggetPath(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    c.beginPath();
    c.roundRect(x - r, y - r * 0.86, r * 2, r * 1.72, r * 0.44);
  }

  function drawOre(c: CanvasRenderingContext2D, ore: Ore, x: number): void {
    const r = ore.radius;
    const y = ore.y;
    const skin = ORE_SKIN[ore.kind];
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";

    // 影子:让矿石从背景里浮起来一点
    c.fillStyle = "rgba(120,95,60,.18)";
    c.beginPath();
    c.ellipse(x, y + r * 0.92, r * 0.86, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = skin.fill;
    c.strokeStyle = skin.edge;
    c.lineWidth = 1.6;

    if (ore.kind === "gem") {
      c.beginPath();
      c.moveTo(x, y - r);
      c.lineTo(x + r * 0.92, y - r * 0.16);
      c.lineTo(x, y + r);
      c.lineTo(x - r * 0.92, y - r * 0.16);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,.85)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x - r * 0.92, y - r * 0.16);
      c.lineTo(x + r * 0.92, y - r * 0.16);
      c.moveTo(x - r * 0.42, y - r * 0.16);
      c.lineTo(x, y - r);
      c.lineTo(x + r * 0.42, y - r * 0.16);
      c.stroke();
    } else if (ore.kind === "chest") {
      c.beginPath();
      c.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.26);
      c.fill();
      c.stroke();
      c.fillStyle = skin.lit;
      c.beginPath();
      c.roundRect(x - r, y - r * 0.8, r * 2, r * 0.62, r * 0.26);
      c.fill();
      c.fillStyle = "#F4C64A";
      c.fillRect(x - r * 0.2, y - r * 0.8, r * 0.4, r * 1.6);
      c.beginPath();
      c.arc(x, y - r * 0.06, r * 0.26, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = skin.edge;
      c.lineWidth = 1.2;
      c.stroke();
    } else if (ore.kind === "mole") {
      // 两只耳朵先画,才会被脑袋压住一半
      c.beginPath();
      c.arc(x - r * 0.66, y - r * 0.66, r * 0.36, 0, Math.PI * 2);
      c.arc(x + r * 0.66, y - r * 0.66, r * 0.36, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(x, y, r * 0.92, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = skin.lit;
      c.beginPath();
      c.ellipse(x, y + r * 0.3, r * 0.5, r * 0.36, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5A3F2A";
      c.beginPath();
      c.arc(x - r * 0.34, y - r * 0.14, r * 0.13, 0, Math.PI * 2);
      c.arc(x + r * 0.34, y - r * 0.14, r * 0.13, 0, Math.PI * 2);
      c.arc(x, y + r * 0.16, r * 0.16, 0, Math.PI * 2);
      c.fill();
    } else {
      nuggetPath(c, x, y, r);
      c.fill();
      c.stroke();
      // 左上角一小块高光,金子看着才有光泽;石头也留着,当作被磨亮的一面
      c.fillStyle = skin.lit;
      c.beginPath();
      c.ellipse(x - r * 0.3, y - r * 0.34, r * 0.36, r * 0.22, -0.5, 0, Math.PI * 2);
      c.fill();
      if (ore.kind === "goldHuge") {
        // 巨型金块再压一道分层的纹,免得和大金块只差个头
        c.strokeStyle = skin.edge;
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x - r * 0.72, y + r * 0.24);
        c.lineTo(x + r * 0.72, y + r * 0.24);
        c.stroke();
      }
      if (!ORES[ore.kind].treasure) {
        // 石头补两个坑,一眼看出来是不值钱的那种
        c.fillStyle = skin.edge;
        c.beginPath();
        c.arc(x + r * 0.32, y + r * 0.2, r * 0.16, 0, Math.PI * 2);
        c.arc(x - r * 0.42, y + r * 0.34, r * 0.11, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  /**
   * 矿洞纵深:近岩壁 / 中矿层 / 远洞穴三层,跟着钩子放绳的长度错位挪动。
   * **只有位移与明暗,没有透视** —— 钩子角度是这个玩法唯一要瞄的东西,一透视就瞄不准了。
   */
  function drawParallax(c: CanvasRenderingContext2D): void {
    for (let i = PARALLAX.length - 1; i >= 0; i--) {
      const spec = PARALLAX[i];
      const dy = parallaxOffset(spec.layer, ropeLen);
      c.save();
      c.globalAlpha = 0.16 + i * 0.05;
      c.fillStyle = shadeHex(pal.wall, spec.shade);
      const band = 46 + i * 26;
      for (let y = 118 - dy; y < FIELD_H; y += band * 2) {
        c.fillRect(WALL + 4 + i * 10, y, FIELD_W - WALL * 2 - 8 - i * 20, band);
      }
      c.restore();
    }
  }

  /** 把 #rrggbb 按比例调暗（远景层用） */
  function shadeHex(hex: string, k: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k);
    const g = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * 无尽越深越暗的照明圈。半径有下限（`LIGHT_MIN`），
   * 再深也要看得清顶部那行「金币 / 目标 / 剩余时间」，不许变成靠记忆玩。
   */
  function drawLight(c: CanvasRenderingContext2D): void {
    if (o.depth === undefined) return;
    const r = lightRadius(o.depth);
    const g = c.createRadialGradient(PIVOT_X, PIVOT_Y + 90, r * 0.55, PIVOT_X, PIVOT_Y + 90, r * 1.5);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(24,16,8,0.55)");
    c.fillStyle = g;
    c.fillRect(0, 96, FIELD_W, FIELD_H - 96);
  }

  function draw(): void {
    if (!c2d) return;
    const c = c2d;
    c.save();
    if (shake > 0) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    c.clearRect(-8, -8, FIELD_W + 16, FIELD_H + 16);

    const g = c.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, pal.sky0);
    g.addColorStop(1, pal.sky1);
    c.fillStyle = g;
    c.fillRect(0, 0, FIELD_W, FIELD_H);

    drawParallax(c);

    // 两侧石壁 + 几道矿脉纹路
    c.fillStyle = pal.wall;
    c.fillRect(0, 96, WALL, FIELD_H - 96);
    c.fillRect(FIELD_W - WALL, 96, WALL, FIELD_H - 96);
    c.fillStyle = pal.vein;
    for (let y = 120; y < FIELD_H - 8; y += 32) {
      c.fillRect(3, y, WALL - 8, 4);
      c.fillRect(FIELD_W - WALL + 5, y + 14, WALL - 8, 4);
    }

    // 地面与绞盘台
    c.fillStyle = pal.ground;
    c.fillRect(0, 74, FIELD_W, 26);
    c.fillStyle = pal.groundDark;
    c.fillRect(0, 96, FIELD_W, 6);
    drawCrew(c, PIVOT_X - 54, 52, 0);
    drawCrew(c, PIVOT_X + 54, 52, 1);
    c.fillStyle = "#A5825A";
    c.beginPath();
    c.roundRect(PIVOT_X - 16, 46, 32, 16, 6);
    c.fill();
    c.fillStyle = "#7C5F3E";
    c.beginPath();
    c.arc(PIVOT_X, PIVOT_Y, 6, 0, Math.PI * 2);
    c.fill();

    for (const ore of ores) drawOre(c, ore, oreX(ore, worldClock));

    // 绳子与钩子
    const angle = phase === "swing" ? hookAngle(o.field, swingClock) : fireAngle;
    const tipPt = hookTip(angle, ropeLen);
    c.strokeStyle = "#8A6B45";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(PIVOT_X, PIVOT_Y);
    c.lineTo(tipPt.x, tipPt.y);
    c.stroke();
    if (carrying) drawOre(c, carrying, tipPt.x);
    c.save();
    c.translate(tipPt.x, tipPt.y);
    c.rotate((-angle * Math.PI) / 180);
    c.strokeStyle = "#6E5334";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-7, -2);
    c.lineTo(0, 8);
    c.lineTo(7, -2);
    c.stroke();
    c.restore();

    // 瞄准辅助线:摆动时给一条淡淡的虚线,小朋友好判断这一钩会去哪
    if (phase === "swing") {
      const far = hookTip(angle, o.field.ropeMax);
      c.save();
      c.setLineDash([5, 7]);
      c.strokeStyle = "rgba(140,110,70,.28)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(tipPt.x, tipPt.y);
      c.lineTo(far.x, far.y);
      c.stroke();
      c.restore();
    }
    drawLight(c);
    c.restore();
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------

  function say(text: string): void {
    toast.textContent = text;
    toast.classList.add("gh-on");
    toastLeft = 1.6;
  }

  function refreshHud(): void {
    coinChip.textContent = `💰 ${wallet.coins}`;
    goalChip.textContent = `🎯 ${o.goal}`;
    bagChip.textContent = `💥${wallet.bombs} 💪${wallet.strength} 🍀${wallet.luck}`;
    const ratio = Math.max(0, Math.min(1, timeLeft / Math.max(1, o.field.time)));
    barFill.style.width = `${ratio * 100}%`;
    barFill.classList.toggle("gh-low", timeLeft <= 10);
    barTxt.textContent = `⏳ ${Math.ceil(Math.max(0, timeLeft))} 秒`;
    bombBtn.textContent = `💥 炸药 ×${wallet.bombs}`;
    bombBtn.disabled = wallet.bombs <= 0 || !carrying;
    fireBtn.disabled = phase !== "swing";
    doneBtn.hidden = wallet.coins < o.goal || phase === "done";
  }

  // ------------------------------------------------------------------
  // 操作
  // ------------------------------------------------------------------

  function fire(): void {
    if (paused || phase !== "swing") return;
    fireAngle = hookAngle(o.field, swingClock);
    phase = "out";
    o.sfx("jump");
    refreshHud();
  }

  function bomb(): void {
    if (paused || phase !== "back" || !carrying || wallet.bombs <= 0) return;
    wallet = useBomb(wallet);
    if (carrying.kind === "muddy") {
      // 泥泥矿不炸掉,而是把外面那层泥「砰」一下震掉,接下来这一颗再也不滑
      pinned.add(carrying.id);
      shake = 5;
      o.sfx("pop");
      say("💥 泥震掉啦!这颗泥泥矿不会再滑");
      refreshHud();
      return;
    }
    carrying = null;
    shake = 5;
    o.sfx("pop");
    say("💥 炸开了!空钩收得飞快");
    refreshHud();
  }

  function finish(): void {
    if (phase === "done") return;
    phase = "done";
    cancelAnimationFrame(raf);
    draw();
    o.onFinish({
      coins: wallet.coins,
      gained: wallet.coins - startCoins,
      wallet: { ...wallet },
      cleared: ores.length === 0,
      timeLeft: Math.max(0, timeLeft),
    });
  }

  function collect(): void {
    if (!carrying) return;

    // 双层晶:第一次钩上来只是把外壳剥了,晶芯掉回原处等你再钩一次
    if (carrying.kind === "twinCrystal") {
      const state = twin.get(carrying.id) ?? createTwin();
      const next = twinGrab(state);
      twin.set(carrying.id, next.state);
      const got = haulValue(carrying, wallet.luck);
      wallet = { ...wallet, coins: wallet.coins + got };
      o.sfx("coin");
      if (!next.taken) {
        ores.push(carrying);
        ores.sort((a, b) => a.y - b.y);
        say(`🔷 外壳裂开啦 +${got} 金币,里面的晶芯再钩一次!`);
      } else {
        say(`🔷 双层晶到手 +${got} 金币!`);
      }
      carrying = null;
      return;
    }

    const got = haulValue(carrying, wallet.luck);
    wallet = { ...wallet, coins: wallet.coins + got };
    const label = ORES[carrying.kind].label;
    if (ORES[carrying.kind].treasure) {
      o.sfx("coin");
      say(`${ORES[carrying.kind].emoji} ${label} +${got} 金币`);
    } else {
      o.sfx("oops");
      say(`${ORES[carrying.kind].emoji} ${label} 只值 ${got} 金币…`);
    }
    carrying = null;
  }

  // ------------------------------------------------------------------
  // 商店与暂停
  // ------------------------------------------------------------------

  let veilMode: "none" | "shop" | "pause" = "none";

  function closeVeil(): void {
    veilMode = "none";
    veil.hidden = true;
    veil.innerHTML = "";
    paused = false;
    last = 0;
    refreshHud();
  }

  function openShop(): void {
    if (phase === "done" || veilMode !== "none") return;
    veilMode = "shop";
    paused = true;
    veil.hidden = false;
    veil.innerHTML = "";
    veil.append(
      el("div", "gh-veil-title", "🛒 矿洞小商店"),
      el("div", "gh-veil-sub", "花的是这一趟挖到的金币,买完记得再挖回来。")
    );
    const list = el("div", "gh-shoplist");
    const rows: Array<{ kind: ShopKind; btn: HTMLButtonElement }> = [];
    for (const kind of SHOP_KINDS) {
      const entry = SHOP[kind];
      const row = el("div", "gh-shopitem");
      const text = el("div", "gh-shoptext");
      text.append(el("div", "gh-shopname", entry.label), el("div", "gh-shopdesc", entry.desc));
      const btn = button("gh-buy", "");
      btn.addEventListener("click", () => {
        const owned = ownedOf(wallet, kind);
        const price = priceAt(kind, owned, o.priceChapter ?? 0);
        if (owned >= SHOP[kind].max || wallet.coins < price) {
          o.sfx("oops");
          return;
        }
        // buyItem 按 1.1 的原价扣款,章节涨价的那一部分在这里补扣
        const before = wallet.coins;
        wallet = buyItem(wallet, kind);
        const paid = before - wallet.coins;
        wallet = { ...wallet, coins: wallet.coins - Math.max(0, price - paid) };
        o.sfx("coin");
        refreshShop();
        refreshHud();
      });
      row.append(el("div", "gh-shopemoji", entry.emoji), text, btn);
      list.appendChild(row);
      rows.push({ kind, btn });
    }
    const purse = el("div", "gh-veil-sub", "");
    const close = button("gh-btn gh-btn-fire", "接着挖 ▶");
    close.addEventListener("click", () => {
      o.sfx("tap");
      closeVeil();
    });
    veil.append(list, purse, close);

    function refreshShop(): void {
      purse.textContent = `钱包里还有 ${wallet.coins} 金币`;
      for (const { kind, btn } of rows) {
        const owned = ownedOf(wallet, kind);
        const full = owned >= SHOP[kind].max;
        const price = priceAt(kind, owned, o.priceChapter ?? 0);
        btn.textContent = full ? `已满 ${owned}` : `${price} 💰 (${owned}/${SHOP[kind].max})`;
        btn.disabled = full || wallet.coins < price;
      }
    }
    refreshShop();
  }

  function openPause(): void {
    if (phase === "done" || veilMode !== "none") return;
    veilMode = "pause";
    paused = true;
    veil.hidden = false;
    veil.innerHTML = "";
    const back = button("gh-btn gh-btn-fire", "继续挖 ▶");
    back.addEventListener("click", () => {
      o.sfx("tap");
      closeVeil();
    });
    veil.append(
      el("div", "gh-veil-title", "⏸️ 先歇一下"),
      el("div", "gh-veil-sub", "时间也跟着停了,想好再继续。"),
      back
    );
  }

  fireBtn.addEventListener("click", () => fire());
  bombBtn.addEventListener("click", () => bomb());
  shopBtn.addEventListener("click", () => {
    o.sfx("tap");
    openShop();
  });
  pauseBtn.addEventListener("click", () => {
    o.sfx("tap");
    if (veilMode === "pause") closeVeil();
    else openPause();
  });
  doneBtn.addEventListener("click", () => {
    o.sfx("tap");
    finish();
  });
  canvas.addEventListener("click", () => fire());

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" || e.key === "Esc") {
      // 一定要 preventDefault:外壳收到没被接住的 Esc 会再弹一次它自己的暂停,
      // 两层暂停叠在一起以后,下一次 Esc 只会被外壳那层吃掉,这一层就再也关不上了
      e.preventDefault();
      if (veilMode === "none") openPause();
      else closeVeil();
      return;
    }
    if (veilMode !== "none") return;
    if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      fire();
    } else if (e.key === "b" || e.key === "B") {
      bomb();
    }
  };
  window.addEventListener("keydown", onKey);

  // ------------------------------------------------------------------
  // 主循环
  // ------------------------------------------------------------------

  function step(now: number): void {
    if (phase === "done") return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    raf = requestAnimationFrame(step);
    if (paused) {
      draw();
      return;
    }

    worldClock += dt;
    shake = Math.max(0, shake - dt * 22);
    if (toastLeft > 0) {
      toastLeft -= dt;
      if (toastLeft <= 0) toast.classList.remove("gh-on");
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      refreshHud();
      finish();
      return;
    }

    // 抓到那一下的顿感:60–90ms,让「钩住了」这件事有重量
    if (hitch > 0) {
      hitch = Math.max(0, hitch - dt);
      refreshHud();
      draw();
      return;
    }

    if (phase === "swing") {
      swingClock += dt;
    } else if (phase === "out") {
      extendT += dt;
      ropeLen += EXTEND_SPEED * extendRamp(extendT) * dt;
      const tipPt = hookTip(fireAngle, ropeLen);
      const hit = hookedOre({ ...o.field, ores }, tipPt, worldClock);
      if (hit) {
        carrying = hit;
        ores.splice(ores.indexOf(hit), 1);
        phase = "back";
        shake = 3;
        hitch = grabHitch(hit.weight);
        o.sfx("tap");
      } else if (ropeExhausted(o.field, ropeLen, tipPt)) {
        phase = "back";
      }
    } else {
      // 泥泥矿在半路可能滑脱:掉回原埋点,还能再钩一次(用炸药固定过就不滑)
      if (carrying && carrying.kind === "muddy" && muddySlips(slipRng, dt, pinned.has(carrying.id))) {
        ores.push(carrying);
        ores.sort((a, b) => a.y - b.y);
        say("🟤 泥泥矿滑掉啦!先用炸药把它固定住");
        o.sfx("oops");
        carrying = null;
      }
      const speed = carrying ? retractSpeed(carrying.weight, wallet.strength) : EMPTY_RETRACT;
      ropeLen -= speed * dt;
      if (ropeLen <= 24) {
        ropeLen = 24;
        collect();
        phase = "swing";
        extendT = 0;
        if (ores.length === 0) {
          refreshHud();
          draw();
          finish();
          return;
        }
      }
    }

    refreshHud();
    draw();
  }

  relayout();
  refreshHud();
  draw();
  raf = requestAnimationFrame(step);
  // 版面要等这一帧真的排完才量得准;这一帧也得存下来,不然刚进就退会在拆掉的节点上重算
  const layoutRaf = requestAnimationFrame(() => relayout());

  return {
    destroy() {
      phase = "done";
      cancelAnimationFrame(raf);
      cancelAnimationFrame(layoutRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关:一关一个矿洞
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv = levelAt(ctx.level);
  const run = runField(stage, {
    field: lv.field,
    goal: lv.target,
    wallet: emptyWallet(lv.startCoins),
    palette: PALETTES[lv.chapter % PALETTES.length],
    hint: lv.hint,
    priceChapter: lv.chapter,
    sfx: (n) => ctx.sfx(n),
    onFinish: (r) => {
      if (r.coins >= lv.target) {
        const stars = starsForCoins(r.coins, lv.target);
        ctx.win(stars, winLine(r.coins, lv.target, stars));
      } else {
        ctx.lose(loseLine(r.coins, lv.target));
      }
    },
  });
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽矿井:一层一层往下挖
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const topbar = el("div", "gh-topbar");
  const back = button("gh-btn", "↩️ 换模式");
  const title = el("div", "gh-topbar-title", "♾️ 无尽矿井");
  topbar.append(back, title);
  const body = el("div");
  root.append(topbar, body);
  host.appendChild(root);

  let run: { destroy: () => void } | null = null;
  let depth = 1;
  let wallet: Wallet = emptyWallet(40);

  function clearBody(): void {
    run?.destroy();
    run = null;
    body.innerHTML = "";
  }

  function panel(titleText: string, subText: string, buttons: Array<{ label: string; go: () => void }>): void {
    clearBody();
    const box = el("div", "gh-modes");
    box.append(el("div", "gh-modes-title", titleText), el("div", "gh-modes-sub", subText));
    const row = el("div", "gh-cards");
    for (const b of buttons) {
      const btn = button("gh-btn gh-btn-fire", b.label);
      btn.addEventListener("click", () => {
        api.play("tap");
        b.go();
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
    body.appendChild(box);
  }

  function endRun(reason: string): void {
    const score = wallet.coins;
    const best = save.recordEndlessBest(meta.id, score);
    panel(
      depth > 1 ? `⛏️ 下潜到第 ${depth} 层` : "⛏️ 收工上井",
      `${reason}这一趟一共带回 ${score} 金币,历史最好 ${best} 金币。`,
      [
        {
          label: "🔁 再挖一趟",
          go: () => {
            depth = 1;
            wallet = emptyWallet(40);
            title.textContent = "♾️ 无尽矿井";
            startLayer();
          },
        },
        { label: "↩️ 换模式", go: onExit },
      ]
    );
  }

  /** 每 5 层一次的补给点:三选一,选完接着往下 */
  function openSupply(clearedDepth: number): void {
    const options: SupplyOption[] = supplyChoices(clearedDepth, 460001 + clearedDepth * 7717);
    panel(
      `🎁 第 ${clearedDepth} 层补给点`,
      `挖到这么深,井上给你捎了点东西下来,挑一样带着走。`,
      options.map((opt) => ({
        label: `${opt.emoji} ${opt.label}`,
        go: () => {
          wallet = applySupply(wallet, opt);
          startLayer();
        },
      }))
    );
  }

  function startLayer(): void {
    clearBody();
    const layer: EndlessLayer = endlessLayer(depth);
    title.textContent = `♾️ 第 ${depth} 层 · ${layer.name}`;
    run = runField(body, {
      field: layer.field,
      goal: wallet.coins + layer.quota,
      wallet,
      palette: PALETTES[(depth - 1) % PALETTES.length],
      hint: `挖够 ${layer.quota} 金币就能往下一层,越深的矿层给的时间越少,照明圈也越小。`,
      depth,
      priceChapter: Math.floor((depth - 1) / 2),
      sfx: (n) => api.play(n),
      onFinish: (r) => {
        wallet = r.wallet;
        if (r.gained >= layer.quota) {
          api.play("win");
          const cleared = layer.depth;
          depth += 1;
          if (isSupplyDepth(cleared)) {
            openSupply(cleared);
            return;
          }
          const next = endlessLayer(depth);
          panel(
            `✅ 第 ${cleared} 层达标!`,
            `这一层净赚 ${r.gained} 金币,钱包里现在有 ${wallet.coins} 金币。往下是第 ${depth} 层「${next.name}」,配额 ${next.quota} 金币。`,
            [
              { label: "⛏️ 继续下潜", go: startLayer },
              { label: "🧺 收工上井", go: () => endRun("见好就收!") },
            ]
          );
        } else {
          api.play("oops");
          endRun(`第 ${layer.depth} 层只挖到 ${Math.max(0, r.gained)} 金币,没够上 ${layer.quota} 的配额。`);
        }
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  const bestNow = save.getGameProgress(meta.id).endlessBest;
  panel(
    "♾️ 无尽矿井",
    bestNow > 0
      ? `一层一层往下挖,挖够配额才能继续下潜。道具和金币会一路带下去。历史最好 ${bestNow} 金币。`
      : "一层一层往下挖,挖够配额才能继续下潜。道具和金币会一路带下去,看你能到第几层。",
    [{ label: "⛏️ 开挖", go: startLayer }]
  );

  return {
    destroy() {
      clearBody();
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:开场先选模式
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div", "gh-wrap");
  const style = el("style");
  style.textContent = CSS;
  const home = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, home, modeHost);
  api.root.appendChild(root);

  let current: { destroy: () => void } | null = null;

  function showHome(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    home.hidden = false;
    home.innerHTML = "";
    const box = el("div", "gh-modes");
    box.append(
      el("div", "gh-modes-title", "⛏️ 金矿钩钩"),
      el(
        "div",
        "gh-modes-sub",
        "钩子在矿洞顶来回摆,看准角度按「放绳」。重的东西拉得慢,挖到的金币能在商店换炸药、力量水和幸运石。"
      )
    );
    const cards = el("div", "gh-cards");
    const best = save.getGameProgress(meta.id).endlessBest;

    const campaignCard = button("gh-card", "");
    campaignCard.append(
      el("div", "gh-card-emoji", "🚩"),
      el("div", "gh-card-name", "闯关矿洞"),
      el("div", "gh-card-sub", `八条矿脉共 188 关,每关一个金币目标。`)
    );
    campaignCard.addEventListener("click", () => {
      api.play("tap");
      openCampaign();
    });

    const endlessCard = button("gh-card", "");
    endlessCard.append(
      el("div", "gh-card-emoji", "♾️"),
      el("div", "gh-card-name", "无尽矿井"),
      el("div", "gh-card-sub", best > 0 ? `矿层无限下探,最好成绩 ${best} 金币。` : "矿层无限下探,看你能挖到第几层。")
    );
    endlessCard.addEventListener("click", () => {
      api.play("tap");
      home.hidden = true;
      modeHost.hidden = false;
      current = mountEndless(modeHost, api, showHome);
    });

    cards.append(campaignCard, endlessCard);
    box.appendChild(cards);
    home.appendChild(box);
  }

  function openCampaign(): void {
    home.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const topbar = el("div", "gh-topbar");
    const back = button("gh-btn", "↩️ 换模式");
    topbar.append(back, el("div", "gh-topbar-title", "🚩 闯关矿洞 · 188 关"));
    const levelHost = el("div");
    modeHost.append(topbar, levelHost);

    const level = mountLevelGame(
      { ...api, root: levelHost },
      {
        id: meta.id,
        chapters: CHAPTERS,
        // 真下到某一关里就把「换模式」收起来:窄屏上那一行的高度留给矿洞更划算
        playLevel: (stage, ctx) => {
          topbar.hidden = true;
          const handle = playLevel(stage, ctx);
          return {
            destroy() {
              handle.destroy?.();
              topbar.hidden = false;
            },
          };
        },
        mapHint: "先钩又轻又值钱的,石头能绕就绕。金币超过目标的一倍半就是三颗星!",
        grandMessage: "188 条矿脉全部挖通,朵朵和星星的矿车已经装不下啦!",
        guide: GUIDE,
        guideTitle: "钩矿小攻略",
      }
    );

    current = {
      destroy() {
        level.destroy();
        modeHost.innerHTML = "";
      },
    };

    back.addEventListener("click", () => {
      api.play("tap");
      showHome();
    });
  }

  showHome();

  return {
    destroy() {
      current?.destroy();
      current = null;
      root.remove();
    },
  };
}
