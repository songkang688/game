/**
 * 鸭梨与康康的专属 Q 版头像。
 * 鸭梨:黑发珍珠耳钉、白蕾丝高领配藏青针织衫的小女生;
 * 康康:棕色蓬松刘海、银色圆框眼镜、米白羽绒服的小男生。
 * 所有界面统一从这里取图,保证两位小主角形象一致。
 *
 * 文件名与 key 仍沿用 duoduo / xingxing,只为少动调用点(存档里也没有这两个词)。
 */
import duoduoQUrl from "../assets/avatars/duoduo-q.png";
import xingxingQUrl from "../assets/avatars/xingxing-q.png";
import duoduoCheerUrl from "../assets/avatars/duoduo-cheer.png";
import xingxingRunUrl from "../assets/avatars/xingxing-run.png";

export const AVATAR_URLS = {
  /** 鸭梨 · 半身 Q 头像(圆形裁切友好) */
  duoduo: duoduoQUrl,
  /** 康康 · 半身 Q 头像(圆形裁切友好) */
  xingxing: xingxingQUrl,
  /** 鸭梨 · 全身庆祝(举奖状撒花) */
  duoduoCheer: duoduoCheerUrl,
  /** 康康 · 全身奔跑 */
  xingxingRun: xingxingRunUrl
} as const;

export type AvatarName = keyof typeof AVATAR_URLS;

const ALT_TEXT: Record<AvatarName, string> = {
  duoduo: "鸭梨",
  xingxing: "康康",
  duoduoCheer: "鸭梨在庆祝",
  xingxingRun: "康康在奔跑"
};

/** 生成一个头像 <img>,默认带圆形贴纸样式(白描边 + 软阴影) */
export function createAvatarImg(
  name: AvatarName,
  opts: { size?: number; round?: boolean; className?: string } = {}
): HTMLImageElement {
  const img = document.createElement("img");
  img.src = AVATAR_URLS[name];
  img.alt = ALT_TEXT[name];
  img.draggable = false;
  const round = opts.round ?? true;
  img.className = `avatar-img${round ? " avatar-img--round" : ""}${
    opts.className ? ` ${opts.className}` : ""
  }`;
  if (opts.size) {
    img.style.width = `${opts.size}px`;
    img.style.height = `${opts.size}px`;
  }
  return img;
}

/** 鸭梨 + 康康并排的小组合(用于顶栏等窄空间) */
export function createDuoPair(size = 40): HTMLElement {
  const pair = document.createElement("div");
  pair.className = "duo-pair";
  pair.append(
    createAvatarImg("duoduo", { size, className: "duo-pair-img" }),
    createAvatarImg("xingxing", { size, className: "duo-pair-img" })
  );
  return pair;
}
