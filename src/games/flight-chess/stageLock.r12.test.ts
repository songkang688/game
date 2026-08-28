import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-2 flight-chess r12 消灭舞台自滚", () => {
  it("矮屏锁 .fc-wrap 高并收方盘,仍保留原 sticky 字符串", () => {
    expect(CSS).toContain("position:sticky;bottom:0");
    expect(CSS).toContain(".fc-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(CSS).toContain("max-height:min(200px,42dvh)");
  });
});
