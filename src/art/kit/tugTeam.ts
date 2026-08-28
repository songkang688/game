/**
 * 1.3 共享美术套件 · 拔河小队(窗口8 C 档专属文件,别人只 import 不改)。
 *
 * 纯字符串 SVG 生成器,零 DOM 依赖 —— node 环境的用例直接断言产物。
 * 工序单(1.3 第 23 步 C 档 4.2 节):
 *  - viewBox 48×56;圆角胶囊躯干(队色 135° 渐变)+ 圆头(肤色 #ffe3c8,2px 队色深描边);
 *  - 手臂两条圆端粗线(stroke-width:5)伸向绳子方向,手部小圆握在绳带上;
 *  - 表情两档:普通(豆点眼 + 抿嘴)/ 领队(咬牙短齿线 + 鼓腮圆);
 *  - 红队领队加头带、蓝队领队加帽子,剪影一眼分清;
 *  - 脚下椭圆阴影 rgba(0,0,0,.12),后仰时沿 `--rbg-shx` 反向偏移;
 *  - 同队三只错位排布:间距 26px、缩放 1 / 0.92 / 0.86,领队在最靠绳位。
 */

/** 拔河题材专用色板(通用粉彩在 palette.ts,这里只放题材色) */
export const TUG_ART = Object.freeze({
  /** 红队衣服主色 / 描边阴影 */
  tugRed: "#ff6b6b",
  tugRedDark: "#e14b4b",
  /** 蓝队衣服主色 / 描边阴影 */
  tugBlue: "#5b9bff",
  tugBlueDark: "#3d78e0",
  /** 麻绳主体 / 绳纹斜线 */
  ropeTan: "#d9a066",
  ropeLine: "#a06b3a",
  /** 中点丝带:全场最醒目一点 */
  ribbonRed: "#ff3355",
  /** 中央河沟纵向渐变两端 */
  riverTop: "#8fd3ff",
  riverBottom: "#5b9bff",
  /** 草地双色横带 */
  grassLight: "#b8e986",
  grassDark: "#8fc866",
  /** 背景天空纵向渐变 */
  skyTop: "#cfeaff",
  skyBottom: "#f4fbff",
  /** 肤色与腮红 */
  skin: "#ffe3c8",
  blush: "#ffc9a8",
});

export type TugSide = "red" | "blue";
export type TugRole = "leader" | "member";
export type TugPose = "pull" | "cheer" | "sit";

/** 同队三只的缩放:领队 1,身后依次 0.92 / 0.86 造前后纵深 */
export const TEAM_SCALES = [1, 0.92, 0.86] as const;
/** 同队相邻两只的横向间距(px) */
export const TEAM_SPACING = 26;
/** 站位角基准(度):整队向己方后倾的底角 */
export const BASE_LEAN_DEG = 6;
/** 单只小人的 viewBox 尺寸 */
export const PULLER_W = 48;
export const PULLER_H = 56;
/** 一整队(3 只错位)的占位宽:2 段间距 + 一只小人 */
export const SQUAD_W = TEAM_SPACING * 2 + PULLER_W;

export function teamColors(side: TugSide): { main: string; dark: string } {
  return side === "red"
    ? { main: TUG_ART.tugRed, dark: TUG_ART.tugRedDark }
    : { main: TUG_ART.tugBlue, dark: TUG_ART.tugBlueDark };
}

/** 普通队员的脸:豆点眼 + 抿嘴 */
function faceCalm(): string {
  return (
    `<circle data-part="eye" cx="18.5" cy="9.5" r="1.6" fill="#4a3b47"/>` +
    `<circle data-part="eye" cx="24.5" cy="9.5" r="1.6" fill="#4a3b47"/>` +
    `<path data-part="mouth" d="M20 15.5h5" stroke="#4a3b47" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
  );
}

/** 领队的脸:咬牙短齿线 + 鼓腮圆 + 用力眉 */
function faceLeader(dark: string): string {
  return (
    `<circle data-part="cheek" cx="14.6" cy="13.4" r="2.8" fill="${TUG_ART.blush}" opacity=".95"/>` +
    `<path data-part="brow" d="M16.6 6.8l3.6 1.5M27 8.3l3.4-1.5" stroke="#4a3b47" stroke-width="1.4" stroke-linecap="round" fill="none"/>` +
    `<circle data-part="eye" cx="19" cy="10" r="1.5" fill="#4a3b47"/>` +
    `<circle data-part="eye" cx="25" cy="10" r="1.5" fill="#4a3b47"/>` +
    `<path data-part="teeth" d="M18.6 13.8h7.6v3.2h-7.6z" fill="#fff" stroke="${dark}" stroke-width="1"/>` +
    `<path data-part="teeth" d="M21.1 13.8v3.2M23.6 13.8v3.2" stroke="${dark}" stroke-width=".8"/>`
  );
}

/** 笑到眯眼 + 张嘴大笑(胜方仪式用) */
function faceLaugh(): string {
  return (
    `<path data-part="eye" d="M16.8 9.6q2-2.4 4 0M23.2 9.6q2-2.4 4 0" stroke="#4a3b47" stroke-width="1.5" stroke-linecap="round" fill="none"/>` +
    `<path data-part="laugh" d="M17.6 13.6a4.4 4.4 0 0 0 8.8 0z" fill="#8a4a55"/>`
  );
}

/** 眯眼 + 吐舌头笑(败方坐地用,输也笑着收场) */
function faceTongue(): string {
  return (
    `<path data-part="eye" d="M16.8 17.6q2-2.4 4 0M23.2 17.6q2-2.4 4 0" stroke="#4a3b47" stroke-width="1.5" stroke-linecap="round" fill="none"/>` +
    `<path data-part="mouth" d="M18 21.2q3.5 3.4 7 0" stroke="#4a3b47" stroke-width="1.4" stroke-linecap="round" fill="none"/>` +
    `<path data-part="tongue" d="M20.4 22.6q1.4 3.4 3.6 1.4 1-1.2-.2-2.4z" fill="#ff8fa3"/>`
  );
}

/** 红队领队的头带(带两根小飘带),蓝队领队的鸭舌帽(带白色小绒球) */
function headgear(side: TugSide): string {
  if (side === "red") {
    return (
      `<rect data-part="headband" x="12.4" y="6" width="17.2" height="3.6" rx="1.8" fill="${TUG_ART.tugRedDark}"/>` +
      `<path data-part="headband" d="M12.6 7.2l-4.2-1.8M12.6 8.8l-4.6.9" stroke="${TUG_ART.tugRedDark}" stroke-width="2" stroke-linecap="round" fill="none"/>`
    );
  }
  return (
    `<path data-part="hat" d="M12.4 9.6a8.8 7.2 0 0 1 17.6 0z" fill="${TUG_ART.tugBlueDark}"/>` +
    `<rect data-part="hat" x="19.6" y="8.4" width="13.2" height="2.6" rx="1.3" fill="${TUG_ART.tugBlueDark}"/>` +
    `<circle data-part="hat" cx="21.2" cy="2.8" r="2" fill="#fff"/>`
  );
}

/** 后仰拉绳姿态的身体(面朝右;蓝队由外层 <g> 镜像) */
function bodyPull(side: TugSide, role: TugRole, grad: string, dark: string): string {
  return (
    `<ellipse data-part="shadow" cx="24" cy="53" rx="13" ry="3" fill="rgba(0,0,0,.12)" style="transform:translateX(var(--rbg-shx,0px))"/>` +
    `<path data-part="leg" d="M20 40l-7 11M27 40l5 11" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<rect data-part="torso" x="14" y="21" width="17" height="21" rx="8.5" fill="url(#${grad})"/>` +
    `<path data-part="arm" d="M23 25l16 4M21 31l16 4" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<circle data-part="head" cx="21" cy="11" r="9" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="2"/>` +
    (role === "leader" ? faceLeader(dark) + headgear(side) : faceCalm()) +
    `<circle data-part="hand" cx="39" cy="29" r="3" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="1.2"/>` +
    `<circle data-part="hand" cx="37" cy="35" r="3" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="1.2"/>`
  );
}

/** 双手高举欢呼(胜方) */
function bodyCheer(side: TugSide, role: TugRole, grad: string, dark: string): string {
  return (
    `<ellipse data-part="shadow" cx="24" cy="53" rx="12" ry="3" fill="rgba(0,0,0,.12)"/>` +
    `<path data-part="leg" d="M20 41l-2 10M27 41l3 10" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<rect data-part="torso" x="14" y="22" width="17" height="20" rx="8.5" fill="url(#${grad})"/>` +
    `<path data-part="arm" d="M17 26L8 14M28 26l9-12" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<circle data-part="hand" cx="8" cy="14" r="3" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="1.2"/>` +
    `<circle data-part="hand" cx="37" cy="14" r="3" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="1.2"/>` +
    `<circle data-part="head" cx="22" cy="11" r="9" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="2"/>` +
    faceLaugh() +
    (role === "leader" ? headgear(side) : "")
  );
}

/** 坐地吐舌头笑(败方,可爱收场) */
function bodySit(side: TugSide, role: TugRole, grad: string, dark: string): string {
  return (
    `<ellipse data-part="shadow" cx="26" cy="53.4" rx="15" ry="2.6" fill="rgba(0,0,0,.12)"/>` +
    `<path data-part="leg" d="M22 44l14 6M20 47l14 6" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<path data-part="arm" d="M16 36L8 49" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<rect data-part="torso" x="14" y="29" width="17" height="19" rx="8.5" fill="url(#${grad})"/>` +
    `<circle data-part="head" cx="21" cy="19" r="9" fill="${TUG_ART.skin}" stroke="${dark}" stroke-width="2"/>` +
    faceTongue() +
    (role === "leader" ? `<g transform="translate(0 8)">${headgear(side)}</g>` : "")
  );
}

export interface TugPullerOpts {
  side: TugSide;
  role?: TugRole;
  pose?: TugPose;
}

/**
 * 一只拔河小人的完整 SVG 字符串。
 * 红队面朝右(绳在右手边),蓝队整体镜像;渐变 id 按队分开,重复出现也只是同名同值。
 */
export function tugPullerSvg(opts: TugPullerOpts): string {
  const side = opts.side;
  const role = opts.role ?? "member";
  const pose = opts.pose ?? "pull";
  const { main, dark } = teamColors(side);
  const grad = side === "red" ? "rbgTugGradR" : "rbgTugGradB";
  const body =
    pose === "cheer"
      ? bodyCheer(side, role, grad, dark)
      : pose === "sit"
        ? bodySit(side, role, grad, dark)
        : bodyPull(side, role, grad, dark);
  const mirror = side === "blue" ? ` transform="scale(-1 1) translate(-${PULLER_W} 0)"` : "";
  return (
    `<svg class="rbg-puller-svg" viewBox="0 0 ${PULLER_W} ${PULLER_H}" width="${PULLER_W}" height="${PULLER_H}" ` +
    `role="img" aria-hidden="true" focusable="false">` +
    `<defs><linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/>` +
    `</linearGradient></defs>` +
    `<g${mirror}>${body}</g>` +
    `</svg>`
  );
}

/**
 * 一整队(3 只)的 HTML 字符串:间距 26px、缩放 1 / 0.92 / 0.86,领队在最靠绳位。
 * 红队绳在右侧 → 领队排最右;蓝队镜像 → 领队排最左。z 序保证领队在最上层。
 */
export function tugTeamHtml(side: TugSide, pose: TugPose = "pull"): string {
  const roles: TugRole[] = ["member", "member", "leader"];
  const slots: string[] = [];
  for (let i = 0; i < 3; i++) {
    // i=2 是领队:红队靠右(x=52),蓝队靠左(x=0)
    const x = side === "red" ? i * TEAM_SPACING : (2 - i) * TEAM_SPACING;
    const scale = TEAM_SCALES[2 - i];
    slots.push(
      `<span class="rbg-slot" style="left:${x}px;z-index:${i + 1};transform:scale(${scale})">` +
        tugPullerSvg({ side, role: roles[i], pose }) +
        `</span>`
    );
  }
  return `<div class="rbg-squad rbg-squad-${side}" style="--rbg-shx:0px">${slots.join("")}</div>`;
}
