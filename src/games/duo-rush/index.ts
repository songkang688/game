import { meta } from "./meta";
export { meta };

// 朵星双人冲刺 —— 2.5D 双人分屏无尽竞速。
// 两个人各占半屏，各自三条车道向远处收拢；赛道是同一份，比的完全是操作。
// 玩法状态机在 match.ts，透视投影在 view25d.ts，键位在 keys.ts，
// 这里只干三件事：把画面画出来、把输入接进去、离开时清干净。
import { save } from "../../engine/save";
import { AI_HINTS, AI_LABELS, AI_LEVELS, type AiLevel } from "./ai";
// 1.3 第 11 步 A：视觉资产全部来自 art.ts（纯绘制，金币/皇冠/心形待上移共享 kit）
import {
  boostArrowPhase,
  coinFrames,
  coinFrameSpec,
  drawAvatarBody,
  drawBoostPad,
  drawCelestial,
  drawCheerHeart,
  drawCloudPuff,
  drawCoin,
  drawCoinFrame,
  drawCrown,
  drawHeart,
  drawDecorSilhouette,
  drawDizzyStars,
  drawGhostWisp,
  drawMiniFace,
  drawObstacle,
  drawPowerIcon,
  drawRoadsideFlag,
  drawRunnerSprite,
  drawSparkle,
  drawSpeedTrail,
  runnerHeadY,
  sparkleCount,
  COIN_FRAME_COUNT,
  type CoinFrame,
  type DecorKind,
  type RunnerMood,
} from "./art";
import {
  PAD_BUTTONS,
  type Action,
  padRects,
  type Seat,
  isPauseKey,
  isWatchedKey,
  resolveKey,
  seatAtPoint,
  swipeAction,
} from "./keys";
import {
  BOOST_SECONDS,
  COIN_RACE_TARGET,
  CRASH_LIMIT,
  GHOST_KEY,
  GHOST_MIN_DIST,
  JUMP_SECONDS,
  SLIDE_SECONDS,
  type Entity,
  type PowerKind,
  type RaceMode,
  parseGhostRecord,
} from "./logic";
import {
  CHEER_SECONDS,
  type MatchState,
  type Runner,
  applyAction,
  createMatch,
  drainEvents,
  entitiesFor,
  leaderSeat,
  livesLeft,
  stepMatch,
} from "./match";
import {
  GHOST_RIVAL_KEY,
  HANDICAP_MAX,
  POWERUPS,
  POWERUP_KINDS,
  type ForkSection,
  type GhostSnapshot,
  type GhostSource,
  handicapMult,
  levelFromQuery,
  levelToSetup,
  makeGhostSnapshot,
  parseGhostSnapshot,
  serializeGhostSnapshot,
} from "./rush12";
import {
  DRAW_DISTANCE,
  GRID_SPACING,
  JUMP_LIFT_RATIO,
  RUNNER_Z,
  type Rect,
  type SplitLayout,
  bumpShake,
  crownOffset,
  fogAlpha,
  gridLineZs,
  groundY,
  horizonY,
  jumpArc,
  laneTiltDeg,
  laneWidthAt,
  paneRects,
  parallaxOffset,
  project,
  slideSquash,
  stageSize,
} from "./view25d";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---- 头像：PNG 到位后自动使用，暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function avatarUrl(who: "duoduo" | "xingxing"): string | undefined {
  return AVATAR_URLS[`../../assets/avatars/${who === "duoduo" ? "duoduo-q.png" : "xingxing-q.png"}`];
}

function avatarHTML(who: "duoduo" | "xingxing", size = 26): string {
  const url = avatarUrl(who);
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : "⭐";
  const bg = who === "duoduo" ? "#FFD9E8" : "#D9E6FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

/**
 * 「小屋·收藏」面板是第 6 步另一位同学在做的，可能还没进仓库。
 * 用 glob 探一眼：文件不在就连按钮都不出现，绝不因为缺模块把这一款打崩。
 */
const COLLECTION_MODULES = import.meta.glob("../../ui/collection.ts");
const COLLECTION_PATH = "../../ui/collection.ts";

function hasCollection(): boolean {
  return typeof COLLECTION_MODULES[COLLECTION_PATH] === "function";
}

async function openCollectionSafely(): Promise<void> {
  const loader = COLLECTION_MODULES[COLLECTION_PATH];
  if (typeof loader !== "function") return;
  try {
    const mod = (await loader()) as { openCollection?: (scope?: string) => void };
    mod.openCollection?.("duo-rush");
  } catch {
    // 面板加载不出来就当没这个按钮，比赛照常跑
  }
}

/* ---------------- 配色 ---------------- */

interface Theme {
  sky: [string, string];
  farHill: string;
  nearHill: string;
  /** 路两边的草地（近处、远处） */
  field: [string, string];
  /** 路面本身 */
  road: string;
  /** 路面上的标线颜色（"r,g,b"，透明度按远近另算） */
  mark: string;
  roadEdge: string;
  ink: string;
  hud: string;
  /* ---- 1.3 第 11 步 A：纵深装饰换装位 ---- */
  /** 第三层近景剪影画什么（树/糖果柱/冰锥/星塔四种查表） */
  decor: DecorKind;
  /** 剪影主色与亮部 */
  decorColor: string;
  decorLight: string;
  /** 天上挂太阳还是月亮 */
  celestial: "sun" | "moon";
}

const THEMES: [Theme, Theme] = [
  {
    sky: ["#FFF3F8", "#FFD3E6"],
    farHill: "#F6C2D9",
    nearHill: "#EDA3C3",
    field: ["#F3B9D2", "#E79FC0"],
    road: "#FFF1F7",
    mark: "236,158,192",
    roadEdge: "#F4AECC",
    ink: "#C2497E",
    hud: "rgba(255,255,255,.85)",
    decor: "tree",
    decorColor: "#E08BB2",
    decorLight: "#F6C2D9",
    celestial: "sun",
  },
  {
    sky: ["#F1F7FF", "#CFE2FF"],
    farHill: "#B7D2F4",
    nearHill: "#98BCEA",
    field: ["#AFCCF0", "#93B6E4"],
    road: "#F2F8FF",
    mark: "146,180,226",
    roadEdge: "#9CC0EA",
    ink: "#3A6BB0",
    hud: "rgba(255,255,255,.85)",
    decor: "starTower",
    decorColor: "#7FA4DC",
    decorLight: "#C9DCF6",
    celestial: "moon",
  },
];

const MODE_LABELS: Record<RaceMode, string> = {
  rush: "无尽竞速",
  items: "道具竞速",
  ghost: "幽灵对战",
  endless: "无尽对战",
  coins: "抢金币赛",
};

const RULES_HTML = `
  <h3>🏁 五种赛制</h3>
  <p><b>🏁 无尽竞速</b>：两个人一直往前跑，<b>先撞满 ${CRASH_LIMIT} 次的人输</b>，跑得再远也救不回来。<br>
  <b>✨ 道具竞速</b>：在无尽竞速上加了<b>四种道具</b>和<b>中途分岔</b>，胜负规矩一样。<br>
  <b>👻 幽灵对战</b>：和上一次的成绩赛跑，可以选<b>自己上次</b>或<b>对手上一局</b>，<b>跑得比影子远就赢</b>。<br>
  <b>♾️ 无尽对战</b>：各有 ${CRASH_LIMIT} 颗心，都用完了比谁跑得远。<br>
  <b>🪙 抢金币赛</b>：撞了不掉心但会绊一下，<b>先吃到 ${COIN_RACE_TARGET} 枚金币</b>的人获胜。</p>
  <h3>⌨️ 两个人怎么分键</h3>
  <p>朵朵用左手：<b>W 跳 / A 左道 / S 下滑 / D 右道 / F 用道具 / G 加油</b>。<br>
  星星用右手：<b>↑ 跳 / ← 左道 / ↓ 下滑 / → 右道 / L 用道具 / K 加油</b>。<br>
  两套键完全分开，同时按也不会串台。<b>Esc</b> 随时暂停。</p>
  <h3>📱 手机怎么玩</h3>
  <p>画面切成两半，<b>各自在自己那半边滑</b>：上滑跳、下滑滚、左右滑换道，和键盘一模一样。<br>
  每半屏右下角还有两颗圆按钮：<b>✨ 用道具</b>和<b>📣 加油</b>。</p>
  <h3>✨ 四种道具（道具竞速里才有）</h3>
  <p>${POWERUP_KINDS.map((k) => `${POWERUPS[k].emoji} <b>${POWERUPS[k].label}</b>：${POWERUPS[k].hint}`).join("<br>")}<br>
  手上一次只拿得下一件，捡到新的就把旧的换下来，按 <b>F</b> / <b>L</b> 才用出去。</p>
  <h3>🌿 中途分岔</h3>
  <p>跑到分岔口，路会裂成两条：站<b>右道</b>就走右边那条，站<b>左道或中道</b>就走左边那条。<br>
  一条稳一条快，<b>但难的那条不固定在哪一边</b>，得看清楚再决定。<br>
  两条路<b>一样长</b>，不管选哪条都在同一米汇合，谁也不吃亏。</p>
  <h3>🤝 让分模式</h3>
  <p>大人带小孩玩的时候可以打开：<b>落后的一方</b>会得到一点点追赶助推，
  <b>最多 ${Math.round(HANDICAP_MAX * 100)}%</b>，开着的时候画面上一直写着，默认是关的。</p>
  <h3>🚧 四种障碍</h3>
  <p>🪨 <b>大石头</b>：跳不过也钻不过，只能<b>提前换道</b>。<br>
  🚧 <b>矮木栏</b>：按<b>跳</b>跃过去。<br>
  🕳️ <b>泥坑</b>：也要<b>跳</b>，踩进去就摔。<br>
  🎏 <b>高横杆</b>：架得高，要按<b>下滑</b>钻过去，跳起来反而撞得更结实。</p>
  <h3>🪙 路上的好东西</h3>
  <p>🪙 金币：吃一枚加 1 分。⚡ 加速带：踩上去冲刺 ${BOOST_SECONDS} 秒，超车全靠它。</p>
  <h3>🤖 一个人也能玩</h3>
  <p>选「电脑对手」有四档：<b>新手</b>反应慢还爱愣神，<b>稳当</b>基本不失误，<b>高手</b>几乎不出错，
  <b>老练</b>还会提前占住最好的那条道。<br>
  四档电脑的速度和你<b>完全一样</b>，不会偷偷加速，它强只强在看得早、站得好。</p>
  <h3>📈 小提醒</h3>
  <p>速度会随距离一直往上涨（有封顶，不会快到反应不过来）。能换道就别跳，跳在半空中没法再改主意。</p>
`;

/* ---------------- 幽灵存档 ---------------- */

/**
 * 存档 key 只增不改：
 *  · `GHOST_KEY`（1.1 就有）继续放**自己**的最好成绩，写进去的 JSON 多了两个字段，
 *    1.1 的 `parseGhostRecord` 照样读得出来；
 *  · `GHOST_RIVAL_KEY`（1.2 新增）放**对手上一局**那一趟。
 */
function ghostKeyOf(source: GhostSource): string {
  return source === "rival" ? GHOST_RIVAL_KEY : GHOST_KEY;
}

/** 读影子：新版快照优先，读不到就退回 1.1 的老格式，老纪录一条都不丢。 */
function loadGhost(source: GhostSource): GhostSnapshot | null {
  try {
    const raw = localStorage.getItem(ghostKeyOf(source));
    const snap = parseGhostSnapshot(raw);
    if (snap) return snap;
    if (source !== "self") return null;
    const legacy = parseGhostRecord(raw);
    return legacy ? makeGhostSnapshot("self", legacy.dist, legacy.seconds, "朵朵") : null;
  } catch {
    return null;
  }
}

function saveGhost(snap: GhostSnapshot): void {
  try {
    localStorage.setItem(ghostKeyOf(snap.source), serializeGhostSnapshot(snap));
  } catch {
    // 隐私模式写不进去就算了，比赛不受影响
  }
}

/** HUD / 设置面板上那一行：「🫥 对手上一局 · 星星 1200 米（22 秒）」 */
function ghostCaption(snap: GhostSnapshot | null): string {
  if (!snap) return "";
  const who = snap.source === "rival" ? "对手上一局" : "上次的自己";
  const emoji = snap.source === "rival" ? "🫥" : "👻";
  return `${emoji} ${who} · ${snap.who} ${snap.dist} 米（${snap.seconds} 秒）`;
}

/**
 * 无尽成绩统一走平台的 `recordEndlessBest`。
 * 1.1 只把里程存在幽灵 key 里，这里读一次搬过去——只取较大值，**绝不清零**。
 */
function migrateEndlessBest(): void {
  try {
    const legacy = parseGhostRecord(localStorage.getItem(GHOST_KEY));
    if (legacy) save.recordEndlessBest(meta.id, legacy.dist);
  } catch {
    // 读不到就算了，纪录本来就在平台存档里
  }
}

/* ---------------- 挂载 ---------------- */

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let endTimer = 0;
  let countTimer = 0;

  let mode: RaceMode = "rush";
  /** null = 两个真人；数字 = 电脑档位 */
  let aiLevel: AiLevel | null = null;
  let state: MatchState | null = null;
  let running = false;
  let paused = false;
  let ghostSource: GhostSource = "self";
  const ghosts: Record<GhostSource, GhostSnapshot | null> = {
    self: loadGhost("self"),
    rival: loadGhost("rival"),
  };
  /** 让分助推：默认关，家长要开才开 */
  let handicapOn = false;

  migrateEndlessBest();

  /**
   * 平台可能带着关号进来（`?level=N`，或以后由壳层传 `initialLevel`）。
   * 本款没有 188 战役，所以关号只用来定「赛道难度档 + 人机档 + 要不要分岔」。
   */
  const initialLevel =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  const levelSetup = levelToSetup(initialLevel ?? 1);
  if (initialLevel !== null && initialLevel !== undefined) aiLevel = levelSetup.aiLevel as AiLevel;

  const reducedMotion = (): boolean =>
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const wrap = document.createElement("div");
  wrap.className = "dr-wrap";
  wrap.innerHTML = `
    <style>
      .dr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FFEEF6); border-radius: 20px; padding: 12px; max-width: 1000px; margin: 0 auto; user-select: none; position: relative; }
      .dr-panel { display: flex; flex-direction: column; gap: 12px; padding: 8px 4px; }
      .dr-label { font-weight: 800; color: #4A7AA8; font-size: 15px; margin-bottom: 6px; }
      .dr-seg { display: flex; gap: 8px; flex-wrap: wrap; }
      .dr-seg button { flex: 1 1 150px; min-height: 48px; border: 3px solid #BFDDF2; background: #FDFEFF; border-radius: 16px; padding: 10px 8px; font-size: 15px; font-weight: 700; color: #4A7AA8; cursor: pointer; font-family: inherit; }
      .dr-seg button.on { border-color: #F2A0C0; background: #FFE4EF; color: #C2497E; }
      .dr-hint { color: #6E86A0; font-size: 13.5px; margin: 8px 2px 0; min-height: 19px; line-height: 1.5; }
      .dr-ghostline { color: #8A6AB0; font-size: 13.5px; font-weight: 700; margin: 0 2px; min-height: 19px; }
      .dr-start { border: none; border-radius: 18px; padding: 15px; font-size: 20px; font-weight: 800; background: #8FD3FF; color: #14496E; cursor: pointer; box-shadow: 0 5px 0 #64AEE0; width: 100%; font-family: inherit; }
      .dr-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #64AEE0; }
      .dr-softbtn { border: none; border-radius: 16px; padding: 12px; font-size: 16px; font-weight: 800; background: #D9F2C4; color: #4A7A2A; cursor: pointer; box-shadow: 0 4px 0 #ADD68E; width: 100%; font-family: inherit; }
      .dr-softbtn:active { transform: translateY(2px); box-shadow: 0 2px 0 #ADD68E; }
      .dr-collectbtn { background: #FFE7C2; color: #9A5A20; box-shadow: 0 4px 0 #E2BE87; }
      .dr-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; background: #EAF3FF; }
      .dr-keys { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 8px 0 2px; font-size: 13px; font-weight: 700; }
      .dr-keys span { background: #fff; border-radius: 12px; padding: 5px 10px; box-shadow: 0 2px 5px rgba(90,140,190,.18); }
      .dr-keys .k1 { color: #C2497E; }
      .dr-keys .k2 { color: #3A6BB0; }
      .dr-btns { display: flex; gap: 8px; margin-top: 8px; }
      .dr-btns button { flex: 1; min-height: 46px; border: none; border-radius: 14px; padding: 11px 4px; font-size: 14.5px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); font-family: inherit; }
      /* N-40: 矮横屏赛道态暂停/再来/换玩法钉在舞台底，不重钳已在屏的画布与半屏圆钮 */
      /* N-87: 菜单态怎么玩/收藏册/开跑提到顶并排钉进 412，勿回退 .dr-btns */
      @media (max-height: 500px) {
        .dr-setup { display: flex; flex-direction: column; }
        .dr-menu-cta {
          order: -1; display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px;
          position: sticky; top: 0; z-index: 4; padding: 4px 0 8px;
          background: linear-gradient(180deg, #E9F4FF 72%, rgba(233,244,255,.88));
        }
        .dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start {
          width: auto; flex: 1 1 140px; min-height: 44px; font-size: 15px; padding: 10px 8px;
        }
        .dr-keys { display: none; }
        .dr-btns {
          position: sticky; bottom: 0; z-index: 7; margin-top: 4px; padding: 6px 0 2px;
          background: linear-gradient(180deg, rgba(233,244,255,.55), #E9F4FF 28%, #FFEEF6);
          box-shadow: 0 -8px 14px rgba(90,140,190,.16);
        }
      }
      @media (max-height: 840px) and (min-height: 501px) {
        .dr-setup { display: flex; flex-direction: column; }
        .dr-menu-cta {
          order: -1; display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px;
          position: sticky; top: 0; z-index: 4; padding: 4px 0 8px;
          background: linear-gradient(180deg, #E9F4FF 72%, rgba(233,244,255,.88));
        }
        .dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start {
          width: auto; flex: 1 1 140px; min-height: 44px; font-size: 15px; padding: 10px 8px;
        }
        .dr-btns {
          position: sticky; bottom: 0; z-index: 7; margin-top: 4px; padding: 6px 0 2px;
          background: linear-gradient(180deg, rgba(233,244,255,.55), #E9F4FF 28%, #FFEEF6);
          box-shadow: 0 -8px 14px rgba(90,140,190,.16);
        }
      }
      @media (max-width: 480px) {
        .dr-setup { display: flex; flex-direction: column; }
        .dr-menu-cta {
          order: -1; display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px;
          position: sticky; top: 0; z-index: 4; padding: 4px 0 8px;
          background: linear-gradient(180deg, #E9F4FF 72%, rgba(233,244,255,.88));
        }
        .dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start {
          width: auto; flex: 1 1 140px; min-height: 44px; font-size: 15px; padding: 10px 8px;
        }
      }
      .dr-pause { background: #E3E8FF; color: #4A55A8; }
      .dr-again { background: #D9F2C4; color: #4A7A2A; }
      .dr-back { background: #FFE0C2; color: #9A5A20; }
      .dr-msg { text-align: center; min-height: 22px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14.5px; line-height: 1.5; }
      .dr-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 84px; font-weight: 900; color: #FF7EA8; text-shadow: 0 4px 0 rgba(255,255,255,.85); z-index: 4; pointer-events: none; }
      .dr-pausepanel { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(244,250,255,.94); border-radius: 20px; z-index: 5; }
      .dr-pausepanel h3 { color: #C2497E; font-size: 22px; margin: 0; }
      .dr-pausepanel p { color: #4A6A8A; font-size: 14.5px; margin: 0; text-align: center; padding: 0 18px; line-height: 1.6; }
      .dr-resume { border: none; border-radius: 16px; padding: 13px 28px; font-size: 17px; font-weight: 800; background: #8FD3FF; color: #14496E; cursor: pointer; box-shadow: 0 4px 0 #64AEE0; font-family: inherit; }
      .dr-rules { position: absolute; inset: 0; background: #F4FAFF; border-radius: 20px; padding: 14px; overflow-y: auto; z-index: 6; }
      .dr-rules h3 { color: #C2497E; margin: 12px 0 4px; font-size: 17px; }
      .dr-rules p { color: #4A6A8A; font-size: 14.5px; line-height: 1.75; margin: 6px 0; }
      .dr-rules-close { position: sticky; top: 0; float: right; border: none; border-radius: 14px; background: #8FD3FF; color: #14496E; font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; box-shadow: 0 3px 0 #64AEE0; font-family: inherit; }
      /* ---- 1.2 第 11 步 A 新增,一律 dur- 前缀 ---- */
      .dur-stage { position: relative; line-height: 0; }
      .dur-pad { position: absolute; display: flex; align-items: center; gap: 8px; pointer-events: none; }
      .dur-padbtn { pointer-events: auto; width: 44px; height: 44px; min-width: 44px; min-height: 44px; border-radius: 50%; border: 2px solid rgba(255,255,255,.92); background: rgba(255,255,255,.74); color: #4A6A8A; font-size: 20px; line-height: 1; cursor: pointer; box-shadow: 0 2px 6px rgba(90,140,190,.25); font-family: inherit; touch-action: manipulation; }
      .dur-padbtn:active { transform: scale(.93); background: #FFE4EF; }
      .dur-note { text-align: center; color: #6E86A0; font-size: 13px; font-weight: 700; margin-top: 6px; min-height: 18px; line-height: 1.5; }
      .dur-handicap-hint { margin-top: 6px; }
      @media (max-width: 380px) {
        .dr-wrap { padding: 8px; }
        .dr-keys { font-size: 12px; gap: 6px; }
        .dr-keys span { padding: 4px 8px; }
        .dur-padbtn { font-size: 18px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dur-padbtn:active { transform: none; }
      }
      /* 放在最后:上面几条盖层自带 display:flex,权重一样时靠顺序压住它们 */
      .dr-wrap .dr-hidden { display: none; }
    </style>
    <div class="dr-panel dr-setup">
      <div>
        <div class="dr-label">🏁 选比赛方式</div>
        <div class="dr-seg dr-mode">
          <button type="button" data-v="rush" class="on">🏁 无尽竞速 · 先撞 ${CRASH_LIMIT} 次者输</button>
          <button type="button" data-v="items">✨ 道具竞速 · 道具＋中途分岔</button>
          <button type="button" data-v="ghost">👻 幽灵对战 · 追上一次的成绩</button>
          <button type="button" data-v="endless">♾️ 无尽对战 · 比谁远</button>
          <button type="button" data-v="coins">🪙 抢金币赛 · 先到 ${COIN_RACE_TARGET}</button>
        </div>
      </div>
      <div class="dr-rivalbox">
        <div class="dr-label">🙋 选对手</div>
        <div class="dr-seg dr-rival">
          <button type="button" data-v="human" class="on">${avatarHTML("xingxing", 22)} 两个人一起玩</button>
          ${AI_LEVELS.map((lv) => `<button type="button" data-v="${lv}">🤖 电脑 · ${AI_LABELS[lv]}</button>`).join("\n          ")}
        </div>
        <p class="dr-hint"></p>
      </div>
      <div class="dur-ghostbox dr-hidden">
        <div class="dr-label">👻 追谁的影子</div>
        <div class="dr-seg dur-ghostpick">
          <button type="button" data-v="self" class="on">👻 上次的自己</button>
          <button type="button" data-v="rival">🫥 对手上一局</button>
        </div>
      </div>
      <div>
        <div class="dr-label">🤝 让分模式（大人带小孩玩）</div>
        <div class="dr-seg dur-handicap">
          <button type="button" data-v="off" class="on">关闭 · 公平对跑</button>
          <button type="button" data-v="on">打开 · 落后的一方最多 +${Math.round(HANDICAP_MAX * 100)}%</button>
        </div>
        <p class="dr-hint dur-handicap-hint">默认关闭。打开以后画面上会一直写着「让分」，谁都看得见。</p>
      </div>
      <p class="dr-ghostline"></p>
      <div class="dr-menu-cta">
      <button class="dr-softbtn dr-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="dr-softbtn dr-collectbtn dr-hidden" type="button">🎁 我的收藏册</button>
      <button class="dr-start" type="button">准备好，开跑 ▶</button>
      </div>
    </div>
    <div class="dr-game dr-hidden">
      <div class="dur-stage">
        <canvas class="dr-canvas" role="img" aria-label="两人分屏赛道"></canvas>
        ${[0, 1]
          .map(
            (seat) => `<div class="dur-pad dur-pad-${seat}" data-seat="${seat}">
          ${PAD_BUTTONS.map(
            (b) =>
              `<button type="button" class="dur-padbtn" data-act="${b.action}" aria-label="${seat === 0 ? "朵朵" : "星星"}${b.label}">${b.emoji}</button>`,
          ).join("\n          ")}
        </div>`,
          )
          .join("\n        ")}
      </div>
      <div class="dr-keys">
        <span class="k1">${avatarHTML("duoduo", 18)} 朵朵 W 跳 · A 左 · S 滑 · D 右 · F 道具 · G 加油</span>
        <span class="k2">${avatarHTML("xingxing", 18)} 星星 ↑ 跳 · ← 左 · ↓ 滑 · → 右 · L 道具 · K 加油</span>
        <span>📱 各自在自己那半边滑动，右下角两颗按钮是道具和加油</span>
      </div>
      <div class="dr-btns">
        <button class="dr-pause" type="button">⏸ 暂停</button>
        <button class="dr-again" type="button">🔄 再来一局</button>
        <button class="dr-back" type="button">🔧 换玩法</button>
      </div>
      <div class="dr-msg"></div>
      <div class="dur-note"></div>
      <div class="dr-count dr-hidden"></div>
      <div class="dr-pausepanel dr-hidden">
        <h3>⏸ 暂停中</h3>
        <p>喝口水、揉揉手指，准备好再继续。<br>按 Esc 或点下面的按钮回到比赛。</p>
        <button class="dr-resume" type="button">▶ 继续比赛</button>
      </div>
    </div>
    <div class="dr-rules dr-hidden">
      <button class="dr-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵星双人冲刺 · 规则</h3>
      ${RULES_HTML}
    </div>
  `;
  api.root.appendChild(wrap);

  const pick = <T extends HTMLElement>(sel: string): T => wrap.querySelector(sel) as T;
  const setupEl = pick(".dr-setup");
  const gameEl = pick(".dr-game");
  const rulesEl = pick(".dr-rules");
  const countEl = pick(".dr-count");
  const pauseEl = pick(".dr-pausepanel");
  const msgEl = pick(".dr-msg");
  const noteEl = pick(".dur-note");
  const hintEl = pick(".dr-hint");
  const ghostLineEl = pick(".dr-ghostline");
  const rivalBox = pick(".dr-rivalbox");
  const ghostBox = pick(".dur-ghostbox");
  const pads: [HTMLElement, HTMLElement] = [pick(".dur-pad-0"), pick(".dur-pad-1")];
  const collectBtn = pick<HTMLButtonElement>(".dr-collectbtn");
  const canvas = pick<HTMLCanvasElement>(".dr-canvas");
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  if (hasCollection()) collectBtn.classList.remove("dr-hidden");

  /* ---------------- 画布尺寸 ---------------- */

  let size = { width: 360, height: 320, layout: "column" as SplitLayout };
  let panes: [Rect, Rect] = paneRects(size, size.layout);

  function relayout(): void {
    const avail = wrap.clientWidth - 24;
    size = stageSize(avail > 0 ? avail : 360);
    panes = paneRects(size, size.layout);
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutPads();
  }

  /** 触屏按钮贴在各自那半屏的内侧下角，位置由 `padRects` 算，两人永不重叠。 */
  function layoutPads(): void {
    for (const seat of [0, 1] as const) {
      const [first, second] = padRects(size, size.layout, seat);
      const el = pads[seat];
      el.style.left = `${first.x}px`;
      el.style.top = `${first.y}px`;
      el.style.width = `${second.x + second.width - first.x}px`;
      el.style.height = `${first.height}px`;
    }
  }
  relayout();

  let ro: ResizeObserver | null = null;
  const onResize = (): void => relayout();
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => relayout());
    ro.observe(wrap);
  } else {
    window.addEventListener("resize", onResize);
  }

  /* ---------------- 头像 ---------------- */

  const avatarImgs: Array<HTMLImageElement | null> = [null, null];
  for (const [i, who] of (["duoduo", "xingxing"] as const).entries()) {
    const url = avatarUrl(who);
    if (!url) continue;
    const img = new Image();
    img.src = url;
    avatarImgs[i] = img;
  }

  function avatarReady(i: number): HTMLImageElement | null {
    const img = avatarImgs[i];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  /* ---------------- 设置面板 ---------------- */

  function refreshHint(): void {
    if (mode === "ghost") {
      hintEl.textContent = "幽灵对战一个人就能跑，对手是一段录下来的配速。";
    } else if (aiLevel === null) {
      hintEl.textContent = "两个人一起玩：朵朵用左手 W A S D + F G，星星用右手方向键 + L K。";
    } else {
      hintEl.textContent = `电脑 · ${AI_LABELS[aiLevel]}：${AI_HINTS[aiLevel]}`;
    }
    rivalBox.style.opacity = mode === "ghost" ? "0.45" : "1";
    for (const b of Array.from(wrap.querySelectorAll<HTMLButtonElement>(".dr-rival button"))) {
      b.disabled = mode === "ghost";
    }
    ghostBox.classList.toggle("dr-hidden", mode !== "ghost");
    const snap = ghosts[ghostSource];
    ghostLineEl.textContent = snap
      ? ghostCaption(snap)
      : `${mode === "ghost" ? "" : "👻 "}还没有影子。先跑一局 ${GHOST_MIN_DIST} 米以上，它就会记下来。`;
  }

  function bindSeg(sel: string, onPick: (value: string) => void): void {
    pick(sel).addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn || btn.disabled) return;
      for (const b of Array.from(wrap.querySelectorAll(`${sel} button`))) b.classList.remove("on");
      btn.classList.add("on");
      api.play("tap");
      onPick(btn.dataset.v ?? "");
    });
  }

  bindSeg(".dr-mode", (v) => {
    mode = v as RaceMode;
    refreshHint();
  });
  bindSeg(".dr-rival", (v) => {
    aiLevel = v === "human" ? null : (Number(v) as AiLevel);
    refreshHint();
  });
  bindSeg(".dur-ghostpick", (v) => {
    ghostSource = v === "rival" ? "rival" : "self";
    refreshHint();
  });
  bindSeg(".dur-handicap", (v) => {
    handicapOn = v === "on";
    refreshHint();
  });
  refreshHint();

  /* ---------------- 开局与收尾 ---------------- */

  function startRace(): void {
    clearTimeout(endTimer);
    clearTimeout(countTimer);
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const snap = ghosts[ghostSource];
    state = createMatch({
      mode,
      seed,
      aiLevel,
      ghost: snap ? { dist: snap.dist, seconds: snap.seconds } : null,
      ghostSource,
      difficulty: levelSetup.tier,
      // 关号越高赛道越紧，第二档起主赛道也会出现分岔；道具竞速则一律带道具与分岔
      forks: mode === "items" || (levelSetup.tier >= 1 && mode !== "coins" && mode !== "ghost"),
      powerups: mode === "items",
      handicap: handicapOn,
    });
    running = false;
    paused = false;
    // 视觉状态跟着新一局清零（飘字 / 灰化 / 拾取计数都是演出，不进存档）
    outSince[0] = null;
    outSince[1] = null;
    coinFloats = [];
    prevCoins[0] = 0;
    prevCoins[1] = 0;
    pauseEl.classList.add("dr-hidden");
    setupEl.classList.add("dr-hidden");
    gameEl.classList.remove("dr-hidden");
    relayout();
    msgEl.textContent = openingLine();
    let n = 3;
    countEl.classList.remove("dr-hidden");
    countEl.textContent = "3";
    api.play("tap");
    const step = (): void => {
      if (destroyed) return;
      n--;
      if (n <= 0) {
        countEl.classList.add("dr-hidden");
        running = true;
        api.play("jump");
        return;
      }
      countEl.textContent = String(n);
      api.play("tap");
      countTimer = window.setTimeout(step, 700);
    };
    countTimer = window.setTimeout(step, 700);
  }

  function openingLine(): string {
    if (mode === "rush") return `两条赛道一模一样，先撞满 ${CRASH_LIMIT} 次的人输！`;
    if (mode === "items") {
      return "捡到道具按 F / L 用出去；分岔口站右道走右边那条，站左道或中道走左边那条！";
    }
    if (mode === "ghost") {
      const snap = ghosts[ghostSource];
      return snap
        ? `追上那个半透明的影子——超过 ${snap.dist} 米就赢了！`
        : "第一次跑，先把成绩留下来，下一局就有影子陪你了。";
    }
    if (mode === "coins") return `先吃到 ${COIN_RACE_TARGET} 枚金币就赢！`;
    return "三颗心用完就定格，比谁跑得远！";
  }

  /**
   * 把这一局留下来：自己那一趟存成「自己的影子」，
   * 真人对手 / 电脑那一趟存成「对手上一局」，两把 key 各存各的，谁也不覆盖谁。
   */
  function rememberGhost(s: MatchState): void {
    // 自己那份留**最好**的一次；对手那份留**上一局**（名字就叫「对手上一局」）
    const self = makeGhostSnapshot("self", s.runners[0].dist, s.time, s.runners[0].name);
    if (self && self.dist >= GHOST_MIN_DIST && self.dist > (ghosts.self?.dist ?? 0)) {
      ghosts.self = self;
      saveGhost(self);
    }
    if (s.runners[1].ghost) return;
    const rival = makeGhostSnapshot("rival", s.runners[1].dist, s.time, s.runners[1].name);
    if (rival && rival.dist >= GHOST_MIN_DIST) {
      ghosts.rival = rival;
      saveGhost(rival);
    }
  }

  /** 无尽类赛制的里程统一记进平台的无尽纪录（只增不减）。 */
  function rememberEndless(s: MatchState): number {
    if (s.mode === "coins") return save.getGameProgress(meta.id).endlessBest;
    return save.recordEndlessBest(meta.id, Math.floor(s.runners[0].dist));
  }

  function resultLine(s: MatchState): string {
    const [a, b] = s.runners;
    const meters = Math.floor(a.dist);
    if (s.winner === -1) {
      return `不分胜负！两个人都跑了 ${meters} 米，再来一局分高下。`;
    }
    if (s.mode === "ghost") {
      const best = s.ghost?.dist ?? 0;
      const who = s.ghostSource === "rival" ? "对手上一局" : "上一次";
      if (s.winner === 0) {
        return s.ghost
          ? `${s.ghostSource === "rival" ? "🫥" : "👻"} 追过去了！这一次 ${meters} 米，${who}只有 ${best} 米。`
          : `这一趟 ${meters} 米已经记下来啦，下一局就能和这个影子赛跑。`;
      }
      return `这一次 ${meters} 米，${who}跑到 ${best} 米。差的这一段，下一局补回来。`;
    }
    const w = s.winner === 0 ? a : b;
    const l = s.winner === 0 ? b : a;
    if (s.mode === "coins") {
      return `${w.emoji} ${w.name}先抢到 ${COIN_RACE_TARGET} 枚金币，获胜！`;
    }
    if (s.mode === "rush" || s.mode === "items") {
      return `${w.emoji} ${w.name}赢啦！${l.name}先撞满了 ${CRASH_LIMIT} 次（${w.name} ${Math.floor(w.dist)} 米 / ${l.name} ${Math.floor(l.dist)} 米）。`;
    }
    return `${w.emoji} ${w.name}赢啦！跑了 ${Math.floor(w.dist)} 米，对手 ${Math.floor(l.dist)} 米。`;
  }

  function onMatchOver(s: MatchState): void {
    running = false;
    rememberGhost(s);
    const best = rememberEndless(s);
    refreshHint();
    const text = resultLine(s);
    msgEl.textContent = text;
    noteEl.textContent =
      s.mode === "coins" ? "" : `📏 无尽最好成绩：${best} 米。慢慢来，每一局都在进步。`;
    api.play("win");
    clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (destroyed) return;
      api.onWin(1, text);
    }, 1600);
  }

  /* ---------------- 绘制 ---------------- */

  /* ---- 1.3 第 11 步 A：纯视觉状态（不进玩法存档、不碰判定） ---- */
  /** 金币的 8 帧旋转 sprite：挂载时烘焙一次，绘制时按深度缩放 */
  const coinSprite: CoinFrame[] = coinFrames(26);
  /** rAF 时钟（秒）：终局演出、淘汰灰化这些「比赛时间冻结后还要动」的动画用它 */
  let perfSec = 0;
  /** 一方淘汰的时刻（perfSec），灰化 0.3s 渐入用 */
  const outSince: [number | null, number | null] = [null, null];
  /** 吃金币的 +N 飘字（0.8 秒消散） */
  interface CoinFloat {
    seat: Seat;
    born: number;
    amount: number;
  }
  let coinFloats: CoinFloat[] = [];
  const prevCoins: [number, number] = [0, 0];

  function drawSky(pane: Rect, theme: Theme, dist: number): void {
    const hy = horizonY(pane);
    const g = ctx.createLinearGradient(0, pane.y, 0, hy + 6);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, pane.y, pane.width, hy - pane.y + 6);
    // 太阳 / 月亮 + 两朵慢云（视差 0.03），天空不再是一张纸
    drawCelestial(
      ctx,
      pane.x + pane.width * 0.82,
      pane.y + (hy - pane.y) * 0.4,
      pane.height * 0.055,
      theme.celestial,
    );
    const cloudPeriod = pane.width + 120;
    const cloudOff = parallaxOffset(dist, 0.03, cloudPeriod);
    for (const [k, fy, fr] of [
      [0.22, 0.3, 0.032],
      [0.62, 0.55, 0.026],
    ] as const) {
      const cx = pane.x + ((k * cloudPeriod + cloudPeriod - cloudOff) % cloudPeriod) - 60;
      drawCloudPuff(ctx, cx, pane.y + (hy - pane.y) * fy, pane.height * fr);
    }
    drawHills(pane, dist, theme.farHill, 0.06, pane.height * 0.16, hy + 2);
    drawHills(pane, dist, theme.nearHill, 0.16, pane.height * 0.1, hy + 2);
    drawDecorLayer(pane, theme, dist, hy + 2);
  }

  /** 第三层近景剪影：比两层山挪得更快，主题装饰（树 / 星塔）查表换装 */
  function drawDecorLayer(pane: Rect, theme: Theme, dist: number, baseY: number): void {
    const period = Math.max(90, pane.width * 0.52);
    const off = parallaxOffset(dist, 0.26, period);
    const h = pane.height * 0.09;
    const n = Math.ceil(pane.width / period) + 1;
    for (let i = 0; i <= n; i++) {
      const px = pane.x + i * period - off;
      drawDecorSilhouette(
        ctx,
        theme.decor,
        px,
        baseY,
        h * (i % 2 === 0 ? 1 : 0.72),
        theme.decorColor,
        theme.decorLight,
      );
    }
  }

  /** 远景视差层：一条平滑的周期曲线，所以左右接缝天然对得上 */
  function drawHills(
    pane: Rect,
    dist: number,
    color: string,
    factor: number,
    amp: number,
    baseY: number,
  ): void {
    const period = Math.max(60, pane.width * 0.75);
    const off = parallaxOffset(dist, factor, period);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pane.x, baseY);
    for (let x = 0; x <= pane.width; x += 6) {
      const t = ((x + off) / period) * Math.PI * 2;
      const h = amp * (0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.3 + 1.1));
      ctx.lineTo(pane.x + x, baseY - h);
    }
    ctx.lineTo(pane.x + pane.width, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /** 路面半宽（单位：车道）。最外侧车道中心在 1 车道处，多出来的就是路肩 */
  const ROAD_HALF = 1.55;

  function drawRoad(pane: Rect, theme: Theme, dist: number): void {
    const hy = horizonY(pane);
    const by = groundY(pane);
    // 路两边的草地
    const g = ctx.createLinearGradient(0, hy, 0, pane.y + pane.height);
    g.addColorStop(0, theme.field[1]);
    g.addColorStop(1, theme.field[0]);
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, hy, pane.width, pane.y + pane.height - hy);

    // 路面梯形
    const nearL = project(pane, 0, 1 - ROAD_HALF);
    const nearR = project(pane, 0, 1 + ROAD_HALF);
    const farL = project(pane, DRAW_DISTANCE, 1 - ROAD_HALF);
    const farR = project(pane, DRAW_DISTANCE, 1 + ROAD_HALF);
    ctx.fillStyle = theme.road;
    ctx.beginPath();
    ctx.moveTo(nearL.x, by + 2);
    ctx.lineTo(nearR.x, by + 2);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(farL.x, farL.y);
    ctx.closePath();
    ctx.fill();

    // 横向网格线：跟着人往后掠
    ctx.lineWidth = 1.5;
    for (const z of gridLineZs(dist, GRID_SPACING)) {
      const a = 1 - fogAlpha(z);
      if (a <= 0.02) continue;
      const l = project(pane, z, 1 - ROAD_HALF);
      const r = project(pane, z, 1 + ROAD_HALF);
      ctx.strokeStyle = `rgba(${theme.mark},${(0.3 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }

    // 车道分隔虚线：一段一段画，近处长远处短，透视自然
    for (const lane of [0.5, 1.5]) {
      for (const z of gridLineZs(dist, GRID_SPACING)) {
        const a = 1 - fogAlpha(z);
        if (a <= 0.02) continue;
        const p1 = project(pane, z, lane);
        const p2 = project(pane, z + GRID_SPACING * 0.5, lane);
        ctx.strokeStyle = `rgba(${theme.mark},${(0.85 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 7 * p1.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 路肩
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.roadEdge;
    for (const lane of [1 - ROAD_HALF, 1 + ROAD_HALF]) {
      const p1 = project(pane, 0, lane);
      const p2 = project(pane, DRAW_DISTANCE, lane);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 路边小旗与路牌：纯装饰，用 project 放在路肩外侧，跟着雾一起淡出
    const FLAG_SPACING = 46;
    for (const z of gridLineZs(dist, FLAG_SPACING)) {
      const a = 1 - fogAlpha(z);
      if (a <= 0.05) continue;
      const idx = Math.round((dist + z) / FLAG_SPACING);
      const p = project(pane, z, idx % 2 === 0 ? -1 : 3);
      const h = laneWidthAt(pane, z) * 0.5;
      if (h < 3) continue;
      ctx.save();
      ctx.globalAlpha = a;
      drawRoadsideFlag(ctx, p.x, p.y, h, theme.ink, idx % 4 < 2 ? 0 : 1);
      ctx.restore();
    }
  }

  function drawFog(pane: Rect, theme: Theme): void {
    const hy = horizonY(pane);
    const band = pane.height * 0.3;
    const g = ctx.createLinearGradient(0, hy, 0, hy + band);
    g.addColorStop(0, theme.sky[1]);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(pane.x, hy, pane.width, band);
  }

  function drawEntity(pane: Rect, e: Entity, z: number, seat: Seat, time: number, calm: boolean): void {
    const zz = Math.max(0, z);
    const p = project(pane, zz, e.lane);
    // 所有尺寸都按「这个深度上一条车道有多宽」换算，横竖分屏一个样
    const u = laneWidthAt(pane, zz);
    const alpha = 1 - fogAlpha(z);
    if (alpha <= 0.03 || u < 0.4) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (e.kind === "pit" || e.kind === "rock" || e.kind === "hurdle" || e.kind === "gate") {
      // 障碍材质在 art.ts：轮廓与判定尺寸和 1.2 完全一致，石头随座位主题换水晶/圆石
      drawObstacle(ctx, e.kind, p.x, p.y, u, seat);
    } else if (e.kind === "coin") {
      const cy = p.y - u * 0.42;
      ctx.fillStyle = "rgba(60,60,90,.12)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.14, u * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      // 8 帧绕 Y 旋转的星币；reduced-motion 下停在正面帧
      const frame = calm ? 0 : Math.floor(time * 9 + e.at * 0.5) % COIN_FRAME_COUNT;
      drawCoin(ctx, p.x, cy, u * 0.19, coinSprite, frame);
    } else if (e.kind === "power") {
      // 道具是一颗软软的糖泡，里面浮着绘制的小图标（emoji 下岗）
      const cy = p.y - u * 0.5;
      ctx.fillStyle = "rgba(60,60,90,.12)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, u * 0.16, u * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.beginPath();
      ctx.ellipse(p.x, cy, u * 0.24, u * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(178,150,220,.85)";
      ctx.lineWidth = Math.max(1, u * 0.03);
      ctx.stroke();
      // 泡壁高光弧
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = Math.max(1, u * 0.028);
      ctx.beginPath();
      ctx.ellipse(p.x, cy, u * 0.185, u * 0.185, 0, Math.PI * 1.08, Math.PI * 1.5);
      ctx.stroke();
      drawPowerIcon(ctx, e.power ?? "speedCloud", p.x, cy, u * 0.13);
    } else if (e.kind === "boost") {
      // 发光跑道箭头：三枚向前流动，reduced-motion 下静止
      drawBoostPad(ctx, p.x, p.y, u, boostArrowPhase(time, calm));
    }
    ctx.restore();
  }

  function drawRunner(pane: Rect, s: MatchState, r: Runner, seat: Seat, theme: Theme): void {
    const p = project(pane, RUNNER_Z, r.laneFloat);
    const jumpT = r.jumpUntil > s.time ? 1 - (r.jumpUntil - s.time) / JUMP_SECONDS : 0;
    const slideT = r.slideUntil > s.time ? 1 - (r.slideUntil - s.time) / SLIDE_SECONDS : 0;
    const lift = jumpArc(jumpT) * pane.height * JUMP_LIFT_RATIO * p.scale;
    const squash = slideT > 0 ? slideSquash(slideT) : 1;
    const base = laneWidthAt(pane, RUNNER_Z) * 0.6;
    const bodyH = base * squash;
    const calm = reducedMotion();
    const shake = bumpShake(r.bump, s.time, base, calm);
    const cx = p.x + shake;
    const cy = p.y - lift - bodyH / 2;
    // 换道中的轻侧倾：reduced-motion 下自动归零，位移照旧
    const tilt = (laneTiltDeg(r.lane, r.laneFloat, calm) * Math.PI) / 180;

    ctx.save();
    // 影子
    ctx.fillStyle = "rgba(60,60,90,.2)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, base * 0.42 * (1 - jumpArc(jumpT) * 0.4), base * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    if (tilt !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.translate(-cx, -cy);
    }

    const blink = s.time < r.safeUntil && Math.floor(s.time * 9) % 2 === 0;
    if (r.ghost) ctx.globalAlpha = 0.45;
    else if (blink) ctx.globalAlpha = 0.3;

    // 1.3：emoji 全部下岗，身体改画 art.ts 的双主角（朵朵 = 花苞裙摆，星星 = 星呆毛披风）
    const footY = p.y - lift;
    const headY = runnerHeadY(footY, base, squash);
    const mood: RunnerMood =
      r.out && !r.ghost ? "dizzy" : r.ghost ? "ghost" : slideT > 0 ? "slide" : jumpT > 0 ? "jump" : "run";
    const bounce = mood === "dizzy" ? 0 : Math.abs(Math.sin(s.time * 11)) * base * 0.07;
    const img = mood === "run" || mood === "jump" || mood === "slide" ? avatarReady(seat) : null;

    if (img) {
      // 自定义头像：沿 1.2 的椭圆裁剪 drawImage，外加座位色描边环
      drawAvatarBody(ctx, img, cx, cy - bounce, base, bodyH, seat);
    } else {
      drawRunnerSprite(ctx, {
        who: seat,
        x: cx,
        footY,
        unit: base,
        squash,
        bounce,
        runPhase: calm ? 0 : s.time * 11,
        mood,
        time: s.time,
        reduced: calm,
      });
    }

    if (mood === "dizzy") {
      // 被撞定格：×眼 + 三颗星绕头（reduced 下星星不转），没有痛苦表现
      drawDizzyStars(ctx, cx, headY, base, s.time, calm);
    }
    if (r.ghost) {
      // 幽灵回放：半透明本体 + 头顶一簇小火苗
      drawGhostWisp(ctx, cx, headY, base, s.time, calm);
    }
    if (!r.out && !r.ghost) {
      // 加速尾焰：三根速度线 + 两粒星屑（reduced 下线不抖、星屑不撒）
      if (s.time < r.boostUntil) drawSpeedTrail(ctx, cx, cy, base, s.time, calm);
      // 下滑时地面扬起一道小尘
      if (slideT > 0) {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.beginPath();
        ctx.ellipse(cx - base * 0.5, p.y, base * 0.3, base * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 护盾泡：一圈半透明的光壳裹着人
      if (r.powers.shield > 0) {
        ctx.strokeStyle = "rgba(140,200,255,.9)";
        ctx.lineWidth = Math.max(1.5, base * 0.07);
        ctx.beginPath();
        ctx.ellipse(cx, footY - base * 0.62 * squash, base * 0.62, base * 0.74 * squash, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 被撒了彩纸：头顶飘几片纸屑，慢一点点而已
      if (r.powers.confetti > 0) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ["#FFC6DC", "#B9D4FA", "#FFE39B"][i];
          const dx = Math.sin(s.time * 6 + i * 2) * base * 0.35;
          ctx.fillRect(cx + dx, headY - base * 0.5 - i * base * 0.16, base * 0.12, base * 0.08);
        }
      }
      // 加油：绘制的心形往上飘，纯打气
      if (s.time < r.cheerUntil) {
        const prog = 1 - Math.max(0, r.cheerUntil - s.time) / CHEER_SECONDS;
        drawCheerHeart(ctx, cx + base * 0.72, headY, base, prog, calm);
      }
    }
    ctx.restore();
    // 领先者头顶一顶绘制的小金冠（落后的一方什么都不写，绝不出现羞辱文案）
    if (!r.ghost && !r.out && leaderSeat(s) === seat) {
      ctx.save();
      drawCrown(ctx, p.x, cy - crownOffset(base) - base * 0.32, base * 0.4);
      ctx.restore();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    void theme;
  }

  // ---- HUD 手绘化(r2 · B 档 TOP1):emoji 字符不再上画布 ----
  // 1.2 的 hudText 把 r.emoji/❤️🤍/🪙/✋+道具 emoji 拼成一整串 fillText,
  // 与 gold-hook「HUD 图标全手绘」口径不齐。现在拆成 token:文字照旧,
  // 图标全部走 art.ts 的现成资产(drawMiniFace/drawHeart/drawCoinFrame/drawPowerIcon)。
  type HudToken =
    | { kind: "text"; text: string }
    | { kind: "face" }
    | { kind: "wisp" }
    | { kind: "heart"; filled: boolean }
    | { kind: "coin" }
    | { kind: "slot"; power: PowerKind | null }
    | { kind: "power"; power: PowerKind };

  /** 身上还挂着的道具效果，画成一串手绘小图标（没有就返回空数组） */
  function activePowerIcons(r: Runner): PowerKind[] {
    const on: PowerKind[] = [];
    if (r.powers.speedCloud > 0) on.push("speedCloud");
    for (let i = 0; i < r.powers.shield; i++) on.push("shieldBubble");
    if (r.powers.magnetStar > 0) on.push("magnetStar");
    if (r.powers.confetti > 0) on.push("confetti");
    return on;
  }

  /** 正走在哪条支路：左路 / 右路，加一个「稳」或「快」的小标记（纯文字，不再配 emoji） */
  function branchTag(s: MatchState, r: Runner): string {
    const fork: ForkSection | undefined = s.forks.find((f) => f.at === r.branchAt);
    if (!fork || r.branch === null) return "";
    const side = fork.branches[r.branch].side === "left" ? "左路" : "右路";
    const mine = fork.branches[r.branch];
    const other = fork.branches[r.branch === 0 ? 1 : 0];
    return `${side}${mine.difficulty <= other.difficulty ? "·稳" : "·快"}`;
  }

  /** HUD 压成一行：小脸 + 名字 + 里程 + 金币 + 心 + 道具槽 + 身上的效果 + 让分标注 */
  function hudTokens(s: MatchState, r: Runner, seat: Seat): HudToken[] {
    const lives = livesLeft(s, seat);
    const out: HudToken[] = [r.ghost ? { kind: "wisp" } : { kind: "face" }];
    out.push({ kind: "text", text: `${r.name}　${Math.floor(r.dist)} 米　` });
    out.push({ kind: "coin" });
    out.push({ kind: "text", text: ` ${r.coins}` });
    if (!r.ghost) {
      out.push({ kind: "text", text: "　" });
      for (let i = 0; i < CRASH_LIMIT; i++) out.push({ kind: "heart", filled: i < lives });
    }
    if (s.usePowerups && !r.ghost) {
      out.push({ kind: "text", text: "　" });
      out.push({ kind: "slot", power: r.held });
      for (const p of activePowerIcons(r)) out.push({ kind: "power", power: p });
    }
    if (r.branch !== null) {
      const tag = branchTag(s, r);
      if (tag) out.push({ kind: "text", text: `　${tag}` });
    }
    const other = s.runners[seat === 0 ? 1 : 0];
    const boost = r.ghost ? 1 : handicapMult(s.handicap, r.dist, other.dist);
    if (boost > 1) out.push({ kind: "text", text: `　让分 +${Math.round((boost - 1) * 100)}%` });
    return out;
  }

  /** 一枚 HUD token 画在槽位中心（文字除外，文字从槽位左缘起笔）。 */
  function drawHudToken(tk: HudToken, x: number, slotW: number, fs: number, seat: Seat, theme: Theme): void {
    const cx = x + slotW / 2;
    switch (tk.kind) {
      case "text":
        ctx.fillStyle = theme.ink;
        ctx.fillText(tk.text, x, 0);
        break;
      case "face":
        drawMiniFace(ctx, cx, fs * 0.08, fs * 0.38, seat);
        break;
      case "wisp":
        drawGhostWisp(ctx, cx, fs * 0.62, fs * 1.7, 0, true);
        break;
      case "heart":
        drawHeart(ctx, cx, 0, fs * 0.42, "#FF7EA8", tk.filled);
        break;
      case "coin":
        drawCoinFrame(ctx, cx, 0, fs * 0.42, coinFrameSpec(0));
        break;
      case "slot": {
        // 手里的道具槽:白圆底板,有货画图标,空槽画一道小横杠(替代旧的小手+道具字符)
        ctx.fillStyle = "rgba(255,255,255,.78)";
        ctx.strokeStyle = "rgba(90,90,110,.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, 0, fs * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (tk.power) drawPowerIcon(ctx, tk.power, cx, 0, fs * 0.32);
        else {
          ctx.strokeStyle = "rgba(90,90,110,.6)";
          ctx.lineWidth = Math.max(1.2, fs * 0.1);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx - fs * 0.2, 0);
          ctx.lineTo(cx + fs * 0.2, 0);
          ctx.stroke();
        }
        break;
      }
      case "power":
        drawPowerIcon(ctx, tk.power, cx, 0, fs * 0.34);
        break;
    }
  }

  function drawHud(pane: Rect, s: MatchState, r: Runner, seat: Seat, theme: Theme): void {
    const fs = Math.max(10, Math.min(17, Math.round(pane.height * 0.085)));
    const pad = Math.round(fs * 0.5);
    const tokens = hudTokens(s, r, seat);
    ctx.save();
    ctx.font = `800 ${fs}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    // 1.2 的挤压逻辑保留：先量「图标槽 + 文字」总宽，窄屏放不下就整条横向缩放，
    // 绝不换行、绝不溢出自己那一格
    const slotW = fs * 1.16;
    const widths = tokens.map((tk) => (tk.kind === "text" ? ctx.measureText(tk.text).width : slotW));
    const raw = widths.reduce((a, b) => a + b, 0);
    const room = pane.width - pad * 3;
    const squeeze = raw > room ? room / raw : 1;
    const w = Math.min(raw, room) + pad * 2;
    ctx.fillStyle = theme.hud;
    ctx.beginPath();
    ctx.roundRect(pane.x + pad, pane.y + pad, w, fs + pad * 1.4, 10);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.translate(pane.x + pad * 2, pane.y + pad + (fs + pad * 1.4) / 2);
    ctx.scale(squeeze, 1);
    let tx = 0;
    for (let i = 0; i < tokens.length; i++) {
      drawHudToken(tokens[i], tx, slotW, fs, seat, theme);
      tx += widths[i];
    }
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function drawPane(pane: Rect, s: MatchState, seat: Seat): void {
    const r = s.runners[seat];
    const theme = THEMES[seat];
    const calm = reducedMotion();
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    drawSky(pane, theme, r.dist);
    drawRoad(pane, theme, r.dist);

    // 远的先画、近的后画，遮挡关系才对。在分岔支路上就画支路的东西。
    const view = entitiesFor(s, seat);
    const visible: Array<{ e: Entity; z: number }> = [];
    for (let i = view.from; i < view.entities.length; i++) {
      const z = view.entities[i].at - r.dist;
      if (z > DRAW_DISTANCE) break;
      if (z < -1) continue;
      visible.push({ e: view.entities[i], z });
    }
    for (let i = visible.length - 1; i >= 0; i--) {
      drawEntity(pane, visible[i].e, visible[i].z, seat, s.time, calm);
    }

    drawRunner(pane, s, r, seat, theme);
    drawCoinFloats(pane, s, seat, calm);
    drawFog(pane, theme);
    drawHud(pane, s, r, seat, theme);

    if (r.out) {
      // 温柔灰化：0.3 秒渐入（reduced-motion 直接到位），文案沿用不羞辱的口径
      if (outSince[seat] === null) outSince[seat] = perfSec;
      const fade = calm ? 1 : Math.min(1, (perfSec - (outSince[seat] ?? perfSec)) / 0.3);
      ctx.fillStyle = `rgba(60,60,90,${(0.42 * fade).toFixed(3)})`;
      ctx.fillRect(pane.x, pane.y, pane.width, pane.height);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.round(pane.height * 0.1)}px "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        r.ghost ? `幽灵跑完了 ${Math.floor(r.dist)} 米` : `${Math.floor(r.dist)} 米 · 停下了`,
        pane.x + pane.width / 2,
        pane.y + pane.height / 2,
      );
      ctx.restore();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
  }

  /** 吃到金币的 +N 飘字与三粒星屑（reduced-motion：不飘不撒，只淡出） */
  function drawCoinFloats(pane: Rect, s: MatchState, seat: Seat, calm: boolean): void {
    const r = s.runners[seat];
    const p = project(pane, RUNNER_Z, r.laneFloat);
    const base = laneWidthAt(pane, RUNNER_Z) * 0.6;
    for (const f of coinFloats) {
      if (f.seat !== seat) continue;
      const age = (perfSec - f.born) / 0.8;
      if (age < 0 || age >= 1) continue;
      const rise = calm ? 0 : age * base * 0.6;
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = "#C2861A";
      ctx.font = `800 ${Math.max(14, Math.round(base * 0.3))}px "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${f.amount}`, p.x, p.y - base * 1.5 - rise);
      for (let i = 0; i < sparkleCount(calm); i++) {
        const a = age * 2 + (i * Math.PI * 2) / 3;
        drawSparkle(
          ctx,
          p.x + Math.cos(a) * base * (0.3 + age * 0.3),
          p.y - base * 1.4 - rise + Math.sin(a) * base * 0.18,
          base * 0.07,
        );
      }
      ctx.restore();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /** 两格之间的粉彩描边：外面一圈粉、里面一条白，谁是谁的地盘一眼看得清 */
  function drawDivider(): void {
    const line = (w: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      if (size.layout === "column") {
        ctx.moveTo(0, size.height / 2);
        ctx.lineTo(size.width, size.height / 2);
      } else {
        ctx.moveTo(size.width / 2, 0);
        ctx.lineTo(size.width / 2, size.height);
      }
      ctx.stroke();
    };
    ctx.save();
    line(7, "rgba(242,160,192,.85)");
    line(3, "rgba(255,255,255,.95)");
    ctx.restore();
  }

  function render(): void {
    if (!state) return;
    ctx.clearRect(0, 0, size.width, size.height);
    drawPane(panes[0], state, 0);
    drawPane(panes[1], state, 1);
    drawDivider();
    drawPaceStrip(state);
    if (state.over) drawFinish(state);
  }

  /** 进度换算：抢金币赛看金币数，其余看里程（领先者顶格，另一方按比例） */
  function paceProgress(s: MatchState): [number, number] {
    if (s.mode === "coins") {
      const c = (i: 0 | 1): number => Math.min(1, s.runners[i].coins / COIN_RACE_TARGET);
      return [c(0), c(1)];
    }
    const lead = Math.max(s.runners[0].dist, s.runners[1].dist, 1);
    return [s.runners[0].dist / lead, s.runners[1].dist / lead];
  }

  /** 分屏中缝上的进度对比条：两张迷你脸在同一条轨上跑，隔着分屏也一眼看出差距 */
  function drawPaceStrip(s: MatchState): void {
    const w = Math.min(200, size.width * 0.4);
    const h = 16;
    const x = size.width / 2 - w / 2;
    const y = size.height / 2 - h / 2;
    const [a, b] = paceProgress(s);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(242,160,192,.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(190,205,225,.9)";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h / 2);
    ctx.lineTo(x + w - 10, y + h / 2);
    ctx.stroke();
    // 并排微错开：打平的时候两张脸也都看得见
    const run = w - 20;
    drawMiniFace(ctx, x + 10 + run * a, y + h / 2 - 3, 5.5, 0);
    drawMiniFace(ctx, x + 10 + run * b, y + h / 2 + 3, 5.5, 1);
    ctx.restore();
  }

  /** 终点演出：冲线彩带 + 双人名次卡（胜者小人跳一跳；reduced-motion 下彩带定格） */
  function drawFinish(s: MatchState): void {
    const calm = reducedMotion();
    const colors = ["#FFC6DC", "#B9D4FA", "#FFE39B", "#C9F0D9"];
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const px = (((i * 79) % 97) / 97) * size.width;
      const fall = calm
        ? (((i * 53) % 100) / 100) * size.height
        : ((perfSec * 60 + i * 67) % (size.height + 40)) - 20;
      ctx.save();
      ctx.translate(px, fall);
      ctx.rotate(calm ? i : i + perfSec * (i % 2 === 0 ? 2.2 : -1.8));
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    if (s.winner === 0 || s.winner === 1) {
      const w = Math.min(230, size.width * 0.72);
      const h = 74;
      const x = size.width / 2 - w / 2;
      const y = size.height / 2 - h / 2;
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
      ctx.strokeStyle = "#F2A0C0";
      ctx.lineWidth = 2;
      ctx.stroke();
      const rows: Array<[Seat, string]> =
        s.winner === 0
          ? [
              [0, "第 1 名"],
              [1, "第 2 名"],
            ]
          : [
              [1, "第 1 名"],
              [0, "第 2 名"],
            ];
      ctx.font = `800 14px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      rows.forEach(([seat, label], row) => {
        const ry = y + 20 + row * 34;
        const hop = row === 0 && !calm ? Math.abs(Math.sin(perfSec * 6)) * 4 : 0;
        drawMiniFace(ctx, x + 22, ry - hop, 9, seat);
        if (row === 0) drawCrown(ctx, x + 22, ry - hop - 15, 14);
        ctx.fillStyle = row === 0 ? "#C2497E" : "#6E86A0";
        ctx.fillText(`${s.runners[seat].name} · ${label}`, x + 40, ry);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
  }

  const LANE_NAMES = ["左道", "中道", "右道"];
  let lastLabelAt = 0;

  /** 画面是 canvas，读屏软件看不见，所以每 0.2 秒把两个人的处境写成一句话挂上去。 */
  function refreshAriaLabel(s: MatchState, now: number): void {
    if (now - lastLabelAt < 200) return;
    lastLabelAt = now;
    const part = (seat: Seat): string => {
      const r = s.runners[seat];
      return `${r.name}${LANE_NAMES[r.lane]}${Math.floor(r.dist)}米金币${r.coins}剩${livesLeft(s, seat)}`;
    };
    canvas.setAttribute("aria-label", `${part(0)}，${part(1)}`);
  }

  /* ---------------- 主循环 ---------------- */

  const SOUND_OF: Partial<Record<string, SoundName>> = {
    coin: "coin",
    boost: "pop",
    jump: "jump",
    slide: "tap",
    crash: "oops",
    power: "coin",
    use: "pop",
    shield: "pop",
    confetti: "tap",
    cheer: "meow",
    fork: "tap",
    merge: "tap",
  };

  function playEvents(s: MatchState): void {
    const played = new Set<string>();
    for (const ev of drainEvents(s)) {
      const sound = SOUND_OF[ev];
      if (!sound || played.has(ev)) continue;
      played.add(ev);
      api.play(sound);
    }
  }

  /** 只做拾取反馈：金币数涨了就冒 +N 飘字（纯演出，不碰任何成绩） */
  function trackCoinPickups(s: MatchState): void {
    for (const seat of [0, 1] as const) {
      const gain = s.runners[seat].coins - prevCoins[seat];
      if (gain > 0) coinFloats.push({ seat, born: perfSec, amount: gain });
      prevCoins[seat] = s.runners[seat].coins;
    }
    if (coinFloats.length > 8) coinFloats = coinFloats.slice(-8);
  }

  let lastFrame = 0;
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    perfSec = now / 1000;
    const s = state;
    if (s && !gameEl.classList.contains("dr-hidden")) {
      if (running && !paused && !s.over) {
        stepMatch(s, dt);
        playEvents(s);
        trackCoinPickups(s);
        if (s.over) onMatchOver(s);
      } else {
        drainEvents(s);
      }
      render();
      refreshAriaLabel(s, now);
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- 输入 ---------------- */

  function seatCanPlay(seat: Seat): boolean {
    if (!state) return false;
    if (seat === 1 && (state.ai !== null || state.runners[1].ghost)) return false;
    return true;
  }

  function doAction(seat: Seat, action: Action): void {
    if (!state || !running || paused || state.over) return;
    if (!seatCanPlay(seat)) return;
    applyAction(state, seat, action);
    playEvents(state);
  }

  function setPaused(next: boolean): void {
    if (!state || !running || state.over) return;
    paused = next;
    pauseEl.classList.toggle("dr-hidden", !paused);
    api.play("tap");
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (gameEl.classList.contains("dr-hidden")) return;
    if (isPauseKey(e.key)) {
      if (running && !state?.over) {
        e.preventDefault();
        e.stopPropagation();
        setPaused(!paused);
      }
      return;
    }
    const hit = resolveKey(e.code);
    if (!hit) return;
    if (isWatchedKey(e.code)) e.preventDefault();
    doAction(hit.seat, hit.action);
  };
  window.addEventListener("keydown", onKeyDown);

  /* 手机：左右（或上下）半屏各自识别滑动 */
  const touches = new Map<number, { seat: Seat; x: number; y: number; used: boolean }>();

  const rectOf = (): DOMRect => canvas.getBoundingClientRect();

  const onPointerDown = (e: PointerEvent): void => {
    const rect = rectOf();
    const x = ((e.clientX - rect.left) / rect.width) * size.width;
    const y = ((e.clientY - rect.top) / rect.height) * size.height;
    touches.set(e.pointerId, { seat: seatAtPoint(x, y, size, size.layout), x, y, used: false });
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    const t = touches.get(e.pointerId);
    if (!t || t.used) return;
    const rect = rectOf();
    const x = ((e.clientX - rect.left) / rect.width) * size.width;
    const y = ((e.clientY - rect.top) / rect.height) * size.height;
    const action = swipeAction(x - t.x, y - t.y);
    if (!action) return;
    t.used = true;
    doAction(t.seat, action);
  };

  const onPointerUp = (e: PointerEvent): void => {
    const t = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (!t || t.used) return;
    doAction(t.seat, "jump"); // 没滑动就当轻点一下，跳一下
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  /* 手机：每半屏右下角两颗圆按钮，等价于键盘的 F/G 与 L/K */
  const onPadClick = (e: Event): void => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".dur-padbtn");
    if (!btn) return;
    const seat = Number(btn.parentElement?.dataset.seat ?? 0) === 1 ? 1 : 0;
    const act = btn.dataset.act === "cheer" ? "cheer" : "use";
    e.preventDefault();
    doAction(seat as Seat, act);
  };
  for (const pad of pads) pad.addEventListener("click", onPadClick);

  /* ---------------- 按钮 ---------------- */

  pick<HTMLButtonElement>(".dr-start").addEventListener("click", () => {
    api.play("jump");
    startRace();
  });
  pick<HTMLButtonElement>(".dr-again").addEventListener("click", () => {
    api.play("tap");
    startRace();
  });
  pick<HTMLButtonElement>(".dr-pause").addEventListener("click", () => setPaused(!paused));
  pick<HTMLButtonElement>(".dr-resume").addEventListener("click", () => setPaused(false));
  pick<HTMLButtonElement>(".dr-back").addEventListener("click", () => {
    clearTimeout(endTimer);
    clearTimeout(countTimer);
    if (state && !state.over) rememberGhost(state);
    state = null;
    running = false;
    paused = false;
    pauseEl.classList.add("dr-hidden");
    countEl.classList.add("dr-hidden");
    gameEl.classList.add("dr-hidden");
    setupEl.classList.remove("dr-hidden");
    refreshHint();
    api.play("tap");
  });
  pick<HTMLButtonElement>(".dr-rulesbtn").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("dr-hidden");
  });
  pick<HTMLButtonElement>(".dr-rules-close").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("dr-hidden");
  });
  collectBtn.addEventListener("click", () => {
    api.play("tap");
    void openCollectionSafely();
  });

  raf = requestAnimationFrame((t) => {
    lastFrame = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      clearTimeout(countTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      for (const pad of pads) pad.removeEventListener("click", onPadClick);
      ro?.disconnect();
      ro = null;
      touches.clear();
      state = null;
      wrap.remove();
    },
  };
}

/** 供设置面板与攻略引用：四档电脑的名字（避免文案与逻辑各写一份） */
export const AI_CHOICES = AI_LEVELS.map((level) => ({
  level,
  label: AI_LABELS[level],
  hint: AI_HINTS[level],
}));

/** 供外部（冒烟脚本）确认当前赛制名字 */
export function modeLabel(m: RaceMode): string {
  return MODE_LABELS[m];
}
