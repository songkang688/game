import { meta } from "./meta";
export { meta };

// 贪吃毛毛虫:188 关十座花园 + 无尽花园。
// 1.1 新机制:双身位(两条镜像同走)、传送星门、会移动的小刺猬、限定长度过窄门(剪刀果)。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  CHAPTERS,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  GRID,
  LEVELS,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  cellXY,
  gateOpenFor,
  gateSet,
  mirrorDir,
  moverCells,
  openingLine,
  portalMap,
  snackKind,
  spawnA,
  spawnB,
  starsFor,
  wallSet,
  winLine,
} from "./logic";
import {
  type Dir,
  type EndlessPace,
  type PaceMode,
  boardFullLine,
  endlessPaceLabel,
  endlessPaceTip,
  endlessTickMs,
  knotReport,
  nextSnackEmoji,
  paceLabel,
  paceTip,
  pickSnack,
  pushTurn,
  pushStone,
  reachableNow,
  ringCells,
  ringDoorOpen,
  ringDoorSet,
  ringHint,
  SNACK_EMOJI,
  snackPool,
  speedCurveFor,
  starExpired,
  starHurry,
  starLeft,
  starTicksFor,
  stoneSet,
  swipeDir,
  takeTurn,
  tickMsAt,
} from "./snake12";
import { type CatLook, chainCenters, drawCaterpillar } from "../../art/kit/caterpillar";
import {
  SS_WORM_GREEN,
  SS_WORM_PINK,
  bulgePos,
  createVisualFx,
  doorSwingT,
  moveGlideT,
  paintBoard,
  paintBush,
  paintDoor,
  paintHedgehog,
  paintRock,
  paintSnack,
  paintStar,
  paintSwirl,
  paintTile,
  swirlPhase,
  tileGlowT,
} from "./visual13";

const CELL = 26;
const SIZE = GRID * CELL;
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

/** 关掉动效时:插值压到一帧,状态机照旧 */
const REDUCED = (() => {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  return typeof mm === "function" ? !!mm("(prefers-reduced-motion: reduce)").matches : false;
})();

const CSS = `
.sn-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAFBE4, #FDF7E2); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.sn-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.sn-badge { background: linear-gradient(180deg, #FFFFFF, #F3F9EC); border: 1px solid #DCE9CD; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #67A05B; box-shadow: 0 2px 6px rgba(120,180,110,.25); font-size: 14px; }
.sn-badge.sn-shut { color: #C2456F; }
/* 画布靠划动转弯,不拦掉浏览器手势的话,真机上一划就变成滚页面 + pointercancel */
.sn-canvas { width: auto; max-width: 100%; height: auto; max-height: min(280px, 56dvh); margin: 0 auto; display: block; border-radius: 16px; background: #F4FBEF; touch-action: none; }
.sn-pad { display: grid; grid-template-columns: 60px 60px 60px; grid-template-rows: 48px 48px; gap: 6px; justify-content: center; margin-top: 10px; }
.sn-btn { border: none; border-radius: 14px; font-size: 22px; background: #BEE8B0; color: #3F6B36; cursor: pointer; box-shadow: 0 3px 0 #9CCC8E; touch-action: none; padding: 0; }
.sn-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #9CCC8E; }
.sn-up { grid-column: 2; grid-row: 1; }
.sn-left { grid-column: 1; grid-row: 2; }
.sn-down { grid-column: 2; grid-row: 2; }
.sn-right { grid-column: 3; grid-row: 2; }
.sn-msg { text-align: center; min-height: 20px; color: #67A05B; font-weight: 700; margin-top: 8px; font-size: 14px; }
.sn-bar-modes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.sn-bar-modes[hidden] { display: none; }
.sn-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FC468, #5E9E4A); box-shadow: 0 4px 0 #487A38; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; }
.sn-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #487A38; }
.sn-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.sn-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.sn-back { border: none; border-radius: 999px; padding: 7px 13px; min-height: 44px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #5E9E4A; box-shadow: 0 3px 0 rgba(100,150,70,.3); }
.sn-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(100,150,70,.3); }
.sn-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #5E9E4A; box-shadow: 0 2px 6px rgba(120,180,110,.25); }
.sn-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(120,180,110,.25); }
.sn-over-t { font-size: 22px; font-weight: 900; color: #5E9E4A; margin-bottom: 8px; }
.sn-over-s { font-size: 15px; font-weight: 700; color: #67A05B; line-height: 1.6; margin-bottom: 14px; }
.snk-toggle { border: none; border-radius: 999px; padding: 9px 16px; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; background: #FFF0C9; color: #8A6A16; box-shadow: 0 3px 0 #E4CE92; min-height: 44px; }
.snk-toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 #E4CE92; }
.snk-pace-tip { text-align: center; font-size: 13px; color: #6E8C5F; margin: -4px 0 10px; }
.snk-beat { display: inline-flex; gap: 3px; margin: 0 5px 0 2px; vertical-align: middle; }
.snk-beat i { width: 5px; height: 5px; border-radius: 50%; background: #C9A96E; animation: snkBeat 1.2s ease-in-out infinite; }
.snk-beat i:nth-child(2) { animation-delay: .2s; }
.snk-beat i:nth-child(3) { animation-delay: .4s; }
@keyframes snkBeat { 0%, 60%, 100% { transform: translateY(0); opacity: .55; } 30% { transform: translateY(-3px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .snk-beat i { animation: none; } }
.snk-pad-off .sn-pad { display: none; }
.snk-hint { text-align: center; font-size: 13px; color: #8A6A16; min-height: 18px; margin-top: 4px; }
/* N-81:无尽花园画布 width:100% 在 915 上被拉成近正方形,方向键 678。收盘+钉键,CELL 常量不改 */
@media (max-height: 500px) {
  .sn-wrap { height: 100%; max-height: calc(100dvh - 108px); min-height: 0; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; }
  .sn-top { flex: 0 0 auto; }
  .sn-canvas { max-height: min(168px, 42dvh); }
  .sn-pad { position: sticky; bottom: 0; z-index: 5; flex: 0 0 auto; margin-top: 6px;
    background: linear-gradient(180deg, rgba(234,251,228,0), #EAFBE4 14px); padding-top: 4px; }
  .sn-msg { flex: 0 0 auto; max-height: 1.3em; overflow: hidden; margin-top: 4px; }
  /* r18 · N-81 实测补账:无尽花园顶上还有「回选关」头行,wrap 真实顶距 165 不是 108,
     sticky 钉在 wrap 底(469)落在 412 外。照 N-75 麻将配方改 fixed 钉视口底,收盘让键。 */
  .sn-mode .sn-wrap { max-height: calc(100dvh - 176px); }
  .sn-mode .sn-canvas { max-height: min(128px, 31dvh); }
  .sn-mode .sn-pad { position: fixed; left: 10px; right: 10px; bottom: 6px;
    background: linear-gradient(180deg, rgba(234,251,228,0), #EAFBE4 12px); }
}
`;

interface Worm {
  cells: Array<[number, number]>;
  /** 上一拍身子在哪儿：画面靠它插值，虫子才不会一格一格瞬移 */
  prev: Array<[number, number]>;
  dir: Dir;
  /** 转向输入队列：最多两个，按拍依次生效 */
  queue: Dir[];
  /** 第二条毛毛虫：玩家按左右时它反着走 */
  mirror: boolean;
  /** 这条虫的一身皮:头色 + 双色交替节 + 落影(纯视觉) */
  look: CatLook;
}

/** 一局结束时交给外面的战报 */
export interface RunResult {
  won: boolean;
  eaten: number;
  starsGot: number;
  /** 这一趟爬了多少秒（收场那句正向总结要用） */
  seconds: number;
  reason: "fence" | "wall" | "self" | "twin" | "mover" | "stone" | null;
}

interface RunOpts {
  cfg: SnakeLevel;
  banner?: string;
  /** 关外选的节奏：稳稳走 / 越吃越快 */
  pace?: PaceMode;
  /** 无尽模式两档：给了就按无尽的节奏走 */
  endlessPace?: EndlessPace;
  /** 无尽模式此前已经吃了多少口（经典档据此接着加速） */
  eatenBefore?: number;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (result: RunResult) => void;
}

/**
 * 一座花园：闯关关卡和无尽花园共用这一套引擎。
 * 点心永远只放在「这会儿真的够得着」的格子上，所以不会出现走不到的死局。
 */
function createRun(stage: HTMLElement, opts: RunOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  let destroyed = false;
  let ended = false;
  let raf = 0;
  let lastFrame = 0;
  /** 距离下一拍还差多少毫秒（顺带给画面当插值进度） */
  let acc = 0;
  let elapsedMs = 0;
  /** 收场那 350ms 的缓冲：destroy 时要撤掉，不然离开页面还会回调 */
  let doneTimer = 0;

  const walls = wallSet(cfg);
  const gates = gateSet(cfg);
  const portals = portalMap(cfg);
  const curve = speedCurveFor(cfg);
  /** 绕圈开门：这一圈踩满了门才开 */
  const ring = ringCells(cfg);
  const doors = ringDoorSet(cfg);
  const ringWalked = new Set<number>();
  let ringOpen = ring.length === 0;
  /** 可推的小石头 */
  let stones = stoneSet(cfg);
  /** 开门之后兜里那颗奖励星星果 */
  let bonus: [number, number] | null = null;

  const worms: Worm[] = [
    { cells: spawnA(), prev: spawnA(), dir: [1, 0], queue: [], mirror: false, look: SS_WORM_GREEN },
  ];
  if (cfg.twin) {
    worms.push({ cells: spawnB(), prev: spawnB(), dir: [-1, 0], queue: [], mirror: true, look: SS_WORM_PINK });
  }

  let tick = 0;
  let eaten = 0;
  let starsGot = 0;
  let snack: [number, number] = [9, 1];
  let snackEmoji: string = SNACK_EMOJI[0];
  let snackIsStar = false;
  let snackIsTrim = false;
  let starTicks = 0;
  let starLimit = starTicksFor(curve.startMs);
  /** 视觉小状态:鼓包波计时、张嘴 / 金闪帧、门旋开与花砖点亮时刻(纯画面) */
  const fx = createVisualFx();
  /** 这一拍走多少毫秒：按速度曲线（或无尽两档）算 */
  let stepMs = curve.startMs;

  function refreshSpeed(): void {
    stepMs = opts.endlessPace
      ? endlessTickMs(opts.endlessPace, curve.startMs, (opts.eatenBefore ?? 0) + eaten)
      : tickMsAt(curve, eaten, opts.pace ?? "curve");
    starLimit = starTicksFor(stepMs);
  }

  const wrap = document.createElement("div");
  wrap.className = "sn-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="sn-top">
      <span class="sn-badge sn-score">🍓 0 / ${cfg.target}</span>
      <span class="sn-badge sn-len">🐛 3 节</span>
      <span class="sn-badge sn-star">⭐ 0</span>
      ${cfg.gate ? '<span class="sn-badge sn-gate">🚪 窄门开着</span>' : ""}
      ${opts.banner ? `<span class="sn-badge sn-banner">${opts.banner}</span>` : ""}
    </div>
    <canvas class="sn-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="snk-hint"></div>
    <div class="sn-pad">
      <button class="sn-btn sn-up" type="button" aria-label="向上">⬆️</button>
      <button class="sn-btn sn-left" type="button" aria-label="向左">⬅️</button>
      <button class="sn-btn sn-down" type="button" aria-label="向下">⬇️</button>
      <button class="sn-btn sn-right" type="button" aria-label="向右">➡️</button>
    </div>
    <div class="sn-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".sn-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".sn-score") as HTMLElement;
  const lenEl = wrap.querySelector(".sn-len") as HTMLElement;
  const starEl = wrap.querySelector(".sn-star") as HTMLElement;
  const gateEl = wrap.querySelector(".sn-gate") as HTMLElement | null;
  const hintEl = wrap.querySelector(".snk-hint") as HTMLElement;
  const msgEl = wrap.querySelector(".sn-msg") as HTMLElement;
  msgEl.textContent = openingLine(cfg);
  hintEl.textContent = ring.length > 0 ? ringHint(ring, ringWalked) : "手指在画面上划一下就能转弯,下面的方向键也一样好使。";

  function bodyLength(): number {
    return worms[0].cells.length;
  }

  function gateOpen(): boolean {
    return gateOpenFor(cfg, bodyLength());
  }

  function occupied(x: number, y: number): boolean {
    return worms.some((w) => w.cells.some(([sx, sy]) => sx === x && sy === y));
  }

  function hedgehogs(): Set<number> {
    return moverCells(cfg, Math.floor(tick / 2));
  }

  function placeSnack(): void {
    const kind = snackKind(cfg, eaten, bodyLength());
    snackIsStar = kind === "star";
    snackIsTrim = kind === "trim";
    starTicks = 0;
    snackEmoji = snackIsTrim ? "✂️" : snackIsStar ? "⭐" : nextSnackEmoji(snackEmoji, Math.random);
    // 只在「这会儿真的走得到」的格子里放点心：窄门关着、绕圈门没开、石头挡着都算数
    const head = worms[0].cells[0];
    const reach = reachableNow(cfg, cellKey(head[0], head[1]), {
      gateOpen: gateOpen(), ringOpen, stones,
    });
    const beasts = hedgehogs();
    const taken = new Set<number>([...gates, ...beasts, ...stones]);
    if (bonus) taken.add(cellKey(bonus[0], bonus[1]));
    for (const w of worms) for (const [x, y] of w.cells) taken.add(cellKey(x, y));
    const pool = snackPool(reach, taken);
    const pick = pickSnack(pool, Math.random);
    if (pick === null) {
      const room = GRID * GRID - walls.size;
      const body = worms.reduce((n, w) => n + w.cells.length, 0);
      if (body >= room * 0.6) {
        // 整座花园都被身子铺满了：这是了不起的事，不是失败
        msgEl.textContent = boardFullLine();
        opts.sfx("win");
        finish(true, null);
      } else {
        // 把自己圈起来了，够不着任何空地：也只是打了个结
        finish(false, "self");
      }
      return;
    }
    snack = cellXY(pick);
  }

  /** 绕圈开门：整圈踩满就把小门打开，兜里放一颗奖励星星果 */
  function openRingDoor(): void {
    if (ringOpen) return;
    ringOpen = true;
    fx.noteDoorOpen(elapsedMs);
    const head = worms[0].cells[0];
    const from = cellKey(head[0], head[1]);
    const before = reachableNow(cfg, from, { gateOpen: gateOpen(), ringOpen: false, stones });
    const after = reachableNow(cfg, from, { gateOpen: gateOpen(), ringOpen: true, stones });
    const fresh: number[] = [];
    after.forEach((k) => {
      if (!before.has(k) && !doors.has(k)) fresh.push(k);
    });
    bonus = fresh.length > 0 ? cellXY(fresh[fresh.length - 1]) : null;
    opts.sfx("coin");
    hintEl.textContent = ringHint(ring, ringWalked);
    msgEl.textContent = bonus
      ? "🌼 绕完一圈,小门开了!门后藏着一颗星星果哦~"
      : "🌼 绕完一圈,小门开了!";
  }

  function draw(t: number): void {
    if (!c2d) return;
    // ① 棋盘双色格(明度差 4%) + 花园栅栏边框:整张底一次画满
    paintBoard(c2d, GRID, CELL);
    // ② 花砖小路:绕圈那一圈串成小路,未踩灰花 / 踩过亮花 + 260ms 微光
    for (const key of ring) {
      const [x, y] = cellXY(key);
      const lit = ringWalked.has(key);
      const litAt = fx.tileLitAt.get(key);
      const glow = lit ? tileGlowT(litAt === undefined ? Number.POSITIVE_INFINITY : elapsedMs - litAt, REDUCED) : 0;
      paintTile(c2d, x, y, CELL, lit, glow);
    }
    // ③ 墙草丛 / 石头 / 门
    walls.forEach((key) => {
      const [x, y] = cellXY(key);
      paintBush(c2d, x, y, CELL);
    });
    stones.forEach((key) => {
      const [x, y] = cellXY(key);
      paintRock(c2d, x, y, CELL);
    });
    // 绕圈小门:开门那一下门板 150ms 旋开,开完门洞里放一朵小花当路标
    doors.forEach((key) => {
      const [x, y] = cellXY(key);
      const sinceOpen = fx.doorOpenAtMs < 0 ? Number.POSITIVE_INFINITY : elapsedMs - fx.doorOpenAtMs;
      paintDoor(c2d, x, y, CELL, ringOpen, ringOpen ? doorSwingT(sinceOpen, REDUCED) : 0, true);
    });
    // 窄门:开着是敞开的木门,关着挂锁牌
    const open = gateOpen();
    gates.forEach((key) => {
      const [x, y] = cellXY(key);
      paintDoor(c2d, x, y, CELL, open, open ? 1 : 0);
    });
    // ④ 传送 = 双色旋涡(2400ms/圈,reduced 静止)
    portals.forEach((_, key) => {
      const [x, y] = cellXY(key);
      paintSwirl(c2d, x, y, CELL, swirlPhase(elapsedMs, REDUCED));
    });
    // ⑤ 食物 / 奖励星(限时星星果快溜走时会一闪一闪)
    const blink = snackIsStar && starHurry(starTicks, starLimit) && Math.floor(elapsedMs / 180) % 2 === 0;
    paintSnack(c2d, snack[0], snack[1], CELL, snackEmoji, blink ? 0.45 : 1);
    if (bonus) paintStar(c2d, bonus[0], bonus[1], CELL, true, 1);
    // ⑥ 小刺猬:自绘圆背小刺球,友好脸(碰到只是「哎呀」弹回,语义没变)
    hedgehogs().forEach((key) => {
      const [x, y] = cellXY(key);
      paintHedgehog(c2d, x, y, CELL);
    });
    // ⑦⑧ 毛毛虫(尾→头,头永远最上):圆节链 + 鼓包波 + 张嘴 / 金闪帧
    const wave = bulgePos(fx.eatAtMs < 0 ? -1 : elapsedMs - fx.eatAtMs, REDUCED);
    for (const w of worms) {
      drawCaterpillar(c2d, {
        centers: chainCenters(w.cells, w.prev, CELL, t),
        cell: CELL,
        look: w.look,
        dir: w.dir,
        mouthOpen: fx.biteFrames > 0,
        goldFlash: fx.goldFrames > 0,
        bulge: wave,
        tailWag: REDUCED ? 0 : Math.floor(elapsedMs / 260) % 2 === 0 ? 1 : -1,
      });
    }
    if (fx.biteFrames > 0) fx.biteFrames--;
    if (fx.goldFrames > 0) fx.goldFrames--;
    if (SMOKE) mirrorState();
  }

  /** 冒烟脚本用的状态镜像：真人看画面，自动玩家看这几个 dataset */
  function mirrorState(): void {
    canvas.dataset.walls = Array.from(walls).join(",");
    canvas.dataset.gate = Array.from(gates).join(",");
    canvas.dataset.gateopen = gateOpen() ? "1" : "0";
    canvas.dataset.portals = Array.from(portals.entries()).map(([a, b]) => `${a}>${b}`).join(",");
    canvas.dataset.movers = Array.from(hedgehogs()).join(",");
    canvas.dataset.stones = Array.from(stones).join(",");
    canvas.dataset.ringopen = ringOpen ? "1" : "0";
    canvas.dataset.worms = worms.map((w) => w.cells.map(([x, y]) => cellKey(x, y)).join(";")).join("|");
    canvas.dataset.snack = String(cellKey(snack[0], snack[1]));
    canvas.dataset.eaten = String(eaten);
  }

  function renderTop(): void {
    scoreEl.textContent = `🍓 ${eaten} / ${cfg.target}`;
    lenEl.textContent = `🐛 ${bodyLength()} 节`;
    starEl.textContent = snackIsStar
      ? `⭐ ${starsGot} · 还剩 ${starLeft(starTicks, starLimit)} 步`
      : `⭐ ${starsGot}`;
    if (gateEl) {
      const open = gateOpen();
      gateEl.classList.toggle("sn-shut", !open);
      gateEl.textContent = open ? "🚪 窄门开着" : `🔒 窄门要 ${cfg.gateMax ?? 8} 节以内`;
    }
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (ended) return;
    ended = true;
    const result: RunResult = { won, eaten, starsGot, seconds: elapsedMs / 1000, reason };
    doneTimer = window.setTimeout(() => { if (!destroyed) opts.onDone(result); }, 350);
  }

  function eatAt(w: Worm): void {
    eaten++;
    // 张嘴一帧 + 鼓包沿身子传两节(纯视觉,reduced 时波自己不走)
    fx.noteEat(elapsedMs);
    if (snackIsTrim) {
      for (const worm of worms) {
        while (worm.cells.length > 3) worm.cells.pop();
        worm.prev = worm.cells.map(([x, y]) => [x, y] as [number, number]);
      }
      opts.sfx("coin");
      msgEl.textContent = "✂️ 剪短啦！这下窄门挤得过去了～";
    } else if (snackIsStar) {
      starsGot++;
      fx.noteStar();
      opts.sfx("coin");
      msgEl.textContent = "⭐ 追到星星果啦！";
    } else {
      opts.sfx("pop");
      if (w.mirror) msgEl.textContent = "粉毛毛虫也吃到啦！";
    }
    refreshSpeed();
    renderTop();
  }

  function step(): void {
    if (ended || destroyed) return;
    tick++;
    const beasts = moverCells(cfg, Math.floor(tick / 2));
    const open = gateOpen();
    const moved: Array<{ w: Worm; head: [number, number] }> = [];

    for (const w of worms) {
      // 转向输入队列：这一拍取一个，剩下的留到下一拍
      const turned = takeTurn(w.queue, w.dir);
      w.dir = turned.dir;
      w.queue = turned.queue;
      const [hx, hy] = w.cells[0];
      let nx = hx + w.dir[0];
      let ny = hy + w.dir[1];
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
        opts.sfx("oops");
        finish(false, "fence");
        return;
      }
      let k = cellKey(nx, ny);
      if (gates.has(k) && !open) {
        // 门框挡一下不算撞车：这一拍原地不动，等孩子吃了剪刀果再过
        msgEl.textContent = `身子有点长啦，先去吃把剪刀果，短到 ${cfg.gateMax ?? 8} 节就挤得过去！`;
        continue;
      }
      if (doors.has(k) && !ringOpen) {
        // 绕圈门还没开：顶一下就停，不算撞
        msgEl.textContent = "🔐 这扇小门还锁着,先绕着花坛走满一圈!";
        continue;
      }
      if (stones.has(k)) {
        // 可推的小石头：推得动就一起往前挪，推不动就原地停住（不算撞车）
        const blocked = new Set<number>([...beasts, ...gates, cellKey(snack[0], snack[1])]);
        for (const worm of worms) for (const [sx, sy] of worm.cells) blocked.add(cellKey(sx, sy));
        const pushed = pushStone(stones, nx, ny, w.dir, { walls, blocked });
        if (!pushed) {
          msgEl.textContent = "🪨 这块小石头顶住啦,换个方向推推看!";
          continue;
        }
        stones = pushed;
        opts.sfx("tap");
      }
      if (walls.has(k)) {
        opts.sfx("oops");
        finish(false, "wall");
        return;
      }
      const hop = portals.get(k);
      if (hop !== undefined) {
        [nx, ny] = cellXY(hop);
        k = hop;
        opts.sfx("tap");
      }
      moved.push({ w, head: [nx, ny] });
    }

    // 先把所有头挪好再判碰撞，两条毛毛虫才不会因为先后顺序吃亏
    for (const { w, head } of moved) {
      const [nx, ny] = head;
      const hitSelf = w.cells.some(([sx, sy], i) => i > 0 && i < w.cells.length - 1 && sx === nx && sy === ny);
      if (hitSelf) {
        opts.sfx("oops");
        finish(false, "self");
        return;
      }
      const other = worms.find((o) => o !== w);
      if (other && other.cells.some(([sx, sy]) => sx === nx && sy === ny)) {
        opts.sfx("oops");
        finish(false, "twin");
        return;
      }
      if (beasts.has(cellKey(nx, ny))) {
        opts.sfx("oops");
        finish(false, "mover");
        return;
      }
    }
    if (moved.length > 1) {
      const [a, b] = moved;
      if (a.head[0] === b.head[0] && a.head[1] === b.head[1]) {
        opts.sfx("oops");
        finish(false, "twin");
        return;
      }
    }

    let ate = false;
    let gotBonus = false;
    for (const { w, head } of moved) {
      w.prev = w.cells.map(([x, y]) => [x, y] as [number, number]);
      w.cells.unshift([head[0], head[1]]);
      if (!ate && head[0] === snack[0] && head[1] === snack[1]) {
        ate = true;
        eatAt(w);
      } else {
        w.cells.pop();
      }
      // 绕圈开门：头走过的圈上格子记下来
      if (!ringOpen && ring.length > 0) {
        const k = cellKey(head[0], head[1]);
        if (ring.includes(k) && !ringWalked.has(k)) {
          ringWalked.add(k);
          fx.noteTileLit(k, elapsedMs);
          hintEl.textContent = ringHint(ring, ringWalked);
        }
      }
      if (bonus && head[0] === bonus[0] && head[1] === bonus[1]) {
        gotBonus = true;
        bonus = null;
        starsGot++;
        fx.noteStar();
        opts.sfx("coin");
        msgEl.textContent = "⭐ 门后的星星果到手啦!绕圈绕得值!";
      }
    }
    if (!ringOpen && ringDoorOpen(ring, ringWalked)) openRingDoor();
    if (gotBonus) renderTop();
    if (ate) {
      if (eaten >= cfg.target) {
        draw(1);
        opts.sfx("win");
        finish(true, null);
        return;
      }
      placeSnack();
    } else if (snackIsStar) {
      starTicks++;
      if (starExpired(starTicks, starLimit)) {
        // 星星果限时溜走，换回普通点心
        snackIsStar = false;
        snackEmoji = nextSnackEmoji(snackEmoji, Math.random);
        msgEl.textContent = "星星果溜走了～下一颗顺路的时候优先去拿！";
      }
    }
    renderTop();
  }

  /** 记一个转向：走队列，反向和重复都在 pushTurn 里挡掉了 */
  function turn(d: Dir): void {
    if (ended) return;
    let changed = false;
    for (const w of worms) {
      const want: Dir = w.mirror ? mirrorDir(d) : d;
      const before = w.queue.length;
      w.queue = pushTurn(w.queue, w.dir, want);
      if (w.queue.length !== before) changed = true;
    }
    if (changed) opts.sfx("tap");
  }

  (wrap.querySelector(".sn-up") as HTMLButtonElement).addEventListener("click", () => turn([0, -1]));
  (wrap.querySelector(".sn-down") as HTMLButtonElement).addEventListener("click", () => turn([0, 1]));
  (wrap.querySelector(".sn-left") as HTMLButtonElement).addEventListener("click", () => turn([-1, 0]));
  (wrap.querySelector(".sn-right") as HTMLButtonElement).addEventListener("click", () => turn([1, 0]));

  const onKeyDown = (e: KeyboardEvent) => {
    // 星星走方向键，朵朵走 WASD —— 双身位时两边都指挥同一套镜像规则
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { turn([0, -1]); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { turn([0, 1]); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { turn([-1, 0]); e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { turn([1, 0]); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  // 触屏：在画面上划一下就转弯（比戳按钮准得多），四方向键留着当备选
  let swipeFrom: { x: number; y: number } | null = null;
  const onPointerDown = (e: PointerEvent): void => {
    swipeFrom = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!swipeFrom) return;
    const d = swipeDir(e.clientX - swipeFrom.x, e.clientY - swipeFrom.y);
    if (!d) return;
    turn(d);
    swipeFrom = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };
  const onPointerUp = (): void => {
    swipeFrom = null;
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  /**
   * 主循环：一拍走一格的状态机没变，只是把「什么时候走下一格」交给累计时间，
   * 中间那几帧用来把虫身插值画顺 —— 速度曲线因此可以随时变。
   */
  function frame(now: number): void {
    if (destroyed) return;
    // 先排下一帧再干活:排帧句要是留在最后一行,中间任何一步抛异常都会把整条
    // rAF 循环带走,画面当场冻住只能退出重进(C2-02 在 bubble-aim 上就是这么卡死的)。
    raf = requestAnimationFrame(frame);
    const dt = Math.min(120, now - lastFrame || 16);
    lastFrame = now;
    if (!ended) {
      elapsedMs += dt;
      acc += dt;
      let guard = 0;
      while (acc >= stepMs && !ended && guard++ < 4) {
        acc -= stepMs;
        step();
      }
      if (acc >= stepMs) acc = 0;
    }
    // 绘制层插值:上一格 → 当前格 80ms 平滑;逻辑 tick(stepMs)一毫秒没动
    draw(ended ? 1 : moveGlideT(acc, REDUCED));
  }

  refreshSpeed();
  placeSnack();
  renderTop();
  draw(1);
  raf = requestAnimationFrame((t) => {
    lastFrame = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      clearTimeout(doneTimer);
      // 插值计时 / 张嘴金闪帧 / 砖点亮记录全部归零
      fx.reset();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽花园：经典（越吃越快）与休闲（不加速）两档
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "sn-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "sn-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "sn-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "sn-chip";
  const paceBtn = document.createElement("button");
  paceBtn.type = "button";
  paceBtn.className = "snk-toggle";
  head.append(back, chip, paceBtn);
  const tip = document.createElement("div");
  tip.className = "snk-pace-tip";
  const stage = document.createElement("div");
  wrap.append(head, tip, stage);
  host.appendChild(wrap);

  let garden = 1;
  let total = 0;
  let pace: EndlessPace = "classic";
  let run: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function renderPace(): void {
    paceBtn.textContent = endlessPaceLabel(pace);
    // 小鼓图标 + 点点节拍:节奏档只是读出来给孩子看,pace 数据一个字不动
    tip.innerHTML = `🥁 <span class="snk-beat"><i></i><i></i><i></i></span>${endlessPaceTip(pace)}`;
  }

  // 换档从第 1 座重新开始：同一趟里改速度对成绩不公平
  paceBtn.addEventListener("click", () => {
    api.play("tap");
    pace = pace === "classic" ? "calm" : "classic";
    renderPace();
    garden = 1;
    total = 0;
    startGarden();
  });

  function showOver(sub: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "sn-over";
    box.innerHTML = `<div class="sn-over-t">毛毛虫吃饱回家啦</div><div class="sn-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "sn-open";
    again.textContent = "🔁 从第 1 座花园再来";
    again.addEventListener("click", () => {
      api.play("tap");
      garden = 1;
      total = 0;
      startGarden();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startGarden(): void {
    run?.destroy();
    stage.innerHTML = "";
    chip.textContent = `♾️ ${endlessGardenName(garden)} · 累计 ${total} 口 · 最好 ${best} 口`;
    run = createRun(stage, {
      cfg: endlessGarden(garden),
      banner: `♾️ 第 ${garden} 座`,
      endlessPace: pace,
      eatenBefore: total,
      sfx: (n) => api.play(n),
      onDone: (result) => {
        total += result.eaten;
        // 存档里这个数一直是「累计吃到的口数」，单位不改，老纪录才比得下去
        best = save.recordEndlessBest(meta.id, total);
        if (result.won) {
          api.addStars(1);
          garden++;
          startGarden();
        } else {
          showOver(`${knotReport(result.reason ?? "wall", result.eaten, result.seconds)}<br>${endlessLine(total, best)}`);
        }
      },
    });
  }

  renderPace();
  startGarden();

  return {
    destroy() {
      run?.destroy();
      run = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "sn-bar-modes";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "sn-open";
  const paceBtn = document.createElement("button");
  paceBtn.type = "button";
  paceBtn.className = "snk-toggle";
  bar.append(endlessBtn, paceBtn);
  const paceTipEl = document.createElement("div");
  paceTipEl.className = "snk-pace-tip";
  root.insertBefore(paceTipEl, levelHost);

  let mode: { destroy: () => void } | null = null;
  /** 关外选的节奏档：稳稳走只是让速度不变，三星标准一个字没动 */
  let pace: PaceMode = "curve";

  function renderPace(): void {
    paceBtn.textContent = paceLabel(pace);
    // 小鼓图标 + 点点节拍:提示只换画法,速度数据只读
    paceTipEl.innerHTML = `🥁 <span class="snk-beat"><i></i><i></i><i></i></span>${paceTip(pace)}（换档不影响三星标准）`;
  }

  paceBtn.addEventListener("click", () => {
    api.play("tap");
    pace = pace === "curve" ? "steady" : "curve";
    renderPace();
  });

  function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const cfg: SnakeLevel = LEVELS[ctx.level];
    const run = createRun(stage, {
      cfg,
      pace,
      sfx: ctx.sfx,
      onDone: (result) => {
        if (result.won) ctx.win(starsFor(result.starsGot), winLine(cfg, cfg.target, result.starsGot));
        // 撞了不叫失败：先夸这一趟爬了多久吃了多少，再说下次怎么更顺
        else ctx.lose(knotReport(result.reason ?? "wall", result.eaten, result.seconds));
      },
    });
    return { destroy: () => run.destroy() };
  }

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽花园 · 最好 ${best} 口` : "♾️ 无尽花园 · 点我开吃！";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();
  renderPace();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "追到 2 颗限时星星果就能拿 3 星，顺路再去最划算！",
      grandMessage: "188 座花园全部吃遍，你的走位和路线规划都很老练了！",
      guideTitle: "贪吃毛毛虫 · 花园笔记",
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
