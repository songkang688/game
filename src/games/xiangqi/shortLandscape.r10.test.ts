import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-10 xiangqi 矮横屏再收棋盘", () => {
  it("500px 高再压一档，840 档原样保留", () => {
    expect(CSS).toContain("@media (min-width:700px) and (max-height:840px)");
    expect(CSS).toContain(".xq-wrap{max-width:380px;}");
    expect(CSS).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(CSS).toContain(".xq-wrap{max-width:248px;}");
    expect(CSS).toContain("@media (max-width:699px) and (max-height:840px) and (min-height:501px)");
  });
});
