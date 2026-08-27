/**
 * 头像模块回归:1.2-kk 把两位小主角改成鸭梨(女)与康康(男),
 * 图片文件名与 AVATAR_URLS 的 key 仍沿用 duoduo / xingxing(少动调用点)。
 *
 * 两块:
 *  1. 读屏拿到的 alt 必须是新名字,老名字一个都不许留;
 *  2. `src/assets/avatars/` 里那四张图确实在,且都是 512×512 的 PNG。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AVATAR_URLS, createAvatarImg, createDuoPair, type AvatarName } from "./avatars";

// ---------------------------------------------------------------------------
// 极简 DOM 桩:仓库的 vitest 跑在 node 环境(无 jsdom),只补头像用到的那几样
// ---------------------------------------------------------------------------

class FakeElement {
  children: FakeElement[] = [];
  className = "";
  alt = "";
  src = "";
  draggable = true;
  style: Record<string, string> = {};
  constructor(public tagName: string) {}
  append(...kids: FakeElement[]): void {
    this.children.push(...kids);
  }
}

const originalDocument = (globalThis as { document?: unknown }).document;

beforeEach(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => new FakeElement(tag)
  };
});

afterEach(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

const img = (name: AvatarName, opts?: Parameters<typeof createAvatarImg>[1]) =>
  createAvatarImg(name, opts) as unknown as FakeElement;

// ---------------------------------------------------------------------------
// 1. 名字与读屏文案
// ---------------------------------------------------------------------------

describe("头像的读屏文案", () => {
  it("四张图分别是鸭梨和康康,不再叫朵朵 / 星星", () => {
    expect(img("duoduo").alt).toBe("鸭梨");
    expect(img("xingxing").alt).toBe("康康");
    expect(img("duoduoCheer").alt).toBe("鸭梨在庆祝");
    expect(img("xingxingRun").alt).toBe("康康在奔跑");
  });

  it("alt 里不留旧角色名", () => {
    const alts = (Object.keys(AVATAR_URLS) as AvatarName[]).map((n) => img(n).alt);
    for (const alt of alts) {
      expect(alt).not.toContain("朵朵");
      expect(alt).not.toContain("星星");
    }
  });

  it("每个 key 都有自己的图,没有互相串图", () => {
    const urls = Object.values(AVATAR_URLS);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

// ---------------------------------------------------------------------------
// 2. 生成出来的 <img>
// ---------------------------------------------------------------------------

describe("createAvatarImg", () => {
  it("默认是圆形贴纸,而且拖不走", () => {
    const el = img("duoduo");
    expect(el.tagName).toBe("img");
    expect(el.className).toContain("avatar-img");
    expect(el.className).toContain("avatar-img--round");
    expect(el.draggable).toBe(false);
  });

  it("round: false 时不加圆形类,额外 className 会拼上去", () => {
    const el = img("xingxingRun", { round: false, className: "hero-figure" });
    expect(el.className).not.toContain("avatar-img--round");
    expect(el.className).toContain("hero-figure");
  });

  it("给了 size 就同时写宽高", () => {
    const el = img("xingxing", { size: 40 });
    expect(el.style.width).toBe("40px");
    expect(el.style.height).toBe("40px");
  });
});

describe("createDuoPair", () => {
  it("鸭梨在前、康康在后,两张都带尺寸", () => {
    const pair = createDuoPair(36) as unknown as FakeElement;
    expect(pair.className).toBe("duo-pair");
    expect(pair.children.map((c) => c.alt)).toEqual(["鸭梨", "康康"]);
    for (const c of pair.children) expect(c.style.width).toBe("36px");
  });
});

// ---------------------------------------------------------------------------
// 3. 图片文件本身
// ---------------------------------------------------------------------------

describe("头像图片资源", () => {
  const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
  const FILES = ["duoduo-q.png", "xingxing-q.png", "duoduo-cheer.png", "xingxing-run.png"];
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it.each(FILES)("%s 是一张 512×512 的 PNG", (file) => {
    const buf = readFileSync(here(`../assets/avatars/${file}`));
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    // IHDR 紧跟文件头:宽高各占 4 字节大端整数
    expect(buf.readUInt32BE(16)).toBe(512);
    expect(buf.readUInt32BE(20)).toBe(512);
    // 圆裁后还看得清五官,太小的图不行
    expect(buf.byteLength).toBeGreaterThan(20_000);
  });
});
