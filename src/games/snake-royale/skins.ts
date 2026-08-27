/**
 * 长蛇争霸 · 皮肤表(纯数据 + 纯函数)。
 * 全部是本作原创配色,按战役星数解锁,只存进本游戏自己的进度字段,
 * 不改任何平台存档 key 的语义。
 */

export interface Skin {
  id: string;
  name: string;
  /** 身体循环用的颜色,至少两色才有花纹 */
  colors: string[];
  /** 花纹画法 */
  pattern: "solid" | "stripe" | "dot" | "rainbow";
  /** 解锁需要的战役星数 */
  needStars: number;
  desc: string;
}

export const SKINS: Skin[] = [
  { id: "mint", name: "薄荷糖", colors: ["#8FD9A8", "#BFEFCB"], pattern: "solid", needStars: 0, desc: "出生就带着的清爽绿,谁都能用。" },
  { id: "peach", name: "水蜜桃", colors: ["#F7B8CE", "#FBD9E4"], pattern: "solid", needStars: 12, desc: "粉嘟嘟的一条,远远就认得出。" },
  { id: "stripe", name: "条纹卷", colors: ["#F8D98C", "#F5A97F"], pattern: "stripe", needStars: 40, desc: "一节黄一节橙,像卷起来的糖纸。" },
  { id: "dot", name: "点点豆", colors: ["#A9C8F5", "#EDF3FF"], pattern: "dot", needStars: 80, desc: "身上一路小圆点,转弯时特别好看。" },
  { id: "grape", name: "紫葡萄", colors: ["#C4A9F0", "#E4D7FB"], pattern: "stripe", needStars: 130, desc: "深紫配浅紫,夜色关里很显眼。" },
  { id: "cocoa", name: "可可豆", colors: ["#C89E7B", "#EBD6C1"], pattern: "dot", needStars: 190, desc: "暖乎乎的奶咖色,稳重派专用。" },
  { id: "soda", name: "汽水泡", colors: ["#9BE3E0", "#D8F7F5", "#BFE7F5"], pattern: "rainbow", needStars: 260, desc: "三色渐变,游起来像一串气泡。" },
  { id: "candy", name: "彩虹糖", colors: ["#F5A9C8", "#F8D98C", "#A9E5B0", "#A9C8F5", "#C4A9F0"], pattern: "rainbow", needStars: 340, desc: "五种颜色轮着来,长起来最抢眼。" },
  { id: "moss", name: "青苔道", colors: ["#8FBF7A", "#C8E3A8"], pattern: "stripe", needStars: 420, desc: "草地关的保护色,悄悄绕到对手前面。" },
  { id: "star", name: "小星子", colors: ["#FFE7A8", "#FFF6D8", "#FFD98F"], pattern: "dot", needStars: 500, desc: "满身小星星,长蛇杯冠军的样子。" }
];

/** 解锁了哪些皮肤 */
export function unlockedSkins(stars: number): Skin[] {
  const s = Number.isFinite(stars) ? Math.max(0, stars) : 0;
  return SKINS.filter((k) => k.needStars <= s);
}

/** 这套皮肤解锁了没有 */
export function isUnlocked(skinId: string, stars: number): boolean {
  return unlockedSkins(stars).some((k) => k.id === skinId);
}

/** 取一套皮肤,没解锁或者找不到就退回第一套 */
export function skinById(skinId: string | null | undefined, stars = Number.MAX_SAFE_INTEGER): Skin {
  const found = SKINS.find((k) => k.id === skinId);
  if (found && isUnlocked(found.id, stars)) return found;
  return SKINS[0];
}

/** 第 i 个节点该用哪个颜色 */
export function nodeColor(skin: Skin, index: number): string {
  const cs = skin.colors.length > 0 ? skin.colors : ["#8FD9A8"];
  const i = Math.max(0, Math.round(Number.isFinite(index) ? index : 0));
  switch (skin.pattern) {
    case "stripe":
      return cs[Math.floor(i / 3) % cs.length];
    case "dot":
      return i % 4 === 0 ? cs[1 % cs.length] : cs[0];
    case "rainbow":
      return cs[i % cs.length];
    default:
      return cs[0];
  }
}

/** 下一套还没解锁的皮肤,给 HUD 写「再拿 N 颗星」 */
export function nextSkinHint(stars: number): string {
  const s = Number.isFinite(stars) ? Math.max(0, stars) : 0;
  const next = SKINS.find((k) => k.needStars > s);
  if (!next) return "所有皮肤都解锁啦,随便挑一套去比赛吧！";
  return `再拿 ${next.needStars - s} 颗星就能解锁「${next.name}」。`;
}

/**
 * 皮肤选择存在本游戏自己的 key 里,平台那几个 key 的语义一个都不动。
 */
export const SKIN_KEY = "yiduo-yixing.snake-royale.skin.v1";

/** 读存下来的皮肤:坏数据、没解锁的一律退回第一套 */
export function parseSkinChoice(raw: string | null | undefined, stars: number): Skin {
  if (typeof raw !== "string" || raw.length === 0) return SKINS[0];
  return skinById(raw.trim(), stars);
}

/** 写进存档的字符串 */
export function serializeSkinChoice(skin: Skin | string): string {
  return typeof skin === "string" ? skin : skin.id;
}

/** 给 AI 分配颜色时用的一串原创配色 */
export const BOT_COLORS = [
  "#F7B8CE",
  "#A9C8F5",
  "#F8D98C",
  "#C4A9F0",
  "#9BE3E0",
  "#F5C2A8",
  "#BFE7B0",
  "#EEC9E8",
  "#C8DFF7"
];
