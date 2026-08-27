/**
 * 豆豆迷宫 · 1.3 视觉素材（纯绘制，零玩法数值）。
 *
 * 共享 art kit（src/art/kit/）未合入前，按 visual-bible 的口径把本款的
 * 贴图与绘制函数收在这一个文件里：发光感全部预渲染成小画布、帧循环里只
 * drawImage 复用，不逐帧 shadowBlur；全部 Canvas 2D 矢量代码化，
 * 不引位图、不引 emoji 字形，离线可用也不膨胀包体。
 * 这里只有「怎么画」，胜负与数值一个字都不碰。
 */

/* ------------------------------------------------------------------ */
/* 贴图小工厂                                                          */
/* ------------------------------------------------------------------ */

/** 建一张 size×size 的离屏小画布并画好内容（预渲染贴图都从这走） */
function makeSprite(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas") as HTMLCanvasElement;
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) paint(g, size);
  return c;
}

/**
 * 往当前路径里放一颗 points 芒的星星（只建路径，fill / stroke 交给调用方）。
 * rot 默认让第一个尖朝上。
 */
export function starPath(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  rOuter: number,
  rInner: number,
  rot = -Math.PI / 2
): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* 豆子 / 能量豆 / 抢豆星星：发光贴图                                    */
/* ------------------------------------------------------------------ */

let dotCache: HTMLCanvasElement | null = null;

/**
 * 豆子贴图：中心亮黄小圆 + 外圈约 1.5 倍的柔光晕。
 * 一张 16×16 贴图全场 drawImage 复用，比逐颗画渐变便宜得多。
 */
export function dotSprite(): HTMLCanvasElement {
  dotCache ??= makeSprite(16, (g) => {
    const halo = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    halo.addColorStop(0, "rgba(255,244,205,0.95)");
    halo.addColorStop(0.42, "rgba(255,233,168,0.5)");
    halo.addColorStop(1, "rgba(255,233,168,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#FFEFB5";
    g.beginPath();
    g.arc(8, 8, 3.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#FFFDF2";
    g.beginPath();
    g.arc(7, 7, 1.4, 0, Math.PI * 2);
    g.fill();
  });
  return dotCache;
}

let powerCache: HTMLCanvasElement | null = null;

/**
 * 能量豆贴图：四芒星光点（粉渐变 + 光晕 + 高光点）。
 * 旋转与脉动在帧循环里用变换实现，贴图本身是静态的。
 */
export function powerSprite(): HTMLCanvasElement {
  powerCache ??= makeSprite(32, (g) => {
    const halo = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    halo.addColorStop(0, "rgba(255,201,229,0.85)");
    halo.addColorStop(0.55, "rgba(255,143,199,0.28)");
    halo.addColorStop(1, "rgba(255,143,199,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 32, 32);
    const body = g.createLinearGradient(16, 3, 16, 29);
    body.addColorStop(0, "#FFC9E5");
    body.addColorStop(1, "#FF8FC7");
    g.fillStyle = body;
    starPath(g, 16, 16, 4, 12.5, 4.4);
    g.fill();
    g.strokeStyle = "#E56AA8";
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(13, 11, 1.6, 0, Math.PI * 2);
    g.fill();
  });
  return powerCache;
}

let versusStarCache: HTMLCanvasElement | null = null;

/** 抢豆模式里星星的棋子：真五角星（金黄渐变 + 描边 + 光晕），不再是蓝圆 */
export function versusStarSprite(): HTMLCanvasElement {
  versusStarCache ??= makeSprite(32, (g) => {
    const halo = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    halo.addColorStop(0, "rgba(255,236,158,0.8)");
    halo.addColorStop(0.6, "rgba(255,226,122,0.25)");
    halo.addColorStop(1, "rgba(255,226,122,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 32, 32);
    const body = g.createLinearGradient(16, 3, 16, 29);
    body.addColorStop(0, "#FFEC9E");
    body.addColorStop(1, "#F5B93D");
    g.fillStyle = body;
    starPath(g, 16, 17, 5, 12.5, 5.4);
    g.fill();
    g.strokeStyle = "#C98A2E";
    g.lineWidth = 1.4;
    g.lineJoin = "round";
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(12.6, 11.4, 1.7, 0, Math.PI * 2);
    g.fill();
  });
  return versusStarCache;
}
