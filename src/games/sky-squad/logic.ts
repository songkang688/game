/**
 * 飞机小队 —— 武器、僚机、护盾、炸弹、波次与结算的纯逻辑(零 DOM)。
 *
 * 分级约定:全部是原创卡通小飞机,被击中只是**冒烟迫降**——冒一串白烟、
 * 摇摇晃晃滑出画面,不炸开、不掉零件、没有任何伤亡描写。
 * 玩家被碰到也只是「护盾破了」或者「换一架备用小飞机」。
 */
import { PLAYER_HIT_R, SKY_H, SKY_W, type Bullet } from "./bullets";
import { dropOneLevel, emptyPower, upgrade, type PowerLevels, type PowerTrack } from "./power";

// ---------------------------------------------------------------------------
// 主武器
// ---------------------------------------------------------------------------

export type WeaponKind = "star" | "wave" | "beam";

export interface WeaponInfo {
  name: string;
  emoji: string;
  desc: string;
  /** 两次射击的间隔(秒) */
  cooldown: number;
  /** 弹体颜色(冷色,和暖色敌弹区分开) */
  color: string;
}

export const WEAPONS: Record<WeaponKind, WeaponInfo> = {
  star: {
    name: "星星弹",
    emoji: "⭐",
    desc: "正面小扇形,升级后一次三发,啥都能打。",
    cooldown: 0.16,
    color: "#7FC6FF",
  },
  wave: {
    name: "波纹弹",
    emoji: "🌊",
    desc: "又宽又慢的大弹,横着扫一片,适合清小飞机。",
    cooldown: 0.3,
    color: "#79E2D2",
  },
  beam: {
    name: "光束",
    emoji: "💠",
    desc: "又细又快还能穿透,打 Boss 最疼。",
    cooldown: 0.11,
    color: "#A9B6FF",
  },
};

export const WEAPON_ORDER: WeaponKind[] = ["star", "wave", "beam"];

export interface PlayerShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 打一下掉多少血 */
  damage: number;
  /** 能不能穿过去继续打后面的 */
  pierce: boolean;
  kind: WeaponKind;
}

/** 火力等级:1~3,吃道具升级,被碰到掉一级(不会掉到 0 以下) */
export const MAX_POWER = 3;

/** 一次射击打出的子弹(纯函数;power 会被夹在 1..3) */
export function playerShots(kind: WeaponKind, power: number, x: number, y: number): PlayerShot[] {
  const p = Math.max(1, Math.min(MAX_POWER, Math.round(power)));
  const out: PlayerShot[] = [];
  const push = (dx: number, vx: number, vy: number, r: number, damage: number, pierce: boolean): void => {
    out.push({ x: x + dx, y, vx, vy, r, damage, pierce, kind });
  };
  switch (kind) {
    case "star": {
      const n = p;
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        push(f * 16, f * 120, -560, 6, 1, false);
      }
      break;
    }
    case "wave": {
      const n = p;
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        push(f * 34, f * 40, -330, 15, 1, false);
      }
      break;
    }
    case "beam": {
      push(0, 0, -820, 4, p >= 2 ? 2 : 1, true);
      if (p >= 3) {
        push(-13, 0, -820, 4, 1, true);
        push(13, 0, -820, 4, 1, true);
      }
      break;
    }
  }
  return out;
}

/** 一秒能打多少下(给攻略与平衡测试看的口径) */
export function shotsPerSecond(kind: WeaponKind): number {
  return Math.round(10 / WEAPONS[kind].cooldown) / 10;
}

/** 单位时间的期望伤害:三种武器各有各的强项,不能有一把完全压过另外两把 */
export function dps(kind: WeaponKind, power: number): number {
  const shots = playerShots(kind, power, 0, 0);
  const perShot = shots.reduce((s, b) => s + b.damage, 0);
  return Math.round((perShot / WEAPONS[kind].cooldown) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 僚机
// ---------------------------------------------------------------------------

/** 最多带几架僚机 */
export const MAX_WINGMEN = 2;

/** 僚机相对主机的站位(左右对称,不挡视线) */
export function wingmanOffsets(count: number): Array<{ dx: number; dy: number }> {
  const n = Math.max(0, Math.min(MAX_WINGMEN, Math.round(count)));
  const out: Array<{ dx: number; dy: number }> = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2) + 1;
    out.push({ dx: side * (34 + rank * 10), dy: 22 + rank * 6 });
  }
  return out;
}

/** 僚机火力比主机弱一档,而且只打直线 */
export function wingmanShots(kind: WeaponKind, x: number, y: number): PlayerShot[] {
  return [{ x, y, vx: 0, vy: kind === "beam" ? -700 : -480, r: 5, damage: 1, pierce: false, kind }];
}

// ---------------------------------------------------------------------------
// 护盾 / 炸弹 / 备用小飞机
// ---------------------------------------------------------------------------

export interface PlaneState {
  /** 备用小飞机数量(被碰到就换一架,不是「命」也不是「血」) */
  spare: number;
  /** 护盾还能挡几下 */
  shield: number;
  /** 炸弹还剩几颗 */
  bombs: number;
  weapon: WeaponKind;
  power: number;
  wingmen: number;
  /** 刚换飞机后的无敌时间(秒) */
  invuln: number;
  /** 1.2:四条火力成长线的等级(散射 / 追踪 / 穿透 / 僚机) */
  levels: PowerLevels;
}

export function makePlane(weapon: WeaponKind = "star"): PlaneState {
  return { spare: 2, shield: 0, bombs: 3, weapon, power: 1, wingmen: 0, invuln: 1.2, levels: emptyPower() };
}

/** 被碰到后打转的时长(秒);打转期间连着短无敌,不是坠毁 */
export const SPIN_SECONDS = 0.9;

export type TouchOutcome = "shielded" | "swapped" | "grounded" | "ignored";

export interface TouchResult {
  plane: PlaneState;
  outcome: TouchOutcome;
  /** 给玩家看的一句话 */
  line: string;
  /** 飞机要打多久的转 */
  spin: number;
  /** 这一下掉了哪条火力线(没掉就是 null) */
  lost: PowerTrack | null;
}

/**
 * 被敌弹碰到:先破护盾;护盾没了就**原地打个转**、短无敌一下、掉一级火力,
 * 换一架备用小飞机接着飞 —— 不是坠毁,也没有任何伤亡描写。
 * 备用机全都去检修了,这一趟才算飞不下去。无敌时间内直接忽略。
 */
export function touchPlane(plane: PlaneState): TouchResult {
  const levels = plane.levels ?? emptyPower();
  if (plane.invuln > 0) return { plane, outcome: "ignored", line: "", spin: 0, lost: null };
  if (plane.shield > 0) {
    return {
      plane: { ...plane, shield: plane.shield - 1, invuln: 0.8 },
      outcome: "shielded",
      line: "护盾泡泡挡下来啦!",
      spin: 0.35,
      lost: null,
    };
  }
  if (plane.spare > 0) {
    const dropped = dropOneLevel(levels);
    return {
      plane: {
        ...plane,
        spare: plane.spare - 1,
        power: Math.max(1, plane.power - 1),
        wingmen: Math.max(0, plane.wingmen - 1),
        invuln: 1.4,
        levels: dropped.levels,
      },
      outcome: "swapped",
      line: "打了个转稳住啦,火力掉一级,换一架备用小飞机继续!",
      spin: SPIN_SECONDS,
      lost: dropped.track,
    };
  }
  return {
    plane: { ...plane, invuln: 0 },
    outcome: "grounded",
    line: "小飞机都去检修啦,这趟先到这里。",
    spin: SPIN_SECONDS,
    lost: null,
  };
}

/** 炸弹:清空全场敌弹,并让在场的小飞机统统冒烟迫降 */
export function useBomb(plane: PlaneState, bullets: readonly Bullet[]): {
  plane: PlaneState;
  bullets: Bullet[];
  cleared: number;
  used: boolean;
} {
  if (plane.bombs <= 0) return { plane, bullets: bullets.slice(), cleared: 0, used: false };
  return {
    plane: { ...plane, bombs: plane.bombs - 1, invuln: Math.max(plane.invuln, 0.8) },
    bullets: [],
    cleared: bullets.length,
    used: true,
  };
}

/**
 * 关内拾取。1.1 的五种全部保留(关卡数据里写的就是它们),
 * 1.2 另外加了「追踪 / 穿透」两种,让四条成长线都能在关里捡到。
 */
export type PickupKind = "power" | "shield" | "bomb" | "wing" | "weapon" | "homing" | "pierce";

export const PICKUP_INFO: Record<PickupKind, { emoji: string; label: string }> = {
  power: { emoji: "🌟", label: "散射 +1" },
  shield: { emoji: "🫧", label: "护盾泡泡" },
  bomb: { emoji: "💣", label: "炸弹 +1" },
  wing: { emoji: "🛩️", label: "僚机加入" },
  weapon: { emoji: "🔁", label: "换一把主武器" },
  homing: { emoji: "🎈", label: "追踪 +1" },
  pierce: { emoji: "💠", label: "穿透 +1" },
};

/** 道具 → 成长线(没有对应成长线的返回 null) */
export const PICKUP_TRACK: Partial<Record<PickupKind, PowerTrack>> = {
  power: "spread",
  wing: "wing",
  homing: "homing",
  pierce: "pierce",
};

/** 吃到道具(纯函数) */
export function applyPickup(plane: PlaneState, kind: PickupKind): PlaneState {
  const levels = plane.levels ?? emptyPower();
  const track = PICKUP_TRACK[kind];
  const grown = track ? upgrade(levels, track).levels : levels;
  switch (kind) {
    case "power":
      return { ...plane, power: Math.min(MAX_POWER, plane.power + 1), levels: grown };
    case "shield":
      return { ...plane, shield: Math.min(3, plane.shield + 1), levels: grown };
    case "bomb":
      return { ...plane, bombs: Math.min(5, plane.bombs + 1), levels: grown };
    case "wing":
      return { ...plane, wingmen: Math.min(MAX_WINGMEN, plane.wingmen + 1), levels: grown };
    case "homing":
    case "pierce":
      return { ...plane, levels: grown };
    case "weapon": {
      const i = WEAPON_ORDER.indexOf(plane.weapon);
      return {
        ...plane,
        weapon: WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length],
        power: Math.max(1, plane.power),
        levels: grown,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 敌机
// ---------------------------------------------------------------------------

export type FoeKind = "scout" | "puff" | "kite" | "tanker";

export const FOE_INFO: Record<FoeKind, { name: string; hp: number; speed: number; r: number; color: string }> = {
  scout: { name: "小侦察机", hp: 1, speed: 92, r: 16, color: "#FFB4A2" },
  puff: { name: "圆滚滚气囊机", hp: 2, speed: 62, r: 21, color: "#FFD59E" },
  kite: { name: "风筝机", hp: 2, speed: 118, r: 18, color: "#F7A8C4" },
  tanker: { name: "大肚运输机", hp: 5, speed: 48, r: 28, color: "#E0B4E8" },
};

export interface Foe {
  id: number;
  kind: FoeKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  /** 下一次开火还要等几秒 */
  fireIn: number;
  phase: number;
}

/** 敌机被打中:掉血;掉到 0 就冒烟迫降(alive=false 交给上层处理) */
export function damageFoe(foe: Foe, damage: number): { foe: Foe; downed: boolean } {
  const hp = foe.hp - Math.max(0, damage);
  return { foe: { ...foe, hp }, downed: hp <= 0 };
}

/** 敌机迫降的滑行方向:朝画面外飘,永远不会掉回战场上 */
export function glideAway(foe: Foe): { vx: number; vy: number } {
  return { vx: foe.x < SKY_W / 2 ? -70 : 70, vy: 120 };
}

// ---------------------------------------------------------------------------
// 结算
// ---------------------------------------------------------------------------

export interface SortieStat {
  /** 打下来几架 */
  downed: number;
  /** 这一关一共几架 */
  total: number;
  /** 被碰到几次(含护盾挡下的) */
  touched: number;
  /** 用了几颗炸弹 */
  bombs: number;
  /** 从画面底下溜过去、没被拦住的几架 */
  escaped?: number;
  /** Boss 关才有:有没有把 Boss 请回机库 */
  bossDown: boolean;
}

/**
 * 放跑多少架就算这趟没完成任务。
 *
 * 基准是 25% 的容错,并且至少给 2 架。但编制小的关要再收一道口:
 * 3 架的关放跑 2 架还判「完成任务」就说不过去了,所以容错永远不超过编制的三分之一。
 */
export function escapeLimit(total: number): number {
  if (total <= 0) return 2;
  return Math.min(Math.max(2, Math.floor(total * 0.25)), Math.floor(total / 3));
}

/** 这一趟算不算完成:Boss 关必须把 Boss 请回机库,普通关不能放跑太多 */
export function sortieCleared(stat: SortieStat, bossLevel: boolean): boolean {
  if (bossLevel && !stat.bossDown) return false;
  return (stat.escaped ?? 0) <= escapeLimit(stat.total);
}

/** 一趟飞行的星级:全清是底线,少挨碰、少用炸弹才是三星;放跑了就别想三星 */
export function starsForSortie(stat: SortieStat): 1 | 2 | 3 {
  if ((stat.escaped ?? 0) > 0) return stat.touched === 0 ? 2 : 1;
  if (stat.touched === 0 && stat.bombs === 0) return 3;
  if (stat.touched <= 1 && stat.bombs <= 1) return 2;
  return 1;
}

export function sortieMessage(stat: SortieStat): string {
  const escaped = stat.escaped ?? 0;
  if (escaped > 0) {
    return `有 ${escaped} 架从底下溜走了。让它们靠近一点再打,命中率反而更高。`;
  }
  if (stat.touched === 0 && stat.bombs === 0) {
    return `${stat.downed} 架全部请回机库,一下都没被碰到,漂亮的满分航线!`;
  }
  if (stat.touched === 0) {
    return `一下都没被碰到,就是炸弹用了 ${stat.bombs} 颗——留着炸弹打 Boss 更划算。`;
  }
  return `被碰到 ${stat.touched} 次,记住:机身判定点只有中间那一小块,别急着往缝里冲。`;
}

// ---------------------------------------------------------------------------
// 无尽波次
// ---------------------------------------------------------------------------

export interface WaveSpec {
  /** 这一波几架敌机 */
  foes: number;
  /** 敌机种类池 */
  kinds: FoeKind[];
  /** 速度倍率 */
  speed: number;
  /** 这一波会不会掉道具 */
  pickup: PickupKind | null;
  /** 敌机开火间隔(秒),越往后越密但永远不会低于这个下限 */
  fireGap: number;
}

/** 无尽模式第 wave 波(1 基) */
export function waveSpec(wave: number): WaveSpec {
  const w = Math.max(1, Math.floor(wave));
  const kinds: FoeKind[] = ["scout"];
  if (w >= 3) kinds.push("puff");
  if (w >= 5) kinds.push("kite");
  if (w >= 8) kinds.push("tanker");
  const pickupCycle: Array<PickupKind | null> = [null, "power", null, "shield", null, "bomb", "wing", "weapon"];
  return {
    foes: Math.min(14, 3 + Math.floor(w * 0.8)),
    kinds,
    speed: Math.min(2, 1 + w * 0.05),
    pickup: pickupCycle[w % pickupCycle.length],
    fireGap: Math.max(0.85, 2.2 - w * 0.06),
  };
}

/** 无尽成绩:波数是大头,打下来的飞机是零头 */
export function endlessScore(wave: number, downed: number): number {
  return Math.max(0, Math.floor(wave - 1)) * 120 + Math.max(0, downed) * 8;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type SkyAction = "left" | "right" | "up" | "down" | "fire" | "bomb";

/** 双人键位:朵朵 W A S D + F(开火)/G(炸弹),星星 ↑←↓→ + L(开火)/K(炸弹) */
export const KEY_MAP: Record<string, { player: 0 | 1; action: SkyAction }> = {
  KeyW: { player: 0, action: "up" },
  KeyA: { player: 0, action: "left" },
  KeyS: { player: 0, action: "down" },
  KeyD: { player: 0, action: "right" },
  KeyF: { player: 0, action: "fire" },
  KeyG: { player: 0, action: "bomb" },
  ArrowUp: { player: 1, action: "up" },
  ArrowLeft: { player: 1, action: "left" },
  ArrowDown: { player: 1, action: "down" },
  ArrowRight: { player: 1, action: "right" },
  KeyL: { player: 1, action: "fire" },
  KeyK: { player: 1, action: "bomb" },
};

export function keyToAction(code: string, playerCount: number): { player: number; action: SkyAction } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  return { player: playerCount <= 1 ? 0 : hit.player, action: hit.action };
}

export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

// ---------------------------------------------------------------------------
// 位置夹取
// ---------------------------------------------------------------------------

/** 把小飞机夹在战场里(上下都留一点,免得贴边看不见) */
export function clampPlane(x: number, y: number): { x: number; y: number } {
  const m = PLAYER_HIT_R + 14;
  return {
    x: Math.max(m, Math.min(SKY_W - m, x)),
    y: Math.max(m + 40, Math.min(SKY_H - m, y)),
  };
}

/**
 * 手机上拖着飞:飞机要停在手指**上方** `lift` 像素,
 * 不然手指正好盖住那个判定核心,等于让孩子闭着眼躲弹幕。
 * 默认 40px(规格第八节),设 0 就是手指底下跟手。
 */
export const TOUCH_LIFT = 40;

export function dragTarget(px: number, py: number, lift = TOUCH_LIFT): { x: number; y: number } {
  return clampPlane(px, py - Math.max(0, lift));
}

// ---------------------------------------------------------------------------
// 版面:画布多高、480×720 怎么塞进去
// ---------------------------------------------------------------------------

export const CANVAS_MIN_H = 210;
export const CANVAS_MAX_H = 460;

/**
 * 画布盒子该多高。
 *
 * 平台的 `.game-stage` 是 `overflow:hidden` 的一屏,掉到它下沿外面的东西
 * 既看不见也点不着。所以高度不能只按纵版比例算,还得听「还剩多少地方」这句话:
 * `room` 是画布顶边到那条下沿之间、扣掉画布底下那些按钮之后剩的像素。
 */
export function canvasBoxHeight(cssW: number, room: number): number {
  const ideal = (cssW / SKY_W) * SKY_H;
  const fits = Math.min(ideal, Math.max(CANVAS_MIN_H, room));
  return Math.round(Math.max(CANVAS_MIN_H, Math.min(CANVAS_MAX_H, fits)));
}

/**
 * 480×720 这片天空怎么摆进画布:等比缩放 + 居中。
 *
 * 1.1 是按宽度定的缩放,画布一矮,玩家那一行(y=596)就被裁到画布下沿外面 ——
 * 拖着飞却看不见自己的飞机。这里改成两边都取小的那个比例,天空一格都不裁,
 * 富余出来的地方留白当边框。
 */
export function skyFit(cssW: number, cssH: number): { scale: number; offX: number; offY: number } {
  const scale = Math.min(cssW / SKY_W, cssH / SKY_H);
  return { scale, offX: (cssW - SKY_W * scale) / 2, offY: (cssH - SKY_H * scale) / 2 };
}

/** 圆与圆是否相碰(子弹打飞机、飞机吃道具都用它) */
export function circlesTouch(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}
