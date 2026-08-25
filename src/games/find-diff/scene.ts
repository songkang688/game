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

export type Scene = {
  name: string;
  emoji: string;
  diffs: DiffSpot[];
  markup: (side: "left" | "right") => string;
};

function sunRays(cx: number, cy: number): string {
  return [0, 45, 90, 135, 180, 225, 270, 315]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * 32;
      const y1 = cy + Math.sin(rad) * 32;
      const x2 = cx + Math.cos(rad) * 42;
      const y2 = cy + Math.sin(rad) * 42;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f5b301" stroke-width="5" stroke-linecap="round"/>`;
    })
    .join("");
}

/** 场景一：阳光小屋 */
function houseMarkup(side: "left" | "right"): string {
  const rays = side === "left" ? sunRays(300, 55) : "";
  const doorColor = side === "left" ? "#e5533d" : "#4d8af0";
  const middleFlower = side === "left" ? `<text x="52" y="246" font-size="26" text-anchor="middle">🌼</text>` : "";
  const cloud =
    side === "left"
      ? `<ellipse cx="90" cy="42" rx="34" ry="15" fill="#ffffff"/>`
      : `<ellipse cx="90" cy="42" rx="20" ry="10" fill="#ffffff"/>`;
  const windowShape =
    side === "left"
      ? `<circle cx="84" cy="146" r="11" fill="#bde0fe" stroke="#7aa7d9" stroke-width="3"/>`
      : `<rect x="73" y="135" width="22" height="22" rx="3" fill="#bde0fe" stroke="#7aa7d9" stroke-width="3"/>`;

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="#eaf7ff"/>
    <rect x="0" y="210" width="${VIEW_W}" height="70" fill="#b9e8b0"/>
    ${cloud}
    ${rays}
    <circle cx="300" cy="55" r="26" fill="#ffd93b" stroke="#f5b301" stroke-width="3"/>
    <polygon points="50,122 190,122 120,62" fill="#ff9f7a" stroke="#c66a4a" stroke-width="3"/>
    <rect x="60" y="122" width="120" height="88" fill="#fff3d6" stroke="#c9a86b" stroke-width="3"/>
    ${windowShape}
    <rect x="105" y="158" width="32" height="52" rx="4" fill="${doorColor}" stroke="#8c5a3c" stroke-width="3"/>
    <rect x="232" y="150" width="16" height="62" rx="4" fill="#a9744f"/>
    <circle cx="240" cy="136" r="34" fill="#7ccf7c" stroke="#57a95c" stroke-width="3"/>
    <text x="188" y="262" font-size="30" text-anchor="middle">🐱</text>
    <text x="26" y="266" font-size="26" text-anchor="middle">🌼</text>
    ${middleFlower}
    <text x="80" y="268" font-size="26" text-anchor="middle">🌼</text>
  `;
}

/** 场景二：海边沙滩 */
function beachMarkup(side: "left" | "right"): string {
  const sailColor = side === "left" ? "#ff8787" : "#8ce99a";
  const umbrellaColor = side === "left" ? "#ff922b" : "#b197fc";
  const crab = side === "left" ? `<text x="60" y="256" font-size="26" text-anchor="middle">🦀</text>` : "";
  const extraGull =
    side === "left"
      ? `<path d="M165,45 q7,-8 15,0 q7,-8 15,0" fill="none" stroke="#495057" stroke-width="3" stroke-linecap="round"/>`
      : "";
  const bucketColor = side === "left" ? "#ffd43b" : "#faa2c1";

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="170" fill="#d0f0ff"/>
    <rect x="0" y="170" width="${VIEW_W}" height="50" fill="#74c0fc"/>
    <rect x="0" y="220" width="${VIEW_W}" height="60" fill="#ffe8b0"/>
    <circle cx="40" cy="40" r="22" fill="#ffd93b" stroke="#f5b301" stroke-width="3"/>
    <path d="M95,70 q7,-8 15,0 q7,-8 15,0" fill="none" stroke="#495057" stroke-width="3" stroke-linecap="round"/>
    ${extraGull}
    <polygon points="250,150 310,150 300,165 260,165" fill="#c08552" stroke="#8c5a3c" stroke-width="3"/>
    <line x1="280" y1="90" x2="280" y2="150" stroke="#8c5a3c" stroke-width="4"/>
    <polygon points="280,95 280,145 243,145" fill="${sailColor}" stroke="#8c5a3c" stroke-width="3"/>
    <path d="M70,130 a40,40 0 0 1 80,0 z" fill="${umbrellaColor}" stroke="#8c5a3c" stroke-width="3"/>
    <line x1="110" y1="130" x2="110" y2="195" stroke="#8c5a3c" stroke-width="5"/>
    <text x="150" y="264" font-size="26" text-anchor="middle">⭐</text>
    <rect x="290" y="235" width="26" height="24" rx="4" fill="${bucketColor}" stroke="#c9a86b" stroke-width="3"/>
    ${crab}
  `;
}

/** 场景三：晚安公园 */
function nightMarkup(side: "left" | "right"): string {
  const moon =
    side === "left"
      ? `<circle cx="300" cy="50" r="22" fill="#ffe066"/>`
      : `<circle cx="300" cy="50" r="22" fill="#ffe066"/><circle cx="310" cy="44" r="18" fill="#1b2a5e"/>`;
  const extraStar = side === "left" ? `<text x="180" y="66" font-size="18" text-anchor="middle">⭐</text>` : "";
  const lampGlow = side === "left" ? "#ffe066" : "#adb5bd";
  const benchColor = side === "left" ? "#c08552" : "#74c0fc";
  const bunny = side === "left" ? `<text x="290" y="250" font-size="26" text-anchor="middle">🐰</text>` : "";

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="220" fill="#1b2a5e"/>
    <rect x="0" y="220" width="${VIEW_W}" height="60" fill="#2b6e33"/>
    ${moon}
    ${extraStar}
    <text x="60" y="50" font-size="14" text-anchor="middle">⭐</text>
    <text x="130" y="34" font-size="14" text-anchor="middle">⭐</text>
    <text x="240" y="80" font-size="14" text-anchor="middle">⭐</text>
    <rect x="60" y="120" width="8" height="105" fill="#495057"/>
    <circle cx="64" cy="115" r="13" fill="${lampGlow}" stroke="#495057" stroke-width="3"/>
    <circle cx="140" cy="165" r="38" fill="#2f6b39" stroke="#1e4a26" stroke-width="3"/>
    <rect x="132" y="196" width="16" height="30" rx="4" fill="#5c4033"/>
    <rect x="185" y="215" width="76" height="10" rx="4" fill="${benchColor}"/>
    <rect x="190" y="225" width="8" height="18" fill="#5c4033"/>
    <rect x="248" y="225" width="8" height="18" fill="#5c4033"/>
    <text x="40" y="260" font-size="18" text-anchor="middle">✨</text>
    ${bunny}
  `;
}

/** 场景四：快乐农场 */
function farmMarkup(side: "left" | "right"): string {
  const skyThing =
    side === "left"
      ? `<circle cx="40" cy="45" r="20" fill="#ffd93b" stroke="#f5b301" stroke-width="3"/>`
      : `<ellipse cx="40" cy="45" rx="26" ry="13" fill="#ffffff"/>`;
  const doorColor = side === "left" ? "#8c5a3c" : "#343a40";
  const cow = side === "left" ? `<text x="260" y="255" font-size="30" text-anchor="middle">🐮</text>` : "";
  const hay =
    side === "left"
      ? `<path d="M290,200 a30,30 0 0 1 60,0 z" fill="#ffd43b" stroke="#e0a800" stroke-width="3"/>`
      : `<path d="M300,200 a20,20 0 0 1 40,0 z" fill="#ffd43b" stroke="#e0a800" stroke-width="3"/>`;
  const midPlank = side === "left" ? `<rect x="218" y="185" width="8" height="28" rx="2" fill="#c9a86b"/>` : "";

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="180" fill="#d0f0ff"/>
    <rect x="0" y="180" width="${VIEW_W}" height="100" fill="#b9e8b0"/>
    ${skyThing}
    <polygon points="50,112 170,112 110,60" fill="#c92a2a" stroke="#7a1c1c" stroke-width="3"/>
    <rect x="60" y="112" width="100" height="78" fill="#ff8787" stroke="#c92a2a" stroke-width="3"/>
    <rect x="95" y="150" width="30" height="40" rx="4" fill="${doorColor}" stroke="#5c4033" stroke-width="3"/>
    <line x1="180" y1="190" x2="260" y2="190" stroke="#c9a86b" stroke-width="6"/>
    <line x1="180" y1="208" x2="260" y2="208" stroke="#c9a86b" stroke-width="6"/>
    <rect x="184" y="185" width="8" height="28" rx="2" fill="#c9a86b"/>
    ${midPlank}
    <rect x="250" y="185" width="8" height="28" rx="2" fill="#c9a86b"/>
    ${hay}
    <text x="180" y="258" font-size="26" text-anchor="middle">🐔</text>
    ${cow}
  `;
}

/** 场景五：气球节 */
function balloonMarkup(side: "left" | "right"): string {
  const balloonColor = side === "left" ? "#ff8787" : "#74c0fc";
  const flag = side === "left" ? `<polygon points="112,124 128,129 112,134" fill="#e8590c"/>` : "";
  const bird = side === "left" ? `<text x="250" y="66" font-size="24" text-anchor="middle">🐦</text>` : "";
  const rainbow =
    side === "left"
      ? `<path d="M258,130 a44,44 0 0 1 88,0" fill="none" stroke="#ff8787" stroke-width="7"/>
         <path d="M266,130 a36,36 0 0 1 72,0" fill="none" stroke="#ffd43b" stroke-width="7"/>
         <path d="M274,130 a28,28 0 0 1 56,0" fill="none" stroke="#8ce99a" stroke-width="7"/>`
      : "";
  const kiteColor = side === "left" ? "#ffd43b" : "#8ce99a";

  return `
    <rect x="0" y="0" width="${VIEW_W}" height="230" fill="#d0f0ff"/>
    <rect x="0" y="230" width="${VIEW_W}" height="50" fill="#b9e8b0"/>
    <ellipse cx="310" cy="40" rx="30" ry="13" fill="#ffffff"/>
    ${rainbow}
    <circle cx="100" cy="80" r="40" fill="${balloonColor}" stroke="#c92a2a" stroke-width="3"/>
    <line x1="80" y1="112" x2="90" y2="132" stroke="#8c5a3c" stroke-width="3"/>
    <line x1="120" y1="112" x2="110" y2="132" stroke="#8c5a3c" stroke-width="3"/>
    <rect x="86" y="132" width="28" height="18" rx="4" fill="#c08552" stroke="#8c5a3c" stroke-width="3"/>
    ${flag}
    ${bird}
    <polygon points="200,160 216,180 200,200 184,180" fill="${kiteColor}" stroke="#e0a800" stroke-width="3"/>
    <path d="M200,200 q10,20 -6,36" fill="none" stroke="#868e96" stroke-width="3"/>
    <text x="60" y="258" font-size="24" text-anchor="middle">🌳</text>
    <text x="320" y="262" font-size="24" text-anchor="middle">🌷</text>
  `;
}

export const SCENES: Scene[] = [
  {
    name: "阳光小屋",
    emoji: "🏡",
    markup: houseMarkup,
    diffs: [
      { id: "sun", x: 300, y: 55, r: 46, label: "太阳的光芒" },
      { id: "door", x: 121, y: 186, r: 30, label: "门的颜色" },
      { id: "flower", x: 52, y: 234, r: 32, label: "一朵小花" },
      { id: "cloud", x: 90, y: 42, r: 38, label: "云朵的大小" },
      { id: "window", x: 84, y: 144, r: 20, label: "窗户的形状" },
    ],
  },
  {
    name: "海边沙滩",
    emoji: "🏖️",
    markup: beachMarkup,
    diffs: [
      { id: "sail", x: 268, y: 122, r: 40, label: "帆船的帆" },
      { id: "umbrella", x: 110, y: 118, r: 44, label: "遮阳伞的颜色" },
      { id: "crab", x: 60, y: 246, r: 30, label: "小螃蟹" },
      { id: "gull", x: 180, y: 42, r: 26, label: "多出的海鸥" },
      { id: "bucket", x: 303, y: 247, r: 28, label: "小桶的颜色" },
    ],
  },
  {
    name: "晚安公园",
    emoji: "🌙",
    markup: nightMarkup,
    diffs: [
      { id: "moon", x: 300, y: 50, r: 34, label: "月亮的形状" },
      { id: "star", x: 180, y: 58, r: 24, label: "多出的星星" },
      { id: "lamp", x: 64, y: 115, r: 30, label: "路灯亮没亮" },
      { id: "bench", x: 222, y: 222, r: 38, label: "长椅的颜色" },
      { id: "bunny", x: 290, y: 240, r: 28, label: "小兔子" },
    ],
  },
  {
    name: "快乐农场",
    emoji: "🚜",
    markup: farmMarkup,
    diffs: [
      { id: "sky", x: 40, y: 45, r: 34, label: "太阳还是云朵" },
      { id: "barndoor", x: 110, y: 170, r: 32, label: "谷仓的门" },
      { id: "plank", x: 222, y: 199, r: 26, label: "栅栏的木条" },
      { id: "hay", x: 320, y: 192, r: 34, label: "干草堆的大小" },
      { id: "cow", x: 260, y: 245, r: 28, label: "小奶牛" },
    ],
  },
  {
    name: "气球节",
    emoji: "🎈",
    markup: balloonMarkup,
    diffs: [
      { id: "balloon", x: 100, y: 78, r: 38, label: "大气球的颜色" },
      { id: "flag", x: 122, y: 131, r: 14, label: "篮子上的小旗" },
      { id: "bird", x: 250, y: 58, r: 28, label: "小鸟" },
      { id: "rainbow", x: 302, y: 108, r: 42, label: "彩虹" },
      { id: "kite", x: 200, y: 180, r: 30, label: "风筝的颜色" },
    ],
  },
];

// 兼容旧接口：默认场景即第一幅
export const DIFFS: DiffSpot[] = SCENES[0].diffs;
export function sceneMarkup(side: "left" | "right"): string {
  return SCENES[0].markup(side);
}
