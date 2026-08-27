// 寻找外星朋友:场景数据模型 + 推理引擎(全是纯函数,不碰 DOM)。
//
// 一张场景 = 若干个「藏身点」。每个藏身点有颜色、种类、大小、位置四个属性,
// 找物关就是把躲着外星小朋友的那几个点点出来;
// 推理关不给你看谁躲在哪,只给 3~5 条线索,靠排除法把唯一的那个点找出来。
//
// 这里最要紧的一件事:generateDeduction 生成的题目必须「解唯一」,
// solveDeduction 会被单测拿去对全部推理关逐关断言。

/** 场景的虚拟画布尺寸;真正画到屏幕上时整体等比缩放 */
export const SCENE_W = 1000;
export const SCENE_H = 640;

export const COLORS = ["粉", "蓝", "黄", "绿", "紫", "橙"] as const;
export type ColorName = (typeof COLORS)[number];

export const COLOR_HEX: Record<ColorName, string> = {
  粉: "#ffc2d6",
  蓝: "#bcd9ff",
  黄: "#ffe9ae",
  绿: "#c3edbc",
  紫: "#dccdf7",
  橙: "#ffd3b0",
};

/** 藏身点的种类:全是程序化画出来的简单形状,不用任何外部图片 */
export const KINDS = ["树洞", "木箱", "花丛", "水缸", "云朵", "石头", "帐篷", "信箱"] as const;
export type SpotKind = (typeof KINDS)[number];

export type Zone = "左" | "中" | "右";
export const ZONES: Zone[] = ["左", "中", "右"];

export interface Spot {
  /** 场景坐标(0..SCENE_W / 0..SCENE_H),指的是藏身点的中心 */
  x: number;
  y: number;
  /** 半径:点击判定与绘制都用它 */
  r: number;
  kind: SpotKind;
  color: ColorName;
  /** 大的藏身点半径更大,也是推理线索之一 */
  big: boolean;
}

/** 藏身点在场景的左 / 中 / 右哪一片 */
export function zoneOf(x: number): Zone {
  if (x < SCENE_W / 3) return "左";
  if (x < (SCENE_W * 2) / 3) return "中";
  return "右";
}

/** 藏身点在画面的上半还是下半 */
export function isTop(y: number): boolean {
  return y < SCENE_H / 2;
}

/** 一句话说清是哪个藏身点(生成器保证「颜色 + 种类」组合不重复,所以这句话不会指歪) */
export function spotName(s: Spot): string {
  return `${s.color}色的${s.kind}`;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** 离 ref 最近的 n 个藏身点(不含 ref 自己);距离相同的按下标先后排 */
export function nearestSpots(spots: Spot[], ref: number, n: number): number[] {
  const base = spots[ref];
  if (!base) return [];
  return spots
    .map((s, i) => ({ i, d: dist(base.x, base.y, s.x, s.y) }))
    .filter((e) => e.i !== ref)
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map((e) => e.i);
}

// ---------------------------------------------------------------------------
// 线索
// ---------------------------------------------------------------------------

export type Clue =
  | { kind: "isColor"; color: ColorName }
  | { kind: "notColor"; color: ColorName }
  | { kind: "isKind"; spot: SpotKind }
  | { kind: "notKind"; spot: SpotKind }
  | { kind: "zone"; zone: Zone }
  | { kind: "notZone"; zone: Zone }
  | { kind: "row"; top: boolean }
  | { kind: "size"; big: boolean }
  | { kind: "leftOf"; ref: number }
  | { kind: "rightOf"; ref: number }
  | { kind: "neighbor"; ref: number };

/** 「挨着」算几个:离参照物最近的这么多个位置都算旁边 */
export const NEIGHBOR_N = 2;

/** 第 i 个藏身点满足这条线索吗 */
export function clueHolds(clue: Clue, spots: Spot[], i: number): boolean {
  const s = spots[i];
  if (!s) return false;
  switch (clue.kind) {
    case "isColor":
      return s.color === clue.color;
    case "notColor":
      return s.color !== clue.color;
    case "isKind":
      return s.kind === clue.spot;
    case "notKind":
      return s.kind !== clue.spot;
    case "zone":
      return zoneOf(s.x) === clue.zone;
    case "notZone":
      return zoneOf(s.x) !== clue.zone;
    case "row":
      return isTop(s.y) === clue.top;
    case "size":
      return s.big === clue.big;
    case "leftOf":
      return i !== clue.ref && !!spots[clue.ref] && s.x < spots[clue.ref].x;
    case "rightOf":
      return i !== clue.ref && !!spots[clue.ref] && s.x > spots[clue.ref].x;
    case "neighbor":
      return i !== clue.ref && nearestSpots(spots, clue.ref, NEIGHBOR_N).includes(i);
  }
}

/** 同时满足全部线索的藏身点下标(解唯一时长度正好是 1) */
export function solveDeduction(spots: Spot[], clues: Clue[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < spots.length; i++) {
    if (clues.every((c) => clueHolds(c, spots, i))) out.push(i);
  }
  return out;
}

/** 把线索翻译成一句小学生读得懂的中文 */
export function clueText(clue: Clue, spots: Spot[]): string {
  const ref = (i: number): string => (spots[i] ? spotName(spots[i]) : "那个地方");
  switch (clue.kind) {
    case "isColor":
      return `它躲在${clue.color}色的地方。`;
    case "notColor":
      return `它没有躲在${clue.color}色的地方。`;
    case "isKind":
      return `它躲在${clue.spot}里。`;
    case "notKind":
      return `它没有躲在${clue.spot}里。`;
    case "zone":
      return clue.zone === "中" ? "它在画面正中间那一片。" : `它在画面的${clue.zone}边那一片。`;
    case "notZone":
      return clue.zone === "中" ? "它不在画面正中间那一片。" : `它不在画面的${clue.zone}边那一片。`;
    case "row":
      return clue.top ? "它在画面的上半部分。" : "它在画面的下半部分。";
    case "size":
      return clue.big ? "它挑了一个大一点的地方躲。" : "它挑了一个小一点的地方躲。";
    case "leftOf":
      return `它比${ref(clue.ref)}更靠左。`;
    case "rightOf":
      return `它比${ref(clue.ref)}更靠右。`;
    case "neighbor":
      return `它就在离${ref(clue.ref)}最近的两个位置里。`;
  }
}

// ---------------------------------------------------------------------------
// 点击判定
// ---------------------------------------------------------------------------

/** 点到了哪个藏身点(取圆心最近的那个),没点中返回 -1 */
export function hitSpot(spots: Spot[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < spots.length; i++) {
    const d = dist(x, y, spots[i].x, spots[i].y);
    if (d <= spots[i].r && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** 把画布上的一次点击换算回场景坐标(整体等比缩放 + 居中留边) */
export function toSceneXY(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  const scale = Math.min(rect.width / SCENE_W, rect.height / SCENE_H) || 1;
  const offX = (rect.width - SCENE_W * scale) / 2;
  const offY = (rect.height - SCENE_H * scale) / 2;
  return { x: (clientX - rect.left - offX) / scale, y: (clientY - rect.top - offY) / scale };
}

// ---------------------------------------------------------------------------
// 计分与计时
// ---------------------------------------------------------------------------

/** 找物关评星:剩的时间越多、点错越少,星越多 */
export function findStars(secondsLeft: number, limit: number, misses: number): 1 | 2 | 3 {
  const ratio = limit > 0 ? secondsLeft / limit : 0;
  if (ratio >= 0.5 && misses === 0) return 3;
  if (ratio >= 0.25 && misses <= 2) return 2;
  return 1;
}

/** 推理关评星:一次就选对是 3 星,错一次 2 星,再错 1 星 */
export function deduceStars(wrongPicks: number, secondsLeft: number): 1 | 2 | 3 {
  if (wrongPicks === 0 && secondsLeft > 0) return 3;
  if (wrongPicks <= 1) return 2;
  return 1;
}

/** 点错一次扣多少秒(越往后扣得越狠,但有上限) */
export function missPenalty(chapter: number): number {
  return Math.min(6, 2 + Math.floor(chapter / 2));
}

/** 把秒数写成 0:07 这样的样子 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 键盘光标的移动速度(场景坐标 / 秒);鼠标和触屏是直接点,这是最慢的一种玩法 */
export const CURSOR_SPEED = 430;
/** 光标从 a 挪到 b 要几秒 */
export function travelTime(ax: number, ay: number, bx: number, by: number): number {
  return dist(ax, ay, bx, by) / CURSOR_SPEED;
}

/** 双人对战:谁先找到的多谁赢,一样多算平局 */
export function versusWinner(a: number, b: number): "朵朵" | "星星" | "平局" {
  if (a > b) return "朵朵";
  if (b > a) return "星星";
  return "平局";
}

/** 双人对战的结果播报 */
export function versusLine(a: number, b: number): string {
  const who = versusWinner(a, b);
  if (who === "平局") return `${a} 比 ${b},打成平手!再来一局分个高下～`;
  return `${who}赢啦!比分 ${Math.max(a, b)} 比 ${Math.min(a, b)}。`;
}

/** 无尽第 1 轮给多少秒;难度分拿它当基准线 */
export const ENDLESS_BASE_SECONDS = 38;

/**
 * 无尽模式第 round 轮:限时越来越短,压到 14 秒为止。
 *
 * 14 秒这条地板不是随便定的:目标数封顶是 8 个,
 * `sim.ts` 按「键盘一格一格挪光标」这种最慢的玩法算,8 个目标要花 8 秒上下,
 * 再往下压就会出现「怎么点都来不及」的轮次。往后的难度改走目标数和罚时。
 */
export function endlessSeconds(round: number): number {
  return Math.max(14, ENDLESS_BASE_SECONDS - Math.floor(Math.max(1, round) * 1.2));
}

/** 无尽模式第 round 轮:藏身点越来越多(16 个是 layoutSpots 的摆放上限) */
export function endlessSpotCount(round: number): number {
  return Math.min(16, 7 + Math.floor(Math.max(1, round) / 2));
}

/** 目标数最多几个:场上一共 16 个藏身点,一半已经是很紧的一屏 */
export const ENDLESS_MAX_TARGETS = 8;

/**
 * 无尽模式第 round 轮:要找出来的目标数。
 *
 * 前 12 轮每 4 轮加一个,加到 5 个;再往后放慢成每 8 轮加一个,加到 8 个封顶。
 * 分两段是因为限时已经压到地板了,前段那个速度再加下去就不公平。
 */
export function endlessTargetCount(round: number): number {
  const r = Math.max(1, round);
  const early = 2 + Math.floor(r / 4);
  if (early <= 5) return early;
  return Math.min(ENDLESS_MAX_TARGETS, 5 + Math.floor((r - 12) / 8));
}

/**
 * 无尽模式第 round 轮点错一次扣几秒。
 *
 * 战役关按章走 `missPenalty`,无尽轮不能照抄:无尽的 chapter 是
 * `(round - 1) % 8` 循环出来的,照抄会让罚时在 2→5→2 之间来回跳,
 * 第 9 轮反而比第 8 轮轻——同一条曲线上出现回头路。
 *
 * 这里改成只跟这一轮的限时走:大约咬掉八分之一,再夹在 2~4 秒之间。
 * 不做成「越往后罚得越狠」是有意的:限时最后要压到 14 秒,再罚 6 秒等于
 * 一次点错就没了四成时间,对小朋友太重。罚时这一项管公平,
 * 难度交给目标数那条曲线去涨。
 */
export function endlessMissPenalty(round: number): number {
  return Math.max(2, Math.min(4, Math.round(endlessSeconds(round) / 8)));
}

/**
 * 无尽第 round 轮的难度分:把三条曲线合成一个数(和 memory-cards 的
 * `endlessDifficulty` 一个口径),单测拿它一句话钉住「曲线一路不掉头」。
 *
 * 罚时不算在里面——它是公平项不是难度项,见 `endlessMissPenalty`。
 * 到第 36 轮三条曲线全部到顶,再往后是同一个分数:
 * 这是 16 个藏身点 + 14 秒地板算出来的天花板,不是忘了继续加。
 */
export function endlessDifficulty(round: number): number {
  const r = Math.max(1, Math.round(round));
  return (
    endlessSpotCount(r) * 2 +
    endlessTargetCount(r) * 8 +
    (ENDLESS_BASE_SECONDS - endlessSeconds(r))
  );
}

/** 难度分到顶的那一轮;再往后的轮次规模一样,只换场景 */
export const ENDLESS_PEAK_ROUND = 36;

/** 无尽模式结束时的一句话 */
export function endlessLine(round: number, best: number): string {
  if (round > best) return `新纪录!你一口气找到了第 ${round} 轮!`;
  return `这次走到第 ${round} 轮,最好成绩是第 ${best} 轮,再来一次!`;
}
