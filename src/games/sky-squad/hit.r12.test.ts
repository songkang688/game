import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-56 sky-squad 双人合作热区抬到 44", () => {
  it("暂停 / 开关 / 摇杆热区 ≥44，不重钳画布高", () => {
    expect(CSS).toContain(".sks-pads[data-players=\"2\"]{--k:44px;}");
    expect(CSS).toMatch(/\.sks-back\{[^}]*min-height:44px/);
    expect(CSS).toMatch(/\.sks-opt\{[^}]*min-height:44px/);
    expect(CSS).toContain(".sks-cv{display:block;width:100%;height:360px;touch-action:none;}");
    expect(CSS).not.toContain(".sks-cv{height:calc");
  });
});
