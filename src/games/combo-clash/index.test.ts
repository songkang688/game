import { describe, expect, it } from "vitest";
import { duoKey, heldToInput, meta, starKey } from "./index";
import { CHARACTER_IDS } from "./frames";
import { GAME_MODES } from "../../engine/types";

function held(patch: Partial<Record<"left" | "right" | "up" | "down" | "light" | "heavy" | "burst", boolean>> = {}) {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    light: false,
    heavy: false,
    burst: false,
    ...patch
  };
}

describe("combo-clash · meta 是纯数据卡片", () => {
  it("按规格落地,一个字段都不缺", () => {
    expect(meta.id).toBe("combo-clash");
    expect(meta.title).toBe("连招对决");
    expect(meta.emoji).toBe("💫");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#FFD6EA");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(meta.blurb.length).toBeGreaterThan(10);
  });

  it("四种模式都是壳认识的模式名", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    for (const m of meta.modes) expect(GAME_MODES as readonly string[]).toContain(m);
  });

  it("介绍里只提元气,不提血", () => {
    expect(meta.blurb).toContain("元气");
    expect(meta.blurb).not.toMatch(/血|伤害|死/);
  });
});

describe("combo-clash · 双人键位", () => {
  it("朵朵是 WASD + F 轻 + G 重", () => {
    expect(duoKey("a")).toBe("left");
    expect(duoKey("d")).toBe("right");
    expect(duoKey("w")).toBe("up");
    expect(duoKey("s")).toBe("down");
    expect(duoKey("f")).toBe("light");
    expect(duoKey("g")).toBe("heavy");
  });

  it("星星是方向键 + L 轻 + K 重", () => {
    expect(starKey("ArrowLeft")).toBe("left");
    expect(starKey("ArrowRight")).toBe("right");
    expect(starKey("ArrowUp")).toBe("up");
    expect(starKey("ArrowDown")).toBe("down");
    expect(starKey("l")).toBe("light");
    expect(starKey("k")).toBe("heavy");
  });

  it("两套键位互不打架,同屏双人不会抢键", () => {
    for (const k of ["a", "d", "w", "s", "f", "g"]) expect(starKey(k)).toBeNull();
    for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "l", "k"]) expect(duoKey(k)).toBeNull();
  });

  it("没绑的键一律不认", () => {
    for (const k of ["z", "Enter", " ", "Escape", "1"]) {
      expect(duoKey(k)).toBeNull();
      expect(starKey(k)).toBeNull();
    }
  });
});

describe("combo-clash · 键位转成引擎输入", () => {
  it("轻重同按就是必杀钮,少一个按钮也玩得转", () => {
    expect(heldToInput(held({ light: true, heavy: true })).burst).toBe(true);
    expect(heldToInput(held({ light: true })).burst).toBe(false);
    expect(heldToInput(held({ heavy: true })).burst).toBe(false);
  });

  it("触屏的独立必杀钮也能直接给出必杀钮", () => {
    expect(heldToInput(held({ burst: true })).burst).toBe(true);
  });

  it("方向原样传过去,不会漏键", () => {
    const f = heldToInput(held({ left: true, down: true }));
    expect(f.left).toBe(true);
    expect(f.down).toBe(true);
    expect(f.right).toBe(false);
    expect(f.up).toBe(false);
  });

  it("什么都不按就是一帧空输入", () => {
    expect(Object.values(heldToInput(held()))).toEqual(Array(7).fill(false));
  });
});

describe("combo-clash · 十位原创小伙伴", () => {
  it("至少十个人,而且 id 不重样", () => {
    expect(CHARACTER_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CHARACTER_IDS).size).toBe(CHARACTER_IDS.length);
  });

  it("朵朵和星星都在名单里", () => {
    expect(CHARACTER_IDS).toContain("duoduo");
    expect(CHARACTER_IDS).toContain("xingxing");
  });
});
