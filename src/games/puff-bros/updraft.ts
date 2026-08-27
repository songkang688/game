/**
 * 噗噗兄弟 · 无尽「上升气流」(纯数据 + 纯函数)。
 *
 * 一股越吹越急的上升气流把整座泡泡糖塔往上顶,噗噗兄弟只能一层一层往上爬:
 *
 *  - 每一段是一屏,底下**没有地板**(整条底边都是坑),只能踩浮台和机关;
 *  - 爬到最高那一层就算过了这一段,接着换下一段,高度一路累加;
 *  - 脚底下有一条**不断上升的气流线**,越待越往上追,被它追上就开始打转
 *    (`bounds.ts` 的两段式:先打转,还有一次自救的机会,救不回来才结束);
 *  - 掉出屏底同理 —— 先打转再出局,出局就结算这一趟,高度写进
 *    `save.recordEndlessBest("puff-bros", height)`。
 *
 * 高度按「米」记,一段 SECTION_METERS 米,段内按爬到第几层线性折算,
 * 所以读数是单调的:爬得越高,数字越大。
 */
import {
  ARENA_H,
  ARENA_W,
  CHAPTERS,
  FLOOR_Y,
  MAX_ROWS,
  WALL,
  buildSupportTree,
  rowSurface,
  surfaceSpans,
  surfaceY,
  type ArenaDef,
  type CandyDef,
  type MonsterDef,
  type SpawnDef,
} from "./arena";
import { gadget, type GadgetDef } from "./gadgets";
import { mulberry32, randInt } from "../level99";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 爬完一段算多少米 */
export const SECTION_METERS = 20;
/** 一段有几层(最高那一层就是这一段的终点) */
export const CLIMB_ROWS = MAX_ROWS;
/** 气流线一开始待在屏底以下多远(留一段热身) */
export const LINE_START = 46;
/** 气流线的初速(px/s):慢慢往上追 */
export const LINE_SPEED0 = 8.5;
/** 每爬高一段,气流线追得更急一点 */
export const LINE_SPEED_STEP = 1.6;
/** 再急也就这么急,不然后面纯靠手速 */
export const LINE_SPEED_MAX = 26;
/** 一段里最多放几只咕噜怪 —— 上升气流是跑酷,不是清场 */
export const CLIMB_MONSTERS_MAX = 3;

/** 第 section 段的气流线上升速度(px/s) */
export function lineSpeed(section: number): number {
  const s = Math.max(0, Math.round(section));
  return Math.min(LINE_SPEED_MAX, LINE_SPEED0 + s * LINE_SPEED_STEP);
}

/** 第 section 段、进去 t 秒之后,气流线在哪个高度(y 越小越高) */
export function lineY(section: number, t: number): number {
  return FLOOR_Y + LINE_START - lineSpeed(section) * Math.max(0, t);
}

/** 这一段的终点高度:最高那一层的上表面 */
export function climbGoalY(): number {
  return rowSurface(CLIMB_ROWS);
}

/**
 * 当前高度(米)。已经爬完 sections 段,这一段人踩在 row 层上。
 * row 从 0(还在最底下)数到 CLIMB_ROWS(踩上终点层)。
 */
export function climbHeight(sections: number, row: number): number {
  const done = Math.max(0, Math.round(sections)) * SECTION_METERS;
  const within = (Math.min(CLIMB_ROWS, Math.max(0, row)) / CLIMB_ROWS) * SECTION_METERS;
  return Math.round(done + within);
}

/** 高度读成一句话 */
export function heightLine(meters: number): string {
  return `${Math.max(0, Math.round(meters))} 米`;
}

// ---------------------------------------------------------------------------
// 段落生成
// ---------------------------------------------------------------------------

/**
 * 生成上升气流的第 section 段(0 基)。同一个段号每次生成的结果完全一样。
 *
 * 摆放规矩:
 *  - 浮台照 `arena.ts` 的支撑树来,所以每一层都跳得上去、也回得来;
 *  - 底下整条是坑,起点在第 1 层的浮台上;
 *  - 每一段至少有一根气流管和一朵弹簧云 —— 它们是这个模式的主角;
 *  - 段号越大,机关越多、咕噜怪越多。
 */
export function buildClimbSection(section: number): ArenaDef {
  const s = Math.max(0, Math.round(section));
  const rand = mulberry32(0x11cbb1 + s * 26417 + 31);
  const ci = s % CHAPTERS.length;

  const platforms = buildSupportTree(rand, CLIMB_ROWS, 3);
  const spans = surfaceSpans(platforms).filter((sp) => sp.id >= 0);
  const topRow = platforms.reduce((m, p) => Math.max(m, p.row), 0);

  // 起点:最低那一层里最靠左的一块,站在它的中点上
  const bottom = platforms
    .map((p, i) => ({ p, i }))
    .filter((e) => e.p.row === 1)
    .sort((a, b) => a.p.x - b.p.x);
  const startAt = bottom[0] ?? { p: platforms[0], i: 0 };
  const startX = Math.round(startAt.p.x + startAt.p.w / 2);
  const spawns: SpawnDef[] = [
    { x: startX, surface: startAt.i },
    { x: startX, surface: startAt.i },
  ];

  // ---- 机关 ----
  const gadgets: GadgetDef[] = [];
  // 气流管:架在最低那一层的浮台正上方,顺着它往上飘一层
  gadgets.push(
    gadget("updraft", Math.round(startAt.p.x + startAt.p.w * 0.5), rowSurface(1), { under: startAt.i })
  );
  // 弹簧云:摆在另一块低层浮台上
  const springOn = bottom[1] ?? bottom[0] ?? { p: platforms[0], i: 0 };
  gadgets.push(gadget("spring", Math.round(springOn.p.x + springOn.p.w * 0.32), springOn.p.y, {
    under: springOn.i,
  }));
  // 中层再补一根气流管,越往上越难爬
  const mid = platforms.map((p, i) => ({ p, i })).filter((e) => e.p.row === 2);
  if (mid.length > 0) {
    const m = mid[randInt(rand, 0, mid.length - 1)];
    gadgets.push(gadget("updraft", Math.round(m.p.x + m.p.w * 0.5), m.p.y, { under: m.i }));
  }
  // 第三段起加一块脆弱地板当捷径:踩两下就碎,得赶紧走
  if (s >= 2 && mid.length > 0) {
    const m = mid[mid.length - 1];
    gadgets.push(
      gadget("brittle", Math.round(m.p.x + m.p.w * 0.5), Math.round(rowSurface(2) - 34), { under: m.i })
    );
  }
  // 第五段起补一对传送泡:一颗在低层,一颗在顶层,按 ⬇ 直达
  if (s >= 4 && platforms.some((p) => p.row === CLIMB_ROWS)) {
    const top = platforms.map((p, i) => ({ p, i })).filter((e) => e.p.row === CLIMB_ROWS)[0];
    const a = gadgets.length;
    gadgets.push(gadget("warp", Math.round(startAt.p.x + startAt.p.w * 0.8), startAt.p.y, {
      under: startAt.i,
      link: a + 1,
    }));
    gadgets.push(gadget("warp", Math.round(top.p.x + top.p.w * 0.5), top.p.y, { under: top.i, link: a }));
  }
  // 第二段起放一个可推箱:推下去能砸开路,也能当垫脚
  if (s >= 1 && mid.length > 0) {
    const m = mid[0];
    gadgets.push(gadget("crate", Math.round(m.p.x + m.p.w * 0.75), m.p.y, { under: m.i }));
  }

  // ---- 咕噜怪:只在中层放一两只,别把跑酷变成清场 ----
  const monsters: MonsterDef[] = [];
  const want = Math.min(CLIMB_MONSTERS_MAX, Math.floor(s / 2));
  for (let i = 0; i < want && i < mid.length; i++) {
    const m = mid[i];
    const x0 = m.p.x + 22;
    const x1 = m.p.x + m.p.w - 22;
    if (x1 - x0 < 40) continue;
    monsters.push({
      kind: s % 3 === 2 ? "hopper" : "walker",
      x: Math.round((x0 + x1) / 2),
      surface: m.i,
      minX: x0,
      maxX: x1,
      speed: 34 + Math.min(30, s * 3),
      dir: 1,
    });
  }

  // ---- 糖果:一层一颗,顺路捡 ----
  const candies: CandyDef[] = spans
    .filter((sp) => sp.x1 - sp.x0 >= 70)
    .map((sp) => ({ x: Math.round((sp.x0 + sp.x1) / 2), surface: sp.id }));

  return {
    kind: "climb",
    index: s,
    chapterIndex: ci,
    name: `上升气流 · 第 ${s + 1} 段`,
    feature: "一路往上爬",
    hint: "脚底下的气流线一直在往上追!踩浮台、钻气流管、跳弹簧云,爬到最高那一层就过了这一段。",
    platforms,
    monsters,
    candies,
    spawns,
    gadgets,
    // 底下整条都是坑:掉出去先打转,救不回来才结束
    pits: [{ x0: WALL, x1: ARENA_W - WALL }],
    climbRow: topRow,
    hearts: 1,
    parSeconds: 40,
    candyGoal: 0,
    timeLimit: 0,
    roundTarget: 0,
  };
}

/** 这一段爬到 y 这个高度算第几层(供高度换算用) */
export function rowAtY(platforms: readonly { y: number; row: number }[], y: number): number {
  let best = 0;
  for (const p of platforms) {
    if (Math.abs(p.y - y) < 1) best = Math.max(best, p.row);
  }
  return best;
}

/** 站在 surface 这块地面上算第几层 */
export function rowOfSurface(def: ArenaDef, surface: number): number {
  if (surface < 0 || surface >= def.platforms.length) return 0;
  return def.platforms[surface].row;
}

/** 屏底那条线:掉到它以下就开始打转 */
export function bottomLine(): number {
  return ARENA_H - 2;
}

/** 上升气流一趟的结算文案:只夸做到的,不数落 */
export function climbMessage(meters: number, best: number): string {
  if (meters >= best && meters > 0) return `爬到 ${heightLine(meters)},这是你爬得最高的一趟!`;
  if (meters <= 0) return "气流有点急,再来一趟就熟了!先踩稳第一层再往上看。";
  return `这一趟爬到 ${heightLine(meters)},最好成绩 ${heightLine(best)},再来一趟就追上啦。`;
}

/** 上升气流里 surfaceY 的快捷方式,渲染层与逻辑层共用 */
export function climbSurfaceY(def: ArenaDef, surface: number): number {
  return surfaceY(def.platforms, surface);
}
