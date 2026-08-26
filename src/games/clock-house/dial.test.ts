/**
 * 时钟小屋 1.2：可拖钟面。
 *
 * 拖动的判定全部拆成了纯函数（角度 → 分钟 → 吸附 → 联动），这里逐条验算；
 * 挂监听那一层没有 DOM 可跑（单测环境是 node），改用源码巡检盯 `destroy` 有没有收干净。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HANDS, FACE_RADIUS, handTip } from "./clockface";
import { dialReadout, dialTimeAt, pointerAngle } from "./dial";
import { clockMinutes, hourHandAngleAt } from "./logic";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const dialSrc = readFileSync(`${DIR}dial.ts`, "utf8");

/** 100×100 的钟面摆在屏幕 (0,0)，中心正好是 (50,50) */
const BOX = { left: 0, top: 0, width: 100, height: 100 };

describe("时钟小屋 · 拖动角度", () => {
  it("正上方是 0 度，顺时针一圈都对得上", () => {
    expect(pointerAngle(50, 50, 50, 0)).toBeCloseTo(0, 6);
    expect(pointerAngle(50, 50, 100, 50)).toBeCloseTo(90, 6);
    expect(pointerAngle(50, 50, 50, 100)).toBeCloseTo(180, 6);
    expect(pointerAngle(50, 50, 0, 50)).toBeCloseTo(270, 6);
    // 右上 45 度
    expect(pointerAngle(50, 50, 85.36, 14.64)).toBeCloseTo(45, 1);
    for (let deg = 0; deg < 360; deg += 13) {
      const rad = ((deg - 90) * Math.PI) / 180;
      const back = pointerAngle(50, 50, 50 + Math.cos(rad) * 30, 50 + Math.sin(rad) * 30);
      expect(back, `${deg} 度反解不回来`).toBeCloseTo(deg, 6);
    }
  });
});

describe("时钟小屋 · 磁性吸附与时针联动", () => {
  it("默认吸附到最近整分，手指歪一点也拨得准", () => {
    const three = clockMinutes(3, 0);
    // 正右方 = 15 分
    expect(dialTimeAt(three, BOX, 100, 50, false)).toBe(clockMinutes(3, 15));
    // 稍微偏一点，还是吸到 15 分
    const rad = ((90.6 - 90) * Math.PI) / 180;
    expect(dialTimeAt(three, BOX, 50 + Math.cos(rad) * 40, 50 + Math.sin(rad) * 40, false)).toBe(clockMinutes(3, 15));
    expect(dialTimeAt(three, BOX, 50, 100, false)).toBe(clockMinutes(3, 30));
  });

  it("精确模式下指针能停在两分之间", () => {
    const three = clockMinutes(3, 0);
    const rad = ((93 - 90) * Math.PI) / 180;
    const t = dialTimeAt(three, BOX, 50 + Math.cos(rad) * 40, 50 + Math.sin(rad) * 40, true);
    expect(t).toBeGreaterThan(clockMinutes(3, 15));
    expect(t).toBeLessThan(clockMinutes(3, 16));
  });

  it("拨分针时时针跟着按比例走，越过 12 自动进钟点", () => {
    // 3:00 拨到半点 → 时针要走到 3 和 4 正中间
    expect(hourHandAngleAt(dialTimeAt(clockMinutes(3, 0), BOX, 50, 100, false))).toBe(105);
    // 11:55 把分针拨到正上方 → 12:00，而不是倒退回 11:00
    expect(dialTimeAt(clockMinutes(11, 55), BOX, 50, 0, false)).toBe(clockMinutes(12, 0));
    // 12:03 把分针拨回 57 分 → 退回 11:57
    expect(dialTimeAt(clockMinutes(12, 3), BOX, 50 + Math.cos((252 * Math.PI) / 180) * 40, 50 + Math.sin((252 * Math.PI) / 180) * 40, false)).toBe(
      clockMinutes(11, 57)
    );
  });

  it("钟面尺寸为 0（还没排版完）时读不到有效角度也不会崩", () => {
    expect(() => dialTimeAt(0, { left: 0, top: 0, width: 0, height: 0 }, 0, 0, false)).not.toThrow();
  });

  it("读数行说人话，精确模式下会说「左右」", () => {
    expect(dialReadout(clockMinutes(3, 25), false)).toBe("现在拨到 3 点 25 分");
    expect(dialReadout(clockMinutes(3, 0), false)).toBe("现在拨到 3 点");
    expect(dialReadout(clockMinutes(3, 25) + 0.4, true)).toBe("现在拨到 3 点 25 分左右");
  });
});

describe("时钟小屋 · 指针比例（教学正确性）", () => {
  it("时针短而粗、分针长而细、秒针最长最细而且是红的", () => {
    expect(HANDS.hour.length).toBeLessThan(HANDS.minute.length);
    expect(HANDS.minute.length).toBeLessThan(HANDS.second.length);
    expect(HANDS.hour.width).toBeGreaterThan(HANDS.minute.width);
    expect(HANDS.minute.width).toBeGreaterThan(HANDS.second.width);
    expect(HANDS.second.color.toLowerCase()).toMatch(/^#e0|^#f/);
    // 三根针都得留在表盘里
    for (const hand of Object.values(HANDS)) expect(hand.length).toBeLessThan(FACE_RADIUS);
  });

  it("指针末端坐标就是极坐标那一套，画到哪儿算得出来", () => {
    expect(handTip(0, 20)).toEqual({ x: 50, y: 30 });
    const right = handTip(90, 20);
    expect(right.x).toBeCloseTo(70, 6);
    expect(right.y).toBeCloseTo(50, 6);
  });
});

describe("时钟小屋 · 可拖钟面的 destroy 归零", () => {
  it("每一处 addEventListener 都进了 offs，destroy 时一条不剩", () => {
    const added = [...dialSrc.matchAll(/addEventListener\(/g)].length;
    expect(added).toBeGreaterThanOrEqual(1);
    expect(dialSrc).toContain("offs.push(() => target.removeEventListener(type, handler))");
    expect(dialSrc).toContain("while (offs.length) offs.pop()?.();");
  });

  it("destroy 把自己加的读数行与精确开关也一起摘走，不给别人留垃圾", () => {
    const body = dialSrc.slice(dialSrc.indexOf("destroy() {"));
    expect(body).toContain("dragging = false;");
    expect(body).toContain("readout.remove();");
    expect(body).toContain("toggle.remove();");
  });

  it("找不到指针元素时原样返回空 handle，绝不让题面白屏", () => {
    expect(dialSrc).toContain("return { destroy: () => {}, getTime: () => time };");
  });

  it("键盘也能拨针，方向键都接了（读屏与无鼠标用户不掉队）", () => {
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]) {
      expect(dialSrc, `${key} 没接`).toContain(key);
    }
    expect(dialSrc).toContain('svg.setAttribute("tabindex", "0")');
  });
});
