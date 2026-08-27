/**
 * 1.3 素材包汇总导出（`src/art/kit/index.ts`）
 *
 * 第 2–26 步的 76 款游戏统一从这里 import：
 * `import { drawDuoduo, drawCoin, makeCollectBurst, KIT_PALETTE } from "../../art/kit";`
 * 全部为 Canvas 2D 矢量绘制函数与纯数据，零 DOM、零依赖、无循环 import。
 */

export * from "./palette";
export * from "./chars";
export * from "./props";
export * from "./fx";
export * from "./testing";
