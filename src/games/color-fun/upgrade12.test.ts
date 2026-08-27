/**
 * 涂色小屋 · 1.2 升级用例。
 *
 * 1.1 的两份用例继续管「关卡长什么样」，这一份专门盯 1.2 新做的那几件事：
 * 混色到底教得对不对、188 关是不是真的都打得完、线稿画得能不能点、
 * 撤销重做与沙盒存档靠不靠谱，以及前 99 关有没有被碰过。
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chapterOf } from "../level99";
import guide from "./guide";
import { meta } from "./meta";
import {
  ANALOGOUS_NEXT,
  CHAPTERS,
  CHAPTER_PICTURES,
  COMPLEMENT,
  DEFAULT_POT_INPUTS,
  LADDER_COMPATIBLE,
  LEGACY_LEVELS,
  LEVELS,
  MIX_TABLE,
  PICTURES,
  SHADE_LADDERS,
  buildLevel,
  compatibleLadders,
  pictureOf,
  type ColorLevel,
} from "./levels";
import {
  MIN_SHADE_STEP,
  MIN_TARGET_DELTA_E,
  PIGMENTS,
  PIGMENT_HEX,
  RECIPES,
  deltaE,
  hexToLab,
  isLightToDark,
  isPigment,
  minShadeStep,
  mixHex,
  mixKey,
  mixName,
  mixWhy,
  naiveRgbAverage,
  pigmentDeltaE,
  pigmentLightness,
  sortLightToDark,
  stirColor,
  subtractiveBlend,
} from "./mix";
import { searchMixPlan, validateAll, validateLevel } from "./validate";
import { PaintHistory } from "./history";
import {
  MAX_WORKS,
  SANDBOX_KEY,
  isFull,
  loadWorks,
  normalizeWorks,
  removeWork,
  replaceWork,
  saveWork,
  type StorageLike,
} from "./sandbox";
import {
  CANVAS_MIN_VH,
  CLF_CSS,
  SPREAD_MS,
  SWATCH_MIN_PX,
  makeChip,
  makePrimary,
  makeSwatch,
  pinCanvas,
  thumbnailSvg,
} from "./ui";
import { openLevelOnMap, parseLevelParam, resolveInitialLevel } from "./runtime";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const read = (name: string): string => readFileSync(`${DIR}${name}`, "utf8");
/** 只扒发布出去的源码；测试自己写着黑名单，不能算进去 */
const SOURCES = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const ALL_SOURCE = SOURCES.map((f) => read(f)).join("\n");
const INDEX_SRC = read("index.ts");
const UI_SRC = read("ui.ts");
const SANDBOX_UI_SRC = read("sandboxUi.ts");

const TRADEMARKS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟", "拳皇", "街霸",
  "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris", "贪吃蛇大作战", "球球大作战", "我的世界",
  "Minecraft", "三国杀", "大富翁", "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼",
  "喜羊羊", "蛋仔", "原神", "王者荣耀",
];

/** 内存版存储，沙盒用例拿它当 localStorage */
function memoryStore(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** 够 `ui.ts` 用的极简 DOM 桩（仓库的 vitest 跑在 node 环境，没有 jsdom） */
class StubEl {
  className = "";
  textContent = "";
  title = "";
  type = "";
  readonly children: StubEl[] = [];
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly classes = new Set<string>();
  constructor(readonly tagName: string) {}
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  append(...kids: Array<StubEl | { text: string }>): void {
    for (const kid of kids) this.children.push(kid as StubEl);
  }
  appendChild(kid: StubEl): StubEl {
    this.children.push(kid);
    return kid;
  }
  addEventListener(): void {
    /* 桩：本组用例只看渲染结果，不触发事件 */
  }
  readonly classList = {
    add: (...names: string[]): void => {
      for (const n of names) this.classes.add(n);
      this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
    },
    contains: (n: string): boolean => this.className.split(/\s+/).includes(n),
  };
  /** 把整棵子树的文字拼起来 */
  get text(): string {
    return [this.textContent, ...this.children.map((c) => (c instanceof StubEl ? c.text : String((c as { text: string }).text ?? "")))].join("");
  }
}

function stubDoc(): Document {
  return {
    createElement: (tag: string) => new StubEl(tag),
    createTextNode: (text: string) => ({ text }),
  } as unknown as Document;
}

// ---------------------------------------------------------------------------

describe("涂色小屋 1.2 · 混色是减色法查表，不是 RGB 平均", () => {
  it("全部两两组合都有确定答案：与顺序无关，出来的要么是本作颜料要么是「调不出来」", () => {
    let withRecipe = 0;
    let pairs = 0;
    for (let i = 0; i < PIGMENTS.length; i++) {
      for (let j = i; j < PIGMENTS.length; j++) {
        const a = PIGMENTS[i].name;
        const b = PIGMENTS[j].name;
        pairs++;
        const out = mixName(a, b);
        expect(mixName(b, a), `${a}+${b} 换个顺序结果就变了`).toBe(out);
        expect(mixKey(a, b)).toBe(mixKey(b, a));
        if (out === null) {
          expect(mixHex(a, b)).toBeNull();
          continue;
        }
        withRecipe++;
        expect(isPigment(out), `${a}+${b} 调出了不存在的颜料 ${out}`).toBe(true);
        expect(mixHex(a, b)).toBe(PIGMENT_HEX[out]);
        expect(mixWhy(a, b)).toBeTruthy();
      }
    }
    expect(pairs).toBe((PIGMENTS.length * (PIGMENTS.length + 1)) / 2);
    expect(withRecipe).toBe(RECIPES.length);
  });

  it("蓝 + 黄 = 绿：RGB 平均会调出一团灰绿，这条反例钉死", () => {
    expect(mixName("蓝色", "黄色")).toBe("绿色");
    expect(mixHex("蓝色", "黄色")).toBe(PIGMENT_HEX["绿色"]);
    const naive = naiveRgbAverage(PIGMENT_HEX["蓝色"], PIGMENT_HEX["黄色"]);
    // 平均出来那个颜色离真绿差着一大截，而且鲜艳度只有真绿的一半上下
    expect(deltaE(naive, PIGMENT_HEX["绿色"])).toBeGreaterThan(30);
    const chroma = (hex: string): number => {
      const [, a, b] = hexToLab(hex);
      return Math.hypot(a, b);
    };
    expect(chroma(naive)).toBeLessThan(chroma(PIGMENT_HEX["绿色"]) * 0.7);
    // 玩法代码一行都不许调这个反例函数
    expect(INDEX_SRC).not.toContain("naiveRgbAverage");
    expect(SANDBOX_UI_SRC).not.toContain("naiveRgbAverage");
  });

  it("三原色两两、加白变浅、加黑变深、白加黑成灰，一条都不缺", () => {
    expect(mixName("红色", "黄色")).toBe("橙色");
    expect(mixName("红色", "蓝色")).toBe("紫色");
    for (const [base, tint, shade] of [
      ["红色", "浅红", "深红"],
      ["黄色", "浅黄", "深黄"],
      ["蓝色", "浅蓝", "深蓝"],
      ["橙色", "浅橙", "深橙"],
      ["绿色", "浅绿", "深绿"],
      ["紫色", "浅紫", "深紫"],
      ["粉色", "浅粉", "深粉"],
    ]) {
      expect(mixName(base, "白色"), `${base}加白应该变浅`).toBe(tint);
      expect(mixName(base, "黑色"), `${base}加黑应该变沉`).toBe(shade);
      expect(pigmentLightness(tint)).toBeGreaterThan(pigmentLightness(base));
      expect(pigmentLightness(shade)).toBeLessThan(pigmentLightness(base));
    }
    expect(mixName("白色", "黑色")).toBe("灰色");
    // 1.0 的老配方也还在：同色再倒一勺，颜色更浓
    expect(mixName("红色", "红色")).toBe("深红");
    expect(mixName("黄色", "黄色")).toBe("金黄");
    expect(mixName("蓝色", "蓝色")).toBe("深蓝");
  });

  it("同一种结果有多条配方时，只用三原色那条排在最后（冒烟脚本按插入序取）", () => {
    const lastFor = new Map<string, string[]>();
    for (const [key, out] of Object.entries(MIX_TABLE)) lastFor.set(out, key.split("+"));
    for (const out of ["深红", "深蓝", "金黄", "橙色", "绿色", "紫色"]) {
      const pair = lastFor.get(out);
      expect(pair, `${out} 应该能查到配方`).toBeDefined();
      for (const p of pair!) {
        expect(DEFAULT_POT_INPUTS, `${out} 最后那条配方用到了三原色以外的 ${p}`).toContain(p);
      }
    }
  });

  it("搅拌是受控插值：从减色叠色出发，收敛到查表结果，不会半路先变灰再跳过去", () => {
    const a = "蓝色";
    const b = "黄色";
    expect(stirColor(a, b, 0)).toBe(subtractiveBlend(PIGMENT_HEX[a], PIGMENT_HEX[b]));
    expect(stirColor(a, b, 1)).toBe(PIGMENT_HEX["绿色"]);
    // 越搅越接近目标色，一路单调
    let prev = Number.POSITIVE_INFINITY;
    for (const t of [0.4, 0.6, 0.8, 1]) {
      const d = deltaE(stirColor(a, b, t), PIGMENT_HEX["绿色"]);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    // 越界的 t 会被夹回来，不会算出奇怪的颜色
    expect(stirColor(a, b, 9)).toBe(stirColor(a, b, 1));
    expect(stirColor(a, b, -3)).toBe(stirColor(a, b, 0));
    // 没有配方的两样，锅里就老老实实停在叠色上
    expect(stirColor("棕色", "灰色", 1)).toBe(subtractiveBlend(PIGMENT_HEX["棕色"], PIGMENT_HEX["灰色"]));
  });

  it("颜料表自检：名字不重、色值合法、符号一个不撞", () => {
    const names = PIGMENTS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const p of PIGMENTS) {
      expect(p.hex, `${p.name} 的色值写坏了`).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.name).not.toMatch(/[A-Za-z]/);
      expect(p.symbol.length).toBeGreaterThan(0);
    }
    const symbols = PIGMENTS.map((p) => p.symbol);
    expect(new Set(symbols).size, "两种颜料撞了同一个符号，色盲图例就废了").toBe(symbols.length);
  });
});

describe("涂色小屋 1.2 · 亮度与可分辨", () => {
  it("亮度排序是纯函数：由浅到深，同亮度按名字定序，不改原数组", () => {
    const input = ["深蓝", "浅蓝", "蓝色"];
    const sorted = sortLightToDark(input);
    expect(sorted).toEqual(["浅蓝", "蓝色", "深蓝"]);
    expect(input).toEqual(["深蓝", "浅蓝", "蓝色"]);
    expect(sortLightToDark(sorted)).toEqual(sorted);
    expect(isLightToDark(sorted)).toBe(true);
    expect(isLightToDark(["深蓝", "浅蓝"])).toBe(false);
    // 同一种颜料并列时按名字定序，结果稳定可测
    expect(sortLightToDark(["蓝色", "蓝色"])).toEqual(["蓝色", "蓝色"]);
  });

  it("七条明暗阶梯：相邻两级的亮度差都 ≥ 12%（1.1 有两条不到，1.2 修掉了）", () => {
    expect(SHADE_LADDERS).toHaveLength(7);
    for (const ladder of SHADE_LADDERS) {
      expect(ladder).toHaveLength(3);
      expect(isLightToDark(ladder, MIN_SHADE_STEP), `阶梯 ${ladder.join(">")} 的深浅分不出来`).toBe(true);
      expect(minShadeStep(ladder)).toBeGreaterThanOrEqual(MIN_SHADE_STEP);
    }
    // 1.1 的老写法留一条回归：浅绿→绿色 只差 9.5 点，正是当时看不出深浅的那一档
    expect(pigmentLightness("浅绿") - pigmentLightness("绿色")).toBeLessThan(MIN_SHADE_STEP);
    expect(SHADE_LADDERS.find((l) => l[0] === "浅绿")).toEqual(["浅绿", "中绿", "深绿"]);
    expect(SHADE_LADDERS.find((l) => l[0] === "浅黄")).toEqual(["浅黄", "金黄", "深黄"]);
  });

  it("阶梯相容表：对称、自己不跟自己配，相容就一定两两差得开", () => {
    for (let i = 0; i < SHADE_LADDERS.length; i++) {
      expect(LADDER_COMPATIBLE[i][i]).toBe(false);
      for (let j = 0; j < SHADE_LADDERS.length; j++) {
        expect(LADDER_COMPATIBLE[i][j]).toBe(LADDER_COMPATIBLE[j][i]);
        if (!LADDER_COMPATIBLE[i][j] || i === j) continue;
        for (const a of SHADE_LADDERS[i]) {
          for (const b of SHADE_LADDERS[j]) {
            expect(pigmentDeltaE(a, b)).toBeGreaterThanOrEqual(MIN_TARGET_DELTA_E);
          }
        }
      }
      expect(compatibleLadders(i).length, "每条阶梯都得找得到搭档").toBeGreaterThan(0);
    }
    // 浅粉与浅红只差 ΔE 10.8，这两条阶梯永远不许同台
    expect(pigmentDeltaE("浅粉", "浅红")).toBeLessThan(MIN_TARGET_DELTA_E);
    const pink = SHADE_LADDERS.findIndex((l) => l[0] === "浅粉");
    const red = SHADE_LADDERS.findIndex((l) => l[0] === "浅红");
    expect(LADDER_COMPATIBLE[pink][red]).toBe(false);
  });

  it("互补色表两两成对、邻近色六步成环，互补的两色一定分得出来", () => {
    expect(COMPLEMENT).toEqual({ 红色: "绿色", 绿色: "红色", 蓝色: "橙色", 橙色: "蓝色", 黄色: "紫色", 紫色: "黄色" });
    for (const [a, b] of Object.entries(COMPLEMENT)) {
      expect(COMPLEMENT[b]).toBe(a);
      expect(pigmentDeltaE(a, b), `${a}与它的互补色${b}居然分不出来`).toBeGreaterThanOrEqual(MIN_TARGET_DELTA_E);
    }
    let cur = "红色";
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(cur);
      cur = ANALOGOUS_NEXT[cur];
    }
    expect(cur).toBe("红色");
    expect(seen.size).toBe(6);
  });
});

describe("涂色小屋 1.2 · validateLevel 跑遍 188 关", () => {
  it("188 关一关不落：调得出来、每块都有指令、目标色两两分得清", () => {
    const reports = validateAll(LEVELS);
    expect(reports).toHaveLength(188);
    const bad = reports.filter((r) => !r.ok);
    const why = bad.slice(0, 5).map((r) => r.issues.map((i) => i.detail).join("；")).join(" / ");
    expect(bad.length, `有关卡过不了校验：${why}`).toBe(0);
    for (const r of reports) expect(r.minPours).toBeGreaterThanOrEqual(0);
  });

  it("校验器是有牙的：七种故障注进去都能被逮住", () => {
    const base = LEVELS[187];
    const kinds = (cfg: unknown): string[] => validateLevel(cfg as ColorLevel, 0).map((i) => i.kind);
    expect(kinds({ ...base, tasks: [{ region: "根本没这块", color: "红色" }] })).toContain("unknown-region");
    expect(kinds({ ...base, tasks: [{ region: base.tasks[0].region, color: "彩虹色" }] })).toContain("unknown-pigment");
    expect(kinds({ ...base, tasks: [base.tasks[0], base.tasks[0]] })).toContain("duplicate-region");
    expect(kinds({ ...base, palette: [], needMix: [], budget: 0 })).toContain("unreachable-color");
    expect(kinds({ ...base, budget: 1 })).toContain("over-budget");
    // 目标色撞色：浅粉与浅红同台
    const twins = { ...base, mode: "guide", palette: ["浅粉", "浅红"], needMix: [], budget: 0,
      tasks: [{ region: base.tasks[0].region, color: "浅粉" }, { region: base.tasks[1].region, color: "浅红" }] };
    expect(kinds(twins)).toContain("too-similar");
    // 渐变关方向反了 / 两级差得不够
    const shade = LEVELS[100];
    const flipped = { ...shade, tasks: [...shade.tasks].reverse(), orderGroups: [shade.tasks.length] };
    expect(kinds(flipped)).toContain("shade-order");
    const tooClose = { ...shade, orderGroups: [2],
      tasks: [{ region: shade.tasks[0].region, color: "浅绿" }, { region: shade.tasks[1].region, color: "绿色" }] };
    expect(kinds(tooClose)).toContain("shade-step");
    // 图例关漏了一种颜色的图例
    const legend = LEVELS[143];
    expect(kinds({ ...legend, legend: [] })).toContain("no-instruction");
  });

  it("限色章：BFS 在给定的开锅次数里真的调得出来，而且还留着富余", () => {
    const limited = LEVELS.filter((l) => l.mode === "limited");
    expect(limited.length).toBeGreaterThanOrEqual(22);
    for (const cfg of limited) {
      const wanted = [...new Set(cfg.tasks.map((t) => t.color))];
      const plan = searchMixPlan(cfg, wanted, cfg.budget ?? 0);
      expect(plan, `预算 ${cfg.budget} 次调不出 ${wanted.join("、")}`).not.toBeNull();
      expect(plan!.pours).toBeLessThanOrEqual(cfg.budget!);
      expect(cfg.budget!).toBeGreaterThan(cfg.needMix.length);
      // 恰好差一次就搜不出来，说明预算不是白给的
      expect(searchMixPlan(cfg, wanted, plan!.pours - 1)).toBeNull();
    }
  });

  it("限色章的白和黑只进锅不进调色盘：调色盘永远只有三原色", () => {
    for (const cfg of LEVELS.filter((l) => l.mode === "limited")) {
      expect(cfg.palette).toEqual(expect.arrayContaining(["红色", "黄色", "蓝色"]));
      expect(cfg.palette).toHaveLength(3);
      expect(cfg.potInputs).toEqual(["红色", "黄色", "蓝色", "白色", "黑色"]);
      for (const c of ["白色", "黑色"]) expect(cfg.tasks.some((t) => t.color === c)).toBe(false);
    }
  });

  it("searchMixPlan：不用调色就是 0 次，没有配方或预算为零一律返回 null", () => {
    const cfg = LEVELS[187];
    expect(searchMixPlan(cfg, cfg.palette, 5)).toEqual({ pours: 0, order: [] });
    expect(searchMixPlan(cfg, ["棕色"], 6)).toBeNull();
    expect(searchMixPlan(cfg, cfg.needMix, 0)).toBeNull();
    // 三原色的锅调不出「中绿」，那要先有浅绿和绿色
    expect(searchMixPlan({ ...cfg, potInputs: DEFAULT_POT_INPUTS }, ["中绿"], 6)).toBeNull();
  });
});

describe("涂色小屋 1.2 · 十六幅线稿", () => {
  it("16 幅线稿：id 全局唯一、形状写法合法、块数从 8 排到 18", () => {
    expect(PICTURES).toHaveLength(16);
    const seen = new Set<string>();
    for (const pic of PICTURES) {
      expect(pic.name).not.toMatch(/[A-Za-z]/);
      expect(pic.regions.length).toBeGreaterThanOrEqual(6);
      expect(pic.regions.length).toBeLessThanOrEqual(20);
      for (const r of pic.regions) {
        expect(seen.has(r.id), `区域 id ${r.id} 在两幅画里重了`).toBe(false);
        seen.add(r.id);
        expect(r.svg.trimEnd().endsWith("/>")).toBe(true);
        expect(r.svg).toMatch(/^<(rect|circle|ellipse|polygon|path)\s/);
        // path 的 d 只许出现命令字母与数字，且必须闭合成一块能填色的面
        if (r.svg.startsWith("<path")) {
          const d = /\sd="([^"]+)"/.exec(r.svg)?.[1] ?? "";
          expect(d, `${r.id} 的 path 没有 d`).not.toBe("");
          expect(d).toMatch(/^M[\s\d.,-]/);
          expect(d).toMatch(/[Zz]\s*$/);
          expect(d).not.toMatch(/[^MmLlHhVvCcSsQqTtAaZz\d\s.,-]/);
        }
        // path 的 d、polygon 的 points 里不许出现 NaN / undefined
        expect(r.svg).not.toMatch(/NaN|undefined/);
        expect(r.name.length).toBeGreaterThan(0);
        expect(r.lx).toBeGreaterThanOrEqual(0);
        expect(r.ly).toBeGreaterThanOrEqual(0);
      }
    }
    // 1.2 追加的六幅接在末尾，块数比 1.0 那几幅多
    const fresh = PICTURES.slice(10);
    expect(fresh).toHaveLength(6);
    expect(Math.max(...fresh.map((p) => p.regions.length))).toBeGreaterThanOrEqual(16);
  });

  it("1.2 六幅新线稿：每一块都点得到，编号也不会被后画的形状压住", () => {
    type Hit = { box: [number, number, number, number]; inside: (x: number, y: number) => boolean };
    const hitTest = (svg: string): Hit => {
      const num = (name: string): number => Number(new RegExp(`${name}="(-?[\\d.]+)"`).exec(svg)?.[1] ?? NaN);
      if (svg.startsWith("<rect")) {
        const x = num("x"), y = num("y"), w = num("width"), h = num("height");
        return { box: [x, y, w, h], inside: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h };
      }
      if (svg.startsWith("<circle")) {
        const cx = num("cx"), cy = num("cy"), r = num("r");
        return { box: [cx - r, cy - r, r * 2, r * 2], inside: (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r };
      }
      if (svg.startsWith("<ellipse")) {
        const cx = num("cx"), cy = num("cy"), rx = num("rx"), ry = num("ry");
        return {
          box: [cx - rx, cy - ry, rx * 2, ry * 2],
          inside: (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1,
        };
      }
      const pts = (/points="([^"]+)"/.exec(svg)?.[1] ?? "").trim().split(/\s+/)
        .map((p) => p.split(",").map(Number) as [number, number]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return {
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)],
        inside: (px, py) => {
          let hit = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i];
            const [xj, yj] = pts[j];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
          }
          return hit;
        },
      };
    };

    PICTURES.slice(10).forEach((pic, k) => {
      const shapes = pic.regions.map((r) => hitTest(r.svg));
      pic.regions.forEach((r, ri) => {
        const me = shapes[ri];
        // 编号落在自己形状里
        expect({ pic: pic.name, region: r.id, in: me.inside(r.lx, r.ly) })
          .toEqual({ pic: pic.name, region: r.id, in: true });
        // 编号没被后画的形状压住
        const buried = shapes.slice(ri + 1).some((s) => s.inside(r.lx, r.ly));
        expect({ pic: pic.name, region: r.id, buried }).toEqual({ pic: pic.name, region: r.id, buried: false });
        // 这一块还有露在外面点得到的地方
        const [bx, by, bw, bh] = me.box;
        let exposed = 0;
        for (let gy = 1; gy <= 19 && exposed === 0; gy++) {
          for (let gx = 1; gx <= 19 && exposed === 0; gx++) {
            const px = bx + (bw * gx) / 20;
            const py = by + (bh * gy) / 20;
            if (!me.inside(px, py)) continue;
            if (!shapes.slice(ri + 1).some((s) => s.inside(px, py))) exposed++;
          }
        }
        expect({ pic: k, region: r.id, clickable: exposed > 0 })
          .toEqual({ pic: k, region: r.id, clickable: true });
      });
    });
  });

  it("后四章按关号轮换线稿，16 幅一幅都没闲着", () => {
    for (let lv = 0; lv < 188; lv++) {
      const ci = chapterOf(CHAPTERS, lv);
      expect(LEVELS[lv].pic).toBe(pictureOf(lv));
      expect(CHAPTER_PICTURES[ci]).toContain(LEVELS[lv].pic);
      if (ci < 6) expect(LEVELS[lv].pic).toBe(ci);
    }
    const used = new Set(LEVELS.map((l) => l.pic));
    expect(used.size).toBe(PICTURES.length);
    // 同一章里连着三关不会是同一幅
    for (const start of [99, 121, 143, 166]) {
      expect(new Set([LEVELS[start].pic, LEVELS[start + 1].pic, LEVELS[start + 2].pic]).size).toBe(3);
    }
  });
});

describe("涂色小屋 1.2 · 撤销与重做", () => {
  it("落笔 / 撤销 / 重做 / 清空：栈的每一步都对得上", () => {
    const h = new PaintHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();

    h.push({ region: "roof", from: null, to: "红色" });
    h.push({ region: "wall", from: null, to: "黄色" });
    expect(h.size).toBe(2);
    expect(h.canUndo).toBe(true);

    expect(h.undo()).toEqual({ region: "wall", from: null, to: "黄色" });
    expect(h.size).toBe(1);
    expect(h.canRedo).toBe(true);
    expect(h.redoSize).toBe(1);

    expect(h.redo()).toEqual({ region: "wall", from: null, to: "黄色" });
    expect(h.canRedo).toBe(false);

    // 撤销之后又落了新的一笔，原来那一摞重做就作废了
    h.undo();
    h.push({ region: "wall", from: null, to: "蓝色" });
    expect(h.canRedo).toBe(false);
    expect(h.replay()).toEqual({ roof: "红色", wall: "蓝色" });

    h.clear();
    expect(h.size).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.replay()).toEqual({});
  });

  it("replay 从空白重放：撤销到底就真的回到一块没涂的样子", () => {
    const h = new PaintHistory();
    h.push({ region: "sun", from: null, to: "黄色" });
    h.push({ region: "sun", from: "黄色", to: "橙色" });
    expect(h.replay()).toEqual({ sun: "橙色" });
    h.undo();
    expect(h.replay()).toEqual({ sun: "黄色" });
    h.undo();
    expect(h.replay()).toEqual({});
    expect(h.canUndo).toBe(false);
  });
});

describe("涂色小屋 1.2 · 自由涂色沙盒的存档", () => {
  it("存进去读出来还是那一张，key 走 yiduo-yixing. 前缀", () => {
    expect(SANDBOX_KEY.startsWith("yiduo-yixing.")).toBe(true);
    const store = memoryStore();
    expect(loadWorks(store)).toEqual([]);
    const work = { pic: 3, fills: { moon: "浅黄", tent: "深红" }, at: 1234 };
    const res = saveWork(store, work);
    expect(res).toEqual({ saved: true, full: false, works: [work] });
    expect(loadWorks(store)).toEqual([work]);
    expect(store.map.has(SANDBOX_KEY)).toBe(true);
  });

  it("最多 12 张：第 13 张不静默丢掉，而是回一个 full 让界面问孩子换哪张", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_WORKS; i++) {
      const res = saveWork(store, { pic: i % PICTURES.length, fills: { a: "红色" }, at: i });
      expect(res.saved).toBe(true);
    }
    expect(loadWorks(store)).toHaveLength(MAX_WORKS);
    expect(isFull(loadWorks(store))).toBe(true);
    const extra = saveWork(store, { pic: 0, fills: { a: "蓝色" }, at: 99 });
    expect(extra.saved).toBe(false);
    expect(extra.full).toBe(true);
    // 一张都没被顶掉
    expect(loadWorks(store)).toHaveLength(MAX_WORKS);
    expect(loadWorks(store)[0].at).toBe(0);
  });

  it("替换与删除：挑一张换掉就只动那一张，越界的下标当没这回事", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_WORKS; i++) saveWork(store, { pic: 0, fills: { a: "红色" }, at: i });
    const fresh = { pic: 5, fills: { b: "紫色" }, at: 777 };
    const replaced = replaceWork(store, 4, fresh);
    expect(replaced.saved).toBe(true);
    expect(loadWorks(store)[4]).toEqual(fresh);
    expect(loadWorks(store)).toHaveLength(MAX_WORKS);
    expect(replaceWork(store, 99, fresh).saved).toBe(false);
    expect(removeWork(store, 4)).toHaveLength(MAX_WORKS - 1);
    expect(loadWorks(store).some((w) => w.at === 777)).toBe(false);
    expect(removeWork(store, -1)).toHaveLength(MAX_WORKS - 1);
  });

  it("沙盒与闯关进度是两本账：清作品不动进度，清进度也不动作品", () => {
    const store = memoryStore();
    const progressKey = "yiduo-yixing.l99.color-fun";
    store.setItem(progressKey, JSON.stringify([3, 2, 1]));
    saveWork(store, { pic: 0, fills: { a: "红色" }, at: 1 });
    // 沙盒这一路只碰自己的 key
    expect([...store.map.keys()].sort()).toEqual([progressKey, SANDBOX_KEY].sort());
    store.removeItem?.(SANDBOX_KEY);
    expect(store.getItem(progressKey)).toBe(JSON.stringify([3, 2, 1]));
    expect(loadWorks(store)).toEqual([]);
    // 反过来，沙盒代码里一个 key 都没写死进度那一路（注释里说明两者分开不算）
    const code = read("sandbox.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(code).not.toContain("l99.");
    expect([...code.matchAll(/"yiduo-yixing\.[^"]*"/g)].map((m) => m[0])).toEqual([`"${SANDBOX_KEY}"`]);
    const uiCode = SANDBOX_UI_SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(uiCode).not.toContain("ctx.win");
    expect(uiCode).not.toContain("bonusStars");
  });

  it("存档坏了也不炸：整不出来的一律丢掉，超量的只留 12 张", () => {
    expect(normalizeWorks("这不是数组")).toEqual([]);
    expect(normalizeWorks([null, 7, { pic: "三" }, { pic: 1 }])).toEqual([{ pic: 1, fills: {}, at: 0 }]);
    expect(normalizeWorks([{ pic: 0, fills: { a: 5, b: "红色" }, at: 8 }])).toEqual([
      { pic: 0, fills: { b: "红色" }, at: 8 },
    ]);
    expect(normalizeWorks(Array.from({ length: 40 }, () => ({ pic: 0 })))).toHaveLength(MAX_WORKS);
    const broken: StorageLike = { getItem: () => "{坏掉的 JSON", setItem: () => undefined };
    expect(loadWorks(broken)).toEqual([]);
    // 存不进去（隐私模式）也不该把画室弄崩
    const readonlyStore: StorageLike = { getItem: () => null, setItem: () => { throw new Error("配额满了"); } };
    expect(() => saveWork(readonlyStore, { pic: 0, fills: {}, at: 0 })).not.toThrow();
    expect(loadWorks(null)).toEqual([]);
  });
});

describe("涂色小屋 1.2 · 色盲友好：色块永远配着色名", () => {
  it("每个色块都是「色块 + 中文色名」两件套，无障碍标签也是色名", () => {
    const doc = stubDoc();
    for (const p of PIGMENTS) {
      const btn = makeSwatch(doc, p.name) as unknown as StubEl;
      expect(btn.getAttribute("aria-label")).toBe(p.name);
      expect(btn.title).toBe(p.name);
      expect(btn.className).toContain("clf-swatch");
      // 冒烟脚本按 1.0 的老类名点色块，别名得留着
      expect(btn.className).toContain("cf-swatch");
      const dot = btn.children[0];
      const label = btn.children[1];
      expect(dot.className).toBe("clf-swatch-dot");
      expect(dot.style.background).toBe(p.hex);
      expect(label.className).toBe("clf-swatch-name");
      expect(label.textContent, `${p.name} 的色块底下没写色名`).toBe(p.name);
    }
  });

  it("调色锅的原料按钮也带色名，aria-label 与冒烟脚本对得上", () => {
    const doc = stubDoc();
    for (const name of ["红色", "黄色", "蓝色", "白色", "黑色"]) {
      const btn = makePrimary(doc, name) as unknown as StubEl;
      expect(btn.getAttribute("aria-label")).toBe(`倒入${name}`);
      expect(btn.className).toContain("cf-mix-primary");
      expect(btn.children[1].textContent).toBe(name);
      expect(btn.children[0].style.background).toBe(PIGMENT_HEX[name]);
    }
  });

  it("指令小条：既有色块也有色名，光看形状也认得出该涂什么", () => {
    const doc = stubDoc();
    const chip = makeChip(doc, "屋顶 → 深蓝", "深蓝") as unknown as StubEl;
    expect(chip.className).toBe("clf-chip");
    expect(chip.children[0].className).toBe("clf-chip-dot");
    expect(chip.children[0].style.background).toBe(PIGMENT_HEX["深蓝"]);
    expect(chip.text).toContain("深蓝");
    // 规则关不给色块，只给一句关系，免得直接泄了答案
    const ruleChip = makeChip(doc, "屋顶 → 草地的互补色") as unknown as StubEl;
    expect(ruleChip.children).toHaveLength(1);
    for (const name of Object.keys(COMPLEMENT)) expect(ruleChip.text).not.toContain(name);
  });

  it("画廊缩略图是现画的 SVG，不往存档里塞图片数据", () => {
    const svg = thumbnailSvg(PICTURES[0], { roof: "红色", wall: "浅黄" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(PIGMENT_HEX["红色"]);
    expect(svg).toContain(PIGMENT_HEX["浅黄"]);
    // 没涂的块留白
    expect(svg).toContain(`fill="#ffffff"`);
    expect(svg).not.toContain("base64");
    expect(svg).not.toContain("<image");
  });
});

describe("涂色小屋 1.2 · 前 99 关一个字都没动", () => {
  it("前 99 关逐关快照（SHA-256）与升级前完全一致", () => {
    const digest = createHash("sha256")
      .update(JSON.stringify(Array.from({ length: LEGACY_LEVELS }, (_, i) => buildLevel(i))))
      .digest("hex");
    expect(digest).toBe("80ba44ff8576dad587420f07bc0e0667675907a50650f97fe1c46fc324d5cb2f");
  });

  it("前 99 关还是 1.0 的六幅线稿、四种玩法，没沾上 1.2 的任何新字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.pic).toBeLessThan(6);
      expect(["guide", "mix", "number", "memory"]).toContain(lv.mode);
      expect(lv.potInputs).toBeUndefined();
      expect(lv.potChain).toBeUndefined();
      expect(lv.orderGroups).toBeUndefined();
      expect(lv.budget).toBeUndefined();
    }
    // 基础色的色值也不许动：1.2 只改了 1.1 才有的浅色系
    expect(PIGMENT_HEX["红色"]).toBe("#ff6b6b");
    expect(PIGMENT_HEX["黄色"]).toBe("#ffe066");
    expect(PIGMENT_HEX["蓝色"]).toBe("#74c0fc");
    expect(PIGMENT_HEX["绿色"]).toBe("#8ce99a");
    expect(PIGMENT_HEX["深红"]).toBe("#e03131");
    expect(PIGMENT_HEX["金黄"]).toBe("#fab005");
    expect(PIGMENT_HEX["深蓝"]).toBe("#4263eb");
  });
});

describe("涂色小屋 1.2 · 直开第 N 关", () => {
  it("?level=N 与壳层的 initialLevel 都能直开，越界会夹回来", () => {
    expect(parseLevelParam("?level=100")).toBe(100);
    expect(parseLevelParam("#/game?level=7&x=1")).toBe(7);
    expect(parseLevelParam("?lv=7")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    expect(resolveInitialLevel(undefined, 5)).toBeNull();
    expect(resolveInitialLevel("12", 187)).toBe(11);
    expect(resolveInitialLevel(1, 187)).toBe(0);
    expect(resolveInitialLevel(999, 187)).toBe(187);
    expect(resolveInitialLevel(-4, 187)).toBe(0);
    // 还没解锁的关退到当前能玩到的最远那一关
    expect(resolveInitialLevel(150, 20)).toBe(20);
  });

  it("直开就是替玩家在地图上点一下；章节锁着或格子锁着就安静停在地图上", () => {
    const node = (label: string, cls: string[] = []): { classList: { contains(t: string): boolean }; getAttribute(n: string): string | null; click(): void; clicked: boolean } => {
      const self = {
        clicked: false,
        classList: { contains: (t: string) => cls.includes(t) },
        getAttribute: (n: string) => (n === "aria-label" ? label : null),
        click: () => { self.clicked = true; },
      };
      return self;
    };
    const tab = node("章节");
    const target = node("第 7 关，还没通关");
    const host = {
      querySelectorAll: (sel: string) => (sel.includes("l99-tab") ? [tab] : [node("第 6 关，已通关 3 星"), target]),
    };
    expect(openLevelOnMap(host, 6, 0)).toBe(true);
    expect(tab.clicked).toBe(true);
    expect(target.clicked).toBe(true);

    const locked = node("章节", ["l99-tab-lock"]);
    expect(openLevelOnMap({ querySelectorAll: () => [locked] }, 6, 0)).toBe(false);
    const lockedNode = node("第 7 关，还没解锁", ["l99-node-lock"]);
    expect(openLevelOnMap({
      querySelectorAll: (sel: string) => (sel.includes("l99-tab") ? [node("章节")] : [lockedNode]),
    }, 6, 0)).toBe(false);
    expect(openLevelOnMap({ querySelectorAll: () => [] }, 6, 0)).toBe(false);
  });
});

describe("涂色小屋 1.2 · 外壳与红线", () => {
  it("destroy 归零：timer、指针监听、操作栈、DOM 一样不留", () => {
    const body = INDEX_SRC.slice(INDEX_SRC.indexOf("    destroy() {"));
    for (const line of [
      "destroyed = true",
      "timeouts.forEach((t) => clearTimeout(t))",
      "timeouts.clear()",
      `removeEventListener("pointerdown"`,
      `removeEventListener("pointermove"`,
      `removeEventListener("pointerup"`,
      `removeEventListener("pointercancel"`,
      "pointers.clear()",
      "history.clear()",
      "wrap.remove()",
    ]) {
      expect(body, `关卡 destroy 少了 ${line}`).toContain(line);
    }
    // 画室也要收干净，外层 mount 还得顺手把画室关掉
    const sandboxBody = SANDBOX_UI_SRC.slice(SANDBOX_UI_SRC.indexOf("    destroy() {"));
    for (const line of ["timeouts.clear()", "history.clear()", "sheet.remove()"]) {
      expect(sandboxBody, `画室 destroy 少了 ${line}`).toContain(line);
    }
    expect(INDEX_SRC).toContain("closeSandbox();\n      game.destroy();");
    // 没有裸的 setTimeout / setInterval / rAF 漏在外面
    expect(INDEX_SRC).not.toContain("setInterval");
    expect(ALL_SOURCE).not.toContain("requestAnimationFrame");
    expect([...INDEX_SRC.matchAll(/setTimeout\(/g)]).toHaveLength(2);
  });

  it("1.2 追加的样式一律 clf- 前缀，老的 cf- 只作为别名挂在元素上，没有一条样式规则", () => {
    const classes = [...CLF_CSS.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(30);
    for (const cls of classes) {
      expect(cls.startsWith("clf-"), `新样式类名要 clf- 前缀：${cls}`).toBe(true);
    }
    expect(CLF_CSS).not.toMatch(/\.cf-[\w-]*\s*[,{]/);
    expect(CLF_CSS).not.toMatch(/\.(l99|qz)-[\w-]*\s*\{/);
    // 别名只在 ui.ts 里挂到 class 属性上，供只读的冒烟脚本定位
    for (const alias of ["cf-region", "cf-swatch", "cf-mix-primary"]) {
      expect(UI_SRC, `冒烟脚本要用的别名 ${alias} 不见了`).toContain(alias);
    }
    // 样式全在本款目录里：公共 styles.css 一条 clf- 规则都没有，本款也没去 import 它
    const shared = readFileSync(`${DIR}../../styles.css`, "utf8");
    expect(shared).not.toContain("clf-");
    expect(shared).not.toContain("color-fun");
    expect(ALL_SOURCE).not.toMatch(/import[^\n]*\.css/);
  });

  it("手机 360px：画布 ≥ 55% 屏高、色块热区 ≥ 44px、指令换行不截断、字号 ≥ 14px", () => {
    expect(CANVAS_MIN_VH).toBeGreaterThanOrEqual(55);
    expect(CLF_CSS).toContain(`min-height:${CANVAS_MIN_VH}vh`);
    expect(SWATCH_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(CLF_CSS).toContain(`width:${SWATCH_MIN_PX}px;height:${SWATCH_MIN_PX}px`);
    expect(CLF_CSS).toMatch(/\.clf-tool\{[^}]*min-height:44px/);
    expect(CLF_CSS).toMatch(/\.clf-zoom\{[^}]*min-width:44px;min-height:44px/);
    // 调色板横向可滑，不硬挤成两行
    expect(CLF_CSS).toMatch(/\.clf-palette\{[^}]*overflow-x:auto/);
    // 指令换行不截断
    expect(CLF_CSS).toMatch(/\.clf-msg\{[^}]*word-break:break-word/);
    expect(CLF_CSS).toMatch(/\.clf-chip\{[^}]*word-break:break-word/);
    expect(CLF_CSS).not.toContain("text-overflow:ellipsis");
    // 窄屏那一套字号仍然 ≥ 14px
    // 切片必须在这一段的右花括号处收住：`@media (max-width:400px)` 后面现在还跟着
    // 「挤一挤」那一档（`.clf-tight`，运行期才挂），一路切到文件尾会把它一起扫进来
    const narrowFrom = CLF_CSS.indexOf("@media (max-width:400px)");
    const narrow = CLF_CSS.slice(narrowFrom, CLF_CSS.indexOf("\n}", narrowFrom));
    expect(narrow).toContain(".clf-gallery");
    for (const m of narrow.matchAll(/font-size:(\d+)px/g)) {
      expect(Number(m[1]), "360px 下字号掉到 14px 以下了").toBeGreaterThanOrEqual(14);
    }
    // 小块点不准就双指放大到 2.5×
    expect(INDEX_SRC).toContain("MAX_ZOOM = 2.5");
    expect(INDEX_SRC).toContain("pointers.size === 2");
  });

  it("画布钉在滚动区顶上：滑到调色盘也看得见画，越过整块下沿就不再跟", () => {
    /**
     * 照着壳层真实的层次搭一个桩：`.l99-stage-wrap` 只裁不滚，
     * 外面的 `.game-stage` 才是真滚的那一层，所以不能碰到第一个会裁的就收手。
     */
    type PinNode = {
      overflowY: string;
      parentElement: PinNode | null;
      ownerDocument?: Document;
      style: { transform?: string };
      getBoundingClientRect: () => { top: number; height: number; bottom: number };
      addEventListener: (type: string, fn: () => void) => void;
      removeEventListener: (type: string, fn: () => void) => void;
    };
    const bound: Array<() => void> = [];
    const node = (overflowY: string, box: () => { top: number; height: number }): PinNode => ({
      overflowY,
      parentElement: null,
      style: {},
      getBoundingClientRect: () => {
        const b = box();
        return { ...b, bottom: b.top + b.height };
      },
      addEventListener: (_t, fn) => void bound.push(fn),
      removeEventListener: (_t, fn) => void bound.splice(bound.indexOf(fn), 1),
    });
    /** 画布现在被挪了多少 */
    const shift = (el: PinNode): number => Number(/translateY\(([-\d.]+)px\)/.exec(el.style.transform ?? "")?.[1] ?? 0);

    let scrolled = 0;
    const port = node("hidden", () => ({ top: 88, height: 557 }));
    const clip = node("hidden", () => ({ top: -26, height: 900 }));
    // 整块从 270 起、685 高；画布原本从 316 起、367 高，滚多少往上走多少
    const wrap = node("visible", () => ({ top: 270 - scrolled, height: 685 }));
    const stage = node("visible", () => ({ top: 316 - scrolled + shift(stage), height: 367 }));
    clip.parentElement = port;
    wrap.parentElement = clip;
    stage.parentElement = wrap;
    const view = {
      getComputedStyle: (el: PinNode) => ({ overflowY: el.overflowY }),
      addEventListener: (_t: string, fn: () => void) => void bound.push(fn),
      removeEventListener: (_t: string, fn: () => void) => void bound.splice(bound.indexOf(fn), 1),
    };
    wrap.ownerDocument = { defaultView: view } as unknown as Document;
    stage.ownerDocument = wrap.ownerDocument;
    const fire = (): void => bound.slice().forEach((fn) => fn());

    const unpin = pinCanvas(wrap as unknown as HTMLElement, stage as unknown as HTMLElement);
    // 没滚之前画布本来就在滚动区里，一动不动
    expect(shift(stage)).toBe(0);
    // 滚过头了就跟下来，正好停在滚动区上沿，不会钻到标题栏后面去
    scrolled = 400;
    fire();
    expect(stage.getBoundingClientRect().top).toBeCloseTo(88, 1);
    // 一直滚到底也不会盖住底下的调色盘：最多跟到整块的下沿
    scrolled = 2000;
    fire();
    expect(shift(stage)).toBeLessThanOrEqual(685 - (316 - 270) - 367 + 0.5);
    // destroy 之后监听全摘、位移归零
    unpin();
    expect(bound).toHaveLength(0);
    expect(stage.style.transform).toBe("");
  });

  it("画室里的每一排都不许被压扁：线稿那一排点得到（曾经只剩 4px 高）", () => {
    expect(CLF_CSS).toMatch(/\.clf-sheet>\*\{[^}]*flex:0 0 auto/);
    // 指令多的时候给个天花板，不然把画布挤到屏幕外面去
    expect(CLF_CSS).toMatch(/\.clf-chips\{[^}]*max-height:\d+px;overflow-y:auto/);
    // 画布要压在后面的控件上面，跟着滚动挪的时候才不会被盖住
    expect(CLF_CSS).toMatch(/\.clf-stage\{[^}]*z-index:2/);
  });

  it("prefers-reduced-motion：漫开与搅拌全关掉，直接换色", () => {
    expect(SPREAD_MS).toBe(120);
    expect(CLF_CSS).toContain(`transition:fill ${SPREAD_MS}ms`);
    const soft = CLF_CSS.slice(CLF_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(soft).toContain("transition:none");
    expect(soft).toContain("animation:none");
    // JS 那一头也认这个开关：搅拌只走一步，彩纸干脆不撒
    expect(INDEX_SRC).toContain("const softMotion = prefersReducedMotion()");
    expect(INDEX_SRC).toContain("const steps = softMotion ? 1 : 6");
    expect(UI_SRC).toContain("if (prefersReducedMotion()) return;");
  });

  it("涂色这件事上没有「输」：整份源码里一次 ctx.lose 都没有", () => {
    expect(ALL_SOURCE).not.toContain("ctx.lose");
    expect(ALL_SOURCE).not.toContain("onLose");
    expect(INDEX_SRC).toContain("ctx.win");
    // 涂错只记一次手误，影响的只有星级
    expect(INDEX_SRC).toContain("rateBelow(slips + refills * 2, 0, 2)");
    // 柴火烧完也只是添一把柴，不是判负
    expect(INDEX_SRC).toContain("再添一把柴");
    for (const line of ["笨", "差劲", "不行", "又错", "失败了"]) {
      expect(INDEX_SRC.includes(line), `提示语里出现了打击孩子的字眼：${line}`).toBe(false);
    }
  });

  it("meta 与事实对齐：188 关、只做闯关、blurb 说得出画室", () => {
    expect(meta.id).toBe("color-fun");
    expect(meta.levels).toBe(188);
    expect(meta.category).toBe("create");
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.platform).toBe("both");
    expect(meta.blurb).toContain("十大村镇 188 关");
    expect(meta.blurb).toContain("画室");
    expect(meta.blurb).not.toMatch(/[A-Za-z]/);
  });

  it("公共资产只读、离线可玩、不引 three.js，也没有任何商标", () => {
    // level99 只 import 进来用，没有 monkey patch
    expect(ALL_SOURCE).toContain("../level99");
    expect(ALL_SOURCE).not.toMatch(/(mountLevelGame|rateBelow|loadStars|saveStar)\s*=[^=>]/);
    expect(ALL_SOURCE).not.toMatch(/three|WebGL|webgl/i);
    expect(ALL_SOURCE).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
    expect(ALL_SOURCE).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(ALL_SOURCE).not.toMatch(/内购|付费|广告|账号登录/);
    const text = `${ALL_SOURCE}${guide.general.join("")}${guide.entries.map((e) => e.tips.join("")).join("")}`;
    for (const name of TRADEMARKS) {
      expect(text.includes(name), `出现商标：${name}`).toBe(false);
    }
  });

  it("攻略只讲方法：十章一章不少，也不写出任何一关的配色答案", () => {
    expect(guide.gameId).toBe(meta.id);
    expect(guide.entries).toHaveLength(10);
    const tips = [...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("");
    // 不点名任何一关的区域与它该涂的颜色
    for (const pic of PICTURES) {
      for (const r of pic.regions) {
        expect(tips.includes(`${r.name}涂`), `攻略点名了 ${r.name} 该涂什么`).toBe(false);
      }
    }
    // 不把配方直接抄给孩子（「红加黄等于橙」这种）
    for (const r of RECIPES) {
      expect(tips.includes(`${r.a}加${r.b}`), `攻略泄了配方 ${r.a}+${r.b}`).toBe(false);
      expect(tips.includes(`${r.a}+${r.b}`)).toBe(false);
    }
    for (const e of guide.entries) expect(e.tips.length).toBeGreaterThanOrEqual(3);
  });
});
