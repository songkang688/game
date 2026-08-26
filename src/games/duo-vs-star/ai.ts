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
  hard: { think: 0.14, reach: 86, heavyAt: 85, mistake: 0.05, ledgeCare: 0.98, greed: 0.75, passive: 0, label: "高手" },
};

/** 三档难度的顺序（弱 → 强），给关卡表和测试用 */
export const AI_ORDER: AiTier[] = ["easy", "normal", "hard"];

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
  target: { x: number; y: number; bump: number; onGround: boolean } | null;
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
export function decideAi(view: AiView, tier: AiTier, roll: number): AiDecision {
  const p = AI_TIERS[tier] ?? AI_TIERS.normal;
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
