/**
 * 配方 F 守门:接了 stagePlayRoom 的实时款,room 口径必须减掉自家家当。
 *
 * 三人组 r5 抽验(N-11…N-15、N-19)的共因:`stagePlayRoom(host).h` 只减了
 * 壳层抬头,bowling-lane / pool-stars / fruit-stack / bumper-cars / bomb-buddies /
 * tank-battle 拿它直接铺画布,自家 HUD 与按钮排把主操作钮顶出屏
 * (390×844 保龄球四钮、915×412 坦克 D-pad 都是实测截图实锤)。
 * 这里钉住:六款都改用 canvasRoomPx(舞台可视下沿 − 画布上沿 − 下方家当)
 * 量真实余量,量不到(测试桩)退回 stagePlayRoom 老口径。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GAMES = new URL("..", import.meta.url).pathname;

const WIRED: Array<[string, string]> = [
  ["bowling-lane", "index.ts"],
  ["pool-stars", "view.ts"],
  ["fruit-stack", "index.ts"],
  ["bumper-cars", "index.ts"],
  ["bomb-buddies", "index.ts"],
  ["tank-battle", "index.ts"],
];

describe("stagePlayRoom 家当组 · 真实余量口径(r5 N-11…N-15/N-19)", () => {
  it.each(WIRED)("%s/%s 量真实余量,测试桩下退回老口径", (dir, file) => {
    const src = readFileSync(join(GAMES, dir, file), "utf8");
    expect(src, `${dir} 没接 canvasRoomPx`).toContain('import { canvasRoomPx } from "../stageFit";');
    expect(src).toContain("canvasRoomPx(");
    // 量不到要有兜底,不能把单测桩上的 NaN 铺进画布
    expect(src).toMatch(/Number\.isFinite\(measured\)\s*\?\s*measured\s*:/);
  });
});
