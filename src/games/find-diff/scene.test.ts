import { test } from "node:test";
import assert from "node:assert/strict";
import { DIFFS, sceneMarkup, VIEW_H, VIEW_W } from "./scene";

test("正好 3 处不同，id 不重复，热区都在画面内", () => {
  assert.equal(DIFFS.length, 3);
  assert.equal(new Set(DIFFS.map((d) => d.id)).size, 3);
  for (const d of DIFFS) {
    assert.ok(d.x >= 0 && d.x <= VIEW_W, `${d.id} x 超出画面`);
    assert.ok(d.y >= 0 && d.y <= VIEW_H, `${d.id} y 超出画面`);
    assert.ok(d.r > 10, "热区太小，孩子不好点");
    assert.ok(d.label.length > 0);
  }
});

test("左右两幅画确实不一样，且差异与 DIFFS 一一对应", () => {
  const left = sceneMarkup("left");
  const right = sceneMarkup("right");
  assert.notEqual(left, right);

  // 太阳光芒：左有右无
  assert.ok(left.includes("<line"), "左图应有太阳光芒");
  assert.ok(!right.includes("<line"), "右图不应有太阳光芒");

  // 门颜色：左红右蓝
  assert.ok(left.includes("#e5533d"));
  assert.ok(right.includes("#4d8af0"));
  assert.ok(!left.includes("#4d8af0"));
  assert.ok(!right.includes("#e5533d"));

  // 小花数量：左 3 朵、右 2 朵
  const count = (s: string) => (s.match(/🌼/g) || []).length;
  assert.equal(count(left), 3);
  assert.equal(count(right), 2);
});

test("两幅画的公共部分一致（房子、小猫、树都在）", () => {
  for (const side of ["left", "right"] as const) {
    const s = sceneMarkup(side);
    assert.ok(s.includes("🐱"), `${side} 应有小猫`);
    assert.ok(s.includes("#7ccf7c"), `${side} 应有树冠`);
    assert.ok(s.includes("#fff3d6"), `${side} 应有房子墙壁`);
  }
});
