// 窗口3 · 第 2 轮监督修复:A 档 N-01 / B 档 round2 建议 3(最低成本方案)——
// 对局座位条的 AI 一侧加画制棋灵头像,座位名的 emoji 前缀改由头像承担;
// 菜单按钮与 DIFFICULTY_NAME 常量一字未动(tiers.test 继续钉住原文)。
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 先把游戏壳连同 engine 在「document 还不存在」时载入,它顶层的监听守卫才会跳过
// (与 smoke.test.ts 同一手法);真正的 ./index 在装好 DOM 桩之后再动态 import。
import "../level99";
import { DIFFICULTIES, DIFFICULTY_NAME } from "./ai";
import { spiritAvatarSVG, type SpiritTier } from "./art";
import { installDom, restoreDom, type Dom, type El } from "./domStub";

const indexSrc = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("棋灵头像 · 纯 SVG 资产(N-01)", () => {
  it("六档各出一张,两两不同,全部 aria-hidden 且渐变 id 按档隔离", () => {
    const svgs = DIFFICULTIES.map((d) => spiritAvatarSVG(d, 20));
    expect(new Set(svgs).size).toBe(6);
    for (let i = 0; i < svgs.length; i++) {
      expect(svgs[i]).toContain("<svg");
      expect(svgs[i]).toContain('aria-hidden="true"');
      expect(svgs[i]).toContain(`id="gmk-sp-${DIFFICULTIES[i]}"`);
    }
  });

  it("头像本身零 emoji(不是把 emoji 塞进 SVG 文本里)", () => {
    for (const d of DIFFICULTIES) {
      expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(spiritAvatarSVG(d, 20))).toBe(false);
    }
  });

  it("与座位棋子同一套玉石材质:投影 + 三档径向渐变 + 左上 -32° 高光", () => {
    const svg = spiritAvatarSVG("easy", 20);
    expect(svg).toContain('fill="rgba(120,80,40,.28)"'); // 同 stoneIconSVG 的投影色
    expect(svg).toContain('<radialGradient id="gmk-sp-easy" cx="0.36" cy="0.32" r="0.95">');
    expect(svg).toContain('transform="rotate(-32 ');
  });

  it("渊档换黑玉渐变面 + 闭目星点;其余五档贝壳白面", () => {
    const hell = spiritAvatarSVG("hell", 20);
    expect(hell).toContain('stop-color="#8E7E92"'); // STONE_BLACK 高光档
    expect(hell).toContain('stop-color="#2E2837"');
    for (const d of ["novice", "easy", "normal", "smart", "master"] as SpiritTier[]) {
      expect(spiritAvatarSVG(d, 20)).toContain('stop-color="#FFFFFF"'); // STONE_WHITE 高光档
    }
  });

  it("特征剪影按档互异:苗有芽茎、喵有 w 嘴、狐有白吻、龙有金角、象有卷鼻、渊有星点", () => {
    expect(spiritAvatarSVG("novice", 20)).toContain('stroke="#5E8C4A"');
    expect(spiritAvatarSVG("easy", 20)).toContain("Q22.6 31.9 24 30");
    expect(spiritAvatarSVG("normal", 20)).toContain('fill="#FFF9EE"');
    expect(spiritAvatarSVG("smart", 20)).toContain('fill="#E8C57C"');
    expect(spiritAvatarSVG("master", 20)).toContain("M22.8 29 C22 32");
    expect(spiritAvatarSVG("hell", 20)).toContain('fill="#CBB8E8"');
  });

  it("尺寸参数直通宽高", () => {
    expect(spiritAvatarSVG("novice", 24)).toContain('width="24" height="24"');
  });
});

// --------------------------------------------------------------------------
// 挂载态:AI 落座的一侧有头像,双人局没有;DIFFICULTY_NAME 常量原文未动
// --------------------------------------------------------------------------

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom();
});

function fakeApi(root: El): {
  root: HTMLElement;
  play: (n: string) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, msg?: string) => void;
  onLose: (msg?: string) => void;
} {
  let stars = 0;
  return {
    root: root as unknown as HTMLElement,
    play: () => undefined,
    addStars: (n: number) => (stars += n),
    getStars: () => stars,
    onWin: () => undefined,
    onLose: () => undefined,
  };
}

function findByText(root: El, text: string): El | null {
  return root.find((e) => e.tagName === "button" && e.textContent.includes(text));
}

async function openTable(opponent: string): Promise<{ destroy: () => void }> {
  const { mount } = await import("./index");
  const handle = mount(fakeApi(dom.root));
  findByText(dom.root, "自由对战")!.dispatch("click", {});
  findByText(dom.root, opponent)!.dispatch("click", {});
  findByText(dom.root, "开始下棋")!.dispatch("click", {});
  return handle;
}

describe("棋灵头像 · 座位条接线(N-01)", () => {
  it("人机局:AI 座位有画制头像,座位名去掉 emoji 前缀但档位全名保留", async () => {
    const handle = await openTable(DIFFICULTY_NAME.novice);
    const seats = dom.root.querySelectorAll(".gmk-seat");
    expect(seats.length).toBe(2);
    const spirit = seats[1].querySelector(".gmk-seat-spirit");
    expect(spirit).not.toBeNull();
    expect(spirit!.innerHTML).toContain("<svg");
    expect(spirit!.getAttribute("aria-hidden")).toBe("true");
    const name = seats[1].querySelector(".gmk-seat-name")!;
    expect(name.textContent).toBe("棋灵苗·菜鸟");
    expect(name.textContent.includes("🐣")).toBe(false);
    // 玩家侧不挂头像,棋子小图标两侧照旧
    expect(seats[0].querySelector(".gmk-seat-spirit")).toBeNull();
    expect(seats[0].querySelector(".gmk-seat-ico")!.innerHTML).toContain("<svg");
    expect(seats[1].querySelector(".gmk-seat-ico")!.innerHTML).toContain("<svg");
    handle.destroy();
  });

  it("双人局:两侧都不挂棋灵头像(没有 AI 就没有对手脸)", async () => {
    const handle = await openTable("朵朵 VS 星星");
    const seats = dom.root.querySelectorAll(".gmk-seat");
    for (const s of seats) expect(s.querySelector(".gmk-seat-spirit")).toBeNull();
    handle.destroy();
  });

  it("菜单难度按钮原文未动:六档 DIFFICULTY_NAME(含 emoji 前缀)仍逐字可寻", async () => {
    const { mount } = await import("./index");
    const handle = mount(fakeApi(dom.root));
    findByText(dom.root, "自由对战")!.dispatch("click", {});
    for (const d of DIFFICULTIES) {
      expect(findByText(dom.root, DIFFICULTY_NAME[d])).not.toBeNull();
    }
    handle.destroy();
  });
});

describe("棋灵头像 · 源码钉子", () => {
  it("座位条走 spiritAvatarSVG,emoji 前缀由正则剥离(常量本身不改)", () => {
    expect(indexSrc).toContain("spiritAvatarSVG(o.ai, 20)");
    expect(indexSrc).toContain('names[p - 1].replace(/^\\S+\\s+/, "")');
    expect(indexSrc).toContain('const aiSeat = o.ai && !o.puzzle ? (o.human === 2 ? 1 : 2) : 0;');
  });
});
