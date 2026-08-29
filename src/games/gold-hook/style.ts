/**
 * 金矿钩钩的局部样式。
 *
 * 单独一个文件是为了能被单测直接读到 —— 「顶部字号 ≥ 14px」「底部热区 ≥ 44px」
 * 这两条是 360px 手机上的硬约束，写在注释里没人守得住，得能断言。
 *
 * 类名一律 `gdh-` 前缀，整段挂在本款自己的 `<style>` 上，
 * **不往全局 `src/styles.css` 里加一个字符**。
 */
import { HUD_MIN_FONT, TALLY_MS, TOUCH_MIN } from "./depth12";

export const CSS = `
.gdh-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.gdh-run{display:flex;flex-direction:column;gap:6px;}

/* 顶部一行:金币 / 目标 / 剩余时间。字号钉死在 ${HUD_MIN_FONT}px,窄屏也不许再小。
   「收工」达标以后也挂在这一行:它和「目标」是同一件事,挤到底下那行会把放绳按钮顶出屏幕。
   1.3 起芯片图标全部手绘(gdh-ic-cv 那块小画布),不再用 emoji —— 换台设备就变脸 */
.gdh-hud{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;justify-content:center;}
.gdh-done{padding:6px 10px;font-size:${HUD_MIN_FONT}px;flex:none;
  animation:gdh-done-glow 1.6s ease-in-out infinite;}
@keyframes gdh-done-glow{
  0%,100%{box-shadow:0 3px 0 rgba(170,140,90,.34),0 0 0 0 rgba(255,205,90,.7);}
  50%{box-shadow:0 3px 0 rgba(170,140,90,.34),0 0 12px 4px rgba(255,205,90,.55);}
}
.gdh-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:${HUD_MIN_FONT}px;font-weight:800;
  color:#7A5A2E;box-shadow:0 2px 6px rgba(170,140,90,.24);white-space:nowrap;
  display:inline-flex;align-items:center;gap:4px;}
.gdh-chip-goal{background:#FFF0D4;color:#9A6A16;}
.gdh-chip-bag{background:#F1EAFB;color:#6B4E9A;font-size:${HUD_MIN_FONT}px;padding:4px 8px;}
.gdh-ic-cv{flex:none;display:inline-block;vertical-align:-2px;}
.gdh-ic-num{font-size:${HUD_MIN_FONT}px;font-weight:900;}
.gdh-bar{position:relative;flex:1;min-width:88px;height:22px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(160,130,90,.3);}
.gdh-bar-fill{height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#FFD98A,#FF9E5E);
  transition:width .2s linear;}
.gdh-bar-fill.gdh-low{background:linear-gradient(90deg,#FFB3A7,#F0776A);}
.gdh-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:4px;
  font-size:${HUD_MIN_FONT}px;font-weight:900;color:#6E4A18;}

.gdh-box{position:relative;display:flex;justify-content:center;}
.gdh-cv{display:block;border-radius:16px;box-shadow:0 4px 12px rgba(150,120,80,.26);max-width:100%;
  touch-action:manipulation;cursor:pointer;}

/* 底部一行:放绳 + 道具栏。nowrap 保证它永远是一行,min-height 保证热区够小手点 */
.gdh-ctrl{display:flex;gap:6px;justify-content:center;align-items:stretch;flex-wrap:nowrap;position:relative;z-index:3;}
.gdh-btn{border:none;border-radius:999px;padding:9px 14px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe6;color:#7A5A2E;box-shadow:0 3px 0 rgba(170,140,90,.34);
  white-space:nowrap;min-height:${TOUCH_MIN}px;min-width:${TOUCH_MIN}px;display:inline-flex;
  align-items:center;justify-content:center;gap:4px;}
.gdh-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,140,90,.34);}
.gdh-btn[disabled]{opacity:.45;cursor:default;}
/* inline-flex 会盖掉浏览器给 [hidden] 的 display:none,不写这条「收工」就一直杵在那儿,
   还白占一格 44px 的宽度,360px 上正是它把整行挤出了屏幕 */
.gdh-btn[hidden]{display:none;}
.gdh-btn-fire{background:linear-gradient(180deg,#FFC96B,#EEA23A);color:#fff;box-shadow:0 4px 0 #C67F22;
  padding:9px 22px;font-size:17px;}
.gdh-btn-bomb{background:linear-gradient(180deg,#FFA9A0,#EE7A6E);color:#fff;box-shadow:0 4px 0 #C75648;}
.gdh-btn-shop{background:linear-gradient(180deg,#B8A2EA,#9077D2);color:#fff;box-shadow:0 4px 0 #6F58AB;}
/* 道具栏里的力量水 / 幸运石只是状态,不是按钮,但要和按钮一样高才对得齐 */
.gdh-kit{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-height:${TOUCH_MIN}px;
  padding:0 10px;border-radius:999px;background:#F1EAFB;color:#6B4E9A;font-size:${HUD_MIN_FONT}px;
  font-weight:900;white-space:nowrap;box-shadow:0 2px 6px rgba(140,110,170,.22);}
/* 按钮里的图标截:炸药按钮的手绘图标 + 存量数字待在这一截,窄屏收文字也收不掉它 */
.gdh-ic{display:inline-flex;align-items:center;gap:3px;}
.gdh-tip{text-align:center;font-size:12px;font-weight:700;color:#8A6C42;line-height:1.5;margin:0;}

.gdh-toast{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#7A5A2E;box-shadow:0 3px 8px rgba(160,130,90,.32);
  pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:92%;text-align:center;}
.gdh-toast.gdh-on{opacity:1;}

/* 首尾的 auto 外边距代替 justify-content:center:内容装得下时照样居中,
   装不下时 auto 收成 0,从顶上开始往下排,标题不会被剪掉,滚动条也够得着。
   z-index 压过底栏 HUD:商店打开时 veil 盖住放绳/商店/暂停,关闭钮不会被 HUD 挡住 */
.gdh-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  gap:10px;text-align:center;padding:16px;background:rgba(255,251,244,.95);border-radius:16px;overflow:auto;z-index:6;}
.gdh-veil>:first-child{margin-top:auto;}
.gdh-veil>:last-child{margin-bottom:auto;}
.gdh-veil[hidden]{display:none;}
.gdh-veil-title{font-size:19px;font-weight:900;color:#8A5A22;}
.gdh-veil-sub{font-size:14px;font-weight:700;color:#7A6242;line-height:1.6;max-width:320px;}

.gdh-shoplist{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;}
/* N-45 配方 I:滚动切在货架,「接着挖」钉在 footer。暂停 veil 不挂这套类 */
.gdh-veil--shop{overflow:hidden;justify-content:flex-start;min-height:0;}
.gdh-veil--shop>:first-child{margin-top:0;}
.gdh-veil--shop>:last-child{margin-bottom:0;}
.gdh-shophead{flex:none;width:100%;max-width:320px;}
.gdh-veil--shop .gdh-shoplist{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
.gdh-shopfoot{flex:none;position:sticky;bottom:0;z-index:2;width:100%;max-width:300px;
  display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 4px 2px;
  background:#FFFBF4;box-shadow:0 -10px 12px #FFFBF4;}
.gdh-shopitem{display:flex;align-items:center;gap:8px;background:#fff;border-radius:16px;padding:8px 10px;
  box-shadow:0 3px 8px rgba(170,140,90,.22);text-align:left;}
.gdh-shopemoji{font-size:24px;line-height:1;}
.gdh-shoptext{flex:1;min-width:0;}
.gdh-shopname{font-size:14px;font-weight:900;color:#7A5A2E;}
.gdh-shopdesc{font-size:11px;font-weight:700;color:#93795A;line-height:1.4;}
.gdh-buy{border:none;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#FFC96B,#EEA23A);color:#fff;box-shadow:0 3px 0 #C67F22;
  white-space:nowrap;min-height:${TOUCH_MIN}px;}
.gdh-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #C67F22;}
.gdh-buy[disabled]{opacity:.42;cursor:default;}

/* 结算跳数:${TALLY_MS}ms 走完,点一下立刻停在终值;上面那块小画布是矿石飞进钱袋的清点台 */
.gdh-tally{font-size:26px;font-weight:900;color:#B37514;cursor:pointer;line-height:1.2;
  display:flex;align-items:center;justify-content:center;gap:6px;min-height:${TOUCH_MIN}px;box-sizing:border-box;}
.gdh-tally-hint{font-size:11px;font-weight:700;color:#A08A66;}
.gdh-tally-fly{display:block;margin:0 auto;width:140px;height:44px;}

.gdh-modes{display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 10px;}
.gdh-modes-title{font-size:19px;font-weight:900;color:#8A5A22;text-align:center;}
.gdh-modes-sub{font-size:13px;font-weight:700;color:#8A6C42;text-align:center;line-height:1.6;max-width:340px;}
.gdh-cards{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
.gdh-card{border:none;border-radius:20px;padding:14px 16px;min-width:150px;max-width:220px;cursor:pointer;
  font-family:inherit;background:#fff;box-shadow:0 5px 0 rgba(170,140,90,.28);text-align:center;
  min-height:${TOUCH_MIN}px;}
.gdh-card:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(170,140,90,.28);}
.gdh-card-emoji{font-size:30px;line-height:1.2;}
.gdh-card-name{font-size:16px;font-weight:900;color:#7A5A2E;}
.gdh-card-sub{margin-top:4px;font-size:12px;font-weight:700;color:#93795A;line-height:1.5;}
.gdh-topbar{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.gdh-topbar[hidden]{display:none;}
.gdh-topbar-title{flex:1;text-align:center;font-size:14px;font-weight:900;color:#7A5A2E;}
.gdh-btn:focus-visible,.gdh-buy:focus-visible,.gdh-card:focus-visible,.gdh-cv:focus-visible{
  outline:3px solid #6B4A16;outline-offset:3px;}

/* r18 B:平板横屏/桌面首页只占 250px 贴顶,下方 400px 空白。竖直居中 + 卡片放大一档;
   只作用于首页(gdh-home),关内结算面板同用 gdh-modes,不许被扫到。窄屏/矮横屏原样。 */
@media (min-width:900px) and (min-height:620px){
  .gdh-home{min-height:calc(100dvh - 180px);justify-content:center;gap:16px;}
  .gdh-home .gdh-cards{gap:16px;}
  .gdh-home .gdh-card{min-width:200px;max-width:260px;padding:18px 20px;}
  .gdh-home .gdh-card-emoji{font-size:36px;}
  .gdh-home .gdh-card-name{font-size:18px;}
  .gdh-home .gdh-card-sub{font-size:13px;}
}
@media (min-width:700px) and (max-width:899px) and (min-height:700px){
  .gdh-home{min-height:calc(100dvh - 180px);justify-content:center;gap:14px;}
  .gdh-home .gdh-cards{gap:14px;}
  .gdh-home .gdh-card{min-width:180px;max-width:240px;padding:16px 18px;}
}
@media (max-height:840px) and (min-height:501px){
  .gdh-ctrl{position:sticky;bottom:0;z-index:3;padding-top:4px;
    background:linear-gradient(180deg,rgba(255,251,244,0),#FFFBF4 40%);}
}

@media (max-width:420px){
  /* 窄屏上按钮把文字收起来只留图标,一行才塞得下,但热区一格都不缩 */
  .gdh-btn .gdh-lb{display:none;}
  .gdh-btn{padding:8px 10px;font-size:15px;}
  .gdh-btn-fire{padding:8px 10px;font-size:16px;}
  .gdh-btn-fire .gdh-lb{display:inline;}
  /* 360px 上这一行是掐着算的:放绳(带字) + 炸药 + 道具栏 + 商店 + 暂停,
     再多一格就要挤出屏幕,所以「收工」挪去了顶部那一行 */
  .gdh-ctrl{gap:4px;}
  .gdh-kit{padding:0 7px;}
  .gdh-tip{font-size:11px;}
  /* 商店那三行在窄屏上得瘦一圈;货架仍自滚,footer 不跟着重排 */
  .gdh-veil{padding:10px;gap:7px;}
  .gdh-shopfoot{gap:6px;padding:6px 0 0;}
  .gdh-veil-title{font-size:17px;}
  .gdh-veil-sub{font-size:12px;line-height:1.5;}
  .gdh-shoplist{gap:6px;}
  .gdh-shopitem{padding:6px 8px;border-radius:13px;}
  .gdh-shopemoji{font-size:20px;}
  .gdh-shopname{font-size:13px;}
  .gdh-shopdesc{font-size:10px;}
  .gdh-buy{padding:6px 10px;font-size:12px;}
}

@media (prefers-reduced-motion:reduce){
  .gdh-btn:active,.gdh-buy:active,.gdh-card:active{transform:none;}
  .gdh-bar-fill{transition:none;}
  .gdh-toast{transition:none;}
  .gdh-done{animation:none;}
}
`;
