/**
 * 朵星地产 · 1.3 视觉资产契约（对照 docs/plan-1.3-step3-C-star-estate.md 第七节）。
 *
 * 全部对 art.ts 纯函数返回的 SVG 字符串断言：
 * 金币必须是「渐变 + 内圈环 + 星形压印」的多层结构（禁止纯色圆）、
 * 四位棋子形状互不相同、骰子点数与三面体结构可数、房屋/酒店/旗子/印章齐全。
 */
import { describe, expect, it } from "vitest";
import { KIT_PALETTE } from "../../art/kit";
import { BOARD } from "./board";
import {
  DIE_PIPS,
  TILE_ICONS,
  coinSVG,
  coinTagSVG,
  dieSVG,
  flagSVG,
  hotelSVG,
  houseSVG,
  mortNoteSVG,
  plazaSVG,
  railTexSVG,
  resultBarsHTML,
  rippleTexSVG,
  roofSVG,
  stampSVG,
  tileIconSVG,
  tokenKindOf,
  tokenSVG,
  trophySVG,
  type TokenKind
} from "./art";

const KINDS: TokenKind[] = ["flower", "star", "cloud", "moon"];

/** 数一段 SVG 字符串里某个片段出现了几次 */
function count(svg: string, needle: string): number {
  let n = 0;
  let at = svg.indexOf(needle);
  while (at >= 0) {
    n++;
    at = svg.indexOf(needle, at + needle.length);
  }
  return n;
}

describe("棋子立牌：四位形状差 + 基座 + 五官", () => {
  it("席位 emoji → 剪影：🌸花、⭐星、☁️云，其余落月亮", () => {
    expect(tokenKindOf("🌸")).toBe("flower");
    expect(tokenKindOf("⭐")).toBe("star");
    expect(tokenKindOf("☁️")).toBe("cloud");
    expect(tokenKindOf("🍡")).toBe("moon");
    expect(tokenKindOf("")).toBe("moon");
  });

  it("四种立牌都是 SVG 且两两不同（形状通道，不只换色）", () => {
    const svgs = KINDS.map((k) => tokenSVG(k, "#E4762F"));
    for (const s of svgs) expect(s.startsWith("<svg")).toBe(true);
    for (let a = 0; a < svgs.length; a++) {
      for (let b = a + 1; b < svgs.length; b++) {
        expect(svgs[a], `${KINDS[a]} 和 ${KINDS[b]} 画重了`).not.toBe(svgs[b]);
      }
    }
    // 同一剪影换席位色也要变（颜色通道）
    expect(tokenSVG("flower", "#E4762F")).not.toBe(tokenSVG("flower", "#5B8FD6"));
  });

  it("立牌有基座椭圆（暗沿 + 座面 + 高光三层）", () => {
    for (const k of KINDS) {
      const svg = tokenSVG(k, "#5B8FD6");
      expect(count(svg, "<ellipse"), `${k} 的基座层数不够`).toBeGreaterThanOrEqual(3);
      expect(svg.toLowerCase()).toContain("#5b8fd6"); // 席位色真的用上了
    }
  });

  it("每种立牌都有眼睛（墨色圆）和腮红，不是无表情占位", () => {
    for (const k of KINDS) {
      const svg = tokenSVG(k, "#59A36B");
      expect(count(svg, `fill="${KIT_PALETTE.ink}"`), `${k} 没画眼睛`).toBeGreaterThanOrEqual(2);
      expect(svg, `${k} 没画腮红`).toContain(KIT_PALETTE.blush);
    }
  });
});

describe("骰子：伪 3D 三面体 + 红黑圆点", () => {
  it("1–6 点的圆点个数与点数一致，data-pips 同步", () => {
    for (let v = 1; v <= 6; v++) {
      const svg = dieSVG(v);
      expect(count(svg, 'class="se-die-pip"'), `${v} 点画错`).toBe(v);
      expect(svg).toContain(`data-pips="${v}"`);
      expect(DIE_PIPS[v].length).toBe(v);
    }
  });

  it("非法点数不抛，夹回 1–6", () => {
    expect(dieSVG(0)).toContain('data-pips="1"');
    expect(dieSVG(99)).toContain('data-pips="6"');
    expect(dieSVG(Number.NaN)).toContain('data-pips="1"');
  });

  it("顶面 / 侧面 / 前脸三个面用了三种不同的颜色（体积两阶暗面）", () => {
    const svg = dieSVG(3);
    const fills = [...svg.matchAll(/(?:polygon|rect)[^>]*fill="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(fills.slice(0, 3)).size).toBe(3);
    expect(count(svg, "<polygon")).toBeGreaterThanOrEqual(2);
  });

  it("1、4 点是红点，其余是墨色点；每颗点带高光粒", () => {
    const pipFill = (svg: string): string => /class="se-die-pip"[^>]*fill="([^"]+)"/.exec(svg)?.[1] ?? "";
    expect(pipFill(dieSVG(1))).not.toBe(KIT_PALETTE.ink);
    expect(pipFill(dieSVG(4))).not.toBe(KIT_PALETTE.ink);
    expect(pipFill(dieSVG(2))).toBe(KIT_PALETTE.ink);
    expect(pipFill(dieSVG(6))).toBe(KIT_PALETTE.ink);
    expect(count(dieSVG(6), "<circle")).toBeGreaterThanOrEqual(12);
  });

  it("双骰同点的金描边：gold 态描边换成星光金", () => {
    expect(dieSVG(5, true)).toContain(`stroke="${KIT_PALETTE.starGold}"`);
    expect(dieSVG(5, false)).not.toContain(`stroke="${KIT_PALETTE.starGold}"`);
  });
});

describe("金币：渐变多层，禁止纯色圆", () => {
  it("飞行金币 = 径向渐变币面 + 侧沿厚度 + 内圈亮环 + 星形压印 + 高光斑", () => {
    const svg = coinSVG();
    expect(svg).toContain("radialGradient");
    expect(count(svg, "<stop")).toBeGreaterThanOrEqual(3);
    expect(count(svg, "<circle")).toBeGreaterThanOrEqual(3); // 侧沿 + 币面 + 内环
    expect(svg).toContain("<polygon"); // 星形压印
    expect(svg).toContain("<ellipse"); // 高光斑
  });

  it("两枚金币的渐变 id 不同，同屏多枚不打架", () => {
    const a = /id="([^"]+)"/.exec(coinSVG())?.[1];
    const b = /id="([^"]+)"/.exec(coinSVG())?.[1];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("价签迷你金币至少三层（侧沿 + 币面 + 内环 + 高光）", () => {
    expect(count(coinTagSVG(), "<circle")).toBeGreaterThanOrEqual(4);
  });
});

describe("地格件：房屋 / 酒店 / 旗子 / 屋顶 / 纹理 / 抵押条", () => {
  it("小房子有三角屋顶、门和窗，落下态带 se-drop 类", () => {
    const svg = houseSVG();
    expect(svg).toContain('class="se-house"');
    expect(count(svg, "<polygon")).toBeGreaterThanOrEqual(2); // 屋顶 + 屋顶亮阶
    expect(count(svg, "<circle")).toBeGreaterThanOrEqual(2); // 窗
    expect(houseSVG(true)).toContain("se-drop");
  });

  it("满级酒店是两层红金小楼 + 金星招牌", () => {
    const svg = hotelSVG();
    expect(svg).toContain('class="se-hotel"');
    expect(svg).toContain(`fill="${KIT_PALETTE.starGold}"`); // 星星招牌
    expect(count(svg, "<rect")).toBeGreaterThanOrEqual(4); // 两层楼体 + 楼层带 + 门
    expect(hotelSVG(true)).toContain("se-drop");
  });

  it("拥有者小旗：旗杆 + 玩家色三角旗 + 旗面暗折", () => {
    const svg = flagSVG("#B36FC0");
    expect(svg).toContain("<line");
    expect(svg).toContain('fill="#B36FC0"');
    expect(count(svg, "<polygon")).toBeGreaterThanOrEqual(2);
  });

  it("屋檐屋顶用同一底色推了亮暗两阶，不是平色带", () => {
    const svg = roofSVG("#F6D8E4");
    const fills = new Set([...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]));
    expect(fills.size).toBeGreaterThanOrEqual(3);
  });

  it("车站铁轨纹 / 公用波纹是两种不同底纹", () => {
    expect(railTexSVG()).toContain("se-tex-rail");
    expect(rippleTexSVG()).toContain("se-tex-ripple");
    expect(railTexSVG()).not.toBe(rippleTexSVG());
  });

  it("抵押纸条写着「抵押中」，是斜贴的双层纸", () => {
    const svg = mortNoteSVG();
    expect(svg).toContain("抵押中");
    expect(count(svg, "<rect")).toBeGreaterThanOrEqual(2);
  });
});

describe("广场 / 奖杯 / 印章 / 结算条形图", () => {
  it("星城广场：环形路 + 白虚线 + 中央喷泉星 + 四角草地", () => {
    const svg = plazaSVG();
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain(`fill="${KIT_PALETTE.starGold}"`);
    expect(count(svg, "<ellipse")).toBeGreaterThanOrEqual(4);
    expect(count(svg, "<circle")).toBeGreaterThanOrEqual(4);
  });

  it("奖杯有双耳、杯身、底座和星徽", () => {
    const svg = trophySVG();
    expect(svg).toContain('class="se-trophy"');
    expect(count(svg, "<path")).toBeGreaterThanOrEqual(3);
    expect(count(svg, "<rect")).toBeGreaterThanOrEqual(3);
    expect(svg).toContain("<polygon");
  });

  it("已收摊印章是双圈 + 文案，鼓励口径", () => {
    const svg = stampSVG();
    expect(svg).toContain("已收摊");
    expect(count(svg, "<circle")).toBe(2);
  });

  it("结算条形图按净资产比例伸长，第一名带奖杯", () => {
    const html = resultBarsHTML([
      { name: "朵朵", color: "#E4762F", worth: 2000, win: true },
      { name: "星星", color: "#5B8FD6", worth: 1000 }
    ]);
    expect(html).toContain("width:100%");
    expect(html).toContain("width:50%");
    expect(count(html, "se-trophy")).toBe(1);
    expect(html).toContain("linear-gradient");
  });

  it("全员 0 资产也不除零、不出 NaN 宽度", () => {
    const html = resultBarsHTML([
      { name: "a", color: "#E4762F", worth: 0 },
      { name: "b", color: "#5B8FD6", worth: 0 }
    ]);
    expect(html).not.toContain("NaN");
  });
});

describe("地格主题图标（1.3 r1 G-6 修复）：矢量小图标替代裸 emoji", () => {
  const KEYS = Object.keys(TILE_ICONS);
  const EMOJI_RE = /\p{Extended_Pictographic}/u;

  it("board.ts 40 格的地格 emoji 全部有专属图标，无一落兜底", () => {
    for (const tile of BOARD) {
      expect(TILE_ICONS[tile.emoji], `${tile.name}（${tile.emoji}）没有专属图标`).toBeTruthy();
    }
  });

  it("外层 svg：viewBox 0 0 20 20 + aria-hidden + focusable=false + se-tileicon 类", () => {
    for (const key of KEYS) {
      const svg = tileIconSVG(key);
      expect(svg).toContain('viewBox="0 0 20 20"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).toContain('class="se-tileicon"');
    }
  });

  it("图标图形体内不携带任何 emoji 码位（矢量化彻底）", () => {
    for (const key of KEYS) {
      expect(EMOJI_RE.test(TILE_ICONS[key]), `${key} 的图标里混进了 emoji`).toBe(false);
    }
  });

  it("全部图标两两互异（不是一款换色糊弄）", () => {
    for (let a = 0; a < KEYS.length; a++) {
      for (let b = a + 1; b < KEYS.length; b++) {
        expect(TILE_ICONS[KEYS[a]], `${KEYS[a]} 和 ${KEYS[b]} 画重了`).not.toBe(TILE_ICONS[KEYS[b]]);
      }
    }
  });

  it("双色阶：每款至少两种不同颜色（主色 + shade/tint 派生）", () => {
    for (const key of KEYS) {
      const colors = new Set(
        [...TILE_ICONS[key].matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1])
      );
      expect(colors.size, `${key} 只有一种颜色，缺双色阶`).toBeGreaterThanOrEqual(2);
    }
  });

  it("色值全部是小写 #rrggbb（kit 调色板派生，无随手色）", () => {
    for (const key of KEYS) {
      const raw = [...TILE_ICONS[key].matchAll(/(?:fill|stroke)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((v) => v !== "none");
      for (const v of raw) {
        expect(v, `${key} 出现非法色值 ${v}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("每款图标 2–8 个图元（克制构图，缩到 15px 不糊）", () => {
    for (const key of KEYS) {
      const n = (TILE_ICONS[key].match(/</g) ?? []).length;
      expect(n, `${key} 图元数 ${n} 超出 2–8`).toBeGreaterThanOrEqual(2);
      expect(n, `${key} 图元数 ${n} 超出 2–8`).toBeLessThanOrEqual(8);
    }
  });

  it("同一 emoji 的图标输出确定（多次调用逐字节一致，可放心 innerHTML 重绘）", () => {
    expect(tileIconSVG("🌷")).toBe(tileIconSVG("🌷"));
    expect(tileIconSVG("🚉")).toBe(tileIconSVG("🚉"));
  });

  it("四个车站共用同一款列车图标（同类同画法）", () => {
    const stations = BOARD.filter((t) => t.kind === "station");
    expect(stations.length).toBe(4);
    const svgs = new Set(stations.map((t) => tileIconSVG(t.emoji)));
    expect(svgs.size).toBe(1);
  });

  it("未登记 emoji 落金色四芒星兜底，不抛、不空白", () => {
    const svg = tileIconSVG("🛸");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(KIT_PALETTE.starGold);
    expect(svg).toContain("<polygon");
  });

  it("图标风格与既有地格件同族：至少一款用到 starGold、一款用到 grass 系", () => {
    const all = KEYS.map((k) => TILE_ICONS[k]).join("");
    expect(all).toContain(KIT_PALETTE.starGold);
    expect(all).toContain(KIT_PALETTE.grass);
    expect(all).toContain(KIT_PALETTE.lilac);
  });

  it("图标覆盖数 ≥ board 去重 emoji 数（33 款上下，只多不少）", () => {
    const distinct = new Set(BOARD.map((t) => t.emoji));
    expect(KEYS.length).toBeGreaterThanOrEqual(distinct.size);
  });
});
