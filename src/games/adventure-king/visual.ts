// 冒险小王 · 纯视觉层(1.3 视觉升级 · 第 17 步 B 档)。
//
// 这里只有「怎么画」:配色 token、动效时序、姿态与倾角的纯映射、
// 残影 / 晕圈这类纯视觉粒子的记账,以及主角 / 敌人 / 文物 / 锚点的程序化画法。
// 玩法状态(sim.ts)在这里**只读不写**:荡绳角度、无敌计数、朝向都只做映射,
// 一个判定数值都不产生、不修改。光源统一在左上 45°。

// ---------------------------------------------------------------------------
// 配色板(四·补一):token 一字不差,索引起来测试直接比对
// ---------------------------------------------------------------------------

export const AK_PALETTE = {
  /** 探险帽主色 */
  akHat: "#C89B6C",
  /** 围巾飘带 */
  akScarf: "#F4859F",
  /** 平台草顶 */
  akGrass: "#9FD98B",
  /** 平台土身 */
  akSoil: "#D8B48F",
  /** 平台石底 */
  akStone: "#B9AFA4",
  /** 文物金描边 / 光柱 */
  akGold: "#F0C25A",
  /** 钩绳(另加 1px 亮芯) */
  akRope: "#A87B4F",
  /** 全场统一落影 */
  akShadow: "rgba(90,74,60,.16)",
} as const;

export type AkPaletteToken = keyof typeof AK_PALETTE;

// ---------------------------------------------------------------------------
// 动效时序(四·补三):毫秒 / 段数写死成常量,测试直接引用
// ---------------------------------------------------------------------------

export const AK_TIMING = {
  /** 落地回弹时长(easeOutBack;reduced 关) */
  landBounceMs: 90,
  /** 无敌白描边呼吸周期(sin;reduced 恒定半透明) */
  invincibleBreathMs: 400,
  /** 回旋镖残影段数(常态) */
  boomTrailSegments: 3,
  /** 回旋镖残影段数(reduced) */
  boomTrailSegmentsReduced: 1,
  /** 文物自转闪点一圈(linear;reduced 静止高光) */
  artifactSpinMs: 2400,
  /** 锚点可钩微光周期(sin;reduced 恒定亮描边) */
  anchorGlowMs: 1600,
  /** 守卫被敲晕后「晕圈 + 星星绕头」停留时长 */
  stunFadeMs: 700,
} as const;

/** 跑姿前倾角:8° */
export const AK_RUN_LEAN_RAD = (8 * Math.PI) / 180;
/** 跑动时围巾后飘上限:25° */
export const AK_SCARF_RUN_RAD = (25 * Math.PI) / 180;
/** 静止 / reduced 时围巾微垂角 */
export const AK_SCARF_DROOP_RAD = 0.12;
/** 落地压扁比例:10% */
export const AK_LAND_SQUASH = 0.1;
/** 无敌态整体透明度(整帧消失 → 半透明,孩子不再以为角色瞬移丢帧) */
export const AK_INVINCIBLE_ALPHA = 0.55;
/** 帽檐渲染宽度低于这个像素数就退化为色块(360px 兜底) */
export const AK_HAT_MIN_PX = 5;

/** drawHud(画布)与 renderHud(古堡 DOM)统一的卡片规格 */
export const AK_CARD = {
  radius: 12,
  bg: "rgba(255,255,255,.72)",
  strokeW: 1.5,
  stroke: "rgba(122,82,48,.28)",
  /** HUD 字号下限 */
  fontMin: 14,
} as const;

/** 图层序(draw 从底到顶,index.ts 按这个顺序调用) */
export const AK_LAYER_ORDER = [
  "background",
  "midBushes",
  "platforms",
  "anchors",
  "door",
  "artifacts",
  "enemies",
  "boomerang",
  "player",
  "particles",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 姿态与倾角:全部是「读状态 → 出画法」的纯映射
// ---------------------------------------------------------------------------

export type AkPose = "run" | "jump" | "swing" | "land";

export interface AkPoseInput {
  onGround: boolean;
  hasHook: boolean;
  /** 距最近一次落地过了多少毫秒(没落过地给 Infinity) */
  sinceLandMs: number;
}

/** 主角这一帧摆哪个姿态:荡绳 > 空中 > 刚落地(90ms 窗口) > 跑 / 站 */
export function playerPose(s: AkPoseInput, reduced: boolean): AkPose {
  if (s.hasHook) return "swing";
  if (!s.onGround) return "jump";
  if (!reduced && s.sinceLandMs >= 0 && s.sinceLandMs < AK_TIMING.landBounceMs) return "land";
  return "run";
}

function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 荡绳倾角:身体沿绳切线 = 绳角本身,只读只映射(夹一下防御,不回写) */
export function swingLean(ropeAngle: number): number {
  return clampNum(ropeAngle, -1.5, 1.5);
}

/** 跑姿前倾:跟随水平速度,封顶 8°,朝向决定倾斜方向 */
export function runLean(vx: number, facing: number): number {
  return facing * AK_RUN_LEAN_RAD * Math.min(1, Math.abs(vx) / 250);
}

/** easeOutBack:回弹缓动(t 夹到 0..1) */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clampNum(t, 0, 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 落地压扁量:落地瞬间 10%,90ms 内 easeOutBack 回弹到 0;reduced 恒 0 */
export function landSquash(sinceLandMs: number, reduced: boolean): number {
  if (reduced) return 0;
  if (sinceLandMs < 0 || sinceLandMs >= AK_TIMING.landBounceMs) return 0;
  return AK_LAND_SQUASH * (1 - easeOutBack(sinceLandMs / AK_TIMING.landBounceMs));
}

export interface InvincibleStyle {
  /** 整体透明度:无敌时半透明,绝不整帧消失 */
  alpha: number;
  /** 白描边呼吸强度 0..1;0 = 不画描边 */
  ring: number;
}

/**
 * 无敌视觉:时序完全沿用 sim.ts 的 invincible 计数(秒),这里只读它算相位。
 * reduced 下呼吸停,但恒定半透明 + 恒定描边,提示保留。
 */
export function invincibleStyle(invincibleSec: number, reduced: boolean): InvincibleStyle {
  if (invincibleSec <= 0) return { alpha: 1, ring: 0 };
  if (reduced) return { alpha: AK_INVINCIBLE_ALPHA, ring: 1 };
  const phase = ((invincibleSec * 1000) % AK_TIMING.invincibleBreathMs) / AK_TIMING.invincibleBreathMs;
  return { alpha: AK_INVINCIBLE_ALPHA, ring: 0.5 + 0.5 * Math.sin(phase * Math.PI * 2) };
}

/** 围巾飘带角度:跑动后飘(跟速度)、荡绳沿切线、静止微垂;reduced 一律静止微垂 */
export function scarfAngle(pose: AkPose, vx: number, ropeAngle: number, reduced: boolean): number {
  if (reduced) return AK_SCARF_DROOP_RAD;
  if (pose === "swing") return swingLean(ropeAngle);
  if (pose === "jump") return AK_SCARF_RUN_RAD * 0.6;
  const k = Math.min(1, Math.abs(vx) / 250);
  return AK_SCARF_DROOP_RAD + (AK_SCARF_RUN_RAD - AK_SCARF_DROOP_RAD) * k;
}

/** 回旋镖残影段数:常态 3 段渐隐,reduced 1 段 */
export function boomTrailSegments(reduced: boolean): number {
  return reduced ? AK_TIMING.boomTrailSegmentsReduced : AK_TIMING.boomTrailSegments;
}

/** 文物自转闪点相位 0..1;reduced 恒 0.125(闪点停在左上 45°,静态高光保留) */
export function artifactSpinPhase(nowMs: number, reduced: boolean): number {
  if (reduced) return 0.125;
  return (nowMs % AK_TIMING.artifactSpinMs) / AK_TIMING.artifactSpinMs;
}

/** 锚点可钩微光 0..1;reduced 恒 1(亮描边提示保留) */
export function anchorGlow(nowMs: number, reduced: boolean): number {
  if (reduced) return 1;
  const phase = (nowMs % AK_TIMING.anchorGlowMs) / AK_TIMING.anchorGlowMs;
  return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
}

/** 帽檐渲染宽度小于 5px 就别画细节了,退化成一块帽色色块 */
export function hatDegraded(brimWidthPx: number): boolean {
  return brimWidthPx < AK_HAT_MIN_PX;
}

/**
 * 落影该落在哪:主角(尤其荡绳时)脚下正对的那块石台台面。
 * 只读平台表,选「台面不高于脚、水平方向罩得住」里最高的一块;都罩不住返回 null。
 */
export function shadowGroundY(
  platforms: ReadonlyArray<{ x: number; y: number; w: number }>,
  px: number,
  footY: number
): number | null {
  let best: number | null = null;
  for (const p of platforms) {
    if (px < p.x - 4 || px > p.x + p.w + 4) continue;
    if (p.y < footY - 2) continue;
    if (best === null || p.y < best) best = p.y;
  }
  return best;
}

// ---------------------------------------------------------------------------
// 纯视觉粒子记账:回旋镖残影、晕圈星星、落地时间戳。destroy 时 reset 归零。
// ---------------------------------------------------------------------------

export interface TrailPoint {
  x: number;
  y: number;
}

export interface StunFx {
  x: number;
  y: number;
  ageMs: number;
}

/** 残影最多记多少个采样点(3 段 × 每段 4 点,多一点富余) */
export const AK_TRAIL_CAP = 16;

export class VisualFx {
  trail: TrailPoint[] = [];
  stuns: StunFx[] = [];
  /** 最近一次落地的时间戳(毫秒);-1 = 还没落过地 */
  landAtMs = -1;

  pushTrail(x: number, y: number): void {
    this.trail.push({ x, y });
    if (this.trail.length > AK_TRAIL_CAP) this.trail.shift();
  }

  clearTrail(): void {
    this.trail.length = 0;
  }

  spawnStun(x: number, y: number): void {
    this.stuns.push({ x, y, ageMs: 0 });
  }

  /** 每帧推进:晕圈老化,到点自动清走 */
  step(dtMs: number): void {
    for (const s of this.stuns) s.ageMs += dtMs;
    this.stuns = this.stuns.filter((s) => s.ageMs < AK_TIMING.stunFadeMs);
  }

  markLand(nowMs: number): void {
    this.landAtMs = nowMs;
  }

  sinceLand(nowMs: number): number {
    return this.landAtMs < 0 ? Infinity : nowMs - this.landAtMs;
  }

  /** destroy 时调用:残影、晕圈、落地计时全部归零 */
  reset(): void {
    this.trail = [];
    this.stuns = [];
    this.landAtMs = -1;
  }
}

// ---------------------------------------------------------------------------
// 2D 画笔的最小结构接口:真 CanvasRenderingContext2D 与测试桩都天然满足
// ---------------------------------------------------------------------------

export interface AkGradient {
  addColorStop(offset: number, color: string): void;
}

export interface AkBrush {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: unknown;
  globalAlpha: number;
  font: string;
  textAlign: unknown;
  textBaseline: unknown;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): AkGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): AkGradient;
}

/** 把 #rrggbb 变亮 / 变暗一点(k>0 提亮,k<0 压暗),给三停渐变用 */
export function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): number => {
    const t = k >= 0 ? c + (255 - c) * k : c * (1 + k);
    return Math.round(clampNum(t, 0, 255));
  };
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------------------
// 钩绳:双色绳(棕底 + 1px 亮芯),画在主角手位起点
// ---------------------------------------------------------------------------

export function drawRope(b: AkBrush, ax: number, ay: number, hx: number, hy: number, scale: number): void {
  b.save();
  b.lineCap = "round";
  b.strokeStyle = AK_PALETTE.akRope;
  b.lineWidth = 3 * scale;
  b.beginPath();
  b.moveTo(ax, ay);
  b.lineTo(hx, hy);
  b.stroke();
  b.strokeStyle = shadeHex(AK_PALETTE.akRope, 0.45);
  b.lineWidth = 1;
  b.beginPath();
  b.moveTo(ax, ay);
  b.lineTo(hx, hy);
  b.stroke();
  b.restore();
}

// ---------------------------------------------------------------------------
// 主角:八道工序(四·补二)。r=17 判定圆一个数不改,全画在其上。
// ---------------------------------------------------------------------------

export interface PlayerSpriteOpts {
  /** 脚底中点(屏幕坐标) */
  x: number;
  y: number;
  scale: number;
  facing: number;
  pose: AkPose;
  /** 身体倾角(弧度):跑 = 前倾 8°,荡 = 沿绳切线 */
  lean: number;
  /** 围巾飘带角度(弧度) */
  scarf: number;
  /** 落地压扁量 0..0.1 */
  squash: number;
  inv: InvincibleStyle;
  /** 围巾的细微飘动相位(reduced 时给 0) */
  flutterMs: number;
  /** 帽檐太小就退化为色块 */
  hatBlock: boolean;
  /** 身高(世界单位),来自 sim 的 PLAYER_H,只读 */
  playerH: number;
}

/**
 * 工序:①落影由调用方画在地面投影点 → ②身体三停渐变 + 1.5px 描边 →
 * ③探险帽(帽檐 + 帽身 + 帽带) → ④护目镜(双圆 + 反光点) →
 * ⑤小背包侧挂 → ⑥围巾两段飘带 → ⑦四姿态(脚的画法) → ⑧无敌白描边呼吸。
 */
export function drawPlayerSprite(b: AkBrush, o: PlayerSpriteOpts): void {
  const s = o.scale;
  const r = 17 * s;
  const H = o.playerH * s;
  const f = o.facing >= 0 ? 1 : -1;
  b.save();
  b.globalAlpha = o.inv.alpha;
  b.translate(o.x, o.y);
  if (o.squash > 0) b.scale(1 + o.squash * 0.6, 1 - o.squash);
  if (o.lean !== 0) b.rotate(o.lean);

  // ⑤ 小背包侧挂(先画,身体压住内侧一半,看起来挂在背后)
  const packX = -f * (r * 0.92);
  const packY = -H * 0.52;
  b.fillStyle = shadeHex(AK_PALETTE.akHat, -0.18);
  b.beginPath();
  b.roundRect(packX - 5.5 * s, packY - 7 * s, 11 * s, 14 * s, 3.5 * s);
  b.fill();
  b.strokeStyle = shadeHex(AK_PALETTE.akHat, -0.42);
  b.lineWidth = 1.2 * s;
  b.beginPath();
  b.moveTo(packX - 5 * s, packY);
  b.lineTo(packX + 5 * s, packY);
  b.stroke();

  // ⑦ 四姿态的脚:跑 = 前后分开,跳 = 收起贴身,荡 = 顺着倾角拖后,落地 = 摊平
  const feet: Array<{ dx: number; dy: number; rx: number; ry: number }> =
    o.pose === "jump"
      ? [
          { dx: -4 * s, dy: -5 * s, rx: 4 * s, ry: 3 * s },
          { dx: 4.5 * s, dy: -5.5 * s, rx: 4 * s, ry: 3 * s },
        ]
      : o.pose === "swing"
        ? [
            { dx: -f * 5 * s, dy: -2.5 * s, rx: 4 * s, ry: 3 * s },
            { dx: -f * 9 * s, dy: -1.5 * s, rx: 4 * s, ry: 3 * s },
          ]
        : o.pose === "land"
          ? [
              { dx: -7 * s, dy: -1 * s, rx: 5 * s, ry: 2.6 * s },
              { dx: 7 * s, dy: -1 * s, rx: 5 * s, ry: 2.6 * s },
            ]
          : [
              { dx: -5.5 * s, dy: -1.5 * s, rx: 4.4 * s, ry: 3 * s },
              { dx: 6 * s, dy: -1.5 * s, rx: 4.4 * s, ry: 3 * s },
            ];
  b.fillStyle = shadeHex("#f28fb0", -0.12);
  for (const foot of feet) {
    b.beginPath();
    b.ellipse(foot.dx, foot.dy, foot.rx, foot.ry, 0, 0, Math.PI * 2);
    b.fill();
  }

  // ② 身体:三停渐变(左上亮 → 本色 → 右下暗) + 1.5px 描边,轮廓和判定完全一致
  const g = b.createLinearGradient(-r, -H, r, 0);
  g.addColorStop(0, shadeHex("#ffb3c8", 0.28));
  g.addColorStop(0.55, "#ffb3c8");
  g.addColorStop(1, shadeHex("#ffb3c8", -0.14));
  b.fillStyle = g;
  b.beginPath();
  b.roundRect(-r, -H, r * 2, H, 12 * s);
  b.fill();
  b.strokeStyle = "rgba(122,74,90,.5)";
  b.lineWidth = 1.5;
  b.beginPath();
  b.roundRect(-r, -H, r * 2, H, 12 * s);
  b.stroke();

  // 小马尾(朵朵的标志,从帽子下面探出来)
  b.fillStyle = "#f28fb0";
  b.beginPath();
  b.arc(-f * r, -H * 0.68, 7 * s, 0, Math.PI * 2);
  b.fill();

  // ⑥ 围巾:脖圈 + 两段飘带(第二段短一点、浅一点,带一丝相位差)
  const neckY = -H * 0.5;
  b.fillStyle = AK_PALETTE.akScarf;
  b.beginPath();
  b.roundRect(-r * 0.72, neckY - 3 * s, r * 1.44, 5 * s, 2.5 * s);
  b.fill();
  const flutter = o.flutterMs > 0 ? Math.sin(o.flutterMs / 160) * 0.09 : 0;
  const drawRibbon = (len: number, ang: number, width: number, color: string): void => {
    const x0 = -f * r * 0.55;
    const y0 = neckY;
    const x1 = x0 - f * Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len * 0.55 + len * 0.2;
    b.strokeStyle = color;
    b.lineWidth = width;
    b.lineCap = "round";
    b.beginPath();
    b.moveTo(x0, y0);
    b.quadraticCurveTo(x0 - f * len * 0.45, y0 + Math.sin(ang) * len * 0.1, x1, y1);
    b.stroke();
  };
  drawRibbon(13 * s, o.scarf + flutter, 4 * s, AK_PALETTE.akScarf);
  drawRibbon(9 * s, o.scarf * 0.75 - flutter, 3 * s, shadeHex(AK_PALETTE.akScarf, 0.25));

  // ③ 探险帽:帽檐椭圆 + 帽身圆台 + 帽带色环;太小(<5px)退化为色块
  const brimY = -H * 0.94;
  if (o.hatBlock) {
    b.fillStyle = AK_PALETTE.akHat;
    b.fillRect(-r * 0.7, brimY - 6 * s, r * 1.4, 6 * s);
  } else {
    b.fillStyle = shadeHex(AK_PALETTE.akHat, -0.12);
    b.beginPath();
    b.ellipse(0, brimY, 13.5 * s, 3.4 * s, 0, 0, Math.PI * 2);
    b.fill();
    b.fillStyle = AK_PALETTE.akHat;
    b.beginPath();
    b.roundRect(-8.5 * s, brimY - 8 * s, 17 * s, 8.5 * s, 3.5 * s);
    b.fill();
    b.fillStyle = AK_PALETTE.akScarf;
    b.fillRect(-8.5 * s, brimY - 3.6 * s, 17 * s, 2.4 * s);
    // 帽身左上高光,和全场光源一致
    b.fillStyle = "rgba(255,255,255,.4)";
    b.beginPath();
    b.ellipse(-4 * s, brimY - 6 * s, 3 * s, 1.6 * s, -0.6, 0, Math.PI * 2);
    b.fill();
  }

  // ④ 护目镜:额头双圆 + 各一枚左上反光点
  if (!o.hatBlock) {
    const gy = -H * 0.84;
    b.strokeStyle = "rgba(90,74,60,.65)";
    b.lineWidth = 1.2 * s;
    b.beginPath();
    b.moveTo(-r * 0.8, gy);
    b.lineTo(r * 0.8, gy);
    b.stroke();
    for (const gx of [-5 * s, 5 * s]) {
      b.fillStyle = "#cfe6f2";
      b.beginPath();
      b.arc(gx, gy, 3.4 * s, 0, Math.PI * 2);
      b.fill();
      b.strokeStyle = "rgba(90,74,60,.7)";
      b.lineWidth = 1.1 * s;
      b.beginPath();
      b.arc(gx, gy, 3.4 * s, 0, Math.PI * 2);
      b.stroke();
      b.fillStyle = "rgba(255,255,255,.95)";
      b.beginPath();
      b.arc(gx - 1.1 * s, gy - 1.1 * s, 0.9 * s, 0, Math.PI * 2);
      b.fill();
    }
  }

  // 脸:眼睛与微笑(位置沿用 1.2,老玩家一眼还认得)
  b.fillStyle = "#3a3a4a";
  b.beginPath();
  b.arc(-5 * s + f * 2 * s, -H * 0.72, 3 * s, 0, Math.PI * 2);
  b.arc(6 * s + f * 2 * s, -H * 0.72, 3 * s, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = "#3a3a4a";
  b.lineWidth = 2 * s;
  b.beginPath();
  b.arc(f * 1 * s, -H * 0.58, 5 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  b.stroke();

  // ⑧ 无敌:白描边呼吸(时序读 invincible 计数),半透明由 globalAlpha 兜底
  if (o.inv.ring > 0) {
    b.strokeStyle = `rgba(255,255,255,${(0.25 + 0.6 * o.inv.ring).toFixed(3)})`;
    b.lineWidth = 2.5 * s;
    b.beginPath();
    b.roundRect(-r - 2 * s, -H - 2 * s, r * 2 + 4 * s, H + 4 * s, 13 * s);
    b.stroke();
  }
  b.restore();
}

// ---------------------------------------------------------------------------
// 锚点:木桩 + 铁环(高光点),可钩状态加微光呼吸
// ---------------------------------------------------------------------------

export function drawAnchorSprite(b: AkBrush, x: number, y: number, scale: number, glow: number | null): void {
  b.save();
  // 悬索:从洞顶垂下来的木杆,双色(棕底 + 亮芯)
  b.lineCap = "round";
  b.strokeStyle = shadeHex(AK_PALETTE.akRope, -0.15);
  b.lineWidth = 4 * scale;
  b.beginPath();
  b.moveTo(x, 0);
  b.lineTo(x, y - 10 * scale);
  b.stroke();
  b.strokeStyle = shadeHex(AK_PALETTE.akRope, 0.35);
  b.lineWidth = 1.2 * scale;
  b.beginPath();
  b.moveTo(x - 1 * scale, 0);
  b.lineTo(x - 1 * scale, y - 10 * scale);
  b.stroke();
  // 木桩头
  b.fillStyle = AK_PALETTE.akRope;
  b.beginPath();
  b.roundRect(x - 5 * scale, y - 14 * scale, 10 * scale, 8 * scale, 3 * scale);
  b.fill();
  // 可钩微光:铁环外一圈呼吸光晕(reduced 时 glow 恒 1,变成恒定亮描边)
  if (glow !== null) {
    b.strokeStyle = AK_PALETTE.akGold;
    b.globalAlpha = 0.2 + 0.5 * glow;
    b.lineWidth = 7 * scale;
    b.beginPath();
    b.arc(x, y, 16 * scale, 0, Math.PI * 2);
    b.stroke();
    b.globalAlpha = 1;
  }
  // 铁环 + 左上高光点
  b.strokeStyle = "#7c8794";
  b.lineWidth = 5 * scale;
  b.beginPath();
  b.arc(x, y, 12 * scale, 0, Math.PI * 2);
  b.stroke();
  b.strokeStyle = "rgba(255,255,255,.85)";
  b.lineWidth = 2 * scale;
  b.beginPath();
  b.arc(x, y, 12 * scale, Math.PI * 1.05, Math.PI * 1.45);
  b.stroke();
  b.restore();
}

// ---------------------------------------------------------------------------
// 文物:原创纹石(日菱 / 月六边 / 星圆珠)+ 金描边 + 底座光柱 + 缓慢自转闪点
// (W6R1-02 修复:emoji fillText 退休,宝石改 ≥3 停渐变 + 左上高光 + 墨描边)
// ---------------------------------------------------------------------------

/** 三种纹石主色:日暖橙 / 月青蓝 / 星紫(与粉彩色板同族) */
export const ARTIFACT_GEM_COLORS = ["#F0A24B", "#6FA8E8", "#B08AE0"] as const;
/** 纹石描边墨色 */
export const ARTIFACT_GEM_INK = "#6E5433";

/** 旧调用 / 旧用例还传 emoji 字符串,这里做兼容映射(0 日 / 1 月 / 2 星) */
const ARTIFACT_KIND_BY_GLYPH: Record<string, number> = { "🔶": 0, "🔷": 1, "🔮": 2 };

export function artifactKindOf(kindOrGlyph: number | string): number {
  if (typeof kindOrGlyph === "number") return clampNum(Math.round(kindOrGlyph), 0, 2);
  return ARTIFACT_KIND_BY_GLYPH[kindOrGlyph] ?? 0;
}

/** 纹石轮廓:日 = 菱形、月 = 六边、星 = 圆珠(剪影三选一,两两可分) */
function gemOutline(b: AkBrush, x: number, y: number, r: number, kind: number): void {
  b.beginPath();
  if (kind === 0) {
    b.moveTo(x, y - r);
    b.lineTo(x + r * 0.78, y);
    b.lineTo(x, y + r);
    b.lineTo(x - r * 0.78, y);
    b.closePath();
  } else if (kind === 1) {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = x + Math.cos(a) * r * 0.92;
      const py = y + Math.sin(a) * r * 0.92;
      if (i === 0) b.moveTo(px, py);
      else b.lineTo(px, py);
    }
    b.closePath();
  } else {
    b.arc(x, y, r * 0.92, 0, Math.PI * 2);
  }
}

/**
 * 纹石本体:三停线性渐变(左上亮 → 主色 → 右下暗)+ 墨色描边 +
 * 左上白高光弧 + 各自的刻纹(日点芒 / 月牙 / 五角星)。
 * 门上的收集清单与场上的文物共用这一支笔。
 */
export function drawArtifactGem(b: AkBrush, x: number, y: number, r: number, kindOrGlyph: number | string): void {
  const kind = artifactKindOf(kindOrGlyph);
  const base = ARTIFACT_GEM_COLORS[kind];
  b.save();
  const g = b.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, shadeHex(base, 0.4));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shadeHex(base, -0.22));
  b.fillStyle = g;
  gemOutline(b, x, y, r, kind);
  b.fill();
  b.strokeStyle = ARTIFACT_GEM_INK;
  b.lineWidth = Math.max(1.5, 1.6 * (r / 13));
  gemOutline(b, x, y, r, kind);
  b.stroke();
  // 左上高光弧(全场光源约定:左上 45°)
  b.strokeStyle = "rgba(255,255,255,.85)";
  b.lineWidth = Math.max(1.2, r * 0.14);
  b.lineCap = "round";
  b.beginPath();
  b.arc(x, y, r * 0.62, Math.PI * 1.05, Math.PI * 1.45);
  b.stroke();
  // 刻纹:日 = 中点 + 四向短芒;月 = 月牙;星 = 五角星
  b.fillStyle = "rgba(255,255,255,.92)";
  b.strokeStyle = "rgba(255,255,255,.92)";
  if (kind === 0) {
    b.beginPath();
    b.arc(x, y, r * 0.2, 0, Math.PI * 2);
    b.fill();
    b.lineWidth = Math.max(1, r * 0.1);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      b.beginPath();
      b.moveTo(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32);
      b.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
      b.stroke();
    }
  } else if (kind === 1) {
    b.beginPath();
    b.arc(x + r * 0.06, y, r * 0.42, Math.PI * 0.5, Math.PI * 1.5);
    b.arc(x - r * 0.16, y, r * 0.34, Math.PI * 1.5, Math.PI * 0.5);
    b.closePath();
    b.fill();
  } else {
    b.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r * 0.42 : r * 0.18;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) b.moveTo(px, py);
      else b.lineTo(px, py);
    }
    b.closePath();
    b.fill();
  }
  b.restore();
}

export function drawArtifactSprite(
  b: AkBrush,
  x: number,
  y: number,
  scale: number,
  kindOrGlyph: number | string,
  spinPhase: number,
  pillarBottomY: number | null
): void {
  b.save();
  // 底座光柱:从台面升起、越往上越淡
  if (pillarBottomY !== null && pillarBottomY > y) {
    const g = b.createLinearGradient(0, pillarBottomY, 0, y - 24 * scale);
    g.addColorStop(0, "rgba(240,194,90,.32)");
    g.addColorStop(1, "rgba(240,194,90,0)");
    b.fillStyle = g;
    b.beginPath();
    b.roundRect(x - 13 * scale, y - 24 * scale, 26 * scale, pillarBottomY - y + 24 * scale, 8 * scale);
    b.fill();
  }
  // 柔光底:三停径向渐变(亮心偏左上,同一光源)+ 金描边
  const halo = b.createRadialGradient(x - 7 * scale, y - 7 * scale, 2 * scale, x, y, 20 * scale);
  halo.addColorStop(0, "rgba(255,250,225,.92)");
  halo.addColorStop(0.55, "rgba(255,240,180,.75)");
  halo.addColorStop(1, "rgba(240,205,120,.58)");
  b.fillStyle = halo;
  b.beginPath();
  b.arc(x, y, 20 * scale, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = AK_PALETTE.akGold;
  b.lineWidth = 2 * scale;
  b.beginPath();
  b.arc(x, y, 20 * scale, 0, Math.PI * 2);
  b.stroke();
  // 缓慢自转闪点(2400ms 一圈;reduced 停在左上 45°)
  const ang = spinPhase * Math.PI * 2 - Math.PI * 0.75;
  const sx = x + Math.cos(ang) * 20 * scale;
  const sy = y + Math.sin(ang) * 20 * scale;
  b.fillStyle = "#fff";
  b.beginPath();
  b.arc(sx, sy, 2.2 * scale, 0, Math.PI * 2);
  b.fill();
  // 纹石本体(emoji 退休)
  drawArtifactGem(b, x, y, 13 * scale, kindOrGlyph);
  b.restore();
}

// ---------------------------------------------------------------------------
// 敌人:圆滚滚原创剪影 + 特征件(地面守卫独角 + 尾巴,飞行守卫大耳 + 小翅)
// ---------------------------------------------------------------------------

export function drawEnemySprite(
  b: AkBrush,
  x: number,
  y: number,
  scale: number,
  kind: "ground" | "flyer",
  dir: number,
  wingMs: number
): void {
  const s = scale;
  const f = dir >= 0 ? 1 : -1;
  const base = kind === "flyer" ? "#b9a6ea" : "#a08464";
  const cy = y - 20 * s;
  b.save();
  // 落影
  b.fillStyle = AK_PALETTE.akShadow;
  b.beginPath();
  b.ellipse(x, y + 2 * s, 15 * s, 4 * s, 0, 0, Math.PI * 2);
  b.fill();
  if (kind === "flyer") {
    // 大耳一对(压在身体后面)
    b.fillStyle = shadeHex(base, -0.12);
    for (const ex of [-11 * s, 11 * s]) {
      b.beginPath();
      b.ellipse(x + ex, cy - 14 * s, 5.5 * s, 9 * s, ex > 0 ? 0.35 : -0.35, 0, Math.PI * 2);
      b.fill();
    }
    // 小翅膀(wingMs 为 0 时静止,reduced 用)
    const flap = wingMs > 0 ? Math.sin(wingMs / 110) * 0.5 : 0;
    b.fillStyle = "rgba(255,255,255,.7)";
    for (const wf of [-1, 1]) {
      b.beginPath();
      b.ellipse(x + wf * 16 * s, cy + 2 * s, 7 * s, 3.5 * s, wf * (0.5 + flap), 0, Math.PI * 2);
      b.fill();
    }
  } else {
    // 尾巴一撮(朝行进反方向卷)
    b.strokeStyle = shadeHex(base, -0.22);
    b.lineWidth = 3 * s;
    b.lineCap = "round";
    b.beginPath();
    b.moveTo(x - f * 16 * s, cy + 6 * s);
    b.quadraticCurveTo(x - f * 24 * s, cy + 2 * s, x - f * 21 * s, cy - 5 * s);
    b.stroke();
  }
  // 圆滚滚身体:三停渐变 + 描边
  const g = b.createLinearGradient(x - 19 * s, cy - 19 * s, x + 19 * s, cy + 19 * s);
  g.addColorStop(0, shadeHex(base, 0.24));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shadeHex(base, -0.16));
  b.fillStyle = g;
  b.beginPath();
  b.ellipse(x, cy, 19 * s, 19 * s, 0, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = "rgba(74,60,50,.4)";
  b.lineWidth = 1.5;
  b.beginPath();
  b.ellipse(x, cy, 19 * s, 19 * s, 0, 0, Math.PI * 2);
  b.stroke();
  if (kind === "ground") {
    // 独角(圆头小角,不带尖刺感)
    b.fillStyle = shadeHex(base, -0.28);
    b.beginPath();
    b.moveTo(x - 3 * s, cy - 18 * s);
    b.quadraticCurveTo(x, cy - 27 * s, x + 3.5 * s, cy - 18 * s);
    b.closePath();
    b.fill();
    b.fillStyle = "#fff";
    b.beginPath();
    b.arc(x + 0.5 * s, cy - 23 * s, 1.2 * s, 0, Math.PI * 2);
    b.fill();
  }
  // 肚皮浅色
  b.fillStyle = "rgba(255,255,255,.35)";
  b.beginPath();
  b.ellipse(x, cy + 8 * s, 10 * s, 6.5 * s, 0, 0, Math.PI * 2);
  b.fill();
  // 眼睛 + 微笑(和 1.2 一样的友好脸)
  b.fillStyle = "#3a3a4a";
  b.beginPath();
  b.arc(x - 6 * s, cy - 4 * s, 3 * s, 0, Math.PI * 2);
  b.arc(x + 6 * s, cy - 4 * s, 3 * s, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = "#3a3a4a";
  b.lineWidth = 2 * s;
  b.beginPath();
  b.arc(x, cy + 5 * s, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  b.stroke();
  b.restore();
}

/** 守卫被敲晕:晕圈 + 三颗小星绕头,随 t01(0..1)淡出;reduced 时星星不绕圈 */
export function drawStunFx(b: AkBrush, x: number, y: number, scale: number, t01: number, reduced: boolean): void {
  const fade = clampNum(1 - t01, 0, 1);
  b.save();
  b.globalAlpha = fade;
  // 晕圈
  b.strokeStyle = "rgba(255,255,255,.9)";
  b.lineWidth = 2 * scale;
  b.beginPath();
  b.ellipse(x, y - 26 * scale, 13 * scale, 5 * scale, 0, 0, Math.PI * 2);
  b.stroke();
  // 三颗小星绕头
  const spin = reduced ? 0 : t01 * Math.PI * 3;
  b.fillStyle = AK_PALETTE.akGold;
  for (let i = 0; i < 3; i++) {
    const ang = spin + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(ang) * 14 * scale;
    const sy = y - 26 * scale + Math.sin(ang) * 5 * scale;
    drawTinyStar(b, sx, sy, 3 * scale);
  }
  b.restore();
}

function drawTinyStar(b: AkBrush, x: number, y: number, r: number): void {
  b.beginPath();
  b.moveTo(x, y - r);
  b.quadraticCurveTo(x, y, x + r, y);
  b.quadraticCurveTo(x, y, x, y + r);
  b.quadraticCurveTo(x, y, x - r, y);
  b.quadraticCurveTo(x, y, x, y - r);
  b.closePath();
  b.fill();
}

// ---------------------------------------------------------------------------
// 回旋镖:双叶木镖 + 旋转模糊两帧 + 弧线残影渐隐
// ---------------------------------------------------------------------------

export function drawBoomerangSprite(b: AkBrush, x: number, y: number, scale: number, rot: number, blur: boolean): void {
  const blade = (alpha: number, extraRot: number): void => {
    b.save();
    b.globalAlpha = alpha;
    b.translate(x, y);
    b.rotate(rot + extraRot);
    b.lineCap = "round";
    for (const flip of [0, Math.PI / 2]) {
      b.save();
      b.rotate(flip);
      // 叶片:木色圆头长条 + 浅色芯
      b.strokeStyle = AK_PALETTE.akRope;
      b.lineWidth = 5 * scale;
      b.beginPath();
      b.moveTo(0, 0);
      b.quadraticCurveTo(5 * scale, -6 * scale, 11 * scale, -7 * scale);
      b.stroke();
      b.strokeStyle = shadeHex(AK_PALETTE.akRope, 0.4);
      b.lineWidth = 1.6 * scale;
      b.beginPath();
      b.moveTo(1 * scale, -1 * scale);
      b.quadraticCurveTo(5 * scale, -5.5 * scale, 10 * scale, -6.5 * scale);
      b.stroke();
      b.restore();
    }
    // 中心结
    b.fillStyle = shadeHex(AK_PALETTE.akRope, -0.25);
    b.beginPath();
    b.arc(0, 0, 2.2 * scale, 0, Math.PI * 2);
    b.fill();
    b.restore();
  };
  if (blur) blade(0.28, -0.45);
  blade(1, 0);
}

/** 弧线残影:把最近的轨迹点分成 N 段,由新到旧渐隐(reduced 时 N=1) */
export function drawTrail(b: AkBrush, pts: ReadonlyArray<TrailPoint>, segments: number, scale: number): void {
  if (pts.length < 2 || segments <= 0) return;
  const per = Math.max(2, Math.floor(pts.length / segments));
  b.save();
  b.lineCap = "round";
  for (let seg = 0; seg < segments; seg++) {
    const end = pts.length - seg * per;
    const start = Math.max(0, end - per - 1);
    if (end - start < 2) break;
    b.strokeStyle = AK_PALETTE.akGold;
    b.globalAlpha = 0.3 * (1 - seg / segments);
    b.lineWidth = (3 - seg * 0.7) * scale;
    b.beginPath();
    b.moveTo(pts[start].x, pts[start].y);
    for (let i = start + 1; i < end; i++) b.lineTo(pts[i].x, pts[i].y);
    b.stroke();
  }
  b.restore();
}

// ---------------------------------------------------------------------------
// HUD:统一卡片 + 关卡进度小旗路径图
// ---------------------------------------------------------------------------

/** 统一卡片:圆角 12、白 72% 底、1.5px 描边(和 .advk-hud span 一模一样的规格) */
export function drawHudCard(b: AkBrush, x: number, y: number, w: number, h: number): void {
  b.save();
  b.fillStyle = AK_CARD.bg;
  b.beginPath();
  b.roundRect(x, y, w, h, AK_CARD.radius);
  b.fill();
  b.strokeStyle = AK_CARD.stroke;
  b.lineWidth = AK_CARD.strokeW;
  b.beginPath();
  b.roundRect(x, y, w, h, AK_CARD.radius);
  b.stroke();
  b.restore();
}

/** 关卡进度:一条小路 + 途中圆点 + 终点小旗,t01 是走到了几成(只读位置,不写状态) */
export function drawFlagProgress(b: AkBrush, x: number, y: number, w: number, t01: number): void {
  const t = clampNum(t01, 0, 1);
  b.save();
  b.lineCap = "round";
  // 路基
  b.strokeStyle = "rgba(122,82,48,.25)";
  b.lineWidth = 3;
  b.beginPath();
  b.moveTo(x, y);
  b.lineTo(x + w, y);
  b.stroke();
  // 已走过的一段
  b.strokeStyle = AK_PALETTE.akGrass;
  b.lineWidth = 3;
  b.beginPath();
  b.moveTo(x, y);
  b.lineTo(x + w * t, y);
  b.stroke();
  // 途中三个小节点
  b.fillStyle = "rgba(122,82,48,.35)";
  for (const k of [0.25, 0.5, 0.75]) {
    b.beginPath();
    b.arc(x + w * k, y, 1.6, 0, Math.PI * 2);
    b.fill();
  }
  // 终点小旗:旗杆 + 三角旗
  b.strokeStyle = "#7a5230";
  b.lineWidth = 1.5;
  b.beginPath();
  b.moveTo(x + w, y + 2);
  b.lineTo(x + w, y - 8);
  b.stroke();
  b.fillStyle = AK_PALETTE.akScarf;
  b.beginPath();
  b.moveTo(x + w, y - 8);
  b.lineTo(x + w + 7, y - 5.5);
  b.lineTo(x + w, y - 3);
  b.closePath();
  b.fill();
  // 当前位置的小圆点
  b.fillStyle = "#fff";
  b.beginPath();
  b.arc(x + w * t, y, 4, 0, Math.PI * 2);
  b.fill();
  b.strokeStyle = AK_PALETTE.akScarf;
  b.lineWidth = 2;
  b.beginPath();
  b.arc(x + w * t, y, 4, 0, Math.PI * 2);
  b.stroke();
  b.restore();
}

// ---------------------------------------------------------------------------
// 无尽古堡(DOM 格子)角色皮:主角朵朵与木箱换参数化 SVG(W6R1-01 修复)。
// 机关小图标(门/钥匙/锁/开关/传送/贴纸等)按 A 档口径保留表意符号并登记。
// ---------------------------------------------------------------------------

/** 古堡格子 SVG 的墨色与落影(与 badge 套件同规格:1.5px 描边 + 底部小影) */
const CASTLE_INK = "#4B3A6E";
const CASTLE_SHADOW = "rgba(0,0,0,.12)";

/**
 * 古堡主角朵朵:五瓣小花(花瓣描边 + 金花心笑脸 + 茎叶),
 * 与 brave-path 的花徽同族但独立成株,一眼读作「会走路的小花」。
 */
export function castleHeroSvg(): string {
  let petals = "";
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = (32 + 11 * Math.cos(a)).toFixed(1);
    const py = (25 + 11 * Math.sin(a)).toFixed(1);
    petals += `<circle cx="${px}" cy="${py}" r="7.2" fill="#FFB2D8" stroke="${CASTLE_INK}" stroke-width="1.5"/>`;
  }
  return (
    `<svg class="advk-hero" viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    `<ellipse cx="32" cy="57" rx="12" ry="3" fill="${CASTLE_SHADOW}"/>` +
    `<path d="M32 38v15" stroke="#7CBB5E" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M32 46q-7 -1.5 -8.5 -7 7 -.5 8.5 7zM32 50q7 -1.5 8.5 -7 -7 -.5 -8.5 7z" fill="#8BC96D" stroke="#5F9C46" stroke-width="1"/>` +
    petals +
    `<circle cx="32" cy="25" r="8.6" fill="#F0C25A" stroke="${CASTLE_INK}" stroke-width="1.5"/>` +
    `<path d="M26.6 20.4a7 7 0 0 1 4.4-2.6" stroke="rgba(255,255,255,.85)" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="29" cy="24" r="1.6" fill="${CASTLE_INK}"/><circle cx="35" cy="24" r="1.6" fill="${CASTLE_INK}"/>` +
    `<path d="M28.8 28q3.2 2.4 6.4 0" stroke="${CASTLE_INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/**
 * 古堡木箱:2.5D 双面(顶面受光 + 正面木纹 X 加固条)+ 墨描边,
 * 顶亮底暗与全场左上光源一致。
 */
export function castleBoxSvg(): string {
  const wood = AK_PALETTE.akHat;
  const light = shadeHex(wood, 0.28);
  const dark = shadeHex(wood, -0.2);
  return (
    `<svg class="advk-box" viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    `<ellipse cx="32" cy="57" rx="15" ry="3" fill="${CASTLE_SHADOW}"/>` +
    `<path d="M15 22l6-9h22l6 9z" fill="${light}" stroke="${CASTLE_INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="15" y="22" width="34" height="32" rx="2.5" fill="${wood}" stroke="${CASTLE_INK}" stroke-width="1.5"/>` +
    `<path d="M44 22h5v32h-5z" fill="${dark}" opacity=".55"/>` +
    `<path d="M15 26.5h34M15 49.5h34" stroke="${dark}" stroke-width="1.6"/>` +
    `<path d="M17.5 28.5l29 19m0-19l-29 19" stroke="${dark}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M17 24.5a30 30 0 0 1 10-1.5" stroke="rgba(255,255,255,.75)" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `</svg>`
  );
}
