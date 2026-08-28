/**
 * 三人组 r11 · N-45 gold-hook 关内商店 veil（配方 I）
 *
 * 滚动边界切在货架与「接着挖」之间：货架自滚，关闭钮钉在 footer。
 * 买卖逻辑 / SHOP 表 / 关内金币零触碰。暂停 veil 不挂商店类。
 */
import { afterEach, describe, expect, it } from "vitest";
import { CSS } from "./style";
import { SHOP, SHOP_KINDS } from "./logic";
import { findButton, install, walk, type FakeEl, type Harness } from "./domStub";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

function elByClass(root: FakeEl, cls: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (el) => {
    if (!hit && el.className.split(/\s+/).includes(cls)) hit = el;
  });
  return hit;
}

async function mountCampaign(h: Harness): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    initialLevel: 1,
  } as never);
}

describe("N-45 gold-hook 商店 veil 配方 I", () => {
  it("货架单独 overflow，footer sticky，「接着挖」不跟 veil 整块滚", () => {
    expect(CSS).toContain(".gdh-veil--shop{overflow:hidden");
    expect(CSS).toContain(".gdh-veil--shop .gdh-shoplist{flex:1 1 auto;min-height:0;overflow-y:auto");
    expect(CSS).toContain(".gdh-shopfoot{flex:none;position:sticky;bottom:0");
    expect(CSS).toContain("background:#FFFBF4");
    expect(CSS).toContain(".gdh-veil{");
    expect(CSS).toContain("z-index:6");
    expect(CSS).toContain(".gdh-ctrl{");
    expect(CSS).toMatch(/\.gdh-ctrl\{[^}]*z-index:3/);
  });

  it("SHOP 表三件、价目函数入口没被商店结构改掉", () => {
    expect(SHOP_KINDS).toEqual(["bomb", "power", "luck"]);
    expect(SHOP.bomb.max).toBeGreaterThan(0);
    expect(SHOP.power.max).toBeGreaterThan(0);
    expect(SHOP.luck.max).toBeGreaterThan(0);
  });

  it("进关点商店：三件买钮 + 接着挖在 footer，关 veil 后暂停仍点得到", async () => {
    const h = install();
    harness = h;
    const game = await mountCampaign(h);
    h.flush(3);

    const shopBtn = findButton(h.root, "商店");
    expect(shopBtn).not.toBeNull();
    shopBtn?.fire("click");

    const veil = elByClass(h.root, "gdh-veil");
    expect(veil?.className.split(/\s+/)).toContain("gdh-veil--shop");
    expect(elByClass(h.root, "gdh-shophead")).not.toBeNull();
    const list = elByClass(h.root, "gdh-shoplist");
    expect(list?.children.length).toBe(3);
    const foot = elByClass(h.root, "gdh-shopfoot");
    expect(foot).not.toBeNull();
    const close = findButton(h.root, "接着挖");
    expect(close).not.toBeNull();
    expect(close?.parent).toBe(foot);

    close?.fire("click");
    expect(veil?.hidden).toBe(true);
    expect(veil?.className.split(/\s+/)).not.toContain("gdh-veil--shop");

    findButton(h.root, "暂停")?.fire("click");
    expect(elByClass(h.root, "gdh-veil")?.className.split(/\s+/)).not.toContain("gdh-veil--shop");
    const resume = findButton(h.root, "继续挖");
    expect(resume).not.toBeNull();
    resume?.fire("click");
    expect(elByClass(h.root, "gdh-veil")?.hidden).toBe(true);

    game.destroy();
  });
});
