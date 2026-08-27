/**
 * 教具贴纸图集（stickers.ts）契约用例——W8R1-01/02/03 修复的公共底座。
 *
 * 钉四件事：
 *  ① 覆盖率：math-farm 数一数 18 种、word-garden 全部字卡配图与数一数小物、
 *    kitty-care 喂饭/逗猫道具，一张不缺（缺了就是裸 emoji 直出回归）；
 *  ② 工序：每张贴纸都有描边、白色高光、暗部分面，无 NaN、无 <defs>/id（同页多铺不撞 id）；
 *  ③ 纯函数：同参数同输出；非法尺寸夹回；查不到返回 null 绝不抛错；
 *  ④ VS16 归一：☂️（带变体符）与 ☂ 查到同一张贴纸。
 */
import { describe, expect, it } from "vitest";
import { STICKER_EMOJIS, hasSticker, normalizeEmoji, sticker, stickerName, stickerOutline } from "./stickers";

/** math-farm levels.ts 的 COUNT_EMOJIS（6 章 × 3 种，题目数据只读不改，这里点名对账） */
const FARM_COUNT = ["🐮", "🐑", "🐷", "🍎", "🍐", "🍊", "🦆", "🐸", "🐟", "🌾", "🌻", "🐝", "⭐", "🌟", "✨", "🌙", "🦉", "🍄"];

/** word-garden 全部字卡 emoji（logic.ts 三座花园 + levels.ts 数字/亲亲/美味花园）+ 数一数 COUNT_THINGS */
const GARDEN_ALL = [
  "☀️", "🌙", "💧", "🔥", "⛰️", "🌾", "🌳", "🌸", "☁️", "🌧️", "❄️", "⭐", "⚡", "🌬️", "🌤️", "🍃", "🌱", "🎋",
  "🐦", "🐟", "🐛", "🐮", "🐑", "🐴", "🐶", "🐱", "🐰", "🐷", "🐔", "🦆", "🐢", "🐻", "🐘", "🐯", "🐸", "🦢",
  "✋", "👄", "👂", "👀", "🦶", "🦷", "❤️", "🧍", "🚪", "🚗", "⛵", "☂️", "📖", "✏️", "💡", "⚽", "🍎", "🍚",
  "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
  "👨", "👩", "👴", "👵", "👦", "👧", "🧒", "👶", "🙋", "🤝", "🏠", "💖", "😄", "👍", "🍼", "🥰",
  "🍉", "🫘", "🥬", "🥚", "🍖", "🍵", "🍬", "🍜", "🍞", "🍑", "🍐", "🍊", "🍲", "🦐", "🍪",
  "🌷", "🌻", "🍀", "🦋", "🐞"
];

/** kitty-care 喂饭九种食物 + 饭碗 + 逗猫羽毛棒 + 爪印 */
const KITTY_PROPS = ["🐟", "🥛", "🍗", "🍤", "🥩", "🧀", "🍋", "🥦", "🥬", "🥣", "🪶", "🐾"];

describe("贴纸覆盖率（W8R1-01/02/03 的对账清单）", () => {
  it("math-farm 数一数 18 种计数物全部有贴纸", () => {
    expect(FARM_COUNT.filter((e) => !hasSticker(e))).toEqual([]);
  });

  it("word-garden 全部字卡配图 + 数一数小物全部有贴纸", () => {
    expect(GARDEN_ALL.filter((e) => !hasSticker(e))).toEqual([]);
  });

  it("kitty-care 喂饭/逗猫道具全部有贴纸", () => {
    expect(KITTY_PROPS.filter((e) => !hasSticker(e))).toEqual([]);
  });

  it("图集不空且每张都有中文名（aria 文案）", () => {
    expect(STICKER_EMOJIS.length).toBeGreaterThanOrEqual(100);
    for (const e of STICKER_EMOJIS) {
      const name = stickerName(e);
      expect(name, e).toBeTruthy();
      expect(name!.length).toBeGreaterThan(0);
    }
  });
});

describe("贴纸工序（沿 crops.ts 规格）", () => {
  it("每张：完整 <svg>、data-sticker、描边、白高光、暗部分面、无 NaN", () => {
    for (const e of STICKER_EMOJIS) {
      const s = sticker(e, 32);
      expect(s, e).toBeTruthy();
      expect(s!.startsWith("<svg "), e).toBe(true);
      expect(s!.endsWith("</svg>"), e).toBe(true);
      // data-sticker 放中文名不放 emoji：贴纸的输出里一个裸 emoji 字符都不许有
      expect(s, e).toContain(`data-sticker="${stickerName(e)}"`);
      expect(/\p{Extended_Pictographic}/u.test(s!), e).toBe(false);
      expect(s, e).toContain('aria-hidden="true"');
      expect(s, e).toContain("stroke=");
      // 白高光 / 白色亮部（高光斑或眼白）
      expect(/#ffffff|#fff\b/i.test(s!), e).toBe(true);
      // 暗部分面 / 半透明层
      expect(s, e).toContain("opacity=");
      expect(/NaN|undefined/.test(s!), e).toBe(false);
    }
  });

  it("不含 <defs> 与 id=：同页重复铺几十枚不撞 id", () => {
    for (const e of STICKER_EMOJIS) {
      const s = sticker(e, 32)!;
      expect(s, e).not.toContain("<defs");
      expect(s, e).not.toContain(" id=");
    }
  });

  it("描边色推导：主色向黑压 45%", () => {
    expect(stickerOutline("#ffd93d")).toBe("#8C7722");
    expect(stickerOutline("不是颜色")).toBe("不是颜色");
  });
});

describe("贴纸是纯函数", () => {
  it("同参数同输出；尺寸进 width/height", () => {
    expect(sticker("🐮", 30)).toBe(sticker("🐮", 30));
    expect(sticker("🐮", 30)).toContain('width="30" height="30"');
  });

  it("非法尺寸夹回 8px 起，默认 32", () => {
    expect(sticker("⭐", 3)).toContain('width="8"');
    expect(sticker("⭐", -5)).toContain('width="32"');
    expect(sticker("⭐", Number.NaN)).toContain('width="32"');
  });

  it("查不到返回 null，不抛错", () => {
    expect(sticker("🚀")).toBeNull();
    expect(sticker("")).toBeNull();
    expect(hasSticker("🚀")).toBe(false);
    expect(stickerName("🚀")).toBeNull();
  });

  it("VS16 变体符归一：带不带 ️ 查到同一张", () => {
    expect(normalizeEmoji("☂️")).toBe("☂");
    expect(sticker("☂️")).toBe(sticker("☂"));
    expect(sticker("⭐")).toBe(sticker("⭐️"));
    expect(hasSticker("1️⃣")).toBe(true);
  });
});
