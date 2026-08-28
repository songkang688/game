// 参数化矢量鱼 · kit 单测:纯函数契约 + 记录式画布桩,不碰真 DOM。
import { describe, expect, it } from "vitest";
import {
  FISH_GOLD,
  FISH_PATTERN_MIN_PX,
  FISH_SPECS,
  TAIL_WAG_RAD,
  type Fish2D,
  type FishSpec,
  depthFade,
  drawKitFish,
  facingOf,
  fishColor,
  fishSilhouette,
  specForFish,
  tailWagPhase,
} from "./fishArt";

/** 记录式 2D 画布桩:数每种调用、记参数与填色/描边历史,供断言用 */
function stub(): {
  ctx: Fish2D;
  calls: string[];
  args: Record<string, number[][]>;
  fills: unknown[];
  strokes: unknown[];
  stops: string[];
  count: (name: string) => number;
} {
  const calls: string[] = [];
  const args: Record<string, number[][]> = {};
  const fills: unknown[] = [];
  const strokes: unknown[] = [];
  const stops: string[] = [];
  const rec = (name: string, ...a: number[]): void => {
    calls.push(name);
    (args[name] ??= []).push(a);
  };
  const ctx: Fish2D = {
    lineWidth: 0,
    lineCap: "",
    globalAlpha: 1,
    set fillStyle(v: unknown) {
      fills.push(v);
    },
    get fillStyle(): unknown {
      return fills[fills.length - 1];
    },
    set strokeStyle(v: unknown) {
      strokes.push(v);
    },
    get strokeStyle(): unknown {
      return strokes[strokes.length - 1];
    },
    save: () => rec("save"),
    restore: () => rec("restore"),
    translate: (x, y) => rec("translate", x, y),
    rotate: (r) => rec("rotate", r),
    scale: (x, y) => rec("scale", x, y),
    beginPath: () => rec("beginPath"),
    closePath: () => rec("closePath"),
    moveTo: (x, y) => rec("moveTo", x, y),
    lineTo: (x, y) => rec("lineTo", x, y),
    quadraticCurveTo: (a, b, c, d) => rec("quadraticCurveTo", a, b, c, d),
    arc: (x, y, r, a0, a1) => rec("arc", x, y, r, a0, a1),
    ellipse: (x, y, rx, ry, rot, a0, a1) => rec("ellipse", x, y, rx, ry, rot, a0, a1),
    fill: () => rec("fill"),
    stroke: () => rec("stroke"),
    createLinearGradient: (...a) => {
      rec("createLinearGradient", ...a);
      return { addColorStop: (_o, c) => stops.push(c) };
    },
  };
  return { ctx, calls, args, fills, strokes, stops, count: (name) => calls.filter((c) => c === name).length };
}

function byKey(key: string): FishSpec {
  const spec = FISH_SPECS.find((s) => s.key === key);
  if (!spec) throw new Error(`没有鱼种 ${key}`);
  return spec;
}

describe("鱼种 spec 表", () => {
  it("6–8 个鱼种,宽高比 0.9–1.6,尾形/花纹枚举合法", () => {
    expect(FISH_SPECS.length).toBeGreaterThanOrEqual(6);
    expect(FISH_SPECS.length).toBeLessThanOrEqual(8);
    for (const s of FISH_SPECS) {
      expect(s.aspect).toBeGreaterThanOrEqual(0.9);
      expect(s.aspect).toBeLessThanOrEqual(1.6);
      expect(["fork", "round", "fan"]).toContain(s.tail);
      expect(["stripes", "dots", "plain", "gold"]).toContain(s.skin);
      expect(s.hue).toBeGreaterThanOrEqual(0);
      expect(s.hue).toBeLessThanOrEqual(360);
    }
  });

  it("体型 × 尾形 × 花纹三元组两两不同,三种尾形与四种花纹都有人用", () => {
    const seen = new Set<string>();
    for (const s of FISH_SPECS) {
      const sig = `${s.aspect}|${s.tail}|${s.skin}`;
      expect(seen.has(sig), `重复的鱼种签名 ${sig}`).toBe(false);
      seen.add(sig);
    }
    expect(new Set(FISH_SPECS.map((s) => s.tail)).size).toBe(3);
    expect(new Set(FISH_SPECS.map((s) => s.skin)).size).toBe(4);
  });

  it("稀有金鳞用的是 kit 统一金色", () => {
    expect(FISH_GOLD).toBe("#F0C25A");
    expect(FISH_SPECS[FISH_SPECS.length - 1].skin).toBe("gold");
  });
});

describe("鱼种剪影两两不同(抽 3 对)", () => {
  const pairs: [string, string][] = [
    ["minnow", "pudge"],
    ["darter", "blossom"],
    ["amber", "king"],
  ];
  for (const [a, b] of pairs) {
    it(`${a} 与 ${b} 的剪影差异显著`, () => {
      const sa = fishSilhouette(byKey(a), 20);
      const sb = fishSilhouette(byKey(b), 20);
      expect(sa.length).toBe(sb.length);
      let diff = 0;
      for (let i = 0; i < sa.length; i++) {
        diff += Math.abs(sa[i].x - sb[i].x) + Math.abs(sa[i].y - sb[i].y);
      }
      expect(diff).toBeGreaterThan(10);
    });
  }

  it("15px 灰度可辨:最小渲染尺寸下体型/尾形双通道仍有差", () => {
    const sa = fishSilhouette(byKey("pudge"), 13);
    const sb = fishSilhouette(byKey("darter"), 13);
    let diff = 0;
    for (let i = 0; i < sa.length; i++) diff += Math.abs(sa[i].y - sb[i].y);
    expect(diff).toBeGreaterThan(5);
  });
});

describe("摆尾与朝向", () => {
  it("摆尾相位公式 = x × 0.05 + speed × 2", () => {
    expect(tailWagPhase(100, 0.05)).toBeCloseTo(100 * 0.05 + 0.05 * 2, 10);
    expect(tailWagPhase(0, 0)).toBe(0);
    expect(tailWagPhase(40, -0.03)).toBeCloseTo(40 * 0.05 - 0.06, 10);
  });

  it("摆幅 ±14°,尾鳍旋转吃的正是 sin(相位)×摆幅", () => {
    expect(TAIL_WAG_RAD).toBeCloseTo((14 * Math.PI) / 180, 10);
    const s = stub();
    drawKitFish(s.ctx, 0, 0, 20, byKey("minnow"), { wagPhase: Math.PI / 2 });
    expect(s.args.rotate?.[0]?.[0]).toBeCloseTo(TAIL_WAG_RAD, 10);
  });

  it("朝向随速度符号翻转:speed<0 朝左,scaleX 翻 -1", () => {
    expect(facingOf(0.04)).toBe(1);
    expect(facingOf(-0.02)).toBe(-1);
    expect(facingOf(0)).toBe(1);
    const s = stub();
    drawKitFish(s.ctx, 0, 0, 20, byKey("minnow"), { facing: facingOf(-0.02) });
    expect(s.args.scale?.[0]).toEqual([-1, 1]);
  });
});

describe("深水映射(只读 depth)", () => {
  it("最深处饱和度 -30%、alpha 0.7;水面处不衰减", () => {
    expect(depthFade(0, 50)).toEqual({ sat: 1, alpha: 1 });
    const deep = depthFade(50, 50);
    expect(deep.sat).toBeCloseTo(0.7, 10);
    expect(deep.alpha).toBeCloseTo(0.7, 10);
  });

  it("中间深度线性过渡,越界自动夹住", () => {
    expect(depthFade(25, 50).sat).toBeCloseTo(0.85, 10);
    expect(depthFade(999, 50).alpha).toBeCloseTo(0.7, 10);
    expect(depthFade(-5, 50).sat).toBe(1);
  });

  it("饱和度缩放真的落进了 hsl 颜色里", () => {
    const spec = byKey("minnow");
    expect(fishColor(spec, 1, 0)).toBe(`hsl(${spec.hue},${spec.sat}%,${spec.light}%)`);
    expect(fishColor(spec, 0.7, 0)).toContain(`${Math.round(spec.sat * 0.7)}%`);
  });
});

describe("花纹层门槛(< 15px 省略,体型差保留)", () => {
  it("门槛常量 = 15px", () => {
    expect(FISH_PATTERN_MIN_PX).toBe(15);
  });

  it("14px 条纹鱼不画条纹,20px 画(stroke 次数分支)", () => {
    const small = stub();
    drawKitFish(small.ctx, 0, 0, 14, byKey("minnow"));
    const big = stub();
    drawKitFish(big.ctx, 0, 0, 20, byKey("minnow"));
    // 身体描边 + 微笑嘴 = 2 次;条纹层再加 3 次
    expect(small.count("stroke")).toBe(2);
    expect(big.count("stroke")).toBe(5);
  });

  it("小尺寸下身体/尾鳍/眼睛照画(体型 + 尾形双通道保留)", () => {
    const s = stub();
    drawKitFish(s.ctx, 0, 0, 13, byKey("pudge"));
    expect(s.count("fill")).toBeGreaterThanOrEqual(5);
    expect(s.count("arc")).toBeGreaterThanOrEqual(4);
  });
});

describe("金鳞与金光", () => {
  it("传说鱼种画金鳞:填色历史里出现 kit 金色", () => {
    const s = stub();
    drawKitFish(s.ctx, 0, 0, 22, byKey("king"));
    expect(s.fills).toContain(FISH_GOLD);
  });

  it("goldEdge 金光描边:多一道金色 stroke,0 时不画", () => {
    const on = stub();
    drawKitFish(on.ctx, 0, 0, 22, byKey("pudge"), { goldEdge: 0.8 });
    const off = stub();
    drawKitFish(off.ctx, 0, 0, 22, byKey("pudge"), { goldEdge: 0 });
    expect(on.count("stroke")).toBe(off.count("stroke") + 1);
    expect(on.strokes).toContain(FISH_GOLD);
  });
});

describe("鱼种指派", () => {
  it("同一条鱼 id 永远同一副皮(确定性)", () => {
    expect(specForFish("yueya-ji", 1)).toBe(specForFish("yueya-ji", 1));
    expect(specForFish("moyu-man", 3)).toBe(specForFish("moyu-man", 3));
  });

  it("传说(rarity≥5)固定金鳞,普通鱼拿不到金鳞", () => {
    expect(specForFish("yueguang-jing", 5).skin).toBe("gold");
    for (const id of ["yueya-ji", "caoye-bo", "luoxia-lin", "xingsha-yao", "tiqin-li"]) {
      expect(specForFish(id, 4).skin).not.toBe("gold");
    }
  });

  it("一群 id 摊到至少 4 个不同鱼种上(不是人人撞脸)", () => {
    const ids = ["yueya-ji", "tangshuang-li", "caoye-bo", "luwei-zhen", "yunwen-zun", "moyu-man", "xingsha-yao", "tiejia-xia"];
    const keys = new Set(ids.map((id) => specForFish(id, 2).key));
    expect(keys.size).toBeGreaterThanOrEqual(4);
  });

  it("眼睛 + 高光 + 微笑嘴永远都在(全程开心)", () => {
    const s = stub();
    drawKitFish(s.ctx, 5, 5, 16, byKey("blossom"));
    // 眼白 / 瞳孔 / 眼高光 3 个 arc + 微笑嘴 1 个 arc + 圆点花纹 3 个
    expect(s.count("arc")).toBeGreaterThanOrEqual(4);
    const smile = s.args.arc?.find((a) => a[3] === Math.PI * 0.15 && a[4] === Math.PI * 0.85);
    expect(smile, "缺了微笑嘴").toBeTruthy();
  });
});
