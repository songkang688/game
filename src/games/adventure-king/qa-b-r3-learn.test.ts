/**
 * 窗口4 · 档B · 第 3 轮学习优化员 —— 冒险小王(adventure-king)。
 *
 * 落地 B3-L1:无尽遗迹从第 16 层起彻底冻住。
 * 第 2 轮收的是**古堡**连着重样(B2-01),**遗迹**这条线当时没动——
 * 这一轮全量跑才看出来:第 16 层和第 300 层的旋钮一模一样。
 */
import { describe, expect, it } from "vitest";
import {
  RUINS_CAP_FLOOR,
  RUINS_ENEMY_SPEED_MAX,
  RUINS_HEART_FLOOR,
  buildEndlessFloor,
  levelTraversable,
  ruinsPressure,
} from "./levels";
import { botPlay } from "./sim";

describe("档B R3-L1 · 无尽遗迹:封顶之后还得继续变难", () => {
  it("封顶那一层之前一个数都没动过(老玩家的手感不变)", () => {
    for (let f = 1; f <= RUINS_CAP_FLOOR; f++) {
      const press = ruinsPressure(f);
      expect(press.hearts, `第 ${f} 层的心数被改了`).toBe(4);
      expect(press.enemySpeed, `第 ${f} 层的守卫速度被改了`).toBe(Math.min(108, 48 + f * 5));
    }
  });

  it("封顶之后心会一颗一颗少,但再深也留得住 2 颗", () => {
    expect(ruinsPressure(39).hearts).toBe(4);
    expect(ruinsPressure(40).hearts).toBe(3);
    expect(ruinsPressure(64).hearts).toBe(RUINS_HEART_FLOOR);
    for (let f = 1; f <= 600; f++) {
      expect(ruinsPressure(f).hearts, `第 ${f} 层的心少于下限了`).toBeGreaterThanOrEqual(RUINS_HEART_FLOOR);
      expect(ruinsPressure(f).hearts).toBeLessThanOrEqual(4);
    }
    // 心数只减不增:不能走着走着又白送回来
    for (let f = 2; f <= 600; f++) {
      expect(ruinsPressure(f).hearts, `第 ${f} 层的心比上一层还多`).toBeLessThanOrEqual(
        ruinsPressure(f - 1).hearts,
      );
    }
  });

  it("封顶之后守卫还会再快一点,但快到头就稳住不再快", () => {
    expect(ruinsPressure(RUINS_CAP_FLOOR).enemySpeed).toBe(108);
    expect(ruinsPressure(200).enemySpeed).toBeGreaterThan(108);
    for (let f = 2; f <= 600; f++) {
      const now = ruinsPressure(f).enemySpeed;
      expect(now, `第 ${f} 层的守卫比上一层慢了`).toBeGreaterThanOrEqual(ruinsPressure(f - 1).enemySpeed);
      expect(now, `第 ${f} 层的守卫超速了`).toBeLessThanOrEqual(RUINS_ENEMY_SPEED_MAX);
    }
    expect(ruinsPressure(1000).enemySpeed).toBe(RUINS_ENEMY_SPEED_MAX);
  });

  it("第 16 层和第 300 层不再是同一件事", () => {
    const cap = ruinsPressure(RUINS_CAP_FLOOR);
    const deep = ruinsPressure(300);
    expect(deep, "封顶之后还是原地踏步").not.toEqual(cap);
    expect(deep.hearts).toBeLessThan(cap.hearts);
    expect(deep.enemySpeed).toBeGreaterThan(cap.enemySpeed);
  });

  it("加了压也不能把地形加坏:200 层层层还是走得通", () => {
    for (let f = 1; f <= 200; f++) {
      expect(levelTraversable(buildEndlessFloor(f)), `第 ${f} 层有跨不过去的坑`).toBe(true);
    }
  });

  it("加压的分寸:前 60 层机器人一层不落全通,再深才开始收人", () => {
    for (let f = 1; f <= 60; f++) {
      expect(botPlay(buildEndlessFloor(f), 240).outcome, `第 ${f} 层机器人过不去`).toBe("clear");
    }
    // 无尽本来就该有个头:深层允许失手,但不能层层必死
    let cleared = 0;
    for (let f = 100; f <= 160; f++) {
      if (botPlay(buildEndlessFloor(f), 240).outcome === "clear") cleared++;
    }
    expect(cleared, "第 100~160 层机器人一层都过不去,加压过头了").toBeGreaterThan(30);
  });
});
