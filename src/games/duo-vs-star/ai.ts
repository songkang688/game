/**
 * 朵朵大战星星 · 小电脑的决策（纯函数）。
 *
 * 三档难度靠三件事拉开差距：想事情的间隔（反应快慢）、
 * 会不会挑「对手击退值高」的时候上重击、以及会不会小心场地边缘。
 * 高档也**不是无敌**：它照样有反应延迟，也会偶尔判断失误。
 */
import type { Bounds } from "./knockback";

export type AiTier = "easy" | "normal" | "hard";

/** 一帧的操作意图，人和小电脑共用同一套 */
export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** 轻击 */
  light: boolean;
  /** 重击 */
  heavy: boolean;
}

export function emptyInput(): Input {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false };
}

export interface AiTierParams {
  /** 隔多久重新想一次（秒），越小反应越快 */
  think: number;
  /** 追人的水平距离阈值：进了这个范围就开打 */
  reach: number;
  /** 对手击退值到多少就想上重击 */
  heavyAt: number;
  /** 每次决策有多大概率乱走一下（模拟失误） */
  mistake: number;
  /** 有多在意场地边缘（0 完全不管，1 很小心） */
  ledgeCare: number;
  /** 去捡道具的积极性 */
  greed: number;
  /**
   * 每次决策有多大概率干脆先站着不动，把机会让出来。
   * 轻松档主要靠这个「发呆」给新手留出手时间，而不是靠把它变笨到会自己走下场。
   */
  passive: number;
  /** 中文档位名 */
  label: string;
}

export const AI_TIERS: Record<AiTier, AiTierParams> = {
  easy: { think: 0.46, reach: 58, heavyAt: 220, mistake: 0.3, ledgeCare: 0.6, greed: 0.22, passive: 0.26, label: "轻松" },
  normal: { think: 0.24, reach: 74, heavyAt: 130, mistake: 0.14, ledgeCare: 0.86, greed: 0.5, passive: 0.06, label: "正常" },
  // 1.2 起弹飞初速有了「元气封顶」，重击不再是逮谁削谁：
  // 高手档因此想得更快一点（0.08 秒 ≈ 五帧，仍然不是零帧无敌），
  // 也更懂得等对方元气掉到 110 再收那一记重击，档位差这才重新拉得开。
  //
  // 第 3 轮修 B3 以后所有档位都不再自己走下台，`ledgeCare` 那点差距就不再拉得开档位了
  // （高手对正常一度打成 10:10）。差距改回落在「想得多快、失手多少」上。
  hard: { think: 0.08, reach: 86, heavyAt: 110, mistake: 0.04, ledgeCare: 0.98, greed: 0.75, passive: 0, label: "高手" },
};

/** 三档难度的顺序（弱 → 强），给关卡表和测试用 */
export const AI_ORDER: AiTier[] = ["easy", "normal", "hard"];

/**
 * 打法风格。1.1 的后段战役是靠一路加 `powerBonus` 堆难度的——数字变大，
 * 打法一模一样，玩起来只是数字更大而已。1.2 把那些关改成换打法：
 *
 *  · `plain`   —— 老老实实正面来；
 *  · `flank`   —— 会绕后：先跑到你背后再动手，正面硬顶没用；
 *  · `greedy`  —— 会抢道具：满场先把好东西收了，跟你抢节奏；
 *  · `patient` —— 会等你出招：站在够不着的地方等，等你收招那一下再进。
 */
export type AiStyle = "plain" | "flank" | "greedy" | "patient";

/** 四种打法的顺序，关卡表按它轮换 */
export const AI_STYLES: AiStyle[] = ["plain", "flank", "greedy", "patient"];

/** 打法的中文名，HUD 上给小朋友看一眼就知道对面在干嘛 */
export const STYLE_LABELS: Record<AiStyle, string> = {
  plain: "正面来",
  flank: "会绕后",
  greedy: "抢道具",
  patient: "等你出招",
};

/** 绕后时要跑到对手身后多远才算站好 */
export const FLANK_OFFSET = 96;

/** 「等你出招」在对手没出招时保持的距离 */
export const PATIENT_SPACING = 128;

/**
 * 回场时留着空中跳跃不按的高度差：掉到「台面上方这么多像素」以内才起跳。
 * 一次空中跳跃大约能把人抬起 110px，早按就是白按。
 */
export const RECOVER_LIFT = 70;

/**
 * 快掉出场了没有？（悬空 + 已经比主平台低，或者横着飘出了所有台子的范围）
 *
 * 保命这件事不该等反应间隔：空中跳跃只有一次、只能把人抬起一百来像素，
 * 轻松档 0.46 秒想一次，等它想明白的时候人已经掉到跳不回来的高度了。
 * 对局循环拿这个判断给「危险中的小电脑」临时提速。
 */
export function perilous(
  self: { x: number; y: number; onGround: boolean },
  safe: { top: number },
  ground: { min: number; max: number },
  pads?: Array<{ min: number; max: number; top: number }>
): boolean {
  if (self.onGround) return false;
  if (self.x < ground.min + 10 || self.x > ground.max - 10) return true;
  if (self.y > safe.top - 24) return true;
  // 悬在两块台子中间的缝上：脚底下压根没有东西接着，跟飘出场外一样危险。
  // 少了这一条，「比主平台低」这个判断在跳台图上会来回翻：升到主平台高度以上
  // 就以为自己安全了，转头继续追人往缝里走，掉下去一点再想回来 —— 反复几次
  // 空中跳跃就没了。夜空跳台上对手开局四秒自己掉下去就是这么来的。
  if (pads && !pads.some((p) => p.top >= self.y - 4 && self.x > p.min - 6 && self.x < p.max + 6)) return true;
  return false;
}

/** 小电脑看到的战场快照（只读） */
export interface AiView {
  self: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    bump: number;
    jumpsLeft: number;
  };
  /** 最近的对手；场上只剩自己时是 null */
  target: {
    x: number;
    y: number;
    bump: number;
    onGround: boolean;
    /** 对手正在出招（起手或判定中）——「等你出招」那一档专门盯这个 */
    attacking?: boolean;
    /** 对手正在收招，这一下最好打 */
    recovering?: boolean;
  } | null;
  /** 最近的道具；没有就是 null */
  item: { x: number; y: number } | null;
  /** 站得住的横向区间（主平台范围） */
  safe: { min: number; max: number; top: number };
  /**
   * 整张场地脚下还有台子的横向范围（所有台子的并集）。
   * 不给就退回主平台 —— 老用例照旧能用。
   */
  ground?: { min: number; max: number };
  /** 脚下这块台子的横向范围；悬空时是 null。走到边上要先跳，别直接踏空 */
  stand?: { min: number; max: number } | null;
  /** 场上所有台子此刻的位置（升降 / 平移台会动）。悬空时靠它挑落脚点 */
  pads?: Array<{ min: number; max: number; top: number }>;
  bounds: Bounds;
}

/** 小电脑现在最想干什么，UI 上可以显示成小气泡 */
export type AiIntent = "recover" | "chase" | "attack" | "grab" | "wait";

export interface AiDecision {
  input: Input;
  intent: AiIntent;
}

/**
 * 悬空、又没有空中跳跃可用时该往哪儿挪才落得到台子上。
 *
 * 返回目标 x（挑最近的一块，并且往里留一点边距，免得贴着边掉下去）；
 * 没有台子信息、或者下面一块台子都没有就返回 null。
 * 只看比自己低的台子 —— 比自己高的落不上去。
 */
function pickLanding(view: AiView): { x: number; top: number } | null {
  const pads = view.pads;
  const self = view.self;
  if (!pads || pads.length === 0) return null;
  // 挑最近的一块，但要为「掉头」付一点代价：正往左飘的时候硬选右边那块，
  // 多半是两块都够不着。以前没有这一条，人在半空里一会儿往左一会儿往右，
  // 最后从两块台子中间的缝里掉下去。
  let best: { x: number; top: number } | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const pad of pads) {
    if (pad.top < self.y + 8) continue;
    const margin = Math.min(18, Math.max(0, (pad.max - pad.min) / 2 - 2));
    const aim = Math.min(Math.max(self.x, pad.min + margin), pad.max - margin);
    const d = Math.abs(aim - self.x);
    const turning = d > 8 && self.vx !== 0 && Math.sign(aim - self.x) !== Math.sign(self.vx);
    const cost = d + (turning ? Math.min(160, Math.abs(self.vx) * 0.25) : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = { x: aim, top: pad.top };
    }
  }
  return best;
}

/** 迈一步大概挪多远（追人时的预判距离） */
const STEP_LOOKAHEAD = 55;

/** 敢跳过去的最大缺口：再宽就不是「跨一步」而是往下跳了 */
const HOP_GAP = 130;

/**
 * 再往这个方向走一步，会不会走出脚下这块台子。
 * 悬空时没有「脚下这块」可言，一律算否（那时候归回场逻辑管）。
 */
function nearEdge(view: AiView, dir: number): boolean {
  const { self, stand } = view;
  if (!self.onGround || !stand) return false;
  const nextX = self.x + dir * STEP_LOOKAHEAD;
  return nextX > stand.max || nextX < stand.min;
}

/**
 * 走出这一侧的台沿以后，那边还有没有接得住的台子。
 *
 * 只认「比自己低」的台子 —— 头顶那块落不上去。cloud-square 的右半边就是这样：
 * 主平台到 x=770 为止，再往右只有一块 y=288 的浮空台（在头顶）。
 * 把浮空台算进「站得住的范围」，小电脑就会一路走到 x=790 踏空，
 * 起跳想勾住浮空台还差三个像素，直接掉下场 —— 第 1 关摆烂过关正是这么来的。
 */
export function canLandBeyond(
  pads: Array<{ min: number; max: number; top: number }> | undefined,
  stand: { min: number; max: number } | null | undefined,
  self: { y: number },
  dir: number
): boolean {
  if (!stand || !pads) return false;
  const edge = dir > 0 ? stand.max : stand.min;
  for (const pad of pads) {
    if (pad.top < self.y + 8) continue;
    const near = dir > 0 ? pad.min : pad.max;
    const far = dir > 0 ? pad.max : pad.min;
    if ((far - edge) * dir <= 8) continue;
    if ((near - edge) * dir <= HOP_GAP) return true;
  }
  return false;
}

/** 这一步是不是「闭着眼睛往台下迈」：到台沿了，那边又没有接得住的台子 */
function blindStep(view: AiView, dir: number): boolean {
  return dir !== 0 && nearEdge(view, dir) && !canLandBeyond(view.pads, view.stand, view.self, dir);
}

/**
 * 出手之前的最后一道保险：这一步要是直接迈下台，就把它按住，改成往台子里侧挪一点。
 *
 * 放在这里而不是各个分支里，是因为「走下场」大多不是追人追出去的 ——
 * 轻松档三成决策是随机乱走（`mistake`），那条路上原本一点边缘判断都没有。
 * 悬空时 `stand` 是 null，回场逻辑不受影响。
 */
function guardLedge(view: AiView, input: Input, intent: AiIntent): AiDecision {
  const dir = input.right ? 1 : input.left ? -1 : 0;
  if (!blindStep(view, dir)) return { input, intent };
  input.left = false;
  input.right = false;
  input.up = false;
  const stand = view.stand;
  if (stand) {
    const mid = (stand.min + stand.max) / 2;
    if (view.self.x < mid - 12) input.right = true;
    else if (view.self.x > mid + 12) input.left = true;
  }
  return { input, intent };
}

/**
 * 想一次。`roll` 是 0..1 的随机数（外面用带种子的随机数发生器给，保证可复现）。
 * 决策优先级：先保命回场 → 再考虑捡道具 → 再追着打 → 实在没事就在安全区里晃。
 */
export function decideAi(
  view: AiView,
  tier: AiTier,
  roll: number,
  style: AiStyle = "plain"
): AiDecision {
  const base = AI_TIERS[tier] ?? AI_TIERS.normal;
  const p = style === "greedy" ? { ...base, greed: Math.min(1, base.greed + 0.45) } : base;
  const input = emptyInput();
  const r = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0.5;
  const { self, target, item, safe } = view;

  // 1) 真的飘到场地外面、或者已经比主平台还低 —— 先回家再说。
  //    「外面」看的是整张图台子的并集：侧边台子上方不算掉出去，
  //    不然出生点在两侧的图（星光升降台 / 夜空跳台）一开局就会误判成要回场，
  //    二段跳全耗在半空，最后自己掉下去。
  const ground = view.ground ?? { min: safe.min, max: safe.max };
  if (perilous(self, safe, ground, view.pads)) {
    // 回场往哪儿走：挑最近那块「比自己低、落得上去」的台子，没有就退回主平台中间。
    // 以前一律往主平台中间挪，跳台图上明明左手边就有一块侧台，它偏要横穿整条缝
    // 往中间赶，半路上高度就掉光了。
    const spot = pickLanding(view);
    const aimX = spot ? spot.x : (safe.min + safe.max) / 2;
    const aimTop = spot ? spot.top : safe.top;
    if (self.x < aimX - 14) input.right = true;
    else if (self.x > aimX + 14) input.left = true;
    // 空中跳跃大多只有一次,一跳能升一百来像素,所以不能一离地就按掉:
    // 等真的掉到落脚点高度附近、这一跳还够得着的时候再用。
    // 之前是「只要不在上升就补跳」,跳跃次数在半空就用光了,后面直直往下掉。
    const needLift = self.y > aimTop - RECOVER_LIFT;
    if (needLift && self.vy > -40 && self.jumpsLeft > 0) input.up = true;
    return { input, intent: "recover" };
  }

  // 1.5) 空中跳跃已经用光、人还在往下掉，脚下又没有台子接着 —— 这时候只剩一件事
  //      能做：横着挪到最近的落脚点上方。以前这种局面下它还在「追人」和「回场」
  //      之间来回切，一会儿往左一会儿往右，最后正好落进台子之间的缝里。
  if (!self.onGround && self.jumpsLeft <= 0 && self.vy > -40) {
    const spot = pickLanding(view);
    if (spot) {
      if (spot.x > self.x + 6) input.right = true;
      else if (spot.x < self.x - 6) input.left = true;
      return { input, intent: "recover" };
    }
  }

  // 2) 发呆：站着看一会儿。放在保命之后，所以它只会在场上安全时才走神
  if (r > 1 - p.passive) return { input, intent: "wait" };

  // 3) 偶尔手滑：随便走两步，别显得像机器人。手滑归手滑，走下台不算手滑
  if (r < p.mistake) {
    if (r < p.mistake / 2) input.left = true;
    else input.right = true;
    return guardLedge(view, input, "wait");
  }

  // 4) 场上有道具而且不太远，顺手捡一个
  if (item && r < p.mistake + p.greed * 0.5) {
    const dx = item.x - self.x;
    if (Math.abs(dx) > 16) {
      if (dx > 0) input.right = true;
      else input.left = true;
    }
    // 只在地上起跳去够高处的道具：地上起跳会把空中跳跃次数补满，
    // 悬空时那唯一一次要留着回场用
    if (item.y < self.y - 40 && self.onGround) input.up = true;
    return guardLedge(view, input, "grab");
  }

  if (!target) {
    // 5) 没人可追：待在安全区中间
    const mid = (safe.min + safe.max) / 2;
    if (self.x < mid - 40) input.right = true;
    else if (self.x > mid + 40) input.left = true;
    return guardLedge(view, input, "wait");
  }

  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const adx = Math.abs(dx);

  // 5.5) 会绕后：还没站到对手背后就先绕，别急着正面顶
  if (style === "flank") {
    // 对手朝场地中间站着，就绕到他背对场边的那一侧去
    const mid = (safe.min + safe.max) / 2;
    const behind = target.x <= mid ? target.x - FLANK_OFFSET : target.x + FLANK_OFFSET;
    const spot = Math.max(safe.min + 20, Math.min(safe.max - 20, behind));
    const gap = spot - self.x;
    if (Math.abs(gap) > 24) {
      if (gap > 0) input.right = true;
      else input.left = true;
      if (dy < -46 && self.onGround) input.up = true;
      return guardLedge(view, input, "chase");
    }
  }

  // 5.6) 等你出招：对手没动手就在够不着的地方候着，等他收招那一下再进。
  // 留三成概率照样压上去，不然两边都在等就成了干瞪眼。
  if (
    style === "patient" &&
    r < 0.7 &&
    !target.recovering &&
    !target.attacking &&
    adx < PATIENT_SPACING &&
    Math.abs(dy) < 70
  ) {
    if (dx > 0) input.left = true;
    else input.right = true;
    return guardLedge(view, input, "wait");
  }

  // 6) 够得着就打：对手击退值高的时候优先重击，把人送出去
  if (adx <= p.reach && Math.abs(dy) < 70) {
    const wantHeavy = target.bump >= p.heavyAt && r > 0.35;
    if (wantHeavy) input.heavy = true;
    else input.light = true;
    // 打的同时保持朝向
    if (dx > 6) input.right = true;
    else if (dx < -6) input.left = true;
    return guardLedge(view, input, "attack");
  }

  // 7) 追人：但别追出场地（越小心的档越早收脚）。
  //    收脚看的是整张图所有台子的范围，不是主平台 —— 主平台只有两百来像素的图
  //    （星光升降台 / 夜空跳台）如果照主平台收脚，对手只要站到侧边台子上
  //    就永远追不到，两边在场上干等到时间到。
  const toward = Math.sign(dx) || 1;
  const nextX = self.x + toward * STEP_LOOKAHEAD;
  const wouldLeaveSafe = nextX < ground.min || nextX > ground.max;
  // 闭着眼睛往台下迈的那一步，什么档位都不迈：追人追到自己掉下场是白送
  if (blindStep(view, toward) || (wouldLeaveSafe && r < p.ledgeCare)) {
    const mid = (safe.min + safe.max) / 2;
    if (self.x < mid) input.right = true;
    else input.left = true;
    return { input, intent: "wait" };
  }
  if (dx > 0) input.right = true;
  else input.left = true;
  // 追人只在地上起跳：一来从地上跳会把空中跳跃次数补满，二来悬空时仅有的那一次
  // 要留着回场 —— 以前追着追着把跳跃用光，落下来就再也上不来了。
  // 要迈出脚下这块台子也先跳一下，别直接踏空掉进缺口。
  const stand = view.stand;
  const stepOff = !!stand && (nextX < stand.min || nextX > stand.max);
  if (self.onGround && (dy < -46 || stepOff)) input.up = true;
  return guardLedge(view, input, "chase");
}

/** 关卡里给对手加的强度：越靠后的章节，小电脑挥击力度稍微多一点点 */
export function aiPowerBonus(tier: AiTier): number {
  if (tier === "hard") return 1.12;
  if (tier === "normal") return 1.0;
  return 0.88;
}
