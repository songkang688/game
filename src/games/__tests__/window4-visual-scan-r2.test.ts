/**
 * 窗口 4 · 1.3 第 2 轮视觉验收 · 测试员新增的机器化扫描。
 *
 * 报告见 docs/qa/1.3-window4-round2-tester.md。
 * 第 1 轮沉淀的 window4-visual-scan.test.ts 全部保留照跑;本文件只钉第 2 轮
 * 深挖出来的「变量链画布 emoji」与「16px 剪影量化」对应的源码现状:
 *
 *  1. W4R2-01 duo-arena:事件飘字 8 处字面量 emoji 经 pushFloat → fillText 上画布
 *     (第 1 轮的同行扫描抓不到变量链;修复后把 8 改 0);
 *  2. W4R2-02 duo-rush:hudText/branchTag 拼 8 枚字面量 emoji 经 drawHud fillText
 *     每帧上画布(❤️🤍🪙✋×2🤝🌿🌈;修复后把 8 改 0);
 *  3. W4R2-03 duo-vs-star:全花名册 16px 最难分对 xingxing vs jiujiu 剪影 XOR 0%
 *     ——星呆毛 r*0.34 / 啾啾弧呆毛 r*0.22 现状钉住(修复=放大后取反);
 *  4. W4R2-04 garden-guard:四类原型 BOSS 除 boss2 外无轮廓外配饰
 *     (16px 两两 XOR 0%,只剩颜色;修复后取反);
 *  5. W4R2-05 duo-vs-star:≤380px 档触控键 min-width 缩到 38px(<40 底线,
 *     换「零溢出」的 1.2 存量取舍;修复后应 ≥40)。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(id: string, file: string): string {
  return readFileSync(join(GAMES_DIR, id, file), "utf8");
}

/** 抠出某文件里一个嵌套函数的源码体(到下一个同缩进 function/const 声明为止的简化版) */
function fnBody(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `找不到 ${header}`).toBeGreaterThanOrEqual(0);
  const next = source.slice(start + header.length).search(/\n  (?:function |const |\/\*\* )/);
  return next < 0 ? source.slice(start) : source.slice(start, start + header.length + next);
}

/** 抠出顶层函数的源码体(到函数收尾的列 0 右花括号为止) */
function exportBody(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `找不到 ${header}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n}", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 2);
}

function emojiCount(text: string): number {
  return (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
}

describe("窗口4 r2 · W4R2-01 duo-arena 事件飘字字面量 emoji(变量链上画布)", () => {
  it("pushFloat 调用里的字面量 emoji 清零【r2 已修:8 处前缀全部改纯文字,状态自有画面表达】", () => {
    const source = src("duo-arena", "index.ts");
    const lines = source
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .filter((l) => /pushFloat\(/.test(l) && /\p{Extended_Pictographic}/u.test(l));
    // 修复前是 8 处(泡泡/晕/礼花/雪花/星光/漩涡前缀);护盾有盾圈、冰冻有冰花、
    // 双倍有星光、转晕有转圈动画,文字不再需要 emoji 配图
    expect(lines).toHaveLength(0);
  });

  it("回归守护:技能飘字与人机徽章不回退(r1 修复 f7af94d 的三件套还在)", () => {
    const source = src("duo-arena", "index.ts");
    expect(source).not.toMatch(/pushFloat\([^;]*\.emoji/);
    expect(source).toMatch(/AI_PIPS/);
    expect(source).toMatch(/drawMicroFlower/);
  });
});

describe("窗口4 r2 · W4R2-02 duo-rush 画布 HUD emoji 串(hudText → drawHud fillText)", () => {
  it("HUD 路径字面量 emoji 清零【r2 已修:hudText 拆成 hudTokens token 渲染,图标全走 art.ts 手绘】", () => {
    const source = src("duo-rush", "index.ts");
    // 旧的整串 fillText 入口不复存在,取而代之的是 token 化的 hudTokens + drawHudToken
    expect(source).not.toContain("function hudText(");
    const hud = fnBody(source, "function hudTokens(");
    const branch = fnBody(source, "function branchTag(");
    expect(emojiCount(hud) + emojiCount(branch)).toBe(0);
    // 变量链断开:HUD 路径不再取 r.emoji / POWERUPS[*].emoji,道具走 PowerKind 枚举交手绘图标
    expect(hud).not.toMatch(/\.emoji/);
    expect(fnBody(source, "function activePowerIcons(")).not.toMatch(/\.emoji/);
    expect(source).toContain("function drawHudToken(");
  });
});

describe("窗口4 r2 · W4R2-03 duo-vs-star 花名册 16px 最难分对(xingxing vs jiujiu)", () => {
  it("12 角色 drawCharTrait 人人有专属分支(守护)", () => {
    const art = src("duo-vs-star", "art.ts");
    const roster = src("duo-vs-star", "roster.ts");
    const ids = [...roster.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(12);
    const trait = exportBody(art, "function drawCharTrait(");
    for (const id of ids) {
      expect(trait, `drawCharTrait 缺 ${id} 分支`).toContain(`case "${id}"`);
    }
  });

  it("放大档钉住:xingxing 星呆毛 r*0.5、jiujiu 弧呆毛 r*0.34【r2 已修:双双放大,16px 站进像素网格】", () => {
    const trait = exportBody(src("duo-vs-star", "art.ts"), "function drawCharTrait(");
    // 修复前 xingxing 0.34 / jiujiu 0.22,16px 剪影 XOR 0%、重叠灰度差 7.2/255,
    // 是 12 角色两两里最难分的一对;现在钉在放大档,不许再缩回像素网格以下。
    expect(trait).toMatch(/case "xingxing":[\s\S]{0,260}r \* 0\.5/);
    expect(trait).toMatch(/arc\(x, y - r \* 1\.08, r \* 0\.34/);
  });
});

describe("窗口4 r2 · W4R2-04 garden-guard 原型 BOSS 剪影(皇冠之外无轮廓配饰)", () => {
  it("已修:drawMonsterSprite 走 bossTrimOf 原型查表,四类轮廓外配饰分支齐全,boss2 钳子保留", () => {
    const art = src("garden-guard", "art.ts");
    const body = exportBody(art, "export function drawMonsterSprite(");
    // 修复前 bossArmor/bossSwift/bossSplit 两两剪影 XOR 全部 0%(只差颜色);
    // 现在按最近原型查表——铁壳护板/疾风速度羽/浮云云座/双生分裂环,
    // 家族归属与几何细节由 garden-guard/art.test.ts 的 3 例钉住。
    expect(body).toContain('v.kind === "boss2"');
    expect(body).toContain("bossTrimOf(");
    for (const trim of ['"plate"', '"feather"', '"cloud"', '"ring"']) {
      expect(body.includes(`trim === ${trim}`), `drawMonsterSprite 缺 ${trim} 配饰分支`).toBe(true);
    }
    expect(exportBody(art, "export function bossTrimOf(")).toContain("if (!spec.boss)");
  });
});

describe("窗口4 r2 · W4R2-05 duo-vs-star 360px 档触控键触区", () => {
  it("触控键回到 ≥40px 触区底线【r2 已修:min-width 38→40,gap 6→4 保零溢出】", () => {
    const source = src("duo-vs-star", "index.ts");
    const media = source.slice(source.indexOf("@media (max-width:380px)"));
    // 修复前 7 键一行 38×40,低于 40px 触区底线 2px;现在改收 gap 补回宽度预算:
    // 360px 下 7×40+6×4=304px(+两侧 6px 内边距=316)<360,320px 下 304≤308 也不溢出。
    expect(media).toMatch(/\.dvs-pad button\{min-width:40px;min-height:40px/);
    expect(media).toMatch(/\.dvs-pad\{justify-content:center;gap:4px;\}/);
  });
});

describe("窗口4 r2 · r1 修复回归守护(cd187a9 / a91fb0e)", () => {
  it("garden-guard 波次预览用真立绘 drawMonsterSprite,不再经 .emoji 上画布", () => {
    const source = src("garden-guard", "index.ts");
    const preview = fnBody(source, "function drawWavePreview(");
    expect(preview).toMatch(/drawMonsterSprite\(/);
    expect(preview).not.toMatch(/\.emoji/);
  });

  it("sling-birds 关卡横幅不回退:无 .emoji/♾ 且保留 drawBannerBadge 章节角标", () => {
    const source = src("sling-birds", "index.ts");
    const banner = fnBody(source, "function drawBanner(");
    expect(banner).not.toMatch(/\.emoji|♾/u);
    expect(banner).toMatch(/drawBannerBadge\(/);
  });
});
