/**
 * 1.3 素材包 · 收集反馈（`src/art/kit/fx.ts`）
 *
 * 收集爆星粒子、+1 飞字、四芒闪光。逻辑（step）与绘制（draw）分离，方便测试。
 * `reduced: true` 是 `prefers-reduced-motion` 的降级路径：不喷一颗粒子、
 * 不震屏，只留一个单次淡出的光圈。
 *
 * 纯逻辑 + 纯绘制：不查 DOM、不建 canvas、不挂监听。
 */

import { KIT_PALETTE, tint } from "./palette";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export interface BurstOpts {
  x: number;
  y: number;
  /** prefers-reduced-motion 降级：true 时粒子数为 0，只留淡出光圈 */
  reduced?: boolean;
  /** 粒子颜色，默认星光金 */
  color?: string;
  /** 粒子数，默认 12（clamp 到 1–64） */
  count?: number;
}

export interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

export interface CollectBurst {
  /** 粒子状态数组（reduced 时恒为空） */
  readonly particles: BurstParticle[];
  readonly reduced: boolean;
  /** 整体淡出 1 → 0（reduced 的光圈、粒子整体透明度共用） */
  alpha: number;
  /** 推进 dt 秒（非法 / 非正 dt 不动） */
  step(dt: number): void;
  /** 画当前状态；结束后零绘制调用 */
  draw(ctx: Ctx): void;
  /** 是否播完 */
  done(): boolean;
}

/** 粒子重力（px/s²） */
const BURST_GRAVITY = 160;
/** 整体淡出速度（alpha/s），约 0.45s 播完 */
const BURST_FADE = 2.2;

/**
 * 收集爆星：确定性布点（不用随机数，测试可复现）。
 * 正常模式喷一圈小星屑；reduced 模式零粒子，draw 只画一个渐散光圈。
 */
export function makeCollectBurst(o: BurstOpts): CollectBurst {
  const ok = fin(o.x) && fin(o.y);
  const reduced = o.reduced === true;
  const color = typeof o.color === "string" ? o.color : KIT_PALETTE.starGold;
  const count = fin(o.count) ? Math.min(64, Math.max(1, Math.round(o.count))) : 12;
  const cx = ok ? o.x : 0;
  const cy = ok ? o.y : 0;

  const particles: BurstParticle[] = [];
  if (ok && !reduced) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + (i % 2) * 0.26;
      const speed = 52 + (i % 3) * 24;
      const maxLife = 0.42 + (i % 4) * 0.07;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 34,
        r: 2.2 + (i % 3) * 0.9,
        life: maxLife,
        maxLife
      });
    }
  }

  const burst: CollectBurst = {
    particles,
    reduced,
    alpha: ok ? 1 : 0,
    step(dt: number): void {
      if (!fin(dt) || dt <= 0) return;
      const d = Math.min(dt, 0.25);
      burst.alpha = Math.max(0, burst.alpha - BURST_FADE * d);
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life = Math.max(0, p.life - d);
        p.x += p.vx * d;
        p.y += p.vy * d;
        p.vy += BURST_GRAVITY * d;
      }
    },
    draw(ctx: Ctx): void {
      if (burst.done()) return;
      ctx.save();
      if (reduced) {
        // 降级路径：单个淡出光圈，无粒子、无震屏
        ctx.globalAlpha = burst.alpha * 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + (1 - burst.alpha) * 14, 0, TAU);
        ctx.stroke();
      } else {
        for (const p of particles) {
          if (p.life <= 0) continue;
          const k = p.life / p.maxLife;
          ctx.globalAlpha = k;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.5 + 0.5 * k), 0, TAU);
          ctx.fill();
          // 星屑高光芯
          ctx.fillStyle = tint(color, 0.6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.35 * k, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    },
    done(): boolean {
      if (reduced) return burst.alpha <= 0;
      if (particles.length === 0) return true;
      for (const p of particles) if (p.life > 0) return false;
      return true;
    }
  };
  return burst;
}

/** +1 飞字的字号下限（px），宪法：游戏内文字 ≥ 14px */
export const PLUS_ONE_MIN_PX = 14;

export interface PlusOneOpts {
  x: number;
  y: number;
  /** 进度 0（刚冒出）→ 1（升顶消失），越界自动 clamp */
  t: number;
  /** 缺省 "+1" */
  text?: string;
  /** 字号（px），低于 14 会被抬到 14 */
  size?: number;
  color?: string;
}

/** +1 飞字：上浮 + 淡出，白描边保证任何底色上可读 */
export function drawPlusOne(ctx: Ctx, o: PlusOneOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.t)) return;
  const t = Math.min(1, Math.max(0, o.t));
  const px = Math.round(Math.max(PLUS_ONE_MIN_PX, fin(o.size) ? o.size : 16));
  const text = typeof o.text === "string" && o.text.length > 0 ? o.text : "+1";
  const color = typeof o.color === "string" ? o.color : KIT_PALETTE.candyDeep;
  const yy = o.y - t * px * 1.6;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.font = `bold ${px}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(px * 0.22, 2);
  ctx.strokeStyle = KIT_PALETTE.cloud;
  ctx.strokeText(text, o.x, yy);
  ctx.fillStyle = color;
  ctx.fillText(text, o.x, yy);
  ctx.restore();
}

export interface SparkleOpts {
  x: number;
  y: number;
  /** 外径，必须 > 0 */
  r: number;
  /** 0–1 相位，闪烁缩放 */
  t?: number;
  color?: string;
}

/** 四芒闪光：白色四芒星 + 柠檬黄芯，装饰收集物与胜利画面 */
export function drawSparkle(ctx: Ctx, o: SparkleOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const t = fin(o.t) ? ((o.t % 1) + 1) % 1 : 0;
  const s = 0.72 + 0.28 * Math.sin(t * TAU);
  const color = typeof o.color === "string" ? o.color : KIT_PALETTE.cloud;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? o.r : o.r * 0.28;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const px2 = Math.cos(a) * r;
    const py2 = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KIT_PALETTE.lemon;
  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.18, 0, TAU);
  ctx.fill();
  ctx.restore();
}
