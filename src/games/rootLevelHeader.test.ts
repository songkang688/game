/**
 * N-37(trio-r9):管理员权限开启态挤压 quiz 族关内。
 *
 * 真机实测(Chrome 无头,localStorage 种一份 permanent 会话,四款 quiz 皮肤 × root 开/关 × 五档视口):
 * 修前 915×412 开 root 后关内抬头 `.l99-stagebar` 56→106px(多出「跳过第 N 关 + 🎫 直达 + 权限小字」一行),
 * 答题器里又多出一整行 `.qz-jump`(44+6px),两笔合计 100px —— math-farm 三个答案钮
 * 整排掉到宿主自滚线下(393–457 vs 舞台底 400),宿主自滚 0→95。
 * 修后同档:抬头回到 56、舞台回到 134–400、答案钮全部在屏,四款 × 五档 线下 0 / 切半 0;
 * **root 关着时四款 × 五档逐像素与修前一致**(这条是本修法的红线,见下面的取反断言)。
 *
 * 权限态是一屏(r8 模式 H 的推论):修法只允许动「管理员那两件东西怎么摆」,
 * 答题判分、直达语义、跳关授权一个字不碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LEVEL99 = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");
const QUIZ99 = readFileSync(new URL("./quiz99.ts", import.meta.url), "utf8");

/** 取出某个文件里某个媒体查询块的完整内容(括号配平) */
function mediaBlock(src: string, query: string, from = 0): string {
  const start = src.indexOf(query, from);
  expect(start, `应有 ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = src.indexOf("{", start);
  const bodyStart = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(bodyStart, i + 1);
}

describe("N-37 关内抬头:矮横屏收起权限状态小字", () => {
  const short = mediaBlock(LEVEL99, "@media (max-height:500px)");

  it("关内抬头的权限小字在矮横屏收起(地图侧那句照旧显示)", () => {
    expect(short).toMatch(/\.l99-stagebar \.l99-jump-note\s*\{\s*display:\s*none/);
    // 收的是「关内抬头里的那一份」,不是全局的 .l99-jump-note ——
    // 地图上的直达行还要靠它告诉家长权限状态
    expect(short).not.toMatch(/(?<!\.l99-stagebar )\.l99-jump-note\s*\{\s*display:\s*none/);
  });

  it("抬头只收内边距与间距,按钮热区与字号一个字不动", () => {
    expect(short).toMatch(/\.l99-stagebar\s*\{[^}]*padding:\s*6px 8px/);
    expect(short).not.toMatch(/\.l99-back|\.l99-tool\s*\{|\.l99-jump-input/);
    expect(short).not.toMatch(/font-size/);
  });

  it("取反:直达控件本身没被藏掉(藏了就等于把管理员功能删了)", () => {
    expect(short).not.toMatch(/\.l99-jump\s*\{[^}]*display:\s*none/);
    expect(short).not.toMatch(/\.l99-tools\s*\{[^}]*display:\s*none/);
    expect(short).not.toMatch(/\.l99-tool-skip\s*\{[^}]*display:\s*none/);
  });

  it("媒体查询挑的是矮屏,不是窄屏 —— 竖屏手机与平板不进这一档", () => {
    expect(LEVEL99).toMatch(/@media \(max-height:500px\)/);
    expect(short).not.toMatch(/max-width/);
  });
});

describe("N-37 答题器:矮横屏让直达行浮进题号行", () => {
  const short = mediaBlock(QUIZ99, "@media (max-height: 500px)");

  it("直达行脱离纵向流,不再从答题区身上切走一整行", () => {
    expect(short).toMatch(/\.qz-jump\s*\{[^}]*position:\s*absolute/);
    expect(short).toMatch(/\.qz-jump\s*\{[^}]*top:\s*8px/);
  });

  it("浮起来的那条不吃点击,底下题号行两颗徽章照常可点", () => {
    expect(short).toMatch(/\.qz-jump\s*\{[^}]*pointer-events:\s*none/);
    expect(short).toMatch(/\.qz-jump > \*\s*\{[^}]*pointer-events:\s*auto/);
  });

  it("题号行只在直达确实存在时让出高度 —— 权限关着时逐像素不变", () => {
    expect(short).toMatch(/\.qz-wrap:has\(\.qz-jump\) \.qz-top\s*\{[^}]*min-height:\s*44px/);
    // 不许写成无条件的 .qz-top{min-height:44px}:那会让 root 关着的孩子面白白高 22px
    expect(short).not.toMatch(/(?<!:has\(\.qz-jump\) )\.qz-top\s*\{[^}]*min-height/);
  });

  it("取反:直达框仍旧是 44px 热区,没被顺手压扁去腾地方", () => {
    expect(QUIZ99).toMatch(/\.qz-jump-input\s*\{[^}]*min-height:\s*44px/);
    expect(short).not.toMatch(/\.qz-jump-input/);
    expect(short).not.toMatch(/\.qz-jump-go/);
  });

  it("取反:答题交互件没被这次改动碰过(L-1 那档的 46/48px 下限还在)", () => {
    expect(short).toMatch(/\.qz-choice\s*\{[^}]*min-height:\s*46px/);
    expect(short).toMatch(/\.qz-say\s*\{[^}]*min-height:\s*44px/);
  });
});

describe("N-37 护栏:判分与直达语义零触碰", () => {
  it("答题器的判分入口还在原处", () => {
    expect(QUIZ99).toMatch(/export function runQuiz/);
    expect(QUIZ99).toMatch(/quizJumpIndex\(input\.value, questions\.length\)/);
  });

  it("l99 的跳关授权与直达仍旧各走各的门", () => {
    expect(LEVEL99).toMatch(/export function skipNeedsParentAuth/);
    expect(LEVEL99).toMatch(/export function rootJumpVisible/);
    // 直达只挪当前关,不写星级数组(这句注释掉了就说明有人动了语义)
    expect(LEVEL99).toMatch(/只挪当前关，星级数组与跳关标记一个字都不写/);
  });
});
