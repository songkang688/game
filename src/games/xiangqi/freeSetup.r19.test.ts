import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-95 xiangqi 自由对战设置面板矮横屏可达", () => {
  it("500 高档:.xq-setup 放宽多栏并自己开内滚,248 棋盘钳宽原样保留", () => {
    const block = CSS.split("@media (min-width:700px) and (max-height:500px)")[1] ?? "";
    expect(block).toContain(".xq-wrap{max-width:min(248px,52dvh);max-height:100%;overflow:hidden;}");
    expect(block).toContain(".xq-wrap.xq-setup{max-width:min(680px,94%);max-height:100%;overflow-y:auto");
  });

  it("设置态挂 xq-setup 类、开局摘除(棋盘态不吃宽版规则)", () => {
    expect(SRC).toContain('root.classList.add("xq-setup")');
    expect(SRC).toContain('root.classList.remove("xq-setup")');
  });
});
