/**
 * puff-bros · 1.3 窗口 5 第 1 轮视觉测试员 · 机器化扫描用例。
 *
 * 由 docs/qa/1.3-window5-round1-tester.md 的六大专项沉淀成静态断言。
 * 现存 2 处 fillText:糖果收集物 emoji(报告记「严重」交 fixer)与飘字反馈 ——
 * 水位 ratchet 保证只降不升。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

const DRAW_FILES = ["index.ts", "visual13.ts"];
const drawSrc = (): string => DRAW_FILES.map(read).join("\n");

describe("puff-bros · 窗口5 第 1 轮视觉扫描(静态)", () => {
  it("专项①:emoji 码点水位只降不升(含注释与 HUD 文案,基线 89)", () => {
    const n = (drawSrc().match(/\p{Extended_Pictographic}/gu) ?? []).length;
    expect(n).toBeLessThanOrEqual(89);
  });

  it("专项①②:画布 fillText 调用水位只降不升(基线 2,糖果 emoji 待 fixer 换矢量)", () => {
    const n = (drawSrc().match(/fillText\(/g) ?? []).length;
    expect(n).toBeLessThanOrEqual(2);
  });

  it("专项⑥:商标黑名单在绘制与文案源码 0 命中", () => {
    const src = (drawSrc() + read("meta.ts") + read("guide.ts")).toLowerCase();
    const bad = [
      "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
      "超级玛丽", "马里奥", "mario", "割绳子", "俄罗斯方块", "tetris", "我的世界",
      "minecraft", "吃豆人", "pac-man", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
      "蛋仔", "原神", "王者荣耀", "任天堂", "nintendo", "迪士尼", "disney", "4399",
      "塞尔达", "zelda", "泡泡龙", "bubble bobble",
    ];
    for (const w of bad) expect(src).not.toContain(w);
  });

  it("分级红线:孩子可见文案无「血 / 死亡」字样", () => {
    const copy = read("meta.ts") + read("guide.ts");
    expect(copy).not.toMatch(/血|死亡/);
  });
});
