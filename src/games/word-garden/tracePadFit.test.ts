/**
 * N-36 复测(trio-r9 测试修复员 A):米字格边长尺算错了「余量」。
 *
 * 上游 r12 一带用 `padSidePx` 按可视余量算边长,思路对,但 `chrome` 传的是
 * 「宿主里除格子以外的全部内容」—— 把**格子下面**的花园与提示行也算进了竞争者。
 * 那两块往下滚一屏就是,替它们让位等于把描红本身做小:
 *
 *   真机 Chrome 无头,localStorage 种进度进第 102 关(免 root 行干扰):
 *   - 360×640 竖屏 米字格 **191×191** —— 低于 `MIN_PAD_PX` 这条「手机 360px 规格底线」,
 *     而这一档余量足够,修前修后都是整格可见,收它纯亏。
 *   - 844×390 矮横屏 240×240 但**底沿切掉 12px** —— 可视段自己都装不下 240 时
 *     还留着 240,格子是 `touch-action:none` 的手势面,切掉就等于描不了。
 *
 * 改法:`chrome` 只算「必须与格子同框」的部分(格子上方那几行 + 木桌 `.wgd-desk`
 * 箍在四周的内边距);可视段装得下 240 就守住底线、其余交给宿主滚;
 * 可视段自己都不到 240 才往下收,并且只跟滚不掉的木桌边分余量。
 *
 * 修后同一批实测(修前 → 修后,全部 出屏=0):
 *   360×640 191→259 | 844×390 240(切12)→214(切0) | 915×412 240→240(原样)
 *   390×844 280 | 412×915 296 | 1024×768 300 | 1280×800 300  ——— 后四档逐像素不动。
 * 判定另测:同一条归一化笔画在 259 / 240 / 300 三种边长上都判
 * 「第 1 笔『竖』写好啦」、0/3→1/3,`padPoint` 按 box 取比例,收边长不动判分。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MIN_PAD_PX, SHORT_PAD_MIN_PX, padSidePx } from "./tracing";

const TRACING = readFileSync(new URL("./tracing.ts", import.meta.url), "utf8");

/** 取 `sizePad()` 那段函数体,用来盯住「传下去的 chrome 是怎么拼的」 */
function sizePadBody(): string {
  const at = TRACING.indexOf("function sizePad()");
  expect(at, "应有 sizePad()").toBeGreaterThan(-1);
  return TRACING.slice(at, at + 1400);
}

describe("N-36 复测:余量该减谁", () => {
  const body = sizePadBody();

  it("减掉格子**上面**那几行 —— 它们得和格子同时在屏上", () => {
    expect(body).toMatch(/padwrapEl\.getBoundingClientRect\(\)\.top - wrapTop/);
  });

  it("减掉木桌箍在格子四周的内边距 —— 它跟着格子走,滚不掉", () => {
    expect(body).toMatch(/deskBox\.height - pad\.getBoundingClientRect\(\)\.height/);
    // 且这一份要单独作为「硬余量」传下去,矮横屏那档才知道哪部分让不掉
    expect(body).toMatch(/padSidePx\(vw, room, chrome, deskPad\)/);
  });

  it("不再拿「宿主里除格子以外的一切」当竞争者(花园与提示在格子下面,滚一屏就是)", () => {
    expect(body).not.toMatch(/wrap\.scrollHeight - padBox\.height/);
  });
});

describe("N-36 复测:三种「装不下」要分开处理", () => {
  it("余量够 —— 按余量取边长,上限 300", () => {
    expect(padSidePx(1280, 900, 120).side).toBe(300);
    expect(padSidePx(390, 700, 180).side).toBe(280);
  });

  it("余量不够 240、但可视段自己装得下 240 —— 守住规格底线,其余交给宿主滚", () => {
    // 360×640 真机这一档:修前 191(破底线),修后 259
    const { side, allowScroll } = padSidePx(360, 426, 235);
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(true);
  });

  it("可视段自己都不到 240 —— 收到装得下为止,别留着 240 挨切", () => {
    // 844×390 真机这一档:修前 240 切 12px,修后 214 整格可见
    const { side } = padSidePx(844, 232, 190, 24);
    expect(side).toBeLessThanOrEqual(232);
    expect(side).toBeGreaterThanOrEqual(SHORT_PAD_MIN_PX);
  });

  it("可视段连 120 都不到,才退回下限让宿主滚兜底", () => {
    expect(padSidePx(844, 80, 60).side).toBe(SHORT_PAD_MIN_PX);
  });

  it("收边长永远不越过 300 上限,也不会算出负数", () => {
    for (const room of [0, 50, 120, 240, 300, 500, 2000]) {
      for (const chrome of [0, 24, 120, 400]) {
        const { side } = padSidePx(915, room, chrome, 24);
        expect(side).toBeGreaterThanOrEqual(SHORT_PAD_MIN_PX);
        expect(side).toBeLessThanOrEqual(300);
      }
    }
  });
});

describe("N-36 复测红线", () => {
  it("`.wgd-pad` 还是 touch-action:none 的手势面 —— 修的是「让它整格可见」,不是「让它能滚」", () => {
    // `${MIN_PAD_PX}` 这个插值自带一对花括号，[^}] 跨不过去，直接按位置取
    const at = TRACING.indexOf(".wgd-pad{");
    expect(at, "应有 .wgd-pad 规则").toBeGreaterThan(-1);
    expect(TRACING.slice(at, at + 220)).toContain("touch-action:none");
  });

  it("规格底线这条常量还在,注释没被改成别的数", () => {
    expect(MIN_PAD_PX).toBe(240);
    expect(SHORT_PAD_MIN_PX).toBe(120);
    expect(SHORT_PAD_MIN_PX).toBeLessThan(MIN_PAD_PX);
  });

  it("判定轨迹换算照旧按 box 取比例,收边长不动判分", () => {
    expect(TRACING).toMatch(/\(\(ev\.clientX - box\.left\) \/ w\) \* GRID/);
    expect(TRACING).toMatch(/\(\(ev\.clientY - box\.top\) \/ h\) \* GRID/);
  });

  it("窗口改尺寸重算一次,destroy 时把那条监听拆掉", () => {
    expect(TRACING).toMatch(/addEventListener\("resize", sizePad\)/);
    expect(TRACING).toMatch(/removeEventListener\("resize", sizePad\)/);
  });
});
