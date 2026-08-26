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
  // 高手档因此想得更快一点（0.09 秒 ≈ 五六帧，仍然不是零帧无敌），
  // 也更懂得等对方元气掉到 110 再收那一记重击，档位差这才重新拉得开。
  hard: { think: 0.09, reach: 86, heavyAt: 110, mistake: 0.05, ledgeCare: 0.98, greed: 0.75, passive: 0, label: "高手" },
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
  bounds: Bounds;
}

/** 小电脑现在最想干什么，UI 上可以显示成小气泡 */
export type AiIntent = "recover" | "chase" | "attack" | "grab" | "wait";

export interface AiDecision {
  input: Input;
  intent: AiIntent;
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

  // 1) 掉到安全区外面或者比平台还低 —— 先回家再说
  const offLeft = self.x < safe.min + 10;
  const offRight = self.x > safe.max - 10;
  const below = self.y > safe.top - 24;
  if (!self.onGround && (offLeft || offRight || below)) {
    const mid = (safe.min + safe.max) / 2;
    if (self.x < mid - 20) input.right = true;
    else if (self.x > mid + 20) input.left = true;
    // 往下掉或者已经低于平台了就赶紧再跳一次，跳跃次数用完只能横着挪
    if ((below || self.vy > -40) && self.jumpsLeft > 0) input.up = true;
    return { input, intent: "recover" };
  }

  // 2) 发呆：站着看一会儿。放在保命之后，所以它只会在场上安全时才走神
  if (r > 1 - p.passive) return { input, intent: "wait" };

  // 3) 偶尔手滑：随便走两步，别显得像机器人
  if (r < p.mistake) {
    if (r < p.mistake / 2) input.left = true;
    else input.right = true;
    return { input, intent: "wait" };
  }

  // 4) 场上有道具而且不太远，顺手捡一个
  if (item && r < p.mistake + p.greed * 0.5) {
    const dx = item.x - self.x;
    if (Math.abs(dx) > 16) {
      if (dx > 0) input.right = true;
      else input.left = true;
    }
    if (item.y < self.y - 40 && self.jumpsLeft > 0) input.up = true;
    return { input, intent: "grab" };
  }

  if (!target) {
    // 5) 没人可追：待在安全区中间
    const mid = (safe.min + safe.max) / 2;
    if (self.x < mid - 40) input.right = true;
    else if (self.x > mid + 40) input.left = true;
    return { input, intent: "wait" };
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
      if (dy < -46 && self.jumpsLeft > 0) input.up = true;
      return { input, intent: "chase" };
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
    return { input, intent: "wait" };
  }

  // 6) 够得着就打：对手击退值高的时候优先重击，把人送出去
  if (adx <= p.reach && Math.abs(dy) < 70) {
    const wantHeavy = target.bump >= p.heavyAt && r > 0.35;
    if (wantHeavy) input.heavy = true;
    else input.light = true;
    // 打的同时保持朝向
    if (dx > 6) input.right = true;
    else if (dx < -6) input.left = true;
    return { input, intent: "attack" };
  }

  // 7) 追人：但别追出安全区（越小心的档越早收脚）
  const nextX = self.x + Math.sign(dx) * 55;
  const wouldLeaveSafe = nextX < safe.min || nextX > safe.max;
  if (wouldLeaveSafe && r < p.ledgeCare) {
    const mid = (safe.min + safe.max) / 2;
    if (self.x < mid) input.right = true;
    else input.left = true;
    return { input, intent: "wait" };
  }
  if (dx > 0) input.right = true;
  else input.left = true;
  if (dy < -46 && self.jumpsLeft > 0) input.up = true;
  return { input, intent: "chase" };
}

/** 关卡里给对手加的强度：越靠后的章节，小电脑挥击力度稍微多一点点 */
export function aiPowerBonus(tier: AiTier): number {
  if (tier === "hard") return 1.12;
  if (tier === "normal") return 1.0;
  return 0.88;
}
