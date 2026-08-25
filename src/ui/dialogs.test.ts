import { describe, expect, it } from "vitest";
import { resultSpeechLine } from "./dialogs";
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
