/**
 * 地形五件套的纯函数用例(1.2 新增)。
 *
 * 砖 / 钢 / 水 / 草 / 冰 各有各的脾气,规则全部写成不碰世界状态的纯函数,
 * 所以这里能一条一条把它们钉死:谁挡车、谁挡弹、谁挡视线、谁会打滑,
 * 以及砖的「四分之一格」到底怎么碎。
 */
import { describe, expect, it } from "vitest";
import {
  BRICK_FULL,
  DX,
  DY,
  GRASS_ALPHA,
  ICE_FRICTION,
  ICE_STILL,
  Q_NE,
  Q_NW,
  Q_SE,
  Q_SW,
  SHELL_RADIUS,
  TERRAIN,
  TILE_CHARS,
  blocksShell,
  blocksSight,
  blocksTank,
  brickGone,
  chipBrick,
  farPair,
  glideDistance,
  iceGlide,
  iceSteer,
  isSlippery,
  isTile,
  maskToHp,
  nearPair,
  quarterBitAt,
  quarterCount,
  quarterSolid,
  spanBits,
  terrainOf,
  type Dir,
  type Tile,
} from "./terrain12";

describe("地形五件套", () => {
  it("五种地形各司其职:砖挡车挡弹可破、钢要穿甲、水只挡车、草只挡视线、冰会滑", () => {
    const brick = terrainOf("#");
    expect([brick.stopsTank, brick.stopsShell, brick.breakable, brick.needsPierce]).toEqual([
      true,
      true,
      true,
      false,
    ]);

    const steel = terrainOf("S");
    expect([steel.stopsTank, steel.stopsShell, steel.breakable, steel.needsPierce]).toEqual([
      true,
      true,
      false,
      true,
    ]);

    const water = terrainOf("~");
    expect([water.stopsTank, water.stopsShell]).toEqual([true, false]);

    const grass = terrainOf("*");
    expect([grass.stopsTank, grass.stopsShell, grass.hidesTank]).toEqual([false, false, true]);

    const ice = terrainOf("i");
    expect([ice.stopsTank, ice.stopsShell, ice.slippery]).toEqual([false, false, true]);
  });

  it("三张判定表互不打架:草挡视线但不挡弹,水挡车但不挡弹", () => {
    expect(blocksTank("~")).toBe(true);
    expect(blocksShell("~")).toBe(false);
    expect(blocksSight("*")).toBe(true);
    expect(blocksShell("*")).toBe(false);
    expect(blocksTank("*")).toBe(false);
    expect(blocksSight("#")).toBe(true);
    expect(blocksSight("i")).toBe(false);
  });

  it("只有冰会打滑,其余四种都不会", () => {
    const slippery = TILE_CHARS.filter((t) => isSlippery(t));
    expect(slippery).toEqual(["i"]);
  });

  it("每一种地形都写了给小朋友看的名字与一句话规则", () => {
    for (const tile of TILE_CHARS) {
      const info = TERRAIN[tile];
      expect(info.tile).toBe(tile);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.emoji.length).toBeGreaterThan(0);
      expect(info.desc.length).toBeGreaterThan(4);
      // 分级红线:地形说明里不许出现打仗与伤人的词
      expect(info.desc).not.toMatch(/爆炸|死|血|伤|炸毁/);
    }
    expect(GRASS_ALPHA).toBeGreaterThan(0.3);
    expect(GRASS_ALPHA).toBeLessThan(1);
  });

  it("isTile 认得出这七个字符,别的一律不认", () => {
    for (const ch of TILE_CHARS) expect(isTile(ch)).toBe(true);
    for (const ch of ["1", "2", "e", "x", " "]) expect(isTile(ch)).toBe(false);
  });

  it("方向表就是四邻:上右下左,dx/dy 一一对上", () => {
    expect([...DX]).toEqual([0, 1, 0, -1]);
    expect([...DY]).toEqual([-1, 0, 1, 0]);
  });
});

describe("冰面:滑行惯性", () => {
  it("松手之后速度按摩擦掉,掉到门槛以下就算停住", () => {
    expect(iceGlide(3, 0.1)).toBeCloseTo(3 - ICE_FRICTION * 0.1, 6);
    expect(iceGlide(ICE_STILL, 0.1)).toBe(0);
    expect(iceGlide(0.2, 1)).toBe(0);
  });

  it("冰上蹬地是慢慢加速的:一帧补不满,补够了也不会超过想要的速度", () => {
    const dt = 1 / 60;
    let v = 0;
    for (let i = 0; i < 3; i++) v = iceSteer(v, 3.6, dt);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(3.6);
    // 蹬久了封顶在 want,不会越蹬越快
    for (let i = 0; i < 200; i++) v = iceSteer(v, 3.6, dt);
    expect(v).toBe(3.6);
  });

  it("冰比空地滑:同样的速度,摩擦越小溜得越远", () => {
    const onIce = glideDistance(3.6);
    const onDirt = glideDistance(3.6, ICE_FRICTION * 6);
    expect(onIce).toBeGreaterThan(onDirt * 3);
    expect(onIce).toBeGreaterThan(1); // 至少溜过一整格,不然玩家感觉不到
  });
});

describe("砖:四分之一格破坏", () => {
  it("新砖是四个小块,耐久折成两发普通弹丸", () => {
    expect(quarterCount(BRICK_FULL)).toBe(4);
    expect(maskToHp(BRICK_FULL)).toBe(2);
    expect(maskToHp(Q_NW | Q_NE)).toBe(1);
    expect(maskToHp(Q_NW)).toBe(1);
    expect(maskToHp(0)).toBe(0);
    expect(brickGone(0)).toBe(true);
    expect(brickGone(Q_SE)).toBe(false);
  });

  it("格内坐标落在哪个小块上,四个角各归各的", () => {
    expect(quarterBitAt(0.2, 0.2)).toBe(Q_NW);
    expect(quarterBitAt(0.8, 0.2)).toBe(Q_NE);
    expect(quarterBitAt(0.2, 0.8)).toBe(Q_SW);
    expect(quarterBitAt(0.8, 0.8)).toBe(Q_SE);
  });

  it("正面对着中线打两发,整格塌掉——老规矩一点没变", () => {
    let mask = BRICK_FULL;
    mask = chipBrick(mask, 0, 0.5); // 往上飞,打在格中线上
    expect(quarterCount(mask)).toBe(2);
    expect(mask).toBe(Q_NW | Q_NE); // 先塌的是靠近来弹那一侧
    mask = chipBrick(mask, 0, 0.5);
    expect(brickGone(mask)).toBe(true);
  });

  it("打偏一点只崩掉一角,墙上就开出一条只有弹丸钻得过的缝", () => {
    const mask = chipBrick(BRICK_FULL, 0, 0.2);
    expect(quarterCount(mask)).toBe(3);
    expect(mask & Q_SW).toBe(0);
    // 缝在左下角:弹丸从那儿过得去,别的三个角还是实心的
    expect(quarterSolid(mask, 0.2, 0.8)).toBe(false);
    expect(quarterSolid(mask, 0.8, 0.8)).toBe(true);
    expect(quarterSolid(mask, 0.2, 0.2)).toBe(true);
  });

  it("四个方向都是「先崩近侧、近侧空了才轮到远侧」", () => {
    for (let dir = 0 as Dir; dir < 4; dir++) {
      expect(nearPair(dir) & farPair(dir)).toBe(0);
      expect(nearPair(dir) | farPair(dir)).toBe(BRICK_FULL);
      const once = chipBrick(BRICK_FULL, dir, 0.5);
      expect(once).toBe(farPair(dir));
      expect(chipBrick(once, dir, 0.5)).toBe(0);
    }
  });

  it("弹丸有粗细:压着中线时同时盖住左右两块,躲在半格里就只盖一块", () => {
    expect(spanBits(0, 0.5, SHELL_RADIUS)).toBe(BRICK_FULL);
    expect(spanBits(0, 0.15, SHELL_RADIUS)).toBe(Q_NW | Q_SW);
    expect(spanBits(0, 0.85, SHELL_RADIUS)).toBe(Q_NE | Q_SE);
    expect(spanBits(1, 0.15, SHELL_RADIUS)).toBe(Q_NW | Q_NE);
    expect(spanBits(1, 0.85, SHELL_RADIUS)).toBe(Q_SW | Q_SE);
  });

  it("一格砖最多挨四发就没了,而且每一发都真的崩掉了东西", () => {
    let mask = BRICK_FULL;
    const crosses = [0.2, 0.8, 0.2, 0.8];
    let shots = 0;
    for (const cross of crosses) {
      const before = mask;
      mask = chipBrick(mask, 2, cross);
      expect(quarterCount(mask)).toBeLessThan(quarterCount(before));
      shots += 1;
      if (brickGone(mask)) break;
    }
    expect(brickGone(mask)).toBe(true);
    expect(shots).toBeLessThanOrEqual(4);
  });

  it("空砖再打也不会掉出负数的小块", () => {
    const tiles: Tile[] = ["#"];
    expect(tiles[0]).toBe("#");
    expect(chipBrick(0, 0, 0.5)).toBe(0);
    expect(quarterCount(0)).toBe(0);
  });
});
