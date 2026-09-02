/**
 * 勇者小路 · 窗口 6 第 2 轮监督修复员(C 档)· W6R1-07 修复钉子。
 *
 * 选项卡 / 背包 / 商店的大号 emoji 图标族换成与 mazeItemSvg 同族的
 * 参数化 SVG(rowIconSvg):64 视窗 + 落影椭圆 + 1.5px 墨描边 + 左上高光。
 * 钉住:
 *  1) 六族图标全部无 emoji、有描边、有落影;
 *  2) 族内两两 16px 灰度可分(item/gear/skill/supply/bless ≥8%,
 *     node ≥3% —— foe/elite/boss 同为果冻怪造型,靠皇冠/星冠分档,
 *     实测族内最小 3.1% 在 foe vs elite);
 *  3) index.ts 七个位点都走 rowIconSvg(带 emoji 兜底),数据定义的
 *     emoji 字段一个不动;
 *  4) 未知键回空串(调用方兜底),不抛错。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ELEMENT_TINT, RARITY_TINT, rowIconSvg } from "./visual";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const sized = (svg: string, px = 64): string =>
  svg.replace(/width="100%"/, `width="${px}"`).replace(/height="100%"/, `height="${px}"`);

async function gray16(svg: string): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(sized(svg)))
    .flatten({ background: "#FFFFFF" })
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = data[i * info.channels];
  return out;
}

function diffPct(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
  return (n / a.length) * 100;
}

/** 族 → [键, 色]列表 + 族内两两最低线 */
const FAMILIES: { fam: string; kinds: [string, string?][]; min: number }[] = [
  {
    fam: "item",
    kinds: [["item-berry"], ["item-honey"], ["item-bell"], ["item-pepper"], ["item-hammer"]],
    min: 8
  },
  { fam: "gear", kinds: [["gear-weapon"], ["gear-armor"], ["gear-charm"]], min: 8 },
  {
    fam: "skill",
    kinds: [["skill-damage"], ["skill-breaker"], ["skill-pierce"], ["skill-heal"], ["skill-buff"]],
    min: 8
  },
  {
    fam: "node",
    kinds: [
      ["node-chest"],
      ["node-shop"],
      ["node-rest"],
      ["node-foe", ELEMENT_TINT.water],
      ["node-elite", ELEMENT_TINT.fire],
      ["node-boss", ELEMENT_TINT.dark]
    ],
    min: 3
  },
  {
    fam: "supply",
    kinds: [["supply-heal"], ["supply-shield"], ["supply-coins"], ["supply-power"], ["supply-grit"]],
    min: 8
  },
  {
    fam: "bless",
    kinds: [
      ["bless-heal"],
      ["bless-maxhp"],
      ["bless-atk"],
      ["bless-def"],
      ["bless-crit"],
      ["bless-coins"]
    ],
    min: 8
  }
];

describe("W6R1-07 · 行图标族本体规格", () => {
  it("六族 30 枚图标:全 SVG、无 emoji、带墨描边与落影椭圆", () => {
    for (const { kinds } of FAMILIES) {
      for (const [k, tint] of kinds) {
        const svg = rowIconSvg(k, tint);
        expect(svg, k).toContain("<svg");
        expect(svg, k).toContain('class="bvp-ric');
        expect(EMOJI_RE.test(svg), `${k} 不许有 emoji`).toBe(false);
        expect(svg, `${k} 要有墨描边`).toContain("#4B3A6E");
        expect(svg, `${k} 要有落影椭圆`).toContain("<ellipse");
      }
    }
  });

  it("未知键回空串(调用方 emoji 兜底),不抛错", () => {
    expect(rowIconSvg("item-nope")).toBe("");
    expect(rowIconSvg("nonsense")).toBe("");
    expect(rowIconSvg("gear-badge")).toBe(""); // badge 槽走 badge 套件,不在此族
  });

  it("元素色 / 稀有度色表齐全(与 .bvp-ico 边框三档同色)", () => {
    expect(Object.keys(ELEMENT_TINT).sort()).toEqual(["dark", "fire", "grass", "light", "water"]);
    expect(RARITY_TINT.common).toBe("#AEB6CC");
    expect(RARITY_TINT.rare).toBe("#5F9BE8");
    expect(RARITY_TINT.epic).toBe("#E3A82F");
  });
});

describe("W6R1-07 · 族内 16px 灰度两两可分(A 档同款 sharp 量尺)", () => {
  for (const { fam, kinds, min } of FAMILIES) {
    it(`${fam} 族两两 diffPct ≥${min}%`, async () => {
      const grays: [string, Uint8Array][] = [];
      for (const [k, tint] of kinds) grays.push([k, await gray16(rowIconSvg(k, tint))]);
      for (let i = 0; i < grays.length; i++) {
        for (let j = i + 1; j < grays.length; j++) {
          expect(
            diffPct(grays[i][1], grays[j][1]),
            `${grays[i][0]} vs ${grays[j][0]}`
          ).toBeGreaterThanOrEqual(min);
        }
      }
    });
  }
});

describe("W6R1-07 · index.ts 七个位点换绘制(emoji 兜底保留,数据不动)", () => {
  const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

  it("步骤卡 / 补给 / 祝福(bvp-opt-em 三处)走 rowIconSvg", () => {
    expect(SRC).toContain('nodeIconHtml(node)');
    expect(SRC).toContain('rowIconSvg(`node-${node.kind}`, tint) || node.emoji');
    expect(SRC).toContain('rowIconSvg(`supply-${s.kind}`) || s.emoji');
    expect(SRC).toContain('rowIconSvg(`bless-${b.kind}`) || b.emoji');
  });

  it("商店 / 背包 / 装备 / 技能(bvp-ico 四处)走 rowIconSvg;badge 槽走 badge 套件", () => {
    expect(SRC.split("rowIconSvg(`item-${def.id}`) || def.emoji").length - 1).toBe(2);
    expect(SRC).toContain('rowIconSvg(`gear-${g.slot}`, RARITY_TINT[gearRarity(g.reqLevel)]) || g.emoji');
    expect(SRC).toContain('rowIconSvg(`skill-${def.kind}`, ELEMENT_TINT[def.element]) || def.emoji');
    expect(SRC).toContain('badge(heroBadgeKind(g.element), { camp: "hero" })');
  });

  it("bvp-opt-em 容器给了 SVG 尺寸规则,bvp-ico 既有 88% 规则不动", () => {
    expect(SRC).toContain(".bvp-opt-em svg{width:100%;height:100%;display:block;}");
    expect(SRC).toContain(".bvp-ico svg{width:88%;height:88%;display:block;}");
  });

  it("数据定义的 emoji 字段不动:ITEMS / GEARS / SUPPLIES / BLESSINGS 仍带 emoji(只换渲染)", () => {
    const logic = readFileSync(join(__dirname, "logic.ts"), "utf8");
    const combat = readFileSync(join(__dirname, "combat.ts"), "utf8");
    const maze = readFileSync(join(__dirname, "maze.ts"), "utf8");
    expect(combat).toContain('emoji: "🍓"');
    expect(logic).toContain('emoji: "♨️"');
    expect(maze).toContain('emoji: "🧺"');
  });
});

describe("W6R1-07 · 迷宫文案与画面一套语言(B 档第 2 轮第六节登记的改口)", () => {
  const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

  it("钥匙/门/终点/锁四枚 emoji 从 index.ts 全文清零(盘面画的已是徽章)", () => {
    expect(/[🔑🚪🏁🔒]/u.test(SRC)).toBe(false);
  });

  it("HUD 汇报与介绍卡改说「钥匙徽章 / 木门 / 终点小旗」", () => {
    expect(SRC).toContain('"还没拿到钥匙徽章"');
    expect(SRC).toContain('"钥匙徽章到手，去出口！"');
    expect(SRC).toContain('"这扇门还锁着，先去把钥匙徽章找到。"');
    expect(SRC).toContain('"钥匙徽章拿到啦！现在门开得了，冲向终点小旗！"');
    expect(SRC).toContain("先找到钥匙徽章，再从木门过去到终点小旗。");
    expect(SRC).toContain("先找到钥匙徽章，再穿过木门冲到终点小旗。");
  });

  it("过层进度条终点点位改画棋盘小旗徽章(mazeItemSvg exit),带尺寸规则", () => {
    expect(SRC).toContain('goal.innerHTML = mazeItemSvg("exit")');
    expect(SRC).toContain('"bvp-dot bvp-dot-goal"');
    expect(SRC).toContain(".bvp-dot-goal svg{width:20px;height:20px;display:block;}");
  });
});
