/**
 * 铁皮坦克大战 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着三样东西:
 *   1. 配色板与图层序常量块(四·补一)+ 动效时序表(四·补三)——数值全部写死成常量,
 *      测试逐个对表,谁改了立刻红;
 *   2. 纯函数相位:履带齿、两帧水波、冰面扫光、重生光环,全都由「毫秒 + reduced」算出来,
 *      不持有任何状态,reduced 一律冻结;
 *   3. `TankFx`:渲染侧的小账本(履带里程、炮口闪光帧、受击白闪帧)。
 *      它只读 `World`,一个字也不写回去 —— 玩法数值与判定在 `logic.ts`,这儿碰不到。
 *
 * 分级红线:被打中是「散架重组」,所以零件是齿轮/弹簧/履带片这类玩具件,没有火、没有伤。
 */

import { shade, withAlpha } from "../../art/kit/palette";
import { DX, DY } from "./terrain12";
import type { Tank, World } from "./logic";
import { REBUILD_SECONDS } from "./logic";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const TK_COLORS = {
  /** 地面底色 */
  tkGround: "#F5EBDD",
  /** 砖墙顶面 */
  tkBrick: "#E2A87A",
  /** 砖墙右侧面 = shade(tkBrick, -22) */
  tkBrickSide: shade("#E2A87A", -22),
  /** 钢块顶面 */
  tkSteel: "#C9D3DE",
  /** 草丛主色 */
  tkGrass: "#9FD98B",
  /** 冰面主色 */
  tkIce: "#DDF2FF",
  /** 水面主色 */
  tkWater: "#A8D8F0",
  /** 朵朵车体主色 */
  tkPink: "#F4859F",
  /** 星星车体主色 */
  tkBlue: "#7FB2F0",
  /** 全图统一右下投影 */
  tkShadow: "rgba(70,60,50,.16)",
} as const;

/** 徽章金边 / 基地星星用的金 */
export const TK_GOLD = "#F2C94C";
/** 履带与炮管这类「铁件」的深灰 */
export const TK_IRON = "#6B6478";
/** 描边统一深 20%:轮廓色都从主色 shade(-20) 拿 */
export const OUTLINE_SHADE = -20;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 履带齿滚动:行进中每 0.2s 滚一格齿(step 缓动),reduced 冻结 */
export const TRACK_STEP_MS = 200;
/** 水面波纹:两帧 1600ms 交替(linear),reduced 冻结 */
export const WATER_WAVE_MS = 1600;
/** 冰面高光扫条:4000ms 一趟(easeInOut),reduced 冻结 */
export const ICE_SHEEN_MS = 4000;
/** 重生光环:1200ms 一圈(linear),reduced 静态环 + 进度弧保留 */
export const REBUILD_RING_MS = 1200;
/** 受击白闪帧数(功能反馈,reduced 也保留) */
export const HIT_FLASH_FRAMES = 2;
/** 炮口十字闪光帧数;reduced 留 1 帧(这是「打出去了」的功能反馈) */
export const MUZZLE_FLASH_FRAMES = 2;
export const MUZZLE_FLASH_FRAMES_REDUCED = 1;
/** 护甲小盾牌图标的边长(px,写死 —— 缩放格子也不缩它) */
export const ARMOR_BADGE_PX = 8;
/** 全图统一右下投影偏移(px) */
export const SHADOW_PX = 2;
/** 2.5D 侧面高度 = 0.18 × 块宽(与 art/kit/block25d 的 SIDE_RATIO 同值) */
export const TANK_SIDE_RATIO = 0.18;
/** 履带齿:齿高 1.5px、齿距 3px */
export const TRACK_TOOTH_H = 1.5;
export const TRACK_TOOTH_GAP = 3;
/** 炮塔圆壳直径 = 0.55 × 车宽 */
export const TURRET_RATIO = 0.55;

// ---------------------------------------------------------------------------
// 纯函数相位:全部「毫秒进、相位出」,不持有状态
// ---------------------------------------------------------------------------

/** smoothstep:冰面扫光的 easeInOut 就用它 */
export function easeInOut(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/**
 * 履带齿相位:里程毫秒 / 200ms 一格,向下取整(step 缓动)。
 * 里程是有符号的:倒着溜(冰面)里程变负,相位就往回退 —— 齿纹反向滚。
 */
export function trackPhase(rollMs: number): number {
  return Math.floor(rollMs / TRACK_STEP_MS);
}

/** 履带齿纹的错位量(px):奇数相位错开半个齿距,负相位也算得对 */
export function trackToothOffset(rollMs: number): number {
  const parity = ((trackPhase(rollMs) % 2) + 2) % 2;
  return parity * (TRACK_TOOTH_GAP / 2);
}

/** 水面两帧波纹:0 / 1 交替,每帧 1600ms;reduced 永远停在第 0 帧 */
export function waterFrame(tMs: number, reduced: boolean): 0 | 1 {
  if (reduced) return 0;
  return (Math.floor(Math.max(0, tMs) / WATER_WAVE_MS) % 2) as 0 | 1;
}

/** 冰面扫光条的位置(0..1,easeInOut);reduced 冻结在 0 */
export function iceSheenPos(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return easeInOut((Math.max(0, tMs) % ICE_SHEEN_MS) / ICE_SHEEN_MS);
}

/** 重生光环角度(弧度,linear);reduced 静态(0) */
export function ringAngle(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((Math.max(0, tMs) % REBUILD_RING_MS) / REBUILD_RING_MS) * Math.PI * 2;
}

/** 重生进度(0..1):只读 `REBUILD_SECONDS`,不定义自己的时长 */
export function rebuildProgress(spin: number): number {
  return Math.max(0, Math.min(1, (REBUILD_SECONDS - spin) / REBUILD_SECONDS));
}

// ---------------------------------------------------------------------------
// TankFx:渲染侧的小账本(destroy 时 reset 归零)
// ---------------------------------------------------------------------------

interface FxEntry {
  x: number;
  y: number;
  /** 履带里程(毫秒计,带符号:前进加、倒溜减) */
  roll: number;
  /** 炮口十字闪光还剩几帧 */
  muzzle: number;
  /** 受击白闪还剩几帧 */
  hit: number;
  armor: number;
  windup: number;
}

export class TankFx {
  private map = new Map<number, FxEntry>();
  private lastT = -1;

  /** 正在记账的坦克数(测试与 destroy 自查用) */
  get tracked(): number {
    return this.map.size;
  }

  reset(): void {
    this.map.clear();
    this.lastT = -1;
  }

  /**
   * 每帧画之前喂一次。只读世界:
   *  - 位移沿车头方向投影,前进里程加、倒溜里程减(reduced 冻结不加);
   *  - 前摇归零的那一帧 = 弹丸出膛 → 点燃炮口闪光(reduced 留 1 帧);
   *  - 护甲掉一格 = 挨了一发 → 白闪 2 帧(功能反馈,reduced 也保留)。
   */
  update(w: World, tMs: number, reduced: boolean): void {
    const dt = this.lastT < 0 ? 0 : Math.max(0, tMs - this.lastT);
    this.lastT = tMs;
    const seen = new Set<number>();
    for (const tk of w.tanks) {
      seen.add(tk.id);
      let e = this.map.get(tk.id);
      if (!e) {
        e = { x: tk.x, y: tk.y, roll: 0, muzzle: 0, hit: 0, armor: tk.armor, windup: tk.windup };
        this.map.set(tk.id, e);
      }
      const dx = tk.x - e.x;
      const dy = tk.y - e.y;
      if (!reduced && Math.abs(dx) + Math.abs(dy) > 1e-4) {
        const ahead = dx * DX[tk.dir] + dy * DY[tk.dir];
        e.roll += (ahead >= 0 ? 1 : -1) * dt;
      }
      if (e.windup > 0 && tk.windup <= 0) {
        e.muzzle = reduced ? MUZZLE_FLASH_FRAMES_REDUCED : MUZZLE_FLASH_FRAMES;
      } else if (e.muzzle > 0) {
        e.muzzle -= 1;
      }
      if (tk.armor < e.armor) e.hit = HIT_FLASH_FRAMES;
      else if (e.hit > 0) e.hit -= 1;
      e.x = tk.x;
      e.y = tk.y;
      e.armor = tk.armor;
      e.windup = tk.windup;
    }
    for (const id of [...this.map.keys()]) {
      if (!seen.has(id)) this.map.delete(id);
    }
  }

  rollOf(tk: Tank): number {
    return this.map.get(tk.id)?.roll ?? 0;
  }

  muzzleOf(tk: Tank): number {
    return this.map.get(tk.id)?.muzzle ?? 0;
  }

  hitOf(tk: Tank): number {
    return this.map.get(tk.id)?.hit ?? 0;
  }
}

/** 半透明白 / 半透明描边这类到处要用的小抄 */
export const SOFT_WHITE = withAlpha("#FFFFFF", 0.55);
