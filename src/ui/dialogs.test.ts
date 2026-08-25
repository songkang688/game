import { describe, expect, it } from "vitest";
import { CLICK_GUARD_MS, isGuardedClick, resultSpeechLine } from "./dialogs";
import { speechText } from "../games/speech";

describe("结算弹窗朗读文案", () => {
  it("标题和鼓励语连成一句话", () => {
    expect(resultSpeechLine("太棒啦!", "你真厉害,星星收好啦!")).toBe(
      "太棒啦!你真厉害,星星收好啦!"
    );
  });

  it("带表情的鼓励语经 speechText 过滤后仍有可念的内容", () => {
    const line = resultSpeechLine("差一点点!", "深呼吸,下一次会更棒! 🌱");
    expect(speechText(line)).toBe("差一点点!深呼吸,下一次会更棒!");
  });
});

describe("结算按钮防狂点冷静期", () => {
  it("弹出瞬间的点击被忽略(孩子狂点的余波)", () => {
    expect(isGuardedClick(1000, 1000)).toBe(true);
    expect(isGuardedClick(1000, 1000 + CLICK_GUARD_MS - 1)).toBe(true);
  });

  it("冷静期过后点击正常生效", () => {
    expect(isGuardedClick(1000, 1000 + CLICK_GUARD_MS)).toBe(false);
    expect(isGuardedClick(1000, 1000 + 5000)).toBe(false);
  });

  it("自定义冷静期时长", () => {
    expect(isGuardedClick(0, 100, 200)).toBe(true);
    expect(isGuardedClick(0, 250, 200)).toBe(false);
  });
});
