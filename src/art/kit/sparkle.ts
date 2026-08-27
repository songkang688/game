/**
 * 共享美术套件 · 白闪星花(1.3 第 20 步 B 档 `fruit-slice` 首建,归 B 档所有)。
 *
 * 切中反馈:接触点白闪一朵四角星花,按「帧」计寿命(step 缓动,不做补间)。
 * `prefers-reduced-motion` 下仍保留 1 帧——它是功能反馈,不是纯装饰。
 */

/** 白闪星花保留几帧 */
export const SPARK_FRAMES = 2;
/** 减弱动效时保留几帧(切中反馈不能整个删掉) */
export const SPARK_FRAMES_REDUCED = 1;

export interface Spark {
  x: number;
  y: number;
  r: number;
  framesLeft: number;
}

/** 四角星路径:两头尖、腰身内收的经典星花(纯路径,fill 由调用方定)。 */
export function traceStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const waist = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + waist, y - waist, x + r, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + r);
  ctx.quadraticCurveTo(x - waist, y + waist, x - r, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - r);
  ctx.closePath();
}

export class SparklePool {
  private sparks: Spark[] = [];

  spawn(x: number, y: number, reduced: boolean, r = 14): void {
    this.sparks.push({ x, y, r, framesLeft: reduced ? SPARK_FRAMES_REDUCED : SPARK_FRAMES });
  }

  /** 画一帧并消耗一帧寿命(每个渲染帧调用一次)。 */
  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      traceStar(ctx, s.x, s.y, s.r);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      traceStar(ctx, s.x, s.y, s.r * 0.45);
      ctx.fill();
      s.framesLeft--;
      if (s.framesLeft <= 0) this.sparks.splice(i, 1);
    }
  }

  count(): number {
    return this.sparks.length;
  }

  clear(): void {
    this.sparks.length = 0;
  }
}
