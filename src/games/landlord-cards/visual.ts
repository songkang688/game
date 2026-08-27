/**
 * 朵朵抢地主 · 1.3 视觉层(第 22 步 A 档)。
 *
 * 本文件只有「皮肤」:--ld- 配色 token 与动效时长自定义属性、z-index 图层序、
 * 牌面七道工序 HTML(花色 SVG / 王牌立绘 / 中心浮雕)、身份徽章、星屑环、
 * 可出牌集合(只读 `playableGroups`,不改任何合法性判断)。
 *
 * 玩法一个数都不在这里:发牌 / 叫抢 / 出牌合法性 / `fanLayout` 坐标 /
 * 换人遮挡幕「不渲染手牌」的防偷看设计全部原样;皮肤层全是 pointer-events:none
 * 的装饰或纯字符串生成器,同样的入参永远得到同样的结果,能被单测钉死。
 *
 * `prefers-reduced-motion` 下飞行 / 震动 / 呼吸 / 翻牌全停(CSS 媒体查询接线),
 * 落桌软影一闪保留(功能反馈),星屑环只出静态一环。
 */
import {
  JOKER_GOLD,
  JOKER_SILVER,
  SUIT_COOL,
  SUIT_IDS,
  SUIT_WARM,
  jokerArtSvg,
  starSvg,
  suitSvg,
  type JokerKind,
} from "../../art/kit/cardArt";
import { playableGroups } from "./hint";
import { RANK_BIG_JOKER, cardRank, cardSuit, isJoker, rankLabel, type Play } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色 token 与动效时序(step 文档 四·补一 / 四·补三,测试逐字核对)
// ---------------------------------------------------------------------------

/** --ld- 配色 token:全部经 `ldTokensCss()` 落进样式表,单一来源 */
export const LD_TOKENS: Readonly<Record<string, string>> = {
  /** 桌面毛毡渐变的起 / 终两色 */
  "--ld-felt": "#2E6B4F",
  "--ld-felt-deep": "#235240",
  /** 四角木沿 */
  "--ld-wood": "#C89B6C",
  /** 牌面白底 */
  "--ld-card": "#FFFDF6",
  /** 红桃方块 / 黑桃梅花(与 cardArt 的暖冷色同源) */
  "--ld-warm": SUIT_WARM,
  "--ld-cool": SUIT_COOL,
  /** 大王金框 / 小王银框(与 cardArt 的金银同源) */
  "--ld-gold": JOKER_GOLD,
  "--ld-silver": JOKER_SILVER,
  /** 选中描边 + 底光 */
  "--ld-select": "#F4859F",
  /** 轮到自己呼吸微光 */
  "--ld-turn-glow": "rgba(255,214,120,.3)",
};

/** 动效时序表(毫秒 / 幅度),CSS 里写成同名自定义属性 */
export const LD_TIMING = {
  /** 可出牌抬升:6px、120ms ease-out,reduced 只加底光 */
  liftMs: 120,
  liftPx: 6,
  /** 炸弹桌面震动:±2px、160ms ease-out,reduced 只出星屑环静态 */
  shakeMs: 160,
  shakePx: 2,
  /** 轮到自己呼吸:1600ms 周期,reduced 常亮 */
  breathMs: 1600,
  /** 上一手渐隐:240ms linear,reduced 瞬时替换 */
  fadeMs: 240,
  /** 倍数翻牌小卡:180ms ease-in-out,reduced 瞬时换面 */
  flipMs: 180,
  /** 落桌软影一闪:1 帧 step,reduced 保留(功能反馈) */
  landMs: 120,
  /** 星屑环整段寿命(定时器收尸用) */
  ringMs: 620,
} as const;

/**
 * DOM 图层序(z-index 从低到高):
 * ① 毛毡桌面 → ② 对手区 / 头像 → ③ 桌面中央出牌区 → ④ 手牌扇形 →
 * (框选虚线 60)→ ⑤ 飞行中的牌 → ⑥ 星屑 / 震动层 → ⑦ 按钮区与提示 →
 * ⑧ 换人遮挡幕(盖住一切手牌信息)
 */
export const LD_LAYERS = {
  felt: 0,
  seats: 1,
  table: 2,
  fan: 3,
  marquee: 60,
  fly: 70,
  fx: 75,
  hud: 80,
  cover: 100,
} as const;

/** token + 动效时长自定义属性,一次性挂在 .ld-wrap 上 */
export function ldTokensCss(): string {
  const toks = Object.entries(LD_TOKENS)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return (
    `${toks};--ldv-lift-ms:${LD_TIMING.liftMs}ms;--ldv-shake-ms:${LD_TIMING.shakeMs}ms;` +
    `--ldv-breath-ms:${LD_TIMING.breathMs}ms;--ldv-fade-ms:${LD_TIMING.fadeMs}ms;` +
    `--ldv-flip-ms:${LD_TIMING.flipMs}ms;--ldv-land-ms:${LD_TIMING.landMs}ms;`
  );
}

// ---------------------------------------------------------------------------
// 二、牌面七道工序(step 文档 四·补二)
// ---------------------------------------------------------------------------

/**
 * 窄牌兜底线:牌宽小于它就省略中心浮雕与徽记缎带,只留角标与立绘。
 * `cardWidthFor(360) = 51` 在线上,`cardWidthFor(320) = 46` 在线下——
 * 360px 手机保浮雕,更窄的容器保角标。
 */
export const EMBOSS_MIN_W = 48;

/**
 * 大小王缎带徽记(窗口 7 R2 修复 N-1):原 9px「大/小王」小字改图形徽记,
 * 沿用立绘的身份语言——大王(朵朵)=五瓣花徽、小王(星星)=五角星徽,
 * 形状 + 色相双通道,不再依赖 <14px 文字;身份文字仍由 ≥14px 角标承担。
 */
export function kribbonBadgeSvg(kind: JokerKind, size = 12): string {
  if (kind === "big") {
    let petals = "";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      petals += `<circle cx="${(8 + Math.cos(a) * 4.2).toFixed(2)}" cy="${(8 + Math.sin(a) * 4.2).toFixed(2)}" r="3" fill="#E2648F"/>`;
    }
    return `<svg data-part="ribbon-flower" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${petals}<circle cx="8" cy="8" r="2.7" fill="#FFF3D0" stroke="#B98A2F" stroke-width="1"/></svg>`;
  }
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? 7 : 2.9;
    pts.push(`${(8 + Math.cos(a) * rr).toFixed(2)},${(8 + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `<svg data-part="ribbon-star" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><polygon points="${pts.join(" ")}" fill="#5C79C4" stroke="#44506B" stroke-width="1" stroke-linejoin="round"/></svg>`;
}

/** 中心大花色浮雕只给 10/J/Q/K/A(点数 10..14) */
export function embossRank(rank: number): boolean {
  return rank >= 10 && rank <= 14;
}

/**
 * 牌面七道工序(白底圆角与软影由 .ld-card 承担):
 * ② 内圈双细线框 → ③ 左上 / 右下对角角标(数字 + 花色 SVG)→ ④ 花色四色自绘 →
 * ⑤ 10–A 中心浮雕淡纹(窄牌省略)→ ⑥ 大小王换朵朵 / 星星立绘 + 金银双线框 +
 * 徽记缎带(窄牌省略缎带)→ ⑦ 全部 pointer-events:none,不碰热区。
 */
export function cardFaceArtHTML(id: number, cardW: number): string {
  const rank = cardRank(id);
  const idx = Math.max(11, Math.round(cardW * 0.32));
  const wide = cardW >= EMBOSS_MIN_W;

  if (isJoker(id)) {
    const kind: JokerKind = rank === RANK_BIG_JOKER ? "big" : "small";
    const word = kind === "big" ? "大" : "小";
    const art = jokerArtSvg(kind, Math.max(24, Math.round(cardW * 0.6)));
    const ribbon = wide
      ? `<span class="ldv-kribbon ldv-kribbon-${kind}" aria-hidden="true">${kribbonBadgeSvg(kind)}</span>`
      : "";
    return `<i class="ldv-frame ldv-frame-${kind}" aria-hidden="true"></i>
      <span class="ld-c-i ldv-kc-${kind}" style="font-size:${Math.round(idx * 0.85)}px"><span class="ld-c-r">${word}</span><span class="ld-c-s">王</span></span>
      ${ribbon}<span class="ldv-joker">${art}</span>`;
  }

  const suit = SUIT_IDS[cardSuit(id)!];
  const label = rankLabel(rank);
  // 「10」是两个字,窄一号才塞得进扇形只露出的那条窄缝
  const rankSize = label.length > 1 ? Math.round(idx * 0.72) : idx;
  const corner = `<span class="ld-c-r" style="font-size:${rankSize}px">${label}</span><span class="ld-c-s ldv-cs">${suitSvg(suit, Math.max(9, Math.round(cardW * 0.24)))}</span>`;
  const emboss =
    wide && embossRank(rank)
      ? `<span class="ldv-emboss" aria-hidden="true">${suitSvg(suit, Math.round(cardW * 0.74))}</span>`
      : "";
  return `<i class="ldv-frame" aria-hidden="true"></i>${emboss}
    <span class="ld-c-i" style="font-size:${Math.round(idx * 0.85)}px">${corner}</span>
    <span class="ldv-ci-br" style="font-size:${Math.round(idx * 0.85)}px">${corner}</span>`;
}

// ---------------------------------------------------------------------------
// 三、纯映射:可出牌集合 / 身份徽章 / 炸弹动效 / 星屑环 / 幕布装饰
// ---------------------------------------------------------------------------

/**
 * 现在能出的牌都有哪几张:只读 `playableGroups` 的结果,给合法牌加抬升类。
 * 合法性判断本身在 hint.ts / logic.ts,这里一个字都不改。
 */
export function canLiftIds(hand: readonly number[], prev: Play | null): Set<number> {
  const out = new Set<number>();
  for (const p of playableGroups(hand, prev)) for (const id of p.cards) out.add(id);
  return out;
}

/** 地主戴自绘小皇冠,农民戴小草帽,挂在头像角上 */
export function roleBadgeSvg(role: "landlord" | "farmer", size = 16): string {
  if (role === "landlord") {
    return `<svg class="ldv-crown" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 14 2 6l4.4 3L10 3l3.6 6L18 6l-1 8Z" fill="${JOKER_GOLD}" stroke="#B98A2F" stroke-width="1"/><rect x="3" y="14" width="14" height="2.6" rx="1.3" fill="#B98A2F"/><circle cx="10" cy="10.6" r="1.4" fill="#FFF3D0"/></svg>`;
  }
  return `<svg class="ldv-strawhat" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10q0-6 5-6t5 6Z" fill="#EBC97E"/><rect x="4.4" y="9" width="11.2" height="1.8" rx=".9" fill="#C89B6C"/><ellipse cx="10" cy="12" rx="8.6" ry="2.4" fill="#F2D592"/></svg>`;
}

// ---------------------------------------------------------------------------
// 三·补(窗口 7 R1 修复 A-2):AI 对手自绘头像,替掉裸 emoji 🐰🐼
// ---------------------------------------------------------------------------

/** 两位小牌灵的头像键:团团 = 长耳小兔,圆圆 = 圆耳熊猫(原创造型,不像任何官方形象) */
export type BotFaceKind = "tuantuan" | "yuanyuan";

/** 头像统一描边色(与 kit 图标 1.5px 描边同规格) */
export const BOT_FACE_STROKE = "rgba(90,74,110,.4)";

/**
 * AI 头像 SVG(24×24 视窗),与朵朵 / 星星立绘同一套工序:
 * 2 停线性渐变(左上亮)+ 1.5px 描边 + 左上高光小椭圆。
 * 16px 灰度可分靠**耳形几何差**:团团双长耳(耳长 ≈ 脸径 0.7)/ 圆圆双圆耳 + 眼周深色椭圆。
 */
export function botFaceSvg(kind: BotFaceKind): string {
  if (kind === "tuantuan") {
    // 团团:暖白圆脸 + 双长耳(内耳粉),剪影上是「两根天线」
    return `<svg class="ldv-botsvg ldv-bot-tuantuan" viewBox="0 0 24 24" aria-hidden="true">
  <defs><linearGradient id="ldvg-tt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#F3E7DA"/></linearGradient></defs>
  <ellipse cx="8.6" cy="7.2" rx="2.5" ry="5.6" transform="rotate(-9 8.6 7.2)" fill="url(#ldvg-tt)" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <ellipse cx="15.4" cy="7.2" rx="2.5" ry="5.6" transform="rotate(9 15.4 7.2)" fill="url(#ldvg-tt)" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <ellipse cx="8.7" cy="7.6" rx="1.1" ry="3.4" transform="rotate(-9 8.7 7.6)" fill="#F7C6D4"/>
  <ellipse cx="15.3" cy="7.6" rx="1.1" ry="3.4" transform="rotate(9 15.3 7.6)" fill="#F7C6D4"/>
  <circle cx="12" cy="15.4" r="7.1" fill="url(#ldvg-tt)" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <ellipse cx="9.4" cy="12.6" rx="2" ry="1.3" fill="#FFFFFF" opacity=".55"/>
  <circle cx="9.5" cy="15.2" r=".95" fill="#4A3B55"/>
  <circle cx="14.5" cy="15.2" r=".95" fill="#4A3B55"/>
  <circle cx="7.7" cy="17.3" r="1.1" fill="#FFC1CC" opacity=".85"/>
  <circle cx="16.3" cy="17.3" r="1.1" fill="#FFC1CC" opacity=".85"/>
  <path d="M11 17.7q1 1 2 0" stroke="#C2557F" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</svg>`;
  }
  // 圆圆:白脸 + 双圆小耳 + 眼周深色椭圆两块——耳小且低、深色块认脸,与团团的长耳剪影一眼分开
  return `<svg class="ldv-botsvg ldv-bot-yuanyuan" viewBox="0 0 24 24" aria-hidden="true">
  <defs><linearGradient id="ldvg-yy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#ECEAF2"/></linearGradient></defs>
  <circle cx="6" cy="7.8" r="3" fill="#4A4A55" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <circle cx="18" cy="7.8" r="3" fill="#4A4A55" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <circle cx="12" cy="14.2" r="8" fill="url(#ldvg-yy)" stroke="${BOT_FACE_STROKE}" stroke-width="1.5"/>
  <ellipse cx="8.6" cy="9.6" rx="2.1" ry="1.4" fill="#FFFFFF" opacity=".5"/>
  <ellipse cx="9" cy="13.6" rx="2.2" ry="2.9" transform="rotate(-18 9 13.6)" fill="#4A4A55"/>
  <ellipse cx="15" cy="13.6" rx="2.2" ry="2.9" transform="rotate(18 15 13.6)" fill="#4A4A55"/>
  <circle cx="9.4" cy="13.4" r=".8" fill="#FFFFFF"/>
  <circle cx="14.6" cy="13.4" r=".8" fill="#FFFFFF"/>
  <ellipse cx="12" cy="16.6" rx="1.1" ry=".8" fill="#4A4A55"/>
  <path d="M11 18.4q1 .9 2 0" stroke="#6E6E7C" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</svg>`;
}

/**
 * 炸弹 / 王炸的桌面反馈计划:
 * 正常档震一下(±2px、160ms)+ 星屑环;reduced 不震,只出星屑环静态。
 */
export function bombFxPlan(reduced: boolean): { shake: boolean; ring: true } {
  return { shake: !reduced, ring: true };
}

/** 星屑环的星星颗数与半径 */
export const RING_STARS = 8;
export const RING_R = 34;

/** 星屑环:8 颗四角星围一圈(容器定位在出牌区中心,动效由 CSS 管) */
export function starRingHtml(): string {
  const colors = ["#FFD980", "#FFFDF6", "#FFB3CB", "#C9D3DE"];
  let out = "";
  for (let i = 0; i < RING_STARS; i++) {
    const a = (Math.PI * 2 * i) / RING_STARS;
    const x = (Math.cos(a) * RING_R).toFixed(1);
    const y = (Math.sin(a) * RING_R).toFixed(1);
    out += `<span class="ldv-fx-star" style="left:${x}px;top:${y}px;animation-delay:${i * 18}ms">${starSvg(i % 2 === 0 ? 14 : 10, colors[i % colors.length])}</span>`;
  }
  return out;
}

/** 换人遮挡幕上的小星星装饰(纯装饰,不带任何手牌信息) */
export function curtainDecorHtml(): string {
  return `<span class="ldv-curtain-stars" aria-hidden="true">${starSvg(18, "#FFD980")}${starSvg(26, "#FFFDF6")}${starSvg(18, "#F4859F")}</span>`;
}

// ---------------------------------------------------------------------------
// 四、皮肤样式(插在 index.ts 样式表的 1.2 块之前)
// ---------------------------------------------------------------------------

export const LDV_CSS = `
/* --- 1.3 视觉升级(第 22 步 A 档):token 单源 + ldv- 皮肤层 --------------- */
.ld-wrap{${ldTokensCss()}}
.ldv-fx-layer{position:absolute;inset:0;pointer-events:none;z-index:${LD_LAYERS.fx};overflow:visible;}
.ldc-mainbar,.ldc-subbar{position:relative;z-index:${LD_LAYERS.hud};}
.ld-foes,.ld-center,.ld-mehead{position:relative;}
.ld-foes{z-index:${LD_LAYERS.seats};}
.ld-center{z-index:${LD_LAYERS.table};}
.ld-fanbox{z-index:${LD_LAYERS.fan};}
.ld-mehead .ld-foe-name{color:#fff;}
.ld-mehead .ld-count{color:#e8e2f4;}
.ldv-avatar{position:relative;display:inline-flex;}
/* AI 自绘头像:SVG 跟着 .ld-face 圆框(38/28/24/20px)等比缩放,不参与热区 */
.ldv-botface{overflow:hidden;}
.ldv-botface .ldv-botsvg{width:100%;height:100%;display:block;pointer-events:none;}
.ldv-badge{position:absolute;right:-7px;top:-9px;line-height:0;pointer-events:none;
  filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));}
/* 牌面:内圈双细线框(主题色随牌色,间距 2px) */
.ldv-frame{position:absolute;inset:2px;border:1px solid currentColor;border-radius:6px;
  opacity:.26;pointer-events:none;}
.ldv-frame::after{content:"";position:absolute;inset:2px;border:1px solid currentColor;border-radius:4px;}
.ldv-frame-big{border-color:var(--ld-gold);opacity:.95;}
.ldv-frame-small{border-color:var(--ld-silver);opacity:.95;}
.ldv-cs{line-height:0;}
.ldv-ci-br{position:absolute;right:2px;bottom:2px;display:flex;flex-direction:column;
  align-items:center;line-height:1.05;font-weight:900;transform:rotate(180deg);pointer-events:none;}
.ldv-emboss{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);
  opacity:.08;line-height:0;pointer-events:none;}
.ldv-joker{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);
  line-height:0;pointer-events:none;}
.ldv-kc-big{color:#c29028;}
.ldv-kc-small{color:#6e7c92;}
.ldv-kribbon{position:absolute;top:2px;left:50%;transform:translateX(-50%);line-height:0;
  padding:2px 6px;border-radius:999px;
  background:linear-gradient(180deg,#ffe3a1,#f5c963);pointer-events:none;}
.ldv-kribbon-small{background:linear-gradient(180deg,#e8eef5,#c9d3de);}
/* 手牌层次:可出牌抬升 + 底光;轮到自己整扇呼吸微光 */
.ldv-can{box-shadow:1px 0 0 rgba(90,74,110,.14),0 9px 12px -4px rgba(255,214,120,.6),0 2px 5px rgba(15,25,20,.35);}
.ldv-myturn{border-radius:12px;animation:ldvbreath var(--ldv-breath-ms) ease-in-out infinite;}
@keyframes ldvbreath{0%,100%{box-shadow:0 0 0 0 var(--ld-turn-glow);}50%{box-shadow:0 0 18px 6px var(--ld-turn-glow);}}
/* 出牌轨迹配菜:落桌软影一闪(1 帧 step)/ 上一手渐隐 / 炸弹震动 + 星屑环 */
.ldv-land{animation:ldvland var(--ldv-land-ms) steps(1,end);}
@keyframes ldvland{from{box-shadow:0 8px 14px -4px rgba(10,30,20,.6);}to{box-shadow:0 2px 6px rgba(150,140,190,.18);}}
.ldv-ghost{position:absolute;pointer-events:none;animation:ldvfade var(--ldv-fade-ms) linear both;}
@keyframes ldvfade{from{opacity:.9;}to{opacity:0;}}
.ldv-shakeboom{animation:ldvboom var(--ldv-shake-ms) ease-out;}
@keyframes ldvboom{0%,100%{transform:translate(0,0);}25%{transform:translate(-${LD_TIMING.shakePx}px,1px);}50%{transform:translate(${LD_TIMING.shakePx}px,-1px);}75%{transform:translate(-${LD_TIMING.shakePx}px,-1px);}}
.ldv-ring{position:absolute;width:0;height:0;}
.ldv-ring::before{content:"";position:absolute;left:-26px;top:-26px;width:52px;height:52px;
  border-radius:50%;border:3px solid rgba(255,214,120,.8);animation:ldvringx .5s ease-out both;}
@keyframes ldvringx{from{transform:scale(.5);opacity:1;}to{transform:scale(1.6);opacity:0;}}
.ldv-fx-star{position:absolute;line-height:0;transform:translate(-50%,-50%);
  animation:ldvburst .55s ease-out both;}
@keyframes ldvburst{from{transform:translate(-50%,-50%) scale(.2);opacity:1;}to{transform:translate(-50%,-50%) scale(1.15);opacity:0;}}
/* 叫抢阶段的倍数牌:翻牌小卡 */
.ldv-bid{background:#fff8e9;}
.ldv-flip{animation:ldvflip var(--ldv-flip-ms) ease-in-out;}
@keyframes ldvflip{from{transform:rotateX(90deg);}to{transform:rotateX(0);}}
/* 换人遮挡幕:布褶幕布 + 「请交给 XX」缎带牌 + 小星星(不渲染手牌的逻辑在 renderHand) */
.ldv-curtain{background:repeating-linear-gradient(90deg,#f8a9c3 0 22px,#f294b4 22px 30px,#fbc0d6 30px 44px);}
.ldv-curtain .ld-cover-t,.ldv-curtain .ld-cover-s{color:#7c2e4e;}
.ldv-curtain-stars{display:flex;gap:10px;line-height:0;filter:drop-shadow(0 1px 2px rgba(120,40,80,.35));}
.ldv-ribbon{position:relative;z-index:0;font-size:16px;font-weight:900;color:#8a3d5e;
  background:linear-gradient(180deg,#fffdf6,#ffe9f2);border-radius:10px;padding:7px 18px;
  box-shadow:0 3px 8px rgba(150,60,100,.3);}
.ldv-ribbon::before,.ldv-ribbon::after{content:"";position:absolute;top:6px;z-index:-1;
  border:9px solid #e2648f;}
.ldv-ribbon::before{left:-13px;border-left-color:transparent;}
.ldv-ribbon::after{right:-13px;border-right-color:transparent;}
@media (prefers-reduced-motion:reduce){
  /* 呼吸常亮、震动 / 翻牌 / 渐隐 / 星屑飞散全停;落桌软影一闪(ldvland)保留 */
  .ldv-myturn{animation:none;box-shadow:0 0 14px 4px var(--ld-turn-glow);}
  .ldv-shakeboom{animation:none;}
  .ldv-flip{animation:none;}
  .ldv-ghost{animation:none;opacity:0;}
  .ldv-fx-star{animation:none;opacity:.85;}
  .ldv-ring::before{animation:none;transform:scale(1.2);opacity:.7;}
}
`;
