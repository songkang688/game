/**
 * 共享美术套件 · 视差滚动器(1.3 视觉升级)。
 *
 * 多层背景各按自己的倍率滚动、到 `period` 就回卷 —— 2.5D 观感的地板。
 * 纯数字状态机:不摸 DOM、不排 rAF,宿主的帧循环喂 dt 进来就行,
 * `destroy` 时调 `reset()` 一步归零。
 */

export interface ParallaxScroller {
  /** 每层当前滚动量(0 ≤ offset < period),下标对齐传入的倍率表 */
  readonly offsets: readonly number[];
  /** 推进一帧:offset += base × factor × dt。reduced 场景把 base 传 0 即可 */
  step(dt: number, baseSpeed: number): void;
  /** 全部归零(destroy / 重开一局用) */
  reset(): void;
  /** 所有层滚动量之和(测试断言「真的滚了 / 真的归零了」用) */
  total(): number;
}

/** factors 是各层相对基准速度的倍率(如 0.2 / 0.5 / 0.9),period 是回卷周期 */
export function makeParallax(factors: readonly number[], period: number): ParallaxScroller {
  const span = Math.max(1, period);
  const offsets = factors.map(() => 0);
  return {
    offsets,
    step(dt: number, baseSpeed: number): void {
      if (!(dt > 0) || baseSpeed === 0) return;
      for (let i = 0; i < factors.length; i++) {
        offsets[i] = (((offsets[i] + baseSpeed * factors[i] * dt) % span) + span) % span;
      }
    },
    reset(): void {
      offsets.fill(0);
    },
    total(): number {
      return offsets.reduce((s, v) => s + v, 0);
    },
  };
}
