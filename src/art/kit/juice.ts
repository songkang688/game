/**
 * 共享美术套件 · 果汁液滴粒子(1.3 第 20 步 B 档 `fruit-slice` 首建,归 B 档所有)。
 *
 * 纯视觉粒子:切中水果的瞬间沿切向飞出几颗同果色小液滴,300ms easeOutQuad 渐隐。
 * 不参与任何判定;`prefers-reduced-motion` 下一颗都不生成。
 */

/** 每次切中飞出的液滴颗数上限 */
export const JUICE_DROPS_PER_SLICE = 3;
/** 液滴寿命(毫秒) */
export const JUICE_LIFE_MS = 300;

/** 位移缓动:出手快、收尾缓 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export interface JuiceDrop {
  x0: number;
  y0: number;
  /** 整段寿命内的总位移(像素) */
  dx: number;
  dy: number;
  color: string;
  ageMs: number;
  size: number;
}

export class JuicePool {
  private drops: JuiceDrop[] = [];

  /**
   * 切中一次:沿切向散出 JUICE_DROPS_PER_SLICE 颗液滴。
   * @param angle 刀的切向(弧度),液滴顺着它带一点扇形散开
   * @param color 液滴颜色 = 对应水果主色
   * @param reduced 减弱动效时不生成
   */
  spawn(
    x: number,
    y: number,
    angle: number,
    color: string,
    reduced: boolean,
    rand: () => number = Math.random,
  ): void {
    if (reduced) return;
    for (let i = 0; i < JUICE_DROPS_PER_SLICE; i++) {
      const a = angle + (i - (JUICE_DROPS_PER_SLICE - 1) / 2) * 0.42 + (rand() - 0.5) * 0.2;
      const dist = 42 + rand() * 40;
      this.drops.push({
        x0: x,
        y0: y,
        dx: Math.cos(a) * dist,
        dy: Math.sin(a) * dist - 12,
        color,
        ageMs: 0,
        size: 2.6 + rand() * 1.8,
      });
    }
  }

  update(dtMs: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      this.drops[i].ageMs += dtMs;
      if (this.drops[i].ageMs >= JUICE_LIFE_MS) this.drops.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drops) {
      const t = Math.min(1, d.ageMs / JUICE_LIFE_MS);
      const k = easeOutQuad(t);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x0 + d.dx * k, d.y0 + d.dy * k, d.size * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  count(): number {
    return this.drops.length;
  }

  clear(): void {
    this.drops.length = 0;
  }
}
