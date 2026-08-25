// 找不同：场景数据与绘制（纯函数，方便测试）

export const VIEW_W = 360;
export const VIEW_H = 280;

export type DiffSpot = {
  id: string;
  /** 热区圆心（viewBox 坐标） */
  x: number;
  y: number;
  /** 热区半径 */
  r: number;
  /** 找到后给孩子看的说明 */
  label: string;
};

export const DIFFS: DiffSpot[] = [
  { id: "sun", x: 300, y: 55, r: 46, label: "太阳的光芒" },
  { id: "door", x: 121, y: 184, r: 38, label: "门的颜色" },
  { id: "flower", x: 52, y: 234, r: 32, label: "一朵小花" },
];

/**
 * 生成一侧图画的 SVG 内部标记。两侧只有 3 处不同：
 * 1. 左边的太阳有光芒，右边没有
 * 2. 左边的门是红色，右边是蓝色
 * 3. 左边有 3 朵小花，右边少了中间那朵
 */
export function sceneMarkup(side: "left" | "right"): string {
  const rays =
    side === "left"
      ? [0, 45, 90, 135, 180, 225, 270, 315]
          .map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 300 + Math.cos(rad) * 32;
            const y1 = 55 + Math.sin(rad) * 32;
            const x2 = 300 + Math.cos(rad) * 42;
            const y2 = 55 + Math.sin(rad) * 42;
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f5b301" stroke-width="5" stroke-linecap="round"/>`;
          })
          .join("")
      : "";
  const doorColor = side === "left" ? "#e5533d" : "#4d8af0";
  const middleFlower = side === "left" ? `<text x="52" y="246" font-size="26" text-anchor="middle">🌼</text>` : "";

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="#eaf7ff"/>
    <rect x="0" y="210" width="${VIEW_W}" height="70" fill="#b9e8b0"/>
    <ellipse cx="90" cy="42" rx="34" ry="15" fill="#ffffff"/>
    ${rays}
    <circle cx="300" cy="55" r="26" fill="#ffd93b" stroke="#f5b301" stroke-width="3"/>
    <polygon points="50,122 190,122 120,62" fill="#ff9f7a" stroke="#c66a4a" stroke-width="3"/>
    <rect x="60" y="122" width="120" height="88" fill="#fff3d6" stroke="#c9a86b" stroke-width="3"/>
    <circle cx="84" cy="146" r="11" fill="#bde0fe" stroke="#7aa7d9" stroke-width="3"/>
    <rect x="105" y="158" width="32" height="52" rx="4" fill="${doorColor}" stroke="#8c5a3c" stroke-width="3"/>
    <rect x="232" y="150" width="16" height="62" rx="4" fill="#a9744f"/>
    <circle cx="240" cy="136" r="34" fill="#7ccf7c" stroke="#57a95c" stroke-width="3"/>
    <text x="188" y="262" font-size="30" text-anchor="middle">🐱</text>
    <text x="26" y="266" font-size="26" text-anchor="middle">🌼</text>
    ${middleFlower}
    <text x="80" y="268" font-size="26" text-anchor="middle">🌼</text>
  `;
}
