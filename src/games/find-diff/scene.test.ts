import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, VIEW_H, VIEW_W } from "./scene";

test("共 5 组场景，每组 5 处不同", () => {
  assert.equal(SCENES.length, 5);
  for (const scene of SCENES) {
    assert.equal(scene.diffs.length, 5, `${scene.name} 应有 5 处不同`);
    assert.equal(new Set(scene.diffs.map((d) => d.id)).size, 5, `${scene.name} 的 id 应唯一`);
  }
});

test("热区都在画面内且带说明", () => {
  for (const scene of SCENES) {
    for (const d of scene.diffs) {
      assert.ok(d.x >= 0 && d.x <= VIEW_W, `${scene.name}/${d.id} x 超界`);
      assert.ok(d.y >= 0 && d.y <= VIEW_H, `${scene.name}/${d.id} y 超界`);
      assert.ok(d.r > 10 && d.r < 60, `${scene.name}/${d.id} 半径不合理: ${d.r}`);
      assert.ok(d.label.length > 0);
    }
  }
});

test("每组场景左右两侧画面确实不同", () => {
  for (const scene of SCENES) {
    const left = scene.markup("left");
    const right = scene.markup("right");
    assert.notEqual(left, right, `${scene.name} 两侧应有差异`);
    assert.ok(left.length > 100 && right.length > 100);
  }
});

test("同一场景内热区不重叠（避免误点到别的答案）", () => {
  for (const scene of SCENES) {
    for (let i = 0; i < scene.diffs.length; i++) {
      for (let j = i + 1; j < scene.diffs.length; j++) {
        const a = scene.diffs[i];
        const b = scene.diffs[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(
          dist >= a.r + b.r - 1,
          `${scene.name}: ${a.id} 与 ${b.id} 热区重叠 (dist=${dist.toFixed(1)}, r=${a.r}+${b.r})`
        );
      }
    }
  }
});
