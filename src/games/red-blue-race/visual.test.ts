/**
 * 红蓝赛跑 · 1.3 第 23 步 A 档视觉升级的 12 个视觉用例。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom,所以和本目录 shell.test.ts /
 * touch.test.ts 同一个路数:能拿纯函数验的拿纯函数验(art.test.ts / feel.test.ts),
 * 挂在 DOM 上的走源码巡检——钉的都是「皮换了、骨头一根没动」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLICK_GUARD_MS } from "../../ui/dialogs";
import { FINISH_SLOWMO_MS, RUN_CYCLE_MAX_MS, RUN_CYCLE_MIN_MS, SETTLE_GUARD_MS, runCycleMs } from "./feel";
import { laneLeftPct } from "./art";

const DIR = fileURLToPath(new URL("./", import.meta.url));
const INDEX = readFileSync(`${DIR}index.ts`, "utf8");
const ART = readFileSync(`${DIR}art.ts`, "utf8");

/** 取某个函数体(从签名到下一个顶格 } 之间),够源码巡检用 */
function slice(from: string, to: string): string {
  const at = INDEX.indexOf(from);
  expect(at, `找不到 ${from}`).toBeGreaterThan(-1);
  const end = INDEX.indexOf(to, at);
  expect(end, `${from} 之后找不到 ${to}`).toBeGreaterThan(at);
  return INDEX.slice(at, end);
}

describe("红蓝赛跑 · 1.3 视觉升级 12 用例", () => {
  it("1. CSS token 全部落在样式表:--rbr- 系列进了 CSS 常量,三个壳共用", () => {
    expect(INDEX).toContain("${RBR_TOKENS_CSS}");
    // token 定义只在 art.ts 一处,index.ts 不许再抄一份色值表
    expect(INDEX).not.toContain("--rbr-track:");
    for (const token of ["--rbr-red", "--rbr-blue", "--rbr-track", "--rbr-lane-line", "--rbr-sky", "--rbr-puddle"]) {
      expect(INDEX, `样式表里没用上 ${token}`).toContain(`var(${token}`);
    }
    // 拱门金与看台紫的消费点在 art.ts 的 SVG 里(带同色回退)
    expect(ART).toContain("var(--rbr-gate");
    expect(ART).toContain("var(--rbr-stand");
  });

  it("2. 跑者小人:两帧跑姿 + 跳 + 滑倒四层帧,红蓝各自成套(kit runnerSvg)", () => {
    const frames = slice("function runnerFramesHtml(", "function buildLane(");
    expect(frames).toContain('phase: 0');
    expect(frames).toContain('phase: 1');
    expect(frames).toContain('pose: "jump"');
    expect(frames).toContain('pose: "slip"');
    expect(frames).toContain("RACE_LOOKS[side]");
    // 头像圆片彻底退役
    expect(INDEX).not.toContain("rbr-runner-img");
  });

  it("3. 跑者位置映射换肤前后一致:setPos 只走 laneLeftPct,快照钉死", () => {
    const lane = slice("function buildLane(", "interface SceneView");
    expect(lane).toContain("runner.style.left = `${laneLeftPct(pos)}%`");
    // 快照:0.92 系数与 0..92 双夹(公式本体在 art.ts,数值再钉一遍)
    expect(laneLeftPct(50)).toBeCloseTo(46, 10);
    expect(laneLeftPct(100)).toBe(92);
    expect(laneLeftPct(-1)).toBe(0);
    expect(ART).toContain("Math.max(0, Math.min(92, pos * 0.92))");
  });

  it("4. 透视容器只包视觉层:scene pointer-events 关死,按键热区不进透视面", () => {
    expect(INDEX).toContain(".rbr-scene { position: relative; margin-bottom: 8px; pointer-events: none; }");
    const scene = slice("function buildScene(", "/** HUD 双色进度双条");
    // 透视面里只有两条赛道 + 拱门
    expect(scene).toContain("track.append(redLaneEl, blueLaneEl, arch)");
    expect(scene).not.toContain("pads");
    expect(scene).not.toContain("button");
    // 按键排在 wrap / board 上,不在 scene 里
    expect(INDEX).toContain("wrap.appendChild(padsEl)");
    expect(INDEX).not.toContain("scene.el.appendChild(padsEl)");
    // 2.5D 参数照规格:perspective 720px + rotateX 18°
    expect(INDEX).toContain("perspective: 720px");
    expect(INDEX).toContain("rotateX(18deg)");
  });

  it("5. 障碍 / 道具不再以裸 emoji 表达:五种机关全走 obstacleSvg(<svg>)", () => {
    expect(INDEX).not.toContain("OB_EMOJI");
    for (const banned of ["💧", "🚧", "🏁"]) {
      expect(INDEX.includes(banned), `index.ts 还残留 ${banned}`).toBe(false);
    }
    expect(INDEX).toContain("obstacleSvg(ob.type");
    expect(INDEX).toContain("obstacleSvg(type"); // 无尽模式那份
    expect(ART).toContain("<svg ");
  });

  it("6. 跑姿频率映射只读 setStride 的既有输出:--rbr-gait 只吃 runCycleMs", () => {
    const lane = slice("function buildLane(", "interface SceneView");
    expect(lane).toContain('runner.style.setProperty("--rbr-gait", `${runCycleMs(ratio)}ms`)');
    // 输出值不变:220..720 的映射一个数没动(feel.test 也钉着,这里再上一道锁)
    expect(RUN_CYCLE_MIN_MS).toBe(220);
    expect(RUN_CYCLE_MAX_MS).toBe(720);
    expect(runCycleMs(0.5)).toBeCloseTo(470, 10);
  });

  it("7. 拾取飞行只是展示:+8 米 / 礼物箱结算先落账,fly 里不碰任何位置量", () => {
    // 结算语句原样在前,飞行只是跟在后面的展示
    expect(INDEX).toContain("me = Math.min(TRACK_LEN, me + 8);");
    expect(INDEX).toContain("me = Math.min(TRACK_LEN, me + ITEM_BOOST);");
    expect(INDEX).toContain("runner.pos = Math.min(TRACK_LEN, runner.pos + 8);");
    const lane = slice("function buildLane(", "interface SceneView");
    const fly = lane.slice(lane.indexOf("fly(index, label)"));
    // 整词匹配:fly 里不许给 me / pos / dist 赋值,也摸不到 TRACK_LEN
    expect(/\bpos\s*[+-]?=/.test(fly)).toBe(false);
    expect(/\bme\s*[+-]?=/.test(fly)).toBe(false);
    expect(/\bdist\s*[+-]?=/.test(fly)).toBe(false);
    expect(fly).not.toContain("TRACK_LEN");
  });

  it("8. 起跑灯三态类切换挂在 createStartGate 的三个既有节点上,状态机不动", () => {
    const gate = slice("function createStartGate(", "/** 全局键盘");
    // ready / set / go 三个节点各点一盏,700ms 清场跟原有清词同一拍
    expect(gate).toContain('lamp(0, "rbr-light-on-red")');
    expect(gate).toContain('lamp(1, "rbr-light-on-red")');
    expect(gate).toContain('lamp(2, "rbr-light-on-go")');
    expect(gate).toContain("lampsOff()");
    // 抢跑判定与随机延迟原样
    expect(gate).toContain("falseStartVerdict(falseStarts[racer])");
    expect(gate).toContain("startDelayMs(rand)");
    expect([...INDEX.matchAll(/callRow\.querySelector\(\"\.rbr-lights\"\)/g)].length).toBe(2);
  });

  it("9. 慢镜时长与冷静期常量不变,CSS 只从 --rbr-slowmo-ms 读同一个数", () => {
    expect(FINISH_SLOWMO_MS).toBe(300);
    expect(SETTLE_GUARD_MS).toBe(CLICK_GUARD_MS);
    expect([...INDEX.matchAll(/--rbr-slowmo-ms", `\$\{FINISH_SLOWMO_MS\}ms`/g)].length).toBe(2);
    expect(INDEX).toContain("var(--rbr-slowmo-ms, 300ms)");
    // 结算浮层的 400ms 冷静期两处都在
    expect([...INDEX.matchAll(/settleClickAccepted\(shownAt, performance\.now\(\)\)/g)].length).toBe(2);
  });

  it("10. reduced:跑姿静止、位置照常更新", () => {
    // 静止:媒体查询里把两帧交替关掉,飘字直接给、飞行不放
    const media = INDEX.slice(INDEX.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(media).toContain(".rbr-lane-run .rbr-fa, .rbr-lane-run .rbr-fb, .rbe-lane .rbr-fa, .rbe-lane .rbr-fb { animation: none; }");
    expect(media).toContain(".rbr-flyer { display: none; }");
    // 照常更新:setPos 一行没有 reduced 分支;JS 侧 setRunning / setStride / 粒子才看 reduced
    const lane = slice("function buildLane(", "interface SceneView");
    const setPos = lane.slice(lane.indexOf("setPos(pos)"), lane.indexOf("setStride(ratio)"));
    expect(setPos).not.toContain("reduced");
    expect(lane).toContain("el.classList.toggle(\"rbr-lane-run\", on && !reduced)");
  });

  it("11. destroy 后粒子与计时归零:所有粒子的移除都挂在 rt.later 登记簿上", () => {
    // 尘土 / 溅水(puff)、飘字、飞行道具、彩纸、哨音气泡——一个游离 setTimeout 都不许有
    const lane = slice("function buildLane(", "interface SceneView");
    expect(lane).toContain("rt.later(() => bit.remove()");
    expect(lane).toContain("rt.later(() => float.remove(), 850)");
    expect(lane).toContain("rt.later(() => flyer.remove(), 320)");
    expect(INDEX).toContain("rt.later(() => bit.remove(), 1400)");
    expect(INDEX).toContain("rt.later(() => bubble.remove(), 900)");
    // shell.test 钉过:setTimeout 只在 createRuntime 里;这里防回归再数一遍
    const runtime = slice("function createRuntime()", "const CONFETTI_COLORS");
    expect([...INDEX.matchAll(/\bsetTimeout\(/g)].length).toBe([...runtime.matchAll(/\bsetTimeout\(/g)].length);
  });

  it("12. 玩法骨头一根没动:速度演算、判定、结算的关键语句原样都在", () => {
    // 交替按键速度演算与人类手速上限
    expect(INDEX).toContain("redLane.setStride(speedRatio(tapHz, HUMAN_TAP_CAP_HZ))");
    expect(INDEX).toContain("cfg.tapStep *");
    expect(INDEX).toContain("res.multiplier");
    // 抢跑、冷却、道具、终点判定
    expect(INDEX).toContain('gate.falseStart("red")');
    expect(INDEX).toContain("gate.frozenUntil(");
    expect(INDEX).toContain("aiSlowUntil = now + ITEM_SLOW_MS");
    expect(INDEX).toContain("if (me >= TRACK_LEN) finish(true);");
    expect(INDEX).toContain("stunnedUntil = now + 800;");
    expect(INDEX).toContain("stunnedUntil = now + 600;");
  });
});

describe("红蓝赛跑 · 视觉升级的补充断言", () => {
  it("HUD 双条:红蓝各一条 + 各配一顶皇冠,皇冠只戴在领先方头上", () => {
    const bars = slice("function raceBarsHtml(", "/** 让分开关那颗芯片");
    expect([...bars.matchAll(/rbr-crown\"/g)].length).toBeGreaterThanOrEqual(2);
    expect(bars).toContain('redCrown.classList.toggle("rbr-crown-on", redPos > bluePos)');
    expect(bars).toContain('blueCrown.classList.toggle("rbr-crown-on", bluePos > redPos)');
  });

  it("抢跑气泡只提醒不批评:文案是「再等等哦」,三处抢跑口都接了", () => {
    expect(INDEX).toContain("再等等哦");
    expect([...INDEX.matchAll(/showRefereeBubble\(wrap, rt\)/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("滑倒是坐地转圈星:水坑走 slip(),栏架只是 bump(),没有摔伤字眼", () => {
    expect(INDEX).toContain("redLane.slip();");
    expect(INDEX).toContain("redLane.bump();");
    expect(INDEX).toContain("lane.slip();");
    expect(INDEX).not.toContain("摔伤");
    expect(INDEX).not.toContain("疼");
  });

  it("双人触屏按键区结构原样:左右分屏两套 步/步/跳,热区规则一个没改", () => {
    expect(INDEX).toContain("function buildDuoPads()");
    expect(INDEX).toContain(".rbr-step { min-height: 72px;");
    expect(INDEX).toContain(".rbr-side .rbr-step { min-height: 64px;");
    expect(INDEX).toContain(".rbr-jump-btn { grid-column: 1 / -1; min-height: 64px;");
  });
});
