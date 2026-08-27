// 朵星台球 · 无头冒烟:不开浏览器,把整款游戏挂起来再拆掉。
//
// 这一份守三件事:
//  1. meta 与首页契约对得上(id / 分类 / 模式 / 关数 / 手游端游);
//  2. `mount(api)` 能真的挂上 188 关地图与模式条,`destroy` 之后一根监听都不剩;
//  3. 文案红线:标题、介绍、章节名、提示语里没有商标,也没有赌博和批评的说法。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { TOTAL_LEVELS } from "../level99";
import {
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
  type El,
} from "./domStub";
import GUIDE from "./guide";
import { CHAPTERS, buildEndlessLevel, buildLevel } from "./levels";
import { meta } from "./meta";
import { AI_BLURB, AI_LABEL, AI_TIERS } from "./ai";
import { FOUL_TEXT, GROUP_LABEL, POCKET_LABEL } from "./rules";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

function fakeApi(root: El) {
  const played: string[] = [];
  let stars = 0;
  return {
    api: {
      root: root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: (n: number) => (stars += n),
      getStars: () => stars,
      onWin: () => undefined,
      onLose: () => undefined,
    },
    played,
  };
}

describe("meta 契约", () => {
  it("id、分类、颜色、关数都按规格填", () => {
    expect(meta.id).toBe("pool-stars");
    expect(meta.title).toBe("朵星台球");
    expect(meta.emoji).toBe("🎱");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#CDE8D0");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.blurb.length).toBeGreaterThan(10);
    expect(meta.blurb.length).toBeLessThanOrEqual(60);
  });

  it("四种玩法都声明了，而且都是平台认识的名字", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    for (const m of meta.modes) expect(GAME_MODES).toContain(m);
  });

  it("手游端游都能玩", () => {
    expect(meta.platform).toBe("both");
  });

  it("meta 是纯数据，没有函数混进来", () => {
    for (const v of Object.values(meta)) {
      expect(typeof v).not.toBe("function");
    }
  });
});

describe("index 契约", () => {
  it("顶部 re-export 了 meta，并导出 mount", async () => {
    const mod = await import("./index");
    expect(mod.meta).toBe(meta);
    expect(typeof mod.mount).toBe("function");
  });

  it("mount 之后有球桌与模式条，destroy 之后一根监听都不剩", async () => {
    const { mount } = await import("./index");
    const before = windowListenerCount(dom);
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    expect(dom.root.children.length).toBeGreaterThan(0);
    // 模式条:人机对战 / 双人同屏 / 无尽残局
    const opens = dom.root.findAll((e) => e.className.includes("ps-open"));
    expect(opens).toHaveLength(3);
    // 188 关地图
    expect(dom.root.find((e) => e.className.includes("l99-map"))).not.toBeNull();
    flushFrames(dom, 3);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(before);
    expect(dom.root.children).toHaveLength(0);
  });

  it("进第 1 关能摆出球桌，出杆之后回到地图也清得干净", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const cont = dom.root.find((e) => e.className.includes("l99-continue"))!;
    cont.dispatch("click", {});
    expect(dom.root.find((e) => e.className.includes("ps-wrap"))).not.toBeNull();
    // 蓄力 + 击球，让球真的滚起来
    fireWindow(dom, "keydown", { key: "f", preventDefault: () => undefined });
    dom.clock.ms += 300;
    fireWindow(dom, "keyup", { key: "f" });
    flushFrames(dom, 60);
    const back = dom.root.find((e) => e.className.includes("l99-back"))!;
    back.dispatch("click", {});
    expect(dom.root.find((e) => e.className.includes("ps-wrap"))).toBeNull();
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("开无尽残局再关掉，监听不会越攒越多", async () => {
    const { mount } = await import("./index");
    const { api } = fakeApi(dom.root);
    const handle = mount(api);
    const endless = dom.root.find((e) => e.textContent.includes("无尽残局"))!;
    const baseline = windowListenerCount(dom);
    for (let i = 0; i < 3; i++) {
      endless.dispatch("click", {});
      flushFrames(dom, 5);
      const back = dom.root.find((e) => e.className.includes("ps-back"))!;
      back.dispatch("click", {});
    }
    expect(windowListenerCount(dom)).toBe(baseline);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });
});

describe("文案红线", () => {
  /** 台球相关的商业名号一个都不许出现（含品牌、赛事、商业 App） */
  const BANNED = [
    "斯诺克世锦赛",
    "中式八球国际大师赛",
    "星牌",
    "乔氏",
    "来力",
    "台球助手",
    "开云",
    "俄罗斯方块",
    "愤怒的小鸟",
    "水果忍者",
    "超级玛丽",
    "马里奥",
    "吃豆人",
    "宝可梦",
    "皮卡丘",
    "奥特曼",
    "喜羊羊",
    "蛋仔",
    "原神",
    "王者荣耀",
    "我的世界",
    "minecraft",
    "tetris",
    "pac-man",
  ];
  /** 赌博与批评的说法也一个都不许有 */
  const UGLY = ["下注", "赌", "筹码", "输光", "彩池", "笨", "蠢", "废物", "没用"];

  function allText(): string[] {
    const out: string[] = [meta.title, meta.blurb, GUIDE.title, ...GUIDE.general];
    for (const e of GUIDE.entries) {
      out.push(e.title, ...e.tips);
    }
    for (const c of CHAPTERS) out.push(c.name, c.desc);
    for (let i = 0; i < 188; i += 17) out.push(buildLevel(i).hint);
    out.push(buildEndlessLevel(3).hint);
    out.push(...Object.values(FOUL_TEXT), ...Object.values(GROUP_LABEL), ...POCKET_LABEL);
    for (const t of AI_TIERS) out.push(AI_LABEL[t], AI_BLURB[t]);
    return out.filter((s) => s.length > 0);
  }

  it("全部可见文案不沾任何商标", () => {
    for (const line of allText()) {
      const low = line.toLowerCase();
      for (const w of BANNED) {
        expect(low.includes(w.toLowerCase()), `「${w}」出现在:${line}`).toBe(false);
      }
    }
  });

  it("没有赌博元素，也没有批评孩子的话", () => {
    for (const line of allText()) {
      for (const w of UGLY) {
        expect(line.includes(w), `「${w}」出现在:${line}`).toBe(false);
      }
    }
  });

  it("攻略结构完整：3–6 条通用心得、八章条目、覆盖第 1 关到第 188 关", () => {
    expect(GUIDE.gameId).toBe(meta.id);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(3);
    expect(GUIDE.general.length).toBeLessThanOrEqual(6);
    expect(GUIDE.entries).toHaveLength(8);
    expect(GUIDE.entries[0].from).toBe(1);
    expect(GUIDE.entries[GUIDE.entries.length - 1].to).toBe(188);
    for (const e of GUIDE.entries) {
      expect(e.from).toBeLessThanOrEqual(e.to);
      expect(e.tips.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("360px 下每一行提示都不长到会溢出", () => {
    for (const line of allText()) {
      expect(line.length, `这一句在 360px 上太长了:${line}`).toBeLessThanOrEqual(64);
    }
  });
});
