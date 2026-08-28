// 共享美术套件 · 地形剖面(本文件由 adventure-king 窗格新增并维护)。
//
// 画「草顶 + 土身 + 石底」的三段平台剖面与悬空根须:只依赖传进来的 2D 画笔
// 最小接口,不碰 DOM、不带任何状态,别的游戏想要同款草地直接 import。
// 光源约定:左上 45°,亮部一律画在左上。

export interface TerrainGradient {
  addColorStop(offset: number, color: string): void;
}

/** 只列真正用到的画笔能力,真 Canvas 2D 与测试桩都天然满足 */
export interface TerrainBrush {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: unknown;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): TerrainGradient;
}

export interface TerrainPalette {
  /** 草顶 */
  grass: string;
  /** 草丛锯齿线(比草顶深一档) */
  grassDark: string;
  /** 土身 */
  soil: string;
  /** 土层纹(比土身深一档) */
  soilLine: string;
  /** 石底 */
  stone: string;
}

export interface TerrainBands {
  grassH: number;
  soilH: number;
  stoneH: number;
}

/** 把剖面总高 h 分成草 / 土 / 石三段:三段非负、加起来正好是 h */
export function terrainBands(h: number): TerrainBands {
  const safe = Math.max(0, h);
  const grassH = Math.min(14, safe * 0.34);
  const stoneH = Math.min(16, Math.max(0, (safe - grassH) * 0.3));
  return { grassH, soilH: Math.max(0, safe - grassH - stoneH), stoneH };
}

export interface TerrainOpts {
  /** 屏幕缩放(锯齿 / 花朵的线宽随它走) */
  scale?: number;
  /** 要不要画草丛锯齿线 */
  tufts?: boolean;
  /** 要不要点两朵小花 */
  flowers?: boolean;
  /** 土层纹条数 */
  strata?: number;
}

/**
 * 三段剖面:石底(整块打底、底部圆角)→ 土身 → 草顶,
 * 再加草丛锯齿线、两朵小花、两条土层纹。位置全是确定式的,不闪不抖。
 */
export function drawTerrainProfile(
  b: TerrainBrush,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pal: TerrainPalette,
  opts: TerrainOpts = {}
): void {
  if (w <= 0 || h <= 0) return;
  const s = opts.scale ?? 1;
  const bands = terrainBands(h);
  b.save();
  // 石底:整块打底,露出来的下缘就是石色
  b.fillStyle = pal.stone;
  b.beginPath();
  b.roundRect(x, y, w, h, r);
  b.fill();
  // 土身:盖住上面大半
  if (bands.grassH + bands.soilH > 0) {
    b.fillStyle = pal.soil;
    b.beginPath();
    b.roundRect(x, y, w, bands.grassH + bands.soilH, r);
    b.fill();
  }
  // 草顶:左上光,给一条浅色渐变
  if (bands.grassH > 0) {
    const g = b.createLinearGradient(x, y, x, y + bands.grassH);
    g.addColorStop(0, pal.grass);
    g.addColorStop(1, pal.grassDark);
    b.fillStyle = g;
    b.beginPath();
    b.roundRect(x, y, w, bands.grassH, r);
    b.fill();
  }
  // 草丛锯齿线:沿草土交界处一排小三角草尖
  if (opts.tufts !== false && bands.grassH > 2) {
    const gy = y + bands.grassH;
    b.fillStyle = pal.grassDark;
    const step = Math.max(10 * s, 8);
    for (let tx = x + step * 0.6; tx < x + w - step * 0.4; tx += step) {
      b.beginPath();
      b.moveTo(tx - 3 * s, gy);
      b.quadraticCurveTo(tx, gy - 5 * s, tx + 3 * s, gy);
      b.closePath();
      b.fill();
    }
  }
  // 两朵小花:四分之一与四分之三处各一朵(五瓣点 + 金色花心)
  if (opts.flowers !== false && bands.grassH > 3 && w > 46 * s) {
    for (const k of [0.28, 0.74]) {
      const fx = x + w * k;
      const fy = y + bands.grassH * 0.45;
      b.fillStyle = "#ffffff";
      for (let p = 0; p < 5; p++) {
        const ang = (p * Math.PI * 2) / 5 - Math.PI / 2;
        b.beginPath();
        b.arc(fx + Math.cos(ang) * 2.4 * s, fy + Math.sin(ang) * 2.4 * s, 1.5 * s, 0, Math.PI * 2);
        b.fill();
      }
      b.fillStyle = "#F0C25A";
      b.beginPath();
      b.arc(fx, fy, 1.4 * s, 0, Math.PI * 2);
      b.fill();
    }
  }
  // 土层纹:横向浅纹,均分在土身里
  const strata = opts.strata ?? 2;
  if (strata > 0 && bands.soilH > 8) {
    b.strokeStyle = pal.soilLine;
    b.lineWidth = Math.max(1, 1.5 * s);
    b.lineCap = "round";
    const inset = Math.min(10 * s, w * 0.12);
    for (let i = 1; i <= strata; i++) {
      const ly = y + bands.grassH + (bands.soilH * i) / (strata + 1);
      b.beginPath();
      b.moveTo(x + inset, ly);
      b.lineTo(x + w - inset, ly);
      b.stroke();
    }
  }
  b.restore();
}

/** 悬空小平台的底部根须:几缕确定式的垂帘曲线,不用随机数 */
export function drawHangingRoots(
  b: TerrainBrush,
  x: number,
  y: number,
  w: number,
  len: number,
  color: string,
  scale = 1
): void {
  if (w <= 0 || len <= 0) return;
  b.save();
  b.strokeStyle = color;
  b.lineWidth = Math.max(1, 1.4 * scale);
  b.lineCap = "round";
  const roots = Math.max(2, Math.min(5, Math.round(w / 46)));
  for (let i = 0; i < roots; i++) {
    const rx = x + (w * (i + 0.5)) / roots;
    const sway = (i % 2 === 0 ? 1 : -1) * 3 * scale;
    const rl = len * (0.6 + 0.4 * ((i * 37) % 10) / 10);
    b.beginPath();
    b.moveTo(rx, y);
    b.quadraticCurveTo(rx + sway, y + rl * 0.6, rx - sway * 0.6, y + rl);
    b.stroke();
  }
  b.restore();
}
