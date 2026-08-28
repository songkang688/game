/**
 * 便便超人 · 自绘道具小画坊(1.3 窗口 7 第 1 轮视觉修复 C 档新增,纯绘制零判定)。
 *
 * A 档报告点名的三处「裸 emoji 当核心道具」都在这里换成自绘:
 *  - 香香星(收集物):kit `traceStar` 星形 + 三停径向渐变 + 描边 + 左上小高光;
 *  - 地面垃圾 / 头顶携带件:18 款分类条目逐一自绘(≥2 停渐变 + 1.5px 级描边);
 *  - 三色分类桶的功能图标:可回收 / 厨余 / 其他 三枚自绘白色图形。
 *
 * 统一约定跟全款一致:光源左上 45°、描边 1.5–2px、粉彩色板、绝不 fillText emoji。
 * 这里只读坐标与尺寸,一个玩法数值都不碰。
 */

import { traceStar } from "../../art/kit/sparkle";
import { drawFlower, shade } from "./visual";

/** 圆角矩形路径(本模块自用,不依赖 index.ts 的私有工具) */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
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

/** 两停线性渐变(亮 → 暗,方向由调用点定,默认斜向左上受光) */
function grad2(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c0: string,
  c1: string
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

// ---------------------------------------------------------------------------
// 香香星(收集物):顶替裸 ✨
// ---------------------------------------------------------------------------

/**
 * 自绘香香星:柔光圈 + 三停径向渐变星身(亮心偏左上)+ 描边 + 左上小高光星。
 * r 是星的外接半径(原 emoji 字号 19px ≈ r 9.5)。
 */
export function drawScentStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  // 柔光圈:收集物在任何底色上都有一圈呼吸感
  const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.55);
  halo.addColorStop(0, "rgba(255,241,186,.5)");
  halo.addColorStop(1, "rgba(255,241,186,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
  ctx.fill();
  // 星身:三停径向渐变,亮心偏左上(统一光源 45°)
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.08, x, y, r * 1.05);
  body.addColorStop(0, "#FFF9E0");
  body.addColorStop(0.55, "#FFD75E");
  body.addColorStop(1, "#F2AE2E");
  ctx.fillStyle = body;
  traceStar(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = "#C98A1E";
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.stroke();
  // 左上小高光星
  ctx.fillStyle = "rgba(255,255,255,.85)";
  traceStar(ctx, x - r * 0.3, y - r * 0.32, r * 0.3);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 18 款分类条目(核心道具):顶替裸 `item.emoji`
// ---------------------------------------------------------------------------

/** 描一圈:统一 1.5–2px 级别的收边(线宽由 drawTrashItem 按缩放算好) */
function edge(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** 左上受光的小高光(白色半透明小椭圆) */
function gleam(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 自绘一件分类条目。全部画在 20 单位设计网格上(条目居中于 x/y,s 是整体高度,
 * 原 emoji 字号 20px ⇒ s 传 20 上下)。每款:≥2 停渐变 + 描边 + 左上高光。
 * 不认识的 id 画一颗中性小圆石兜底(理论到不了,防御一下)。
 */
export function drawTrashItem(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: number): void {
  const u = s / 20;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  // 缩放后有效线宽 = lineWidth × u:正常 1.7px,小画幅下限 1.2px
  ctx.lineWidth = Math.max(1.2 / Math.max(0.01, u), 1.7);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (id) {
    case "bottle": {
      // 塑料水瓶:瓶身 + 瓶颈 + 蓝盖
      ctx.fillStyle = grad2(ctx, -4.5, -6, 4.5, 8, "#D5EAF8", "#95C4EA");
      rrect(ctx, -4.5, -4, 9, 13, 3);
      ctx.fill();
      edge(ctx, "#6E9CC4");
      ctx.fillStyle = "#BCD9F0";
      rrect(ctx, -2, -8, 4, 4.4, 1.2);
      ctx.fill();
      edge(ctx, "#6E9CC4");
      ctx.fillStyle = grad2(ctx, -2.8, -10.5, 2.8, -7.5, "#A7CBF2", "#7FB2F0");
      rrect(ctx, -2.8, -10.5, 5.6, 3, 1.2);
      ctx.fill();
      edge(ctx, "#547FB4");
      gleam(ctx, -2.4, -1.5, 1.1, 3.4);
      break;
    }
    case "can": {
      // 易拉罐:银身粉带 + 顶盖拉环
      ctx.fillStyle = grad2(ctx, -5, -7, 5, 8, "#F0F4F9", "#B9C5D8");
      rrect(ctx, -5, -7, 10, 15, 2.5);
      ctx.fill();
      edge(ctx, "#8896AC");
      ctx.fillStyle = "#F6B6CD";
      rrect(ctx, -5, -2.5, 10, 5, 1);
      ctx.fill();
      ctx.fillStyle = grad2(ctx, -5, -8.6, 5, -5.6, "#E2E9F2", "#C3CEDD");
      ctx.beginPath();
      ctx.ellipse(0, -7, 5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      edge(ctx, "#8896AC");
      ctx.fillStyle = "#98A6BC";
      ctx.beginPath();
      ctx.arc(0, -7, 1.2, 0, Math.PI * 2);
      ctx.fill();
      gleam(ctx, -2.6, 0, 1, 4);
      break;
    }
    case "paper": {
      // 旧报纸:白纸面 + 粉彩报头 + 三行字线
      ctx.fillStyle = grad2(ctx, -7, -6, 7, 6, "#FFFFFF", "#E5EAF1");
      rrect(ctx, -7, -6, 14, 12, 1.2);
      ctx.fill();
      edge(ctx, "#AEB9C9");
      ctx.fillStyle = "#F5C1D0";
      rrect(ctx, -5.4, -4.4, 6.4, 3, 0.8);
      ctx.fill();
      ctx.strokeStyle = "#C2CBD8";
      for (const ly of [0.6, 2.4, 4.2]) {
        ctx.beginPath();
        ctx.moveTo(-5.4, ly);
        ctx.lineTo(5.4, ly);
        ctx.stroke();
      }
      gleam(ctx, -4.6, -5, 1.6, 0.8);
      break;
    }
    case "carton": {
      // 纸箱板:牛皮纸箱 + 竖封条
      ctx.fillStyle = grad2(ctx, -7, -6, 7, 7, "#EBCB9C", "#CBA265");
      rrect(ctx, -7, -6, 14, 12.5, 1.5);
      ctx.fill();
      edge(ctx, "#A57F42");
      ctx.fillStyle = "#F6E9CF";
      rrect(ctx, -1.4, -6, 2.8, 12.5, 0.6);
      ctx.fill();
      ctx.strokeStyle = "#B98F52";
      ctx.beginPath();
      ctx.moveTo(-7, -1.6);
      ctx.lineTo(-1.4, -1.6);
      ctx.moveTo(1.4, -1.6);
      ctx.lineTo(7, -1.6);
      ctx.stroke();
      gleam(ctx, -4.8, -4.6, 1.4, 0.9);
      break;
    }
    case "glass": {
      // 玻璃瓶:青瓷绿罐身 + 瓶口 + 竖高光
      ctx.fillStyle = grad2(ctx, -4.5, -4, 4.5, 9, "#D3EDDD", "#97CBAA");
      rrect(ctx, -4.5, -3, 9, 12, 3.5);
      ctx.fill();
      edge(ctx, "#6FA383");
      ctx.fillStyle = "#BCE0C9";
      rrect(ctx, -2.5, -7.5, 5, 4.8, 1.4);
      ctx.fill();
      edge(ctx, "#6FA383");
      ctx.fillStyle = "#8FBF9F";
      rrect(ctx, -3, -9.5, 6, 2.4, 1);
      ctx.fill();
      edge(ctx, "#5F8F73");
      gleam(ctx, -2.2, 0.5, 0.9, 3.6);
      break;
    }
    case "cloth": {
      // 旧衣服:粉紫小 T 恤(身+两袖+领口)
      ctx.fillStyle = grad2(ctx, -7, -7, 6, 8, "#F8C4DD", "#E793BE");
      ctx.beginPath();
      ctx.moveTo(-3.6, -6.5);
      ctx.lineTo(3.6, -6.5);
      ctx.lineTo(7, -3.2);
      ctx.lineTo(5, -0.6);
      ctx.lineTo(3.4, -2);
      ctx.lineTo(3.4, 7);
      ctx.lineTo(-3.4, 7);
      ctx.lineTo(-3.4, -2);
      ctx.lineTo(-5, -0.6);
      ctx.lineTo(-7, -3.2);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#C06593");
      ctx.strokeStyle = "#C06593";
      ctx.beginPath();
      ctx.arc(0, -6.5, 1.8, 0, Math.PI);
      ctx.stroke();
      gleam(ctx, -1.8, -3.6, 1.2, 2.2);
      break;
    }
    case "apple": {
      // 苹果核:上下两瓣红 + 中间果芯收腰 + 小叶子
      ctx.fillStyle = grad2(ctx, -5, -8, 4, 8, "#F6A9A9", "#E4726F");
      ctx.beginPath();
      ctx.arc(0, -4.6, 4.6, Math.PI, 0);
      ctx.quadraticCurveTo(2.2, -2.4, 1.6, -1);
      ctx.lineTo(-1.6, -1);
      ctx.quadraticCurveTo(-2.2, -2.4, -4.6, -4.6);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#B4504E");
      ctx.beginPath();
      ctx.arc(0, 4.6, 4.6, 0, Math.PI);
      ctx.quadraticCurveTo(-2.2, 2.4, -1.6, 1);
      ctx.lineTo(1.6, 1);
      ctx.quadraticCurveTo(2.2, 2.4, 4.6, 4.6);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#B4504E");
      // 果芯
      ctx.fillStyle = grad2(ctx, -2, -3, 2, 5, "#FFF6E0", "#EFDDB6");
      ctx.beginPath();
      ctx.moveTo(-2.4, -3.4);
      ctx.quadraticCurveTo(-1, 0, -2.4, 3.4);
      ctx.lineTo(2.4, 3.4);
      ctx.quadraticCurveTo(1, 0, 2.4, -3.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8A6A4A";
      ctx.beginPath();
      ctx.ellipse(0, 0.2, 0.7, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // 叶柄
      ctx.strokeStyle = "#8A6A4A";
      ctx.beginPath();
      ctx.moveTo(0, -8.6);
      ctx.lineTo(0.6, -10.4);
      ctx.stroke();
      ctx.fillStyle = "#8FCB70";
      ctx.beginPath();
      ctx.ellipse(2.2, -10, 1.8, 1, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "banana": {
      // 香蕉皮:中间果肉柱 + 左右翻开的两片皮
      ctx.fillStyle = grad2(ctx, -8, -6, 8, 8, "#FFE48A", "#F0C34A");
      ctx.beginPath();
      ctx.moveTo(0, -7.5);
      ctx.quadraticCurveTo(-2.6, -2, -8, 5.5);
      ctx.quadraticCurveTo(-4.2, 7.5, -2.2, 4.2);
      ctx.quadraticCurveTo(-0.8, 1.6, 0, 0.6);
      ctx.quadraticCurveTo(0.8, 1.6, 2.2, 4.2);
      ctx.quadraticCurveTo(4.2, 7.5, 8, 5.5);
      ctx.quadraticCurveTo(2.6, -2, 0, -7.5);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#C9973A");
      ctx.fillStyle = "#8A6A4A";
      ctx.beginPath();
      ctx.arc(0, -7.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
      gleam(ctx, -2.6, -3, 1, 2);
      break;
    }
    case "leaf": {
      // 菜叶:两瓣叶身 + 主叶脉两侧脉
      ctx.fillStyle = grad2(ctx, -6, -7, 5, 8, "#C9EAA6", "#8FCB70");
      ctx.beginPath();
      ctx.moveTo(0, -8.5);
      ctx.quadraticCurveTo(7.5, -4, 5, 4.5);
      ctx.quadraticCurveTo(3, 8.5, 0, 8.5);
      ctx.quadraticCurveTo(-3, 8.5, -5, 4.5);
      ctx.quadraticCurveTo(-7.5, -4, 0, -8.5);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#6FA352");
      ctx.strokeStyle = "#6FA352";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 8);
      ctx.moveTo(0, -1);
      ctx.lineTo(-3, 2.4);
      ctx.moveTo(0, -3.4);
      ctx.lineTo(3, 0);
      ctx.stroke();
      gleam(ctx, -2.4, -3.6, 1.2, 2);
      break;
    }
    case "egg": {
      // 蛋壳:下半只壳 + 锯齿裂口
      ctx.fillStyle = grad2(ctx, -5, -5, 5, 8, "#FFFDF2", "#EDE2C6");
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(-3.2, 0.4);
      ctx.lineTo(-1.6, -2.4);
      ctx.lineTo(0, 0.4);
      ctx.lineTo(1.6, -2.4);
      ctx.lineTo(3.2, 0.4);
      ctx.lineTo(5, -2);
      ctx.quadraticCurveTo(5, 7.5, 0, 7.5);
      ctx.quadraticCurveTo(-5, 7.5, -5, -2);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#C9BC96");
      ctx.fillStyle = "rgba(201,188,150,.3)";
      ctx.beginPath();
      ctx.ellipse(0.8, 1.4, 3, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      gleam(ctx, -2.4, 2.4, 1, 2);
      break;
    }
    case "rice": {
      // 剩米饭:蓝瓷碗 + 三团白米
      ctx.fillStyle = grad2(ctx, -7, 0, 7, 8, "#9BC7F2", "#6E9FD4");
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.quadraticCurveTo(-6.4, 7.5, 0, 7.5);
      ctx.quadraticCurveTo(6.4, 7.5, 7, 0);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#517BB0");
      ctx.fillStyle = grad2(ctx, -6, -8, 5, 0, "#FFFFFF", "#EFEAE0");
      ctx.beginPath();
      ctx.arc(-3.2, -1.6, 3, 0, Math.PI * 2);
      ctx.arc(0, -4, 3.4, 0, Math.PI * 2);
      ctx.arc(3.2, -1.6, 3, 0, Math.PI * 2);
      ctx.fill();
      edge(ctx, "#D8D0C0");
      gleam(ctx, -1.6, -5.4, 1.2, 0.9);
      break;
    }
    case "tea": {
      // 茶叶渣:三片小叶叠成一撮
      const leaves: ReadonlyArray<readonly [number, number, number]> = [
        [-3.4, 1.2, 0.7],
        [3, 1.6, -0.6],
        [0, -2.2, 0.1],
      ];
      for (const [lx, ly, rot] of leaves) {
        ctx.fillStyle = grad2(ctx, lx - 3, ly - 3, lx + 3, ly + 3, "#B7DFA8", "#7FB584");
        ctx.beginPath();
        ctx.ellipse(lx, ly, 4, 2.2, rot, 0, Math.PI * 2);
        ctx.fill();
        edge(ctx, "#5F9366");
      }
      ctx.strokeStyle = "#5F9366";
      ctx.beginPath();
      ctx.moveTo(0, -4.2);
      ctx.lineTo(0, 0);
      ctx.stroke();
      gleam(ctx, -1.4, -3, 0.9, 0.7);
      break;
    }
    case "tissue": {
      // 用过的纸巾:皱巴巴的一小团
      ctx.fillStyle = grad2(ctx, -6, -6, 6, 7, "#FFFFFF", "#E8E4DC");
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.quadraticCurveTo(-6.5, -4.5, -2, -5.5);
      ctx.quadraticCurveTo(0.5, -7.5, 3.5, -5);
      ctx.quadraticCurveTo(7, -4, 6, 0.5);
      ctx.quadraticCurveTo(6.8, 4.6, 2.5, 5.5);
      ctx.quadraticCurveTo(-1, 7, -4, 5);
      ctx.quadraticCurveTo(-6.8, 4, -6, 1);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#C5BFB2");
      ctx.strokeStyle = "#D8D2C6";
      ctx.beginPath();
      ctx.moveTo(-3, -1);
      ctx.quadraticCurveTo(-1, 1, 1.5, -0.5);
      ctx.moveTo(-1, 3);
      ctx.quadraticCurveTo(1, 4, 3, 2.5);
      ctx.stroke();
      gleam(ctx, -2.8, -3.2, 1.4, 1);
      break;
    }
    case "chopstick": {
      // 一次性筷子:两根微微张开的木筷
      for (const tilt of [-0.1, 0.14] as const) {
        ctx.save();
        ctx.rotate(tilt);
        ctx.fillStyle = grad2(ctx, -1.4, -9, 1.4, 9, "#EBCB9C", "#CBA265");
        rrect(ctx, tilt < 0 ? -2.6 : 0.6, -9, 2, 18, 1);
        ctx.fill();
        edge(ctx, "#A57F42");
        ctx.restore();
      }
      ctx.fillStyle = "#F6E9CF";
      rrect(ctx, -3, -8.4, 6, 2.6, 1);
      ctx.fill();
      edge(ctx, "#A57F42");
      break;
    }
    case "ceramic": {
      // 碎陶瓷碗:半只碗 + 崩口锯齿 + 青花纹
      ctx.fillStyle = grad2(ctx, -7, -4, 6, 8, "#FDFDFD", "#DDE5EF");
      ctx.beginPath();
      ctx.moveTo(-7, -2);
      ctx.lineTo(-4.4, -0.2);
      ctx.lineTo(-2.6, -3.4);
      ctx.lineTo(-0.6, -0.6);
      ctx.lineTo(1.8, -4.2);
      ctx.lineTo(3.4, -1);
      ctx.lineTo(7, -2);
      ctx.quadraticCurveTo(6.2, 7, 0, 7);
      ctx.quadraticCurveTo(-6.2, 7, -7, -2);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#A9B6C8");
      ctx.strokeStyle = "#7FA9F0";
      ctx.beginPath();
      ctx.moveTo(-6.2, 2.4);
      ctx.quadraticCurveTo(0, 4.6, 6.2, 2.4);
      ctx.stroke();
      gleam(ctx, -3, 1, 1.1, 1.8);
      break;
    }
    case "brush": {
      // 旧牙刷:粉柄 + 白刷头 + 蓝刷毛
      ctx.save();
      ctx.rotate(0.5);
      ctx.fillStyle = grad2(ctx, -1.6, -4, 1.6, 10, "#F8B8CD", "#E98BAD");
      rrect(ctx, -1.6, -5, 3.2, 14.5, 1.6);
      ctx.fill();
      edge(ctx, "#C06590");
      ctx.fillStyle = grad2(ctx, -2.2, -10.5, 2.2, -5, "#FFFFFF", "#E8ECF2");
      rrect(ctx, -2.2, -10.5, 4.4, 6, 2);
      ctx.fill();
      edge(ctx, "#A9B6C8");
      ctx.strokeStyle = "#9BC7F2";
      for (const by of [-9.4, -7.9, -6.4]) {
        ctx.beginPath();
        ctx.moveTo(-1.2, by);
        ctx.lineTo(1.2, by);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "wrap": {
      // 保鲜膜:纸盒 + 抽出的半透明膜
      ctx.fillStyle = "rgba(214,238,248,.6)";
      rrect(ctx, -5, -8.5, 10, 7.5, 1);
      ctx.fill();
      ctx.strokeStyle = "rgba(116,169,198,.85)";
      ctx.stroke();
      ctx.strokeStyle = "rgba(116,169,198,.5)";
      ctx.beginPath();
      ctx.moveTo(-2.6, -8);
      ctx.quadraticCurveTo(-1.6, -4.5, -2.6, -1.4);
      ctx.moveTo(1.8, -8);
      ctx.quadraticCurveTo(2.8, -4.5, 1.8, -1.4);
      ctx.stroke();
      ctx.fillStyle = grad2(ctx, -7, -1, 7, 7.5, "#CBE7F5", "#9CCBE4");
      rrect(ctx, -7, -1, 14, 8.5, 1.6);
      ctx.fill();
      edge(ctx, "#74A9C6");
      ctx.fillStyle = "#F6B6CD";
      rrect(ctx, -7, -1, 14, 2.4, 1.2);
      ctx.fill();
      gleam(ctx, -4.4, 3.6, 1.4, 1);
      break;
    }
    case "dust": {
      // 扫起来的尘土:软软一小丘 + 三粒小点(灰紫粉彩,不搞脏)
      ctx.fillStyle = grad2(ctx, -8, -2, 7, 8, "#DCD6E4", "#B9B0C6");
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.quadraticCurveTo(-6.5, -0.5, -2.5, -1.5);
      ctx.quadraticCurveTo(0, -4.5, 3, -2);
      ctx.quadraticCurveTo(7, -1.5, 8, 7);
      ctx.closePath();
      ctx.fill();
      edge(ctx, "#948AA6");
      ctx.fillStyle = "#948AA6";
      ctx.beginPath();
      ctx.arc(-3.4, 3.4, 0.8, 0, Math.PI * 2);
      ctx.arc(0.6, 1.4, 0.7, 0, Math.PI * 2);
      ctx.arc(3.8, 4, 0.8, 0, Math.PI * 2);
      ctx.fill();
      gleam(ctx, -2.6, 0.4, 1.4, 0.9);
      break;
    }
    default: {
      // 兜底:中性小圆石(理论到不了)
      ctx.fillStyle = grad2(ctx, -5, -5, 5, 6, "#E4DFE8", "#BDB4C8");
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      edge(ctx, "#968CA8");
      gleam(ctx, -2.2, -2.4, 1.4, 1);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 三色分类桶的功能图标:顶替裸 info.emoji(♻️/🥬/🗑️)
// ---------------------------------------------------------------------------

/**
 * 桶面功能图标(白色图形 + 桶色深描边,像交通标识一样一眼可辨):
 *  - recycle 可回收:三段追逐箭头围成的循环环;
 *  - kitchen 厨余:一片带叶脉的小菜叶;
 *  - other 其他:一只扎好口的小垃圾袋。
 * r 是图标外接半径,baseColor 传桶身色,内部细节用它的深阶,保证同桶同色系。
 */
export function drawBinIcon(
  ctx: CanvasRenderingContext2D,
  kind: "recycle" | "kitchen" | "other",
  x: number,
  y: number,
  r: number,
  baseColor: string
): void {
  const deep = shade(baseColor, -42);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "recycle") {
    // 三段追逐箭头:弧 + 箭头小三角,120° 一组转三组
    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(1.5, r * 0.3);
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate((k * 2 * Math.PI) / 3);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, -Math.PI * 0.42, Math.PI * 0.18);
      ctx.stroke();
      // 弧末端的箭头
      const ea = Math.PI * 0.18;
      const ex = Math.cos(ea) * r * 0.68;
      const ey = Math.sin(ea) * r * 0.68;
      ctx.beginPath();
      ctx.moveTo(ex + r * 0.3, ey - r * 0.02);
      ctx.lineTo(ex - r * 0.26, ey + r * 0.3);
      ctx.lineTo(ex - r * 0.26, ey - r * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (kind === "kitchen") {
    // 小菜叶:白叶身 + 深绿叶脉
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.4, r * 0.6, r * 0.5);
    ctx.quadraticCurveTo(r * 0.34, r, 0, r);
    ctx.quadraticCurveTo(-r * 0.34, r, -r * 0.6, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.4, 0, -r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.lineTo(0, r * 0.85);
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.36, r * 0.34);
    ctx.moveTo(0, -r * 0.3);
    ctx.lineTo(r * 0.36, 0);
    ctx.stroke();
  } else {
    // 小垃圾袋:袋身 + 扎口双耳
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.05, -r * 0.78, r * 0.55);
    ctx.quadraticCurveTo(-r * 0.6, r, 0, r);
    ctx.quadraticCurveTo(r * 0.6, r, r * 0.78, r * 0.55);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.05, r * 0.24, -r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
    // 扎口的两只小耳朵
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.5, -r, -r * 0.12, -r * 0.66);
    ctx.moveTo(r * 0.24, -r * 0.42);
    ctx.quadraticCurveTo(r * 0.5, -r, r * 0.12, -r * 0.66);
    ctx.stroke();
    // 袋身一道褶
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.2);
    ctx.quadraticCurveTo(0, r * 0.42, r * 0.3, r * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 场内小装饰与反馈图形:顶替 💫 🫧 ⭐ 🤔 🧽 🧼 🔒 与粒子 emoji 文本
// ---------------------------------------------------------------------------

/** 金色小星(投对 / 捡星反馈):两停渐变 + 描边,比香香星轻一号(无柔光圈) */
export function drawMiniStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  const body = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.08, x, y, r);
  body.addColorStop(0, "#FFF3C2");
  body.addColorStop(1, "#F2B93E");
  ctx.fillStyle = body;
  traceStar(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = "#C9931E";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.stroke();
  ctx.restore();
}

/** 想一想气泡(投错的温柔提示):白气泡 + 自绘问号(弧 + 点),零责备感 */
export function drawThinkBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#B9A6D6";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  // 气泡小尾巴:两颗渐小的点
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.8, y + r * 0.9, r * 0.22, 0, Math.PI * 2);
  ctx.arc(x - r * 1.15, y + r * 1.3, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 自绘问号:上弯钩 + 下圆点
  ctx.strokeStyle = "#8A6FB8";
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.24, r * 0.34, Math.PI * 0.95, Math.PI * 2.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(Math.PI * 0.22) * r * 0.34, y - r * 0.24 + Math.sin(Math.PI * 0.22) * r * 0.34);
  ctx.quadraticCurveTo(x + r * 0.08, y + r * 0.1, x, y + r * 0.2);
  ctx.stroke();
  ctx.fillStyle = "#8A6FB8";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.56, Math.max(1, r * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 清洁海绵(清洁车顶):双层软块 + 三个小气孔 */
export function drawSponge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const u = s / 15;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = grad2(ctx, -7 * u, -5 * u, 7 * u, 5 * u, "#FFEFAE", "#F3D96E");
  rrect(ctx, -7 * u, -2 * u, 14 * u, 7 * u, 2.4 * u);
  ctx.fill();
  ctx.strokeStyle = "#C9AE42";
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.stroke();
  ctx.fillStyle = grad2(ctx, -7 * u, -6 * u, 7 * u, -1 * u, "#BFE6F2", "#8FCBE0");
  rrect(ctx, -7 * u, -6 * u, 14 * u, 4.4 * u, 2 * u);
  ctx.fill();
  ctx.strokeStyle = "#5F9DB8";
  ctx.stroke();
  ctx.fillStyle = "rgba(160,130,60,.4)";
  ctx.beginPath();
  ctx.arc(-3.4 * u, 2 * u, 0.8 * u, 0, Math.PI * 2);
  ctx.arc(0.6 * u, 1 * u, 0.7 * u, 0, Math.PI * 2);
  ctx.arc(4 * u, 2.6 * u, 0.8 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 香皂(净化门开):粉皂体 + 环纹 + 两颗小泡泡 */
export function drawSoap(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const u = s / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = grad2(ctx, -10 * u, -7 * u, 10 * u, 7 * u, "#FBD3E0", "#F0A2BE");
  ctx.beginPath();
  ctx.ellipse(0, 0, 10 * u, 6.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#CC7396";
  ctx.lineWidth = Math.max(1.2, 1.6 * u);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.4 * u, 3.6 * u, 0, Math.PI * 0.15, Math.PI * 0.9);
  ctx.stroke();
  gleam(ctx, -3.4 * u, -2.6 * u, 2.2 * u, 1.2 * u);
  // 小泡泡
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.arc(8.4 * u, -7 * u, 2 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(11.4 * u, -3.6 * u, 1.2 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 小挂锁(净化门未开):锁体渐变 + 锁梁 + 锁孔 */
export function drawPadlock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const u = s / 24;
  ctx.save();
  ctx.translate(x, y);
  // 锁梁
  ctx.strokeStyle = "#9A8C7A";
  ctx.lineWidth = Math.max(1.6, 2.4 * u);
  ctx.beginPath();
  ctx.arc(0, -4 * u, 5.4 * u, Math.PI, 0);
  ctx.stroke();
  // 锁体
  ctx.fillStyle = grad2(ctx, -8 * u, -4 * u, 8 * u, 10 * u, "#F3CC7C", "#D9A23E");
  rrect(ctx, -8 * u, -4 * u, 16 * u, 13 * u, 3.2 * u);
  ctx.fill();
  ctx.strokeStyle = "#A97B24";
  ctx.lineWidth = Math.max(1.2, 1.6 * u);
  ctx.stroke();
  // 锁孔
  ctx.fillStyle = "#8A6A2C";
  ctx.beginPath();
  ctx.arc(0, 1 * u, 1.8 * u, 0, Math.PI * 2);
  ctx.fill();
  rrect(ctx, -0.9 * u, 1 * u, 1.8 * u, 4 * u, 0.9 * u);
  ctx.fill();
  gleam(ctx, -4 * u, -1.6 * u, 1.6 * u, 1 * u);
  ctx.restore();
}

/** 小气泡(移动平台顶):透明泡身 + 左上高光弧 */
export function drawBubbleDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, "rgba(255,255,255,.75)");
  body.addColorStop(1, "rgba(190,226,244,.35)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,180,210,.7)";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, Math.PI * 0.95, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();
}

/** 晕圈小旋星(灰尘印装饰 / 碰一下的软反馈):一圈弧 + 一颗小星 */
export function drawSwirl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(200,186,220,.9)";
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.85, Math.PI * 0.2, Math.PI * 1.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, Math.PI * 1.2, Math.PI * 2.4);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  traceStar(ctx, x + r * 0.7, y - r * 0.7, r * 0.4);
  ctx.fill();
  ctx.restore();
}

/** 迷你蘑菇(踩弹簧的粒子):粉帽 + 白柄,和场上的弹簧蘑菇同族 */
export function drawMiniMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const u = s / 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#FFF3E4";
  rrect(ctx, -2.6 * u, -1 * u, 5.2 * u, 6 * u, 2 * u);
  ctx.fill();
  ctx.strokeStyle = "#D9B48A";
  ctx.lineWidth = Math.max(1, 1.1 * u);
  ctx.stroke();
  ctx.fillStyle = grad2(ctx, -7 * u, -7 * u, 7 * u, 0, "#F9A9C4", "#F58FB0");
  ctx.beginPath();
  ctx.ellipse(0, -1 * u, 7 * u, 4.6 * u, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#CC6D92";
  ctx.stroke();
  ctx.fillStyle = "#FFE3EC";
  ctx.beginPath();
  ctx.arc(-2.6 * u, -3 * u, 1.1 * u, 0, Math.PI * 2);
  ctx.arc(2.4 * u, -3.8 * u, 0.9 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 事件粒子的自绘字形集:顶替原来 PARTICLE_FOR_EVENT 里的 emoji 文本 */
export type ParticleGlyph = "flower" | "star" | "spark" | "swirl" | "mushroom" | "bubble";

/**
 * 画一颗事件粒子(透明度由调用方的 globalAlpha 控):
 * flower=五瓣花 / star=金星 / spark=白闪星 / swirl=晕圈 / mushroom=迷你蘑菇 / bubble=小气泡。
 */
export function drawParticleGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: ParticleGlyph,
  x: number,
  y: number,
  s: number
): void {
  const r = s / 2;
  if (glyph === "flower") {
    drawFlower(ctx, x, y, r, 0);
  } else if (glyph === "star") {
    drawMiniStar(ctx, x, y, r);
  } else if (glyph === "spark") {
    ctx.fillStyle = "rgba(255,255,255,.95)";
    traceStar(ctx, x, y, r);
    ctx.fill();
    ctx.fillStyle = "rgba(255,244,200,.9)";
    traceStar(ctx, x, y, r * 0.45);
    ctx.fill();
  } else if (glyph === "swirl") {
    drawSwirl(ctx, x, y, r);
  } else if (glyph === "mushroom") {
    drawMiniMushroom(ctx, x, y, s);
  } else {
    drawBubbleDot(ctx, x, y, r * 0.8);
  }
}
