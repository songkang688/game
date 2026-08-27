/**
 * 朵朵大战星星 · 1.3 视觉资产（纯绘制，零玩法数值）。
 *
 * 这里只有 Canvas 2D 的画法：12 位角色的专属脸谱、14 种道具的极简图标、
 * 五角星 / 星屑粒子、平台机制的差异化画法、10 张场地的主题装饰层。
 * 所有函数只收「画笔 + 坐标 + 尺寸」，不 import battle / stages 的任何数值，
 * 判定数据一个都碰不到。
 *
 * 弱动效口径：所有会动的参数都先过 {@link animT}（soft 时恒为 0），
 * 传 0 进来的每一处动画都必须退化成一帧好看的静态画面。
 */

/* ------------------------------------------------------------------ */
/* 动画口径（soft 一律给 0）                                            */
/* ------------------------------------------------------------------ */

/** 动画时间口径：弱动效时恒为 0，所有动画参数都要用它算 */
export function animT(t: number, soft: boolean): number {
  return soft ? 0 : Math.max(0, Number.isFinite(t) ? t : 0);
}

/** 身体随水平速度的倾斜角（弧度，≤8°；soft 时恒为 0） */
export function tiltAngle(vx: number, soft: boolean, topSpeed = 240): number {
  if (soft) return 0;
  const k = Math.max(-1, Math.min(1, (Number.isFinite(vx) ? vx : 0) / topSpeed));
  return k * ((8 * Math.PI) / 180);
}

/* ------------------------------------------------------------------ */
/* 颜色小工具                                                          */
/* ------------------------------------------------------------------ */

/** #rrggbb 变亮（amt>0）或变暗（amt<0），amt 取 -1..1 */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number): number => {
    const out = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** 圆角矩形路径（不依赖 ctx.roundRect，老浏览器也认） */
export function rrectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* 星星与粒子                                                          */
/* ------------------------------------------------------------------ */

/** 五角星路径（rot 弧度；纯路径，替代 "⭐" 字符） */
export function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot = 0
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.46;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 金渐变五角星（出界演出 / 眩晕公转星共用） */
export function drawGoldStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot = 0
): void {
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, "#fff2b8");
  g.addColorStop(1, "#ffb937");
  starPath(ctx, x, y, r, rot);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(200,130,30,.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // 独立高光点(r2 修复 W4R1-07):与 candy-swing / duo-arena / garden-guard 的金星第三层对齐
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.3, r * 0.18, r * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** 4 芒小闪光（冲击星 / 冰晶闪点共用） */
export function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = "#ffffff"
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.14, y - r * 0.14, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.14, y + r * 0.14, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.14, y + r * 0.14, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.14, y - r * 0.14, x, y - r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** 蓬蓬云（3 圆并排 + 底部拉平），等待重生与场地装饰共用 */
export function drawFluffyCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color = "rgba(255,255,255,.92)"
): void {
  const r = w / 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - r * 1.2, y, r * 0.85, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.45, r, 0, Math.PI * 2);
  ctx.arc(x + r * 1.2, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  rrectPath(ctx, x - r * 1.9, y - r * 0.1, r * 3.8, r * 0.95, r * 0.45);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* 角色脸谱系统                                                        */
/* ------------------------------------------------------------------ */

/** 表情：普通 / 攻击瞪眼 / 被击 ×眼 / 眩晕螺旋眼 / 开心（胜利、等待重生） */
export type FaceMood = "idle" | "attack" | "hurt" | "dizzy" | "happy";

/** 有专属脸谱的角色 id（与 roster.ts 全员一一对应） */
export const FACE_IDS = [
  "duoduo",
  "xingxing",
  "nuonuo",
  "yunyun",
  "dundun",
  "shanshan",
  "lvlvdou",
  "jiujiu",
  "paopao",
  "tuantuan",
  "maimai",
  "dengdeng",
] as const;

/** 眨眼节奏：每 3.4 秒闭一次眼，闭 0.14 秒（t=0 时睁着，soft 天然不眨） */
function blinking(t: number): boolean {
  return t > 0 && t % 3.4 > 3.26;
}

/** 眼睛：白球 + 黑瞳 + 高光三层；mood 换眼型 */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mood: FaceMood,
  t: number
): void {
  const ey = y - r * 0.12;
  const dx = r * 0.38;
  const re = r * 0.23;
  for (const side of [-1, 1]) {
    const ex = x + side * dx;
    if (mood === "hurt") {
      // ×眼：分级口径是挨打不许做难受的脸，× 眼 + 头顶星星就够了
      ctx.strokeStyle = "#5c4a7d";
      ctx.lineWidth = Math.max(1.4, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(ex - re * 0.8, ey - re * 0.8);
      ctx.lineTo(ex + re * 0.8, ey + re * 0.8);
      ctx.moveTo(ex + re * 0.8, ey - re * 0.8);
      ctx.lineTo(ex - re * 0.8, ey + re * 0.8);
      ctx.stroke();
      continue;
    }
    if (mood === "dizzy") {
      // 螺旋眼：两段半径递减的圆弧
      ctx.strokeStyle = "#5c4a7d";
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.arc(ex, ey, re * 0.85, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, re * 0.42, Math.PI, Math.PI * 2.4);
      ctx.stroke();
      continue;
    }
    if (mood === "happy" || blinking(t)) {
      // 开心 / 眨眼：一道 ∩ 弧
      ctx.strokeStyle = "#5c4a7d";
      ctx.lineWidth = Math.max(1.4, r * 0.1);
      ctx.beginPath();
      ctx.arc(ex, ey + re * 0.3, re * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    // 普通 / 攻击：白球 + 黑瞳 + 高光
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, re, 0, Math.PI * 2);
    ctx.fill();
    const pr = mood === "attack" ? re * 0.62 : re * 0.5;
    ctx.fillStyle = "#453a5e";
    ctx.beginPath();
    ctx.arc(ex, ey + re * 0.08, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex - pr * 0.35, ey - pr * 0.3, Math.max(0.8, pr * 0.32), 0, Math.PI * 2);
    ctx.fill();
    if (mood === "attack") {
      // 瞪眼的小眉毛（下压斜线，皱眉不狰狞）
      ctx.strokeStyle = "#5c4a7d";
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(ex - side * re, ey - re * 1.5);
      ctx.lineTo(ex + side * re * 0.7, ey - re * 1.05);
      ctx.stroke();
    }
  }
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mood: FaceMood
): void {
  const my = y + r * 0.34;
  ctx.strokeStyle = "#5c4a7d";
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  if (mood === "attack") {
    ctx.fillStyle = "#5c4a7d";
    ctx.beginPath();
    ctx.arc(x, my, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mood === "hurt" || mood === "dizzy") {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.18, my + r * 0.06);
    ctx.quadraticCurveTo(x, my - r * 0.08, x + r * 0.18, my + r * 0.06);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, my - r * 0.05, mood === "happy" ? r * 0.26 : r * 0.17, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function drawBlush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
): void {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.58, y + r * 0.18, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 角色专属特征（头饰 / 耳朵 / 呆毛……）。
 * 每位 ≤12 条绘制指令，r≈16px 时也要看得清 —— 特征全放头顶剪影上。
 */
function drawCharTrait(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, r: number): void {
  switch (id) {
    case "duoduo": {
      // 花瓣发饰：左上 5 瓣小花 + 黄芯。
      // r2 修复 W4R1-04:花饰放大一档并抬出轮廓,16px 灰度下头饰通道站稳
      const cx = x - r * 0.56;
      const cy = y - r * 0.88;
      ctx.fillStyle = "#ff8fbe";
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffd75e";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "xingxing":
      // 星形呆毛(r2 修复 W4R1-04:0.34→0.5,16px 下 2.2px→3.4px 边界站稳)
      drawGoldStar(ctx, x, y - r * 1.18, r * 0.5, 0.35);
      return;
    case "nuonuo":
      // 头顶两颗糯米团子
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - r * 0.42, y - r * 0.88, r * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc9de";
      ctx.beginPath();
      ctx.arc(x + r * 0.42, y - r * 0.88, r * 0.27, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "yunyun":
      // 蓬蓬云发：三个白泡泡
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.beginPath();
      ctx.arc(x - r * 0.5, y - r * 0.72, r * 0.3, 0, Math.PI * 2);
      ctx.arc(x, y - r * 0.92, r * 0.36, 0, Math.PI * 2);
      ctx.arc(x + r * 0.5, y - r * 0.72, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "dundun":
      // 小熊耳 + 小鼻头
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#c8945e";
        ctx.beginPath();
        ctx.arc(x + side * r * 0.62, y - r * 0.7, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f4d4ae";
        ctx.beginPath();
        ctx.arc(x + side * r * 0.62, y - r * 0.7, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#8a5a34";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.16, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "shanshan":
      // 头顶大闪 + 颊边小闪
      drawSparkle(ctx, x + r * 0.5, y - r * 0.92, r * 0.34, "#fff6c9");
      drawSparkle(ctx, x - r * 0.72, y - r * 0.45, r * 0.18, "#ffffff");
      return;
    case "lvlvdou": {
      // 头顶豆芽：茎 + 两片叶
      ctx.strokeStyle = "#5f9e58";
      ctx.lineWidth = Math.max(1.4, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.95);
      ctx.quadraticCurveTo(x + r * 0.08, y - r * 1.2, x, y - r * 1.35);
      ctx.stroke();
      ctx.fillStyle = "#7fc06f";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * r * 0.24, y - r * 1.32, r * 0.24, r * 0.13, side * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "jiujiu":
      // 尖嘴 + 头顶呆毛
      ctx.fillStyle = "#ff9d47";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.16, y + r * 0.12);
      ctx.lineTo(x + r * 0.34, y + r * 0.24);
      ctx.lineTo(x - r * 0.16, y + r * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e8b93e";
      ctx.lineWidth = Math.max(1.4, r * 0.1);
      ctx.beginPath();
      ctx.arc(x, y - r * 1.02, r * 0.22, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      return;
    case "paopao":
      // 头顶小泡 + 身上一道泡光
      ctx.strokeStyle = "rgba(140,200,255,.95)";
      ctx.lineWidth = Math.max(1.2, r * 0.09);
      ctx.beginPath();
      ctx.arc(x + r * 0.52, y - r * 1.05, r * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, Math.PI * 1.15, Math.PI * 1.6);
      ctx.stroke();
      return;
    case "tuantuan":
      // 饭团海苔片 + 米光
      ctx.fillStyle = "#3f4a3f";
      rrectPath(ctx, x - r * 0.42, y + r * 0.3, r * 0.84, r * 0.42, r * 0.12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = Math.max(1.2, r * 0.09);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, Math.PI * 1.2, Math.PI * 1.55);
      ctx.stroke();
      return;
    case "maimai": {
      // 头顶麦穗：茎 + 三对麦粒
      ctx.strokeStyle = "#c99b3f";
      ctx.lineWidth = Math.max(1.3, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.2, y - r * 0.9);
      ctx.lineTo(x + r * 0.38, y - r * 1.4);
      ctx.stroke();
      ctx.fillStyle = "#e8c064";
      for (let i = 0; i < 3; i++) {
        const gy = y - r * (1.0 + i * 0.16);
        const gx = x + r * (0.24 + i * 0.06);
        ctx.beginPath();
        ctx.ellipse(gx - r * 0.12, gy, r * 0.12, r * 0.07, -0.5, 0, Math.PI * 2);
        ctx.ellipse(gx + r * 0.14, gy - r * 0.04, r * 0.12, r * 0.07, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "dengdeng":
      // 灯笼顶盖 + 金顶钮
      ctx.fillStyle = "#a3402e";
      rrectPath(ctx, x - r * 0.3, y - r * 1.12, r * 0.6, r * 0.2, r * 0.08);
      ctx.fill();
      ctx.fillStyle = "#ffd75e";
      ctx.beginPath();
      ctx.arc(x, y - r * 1.18, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    default:
      // 名单外的新角色兜底：一根小呆毛，保证脸谱永远不缺席
      ctx.strokeStyle = "#5c4a7d";
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, y - r * 1.02, r * 0.2, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
  }
}

/** 各角色的腮红色（比统一粉更贴主题色） */
const BLUSH: Record<string, string> = {
  duoduo: "rgba(255,110,170,.5)",
  xingxing: "rgba(255,170,60,.45)",
  nuonuo: "rgba(255,130,180,.4)",
  yunyun: "rgba(150,180,255,.45)",
  dundun: "rgba(200,120,70,.4)",
  shanshan: "rgba(255,180,80,.45)",
  lvlvdou: "rgba(120,190,110,.45)",
  jiujiu: "rgba(255,160,70,.45)",
  paopao: "rgba(120,190,255,.45)",
  tuantuan: "rgba(255,150,150,.4)",
  maimai: "rgba(220,160,80,.45)",
  dengdeng: "rgba(255,120,90,.45)",
};

/**
 * 画一张角色脸（不含身体圆）：眼睛 + 嘴 + 腮红 + 专属特征。
 * `t` 只拿来眨眼，soft 时传 0 就永远睁着眼。
 */
export function drawCharFace(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  r: number,
  mood: FaceMood = "idle",
  t = 0
): void {
  drawCharTrait(ctx, id, x, y, r);
  drawBlush(ctx, x, y, r, BLUSH[id] ?? "rgba(255,140,170,.45)");
  drawEyes(ctx, x, y, r, mood, t);
  drawMouth(ctx, x, y, r, mood);
}

/** 身体：径向渐变（亮 12% → 原色）+ 底部阴影弧 + 描边，配脸谱用 */
export function drawCharBody(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  r: number
): void {
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.15, x, y, r);
  g.addColorStop(0, shade(color, 0.18));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 底部 20% 暗弧当落影
  ctx.fillStyle = "rgba(60,40,80,.14)";
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.22, Math.PI * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.28);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 队伍外环：颜色 + 线型双通道（色弱也分得开）。
 * 0 粉=实线、1 蓝=长虚线、2 绿=点线、3 黄=点划线。
 */
export const TEAM_DASH: number[][] = [[], [7, 4], [2, 4], [9, 3, 2, 3]];

export function drawTeamRing(
  ctx: CanvasRenderingContext2D,
  color: string,
  team: number,
  x: number,
  y: number,
  r: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash(TEAM_DASH[team % TEAM_DASH.length]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ------------------------------------------------------------------ */
/* 道具绘制化（14 种全换）                                              */
/* ------------------------------------------------------------------ */

/** 道具类别 → 泡壳描边色：攻击类粉 / 移动类蓝 / 防护类绿 */
export type ItemArtCat = "attack" | "move" | "guard";

export const ITEM_CATS: Record<string, ItemArtCat> = {
  hammer: "attack",
  honey: "attack",
  icecream: "attack",
  fountain: "attack",
  drum: "attack",
  springshoe: "move",
  feather: "move",
  mushroom: "move",
  balloon: "move",
  rainbow: "move",
  magnet: "move",
  shield: "guard",
  cookie: "guard",
  bell: "guard",
};

const CAT_COLORS: Record<ItemArtCat, string> = {
  attack: "#ff8fbe",
  move: "#7fb2ff",
  guard: "#8fd6a4",
};

/** 泡壳：白→透明径向渐变 + 顶部高光弧 + 类别描边（不再是纯白圆） */
export function drawItemBubble(
  ctx: CanvasRenderingContext2D,
  cat: ItemArtCat,
  x: number,
  y: number,
  r: number
): void {
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,.95)");
  g.addColorStop(0.75, "rgba(255,255,255,.72)");
  g.addColorStop(1, "rgba(255,255,255,.25)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CAT_COLORS[cat];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 1.15, Math.PI * 1.55);
  ctx.stroke();
}

/** 每种道具 ≤10 条指令的极简图标（s ≈ 图标半径） */
export function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  s: number
): void {
  switch (id) {
    case "hammer":
      // 圆头软锤：锤头 + 木柄
      ctx.strokeStyle = "#b98a52";
      ctx.lineWidth = s * 0.24;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, y - s * 0.15);
      ctx.lineTo(x + s * 0.62, y + s * 0.72);
      ctx.stroke();
      ctx.fillStyle = "#ff8fbe";
      rrectPath(ctx, x - s * 0.85, y - s * 0.85, s * 1.25, s * 0.85, s * 0.4);
      ctx.fill();
      ctx.fillStyle = "#ffc7dd";
      ctx.beginPath();
      ctx.arc(x - s * 0.62, y - s * 0.42, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "springshoe":
      // 小鞋 + 底下弹簧圈
      ctx.fillStyle = "#7fb2ff";
      rrectPath(ctx, x - s * 0.7, y - s * 0.5, s * 1.4, s * 0.62, s * 0.28);
      ctx.fill();
      ctx.strokeStyle = "#5470c0";
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.3, s * 0.5, s * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.62, s * 0.38, s * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "shield":
      // 双层护盾圈
      ctx.strokeStyle = "#8fd6a4";
      ctx.lineWidth = s * 0.2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#bde8ca";
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "feather":
      // 羽形曲线 + 羽轴
      ctx.fillStyle = "#9cc8ff";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.8);
      ctx.quadraticCurveTo(x - s * 0.9, y - s * 0.5, x + s * 0.35, y - s * 0.85);
      ctx.quadraticCurveTo(x + s * 0.75, y - s * 0.2, x - s * 0.7, y + s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#5b86c9";
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.62, y + s * 0.7);
      ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.1, x + s * 0.3, y - s * 0.72);
      ctx.stroke();
      return;
    case "cookie": {
      // 咬缺圆 + 芝麻点
      ctx.fillStyle = "#d99a4e";
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, Math.PI * 0.22, Math.PI * 1.82);
      ctx.arc(x + s * 0.72, y - s * 0.35, s * 0.34, Math.PI * 1.15, Math.PI * 0.5, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a5a2c";
      for (const [dx, dy] of [
        [-0.32, -0.1],
        [0.1, 0.3],
        [-0.05, -0.42],
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "mushroom":
      // 菇帽点点 + 短柄
      ctx.fillStyle = "#fff3e2";
      rrectPath(ctx, x - s * 0.28, y + s * 0.05, s * 0.56, s * 0.62, s * 0.2);
      ctx.fill();
      ctx.fillStyle = "#ff7f9e";
      ctx.beginPath();
      ctx.arc(x, y + s * 0.08, s * 0.8, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - s * 0.34, y - s * 0.26, s * 0.14, 0, Math.PI * 2);
      ctx.arc(x + s * 0.3, y - s * 0.36, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "honey":
      // 蜜罐 + 一滴蜜
      ctx.fillStyle = "#e8a83e";
      rrectPath(ctx, x - s * 0.62, y - s * 0.4, s * 1.24, s * 1.0, s * 0.34);
      ctx.fill();
      ctx.fillStyle = "#c9822a";
      rrectPath(ctx, x - s * 0.42, y - s * 0.68, s * 0.84, s * 0.3, s * 0.12);
      ctx.fill();
      ctx.fillStyle = "#ffd75e";
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.28);
      ctx.quadraticCurveTo(x + s * 0.24, y + s * 0.7, x, y + s * 0.84);
      ctx.quadraticCurveTo(x - s * 0.24, y + s * 0.7, x, y + s * 0.28);
      ctx.fill();
      return;
    case "icecream":
      // 甜筒 + 冰淇淋球
      ctx.fillStyle = "#e0b06a";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.05);
      ctx.lineTo(x + s * 0.5, y - s * 0.05);
      ctx.lineTo(x, y + s * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d9f0ff";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.4, s * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - s * 0.16, y - s * 0.52, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "balloon":
      // 椭圆气球 + 线
      ctx.fillStyle = "#ff9ec4";
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.25, s * 0.55, s * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - s * 0.2, y - s * 0.45, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c2497e";
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.42);
      ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.65, x - s * 0.08, y + s * 0.9);
      ctx.stroke();
      return;
    case "fountain": {
      // 星星 + 喷线
      ctx.strokeStyle = "#7fb2ff";
      ctx.lineWidth = s * 0.12;
      for (const dx of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y + s * 0.85);
        ctx.quadraticCurveTo(x + dx * s * 1.4, y + s * 0.3, x + dx * s * 0.7, y + s * 0.05);
        ctx.stroke();
      }
      drawGoldStar(ctx, x, y - s * 0.32, s * 0.5, 0);
      return;
    }
    case "magnet":
      // U 形磁铁
      ctx.strokeStyle = "#e4574f";
      ctx.lineWidth = s * 0.34;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.15, s * 0.5, Math.PI * 0.05, Math.PI * 0.95, true);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      rrectPath(ctx, x - s * 0.68, y + s * 0.28, s * 0.36, s * 0.34, s * 0.08);
      ctx.fill();
      rrectPath(ctx, x + s * 0.32, y + s * 0.28, s * 0.36, s * 0.34, s * 0.08);
      ctx.fill();
      return;
    case "rainbow": {
      // 三色弧翅
      const cols = ["#ff8fbe", "#ffd166", "#7fb2ff"];
      ctx.lineWidth = s * 0.18;
      cols.forEach((col, i) => {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(x, y + s * 0.5, s * (0.82 - i * 0.22), Math.PI, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }
    case "drum":
      // 鼓身横纹 + 鼓面
      ctx.fillStyle = "#e4574f";
      rrectPath(ctx, x - s * 0.7, y - s * 0.35, s * 1.4, s * 0.95, s * 0.2);
      ctx.fill();
      ctx.fillStyle = "#fff3e2";
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.35, s * 0.7, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.2);
      ctx.lineTo(x + s * 0.7, y + s * 0.2);
      ctx.stroke();
      return;
    case "bell":
      // 铃身 + 音符线
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.1, s * 0.52, Math.PI, Math.PI * 2);
      ctx.lineTo(x + s * 0.62, y + s * 0.42);
      ctx.lineTo(x - s * 0.62, y + s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c9822a";
      ctx.beginPath();
      ctx.arc(x, y + s * 0.56, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a7aa6";
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.72, y - s * 0.5);
      ctx.lineTo(x + s * 0.72, y - s * 0.05);
      ctx.stroke();
      return;
    default:
      // 没画过的新道具兜底：一颗金星
      drawGoldStar(ctx, x, y, s * 0.7, 0);
  }
}

/** 泡壳 + 图标一起画（场上道具用它） */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  r: number
): void {
  drawItemBubble(ctx, ITEM_CATS[id] ?? "move", x, y, r);
  drawItemIcon(ctx, id, x, y, r * 0.58);
}

/* ------------------------------------------------------------------ */
/* 平台画法                                                            */
/* ------------------------------------------------------------------ */

/** 平台通用：底面投影 + 底色 + 顶面高光条 + 白描边 */
export function drawPlatformBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  const rr = Math.min(10, h / 2);
  // 底面投影：下方 4px 半透明暗带
  ctx.fillStyle = "rgba(90,70,120,.14)";
  rrectPath(ctx, x + 3, y + h + 2, w - 6, 4, 3);
  ctx.fill();
  ctx.fillStyle = color;
  rrectPath(ctx, x, y, w, h, rr);
  ctx.fill();
  // 顶面高光：上 25% 亮一阶
  ctx.fillStyle = shade(color, 0.32);
  rrectPath(ctx, x + 2, y + 1.5, w - 4, Math.max(3, h * 0.25), rr * 0.8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 2;
  rrectPath(ctx, x, y, w, h, rr);
  ctx.stroke();
}

/** 传送带：箭头齿带（t 已过 animT，soft 时静止），替代 "▶▶▶" 字符 */
export function drawBelt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  drift: number,
  t: number
): void {
  const step = 16;
  const dir = drift > 0 ? 1 : -1;
  const off = ((t * Math.abs(drift)) % step) * dir;
  ctx.save();
  rrectPath(ctx, x + 3, y + 3, w - 6, h - 6, 5);
  ctx.clip();
  ctx.strokeStyle = "rgba(110,110,185,.5)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  const cy = y + h / 2;
  const a = Math.min(5, h * 0.22);
  for (let px = x - step + off; px < x + w + step; px += step) {
    ctx.moveTo(px - dir * a, cy - a);
    ctx.lineTo(px + dir * a, cy);
    ctx.lineTo(px - dir * a, cy + a);
  }
  ctx.stroke();
  ctx.restore();
}

/** 弹簧平台：底部两个弹簧圈 */
export function drawSprings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.strokeStyle = "rgba(210,90,150,.55)";
  ctx.lineWidth = 2.4;
  for (const fx of [0.28, 0.72]) {
    const sx = x + w * fx;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(sx, y + h + 4 + i * 5, 9 - i * 2, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** 冰面：两道冰裂纹 + 一条高光斜条，替代原来那条白横线 */
export function drawIceDetail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + 2);
  ctx.lineTo(x + w * 0.28, y + h * 0.45);
  ctx.lineTo(x + w * 0.24, y + h - 3);
  ctx.moveTo(x + w * 0.66, y + 2);
  ctx.lineTo(x + w * 0.6, y + h * 0.5);
  ctx.lineTo(x + w * 0.68, y + h - 3);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.78, y + h - 3);
  ctx.lineTo(x + w * 0.88, y + 3);
  ctx.stroke();
}

/** 会塌平台的裂纹：摇晃越久裂纹越多（n = 1..3） */
export function drawCracks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number
): void {
  ctx.strokeStyle = "rgba(120,80,60,.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < Math.min(3, Math.max(0, n)); i++) {
    const cx = x + w * (0.25 + i * 0.25);
    ctx.moveTo(cx, y + 1);
    ctx.lineTo(cx - w * 0.04, y + h * 0.4);
    ctx.lineTo(cx + w * 0.03, y + h * 0.6);
    ctx.lineTo(cx - w * 0.02, y + h - 1);
  }
  ctx.stroke();
}

/** 隐形（散开中的）平台：虚线轮廓 + 微光 */
export function drawHiddenPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.fillStyle = "rgba(255,255,255,.12)";
  rrectPath(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 5]);
  rrectPath(ctx, x, y, w, h, 8);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ------------------------------------------------------------------ */
/* 场地主题装饰层                                                       */
/* ------------------------------------------------------------------ */

/** 背景齿轮剪影（传送带工厂用） */
function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.fillStyle = "rgba(120,120,190,.14)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(226,244,255,.9)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

/** 远景风车剪影（呼呼风车原用；rot 已过 animT，soft 时静止） */
function drawWindmill(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number): void {
  ctx.strokeStyle = "rgba(110,150,130,.35)";
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s * 1.6);
  ctx.stroke();
  ctx.fillStyle = "rgba(110,150,130,.28)";
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.55, s * 0.16, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 10 张场地的主题装饰（每张 ≤3 个元素，画在天空之后、平台之前）。
 * `t` 已经过 {@link animT}：soft 时传 0，全部装饰静止在一帧好看的位置。
 */
export function drawStageDecor(
  ctx: CanvasRenderingContext2D,
  stageId: string,
  worldW: number,
  worldH: number,
  t: number,
  skyTop = "#dff0ff"
): void {
  switch (stageId) {
    case "cloud-square": {
      // 三朵扁云慢慢飘（视差微移）
      const drift = (t * 6) % (worldW + 240);
      drawFluffyCloud(ctx, ((140 + drift) % (worldW + 240)) - 120, 92, 92, "rgba(255,255,255,.8)");
      drawFluffyCloud(ctx, ((640 + drift * 0.7) % (worldW + 240)) - 120, 58, 70, "rgba(255,255,255,.65)");
      drawFluffyCloud(ctx, ((420 + drift * 0.5) % (worldW + 240)) - 120, 140, 56, "rgba(255,255,255,.5)");
      return;
    }
    case "wobble-isles":
      // 底部水面波光
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(t * 1.8)})`;
      ctx.lineWidth = 2.5;
      for (const [wx, wy, ww] of [
        [180, worldH - 44, 90],
        [470, worldH - 30, 120],
        [760, worldH - 50, 80],
      ]) {
        ctx.beginPath();
        ctx.arc(wx, wy, ww / 2, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      return;
    case "belt-works":
      drawGear(ctx, 130, 130, 52, t * 0.4);
      drawGear(ctx, 830, 90, 38, -t * 0.55);
      return;
    case "spring-candy":
      // 两根棒棒糖柱
      for (const [lx, col] of [
        [80, "#ff9ec4"],
        [880, "#7fd6c2"],
      ] as Array<[number, string]>) {
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(lx, 200);
        ctx.lineTo(lx, worldH);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(lx, 165, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(lx, 165, 24, 0, Math.PI * 1.4);
        ctx.stroke();
      }
      return;
    case "syrup-pool":
      // 气泡在 drawSyrup 里跟着液面画，这里不用再加
      return;
    case "windmill-field":
      drawWindmill(ctx, 806, 172, 62, t * 0.5);
      return;
    case "ice-lake":
      // 冰晶闪点（闪烁；t=0 时定格在中间亮度）
      for (const [i, [sx, sy, sr]] of [
        [170, 120, 12],
        [500, 70, 9],
        [800, 150, 11],
      ].entries()) {
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 2 + i * 2.1);
        drawSparkle(ctx, sx, sy, sr, "#ffffff");
        ctx.globalAlpha = 1;
      }
      return;
    case "star-lift":
      // 两道光柱
      for (const lx of [180, 720]) {
        const g = ctx.createLinearGradient(lx, 0, lx, worldH);
        g.addColorStop(0, "rgba(255,255,255,.35)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx - 30, 0, 60, worldH);
      }
      return;
    case "night-hops": {
      // 星空点 + 月牙
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const [sx, sy] of [
        [110, 70],
        [280, 130],
        [520, 60],
        [660, 150],
        [900, 100],
        [420, 100],
      ]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff2b8";
      ctx.beginPath();
      ctx.arc(830, 84, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skyTop;
      ctx.beginPath();
      ctx.arc(818, 74, 30, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "allstar-arena": {
      // 看台剪影 + 彩旗串
      ctx.fillStyle = "rgba(160,120,190,.16)";
      for (const side of [0, 1]) {
        const bx = side === 0 ? 0 : worldW - 180;
        for (let i = 0; i < 3; i++) {
          rrectPath(ctx, bx - 20 + (side === 0 ? -i * 8 : i * 8), 190 + i * 26, 200, 18, 8);
          ctx.fill();
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 46);
      ctx.quadraticCurveTo(worldW / 2, 110, worldW, 46);
      ctx.stroke();
      const flagCols = ["#ff8fbe", "#ffd166", "#7fb2ff", "#8fd6a4"];
      for (let i = 0; i < 8; i++) {
        const k = (i + 0.5) / 8;
        const fx = worldW * k;
        // 沿旗绳（二次贝塞尔）取点：y = 46 + (110-46)·2k(1-k)
        const fy = 46 + (110 - 46) * 2 * k * (1 - k);
        const sway = Math.sin(t * 2 + i) * 2;
        ctx.fillStyle = flagCols[i % flagCols.length];
        ctx.beginPath();
        ctx.moveTo(fx - 9, fy);
        ctx.lineTo(fx + 9, fy);
        ctx.lineTo(fx + sway, fy + 18);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    default:
      return;
  }
}

/** 糖浆池上浮的小气泡（跟着液面 syrupY 画；t 已过 animT，soft 时定格） */
export function drawSyrupBubbles(
  ctx: CanvasRenderingContext2D,
  syrupY: number,
  worldH: number,
  t: number
): void {
  ctx.strokeStyle = "rgba(255,236,200,.9)";
  ctx.lineWidth = 2;
  for (const [i, bx] of [300, 486, 668].entries()) {
    const cycle = 84;
    const rise = (t * 26 + i * 33) % cycle;
    const by = Math.min(worldH - 8, syrupY + 90 - rise);
    if (by < syrupY + 10) continue;
    ctx.beginPath();
    ctx.arc(bx + Math.sin(t * 2 + i) * 5, by, 5 + i * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
